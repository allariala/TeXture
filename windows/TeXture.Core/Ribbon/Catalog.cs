using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using TeXture.Core.Editor;
using TeXture.Core.Util;

namespace TeXture.Core.Ribbon
{
    /// <summary>One symbol/template from ui/data/catalog.json (the single source for palette, chords and ribbon).</summary>
    public sealed class CatalogItem
    {
        public string Group { get; set; }
        public string Tex { get; set; }
        public string Glyph { get; set; }
        public string Template { get; set; }
        public string Keys { get; set; }
        public string Name { get; set; }
        public string Mode { get; set; }
    }

    public sealed class CatalogGroup
    {
        public string Id { get; set; }
        public string Label { get; set; }
        public string Ribbon { get; set; }
    }

    public sealed class Catalog
    {
        private static Catalog _cached;

        public IList<CatalogGroup> Groups { get; } = new List<CatalogGroup>();
        public IList<CatalogItem> Items { get; } = new List<CatalogItem>();

        public static Catalog Current => _cached ?? (_cached = Load(UiLocator.CatalogPath));

        public IEnumerable<CatalogItem> ItemsIn(string groupId) => Items.Where(i => i.Group == groupId);

        public static Catalog Load(string path)
        {
            var catalog = new Catalog();
            try
            {
                var root = Json.ParseObject(File.ReadAllText(path));
                foreach (var g in (root.GetArray("groups") ?? new object[0]).OfType<Dictionary<string, object>>())
                {
                    catalog.Groups.Add(new CatalogGroup
                    {
                        Id = g.GetString("id"),
                        Label = g.GetString("label"),
                        Ribbon = g.GetString("ribbon"),
                    });
                }
                foreach (var i in (root.GetArray("items") ?? new object[0]).OfType<Dictionary<string, object>>())
                {
                    catalog.Items.Add(new CatalogItem
                    {
                        Group = i.GetString("g"),
                        Tex = i.GetString("tex"),
                        Glyph = i.GetString("glyph"),
                        Template = i.GetString("tpl"),
                        Keys = i.GetString("keys"),
                        Name = i.GetString("name"),
                        Mode = i.GetString("mode"),
                    });
                }
            }
            catch (Exception ex)
            {
                Log.Error("Could not load symbol catalog from " + path, ex);
            }
            return catalog;
        }
    }
}
