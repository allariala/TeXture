using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;
using TeXture.Core.Util;

namespace TeXture.Core.Capture
{
    /// <summary>
    /// Owns the connection to the local OCR server (texture_capture.exe).
    ///
    /// API v2 servers (this release) are shared: PowerPoint and Word attach to one process, found via
    /// %LOCALAPPDATA%\TeXture\capture_server.json. The server watches its client PIDs and exits when the
    /// last Office process is gone, so closing PowerPoint never breaks capture in Word, and nobody kills
    /// processes by name. Requests carry a per-launch token.
    ///
    /// API v1 servers (the v1.2 exe) cannot be shared: each Office process starts its own, bound to a job
    /// object so it dies with Office, and only that exact process is stopped on shutdown.
    /// </summary>
    public sealed class CaptureService : IDisposable
    {
        private const string TokenHeader = "X-TeXture-Token";
        private const string LaunchMutex = @"Local\TeXture.CaptureServer.Launch";
        private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(90);

        private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        private readonly string _infoPath = Path.Combine(Paths.LocalDir, "capture_server.json");
        private readonly SemaphoreSlim _gate = new SemaphoreSlim(1, 1);

        private int _port = -1;
        private string _token;
        private int _api;
        private Process _ownedLegacyProcess;
        private JobObject _job;

        public event Action<string> StatusChanged;

        public string Status { get; private set; } = "Offline";

        public int Port => _port;

        /// <summary>True once a server answered its health check (the model is loaded).</summary>
        public bool IsReady => _port > 0 && Status == "Idle";

        public async Task<bool> EnsureReadyAsync()
        {
            await _gate.WaitAsync().ConfigureAwait(true);
            try
            {
                if (_port > 0 && await IsHealthyAsync(_port, _token).ConfigureAwait(true) > 0)
                {
                    SetStatus("Idle");
                    return true;
                }
                _port = -1;

                if (await TryAttachSharedAsync().ConfigureAwait(true)) { SetStatus("Idle"); return true; }

                SetStatus("Starting...");
                bool ok = await LaunchAsync().ConfigureAwait(true);
                SetStatus(ok ? "Idle" : "Offline");
                return ok;
            }
            catch (Exception ex)
            {
                Log.Error("Capture server start failed", ex);
                SetStatus("Offline");
                return false;
            }
            finally
            {
                _gate.Release();
            }
        }

        /// <summary>Sends an image to the server and returns LaTeX. Retries once if the server went away.</summary>
        public async Task<string> RecognizeAsync(string imagePath)
        {
            for (int attempt = 0; attempt < 2; attempt++)
            {
                if (!await EnsureReadyAsync().ConfigureAwait(true))
                    throw new InvalidOperationException("AI 캡처 엔진을 시작할 수 없습니다.");

                SetStatus("Processing...");
                try
                {
                    using (var content = new MultipartFormDataContent())
                    using (var stream = new FileStream(imagePath, FileMode.Open, FileAccess.Read))
                    using (var file = new StreamContent(stream))
                    using (var request = new HttpRequestMessage(HttpMethod.Post, $"http://127.0.0.1:{_port}/predict"))
                    {
                        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
                        content.Add(file, "file", Path.GetFileName(imagePath));
                        request.Content = content;
                        AddToken(request);

                        using (var response = await _http.SendAsync(request).ConfigureAwait(true))
                        {
                            var body = Json.ParseObject(await response.Content.ReadAsStringAsync().ConfigureAwait(true));
                            if (body == null) throw new InvalidOperationException("서버 응답을 해석할 수 없습니다.");
                            if (!body.GetBool("success"))
                                throw new InvalidOperationException(body.GetString("error") ?? "변환 실패");
                            return body.GetString("latex") ?? "";
                        }
                    }
                }
                catch (HttpRequestException ex) when (attempt == 0)
                {
                    Log.Warn("Capture server unreachable; restarting", ex);
                    _port = -1;
                }
                finally
                {
                    SetStatus(_port > 0 ? "Idle" : "Offline");
                }
            }
            throw new InvalidOperationException("AI 캡처 엔진에 연결할 수 없습니다.");
        }

        private async Task<bool> TryAttachSharedAsync()
        {
            var info = ReadInfo();
            if (info == null) return false;
            int port = (int)(info.GetDouble("port") ?? -1);
            int pid = (int)(info.GetDouble("pid") ?? -1);
            string token = info.GetString("token");
            if (port <= 0 || !IsAlive(pid)) return false;

            if (await IsHealthyAsync(port, token).ConfigureAwait(true) < 2) return false;
            if (!await PostAttachAsync(port, token).ConfigureAwait(true)) return false;

            _port = port;
            _token = token;
            _api = 2;
            Log.Info($"Attached to shared capture server pid={pid} port={port}");
            return true;
        }

        private async Task<bool> LaunchAsync()
        {
            string exe = ResolveServerExe();
            if (exe == null)
            {
                Log.Error("texture_capture.exe not found");
                return false;
            }

            // A named semaphore (not a mutex): it is held across awaits, and semaphores have no thread affinity.
            using (var launchLock = new Semaphore(1, 1, LaunchMutex))
            {
                bool owned = false;
                try
                {
                    owned = launchLock.WaitOne(TimeSpan.FromSeconds(5));

                    // Another Office process may have launched it while we waited.
                    if (await TryAttachSharedAsync().ConfigureAwait(true)) return true;

                    int port = FreePort();
                    string token = NewToken();
                    var psi = new ProcessStartInfo(exe, "--port " + port)
                    {
                        WorkingDirectory = Path.GetDirectoryName(exe),
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden,
                    };
                    // Passed via environment so the v1 exe (strict argparse) still starts.
                    psi.EnvironmentVariables["TEXTURE_TOKEN"] = token;
                    psi.EnvironmentVariables["TEXTURE_PARENT_PID"] = Process.GetCurrentProcess().Id.ToString();

                    var process = Process.Start(psi);
                    Log.Info($"Started capture server pid={process.Id} port={port}");

                    var deadline = DateTime.UtcNow + StartupTimeout;
                    int api = 0;
                    while (DateTime.UtcNow < deadline && !process.HasExited)
                    {
                        api = await IsHealthyAsync(port, token).ConfigureAwait(true);
                        if (api > 0) break;
                        await Task.Delay(700).ConfigureAwait(true);
                    }
                    if (api == 0)
                    {
                        Log.Error("Capture server did not become healthy" + (process.HasExited ? $" (exit code {process.ExitCode})" : ""));
                        TryKill(process);
                        return false;
                    }

                    _port = port;
                    _token = token;
                    _api = api;

                    if (api >= 2)
                    {
                        WriteInfo(process.Id, port, token, api);
                    }
                    else
                    {
                        // Legacy exe: private to this Office process and bound to its lifetime.
                        _ownedLegacyProcess = process;
                        _job = _job ?? new JobObject();
                        _job.Assign(process);
                    }
                    return true;
                }
                finally
                {
                    if (owned) launchLock.Release();
                }
            }
        }

        /// <summary>Returns the server API level (1 = v1.2 exe, 2 = shared server) or 0 if unreachable.</summary>
        private async Task<int> IsHealthyAsync(int port, string token)
        {
            try
            {
                using (var request = new HttpRequestMessage(HttpMethod.Get, $"http://127.0.0.1:{port}/"))
                using (var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2)))
                {
                    if (!string.IsNullOrEmpty(token)) request.Headers.Add(TokenHeader, token);
                    using (var response = await _http.SendAsync(request, cts.Token).ConfigureAwait(true))
                    {
                        if (!response.IsSuccessStatusCode) return 0;
                        var body = Json.ParseObject(await response.Content.ReadAsStringAsync().ConfigureAwait(true));
                        return (int)(body.GetDouble("api") ?? 1);
                    }
                }
            }
            catch
            {
                return 0;
            }
        }

        private async Task<bool> PostAttachAsync(int port, string token)
        {
            try
            {
                using (var request = new HttpRequestMessage(HttpMethod.Post,
                    $"http://127.0.0.1:{port}/attach?pid={Process.GetCurrentProcess().Id}"))
                {
                    request.Headers.Add(TokenHeader, token);
                    using (var response = await _http.SendAsync(request).ConfigureAwait(true))
                        return response.IsSuccessStatusCode;
                }
            }
            catch (Exception ex)
            {
                Log.Warn("Attach to capture server failed", ex);
                return false;
            }
        }

        private void AddToken(HttpRequestMessage request)
        {
            if (!string.IsNullOrEmpty(_token)) request.Headers.Add(TokenHeader, _token);
        }

        private Dictionary<string, object> ReadInfo()
        {
            try { return File.Exists(_infoPath) ? Json.ParseObject(File.ReadAllText(_infoPath)) : null; }
            catch { return null; }
        }

        private void WriteInfo(int pid, int port, string token, int api)
        {
            try
            {
                Paths.WriteAllTextAtomic(_infoPath, Json.Serialize(new Dictionary<string, object>
                {
                    ["pid"] = pid, ["port"] = port, ["token"] = token, ["api"] = api,
                }));
            }
            catch (Exception ex) { Log.Warn("Could not write capture_server.json", ex); }
        }

        /// <summary>
        /// Install folder from the registry (written by the installer), then next to the add-in
        /// ({app}\PowerPoint → {app}\capture_server), then the historical default path.
        /// </summary>
        internal static string ResolveServerExe()
        {
            var candidates = new List<string>();
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                try
                {
                    using (var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view))
                    using (var key = hklm.OpenSubKey(@"SOFTWARE\TeXture"))
                    {
                        if (key?.GetValue("InstallDir") is string dir) candidates.Add(Path.Combine(dir, "capture_server"));
                    }
                }
                catch { }
            }
            string addIn = Paths.AddInDir.TrimEnd('\\');
            candidates.Add(Path.Combine(addIn, "capture_server"));
            candidates.Add(Path.Combine(Path.GetDirectoryName(addIn) ?? addIn, "capture_server"));
            candidates.Add(@"C:\Program Files\TeXture\capture_server");

            foreach (var dir in candidates)
            {
                string exe = Path.Combine(dir, "texture_capture.exe");
                if (File.Exists(exe)) return exe;
            }
            return null;
        }

        private static int FreePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        private static string NewToken()
        {
            var bytes = new byte[24];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        private static bool IsAlive(int pid)
        {
            if (pid <= 0) return false;
            try { using (var p = Process.GetProcessById(pid)) return !p.HasExited; }
            catch { return false; }
        }

        private static void TryKill(Process p)
        {
            try { if (!p.HasExited) p.Kill(); } catch { }
        }

        private void SetStatus(string status)
        {
            if (Status == status) return;
            Status = status;
            StatusChanged?.Invoke(status);
        }

        public void Dispose()
        {
            // Shared (v2) servers shut themselves down when their last client exits.
            if (_ownedLegacyProcess != null)
            {
                TryKill(_ownedLegacyProcess);
                _ownedLegacyProcess.Dispose();
                _ownedLegacyProcess = null;
            }
            _job?.Dispose();
            _http.Dispose();
        }
    }
}
