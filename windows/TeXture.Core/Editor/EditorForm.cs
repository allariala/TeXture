using System;
using System.Drawing;
using System.Windows.Forms;
using TeXture.Core.Util;

namespace TeXture.Core.Editor
{
    /// <summary>
    /// Floating editor window. Owned by the active Office window (not TopMost), so it floats above
    /// PowerPoint/Word only and minimises with them; closing just hides it so the draft is kept.
    /// </summary>
    public sealed class EditorForm : Form
    {
        private IntPtr _owner;

        public EditorForm(EditorControl editor, Icon icon, string title)
        {
            Editor = editor;
            Text = title;
            if (icon != null) Icon = icon;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            MinimumSize = new Size(360, 380);
            Size = new Size(520, 620);
            var area = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(area.Left + (area.Width - Width) / 2, area.Top + (area.Height - Height) / 2);
            editor.Dock = DockStyle.Fill;
            Controls.Add(editor);
        }

        public EditorControl Editor { get; }

        /// <summary>Raised when the window is hidden with its final bounds, so they can be remembered.</summary>
        public event Action<Rectangle> BoundsCommitted;

        public void ApplySavedBounds(Rectangle bounds)
        {
            if (bounds.Width < MinimumSize.Width || bounds.Height < MinimumSize.Height) return;
            foreach (var screen in Screen.AllScreens)
            {
                if (screen.WorkingArea.IntersectsWith(bounds)) { Bounds = bounds; return; }
            }
        }

        public void ShowOwnedBy(IntPtr ownerHwnd)
        {
            if (!Visible)
            {
                _owner = ownerHwnd;
                if (ownerHwnd != IntPtr.Zero) Show(new Win32Window(ownerHwnd)); else Show();
            }
            else
            {
                SetOwnerWindow(ownerHwnd);
            }
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate();
        }

        /// <summary>Follows the active document window so the popup never hides behind another Office window.</summary>
        public void SetOwnerWindow(IntPtr ownerHwnd)
        {
            if (ownerHwnd == IntPtr.Zero || ownerHwnd == _owner || !IsHandleCreated) return;
            _owner = ownerHwnd;
            Win32.SetOwner(Handle, ownerHwnd);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                BoundsCommitted?.Invoke(WindowState == FormWindowState.Normal ? Bounds : RestoreBounds);
                Hide();
            }
            base.OnFormClosing(e);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            // Esc on the window chrome hides it (inside the editor, Esc returns focus to the document).
            if (keyData == Keys.Escape) { Close(); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }
    }
}
