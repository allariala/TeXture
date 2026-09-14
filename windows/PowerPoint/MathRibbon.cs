using Microsoft.Office.Tools.Ribbon;
using TeXture.Core.Ribbon;

namespace PowerLaTeX
{
    public partial class MathRibbon
    {
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
    }
}
