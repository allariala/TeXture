using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;

namespace TeXture.Core.Ribbon
{
    /// <summary>
    /// Draws ribbon gallery icons at runtime with GDI+ (Cambria Math ships with Windows/Office), so the
    /// add-in carries no image assets and icons stay crisp at any DPI. Symbols are drawn from their
    /// Unicode glyph; structures (fraction, root, matrix, ...) from a small set of template drawings
    /// with dashed placeholder boxes, mimicking MathType's template palette.
    /// </summary>
    public static class GlyphRenderer
    {
        private const float U = 32f; // drawing units; scaled to the requested pixel size

        public static Bitmap Render(CatalogItem item, int px, Color ink)
        {
            var bmp = new Bitmap(px, px, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.ScaleTransform(px / U, px / U);
                var c = new Canvas(g, ink);
                if (item.Template == null || !DrawTemplate(c, item.Template))
                    c.TextFit(item.Glyph ?? item.Name ?? "?", new RectangleF(1, 1, 30, 30), 22f);
            }
            return bmp;
        }

        private static bool DrawTemplate(Canvas c, string tpl)
        {
            switch (tpl)
            {
                case "frac":
                    c.Box(11, 3, 10, 10); c.Line(7, 16, 25, 16); c.Box(11, 19, 10, 10); return true;
                case "slash":
                    c.Box(3, 6, 10, 10); c.Line(21, 5, 11, 27); c.Box(19, 16, 10, 10); return true;
                case "sqrt":
                    c.Radical(3, 18, 12); c.Box(14, 9, 13, 14); return true;
                case "nroot":
                    c.Box(2, 5, 7, 7); c.Radical(4, 18, 13); c.Box(15, 9, 13, 14); return true;
                case "sup":
                    c.Box(5, 12, 13, 15); c.Box(20, 4, 8, 8); return true;
                case "sub":
                    c.Box(5, 5, 13, 15); c.Box(20, 20, 8, 8); return true;
                case "subsup":
                    c.Box(4, 9, 13, 14); c.Box(19, 2, 8, 8); c.Box(19, 22, 8, 8); return true;
                case "paren": Fence(c, "(", ")"); return true;
                case "bracket": Fence(c, "[", "]"); return true;
                case "brace": Fence(c, "{", "}"); return true;
                case "abs": Fence(c, "|", "|"); return true;
                case "norm": Fence(c, "‖", "‖"); return true;
                case "angle": Fence(c, "⟨", "⟩"); return true;
                case "sum": BigOp(c, "∑"); return true;
                case "prod": BigOp(c, "∏"); return true;
                case "coprod": BigOp(c, "∐"); return true;
                case "bigcup": BigOp(c, "⋃"); return true;
                case "bigcap": BigOp(c, "⋂"); return true;
                case "int": Integral(c, "∫", true); return true;
                case "intnl": Integral(c, "∫", false); return true;
                case "iint": Integral(c, "∬", false); return true;
                case "iiint": Integral(c, "∭", false); return true;
                case "oint": Integral(c, "∮", false); return true;
                case "lim":
                    c.Text("lim", new RectangleF(0, 3, 32, 16), 13f); c.Box(9, 21, 14, 8); return true;
                case "matrix": Matrix(c, null, null); return true;
                case "pmatrix": Matrix(c, "(", ")"); return true;
                case "bmatrix": Matrix(c, "[", "]"); return true;
                case "vmatrix": Matrix(c, "|", "|"); return true;
                case "cases":
                    c.Text("{", new RectangleF(0, 1, 12, 30), 24f); c.Box(11, 5, 17, 8); c.Box(11, 19, 17, 8); return true;
                case "binom":
                    c.Text("(", new RectangleF(0, 1, 9, 30), 24f); c.Box(10, 3, 12, 11); c.Box(10, 18, 12, 11);
                    c.Text(")", new RectangleF(23, 1, 9, 30), 24f); return true;
                case "hat": Accent(c, "hat"); return true;
                case "bar": Accent(c, "bar"); return true;
                case "vec": Accent(c, "vec"); return true;
                case "dot": Accent(c, "dot"); return true;
                case "ddot": Accent(c, "ddot"); return true;
                case "tilde": Accent(c, "tilde"); return true;
                case "overline":
                    c.Line(4, 7, 28, 7); c.Box(5, 11, 22, 16); return true;
                case "underline":
                    c.Box(5, 5, 22, 16); c.Line(4, 25, 28, 25); return true;
                case "overarrow":
                    c.Arrow(4, 7, 28, 7); c.Box(5, 11, 22, 16); return true;
                case "overbrace":
                    c.HBrace(4, 10, 24, true); c.Box(6, 14, 20, 14); return true;
                case "underbrace":
                    c.Box(6, 3, 20, 14); c.HBrace(4, 21, 24, false); return true;
                case "overset":
                    c.Box(10, 2, 12, 8); c.Box(5, 13, 22, 16); return true;
                case "underset":
                    c.Box(5, 3, 22, 16); c.Box(10, 22, 12, 8); return true;
                case "xarrow":
                    c.Box(9, 4, 14, 8); c.Arrow(3, 17, 29, 17); c.Box(9, 21, 14, 8); return true;
                case "cancel":
                    c.Box(6, 7, 20, 18); c.Line(4, 27, 28, 5); return true;
                case "box":
                    c.Frame(3, 5, 26, 22); c.Box(8, 10, 16, 12); return true;
                default:
                    return false;
            }
        }

        private static void Fence(Canvas c, string left, string right)
        {
            c.Text(left, new RectangleF(0, 1, 10, 30), 24f);
            c.Box(10, 8, 12, 16);
            c.Text(right, new RectangleF(22, 1, 10, 30), 24f);
        }

        private static void BigOp(Canvas c, string op)
        {
            c.Box(11, 1, 10, 6);
            c.Text(op, new RectangleF(4, 6, 24, 20), 18f);
            c.Box(11, 25, 10, 6);
        }

        private static void Integral(Canvas c, string op, bool limits)
        {
            c.Text(op, new RectangleF(0, 2, 16, 28), 22f);
            if (limits) { c.Box(15, 2, 7, 6); c.Box(12, 24, 7, 6); }
            c.Box(19, 11, 11, 11);
        }

        private static void Matrix(Canvas c, string left, string right)
        {
            if (left != null) c.Text(left, new RectangleF(0, 1, 8, 30), 23f);
            c.Box(8, 6, 7, 8); c.Box(17, 6, 7, 8); c.Box(8, 18, 7, 8); c.Box(17, 18, 7, 8);
            if (right != null) c.Text(right, new RectangleF(24, 1, 8, 30), 23f);
        }

        private static void Accent(Canvas c, string kind)
        {
            c.Box(8, 12, 16, 16);
            switch (kind)
            {
                case "hat": c.Poly(11, 9, 16, 4, 21, 9); break;
                case "bar": c.Line(9, 7, 23, 7); break;
                case "vec": c.Arrow(9, 7, 23, 7); break;
                case "dot": c.Dot(16, 6); break;
                case "ddot": c.Dot(13, 6); c.Dot(19, 6); break;
                case "tilde": c.Tilde(10, 7, 12); break;
            }
        }

        private sealed class Canvas
        {
            private readonly Graphics _g;
            private readonly Color _ink;

            public Canvas(Graphics g, Color ink) { _g = g; _ink = ink; }

            private Pen Pen(float width = 1.6f) =>
                new Pen(_ink, width) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };

            public void Box(float x, float y, float w, float h)
            {
                using (var p = new Pen(Color.FromArgb(170, _ink), 1.2f) { DashPattern = new[] { 2f, 1.5f } })
                    _g.DrawRectangle(p, x, y, w, h);
            }

            public void Frame(float x, float y, float w, float h)
            {
                using (var p = Pen(1.4f)) _g.DrawRectangle(p, x, y, w, h);
            }

            public void Line(float x1, float y1, float x2, float y2)
            {
                using (var p = Pen()) _g.DrawLine(p, x1, y1, x2, y2);
            }

            public void Arrow(float x1, float y1, float x2, float y2)
            {
                using (var p = Pen()) { _g.DrawLine(p, x1, y1, x2, y2); _g.DrawLines(p, new[] { new PointF(x2 - 4, y2 - 3), new PointF(x2, y2), new PointF(x2 - 4, y2 + 3) }); }
            }

            public void Poly(params float[] xy)
            {
                var pts = new PointF[xy.Length / 2];
                for (int i = 0; i < pts.Length; i++) pts[i] = new PointF(xy[2 * i], xy[2 * i + 1]);
                using (var p = Pen()) _g.DrawLines(p, pts);
            }

            public void Dot(float x, float y)
            {
                using (var b = new SolidBrush(_ink)) _g.FillEllipse(b, x - 1.6f, y - 1.6f, 3.2f, 3.2f);
            }

            public void Tilde(float x, float y, float w)
            {
                using (var p = Pen())
                    _g.DrawBezier(p, x, y + 1, x + w * 0.3f, y - 3, x + w * 0.7f, y + 5, x + w, y - 1);
            }

            public void Radical(float x, float yBase, float h)
            {
                using (var p = Pen())
                    _g.DrawLines(p, new[]
                    {
                        new PointF(x, yBase - 2), new PointF(x + 3, yBase), new PointF(x + 7, yBase + h - 8),
                        new PointF(x + 10, yBase - h + 2), new PointF(28, yBase - h + 2),
                    });
            }

            public void HBrace(float x, float y, float w, bool over)
            {
                float d = over ? 3 : -3;
                using (var p = Pen(1.3f))
                {
                    _g.DrawBezier(p, x, y + d, x, y, x + w / 2 - 2, y + d, x + w / 2, y);
                    _g.DrawBezier(p, x + w / 2, y, x + w / 2 + 2, y + d, x + w, y, x + w, y + d);
                }
            }

            public void Text(string text, RectangleF rect, float size)
            {
                using (var font = MathFont(size))
                using (var brush = new SolidBrush(_ink))
                using (var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                    _g.DrawString(text, font, brush, rect, fmt);
            }

            /// <summary>Largest font size (≤ max) at which the text fits the rectangle.</summary>
            public void TextFit(string text, RectangleF rect, float max)
            {
                float size = max;
                while (size > 6)
                {
                    using (var font = MathFont(size))
                    {
                        var s = _g.MeasureString(text, font);
                        if (s.Width <= rect.Width + 4 && s.Height <= rect.Height + 8) break;
                    }
                    size -= 1f;
                }
                Text(text, rect, size);
            }

            private static Font MathFont(float size)
            {
                try { return new Font("Cambria Math", size, FontStyle.Regular, GraphicsUnit.Pixel); }
                catch (ArgumentException) { return new Font("Segoe UI Symbol", size, FontStyle.Regular, GraphicsUnit.Pixel); }
            }
        }
    }
}
