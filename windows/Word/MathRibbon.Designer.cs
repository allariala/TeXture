namespace WordLaTeX
{
    partial class MathRibbon : Microsoft.Office.Tools.Ribbon.RibbonBase
    {
        private System.ComponentModel.IContainer components = null;

        public MathRibbon()
            : base(Globals.Factory.GetRibbonFactory())
        {
            InitializeComponent();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region 구성 요소 디자이너에서 생성한 코드

        private void InitializeComponent()
        {
            this.tabTeXture = this.Factory.CreateRibbonTab();
            this.grpEditor = this.Factory.CreateRibbonGroup();
            this.btnShowPane = this.Factory.CreateRibbonButton();
            this.btnShowForm = this.Factory.CreateRibbonButton();
            this.btnCapture = this.Factory.CreateRibbonButton();
            this.btnSettings = this.Factory.CreateRibbonButton();
            this.grpSymbols = this.Factory.CreateRibbonGroup();
            this.galStructures = this.Factory.CreateRibbonGallery();
            this.galBrackets = this.Factory.CreateRibbonGallery();
            this.galCalculus = this.Factory.CreateRibbonGallery();
            this.galMatrices = this.Factory.CreateRibbonGallery();
            this.galAccents = this.Factory.CreateRibbonGallery();
            this.galGreek = this.Factory.CreateRibbonGallery();
            this.galOperators = this.Factory.CreateRibbonGallery();
            this.galRelations = this.Factory.CreateRibbonGallery();
            this.galArrows = this.Factory.CreateRibbonGallery();
            this.galSets = this.Factory.CreateRibbonGallery();
            this.galMisc = this.Factory.CreateRibbonGallery();
            this.grpNumbering = this.Factory.CreateRibbonGroup();
            this.btnNewChapter = this.Factory.CreateRibbonButton();
            this.btnNewSection = this.Factory.CreateRibbonButton();
            this.buttonGroup1 = this.Factory.CreateRibbonButtonGroup();
            this.btnUpdate = this.Factory.CreateRibbonButton();
            this.btnResetAll = this.Factory.CreateRibbonButton();
            this.separator1 = this.Factory.CreateRibbonSeparator();
            this.tglStyle1 = this.Factory.CreateRibbonToggleButton();
            this.tglStyle2 = this.Factory.CreateRibbonToggleButton();
            this.tglStyle3 = this.Factory.CreateRibbonToggleButton();
            this.tabTeXture.SuspendLayout();
            this.grpEditor.SuspendLayout();
            this.grpSymbols.SuspendLayout();
            this.grpNumbering.SuspendLayout();
            this.buttonGroup1.SuspendLayout();
            this.SuspendLayout();
            //
            // tabTeXture
            //
            this.tabTeXture.ControlId.ControlIdType = Microsoft.Office.Tools.Ribbon.RibbonControlIdType.Custom;
            this.tabTeXture.Groups.Add(this.grpEditor);
            this.tabTeXture.Groups.Add(this.grpSymbols);
            this.tabTeXture.Groups.Add(this.grpNumbering);
            this.tabTeXture.Label = "TeXture";
            this.tabTeXture.Name = "tabTeXture";
            //
            // grpEditor
            //
            this.grpEditor.Items.Add(this.btnShowPane);
            this.grpEditor.Items.Add(this.btnShowForm);
            this.grpEditor.Items.Add(this.btnCapture);
            this.grpEditor.Items.Add(this.btnSettings);
            this.grpEditor.Label = "Editor";
            this.grpEditor.Name = "grpEditor";
            this.btnShowPane.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.btnShowPane.Label = "Sidebar";
            this.btnShowPane.Name = "btnShowPane";
            this.btnShowPane.OfficeImageId = "SmartArtTextPane";
            this.btnShowPane.ScreenTip = "사이드바 편집기";
            this.btnShowPane.ShowImage = true;
            this.btnShowPane.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnShowPane_Click);
            this.btnShowForm.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.btnShowForm.Label = "Popup";
            this.btnShowForm.Name = "btnShowForm";
            this.btnShowForm.OfficeImageId = "WindowNew";
            this.btnShowForm.ScreenTip = "팝업 편집기";
            this.btnShowForm.ShowImage = true;
            this.btnShowForm.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnShowForm_Click);
            this.btnCapture.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.btnCapture.Label = "Capture";
            this.btnCapture.Name = "btnCapture";
            this.btnCapture.OfficeImageId = "ScreenClipping";
            this.btnCapture.ScreenTip = "화면 수식 캡처";
            this.btnCapture.ShowImage = true;
            this.btnCapture.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnCapture_Click);
            this.btnSettings.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.btnSettings.Label = "Settings";
            this.btnSettings.Name = "btnSettings";
            this.btnSettings.OfficeImageId = "PropertySheet";
            this.btnSettings.ScreenTip = "설정 및 스니펫";
            this.btnSettings.ShowImage = true;
            this.btnSettings.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnSettings_Click);
            //
            // grpSymbols
            //
            this.grpSymbols.Items.Add(this.galStructures);
            this.grpSymbols.Items.Add(this.galBrackets);
            this.grpSymbols.Items.Add(this.galCalculus);
            this.grpSymbols.Items.Add(this.galMatrices);
            this.grpSymbols.Items.Add(this.galAccents);
            this.grpSymbols.Items.Add(this.galGreek);
            this.grpSymbols.Items.Add(this.galOperators);
            this.grpSymbols.Items.Add(this.galRelations);
            this.grpSymbols.Items.Add(this.galArrows);
            this.grpSymbols.Items.Add(this.galSets);
            this.grpSymbols.Items.Add(this.galMisc);
            this.grpSymbols.Label = "Symbols (MathType shortcuts in tooltips)";
            this.grpSymbols.Name = "grpSymbols";
            this.galStructures.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.galStructures.Label = "Fractions & Scripts";
            this.galStructures.Name = "galStructures";
            this.galStructures.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galBrackets.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.galBrackets.Label = "Brackets";
            this.galBrackets.Name = "galBrackets";
            this.galBrackets.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galCalculus.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.galCalculus.Label = "Calculus";
            this.galCalculus.Name = "galCalculus";
            this.galCalculus.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galMatrices.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.galMatrices.Label = "Matrices";
            this.galMatrices.Name = "galMatrices";
            this.galMatrices.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galAccents.ControlSize = Microsoft.Office.Core.RibbonControlSize.RibbonControlSizeLarge;
            this.galAccents.Label = "Accents";
            this.galAccents.Name = "galAccents";
            this.galAccents.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galGreek.Label = "Greek";
            this.galGreek.Name = "galGreek";
            this.galGreek.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galOperators.Label = "Operators";
            this.galOperators.Name = "galOperators";
            this.galOperators.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galRelations.Label = "Relations";
            this.galRelations.Name = "galRelations";
            this.galRelations.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galArrows.Label = "Arrows";
            this.galArrows.Name = "galArrows";
            this.galArrows.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galSets.Label = "Sets & Logic";
            this.galSets.Name = "galSets";
            this.galSets.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            this.galMisc.Label = "Misc";
            this.galMisc.Name = "galMisc";
            this.galMisc.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.Gallery_Click);
            //
            // grpNumbering
            //
            this.grpNumbering.Items.Add(this.btnNewChapter);
            this.grpNumbering.Items.Add(this.btnNewSection);
            this.grpNumbering.Items.Add(this.buttonGroup1);
            this.grpNumbering.Items.Add(this.separator1);
            this.grpNumbering.Items.Add(this.tglStyle1);
            this.grpNumbering.Items.Add(this.tglStyle2);
            this.grpNumbering.Items.Add(this.tglStyle3);
            this.grpNumbering.Label = "Numbering";
            this.grpNumbering.Name = "grpNumbering";
            this.btnNewChapter.Label = "New Chapter";
            this.btnNewChapter.Name = "btnNewChapter";
            this.btnNewChapter.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnNewChapter_Click);
            this.btnNewSection.Label = "New Section";
            this.btnNewSection.Name = "btnNewSection";
            this.btnNewSection.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnNewSection_Click);
            this.buttonGroup1.Items.Add(this.btnUpdate);
            this.buttonGroup1.Items.Add(this.btnResetAll);
            this.buttonGroup1.Name = "buttonGroup1";
            this.btnUpdate.Label = "Update";
            this.btnUpdate.Name = "btnUpdate";
            this.btnUpdate.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnUpdate_Click);
            this.btnResetAll.Label = "Reset";
            this.btnResetAll.Name = "btnResetAll";
            this.btnResetAll.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnResetAll_Click);
            this.separator1.Name = "separator1";
            this.tglStyle1.Label = "(1)";
            this.tglStyle1.Name = "tglStyle1";
            this.tglStyle1.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.tglStyle1_Click);
            this.tglStyle2.Label = "(1.1)";
            this.tglStyle2.Name = "tglStyle2";
            this.tglStyle2.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.tglStyle2_Click);
            this.tglStyle3.Label = "(1.1.1)";
            this.tglStyle3.Name = "tglStyle3";
            this.tglStyle3.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.tglStyle3_Click);
            //
            // MathRibbon
            //
            this.Name = "MathRibbon";
            this.RibbonType = "Microsoft.Word.Document";
            this.Tabs.Add(this.tabTeXture);
            this.Load += new Microsoft.Office.Tools.Ribbon.RibbonUIEventHandler(this.MathRibbon_Load);
            this.tabTeXture.ResumeLayout(false);
            this.tabTeXture.PerformLayout();
            this.grpEditor.ResumeLayout(false);
            this.grpEditor.PerformLayout();
            this.grpSymbols.ResumeLayout(false);
            this.grpSymbols.PerformLayout();
            this.grpNumbering.ResumeLayout(false);
            this.grpNumbering.PerformLayout();
            this.buttonGroup1.ResumeLayout(false);
            this.buttonGroup1.PerformLayout();
            this.ResumeLayout(false);
        }

        #endregion

        internal Microsoft.Office.Tools.Ribbon.RibbonTab tabTeXture;
        internal Microsoft.Office.Tools.Ribbon.RibbonGroup grpEditor;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnShowPane;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnShowForm;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnCapture;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnSettings;
        internal Microsoft.Office.Tools.Ribbon.RibbonGroup grpSymbols;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galStructures;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galBrackets;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galCalculus;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galMatrices;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galAccents;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galGreek;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galOperators;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galRelations;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galArrows;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galSets;
        internal Microsoft.Office.Tools.Ribbon.RibbonGallery galMisc;
        internal Microsoft.Office.Tools.Ribbon.RibbonGroup grpNumbering;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnNewChapter;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnNewSection;
        internal Microsoft.Office.Tools.Ribbon.RibbonButtonGroup buttonGroup1;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnUpdate;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnResetAll;
        internal Microsoft.Office.Tools.Ribbon.RibbonSeparator separator1;
        internal Microsoft.Office.Tools.Ribbon.RibbonToggleButton tglStyle1;
        internal Microsoft.Office.Tools.Ribbon.RibbonToggleButton tglStyle2;
        internal Microsoft.Office.Tools.Ribbon.RibbonToggleButton tglStyle3;
    }

    partial class ThisRibbonCollection
    {
        internal MathRibbon MathRibbon
        {
            get { return this.GetRibbon<MathRibbon>(); }
        }
    }
}
