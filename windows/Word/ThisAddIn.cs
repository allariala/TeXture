using System;
using System.Drawing;
using TeXture.Core.Hosting;
using TeXture.Core.Util;

namespace WordLaTeX
{
    /// <summary>Word entry point: wires the Word adapter into the shared TeXture runtime.</summary>
    public partial class ThisAddIn
    {
        private WordAdapter _adapter;

        internal TeXtureRuntime Runtime { get; private set; }

        private void ThisAddIn_Startup(object sender, EventArgs e)
        {
            try
            {
                _adapter = new WordAdapter(Application);
                Runtime = new TeXtureRuntime(_adapter, CustomTaskPanes, LoadIcon(), "TeXture");
            }
            catch (Exception ex)
            {
                Log.Error("Word add-in startup failed", ex);
            }
        }

        private void ThisAddIn_Shutdown(object sender, EventArgs e)
        {
            Runtime?.Dispose();
            _adapter?.Dispose();
        }

        private static Icon LoadIcon()
        {
            using (var stream = typeof(ThisAddIn).Assembly.GetManifestResourceStream("WordLaTeX.TeXture_Word.ico"))
                return stream == null ? null : new Icon(stream);
        }

        #region VSTO 생성 코드
        private void InternalStartup()
        {
            Startup += ThisAddIn_Startup;
            Shutdown += ThisAddIn_Shutdown;
        }
        #endregion
    }
}
