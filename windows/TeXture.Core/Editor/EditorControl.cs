using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using TeXture.Core.Util;

namespace TeXture.Core.Editor
{
    /// <summary>
    /// Hosts the shared web editor (ui/index.html) in WebView2. Used as-is for the sidebar task pane and
    /// inside the popup form. Messages are JSON objects in both directions ({type: ..., ...}); messages
    /// sent before the page reports "ready" are queued, so nothing is lost during start-up.
    /// </summary>
    public sealed class EditorControl : UserControl
    {
        private readonly WebView2 _web;
        private readonly Queue<string> _pending = new Queue<string>();
        private bool _pageReady;
        private bool _focusRequested;

        public EditorControl(string hostId, string surface)
        {
            HostId = hostId;
            Surface = surface;
            _web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = System.Drawing.Color.Transparent };
            Controls.Add(_web);
            InitializeAsync();
        }

        public string HostId { get; }

        /// <summary>"pane" or "popup".</summary>
        public string Surface { get; }

        /// <summary>HWND of the document window this editor belongs to (sidebars only).</summary>
        public IntPtr BoundWindow { get; set; }

        public bool IsPageReady => _pageReady;

        public event EventHandler<Dictionary<string, object>> MessageReceived;

        private async void InitializeAsync()
        {
            try
            {
                var env = await WebViewEnvironment.GetAsync();
                await _web.EnsureCoreWebView2Async(env);
                var core = _web.CoreWebView2;

                var settings = core.Settings;
                settings.AreBrowserAcceleratorKeysEnabled = false; // frees Ctrl+F/G/H/R/... for MathType-style shortcuts
                settings.IsStatusBarEnabled = false;
                settings.IsZoomControlEnabled = false;
                settings.AreHostObjectsAllowed = false;
                settings.IsGeneralAutofillEnabled = false;
                settings.IsPasswordAutosaveEnabled = false;
#if !DEBUG
                settings.AreDevToolsEnabled = false;
#endif
                core.SetVirtualHostNameToFolderMapping(UiLocator.VirtualHost, UiLocator.UiDirectory,
                    CoreWebView2HostResourceAccessKind.Allow);

                core.NavigationStarting += (s, e) =>
                {
                    // The editor never navigates away; external links open in the default browser.
                    if (!e.Uri.StartsWith("http://" + UiLocator.VirtualHost + "/", StringComparison.OrdinalIgnoreCase))
                    {
                        e.Cancel = true;
                        OpenExternal(e.Uri);
                    }
                };
                core.NewWindowRequested += (s, e) => { e.Handled = true; OpenExternal(e.Uri); };
                core.WebMessageReceived += OnWebMessage;
                core.ProcessFailed += (s, e) => Log.Error("WebView2 process failed: " + e.ProcessFailedKind);

                ApplyTheme(ThemeIsDark);
                await ClearCacheOnUpgradeAsync(core);
                core.Navigate($"http://{UiLocator.VirtualHost}/index.html?host={HostId}&surface={Surface}");
            }
            catch (Exception ex)
            {
                Log.Error("WebView2 initialisation failed", ex);
                ShowFallback(ex);
            }
        }

        /// <summary>
        /// Office hotkeys typed while the editor has focus. Alt-combinations are system keys that WebView2
        /// hands to the host as accelerators; the WinForms WebView2 control routes them to ProcessCmdKey.
        /// Returning true consumes the key.
        /// </summary>
        public Func<Keys, bool> HotkeyFilter { get; set; }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            var filter = HotkeyFilter;
            if (filter != null && filter(keyData)) return true;
            return base.ProcessCmdKey(ref msg, keyData);
        }

        private static bool _cacheChecked;

        /// <summary>
        /// After an upgrade the WebView2 HTTP cache could serve old UI files next to new ones; clear it once
        /// whenever the add-in version changes (settings/localStorage are not affected).
        /// </summary>
        private static async System.Threading.Tasks.Task ClearCacheOnUpgradeAsync(CoreWebView2 core)
        {
            if (_cacheChecked) return;
            _cacheChecked = true;
            try
            {
                string marker = System.IO.Path.Combine(Paths.LocalDir, "ui.version");
                string version = typeof(EditorControl).Assembly.GetName().Version.ToString();
                string previous = System.IO.File.Exists(marker) ? System.IO.File.ReadAllText(marker).Trim() : "";
                if (previous == version) return;
                await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache);
                System.IO.File.WriteAllText(marker, version);
                Log.Info($"WebView2 cache cleared (UI {previous} → {version})");
            }
            catch (Exception ex) { Log.Warn("Could not clear the WebView2 cache", ex); }
        }

        /// <summary>Set by the runtime before the page loads; also applied live when settings change.</summary>
        public bool ThemeIsDark { get; set; }

        public void ApplyTheme(bool dark)
        {
            ThemeIsDark = dark;
            try
            {
                if (_web.CoreWebView2 != null)
                    _web.CoreWebView2.Profile.PreferredColorScheme =
                        dark ? CoreWebView2PreferredColorScheme.Dark : CoreWebView2PreferredColorScheme.Light;
            }
            catch (Exception ex) { Log.Warn("Could not set WebView2 colour scheme", ex); }
        }

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            Dictionary<string, object> msg;
            try { msg = Json.ParseObject(e.WebMessageAsJson); }
            catch (Exception ex) { Log.Warn("Bad message from editor", ex); return; }
            if (msg == null) return;

            // Handle after the WebView2 event returns. WebView2 events are not re-entrant: a modal dialog
            // (capture overlay, file dialogs) opened inside WebMessageReceived stalled the capture flow
            // when it was started from the editor's button, while the hotkey path worked.
            BeginInvoke(new Action(() => Dispatch(msg)));
        }

        private void Dispatch(Dictionary<string, object> msg)
        {
            if (IsDisposed) return;
            if (msg.GetString("type") == "ready")
            {
                // The runtime answers with PostNow("init"); anything else it posts is queued behind the
                // messages that were waiting, so the page sees everything in chronological order.
                MessageReceived?.Invoke(this, msg);
                _pageReady = true;
                while (_pending.Count > 0) _web.CoreWebView2.PostWebMessageAsJson(_pending.Dequeue());
                if (_focusRequested) FocusEditor();
                return;
            }
            MessageReceived?.Invoke(this, msg);
        }

        /// <summary>Sends a message to the page (queued until the page is ready).</summary>
        public void Post(Dictionary<string, object> message)
        {
            string json = Json.Serialize(message);
            if (!_pageReady || _web.CoreWebView2 == null) { _pending.Enqueue(json); return; }
            try { _web.CoreWebView2.PostWebMessageAsJson(json); }
            catch (Exception ex) { Log.Warn("PostWebMessage failed", ex); }
        }

        /// <summary>Sends immediately, ahead of anything queued (used for the "init" reply).</summary>
        internal void PostNow(Dictionary<string, object> message)
        {
            try { _web.CoreWebView2?.PostWebMessageAsJson(Json.Serialize(message)); }
            catch (Exception ex) { Log.Warn("PostWebMessage failed", ex); }
        }

        public void FocusEditor()
        {
            _focusRequested = true;
            if (!_pageReady) return;
            _focusRequested = false;
            try
            {
                _web.Focus();
                Post(new Dictionary<string, object> { ["type"] = "focus" });
            }
            catch (Exception ex) { Log.Warn("Focus editor failed", ex); }
        }

        private void ShowFallback(Exception ex)
        {
            Controls.Clear();
            Controls.Add(new Label
            {
                Dock = DockStyle.Fill,
                TextAlign = System.Drawing.ContentAlignment.MiddleCenter,
                Text = "편집기를 시작할 수 없습니다.\nMicrosoft Edge WebView2 런타임이 설치되어 있는지 확인해 주세요.\n\n" + ex.Message,
            });
        }

        private static void OpenExternal(string uri)
        {
            if (uri != null && uri.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); } catch { }
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                try { if (_web.CoreWebView2 != null) _web.CoreWebView2.WebMessageReceived -= OnWebMessage; } catch { }
                _web.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
