using Microsoft.Win32;

namespace TeXture.Core.Util
{
    /// <summary>
    /// Reads the Office UI theme so the editor matches Office rather than the Windows app theme
    /// (they are set independently). "UI Theme": 3 = Dark Gray, 4 = Black, 5 = White, 0/7 = Colorful,
    /// 6 = follow Windows.
    /// </summary>
    public static class OfficeTheme
    {
        public static bool IsDark()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Office\16.0\Common"))
                {
                    object v = key?.GetValue("UI Theme");
                    if (v is int theme)
                    {
                        if (theme == 3 || theme == 4) return true;
                        if (theme != 6) return false;
                    }
                }
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                {
                    return key?.GetValue("AppsUseLightTheme") is int light && light == 0;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
