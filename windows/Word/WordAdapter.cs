using System;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using TeXture.Core.Hosting;
using TeXture.Core.Model;
using TeXture.Core.Util;
using Word = Microsoft.Office.Interop.Word;

namespace WordLaTeX
{
    /// <summary>Word implementation of <see cref="IHostAdapter"/>.</summary>
    internal sealed class WordAdapter : IHostAdapter
    {
        private readonly Word.Application _app;

        public WordAdapter(Word.Application app)
        {
            _app = app;
            _app.WindowSelectionChange += OnWindowSelectionChange;
            _app.WindowActivate += OnWindowActivate;
            _app.DocumentChange += OnDocumentChange;
        }

        public HostKind Kind => HostKind.Word;
        public string HostId => "word";

        public event EventHandler<SelectionChangedEventArgs> SelectionChanged;
        public event EventHandler WindowActivated;
        public event EventHandler WindowsChanged;

        public object ActiveWindow => SafeActiveWindow();

        public IntPtr GetWindowHandle(object window) => new IntPtr(((Word.Window)window).Hwnd);

        // ------------------------------------------------------------------ events

        private void OnWindowSelectionChange(Word.Selection sel)
        {
            try
            {
                var win = SafeActiveWindow();
                SelectionChanged?.Invoke(this, new SelectionChangedEventArgs(win == null ? IntPtr.Zero : GetWindowHandle(win)));
            }
            catch (Exception ex) { Log.Warn("SelectionChange handler", ex); }
        }

        private void OnWindowActivate(Word.Document doc, Word.Window wn)
        {
            try { WindowActivated?.Invoke(this, EventArgs.Empty); }
            catch (Exception ex) { Log.Warn("WindowActivate handler", ex); }
        }

        private void OnDocumentChange()
        {
            try { WindowsChanged?.Invoke(this, EventArgs.Empty); }
            catch (Exception ex) { Log.Warn("DocumentChange handler", ex); }
        }

        // ------------------------------------------------------------------ selection

        public SelectionState GetSelection()
        {
            Word.Selection sel;
            try
            {
                if (_app.Documents.Count == 0) return SelectionState.Empty;
                sel = _app.Selection;
            }
            catch (COMException) { return SelectionState.Empty; }

            try
            {
                // Only when exactly the picture is selected (v1.2 also matched any text selection that
                // merely contained an equation).
                if (sel.Type == Word.WdSelectionType.wdSelectionInlineShape && sel.InlineShapes.Count == 1)
                {
                    var shape = sel.InlineShapes[1];
                    var meta = EquationMetadata.FromWord(SafeString(() => shape.AlternativeText), SafeString(() => shape.Title));
                    if (meta != null) return new SelectionState { Equation = Describe(KeyOf(shape, meta), meta, shape.Width) };
                }
                else if (sel.Type == Word.WdSelectionType.wdSelectionShape && sel.ShapeRange.Count == 1)
                {
                    var shape = sel.ShapeRange[1];
                    var meta = EquationMetadata.FromWord(SafeString(() => shape.AlternativeText), SafeString(() => shape.Title));
                    if (meta != null) return new SelectionState { Equation = Describe(KeyOf(shape, meta), meta, shape.Width) };
                }
            }
            catch (COMException ex) { Log.Warn("Reading Word selection", ex); }
            return SelectionState.Empty;
        }

        private static EquationInfo Describe(string key, EquationMetadata meta, float width) => new EquationInfo
        {
            Key = key,
            Latex = meta.Latex,
            FontSize = meta.EffectiveFontSize(width),
            Color = meta.Color,
            IsLegacy = meta.IsLegacy,
        };

        /// <summary>
        /// "&lt;document&gt;|id:&lt;guid&gt;" for v2 equations. Legacy equations have no id, so the key records
        /// their position plus a hash of the LaTeX, and the lookup verifies the hash — text edited in the
        /// meantime can move the equation, but can never make us replace a different one.
        /// </summary>
        private static string KeyOf(Word.InlineShape shape, EquationMetadata meta)
        {
            string doc = shape.Range.Document.FullName;
            return !string.IsNullOrEmpty(meta.Id)
                ? doc + "|id:" + meta.Id
                : doc + "|at:" + shape.Range.Start + ":" + Hash(meta.Latex);
        }

        private static string KeyOf(Word.Shape shape, EquationMetadata meta)
        {
            string doc = shape.Anchor.Document.FullName;
            return !string.IsNullOrEmpty(meta.Id)
                ? doc + "|id:" + meta.Id
                : doc + "|float:" + shape.Name + ":" + Hash(meta.Latex);
        }

        private object FindByKey(string key)
        {
            int bar = key?.LastIndexOf('|') ?? -1;
            if (bar < 0) return null;
            string docName = key.Substring(0, bar);
            string locator = key.Substring(bar + 1);

            Word.Document doc = null;
            foreach (Word.Document d in _app.Documents)
                if (string.Equals(d.FullName, docName, StringComparison.OrdinalIgnoreCase)) { doc = d; break; }
            if (doc == null) return null;

            if (locator.StartsWith("id:", StringComparison.Ordinal))
            {
                string id = locator.Substring(3);
                foreach (Word.InlineShape s in doc.InlineShapes)
                    if (EquationMetadata.FromWord(SafeString(() => s.AlternativeText), SafeString(() => s.Title))?.Id == id) return s;
                foreach (Word.Shape s in doc.Shapes)
                    if (EquationMetadata.FromWord(SafeString(() => s.AlternativeText), SafeString(() => s.Title))?.Id == id) return s;
                return null;
            }

            string[] parts = locator.Split(':');
            if (parts.Length < 3) return null;
            string hash = parts[parts.Length - 1];
            if (parts[0] == "at" && int.TryParse(parts[1], out int start))
            {
                var candidate = MatchLegacy(doc.Range(start, start + 1).InlineShapes, hash);
                return candidate ?? MatchLegacy(doc.InlineShapes, hash); // moved: first equation with the same LaTeX
            }
            if (parts[0] == "float")
            {
                foreach (Word.Shape s in doc.Shapes)
                {
                    var m = EquationMetadata.FromWord(SafeString(() => s.AlternativeText), SafeString(() => s.Title));
                    if (m != null && Hash(m.Latex) == hash) return s;
                }
            }
            return null;
        }

        private static Word.InlineShape MatchLegacy(Word.InlineShapes shapes, string hash)
        {
            foreach (Word.InlineShape s in shapes)
            {
                var m = EquationMetadata.FromWord(SafeString(() => s.AlternativeText), SafeString(() => s.Title));
                if (m != null && Hash(m.Latex) == hash) return s;
            }
            return null;
        }

        // ------------------------------------------------------------------ insert / replace

        public InsertResult Insert(InsertRequest request)
        {
            if (_app.Documents.Count == 0) throw new HostOperationException("열려 있는 문서가 없습니다.");
            var sel = _app.Selection;

            object target = string.IsNullOrEmpty(request.TargetKey) ? null : FindByKey(request.TargetKey);
            string notice = !string.IsNullOrEmpty(request.TargetKey) && target == null
                ? "원래 수식을 찾을 수 없어 커서 위치에 새 수식으로 삽입했습니다." : null;

            string svgPath = Path.Combine(Path.GetTempPath(), "texture_" + Guid.NewGuid().ToString("N") + ".svg");
            File.WriteAllText(svgPath, request.Svg, new UTF8Encoding(false));

            var undo = _app.UndoRecord;
            bool undoStarted = false;
            try
            {
                try { undo.StartCustomRecord("TeXture 수식"); undoStarted = true; } catch (COMException) { }

                EquationMetadata previous = null;
                if (target is Word.InlineShape oldInline)
                    previous = EquationMetadata.FromWord(SafeString(() => oldInline.AlternativeText), SafeString(() => oldInline.Title));
                else if (target is Word.Shape oldFloat)
                    previous = EquationMetadata.FromWord(SafeString(() => oldFloat.AlternativeText), SafeString(() => oldFloat.Title));

                var meta = new EquationMetadata
                {
                    Latex = request.Latex,
                    FontSize = request.FontSize,
                    Color = request.Color,
                    Id = previous?.Id ?? EquationMetadata.NewId(),
                };

                EquationInfo info;
                if (target is Word.InlineShape inline) info = ReplaceInline(inline, svgPath, request, meta);
                else if (target is Word.Shape floating) info = ReplaceFloating(floating, svgPath, meta);
                else
                {
                    // A new equation must never overwrite what is selected: AddPicture at a selected inline
                    // picture replaces it. "Insert as new" goes right after the original equation.
                    if (!string.IsNullOrEmpty(request.NearKey) && FindByKey(request.NearKey) is Word.InlineShape near)
                    {
                        near.Range.Select();
                        sel = _app.Selection;
                    }
                    if (sel.Type == Word.WdSelectionType.wdSelectionInlineShape || sel.Type == Word.WdSelectionType.wdSelectionShape)
                    {
                        sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
                        sel.TypeText(" ");
                    }
                    info = InsertNew(sel, svgPath, request, meta);
                }

                return new InsertResult { Equation = info, Notice = notice };
            }
            finally
            {
                if (undoStarted) try { undo.EndCustomRecord(); } catch (COMException) { }
                try { File.Delete(svgPath); } catch { }
            }
        }

        /// <summary>
        /// Replaces the picture in place: AddPicture on the old picture's range swaps it in one step, so the
        /// surrounding tab stops and equation number (display equations) are untouched and nothing is lost
        /// if insertion fails.
        /// </summary>
        private EquationInfo ReplaceInline(Word.InlineShape old, string svgPath, InsertRequest request, EquationMetadata meta)
        {
            Word.Range range = old.Range;
            var pic = range.Document.InlineShapes.AddPicture(svgPath, false, true, range);
            FinishInline(pic, request, meta);
            return Describe(KeyOf(pic, meta), meta, pic.Width);
        }

        private EquationInfo ReplaceFloating(Word.Shape old, string svgPath, EquationMetadata meta)
        {
            var doc = old.Anchor.Document;
            var pic = doc.Shapes.AddPicture(svgPath, false, true, old.Left, old.Top, Type.Missing, Type.Missing, old.Anchor);
            try
            {
                pic.RelativeHorizontalPosition = old.RelativeHorizontalPosition;
                pic.RelativeVerticalPosition = old.RelativeVerticalPosition;
                pic.Left = old.Left;
                pic.Top = old.Top;
                pic.WrapFormat.Type = old.WrapFormat.Type;
            }
            catch (COMException ex) { Log.Warn("Copying floating layout", ex); }
            meta.BaseWidth = pic.Width;
            meta.BaseHeight = pic.Height;
            pic.AlternativeText = EquationMetadata.AltTextFor(meta.Latex);
            pic.Title = meta.ToWordTitle();
            old.Delete();
            return Describe(KeyOf(pic, meta), meta, pic.Width);
        }

        /// <summary>New equation at the cursor (v1.2 behaviour: display equations on empty lines, inline otherwise).</summary>
        private EquationInfo InsertNew(Word.Selection sel, string svgPath, InsertRequest request, EquationMetadata meta)
        {
            bool isInTable = (bool)sel.get_Information(Word.WdInformation.wdWithInTable);
            bool isCellEmpty = isInTable && sel.Cells[1].Range.Text.Length <= 2;
            bool isNewLine = !isInTable && sel.Start == sel.Paragraphs[1].Range.Start;
            Word.InlineShape pic;

            if (isNewLine)
            {
                _app.ScreenUpdating = false;
                try
                {
                    var doc = _app.ActiveDocument;
                    Word.ParagraphFormat format = sel.ParagraphFormat;
                    format.TabStops.ClearAll();
                    format.BaseLineAlignment = Word.WdBaselineAlignment.wdBaselineAlignCenter;
                    float width = doc.PageSetup.PageWidth - doc.PageSetup.LeftMargin - doc.PageSetup.RightMargin;
                    format.TabStops.Add(width / 2, Word.WdTabAlignment.wdAlignTabCenter);
                    format.TabStops.Add(width, Word.WdTabAlignment.wdAlignTabRight);

                    sel.TypeText("\t");
                    pic = sel.InlineShapes.AddPicture(svgPath, false, true);
                    WriteMetadata(pic, meta);

                    int numbering = Globals.Ribbons.MathRibbon.GetSelectedNumberingStyle();
                    if (numbering > 0)
                    {
                        sel.TypeText("\t(");
                        InsertNumberingField(sel, numbering);
                        sel.TypeText(")");
                        doc.Fields.Update();
                    }
                    sel.TypeParagraph();
                }
                finally
                {
                    _app.ScreenUpdating = true;
                    _app.ScreenRefresh();
                }
                return Describe(KeyOf(pic, meta), meta, pic.Width);
            }

            float originalSize = sel.Font.Size;
            if (isInTable && isCellEmpty)
            {
                // A cell holding only a picture has no text line, so the equation drops below the baseline.
                // A white '.' (11 pt) gives the cell a real text line. Invisible characters (zero-width space)
                // do not hold the baseline in Word. Known side effect: text typed right next to the dot
                // inherits its white colour.
                sel.ParagraphFormat.SpaceBefore = 0;
                sel.ParagraphFormat.SpaceAfter = 0;
                sel.Cells[1].VerticalAlignment = Word.WdCellVerticalAlignment.wdCellAlignVerticalCenter;
                sel.TypeText(".");
                sel.MoveLeft(Word.WdUnits.wdCharacter, 1, Word.WdMovementType.wdExtend);
                sel.Font.ColorIndex = Word.WdColorIndex.wdWhite;
                sel.Font.Size = 11;
                sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
                sel.Font.ColorIndex = Word.WdColorIndex.wdAuto;
                sel.Font.Size = originalSize;
            }

            sel.ParagraphFormat.BaseLineAlignment = Word.WdBaselineAlignment.wdBaselineAlignBaseline;
            pic = sel.InlineShapes.AddPicture(svgPath, false, true);
            FinishInline(pic, request, meta);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);

            // Text typed after the equation must not inherit the raised baseline.
            sel.Font.ColorIndex = Word.WdColorIndex.wdAuto;
            sel.Font.Color = Word.WdColor.wdColorAutomatic;
            if (originalSize > 0 && originalSize < 1000) sel.Font.Size = originalSize;
            sel.Font.Position = 0;
            return Describe(KeyOf(pic, meta), meta, pic.Width);
        }

        private static void FinishInline(Word.InlineShape pic, InsertRequest request, EquationMetadata meta)
        {
            WriteMetadata(pic, meta);
            // Align the equation's baseline with the text: MathJax reports it as vertical-align in ex.
            Match m = Regex.Match(request.Svg, @"vertical-align:\s*(-?[\d.]+)ex");
            if (m.Success)
            {
                float ex = float.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
                pic.Range.Characters.First.Font.Position = (int)Math.Round(ex * request.FontSize * 0.430554);
            }
        }

        private static void WriteMetadata(Word.InlineShape pic, EquationMetadata meta)
        {
            meta.BaseWidth = pic.Width;
            meta.BaseHeight = pic.Height;
            pic.AlternativeText = EquationMetadata.AltTextFor(meta.Latex);
            try { pic.Title = meta.ToWordTitle(); } catch (COMException ex) { Log.Warn("InlineShape.Title unavailable", ex); }
        }

        private static void InsertNumberingField(Word.Selection sel, int style)
        {
            if (style == 1)
            {
                sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ EqGlobal \* ARABIC", false);
            }
            else if (style == 2)
            {
                sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ Chapter \c", false);
                sel.TypeText(".");
                sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ EqCh \* ARABIC", false);
            }
            else if (style == 3)
            {
                sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ Chapter \c", false);
                sel.TypeText(".");
                sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ Section \c", false);
                sel.TypeText(".");
                sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ EqSec \* ARABIC", false);
            }
        }

        // ------------------------------------------------------------------ focus

        /// <summary>Word keeps the caret after the inserted equation so typing simply continues.</summary>
        public void ReturnFocusToDocument(InsertResult inserted)
        {
            var win = SafeActiveWindow();
            if (win == null) return;
            try
            {
                NativeFocus.FocusDocument(new IntPtr(win.Hwnd), "_WwG");
                _app.Activate();
                win.Activate();
                win.ActivePane.Activate();
            }
            catch (COMException ex)
            {
                Log.Warn("Returning focus to the document failed", ex);
            }
        }

        // ------------------------------------------------------------------ helpers

        private Word.Window SafeActiveWindow()
        {
            try { return _app.Documents.Count > 0 ? _app.ActiveWindow : null; }
            catch (COMException) { return null; }
        }

        private static string SafeString(Func<string> get)
        {
            try { return get(); } catch (COMException) { return null; }
        }

        private static string Hash(string text)
        {
            unchecked
            {
                uint h = 2166136261;
                foreach (char c in text ?? "") { h ^= c; h *= 16777619; }
                return h.ToString("x8");
            }
        }

        public void Dispose()
        {
            _app.WindowSelectionChange -= OnWindowSelectionChange;
            _app.WindowActivate -= OnWindowActivate;
            _app.DocumentChange -= OnDocumentChange;
        }
    }
}
