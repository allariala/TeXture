using System;
using System.Collections.Generic;
using System.Windows.Forms;

namespace TeXture.Core.Input
{
    /// <summary>A key plus modifiers, e.g. "Alt+Shift+E". Parsed from / formatted to the settings file.</summary>
    public struct HotkeyGesture : IEquatable<HotkeyGesture>
    {
        public HotkeyGesture(Keys key, bool ctrl, bool alt, bool shift)
        {
            Key = key; Ctrl = ctrl; Alt = alt; Shift = shift;
        }

        public Keys Key { get; }
        public bool Ctrl { get; }
        public bool Alt { get; }
        public bool Shift { get; }

        public bool IsValid => Key != Keys.None && (Ctrl || Alt);

        public static bool TryParse(string text, out HotkeyGesture gesture)
        {
            gesture = default(HotkeyGesture);
            if (string.IsNullOrWhiteSpace(text)) return false;
            bool ctrl = false, alt = false, shift = false;
            Keys key = Keys.None;
            foreach (var raw in text.Split('+'))
            {
                string part = raw.Trim();
                switch (part.ToLowerInvariant())
                {
                    case "ctrl": case "control": ctrl = true; break;
                    case "alt": alt = true; break;
                    case "shift": shift = true; break;
                    default:
                        if (part.Length == 1 && char.IsLetterOrDigit(part[0]))
                            key = char.IsDigit(part[0]) ? Keys.D0 + (part[0] - '0') : (Keys)char.ToUpperInvariant(part[0]);
                        else if (!Enum.TryParse(part, true, out key)) return false;
                        break;
                }
            }
            gesture = new HotkeyGesture(key, ctrl, alt, shift);
            return gesture.IsValid;
        }

        public override string ToString()
        {
            var parts = new List<string>();
            if (Ctrl) parts.Add("Ctrl");
            if (Alt) parts.Add("Alt");
            if (Shift) parts.Add("Shift");
            parts.Add(Key >= Keys.D0 && Key <= Keys.D9 ? ((char)('0' + (Key - Keys.D0))).ToString() : Key.ToString());
            return string.Join("+", parts);
        }

        public bool Equals(HotkeyGesture other) =>
            Key == other.Key && Ctrl == other.Ctrl && Alt == other.Alt && Shift == other.Shift;

        public override bool Equals(object obj) => obj is HotkeyGesture g && Equals(g);

        public override int GetHashCode() => ((int)Key << 3) | (Ctrl ? 4 : 0) | (Alt ? 2 : 0) | (Shift ? 1 : 0);
    }
}
