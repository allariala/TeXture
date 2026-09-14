using System;
using System.Drawing;
using TeXture.Core.Hosting;
using TeXture.Core.Util;

namespace PowerLaTeX
{
    /// <summary>PowerPoint entry point: wires the PowerPoint adapter into the shared TeXture runtime.</summary>
    public partial class ThisAddIn
    {
        private PowerPointAdapter _adapter;

        internal TeXtureRuntime Runtime { get; private set; }

        private void ThisAddIn_Startup(object sender, EventArgs e)
        {
            try
            {
                _adapter = new PowerPointAdapter(Application);
                Runtime = new TeXtureRuntime(_adapter, CustomTaskPanes, LoadIcon(), "TeXture");
            }
            catch (Exception ex)
            {
                Log.Error("PowerPoint add-in startup failed", ex);
            }
        }

        private void ThisAddIn_Shutdown(object sender, EventArgs e)
        {
            Runtime?.Dispose();
            _adapter?.Dispose();
        }

        private static Icon LoadIcon()
        {
            using (var stream = typeof(ThisAddIn).Assembly.GetManifestResourceStream("PowerLaTeX.TeXture_PPT.ico"))
                return stream == null ? null : new Icon(stream);
        }

        #region VSTO에서 생성한 코드
        private void InternalStartup()
        {
            Startup += ThisAddIn_Startup;
            Shutdown += ThisAddIn_Shutdown;
        }
        #endregion
    }
}
