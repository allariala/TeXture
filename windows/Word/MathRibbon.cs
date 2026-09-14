using System.Windows.Forms;
using Microsoft.Office.Tools.Ribbon;
using TeXture.Core.Ribbon;
using Word = Microsoft.Office.Interop.Word;

namespace WordLaTeX
{
    public partial class MathRibbon
    {
        // Set by "Reset": the next New Chapter restarts numbering at 1.
        private bool _isResetRequested;

        private void MathRibbon_Load(object sender, RibbonUIEventArgs e)
        {
            btnShowPane.SuperTip = "오른쪽 사이드바에 수식 편집기를 엽니다.\n\n단축키: Alt + Shift + E";
            btnShowForm.SuperTip = "떠 있는 창으로 수식 편집기를 엽니다.\n\n단축키: Alt + Shift + Q";
            btnCapture.SuperTip = "화면의 수식을 드래그해 LaTeX로 변환합니다 (오프라인 AI).\n\n단축키: Alt + Shift + S";
            btnSettings.SuperTip = "스니펫, 단축키, 테마 등 설정을 엽니다.";

            RibbonGalleryBinder.Bind(galStructures, Factory, "structures", 6);
            RibbonGalleryBinder.Bind(galBrackets, Factory, "brackets", 6);
            RibbonGalleryBinder.Bind(galCalculus, Factory, "calculus", 6);
            RibbonGalleryBinder.Bind(galMatrices, Factory, "matrices", 5);
            RibbonGalleryBinder.Bind(galAccents, Factory, "accents", 6);
            RibbonGalleryBinder.Bind(galGreek, Factory, "greek", 10);
            RibbonGalleryBinder.Bind(galOperators, Factory, "operators", 8);
            RibbonGalleryBinder.Bind(galRelations, Factory, "relations", 8);
            RibbonGalleryBinder.Bind(galArrows, Factory, "arrows", 8);
            RibbonGalleryBinder.Bind(galSets, Factory, "sets", 8);
            RibbonGalleryBinder.Bind(galMisc, Factory, "misc", 8);
        }

        private void btnShowPane_Click(object sender, RibbonControlEventArgs e) => Globals.ThisAddIn.Runtime?.ShowPane();

        private void btnShowForm_Click(object sender, RibbonControlEventArgs e) => Globals.ThisAddIn.Runtime?.ShowPopup();

        private void btnCapture_Click(object sender, RibbonControlEventArgs e) => Globals.ThisAddIn.Runtime?.StartCapture();

        private void btnSettings_Click(object sender, RibbonControlEventArgs e) => Globals.ThisAddIn.Runtime?.OpenSettings();

        private void Gallery_Click(object sender, RibbonControlEventArgs e) =>
            Globals.ThisAddIn.Runtime?.InsertFromCatalog(RibbonGalleryBinder.SelectedItem((RibbonGallery)sender));

        // ------------------------------------------------------------------ equation numbering

        private void tglStyle1_Click(object sender, RibbonControlEventArgs e)
        {
            if (tglStyle1.Checked) { tglStyle2.Checked = false; tglStyle3.Checked = false; }
        }

        private void tglStyle2_Click(object sender, RibbonControlEventArgs e)
        {
            if (tglStyle2.Checked) { tglStyle1.Checked = false; tglStyle3.Checked = false; }
        }

        private void tglStyle3_Click(object sender, RibbonControlEventArgs e)
        {
            if (tglStyle3.Checked) { tglStyle1.Checked = false; tglStyle2.Checked = false; }
        }

        /// <summary>0 = no number, 1 = (1), 2 = (1.1), 3 = (1.1.1).</summary>
        public int GetSelectedNumberingStyle()
        {
            if (tglStyle1.Checked) return 1;
            if (tglStyle2.Checked) return 2;
            if (tglStyle3.Checked) return 3;
            return 0;
        }

        private void btnNewChapter_Click(object sender, RibbonControlEventArgs e)
        {
            Word.Application app = Globals.ThisAddIn.Application;
            if (app.Documents.Count == 0) return;
            Word.Selection sel = app.Selection;

            string chapterSwitch = _isResetRequested ? @"\r 1" : @"\n";
            sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, $@"SEQ Chapter {chapterSwitch} \h", false);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            // Reset the per-chapter and per-section counters.
            sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ Section \r 0 \h", false);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ EqCh \r 0 \h", false);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ EqSec \r 0 \h", false);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);

            _isResetRequested = false;
            app.ActiveDocument.Fields.Update();
        }

        private void btnNewSection_Click(object sender, RibbonControlEventArgs e)
        {
            Word.Application app = Globals.ThisAddIn.Application;
            if (app.Documents.Count == 0) return;
            Word.Selection sel = app.Selection;

            sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ Section \n \h", false);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            sel.Fields.Add(sel.Range, Word.WdFieldType.wdFieldEmpty, @"SEQ EqSec \r 0 \h", false);
            sel.Collapse(Word.WdCollapseDirection.wdCollapseEnd);
            app.ActiveDocument.Fields.Update();
        }

        private void btnUpdate_Click(object sender, RibbonControlEventArgs e)
        {
            Word.Application app = Globals.ThisAddIn.Application;
            if (app.Documents.Count > 0) app.ActiveDocument.Fields.Update();
        }

        private void btnResetAll_Click(object sender, RibbonControlEventArgs e)
        {
            Word.Application app = Globals.ThisAddIn.Application;
            if (app.Documents.Count == 0) return;

            var answer = MessageBox.Show("문서 전체의 수식 번호 카운터를 1번부터 시작하도록 초기화할까요?",
                "전체 초기화 확인", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (answer != DialogResult.Yes) return;

            Word.Document doc = app.ActiveDocument;
            // Remove only the hidden (\h) control fields; visible equation numbers stay.
            for (int i = doc.Fields.Count; i >= 1; i--)
            {
                Word.Field field = doc.Fields[i];
                string code = field.Code.Text.ToUpperInvariant();
                bool ours = code.Contains("SEQ CHAPTER") || code.Contains("SEQ SECTION") || code.Contains("SEQ EQCH") ||
                            code.Contains("SEQ EQSEC") || code.Contains("SEQ EQGLOBAL");
                if (ours && code.Contains("\\H")) field.Delete();
            }

            Word.Range start = doc.Range(0, 0);
            start.Fields.Add(start, Word.WdFieldType.wdFieldEmpty, @"SEQ Chapter \r 0 \h", false);
            start.Fields.Add(start, Word.WdFieldType.wdFieldEmpty, @"SEQ Section \r 0 \h", false);
            start.Fields.Add(start, Word.WdFieldType.wdFieldEmpty, @"SEQ EqGlobal \r 0 \h", false);
            start.Fields.Add(start, Word.WdFieldType.wdFieldEmpty, @"SEQ EqCh \r 0 \h", false);
            start.Fields.Add(start, Word.WdFieldType.wdFieldEmpty, @"SEQ EqSec \r 0 \h", false);

            doc.Fields.Update();
            _isResetRequested = true;
            MessageBox.Show("모든 수식 번호 체계가 초기화되었습니다.", "TeXture");
        }
    }
}
