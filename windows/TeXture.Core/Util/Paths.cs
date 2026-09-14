using System;
using System.IO;

namespace TeXture.Core.Util
{
    public static class Paths
    {
        /// <summary>Roaming user settings: settings.json, snippets.json, per-host state.</summary>
        public static string RoamingDir => Ensure(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TeXture"));

        /// <summary>
        /// Machine-local data. This is also the WebView2 user-data folder used since v1.2, so the
        /// editor keeps the same origin storage (older snippet edits are migrated from there).
        /// </summary>
        public static string LocalDir => Ensure(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TeXture"));

        public static string LogDir => Ensure(Path.Combine(LocalDir, "logs"));

        /// <summary>Folder the add-in assembly was loaded from (the VSTO solution folder).</summary>
        public static string AddInDir => AppDomain.CurrentDomain.BaseDirectory;

        public static string Ensure(string dir)
        {
            try { Directory.CreateDirectory(dir); } catch (IOException) { } catch (UnauthorizedAccessException) { }
            return dir;
        }

        /// <summary>Writes a file atomically (temp file + replace) so a crash never leaves half-written JSON.</summary>
        public static void WriteAllTextAtomic(string path, string content)
        {
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, content, new System.Text.UTF8Encoding(false));
            if (File.Exists(path)) File.Replace(tmp, path, null);
            else File.Move(tmp, path);
        }
    }
}
