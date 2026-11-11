// Word web adapter. Keep the Windows PLX: alt text / TeXture: JSON title format.
// SVG is embedded via Flat OPC with a PNG fallback, not converted to a bitmap equation.
const LEGACY_PREFIX = 'PLX:';
const TITLE_PREFIX = 'TeXture:';
const PICTURE_FIELDS = 'items/altTextDescription,items/altTextTitle,items/width,items/height';
const newId = () => globalThis.crypto?.randomUUID?.().replace(/-/g, '') ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);

export function describeWordPicture(picture) {
  if (!picture.altTextDescription?.startsWith(LEGACY_PREFIX)) return null;
  const latex = picture.altTextDescription.slice(LEGACY_PREFIX.length);
  let bag = {};
  if (picture.altTextTitle?.startsWith(TITLE_PREFIX)) {
    try { bag = JSON.parse(picture.altTextTitle.slice(TITLE_PREFIX.length)) || {}; } catch { /* legacy */ }
  }
  let size = Number(bag.size);
  if (!(size > 0)) size = null;
  if (size && Number(bag.bw) > 0 && picture.width > 0 && Math.abs(picture.width / bag.bw - 1) > 0.01)
    size = Math.round(size * picture.width / bag.bw * 2) / 2;
  return {
    // No positional index: inserting/deleting other pictures must not change the target.
    key: bag.id ? 'word:id:' + bag.id : 'word:legacy:' + latex,
    latex, fontSize: size, color: bag.color || null,
    legacy: !(Number(bag.v) >= 2 && size), _id: bag.id || null,
  };
}

function xml(value) {
  return String(value).replace(/[&<>"'\r\n\t]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&apos;', '\r': '&#13;', '\n': '&#10;', '\t': '&#9;' }[c]));
}

function utf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function svgDimensions(svg) {
  const root = String(svg).match(/<svg\b[^>]*>/i)?.[0] || '';
  const dimension = (name) => {
    const match = root.match(new RegExp('\\b' + name + '=["\']([0-9.]+)(px|pt)?["\']', 'i'));
    return match ? Number(match[1]) * (match[2]?.toLowerCase() === 'pt' ? 96 / 72 : 1) : NaN;
  };
  const width = dimension('width'), height = dimension('height');
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)))
    throw new Error('The equation SVG has invalid dimensions.');
  return { width, height };
}

export function buildWordOoxml(msg, pngBase64, id) {
  const { width, height } = svgDimensions(msg.svg);
  const cx = Math.round(width * 9525), cy = Math.round(height * 9525);
  const title = TITLE_PREFIX + JSON.stringify({ v: 2, size: msg.fontSize, color: msg.color || '#000000',
    bw: width * 72 / 96, bh: height * 72 / 96, id });
  const props = `name="TeXture equation" descr="${xml(LEGACY_PREFIX + msg.latex)}" title="${xml(title)}"`;
  return `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships></pkg:xmlData></pkg:part>
<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main"><w:body><w:p><w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" ${props}/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" ${props}/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdPng"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip r:embed="rIdSvg"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline>
</w:drawing></w:r></w:p></w:body></w:document></pkg:xmlData></pkg:part>
<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPng" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/equation.png"/><Relationship Id="rIdSvg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/equation.svg"/></Relationships></pkg:xmlData></pkg:part>
<pkg:part pkg:name="/word/media/equation.png" pkg:contentType="image/png" pkg:compression="store"><pkg:binaryData>${pngBase64}</pkg:binaryData></pkg:part>
<pkg:part pkg:name="/word/media/equation.svg" pkg:contentType="image/svg+xml" pkg:compression="store"><pkg:binaryData>${utf8Base64(msg.svg)}</pkg:binaryData></pkg:part>
</pkg:package>`;
}

async function pngFallback(svg) {
  const { width, height } = svgDimensions(svg);
  const scale = Math.min(2, 4096 / width, 4096 / height);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not render the equation image.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the equation image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

export function createWordAdapter({ renderPng = pngFallback } = {}) {
  async function selectedPictures(ctx) {
    const pictures = ctx.document.getSelection().inlinePictures;
    pictures.load(PICTURE_FIELDS);
    await ctx.sync();
    return pictures.items;
  }

  async function findPicture(ctx, key) {
    // Prefer the selected occurrence when a copied equation retains the same metadata ID.
    const selected = (await selectedPictures(ctx)).filter((p) => describeWordPicture(p)?.key === key);
    if (selected.length === 1) return selected[0];
    const pictures = ctx.document.body.inlinePictures;
    pictures.load(PICTURE_FIELDS);
    await ctx.sync();
    const matches = pictures.items.filter((p) => describeWordPicture(p)?.key === key);
    if (matches.length !== 1) throw new Error('The equation was removed or is ambiguous. Select the equation again.');
    return matches[0];
  }

  return {
    async readSelection() {
      return Word.run(async (ctx) => {
        const pictures = await selectedPictures(ctx);
        return pictures.length === 1 ? describeWordPicture(pictures[0]) : null;
      });
    },
    async insert(msg) {
      // Complete image rendering before changing the document; a rendering failure preserves it.
      const png = await renderPng(msg.svg);
      return Word.run(async (ctx) => {
        const target = msg.targetKey ? await findPicture(ctx, msg.targetKey) : null;
        const near = !target && msg.nearKey ? await findPicture(ctx, msg.nearKey) : null;
        const id = (target && describeWordPicture(target)?._id) || newId();
        const ooxml = buildWordOoxml(msg, png, id);
        let range;
        if (target) range = target.getRange();
        else if (near) range = near.getRange('End');
        else {
          range = ctx.document.getSelection();
          // Insert after any selected content; never overwrite text or an unrelated picture.
          range = range.getRange('End');
        }
        const inserted = range.insertOoxml(ooxml, 'Replace');
        await ctx.sync();
        // Caret movement is cosmetic; never report a committed insertion as failed.
        try { inserted.getRange('End').select(); await ctx.sync(); } catch { /* host may keep selection */ }
        return { replacedKey: msg.targetKey || null, equation: {
          key: 'word:id:' + id, latex: msg.latex, fontSize: msg.fontSize, color: msg.color, legacy: false,
        } };
      });
    },
  };
}
