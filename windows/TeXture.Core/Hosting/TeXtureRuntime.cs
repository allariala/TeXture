using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Office.Tools;
using TeXture.Core.Capture;
using TeXture.Core.Editor;
using TeXture.Core.Input;
using TeXture.Core.Ribbon;
using TeXture.Core.Settings;
using TeXture.Core.Util;

namespace TeXture.Core.Hosting
{
    /// <summary>
    /// The host-independent brain of the add-in: owns the sidebars (one per document window) and the
    /// shared popup, routes document selection to them, executes editor requests through the
    /// <see cref="IHostAdapter"/>, and runs hotkeys and screen capture.
    /// Everything runs on the Office UI thread.
    /// </summary>
    public sealed class TeXtureRuntime : IDisposable
    {
        private const int PaneWidth = 440;

        private readonly IHostAdapter _host;
        private readonly CustomTaskPaneCollection _paneCollection;
        private readonly Icon _icon;
        private readonly string _title;
        private readonly SettingsStore _settings;
        private readonly SnippetStore _snippets = new SnippetStore();
        private readonly CaptureService _capture = new CaptureService();
        private readonly KeyboardHook _hook;
        private readonly Dictionary<IntPtr, CustomTaskPane> _panes = new Dictionary<IntPtr, CustomTaskPane>();
        private readonly Dictionary<HotkeyGesture, Action> _hotkeys = new Dictionary<HotkeyGesture, Action>();

        private EditorForm _form;
        private bool _suppressSelection;
        private bool _captureBusy;
        private bool _lastDark;

        public TeXtureRuntime(IHostAdapter host, CustomTaskPaneCollection paneCollection, Icon icon, string title)
        {
            _host = host;
            _paneCollection = paneCollection;
            _icon = icon;
            _title = title;
            Log.Configure(host.HostId);
            Log.Info($"TeXture {Version} starting in {host.Kind}");

            _settings = new SettingsStore(host.HostId);
            _lastDark = ResolveDark();
            _hook = new KeyboardHook();
            ApplyHotkeys();

            _host.SelectionChanged += OnSelectionChanged;
            _host.WindowActivated += OnWindowActivated;
            _host.WindowsChanged += OnWindowsChanged;
            _capture.StatusChanged += status => Broadcast(new Dictionary<string, object> { ["type"] = "status", ["server"] = status });
        }

        public static string Version => Assembly.GetExecutingAssembly().GetName().Version.ToString(3);

        // ------------------------------------------------------------------ surfaces

        public void ShowPane()
        {
            var ctp = GetOrCreatePane();
            if (ctp == null) return;
            ctp.Visible = true;
            var editor = (EditorControl)ctp.Control;
            RefreshSharedState(editor);
            editor.FocusEditor();
        }

        public void ShowPopup()
        {
            var form = GetOrCreateForm();
            form.ShowOwnedBy(ActiveWindowHandle);
            RefreshSharedState(form.Editor);
            SyncSelection(form.Editor);
            form.Editor.FocusEditor();
        }

        public void StartCapture()
        {
            var editor = ActiveEditor(showIfHidden: true);
            if (editor != null) RunCapture(editor);
        }

        /// <summary>Ribbon gallery click: insert the template into the editor that is in use.</summary>
        public void InsertFromCatalog(CatalogItem item)
        {
            if (item == null) return;
            var editor = ActiveEditor(showIfHidden: true);
            if (editor == null) return;
            editor.Post(new Dictionary<string, object>
            {
                ["type"] = "command", ["name"] = "insertTemplate", ["tex"] = item.Tex, ["mode"] = item.Mode,
            });
            editor.FocusEditor();
        }

        public void OpenSettings()
        {
            var editor = ActiveEditor(showIfHidden: true);
            editor?.Post(new Dictionary<string, object> { ["type"] = "command", ["name"] = "openSettings" });
        }

        private EditorControl ActiveEditor(bool showIfHidden)
        {
            if (_form != null && _form.Visible)
            {
                _form.Activate();
                return _form.Editor;
            }
            var hwnd = ActiveWindowHandle;
            if (_panes.TryGetValue(hwnd, out var ctp) && IsAlive(hwnd, ctp) && ctp.Visible) return (EditorControl)ctp.Control;
            if (!showIfHidden) return null;
            ShowPane();
            return _panes.TryGetValue(ActiveWindowHandle, out ctp) ? (EditorControl)ctp.Control : null;
        }

        private CustomTaskPane GetOrCreatePane()
        {
            object window = _host.ActiveWindow;
            if (window == null) return null;
            IntPtr hwnd = _host.GetWindowHandle(window);
            PrunePanes();
            if (_panes.TryGetValue(hwnd, out var existing)) return existing;

            var editor = CreateEditor("pane");
            editor.BoundWindow = hwnd;
            var ctp = _paneCollection.Add(editor, _title, window);
            ctp.Width = ScaleForDpi(PaneWidth);
            ctp.VisibleChanged += (s, e) =>
            {
                if (ctp.Visible) SyncSelection(editor);
            };
            _panes[hwnd] = ctp;
            return ctp;
        }

        private EditorForm GetOrCreateForm()
        {
            if (_form != null && !_form.IsDisposed) return _form;
            _form = new EditorForm(CreateEditor("popup"), _icon, _title);
            if (_settings.Settings.GetArray("popupBounds") is object[] b && b.Length == 4)
            {
                try
                {
                    _form.ApplySavedBounds(new Rectangle(Convert.ToInt32(b[0]), Convert.ToInt32(b[1]),
                        Convert.ToInt32(b[2]), Convert.ToInt32(b[3])));
                }
                catch (Exception ex) { Log.Warn("Ignoring saved popup bounds", ex); }
            }
            _form.BoundsCommitted += r => _settings.PatchSettings(new Dictionary<string, object>
            {
                ["popupBounds"] = new object[] { r.X, r.Y, r.Width, r.Height },
            });
            return _form;
        }

        private EditorControl CreateEditor(string surface)
        {
            var editor = new EditorControl(_host.HostId, surface) { ThemeIsDark = _lastDark, HotkeyFilter = TryEditorHotkey };
            editor.MessageReceived += OnEditorMessage;
            return editor;
        }

        /// <summary>
        /// Releases sidebars whose document window has closed. v1.2 kept them (and their selection
        /// handlers) alive forever, and a single dead pane aborted updates to all others.
        /// </summary>
        private void PrunePanes()
        {
            foreach (var kv in _panes.ToList())
            {
                if (IsAlive(kv.Key, kv.Value)) continue;
                _panes.Remove(kv.Key);
                var control = SafeControl(kv.Value);
                try { _paneCollection.Remove(kv.Value); } catch (Exception ex) { Log.Warn("Removing dead task pane", ex); }
                if (control != null && !control.IsDisposed)
                {
                    if (control is EditorControl ed) ed.MessageReceived -= OnEditorMessage;
                    control.Dispose();
                }
            }
        }

        private static bool IsAlive(IntPtr hwnd, CustomTaskPane ctp)
        {
            if (!Win32.IsWindow(hwnd)) return false;
            try { return ctp.Window != null; } catch { return false; }
        }

        private static Control SafeControl(CustomTaskPane ctp)
        {
            try { return ctp.Control; } catch { return null; }
        }

        private IEnumerable<EditorControl> Editors
        {
            get
            {
                foreach (var ctp in _panes.Values)
                {
                    if (SafeControl(ctp) is EditorControl ed && !ed.IsDisposed) yield return ed;
                }
                if (_form != null && !_form.IsDisposed) yield return _form.Editor;
            }
        }

        private IntPtr ActiveWindowHandle
        {
            get
            {
                try
                {
                    var w = _host.ActiveWindow;
                    return w == null ? IntPtr.Zero : _host.GetWindowHandle(w);
                }
                catch { return IntPtr.Zero; }
            }
        }

        // ------------------------------------------------------------------ document events

        private void OnSelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_suppressSelection) return;
            var targets = Editors.Where(ed => IsVisible(ed) && (ed.Surface == "popup" || ed.BoundWindow == e.WindowHandle)).ToList();
            if (targets.Count == 0) return;
            var msg = SelectionMessage();
            foreach (var ed in targets) ed.Post(msg);
        }

        private void OnWindowActivated(object sender, EventArgs e)
        {
            PrunePanes();
            bool dark = ResolveDark();
            if (dark != _lastDark) ApplyThemeToAll(dark);
            if (_form != null && !_form.IsDisposed && _form.Visible)
            {
                _form.SetOwnerWindow(ActiveWindowHandle);
                SyncSelection(_form.Editor);
            }
        }

        private void OnWindowsChanged(object sender, EventArgs e) => PrunePanes();

        private bool IsVisible(EditorControl ed)
        {
            if (ed.Surface == "popup") return _form != null && _form.Visible;
            return _panes.TryGetValue(ed.BoundWindow, out var ctp) && SafeVisible(ctp);
        }

        private static bool SafeVisible(CustomTaskPane ctp)
        {
            try { return ctp.Visible; } catch { return false; }
        }

        private Dictionary<string, object> SelectionMessage()
        {
            SelectionState state;
            try { state = _host.GetSelection() ?? SelectionState.Empty; }
            catch (Exception ex)
            {
                Log.Warn("Reading selection failed", ex);
                state = SelectionState.Empty;
            }
            return new Dictionary<string, object>
            {
                ["type"] = "selection",
                ["equation"] = state.Equation?.ToMessage(),
                ["note"] = state.Note,
            };
        }

        private void SyncSelection(EditorControl editor) => editor.Post(SelectionMessage());

        // ------------------------------------------------------------------ editor messages

        private void OnEditorMessage(object sender, Dictionary<string, object> msg)
        {
            var editor = (EditorControl)sender;
            string type = msg.GetString("type");
            try
            {
                switch (type)
                {
                    case "ready":
                        editor.PostNow(BuildInit(editor));
                        SyncSelection(editor);
                        break;
                    case "insert":
                        HandleInsert(editor, msg);
                        break;
                    case "escape":
                        _host.ReturnFocusToDocument(null);
                        break;
                    case "capture":
                        RunCapture(editor);
                        break;
                    case "settings":
                        _settings.PatchSettings(msg.GetObject("patch"));
                        OnSettingsChanged(editor);
                        break;
                    case "state":
                        _settings.PatchState(msg.GetObject("patch"));
                        break;
                    case "snippets.save":
                        _snippets.Save(msg.GetArray("snippets"));
                        BroadcastSnippets(except: editor);
                        break;
                    case "snippets.import":
                        var imported = _snippets.Import(OwnerFor(editor), msg.GetArray("current"));
                        if (imported != null)
                        {
                            _snippets.Save(imported);
                            BroadcastSnippets(except: null);
                        }
                        break;
                    case "snippets.export":
                        _snippets.Export(OwnerFor(editor), msg.GetArray("snippets"));
                        break;
                    case "hotkey":
                        RunHotkey(msg.GetString("id"));
                        break;
                    case "log":
                        Log.Info("[ui] " + msg.GetString("message"));
                        break;
                    default:
                        Log.Warn("Unknown editor message: " + type);
                        break;
                }
            }
            catch (Exception ex)
            {
                Log.Error("Handling editor message '" + type + "' failed", ex);
                editor.Post(Error(msg, "요청을 처리하지 못했습니다: " + ex.Message));
            }
        }

        private Dictionary<string, object> BuildInit(EditorControl editor) => new Dictionary<string, object>
        {
            ["type"] = "init",
            ["host"] = _host.HostId,
            ["surface"] = editor.Surface,
            ["version"] = Version,
            ["settings"] = _settings.Settings,
            ["state"] = _settings.State,
            ["snippets"] = _snippets.Load(),
            ["dark"] = _lastDark,
            ["server"] = _capture.Status,
        };

        private void HandleInsert(EditorControl editor, Dictionary<string, object> msg)
        {
            var request = new InsertRequest
            {
                Latex = msg.GetString("latex") ?? "",
                Svg = msg.GetString("svg"),
                FontSize = msg.GetDouble("fontSize") ?? 18,
                Color = msg.GetString("color"),
                TargetKey = msg.GetString("targetKey"),
                NearKey = msg.GetString("nearKey"),
            };
            if (string.IsNullOrEmpty(request.Svg))
            {
                editor.Post(Error(msg, "렌더링된 수식이 없습니다."));
                return;
            }

            InsertResult result;
            _suppressSelection = true;
            try
            {
                result = _host.Insert(request);
            }
            catch (HostOperationException ex)
            {
                editor.Post(Error(msg, ex.Message));
                return;
            }
            catch (Exception ex)
            {
                Log.Error("Insert failed", ex);
                editor.Post(Error(msg, "수식을 삽입하지 못했습니다: " + ex.Message));
                return;
            }
            finally
            {
                _suppressSelection = false;
            }

            editor.Post(new Dictionary<string, object>
            {
                ["type"] = "inserted",
                ["requestId"] = msg.GetString("requestId"),
                ["replacedKey"] = request.TargetKey,
                ["equation"] = result.Equation?.ToMessage(),
                ["notice"] = result.Notice,
            });
            foreach (var other in Editors.Where(ed => ed != editor && IsVisible(ed))) SyncSelection(other);

            if (_settings.ReturnFocusToDocument) _host.ReturnFocusToDocument(result);
            else editor.FocusEditor();
            SyncSelection(editor); // the editor follows what is really selected now (Word: caret after the equation)
        }

        private static Dictionary<string, object> Error(Dictionary<string, object> request, string message) =>
            new Dictionary<string, object>
            {
                ["type"] = "error",
                ["requestId"] = request?.GetString("requestId"),
                ["message"] = message,
            };

        private void OnSettingsChanged(EditorControl source)
        {
            var msg = new Dictionary<string, object> { ["type"] = "settings", ["settings"] = _settings.Settings };
            foreach (var ed in Editors.Where(ed => ed != source)) ed.Post(msg);
            ApplyHotkeys();
            bool dark = ResolveDark();
            if (dark != _lastDark) ApplyThemeToAll(dark);
        }

        private void RefreshSharedState(EditorControl editor)
        {
            // Pick up changes the other Office application made while this editor was hidden.
            _settings.Reload();
            editor.Post(new Dictionary<string, object> { ["type"] = "settings", ["settings"] = _settings.Settings });
            editor.Post(new Dictionary<string, object> { ["type"] = "snippets", ["snippets"] = _snippets.Load() });
        }

        private void BroadcastSnippets(EditorControl except)
        {
            var msg = new Dictionary<string, object> { ["type"] = "snippets", ["snippets"] = _snippets.Load() };
            foreach (var ed in Editors.Where(ed => ed != except)) ed.Post(msg);
        }

        private void Broadcast(Dictionary<string, object> msg)
        {
            foreach (var ed in Editors) ed.Post(msg);
        }

        private bool ResolveDark()
        {
            switch (_settings.Theme)
            {
                case "dark": return true;
                case "light": return false;
                default: return OfficeTheme.IsDark();
            }
        }

        private void ApplyThemeToAll(bool dark)
        {
            _lastDark = dark;
            foreach (var ed in Editors)
            {
                ed.ApplyTheme(dark);
                ed.Post(new Dictionary<string, object> { ["type"] = "theme", ["dark"] = dark });
            }
        }

        private IWin32Window OwnerFor(EditorControl editor)
        {
            if (editor.Surface == "popup" && _form != null) return _form;
            var hwnd = ActiveWindowHandle;
            return hwnd == IntPtr.Zero ? null : new Win32Window(hwnd);
        }

        // ------------------------------------------------------------------ hotkeys & capture

        private void ApplyHotkeys()
        {
            var bindings = new List<KeyValuePair<HotkeyGesture, Action>>();
            void Bind(string id, Action action)
            {
                if (HotkeyGesture.TryParse(_settings.GetHotkey(id), out var g))
                    bindings.Add(new KeyValuePair<HotkeyGesture, Action>(g, action));
            }
            Bind("pane", ShowPane);
            Bind("popup", ShowPopup);
            Bind("capture", StartCapture);
            _hook.SetBindings(bindings);
            _hotkeys.Clear();
            foreach (var kv in bindings) _hotkeys[kv.Key] = kv.Value;
        }

        /// <summary>Hotkeys pressed while an editor (WebView2) has focus; see EditorControl.HotkeyFilter.</summary>
        private bool TryEditorHotkey(Keys keyData)
        {
            var gesture = new HotkeyGesture(keyData & Keys.KeyCode,
                (keyData & Keys.Control) != 0, (keyData & Keys.Alt) != 0, (keyData & Keys.Shift) != 0);
            if (!_hotkeys.TryGetValue(gesture, out var action)) return false;
            // Run after the accelerator handler returns (it may open a modal overlay).
            var ui = System.Threading.SynchronizationContext.Current;
            if (ui != null) ui.Post(_ => { try { action(); } catch (Exception ex) { Log.Error("Hotkey failed", ex); } }, null);
            else action();
            return true;
        }

        private void RunHotkey(string id)
        {
            switch (id)
            {
                case "pane": ShowPane(); break;
                case "popup": ShowPopup(); break;
                case "capture": StartCapture(); break;
            }
        }

        private async void RunCapture(EditorControl editor)
        {
            if (_captureBusy) return;
            _captureBusy = true;
            try
            {
                // Only open the capture overlay once the OCR engine is really ready: capturing while it was
                // still loading (up to a minute on first use) used to end in an insertion error.
                if (!_capture.IsReady)
                {
                    editor.Post(new Dictionary<string, object> { ["type"] = "notice", ["key"] = "toast.ocrWarming" });
                    if (!await _capture.EnsureReadyAsync())
                    {
                        editor.Post(Error(null, CaptureService.ResolveServerExe() == null
                            ? "AI 캡처 엔진(texture_capture.exe)을 찾을 수 없습니다. TeXture를 다시 설치해 주세요."
                            : "AI 캡처 엔진을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."));
                        return;
                    }
                }

                string image;
                using (var overlay = new CaptureForm())
                    image = overlay.ShowDialog(OwnerFor(editor)) == DialogResult.OK ? overlay.CapturedImagePath : null;
                if (image == null) return;

                editor.Post(new Dictionary<string, object> { ["type"] = "captureStarted" });
                string latex = await _capture.RecognizeAsync(image);
                editor.Post(new Dictionary<string, object> { ["type"] = "captureResult", ["latex"] = latex });
                editor.FocusEditor();
            }
            catch (Exception ex)
            {
                Log.Error("Capture failed", ex);
                editor.Post(Error(null, "수식 인식에 실패했습니다: " + ex.Message));
            }
            finally
            {
                _captureBusy = false;
            }
        }

        private static int ScaleForDpi(int px)
        {
            try
            {
                using (var g = Graphics.FromHwnd(IntPtr.Zero)) return (int)Math.Round(px * g.DpiX / 96f);
            }
            catch { return px; }
        }

        public void Dispose()
        {
            _host.SelectionChanged -= OnSelectionChanged;
            _host.WindowActivated -= OnWindowActivated;
            _host.WindowsChanged -= OnWindowsChanged;
            _hook.Dispose();
            _capture.Dispose();
            foreach (var ed in Editors.ToList()) ed.MessageReceived -= OnEditorMessage;
            if (_form != null && !_form.IsDisposed) _form.Dispose();
            _panes.Clear();
            Log.Info("TeXture stopped");
        }
    }
}
