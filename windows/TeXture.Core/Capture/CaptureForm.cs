using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace TeXture.Core.Capture
{
    /// <summary>Full-screen dimmed overlay; drag a rectangle to capture it as PNG. Esc cancels.</summary>
    public sealed class CaptureForm : Form
    {
        private Point _start;
        private Rectangle _rect;
        private bool _dragging;

        public string CapturedImagePath { get; private set; }

        public CaptureForm()
        {
            RemoveAbandonedCaptures();
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.Black;
            Opacity = 0.3;
            Cursor = Cursors.Cross;
            DoubleBuffered = true;
            KeyPreview = true;
            Bounds = SystemInformation.VirtualScreen; // all monitors
        }

        // A forced Office termination can skip finally. Only remove our own old capture files,
        // never a live capture from another Office process or unrelated files in the temp folder.
        private static void RemoveAbandonedCaptures()
        {
            try
            {
                foreach (string file in Directory.GetFiles(Path.GetTempPath(), "texture_capture_*.png"))
                {
                    string id = Path.GetFileNameWithoutExtension(file).Substring("texture_capture_".Length);
                    if (Guid.TryParseExact(id, "N", out _) && File.GetLastWriteTimeUtc(file) < DateTime.UtcNow.AddDays(-1))
                        try { File.Delete(file); } catch { }
                }
                string legacy = Path.Combine(Path.GetTempPath(), "texture_captured_math.png");
                if (File.Exists(legacy) && File.GetLastWriteTimeUtc(legacy) < DateTime.UtcNow.AddDays(-1))
                    try { File.Delete(legacy); } catch { }
            }
            catch { } // Cleanup must never prevent capture.
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            _start = e.Location;
            _dragging = true;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (!_dragging) return;
            _rect = new Rectangle(Math.Min(_start.X, e.X), Math.Min(_start.Y, e.Y),
                                  Math.Abs(_start.X - e.X), Math.Abs(_start.Y - e.Y));
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            if (_dragging && _rect.Width > 0 && _rect.Height > 0)
                using (var pen = new Pen(Color.FromArgb(255, 80, 80), 2)) e.Graphics.DrawRectangle(pen, _rect);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            if (!_dragging) return;
            _dragging = false;
            if (_rect.Width > 10 && _rect.Height > 10) PerformCapture();
            else { DialogResult = DialogResult.Cancel; Close(); }
        }

        private void PerformCapture()
        {
            // Hide the overlay first so it is not part of the screenshot.
            Hide();
            Thread.Sleep(150);
            Application.DoEvents();
            try
            {
                using (var bmp = new Bitmap(_rect.Width, _rect.Height))
                {
                    using (var g = Graphics.FromImage(bmp))
                        g.CopyFromScreen(_rect.X + Bounds.X, _rect.Y + Bounds.Y, 0, 0, _rect.Size);
                    string path = Path.Combine(Path.GetTempPath(), "texture_capture_" + Guid.NewGuid().ToString("N") + ".png");
                    try { bmp.Save(path, ImageFormat.Png); }
                    catch { try { File.Delete(path); } catch { } throw; }
                    CapturedImagePath = path;
                    DialogResult = DialogResult.OK;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("캡처 중 오류가 발생했습니다: " + ex.Message, "TeXture", MessageBoxButtons.OK, MessageBoxIcon.Error);
                DialogResult = DialogResult.Abort;
            }
            finally
            {
                Close();
            }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.Escape)
            {
                DialogResult = DialogResult.Cancel;
                Close();
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }
    }
}
