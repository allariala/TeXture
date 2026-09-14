using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using TeXture.Core.Util;

namespace TeXture.Core.Editor
{
    /// <summary>One WebView2 environment per Office process, shared by every sidebar and the popup.</summary>
    internal static class WebViewEnvironment
    {
        private static Task<CoreWebView2Environment> _env;

        public static Task<CoreWebView2Environment> GetAsync()
        {
            // Same user-data folder as v1.2 → same origin storage (lets the UI migrate old snippet edits).
            return _env ?? (_env = CoreWebView2Environment.CreateAsync(null, Paths.LocalDir));
        }
    }
}
