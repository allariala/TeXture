using System.IO;
using TeXture.Core.Util;

namespace TeXture.Core.Editor
{
    /// <summary>Finds the shared web UI folder: next to the add-in (dev builds) or one level up (installed layout).</summary>
    public static class UiLocator
    {
        public const string VirtualHost = "latex.local";

        public static string UiDirectory
        {
            get
            {
                string addIn = Paths.AddInDir.TrimEnd('\\');
                foreach (var candidate in new[]
                {
                    Path.Combine(addIn, "ui"),
                    Path.Combine(Path.GetDirectoryName(addIn) ?? addIn, "ui"),
                })
                {
                    if (File.Exists(Path.Combine(candidate, "index.html"))) return candidate;
                }
                return Path.Combine(addIn, "ui");
            }
        }

        public static string CatalogPath => Path.Combine(UiDirectory, "data", "catalog.json");
    }
}
