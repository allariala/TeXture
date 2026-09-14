using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using TeXture.Core.Util;

namespace TeXture.Core.Settings
{
    /// <summary>
    /// User snippets (%APPDATA%\TeXture\snippets.json). A missing file means "use the built-in defaults",
    /// which live in the UI. The same file format is used for import/export so a configuration can be
    /// moved between machines (and, later, to the Mac add-in).
    /// </summary>
    public sealed class SnippetStore
    {
        public const string Format = "texture-snippets";
        private readonly string _path = Path.Combine(Paths.RoamingDir, "snippets.json");

        /// <summary>Stored snippets, or null when the user never customised them.</summary>
        public object[] Load()
        {
            object[] result = null;
            SettingsStore.WithLock(() =>
            {
                try
                {
                    if (File.Exists(_path)) result = ExtractSnippets(Json.Parse(File.ReadAllText(_path)));
                }
                catch (Exception ex)
                {
                    Log.Warn("snippets.json is unreadable; falling back to defaults", ex);
                }
            });
            return result;
        }

        public void Save(object[] snippets)
        {
            SettingsStore.WithLock(() =>
            {
                if (snippets == null)
                {
                    if (File.Exists(_path)) File.Delete(_path);
                    return;
                }
                Paths.WriteAllTextAtomic(_path, Json.Serialize(Wrap(snippets)));
            });
        }

        public bool Export(IWin32Window owner, object[] snippets)
        {
            using (var dlg = new SaveFileDialog
            {
                Title = "TeXture 스니펫 내보내기",
                Filter = "TeXture snippets (*.json)|*.json|All files (*.*)|*.*",
                FileName = "texture-snippets.json",
                AddExtension = true,
            })
            {
                if (dlg.ShowDialog(owner) != DialogResult.OK) return false;
                File.WriteAllText(dlg.FileName, Json.Serialize(Wrap(snippets)), new System.Text.UTF8Encoding(false));
                return true;
            }
        }

        /// <summary>
        /// Lets the user pick a file and choose merge/replace. Returns the resulting list, or null if cancelled.
        /// Accepts the TeXture format, a bare array (the v1.2 JSON editor), and Obsidian LaTeX-Suite style
        /// entries ({trigger, replacement, options:"rA"}).
        /// </summary>
        public object[] Import(IWin32Window owner, object[] current)
        {
            string file;
            using (var dlg = new OpenFileDialog
            {
                Title = "TeXture 스니펫 가져오기",
                Filter = "Snippet files (*.json)|*.json|All files (*.*)|*.*",
            })
            {
                if (dlg.ShowDialog(owner) != DialogResult.OK) return null;
                file = dlg.FileName;
            }

            object[] imported;
            try
            {
                imported = ExtractSnippets(Json.Parse(File.ReadAllText(file)));
            }
            catch (Exception ex)
            {
                MessageBox.Show(owner, "파일을 읽을 수 없습니다.\n\n" + ex.Message, "TeXture", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return null;
            }
            if (imported == null || imported.Length == 0)
            {
                MessageBox.Show(owner, "스니펫 목록을 찾을 수 없습니다. TeXture에서 내보낸 JSON 파일인지 확인해 주세요.", "TeXture",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return null;
            }

            var answer = MessageBox.Show(owner,
                $"스니펫 {imported.Length}개를 가져왔습니다.\n\n[예] 현재 목록에 병합 (같은 트리거는 새 값으로 덮어씀)\n[아니요] 현재 목록을 모두 교체",
                "TeXture 스니펫 가져오기", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
            if (answer == DialogResult.Cancel) return null;
            if (answer == DialogResult.No || current == null) return imported;

            var merged = current.OfType<Dictionary<string, object>>().ToList();
            foreach (var item in imported.OfType<Dictionary<string, object>>())
            {
                int idx = merged.FindIndex(s => s.GetString("trigger") == item.GetString("trigger"));
                if (idx >= 0) merged[idx] = item; else merged.Add(item);
            }
            return merged.Cast<object>().ToArray();
        }

        private static Dictionary<string, object> Wrap(object[] snippets) => new Dictionary<string, object>
        {
            ["format"] = Format,
            ["version"] = 1,
            ["exported"] = DateTime.UtcNow.ToString("o"),
            ["snippets"] = snippets,
        };

        private static object[] ExtractSnippets(object parsed)
        {
            object[] raw = parsed as object[];
            if (raw == null && parsed is Dictionary<string, object> obj) raw = obj.GetArray("snippets");
            if (raw == null) return null;

            var list = new List<object>();
            foreach (var entry in raw.OfType<Dictionary<string, object>>())
            {
                string trigger = entry.GetString("trigger");
                string replacement = entry.GetString("replacement");
                if (string.IsNullOrEmpty(trigger) || replacement == null) continue;

                var clean = new Dictionary<string, object> { ["trigger"] = trigger, ["replacement"] = replacement };
                bool isRegex = entry.GetBool("isRegex") || (entry.GetString("options") ?? "").Contains("r");
                if (isRegex) clean["isRegex"] = true;
                string guide = entry.GetString("showGuide") ?? entry.GetString("description");
                if (!string.IsNullOrEmpty(guide)) clean["showGuide"] = guide;
                if (entry.ContainsKey("enabled") && !entry.GetBool("enabled", true)) clean["enabled"] = false;
                list.Add(clean);
            }
            return list.ToArray();
        }
    }
}
