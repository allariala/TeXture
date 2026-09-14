using System;
using System.IO;

namespace TeXture.Core.Util
{
    /// <summary>Small file logger (%LOCALAPPDATA%\TeXture\logs). Errors that used to be swallowed silently land here.</summary>
    public static class Log
    {
        private const long MaxBytes = 1024 * 1024;
        private static readonly object Gate = new object();
        private static string _file = Path.Combine(Paths.LogDir, "texture.log");

        public static void Configure(string hostId)
        {
            _file = Path.Combine(Paths.LogDir, "texture-" + hostId + ".log");
        }

        public static void Info(string message) => Write("INFO ", message, null);
        public static void Warn(string message, Exception ex = null) => Write("WARN ", message, ex);
        public static void Error(string message, Exception ex = null) => Write("ERROR", message, ex);

        private static void Write(string level, string message, Exception ex)
        {
            try
            {
                lock (Gate)
                {
                    var fi = new FileInfo(_file);
                    if (fi.Exists && fi.Length > MaxBytes)
                    {
                        string old = _file + ".1";
                        if (File.Exists(old)) File.Delete(old);
                        File.Move(_file, old);
                    }
                    string line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {level} {message}";
                    if (ex != null) line += Environment.NewLine + "    " + ex;
                    File.AppendAllText(_file, line + Environment.NewLine);
                }
            }
            catch
            {
                // Logging must never take the add-in down.
            }
            System.Diagnostics.Debug.WriteLine($"[TeXture] {level} {message} {ex}");
        }
    }
}
