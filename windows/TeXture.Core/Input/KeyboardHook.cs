using System;
using System.Collections.Generic;
using System.Threading;
using System.Windows.Forms;
using TeXture.Core.Util;

namespace TeXture.Core.Input
{
    /// <summary>
    /// Keyboard shortcuts that only fire while Office itself has keyboard focus.
    ///
    /// v1.2 used RegisterHotKey, which is system-wide: Alt+Shift+E/Q/S were taken away from every other
    /// application (Edge, Teams, ...) whenever the foreground check guessed wrong, and PowerPoint and Word
    /// fought over the same combination. A WH_KEYBOARD hook scoped to the Office UI thread sees only
    /// keystrokes addressed to that thread's windows, so nothing outside Office is affected.
    /// Keys typed inside the editor (WebView2 runs in its own process) are handled by the web UI instead.
    /// </summary>
    public sealed class KeyboardHook : IDisposable
    {
        private readonly Win32.HookProc _proc;   // kept alive: the native hook holds only a function pointer
        private readonly SynchronizationContext _ui;
        private readonly Dictionary<HotkeyGesture, Action> _bindings = new Dictionary<HotkeyGesture, Action>();
        private IntPtr _hook;
        private int _swallowKeyUp;

        public KeyboardHook()
        {
            _ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
            _proc = HookCallback;
            _hook = Win32.SetWindowsHookEx(Win32.WH_KEYBOARD, _proc, IntPtr.Zero, Win32.GetCurrentThreadId());
            if (_hook == IntPtr.Zero)
                Log.Error("SetWindowsHookEx failed: " + System.Runtime.InteropServices.Marshal.GetLastWin32Error());
        }

        public void SetBindings(IEnumerable<KeyValuePair<HotkeyGesture, Action>> bindings)
        {
            _bindings.Clear();
            foreach (var kv in bindings)
                if (kv.Key.IsValid) _bindings[kv.Key] = kv.Value;
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode == Win32.HC_ACTION)
            {
                int vk = wParam.ToInt32();
                uint flags = unchecked((uint)lParam.ToInt64());
                bool keyUp = (flags & 0x80000000) != 0;
                bool repeat = (flags & 0x40000000) != 0;

                if (keyUp)
                {
                    if (vk == _swallowKeyUp) { _swallowKeyUp = 0; return (IntPtr)1; }
                }
                else if (!IsModifier(vk))
                {
                    var gesture = new HotkeyGesture((Keys)vk,
                        Win32.IsKeyDown(Win32.VK_CONTROL), Win32.IsKeyDown(Win32.VK_MENU), Win32.IsKeyDown(Win32.VK_SHIFT));
                    if (_bindings.TryGetValue(gesture, out var action))
                    {
                        _swallowKeyUp = vk;
                        // Run after the hook returns: hooks must be fast and must not pump messages.
                        if (!repeat) _ui.Post(_ => Run(action), null);
                        return (IntPtr)1;
                    }
                }
            }
            return Win32.CallNextHookEx(_hook, nCode, wParam, lParam);
        }

        private static bool IsModifier(int vk) =>
            vk == Win32.VK_SHIFT || vk == Win32.VK_CONTROL || vk == Win32.VK_MENU ||
            vk == Win32.VK_LWIN || vk == Win32.VK_RWIN ||
            (vk >= 0xA0 && vk <= 0xA5); // L/R shift, ctrl, alt

        private static void Run(Action action)
        {
            try { action(); }
            catch (Exception ex) { Log.Error("Hotkey action failed", ex); }
        }

        public void Dispose()
        {
            if (_hook != IntPtr.Zero)
            {
                Win32.UnhookWindowsHookEx(_hook);
                _hook = IntPtr.Zero;
            }
        }
    }
}
