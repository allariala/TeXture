using System;
using System.Drawing;
using System.Linq;
using Microsoft.Office.Tools.Ribbon;
using TeXture.Core.Util;

namespace TeXture.Core.Ribbon
{
    /// <summary>Fills a VSTO ribbon gallery with catalog items (icon + tooltip showing LaTeX and the MathType shortcut).</summary>
    public static class RibbonGalleryBinder
    {
        public static void Bind(RibbonGallery gallery, RibbonFactory factory, string groupId, int columns = 8)
        {
            try
            {
                var catalog = Catalog.Current;
                var items = catalog.ItemsIn(groupId).ToList();
                if (items.Count == 0) { gallery.Visible = false; return; }

                int px = IconPixels();
                var ink = OfficeTheme.IsDark() ? Color.FromArgb(235, 235, 235) : Color.FromArgb(38, 38, 38);

                gallery.Items.Clear();
                foreach (var item in items)
                {
                    var entry = factory.CreateRibbonDropDownItem();
                    entry.Image = GlyphRenderer.Render(item, px, ink);
                    entry.Label = item.Name ?? item.Tex;
                    entry.ScreenTip = item.Name ?? item.Tex;
                    entry.SuperTip = item.Tex.Replace("$0", "□").Replace("$1", "□").Replace("$2", "□") +
                                     (string.IsNullOrEmpty(item.Keys) ? "" : "\n단축키 (MathType): " + item.Keys);
                    entry.Tag = item;
                    gallery.Items.Add(entry);
                }
                gallery.ShowItemLabel = false;
                gallery.ShowItemImage = true;
                gallery.ItemImageSize = new Size(32, 32);
                gallery.ColumnCount = columns;
                gallery.RowCount = Math.Max(1, Math.Min(8, (items.Count + columns - 1) / columns));
                gallery.Image = GlyphRenderer.Render(items[0], IconPixels(), ink);
                gallery.ShowImage = true;
            }
            catch (Exception ex)
            {
                Log.Error("Could not build ribbon gallery " + groupId, ex);
            }
        }

        /// <summary>Returns the catalog item behind a clicked gallery entry.</summary>
        public static CatalogItem SelectedItem(RibbonGallery gallery) => gallery.SelectedItem?.Tag as CatalogItem;

        private static int IconPixels()
        {
            try
            {
                using (var g = Graphics.FromHwnd(IntPtr.Zero))
                    return Math.Max(32, (int)Math.Round(32 * g.DpiX / 96f));
            }
            catch { return 32; }
        }
    }
}
