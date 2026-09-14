using System;
using System.Collections.Generic;
using System.Globalization;
using TeXture.Core.Util;

namespace TeXture.Core.Model
{
    /// <summary>
    /// Equation data stored on a shape (schema v2).
    ///
    /// PowerPoint: shape Tags TEXTURE_* (authoritative) plus alt text "PLX:&lt;latex&gt;" so v1.2.x and the
    /// Mac add-in can still read equations made by this version.
    /// Word: InlineShape.AlternativeText "PLX:&lt;latex&gt;" plus a JSON property bag in InlineShape.Title.
    ///
    /// Readers accept, in order: TEXTURE_LATEX tag, "PLX:" alt text, legacy tags TeXture_Code /
    /// PowerLaTeX_Code, and a "PLX:" shape name (written by the Mac add-in).
    /// </summary>
    public sealed class EquationMetadata
    {
        public const int CurrentVersion = 2;
        public const string LegacyPrefix = "PLX:";
        public const string WordTitlePrefix = "TeXture:";

        public const string TagLatex = "TEXTURE_LATEX";
        public const string TagVersion = "TEXTURE_VERSION";
        public const string TagFontSize = "TEXTURE_FONTSIZE";
        public const string TagColor = "TEXTURE_COLOR";
        public const string TagBaseWidth = "TEXTURE_BASEW";
        public const string TagBaseHeight = "TEXTURE_BASEH";
        public const string TagId = "TEXTURE_ID";

        /// <summary>Legacy tags (v1.2 Windows / Mac web add-in). Read-only.</summary>
        public static readonly string[] LegacyLatexTags = { "TeXture_Code", "PowerLaTeX_Code" };

        public string Latex { get; set; }
        public int Version { get; set; } = CurrentVersion;
        public double? FontSize { get; set; }
        public string Color { get; set; }
        /// <summary>Natural (100 %) size in points right after insertion; lets us detect manual resizing.</summary>
        public double? BaseWidth { get; set; }
        public double? BaseHeight { get; set; }
        public string Id { get; set; }

        public bool IsLegacy => Version < CurrentVersion || FontSize == null;

        /// <summary>
        /// Font size that reproduces the shape's current on-slide size. If the user dragged the shape
        /// bigger, re-editing keeps that size by raising the font size instead of snapping back.
        /// </summary>
        public double? EffectiveFontSize(double currentWidth)
        {
            if (FontSize == null) return null;
            if (BaseWidth == null || BaseWidth <= 0 || currentWidth <= 0) return FontSize;
            double scale = currentWidth / BaseWidth.Value;
            if (Math.Abs(scale - 1) < 0.01) return FontSize;
            return Math.Round(FontSize.Value * scale * 2, MidpointRounding.AwayFromZero) / 2; // nearest 0.5 pt
        }

        public static string NewId() => Guid.NewGuid().ToString("N");

        public static string LatexFromAltText(string altText)
        {
            if (string.IsNullOrEmpty(altText)) return null;
            return altText.StartsWith(LegacyPrefix, StringComparison.Ordinal) ? altText.Substring(LegacyPrefix.Length) : null;
        }

        public static string AltTextFor(string latex) => LegacyPrefix + latex;

        // ---- PowerPoint tag (de)serialisation ------------------------------------------------------

        /// <summary>Values to write as PowerPoint tags.</summary>
        public IEnumerable<KeyValuePair<string, string>> ToTags()
        {
            yield return Pair(TagLatex, Latex);
            yield return Pair(TagVersion, Version.ToString(CultureInfo.InvariantCulture));
            if (FontSize != null) yield return Pair(TagFontSize, Fmt(FontSize.Value));
            if (!string.IsNullOrEmpty(Color)) yield return Pair(TagColor, Color);
            if (BaseWidth != null) yield return Pair(TagBaseWidth, Fmt(BaseWidth.Value));
            if (BaseHeight != null) yield return Pair(TagBaseHeight, Fmt(BaseHeight.Value));
            if (!string.IsNullOrEmpty(Id)) yield return Pair(TagId, Id);
        }

        /// <summary>
        /// Builds metadata from a tag lookup (returns "" for missing tags, like PowerPoint's Tags.Item),
        /// the alt text and the shape name. Returns null when the shape is not an equation.
        /// </summary>
        public static EquationMetadata FromTags(Func<string, string> tag, string altText, string shapeName)
        {
            string latex = Nz(tag(TagLatex));
            bool v2 = latex != null;
            if (latex == null) latex = LatexFromAltText(altText);
            if (latex == null)
            {
                foreach (var legacy in LegacyLatexTags)
                {
                    latex = Nz(tag(legacy));
                    if (latex != null) break;
                }
            }
            if (latex == null) latex = LatexFromAltText(shapeName);
            if (latex == null) return null;

            var meta = new EquationMetadata { Latex = latex, Version = 1 };
            if (v2)
            {
                meta.Version = ParseInt(tag(TagVersion)) ?? CurrentVersion;
                meta.FontSize = ParseDouble(tag(TagFontSize));
                meta.Color = Nz(tag(TagColor));
                meta.BaseWidth = ParseDouble(tag(TagBaseWidth));
                meta.BaseHeight = ParseDouble(tag(TagBaseHeight));
                meta.Id = Nz(tag(TagId));
            }
            return meta;
        }

        // ---- Word title (de)serialisation ----------------------------------------------------------

        public string ToWordTitle()
        {
            var bag = new Dictionary<string, object> { ["v"] = Version };
            if (FontSize != null) bag["size"] = FontSize.Value;
            if (!string.IsNullOrEmpty(Color)) bag["color"] = Color;
            if (BaseWidth != null) bag["bw"] = BaseWidth.Value;
            if (BaseHeight != null) bag["bh"] = BaseHeight.Value;
            if (!string.IsNullOrEmpty(Id)) bag["id"] = Id;
            return WordTitlePrefix + Json.Serialize(bag);
        }

        public static EquationMetadata FromWord(string altText, string title)
        {
            string latex = LatexFromAltText(altText);
            if (latex == null) return null;
            var meta = new EquationMetadata { Latex = latex, Version = 1 };
            if (!string.IsNullOrEmpty(title) && title.StartsWith(WordTitlePrefix, StringComparison.Ordinal))
            {
                var bag = Json.ParseObject(title.Substring(WordTitlePrefix.Length));
                if (bag != null)
                {
                    meta.Version = (int)(bag.GetDouble("v") ?? CurrentVersion);
                    meta.FontSize = bag.GetDouble("size");
                    meta.Color = bag.GetString("color");
                    meta.BaseWidth = bag.GetDouble("bw");
                    meta.BaseHeight = bag.GetDouble("bh");
                    meta.Id = bag.GetString("id");
                }
            }
            return meta;
        }

        private static KeyValuePair<string, string> Pair(string k, string v) => new KeyValuePair<string, string>(k, v);
        private static string Fmt(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        private static string Nz(string s) => string.IsNullOrEmpty(s) ? null : s;

        private static double? ParseDouble(string s) =>
            double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : (double?)null;

        private static int? ParseInt(string s) =>
            int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : (int?)null;
    }
}
