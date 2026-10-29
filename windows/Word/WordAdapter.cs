using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using TeXture.Core.Hosting;
using TeXture.Core.Input;
using TeXture.Core.Model;
using TeXture.Core.Util;
using Word = Microsoft.Office.Interop.Word;

namespace WordLaTeX
{
    /// <summary>Word implementation of <see cref="IHostAdapter"/>.</summary>
    internal sealed class WordAdapter : IHostAdapter
    {
        private readonly Word.Application _app;
        // Word copies Title/AlternativeText (including the GUID) when pasting a picture.
        // Session keys identify the native Word objects, never their copied metadata.
        private readonly Dictionary<string, object> _targets = new Dictionary<string, object>();
        private readonly KeyboardHook _enterHook;

        public WordAdapter(Word.Application app)
        {
            _app = app;
            _app.WindowSelectionChange += OnWindowSelectionChange;
            _app.WindowActivate += OnWindowActivate;
            _app.DocumentChange += OnDocumentChange;
            _enterHook = new KeyboardHook { CanExecute = _ => CanHandleEquationEnter() };
            _enterHook.SetBindings(new[]
            {
                new KeyValuePair<HotkeyGesture, Action>(new HotkeyGesture(Keys.Enter, false, false, false),
                    () => InsertParagraphAfterSelectedEquation())
            }, allowUnmodifiedKeys: true);
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
            try
            {
                foreach (string key in new List<string>(_targets.Keys)) FindByKey(key);
                WindowsChanged?.Invoke(this, EventArgs.Empty);
            }
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
                    if (meta != null) return new SelectionState { Equation = Describe(KeyOf(shape), meta, shape.Width) };
                }
                else if (sel.Type == Word.WdSelectionType.wdSelectionShape && sel.ShapeRange.Count == 1)
                {
                    var shape = sel.ShapeRange[1];
                    var meta = EquationMetadata.FromWord(SafeString(() => shape.AlternativeText), SafeString(() => shape.Title));
                    if (meta != null) return new SelectionState { Equation = Describe(KeyOf(shape), meta, shape.Width) };
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

        private bool CanHandleEquationEnter()
        {
            try { return NativeFocus.IsDocumentFocused("_WwG") && EquationParagraphInsertionRange() != null; }
            catch (COMException) { return false; }
        }

        private Word.Range EquationParagraphInsertionRange()
        {
            if (_app.Documents.Count == 0) return null;
            var sel = _app.Selection;
            Word.Range after;
            if (GetSelection().Equation != null)
            {
                if (sel.Type == Word.WdSelectionType.wdSelectionInlineShape)
                    after = sel.InlineShapes[1].Range.Duplicate;
                else
                    after = sel.ShapeRange[1].Anchor.Paragraphs[1].Range.Duplicate;
            }
            else
            {
                // The common typing case: a caret immediately AFTER a picture, not a selected picture.
                // Use the selection's story (also works inside table cells and headers), not doc.Range.
                var caret = sel.Range;
                if (caret.Start != caret.End || caret.Start == 0) return null;
                var previous = caret.Duplicate;
                previous.SetRange(caret.Start - 1, caret.Start);
                if (previous.InlineShapes.Count != 1) return null;
                var picture = previous.InlineShapes[1];
                if (picture.Range.End != caret.Start ||
                    EquationMetadata.FromWord(SafeString(() => picture.AlternativeText), SafeString(() => picture.Title)) == null)
                    return null;
                after = caret.Duplicate;
            }
            after.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            return after;
        }

        /// <summary>
        /// Enter on or immediately after an equation inserts a paragraph outside the picture's range.
        /// Clear the insertion-point baseline BEFORE inserting, so the new paragraph cannot inherit it.
        /// Only unmodified Enter in the Word document is routed here (not dialogs or the editor).
        /// </summary>
        internal bool InsertParagraphAfterSelectedEquation()
        {
            var after = EquationParagraphInsertionRange();
            if (after == null) return false;
            after.Select();
            var sel = _app.Selection;
            sel.Font.Position = 0;
            // Assign only to the collapsed insertion range: never let Selection.TypeParagraph
            // operate on Word's picture selection or its SVG character formatting.
            after.Text = "\r";
            after.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            after.Select();
            sel = _app.Selection;
            sel.Font.Position = 0;
            return true;
        }

        private void PlaceCaretAfterInline(Word.InlineShape picture)
        {
            var after = picture.Range.Duplicate;
            after.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            after.Select();
            _app.Selection.Font.Position = 0;
        }

        /// <summary>
        /// Session-local identity for a native Word picture. Copies (including identical legacy
        /// equations) get separate keys; text movement and Save As do not change an object's key.
        /// Word can return different COM wrappers for the same picture. Compare native ranges/IDs,
        /// not managed reference identity; copied metadata is never an address.
        /// </summary>
        private string KeyOf(object shape)
        {
            foreach (var entry in _targets)
            {
                try
                {
                    if (entry.Value is Word.InlineShape inline && shape is Word.InlineShape candidate &&
                        inline.Range.IsEqual(candidate.Range)) return entry.Key;
                    if (entry.Value is Word.Shape floating && shape is Word.Shape floatCandidate &&
                        floating.ID == floatCandidate.ID && floating.Anchor.IsEqual(floatCandidate.Anchor)) return entry.Key;
                }
                catch (COMException) { /* A previously tracked picture was deleted. */ }
                catch (InvalidComObjectException) { }
            }
            string key = "word|object:" + Guid.NewGuid().ToString("N");
            _targets.Add(key, shape);
            return key;
        }

        private void Retarget(string key, object newShape)
        {
            // Replacement creates a new picture, but pending edits still address the same equation.
            _targets[key] = newShape;
        }

        private object FindByKey(string key)
        {
            if (string.IsNullOrEmpty(key) || !_targets.TryGetValue(key, out object target)) return null;
            try
            {
                if (target is Word.InlineShape inline)
                {
                    var range = inline.Range;
                    // A deleted picture must not resolve to a neighbour at its former position.
                    if (range.End - range.Start == 1 && range.InlineShapes.Count == 1 &&
                        EquationMetadata.FromWord(SafeString(() => inline.AlternativeText), SafeString(() => inline.Title)) != null)
                        return inline;
                }
                else if (target is Word.Shape floating)
                {
                    // Access Anchor to verify the native picture/document is still alive.
                    var anchor = floating.Anchor;
                    if (anchor != null && EquationMetadata.FromWord(SafeString(() => floating.AlternativeText), SafeString(() => floating.Title)) != null)
                        return floating;
                }
            }
            catch (COMException) { /* The picture was deleted or its document was closed. */ }
            catch (InvalidComObjectException) { /* Word disconnected the COM object. */ }
            _targets.Remove(key);
            return null;
        }

        // ------------------------------------------------------------------ insert / replace

        public InsertResult Insert(InsertRequest request)
        {
            if (_app.Documents.Count == 0) throw new HostOperationException("열려 있는 문서가 없습니다.");
            var sel = _app.Selection;

            object target = string.IsNullOrEmpty(request.TargetKey) ? null : FindByKey(request.TargetKey);
            if (!string.IsNullOrEmpty(request.TargetKey) && target == null)
                throw new HostOperationException("수정할 수식을 찾을 수 없습니다. 문서에서 수식을 다시 선택한 뒤 수정해 주세요.");

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
                else if (target is Word.Shape floating) info = ReplaceFloating(floating, svgPath, meta, request.TargetKey);
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

                return new InsertResult { Equation = info };
            }
            finally
            {
                if (undoStarted) try { undo.EndCustomRecord(); } catch (COMException) { }
                try { File.Delete(svgPath); } catch { }
            }
        }

        /// <summary>
        /// Insert before the old picture, then explicitly delete the old one after metadata succeeds.
        /// Word can insert an SVG beside a picture even when AddPicture receives its noncollapsed range.
        /// Do not rely on AddPicture replacing that range (the old implementation left duplicate pictures).
        /// </summary>
        private EquationInfo ReplaceInline(Word.InlineShape old, string svgPath, InsertRequest request, EquationMetadata meta)
        {
            Word.Range range = old.Range.Duplicate;
            range.Collapse(Word.WdCollapseDirection.wdCollapseStart);
            var pic = range.Document.InlineShapes.AddPicture(svgPath, false, true, range);
            try
            {
                FinishInline(pic, request, meta);
                old.Delete();
            }
            catch
            {
                try { pic.Delete(); } catch (COMException) { }
                throw;
            }
            Retarget(request.TargetKey, pic);
            PlaceCaretAfterInline(pic);
            return Describe(KeyOf(pic), meta, pic.Width);
        }

        private EquationInfo ReplaceFloating(Word.Shape old, string svgPath, EquationMetadata meta, string targetKey)
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
            Retarget(targetKey, pic);
            return Describe(KeyOf(pic), meta, pic.Width);
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
                return Describe(KeyOf(pic), meta, pic.Width);
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
            PlaceCaretAfterInline(pic);
            sel = _app.Selection;

            // Text typed after the equation must not inherit the raised baseline.
            sel.Font.ColorIndex = Word.WdColorIndex.wdAuto;
            sel.Font.Color = Word.WdColor.wdColorAutomatic;
            if (originalSize > 0 && originalSize < 1000) sel.Font.Size = originalSize;
            sel.Font.Position = 0;
            return Describe(KeyOf(pic), meta, pic.Width);
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

        public void Dispose()
        {
            _enterHook.Dispose();
            _targets.Clear();
            _app.WindowSelectionChange -= OnWindowSelectionChange;
            _app.WindowActivate -= OnWindowActivate;
            _app.DocumentChange -= OnDocumentChange;
        }
    }
}
