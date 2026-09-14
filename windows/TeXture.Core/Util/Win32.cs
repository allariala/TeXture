using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace TeXture.Core.Util
{
    /// <summary>User32/Kernel32 interop used by the add-ins. Kept in one place so nothing redeclares it.</summary>
    internal static class Win32
    {
        public const int WH_KEYBOARD = 2;
        public const int HC_ACTION = 0;
        public const int VK_SHIFT = 0x10, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_LWIN = 0x5B, VK_RWIN = 0x5C;
        private const int GWLP_HWNDPARENT = -8;

        public delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll")]
        public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern short GetKeyState(int nVirtKey);

        [DllImport("kernel32.dll")]
        public static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr SetFocus(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
        private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        public static bool IsKeyDown(int vk) => (GetKeyState(vk) & 0x8000) != 0;

        public static string ClassNameOf(IntPtr hWnd)
        {
            var sb = new StringBuilder(128);
            GetClassName(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        /// <summary>Depth-first search for the first visible descendant window with the given class.</summary>
        public static IntPtr FindDescendant(IntPtr parent, string className)
        {
            IntPtr found = IntPtr.Zero;
            if (parent == IntPtr.Zero) return found;
            EnumChildWindows(parent, (h, l) =>
            {
                if (IsWindowVisible(h) && string.Equals(ClassNameOf(h), className, StringComparison.Ordinal))
                {
                    found = h;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        /// <summary>Re-parents the owner of a top-level window (keeps a popup above the active Office window only).</summary>
        public static void SetOwner(IntPtr hWnd, IntPtr owner)
        {
            if (IntPtr.Size == 8) SetWindowLongPtr64(hWnd, GWLP_HWNDPARENT, owner);
            else SetWindowLong32(hWnd, GWLP_HWNDPARENT, owner.ToInt32());
        }
    }

    /// <summary>Moves Win32 keyboard focus into an Office document window (used by the host adapters).</summary>
    public static class NativeFocus
    {
        /// <summary>
        /// Activates <paramref name="frame"/> and gives keyboard focus to its first visible descendant of
        /// <paramref name="documentClass"/> (PowerPoint: "mdiClass", Word: "_WwG"), falling back to the frame.
        /// Must run on the Office UI thread: SetFocus only works for windows of the calling thread's queue,
        /// which is exactly why this is reliable in-process and not from a web add-in or external EXE.
        /// </summary>
        public static bool FocusDocument(IntPtr frame, string documentClass)
        {
            if (frame == IntPtr.Zero || !Win32.IsWindow(frame)) return false;
            Win32.SetForegroundWindow(frame);
            IntPtr target = Win32.FindDescendant(frame, documentClass);
            if (target == IntPtr.Zero) target = frame;
            return Win32.SetFocus(target) != IntPtr.Zero || target == frame;
        }
    }

    /// <summary>Wraps a raw HWND so it can be passed as a WinForms owner.</summary>
    internal sealed class Win32Window : IWin32Window
    {
        public Win32Window(IntPtr handle) { Handle = handle; }
        public IntPtr Handle { get; }
    }
}
