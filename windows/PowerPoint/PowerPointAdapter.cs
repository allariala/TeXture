using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Office.Core;
using TeXture.Core.Hosting;
using TeXture.Core.Model;
using TeXture.Core.Util;
using PowerPoint = Microsoft.Office.Interop.PowerPoint;

namespace PowerLaTeX
{
    /// <summary>PowerPoint implementation of <see cref="IHostAdapter"/>.</summary>
    internal sealed class PowerPointAdapter : IHostAdapter
    {
        private readonly PowerPoint.Application _app;

        public PowerPointAdapter(PowerPoint.Application app)
        {
            _app = app;
            _app.WindowSelectionChange += OnWindowSelectionChange;
            _app.WindowActivate += OnWindowActivate;
            _app.PresentationCloseFinal += OnPresentationCloseFinal;
        }

        public HostKind Kind => HostKind.PowerPoint;
        public string HostId => "ppt";

        public event EventHandler<SelectionChangedEventArgs> SelectionChanged;
        public event EventHandler WindowActivated;
        public event EventHandler WindowsChanged;

        public object ActiveWindow => SafeActiveWindow();

        public IntPtr GetWindowHandle(object window) => new IntPtr(((PowerPoint.DocumentWindow)window).HWND);

        // ------------------------------------------------------------------ events

        private void OnWindowSelectionChange(PowerPoint.Selection sel)
        {
            try
            {
                var win = SafeActiveWindow();
                SelectionChanged?.Invoke(this, new SelectionChangedEventArgs(win == null ? IntPtr.Zero : GetWindowHandle(win)));
            }
            catch (Exception ex) { Log.Warn("SelectionChange handler", ex); }
        }

        private void OnWindowActivate(PowerPoint.Presentation pres, PowerPoint.DocumentWindow wn)
        {
            try { WindowActivated?.Invoke(this, EventArgs.Empty); }
            catch (Exception ex) { Log.Warn("WindowActivate handler", ex); }
        }

        private void OnPresentationCloseFinal(PowerPoint.Presentation pres)
        {
            try { WindowsChanged?.Invoke(this, EventArgs.Empty); }
            catch (Exception ex) { Log.Warn("PresentationCloseFinal handler", ex); }
        }

        // ------------------------------------------------------------------ selection

        public SelectionState GetSelection()
        {
            var win = SafeActiveWindow();
            if (win == null) return SelectionState.Empty;

            PowerPoint.Selection sel;
            try { sel = win.Selection; } catch (COMException) { return SelectionState.Empty; }
            if (sel == null || sel.Type != PowerPoint.PpSelectionType.ppSelectionShapes) return SelectionState.Empty;

            // Clicking into a group selects a child: v1.2 only looked at ShapeRange (the group) and lost
            // edit mode as soon as an equation was grouped with anything.
            PowerPoint.ShapeRange range = sel.HasChildShapeRange ? sel.ChildShapeRange : sel.ShapeRange;
            if (range.Count != 1) return SelectionState.Empty;
            PowerPoint.Shape shape = range[1];

            var meta = ReadMetadata(shape);
            if (meta != null) return new SelectionState { Equation = Describe(shape, meta) };

            if (shape.Type == MsoShapeType.msoGroup)
            {
                var found = new List<KeyValuePair<PowerPoint.Shape, EquationMetadata>>();
                foreach (PowerPoint.Shape child in shape.GroupItems)
                {
                    var m = ReadMetadata(child);
                    if (m != null) found.Add(new KeyValuePair<PowerPoint.Shape, EquationMetadata>(child, m));
                }
                if (found.Count == 1)
                    return new SelectionState { Equation = Describe(found[0].Key, found[0].Value), Note = "그룹 안의 수식" };
                if (found.Count > 1)
                    return new SelectionState { Note = $"그룹에 수식이 {found.Count}개 있습니다 — 편집할 수식을 한 번 더 클릭하세요." };
            }
            return SelectionState.Empty;
        }

        private static EquationMetadata ReadMetadata(PowerPoint.Shape shape)
        {
            try
            {
                var tags = shape.Tags;
                return EquationMetadata.FromTags(name => SafeTag(tags, name), SafeString(() => shape.AlternativeText), SafeString(() => shape.Name));
            }
            catch (COMException) { return null; }
        }

        private EquationInfo Describe(PowerPoint.Shape shape, EquationMetadata meta) => new EquationInfo
        {
            Key = KeyOf(shape),
            Latex = meta.Latex,
            FontSize = meta.EffectiveFontSize(shape.Width),
            Color = meta.Color,
            IsLegacy = meta.IsLegacy,
        };

        /// <summary>"&lt;presentation full name&gt;|&lt;slide id&gt;|&lt;shape id&gt;" — stable while the presentation is open.</summary>
        private static string KeyOf(PowerPoint.Shape shape)
        {
            var slide = SlideOf(shape);
            if (slide == null) return null; // e.g. on a slide master: editable, but updates insert a new equation
            var pres = (PowerPoint.Presentation)slide.Parent;
            return pres.FullName + "|" + slide.SlideID + "|" + shape.Id;
        }

        private PowerPoint.Shape FindByKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return null;
            int cut2 = key.LastIndexOf('|');
            int cut1 = cut2 > 0 ? key.LastIndexOf('|', cut2 - 1) : -1;
            if (cut1 < 0) return null;
            string presName = key.Substring(0, cut1);
            if (!int.TryParse(key.Substring(cut1 + 1, cut2 - cut1 - 1), out int slideId)) return null;
            if (!int.TryParse(key.Substring(cut2 + 1), out int shapeId)) return null;

            foreach (PowerPoint.Presentation pres in _app.Presentations)
            {
                if (!string.Equals(pres.FullName, presName, StringComparison.OrdinalIgnoreCase)) continue;
                PowerPoint.Slide slide;
                try { slide = pres.Slides.FindBySlideID(slideId); } catch (COMException) { return null; }
                foreach (PowerPoint.Shape s in slide.Shapes)
                {
                    if (s.Id == shapeId) return s;
                    if (s.Type == MsoShapeType.msoGroup)
                        foreach (PowerPoint.Shape child in s.GroupItems) // flattened leaves
                            if (child.Id == shapeId) return child;
                }
            }
            return null;
        }

        // ------------------------------------------------------------------ insert / replace

        public InsertResult Insert(InsertRequest request)
        {
            var win = SafeActiveWindow() ?? throw new HostOperationException("열려 있는 프레젠테이션 창이 없습니다.");

            PowerPoint.Shape target = null;
            string notice = null;
            if (!string.IsNullOrEmpty(request.TargetKey))
            {
                target = FindByKey(request.TargetKey);
                if (target == null) notice = "원래 수식을 찾을 수 없어 현재 슬라이드에 새 수식으로 삽입했습니다.";
            }

            // "Insert as new" while editing: the new equation goes next to the original, which is untouched.
            PowerPoint.Shape near = target == null && !string.IsNullOrEmpty(request.NearKey) ? FindByKey(request.NearKey) : null;

            PowerPoint.Slide slide = target != null ? SlideOf(target) : near != null ? SlideOf(near) ?? CurrentSlide(win) : CurrentSlide(win);
            if (slide == null)
                throw new HostOperationException("수식을 넣을 슬라이드가 없습니다. 기본 보기에서 슬라이드를 선택해 주세요.");
            EquationMetadata previous = target != null ? ReadMetadata(target) : null;

            string svgPath = Path.Combine(Path.GetTempPath(), "texture_" + Guid.NewGuid().ToString("N") + ".svg");
            File.WriteAllText(svgPath, request.Svg, new UTF8Encoding(false));
            try
            {
                // One undo step for the whole operation (insert, regroup, animation restore, delete).
                _app.StartNewUndoEntry();

                // The new picture is fully prepared before the old one is touched: if anything fails,
                // the original equation is still there (v1.2 deleted it first).
                PowerPoint.Shape pic = slide.Shapes.AddPicture(svgPath, MsoTriState.msoFalse, MsoTriState.msoTrue, 0, 0);
                var meta = new EquationMetadata
                {
                    Latex = request.Latex,
                    FontSize = request.FontSize,
                    Color = request.Color,
                    BaseWidth = pic.Width,
                    BaseHeight = pic.Height,
                    Id = previous?.Id ?? EquationMetadata.NewId(),
                };
                try
                {
                    WriteMetadata(pic, meta);
                    pic.LockAspectRatio = MsoTriState.msoTrue;
                    if (target == null && near != null)
                    {
                        PlaceBelow(pic, near, slide);
                    }
                    else if (target == null)
                    {
                        PlaceNew(pic, slide);
                    }
                    else
                    {
                        pic.Left = target.Left;
                        pic.Top = target.Top;
                        pic.Rotation = target.Rotation;
                        string oldName = SafeString(() => target.Name);
                        if (!string.IsNullOrEmpty(oldName))
                            pic.Name = oldName.StartsWith(EquationMetadata.LegacyPrefix, StringComparison.Ordinal)
                                ? EquationMetadata.AltTextFor(request.Latex) // Mac add-in reads the name
                                : oldName;                                    // keeps the Animation Pane label
                        ReplaceShape(slide, target, pic);
                    }
                }
                catch
                {
                    try { pic.Delete(); } catch { }
                    throw;
                }

                SelectShape(win, slide, pic);
                return new InsertResult { Equation = Describe(pic, meta), Notice = notice, NativeShape = pic };
            }
            finally
            {
                try { File.Delete(svgPath); } catch { }
            }
        }

        private static void WriteMetadata(PowerPoint.Shape shape, EquationMetadata meta)
        {
            foreach (var tag in meta.ToTags()) shape.Tags.Add(tag.Key, tag.Value);
            // Kept for v1.2 and the Mac add-in, which identify equations by this alt text.
            shape.AlternativeText = EquationMetadata.AltTextFor(meta.Latex);
        }

        private static void PlaceNew(PowerPoint.Shape pic, PowerPoint.Slide slide)
        {
            var setup = ((PowerPoint.Presentation)slide.Parent).PageSetup;
            float left = (setup.SlideWidth - pic.Width) / 2;
            float top = (setup.SlideHeight - pic.Height) / 2;

            // Cascade instead of stacking several new equations exactly on top of each other.
            for (int i = 0; i < 10; i++)
            {
                bool occupied = false;
                foreach (PowerPoint.Shape s in slide.Shapes)
                {
                    if (s.Id != pic.Id && Math.Abs(s.Left - left) < 1 && Math.Abs(s.Top - top) < 1) { occupied = true; break; }
                }
                if (!occupied) break;
                left += 12; top += 12;
            }
            pic.Left = left;
            pic.Top = top;
        }

        /// <summary>Just below the reference equation (above it if there is no room), left-aligned with it.</summary>
        private static void PlaceBelow(PowerPoint.Shape pic, PowerPoint.Shape reference, PowerPoint.Slide slide)
        {
            var setup = ((PowerPoint.Presentation)slide.Parent).PageSetup;
            const float gap = 12;
            float top = reference.Top + reference.Height + gap;
            if (top + pic.Height > setup.SlideHeight) top = Math.Max(0, reference.Top - pic.Height - gap);
            pic.Left = Math.Max(0, Math.Min(reference.Left, setup.SlideWidth - pic.Width));
            pic.Top = top;
        }

        /// <summary>
        /// Puts <paramref name="pic"/> in place of <paramref name="old"/>: same z-order slot, same group
        /// (at any nesting depth) with the group's name/tags/alt text, and the animations of the animated
        /// top-level owner (the shape itself, or its outermost group).
        /// </summary>
        private static void ReplaceShape(PowerPoint.Slide slide, PowerPoint.Shape old, PowerPoint.Shape pic)
        {
            bool grouped = old.Child == MsoTriState.msoTrue;
            PowerPoint.Shape owner = grouped ? old.ParentGroup : old;
            var animations = AnimationStash.Capture(slide, owner);

            PowerPoint.Shape newOwner = grouped ? ReplaceInGroup(slide, old, pic) : ReplaceTopLevel(old, pic);

            animations?.Restore(slide, newOwner);
        }

        private static PowerPoint.Shape ReplaceTopLevel(PowerPoint.Shape old, PowerPoint.Shape pic)
        {
            // pic starts on top; step it down until it sits directly below old, then remove old.
            for (int guard = 0; guard < 5000 && pic.ZOrderPosition > old.ZOrderPosition; guard++)
            {
                int before = pic.ZOrderPosition;
                pic.ZOrder(MsoZOrderCmd.msoSendBackward);
                if (pic.ZOrderPosition == before) break;
            }
            old.Delete();
            return pic;
        }

        /// <summary>
        /// PowerPoint cannot add a shape to an existing group, so the (outermost) group is ungrouped,
        /// the equation replaced one nesting level down, and the same members regrouped.
        /// Shape references to subgroups do not survive regrouping, so members are tracked by Id and
        /// regrouped by their current collection index.
        /// </summary>
        private static PowerPoint.Shape ReplaceInGroup(PowerPoint.Slide slide, PowerPoint.Shape old, PowerPoint.Shape pic)
        {
            PowerPoint.Shape group = old.ParentGroup;
            var groupState = GroupState.Capture(group);
            PowerPoint.ShapeRange members = group.Ungroup();

            var ids = new List<int>();
            foreach (PowerPoint.Shape m in members) ids.Add(m.Id);

            PowerPoint.Shape replacement;
            int containerId;
            if (old.Child == MsoTriState.msoTrue)
            {
                containerId = old.ParentGroup.Id;      // old sits in a nested subgroup
                replacement = ReplaceInGroup(slide, old, pic);
            }
            else
            {
                containerId = old.Id;
                replacement = ReplaceTopLevel(old, pic);
            }
            int at = ids.IndexOf(containerId);
            if (at >= 0) ids[at] = replacement.Id; else ids.Add(replacement.Id);

            var indices = new List<object>();
            for (int i = 1; i <= slide.Shapes.Count; i++)
                if (ids.Contains(slide.Shapes[i].Id)) indices.Add(i);
            if (indices.Count < 2) return replacement;

            PowerPoint.Shape regrouped = slide.Shapes.Range(indices.ToArray()).Group();
            groupState.ApplyTo(regrouped);
            return regrouped;
        }

        private void SelectShape(PowerPoint.DocumentWindow win, PowerPoint.Slide slide, PowerPoint.Shape shape)
        {
            try
            {
                var current = CurrentSlide(win);
                if (current == null || current.SlideID != slide.SlideID) win.View.GotoSlide(slide.SlideIndex);
                shape.Select(MsoTriState.msoTrue);
            }
            catch (COMException ex) { Log.Warn("Selecting the inserted equation failed", ex); }
        }

        // ------------------------------------------------------------------ focus

        public void ReturnFocusToDocument(InsertResult inserted)
        {
            var win = SafeActiveWindow();
            if (win == null) return;
            try
            {
                NativeFocus.FocusDocument(new IntPtr(win.HWND), "mdiClass");
                win.Activate();
                if (win.ViewType == PowerPoint.PpViewType.ppViewNormal && win.Panes.Count >= 2)
                    win.Panes[2].Activate(); // 1 = thumbnails, 2 = slide, 3 = notes
                if (inserted?.NativeShape is PowerPoint.Shape shape) shape.Select(MsoTriState.msoTrue);
            }
            catch (COMException ex)
            {
                Log.Warn("Returning focus to the slide failed", ex);
            }
        }

        // ------------------------------------------------------------------ helpers

        private PowerPoint.DocumentWindow SafeActiveWindow()
        {
            try { return _app.Windows.Count > 0 ? _app.ActiveWindow : null; }
            catch (COMException) { return null; }
        }

        private static PowerPoint.Slide CurrentSlide(PowerPoint.DocumentWindow win)
        {
            try { return (PowerPoint.Slide)win.View.Slide; }
            catch (COMException) { }
            catch (InvalidCastException) { }
            try
            {
                var range = win.Selection.SlideRange;
                return range.Count > 0 ? range[1] : null;
            }
            catch (COMException) { return null; }
        }

        private static PowerPoint.Slide SlideOf(PowerPoint.Shape shape)
        {
            object parent = shape.Parent;
            for (int i = 0; i < 6 && parent != null; i++)
            {
                if (parent is PowerPoint.Slide slide) return slide;
                if (parent is PowerPoint.Shape s) parent = s.Parent;
                else return null;
            }
            return null;
        }

        private static string SafeTag(PowerPoint.Tags tags, string name)
        {
            try { return tags[name]; } catch (COMException) { return null; }
        }

        private static string SafeString(Func<string> get)
        {
            try { return get(); } catch (COMException) { return null; }
        }

        public void Dispose()
        {
            _app.WindowSelectionChange -= OnWindowSelectionChange;
            _app.WindowActivate -= OnWindowActivate;
            _app.PresentationCloseFinal -= OnPresentationCloseFinal;
        }

        // ------------------------------------------------------------------ nested types

        /// <summary>Group properties that must survive an ungroup/regroup cycle.</summary>
        private sealed class GroupState
        {
            private string _name, _altText, _title;
            private readonly List<KeyValuePair<string, string>> _tags = new List<KeyValuePair<string, string>>();

            public static GroupState Capture(PowerPoint.Shape group)
            {
                var state = new GroupState
                {
                    _name = SafeString(() => group.Name),
                    _altText = SafeString(() => group.AlternativeText),
                    _title = SafeString(() => group.Title),
                };
                var tags = group.Tags;
                for (int i = 1; i <= tags.Count; i++) state._tags.Add(new KeyValuePair<string, string>(tags.Name(i), tags.Value(i)));
                return state;
            }

            public void ApplyTo(PowerPoint.Shape group)
            {
                try
                {
                    if (!string.IsNullOrEmpty(_name)) group.Name = _name;
                    if (!string.IsNullOrEmpty(_altText)) group.AlternativeText = _altText;
                    if (!string.IsNullOrEmpty(_title)) group.Title = _title;
                    foreach (var t in _tags) group.Tags.Add(t.Key, t.Value);
                }
                catch (COMException ex) { Log.Warn("Restoring group properties failed", ex); }
            }
        }

        /// <summary>
        /// Carries animations across the replace. Ungrouping deletes a group's effects and deleting a
        /// shape deletes its own, so they are picked up first (Animation Painter), applied to the new
        /// owner afterwards and moved back to their original positions in the main sequence.
        /// </summary>
        private sealed class AnimationStash
        {
            private List<int> _indices;

            public static AnimationStash Capture(PowerPoint.Slide slide, PowerPoint.Shape owner)
            {
                try
                {
                    var seq = slide.TimeLine.MainSequence;
                    var indices = new List<int>();
                    for (int i = 1; i <= seq.Count; i++)
                    {
                        try { if (seq[i].Shape.Id == owner.Id) indices.Add(i); } catch (COMException) { }
                    }
                    if (indices.Count == 0) return null;
                    owner.PickupAnimation();
                    return new AnimationStash { _indices = indices };
                }
                catch (COMException ex)
                {
                    Log.Warn("Could not read animations", ex);
                    return null;
                }
            }

            public void Restore(PowerPoint.Slide slide, PowerPoint.Shape target)
            {
                try
                {
                    target.ApplyAnimation();
                    var seq = slide.TimeLine.MainSequence;
                    var applied = new List<PowerPoint.Effect>();
                    for (int i = 1; i <= seq.Count; i++)
                    {
                        try { if (seq[i].Shape.Id == target.Id) applied.Add(seq[i]); } catch (COMException) { }
                    }
                    // The originals are gone by now, so ascending MoveTo reproduces the original order exactly.
                    for (int k = 0; k < applied.Count && k < _indices.Count; k++) applied[k].MoveTo(_indices[k]);
                }
                catch (COMException ex)
                {
                    Log.Warn("Could not restore animations", ex);
                }
            }
        }
    }
}
