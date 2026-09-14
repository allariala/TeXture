using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using TeXture.Core.Util;

namespace TeXture.Core.Settings
{
    /// <summary>
    /// User preferences (%APPDATA%\TeXture\settings.json, shared by PowerPoint and Word) and per-host
    /// working state (state.&lt;host&gt;.json: drafts, recent equations).
    ///
    /// Both Office processes may write at the same time, so every change is a read-modify-write under
    /// a named mutex: a patch from PowerPoint never clobbers a change Word just made.
    /// The UI owns most keys; C# only reads the few it acts on (hotkeys, theme, font defaults).
    /// </summary>
    public sealed class SettingsStore
    {
        private const string MutexName = @"Local\TeXture.Settings";

        private readonly string _settingsPath;
        private readonly string _statePath;
        private Dictionary<string, object> _settings;
        private Dictionary<string, object> _state;

        public SettingsStore(string hostId)
        {
            HostId = hostId;
            _settingsPath = Path.Combine(Paths.RoamingDir, "settings.json");
            _statePath = Path.Combine(Paths.RoamingDir, "state." + hostId + ".json");
            WithLock(() =>
            {
                _settings = ReadFile(_settingsPath);
                _state = ReadFile(_statePath);
            });
            ApplyDefaults(_settings);
        }

        public string HostId { get; }

        public event EventHandler SettingsChanged;

        public Dictionary<string, object> Settings => Json.DeepClone(_settings);
        public Dictionary<string, object> State => Json.DeepClone(_state);

        public static Dictionary<string, object> Defaults() => new Dictionary<string, object>
        {
            ["version"] = 1,
            ["theme"] = "auto",              // auto | light | dark
            ["afterInsert"] = "document",    // document (focus + select on slide) | editor
            ["hotkeys"] = new Dictionary<string, object>
            {
                ["pane"] = "Alt+Shift+E",
                ["popup"] = "Alt+Shift+Q",
                ["capture"] = "Alt+Shift+S",
            },
            ["hosts"] = new Dictionary<string, object>
            {
                ["ppt"] = new Dictionary<string, object> { ["fontSize"] = 18, ["color"] = "#000000" },
                ["word"] = new Dictionary<string, object> { ["fontSize"] = 11, ["color"] = "#000000" },
            },
        };

        public string GetHotkey(string id) => _settings.GetObject("hotkeys").GetString(id);

        public string Theme => _settings.GetString("theme", "auto");

        public bool ReturnFocusToDocument => _settings.GetString("afterInsert", "document") != "editor";

        public void PatchSettings(IDictionary<string, object> patch)
        {
            if (patch == null) return;
            WithLock(() =>
            {
                var current = ReadFile(_settingsPath);
                ApplyDefaults(current);
                Json.DeepMerge(current, patch);
                Write(_settingsPath, current);
                _settings = current;
            });
            SettingsChanged?.Invoke(this, EventArgs.Empty);
        }

        public void PatchState(IDictionary<string, object> patch)
        {
            if (patch == null) return;
            WithLock(() =>
            {
                var current = ReadFile(_statePath);
                Json.DeepMerge(current, patch);
                Write(_statePath, current);
                _state = current;
            });
        }

        /// <summary>Reloads settings written by the other Office application.</summary>
        public void Reload()
        {
            WithLock(() => _settings = ReadFile(_settingsPath));
            ApplyDefaults(_settings);
        }

        private static void ApplyDefaults(Dictionary<string, object> target)
        {
            var merged = Defaults();
            Json.DeepMerge(merged, target);
            target.Clear();
            foreach (var kv in merged) target[kv.Key] = kv.Value;
        }

        private static Dictionary<string, object> ReadFile(string path)
        {
            try
            {
                if (File.Exists(path)) return Json.ParseObject(File.ReadAllText(path)) ?? new Dictionary<string, object>();
            }
            catch (Exception ex)
            {
                // A corrupt file is kept aside rather than silently overwritten.
                Log.Warn("Could not read " + path + "; keeping a .bad copy and starting fresh", ex);
                try { File.Copy(path, path + ".bad", true); } catch { }
            }
            return new Dictionary<string, object>();
        }

        private static void Write(string path, Dictionary<string, object> data)
        {
            try { Paths.WriteAllTextAtomic(path, Json.Serialize(data)); }
            catch (Exception ex) { Log.Error("Could not write " + path, ex); }
        }

        internal static void WithLock(Action action)
        {
            using (var mutex = new Mutex(false, MutexName))
            {
                bool owned = false;
                try
                {
                    try { owned = mutex.WaitOne(3000); }
                    catch (AbandonedMutexException) { owned = true; }
                    action();
                }
                finally
                {
                    if (owned) mutex.ReleaseMutex();
                }
            }
        }
    }
}
