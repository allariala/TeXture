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

const COUNTERS = ['Chapter', 'Section', 'EqGlobal', 'EqCh', 'EqSec'];
export function isNumberingControl(code) {
  return /^\s*SEQ\s+(Chapter|Section|EqGlobal|EqCh|EqSec)(?=\s|$)/i.test(code) && /\\h(?=\s|$)/i.test(code);
}

function seq(code) {
  const hidden = /\\h(?=\s|$)/i.test(code);
  return `<w:fldSimple w:instr=" ${xml(code)} " w:dirty="true"><w:r>${hidden ? '<w:rPr><w:vanish/></w:rPr>' : ''}<w:t>${hidden ? '' : '0'}</w:t></w:r></w:fldSimple>`;
}

export function numberingRuns(style) {
  const field = (name, suffix) => seq(`SEQ ${name} ${suffix}`);
  const dot = '<w:r><w:t>.</w:t></w:r>';
  if (style === 1) return field('EqGlobal', '\\* ARABIC');
  if (style === 2) return field('Chapter', '\\c') + dot + field('EqCh', '\\* ARABIC');
  if (style === 3) return field('Chapter', '\\c') + dot + field('Section', '\\c') + dot + field('EqSec', '\\* ARABIC');
  return '';
}

export function numberingControlCodes(action, resetRequested = false) {
  if (action === 'chapter') return [`SEQ Chapter ${resetRequested ? '\\r 1' : '\\n'} \\h`,
    'SEQ Section \\r 0 \\h', 'SEQ EqCh \\r 0 \\h', 'SEQ EqSec \\r 0 \\h'];
  if (action === 'section') return ['SEQ Section \\n \\h', 'SEQ EqSec \\r 0 \\h'];
  if (action === 'reset') return COUNTERS.map((name) => `SEQ ${name} \\r 0 \\h`);
  throw new Error('Unknown numbering action.');
}

export function buildNumberingControlOoxml(action, resetRequested = false) {
  const runs = numberingControlCodes(action, resetRequested).map(seq).join('');
  return `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage"><pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships></pkg:xmlData></pkg:part><pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${runs}</w:p></w:body></w:document></pkg:xmlData></pkg:part></pkg:package>`;
}

// Selection OOXML includes section properties; use twips, exactly as Word tab stops do.
export function wordTextWidth(ooxml) {
  const tag = (name) => String(ooxml).match(new RegExp('<(?:[\\w.-]+:)?' + name + '\\b[^>]*>', 'i'))?.[0] || '';
  const value = (text, name) => Number(text.match(new RegExp('\\s(?:[\\w.-]+:)?' + name + '=["\'](\\d+)["\']', 'i'))?.[1]);
  const width = value(tag('pgSz'), 'w');
  const margins = tag('pgMar');
  const left = value(margins, 'left'), right = value(margins, 'right');
  const textWidth = width - left - right;
  if (!(width > 0 && Number.isFinite(left) && Number.isFinite(right) && textWidth > 0))
    throw new Error('Could not read the page width for equation numbering.');
  return textWidth;
}

export function tabStopsToClear(ooxml) {
  const positions = new Set();
  for (const tag of String(ooxml).match(/<(?:[\w.-]+:)?tab\b[^>]*>/gi) || []) {
    const position = tag.match(/\s(?:[\w.-]+:)?pos=["'](\d+)["']/i)?.[1];
    if (position) positions.add(Number(position));
  }
  return [...positions].sort((a, b) => a - b);
}

export function buildWordOoxml(msg, pngBase64, id, { display = false, widthTwips = 0, style = 0, clearTabs = [] } = {}) {
  const { width, height } = svgDimensions(msg.svg);
  const cx = Math.round(width * 9525), cy = Math.round(height * 9525);
  const title = TITLE_PREFIX + JSON.stringify({ v: 2, size: msg.fontSize, color: msg.color || '#000000',
    bw: width * 72 / 96, bh: height * 72 / 96, id });
  const props = `name="TeXture equation" descr="${xml(LEGACY_PREFIX + msg.latex)}" title="${xml(title)}"`;
  if (display && !(widthTwips > 0)) throw new Error('Invalid equation tab-stop width.');
  const neutralRun = '<w:rPr><w:position w:val="0"/><w:vertAlign w:val="baseline"/></w:rPr>';
  const clearedTabs = clearTabs.filter((pos) => Number.isFinite(pos) && pos >= 0)
    .map((pos) => `<w:tab w:val="clear" w:pos="${Math.round(pos)}"/>`).join('');
  const paragraphStart = display ? `<w:pPr><w:tabs>${clearedTabs}<w:tab w:val="center" w:pos="${Math.round(widthTwips / 2)}"/><w:tab w:val="right" w:pos="${Math.round(widthTwips)}"/></w:tabs><w:jc w:val="left"/><w:textAlignment w:val="center"/></w:pPr><w:r>${neutralRun}<w:tab/></w:r>` : '';
  const number = display && style > 0 ? '<w:r><w:tab/><w:t>(</w:t></w:r>' + numberingRuns(style) + '<w:r><w:t>)</w:t></w:r>' : '';
  // Match Windows FinishInline. Only the SVG character gets a baseline offset.
  const baseline = msg.svg.match(/vertical-align:\s*(-?[\d.]+)ex/i);
  const position = !display && baseline ? Math.round(Number(baseline[1]) * msg.fontSize * 0.430554) * 2 : 0;
  const pictureRun = `<w:rPr><w:position w:val="${position}"/><w:vertAlign w:val="baseline"/></w:rPr>`;
  const nextParagraph = display ? `<w:p><w:pPr><w:jc w:val="left"/><w:textAlignment w:val="baseline"/>${neutralRun}</w:pPr><w:r>${neutralRun}<w:t/></w:r></w:p>` : '';
  return `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships></pkg:xmlData></pkg:part>
<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main"><w:body><w:p>${paragraphStart}<w:r>${pictureRun}<w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" ${props}/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" ${props}/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdPng"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip r:embed="rIdSvg"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline>
</w:drawing></w:r>${number}</w:p>${nextParagraph}</w:body></w:document></pkg:xmlData></pkg:part>
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
  let resetRequested = false;

  async function updateFields(ctx) {
    const fields = ctx.document.body.fields;
    fields.load('items/locked');
    await ctx.sync();
    for (const field of fields.items) if (!field.locked) field.updateResult();
    await ctx.sync();
  }

  async function placeCaret(ctx, inserted) {
    // A collapsed text range, never the SVG's selected range, receives typing formatting.
    const after = inserted.getRange('End');
    after.select();
    after.font.subscript = false;
    after.font.superscript = false;
    if (globalThis.Office?.context?.requirements?.isSetSupported('WordApiDesktop', '1.3')) after.font.position = 0;
    await ctx.sync();
  }

  async function displayLayout(ctx, range) {
    const paragraph = range.paragraphs.getFirst();
    const relation = range.compareLocationWith(paragraph.getRange('Start'));
    const cell = range.parentTableCellOrNullObject;
    cell.load('value');
    await ctx.sync();
    if (!cell.isNullObject || relation.value !== 'Equal') return null;
    const content = range.getOoxml();
    await ctx.sync();
    // Do not guess A4/Letter: incorrect tabs would silently misalign the number.
    try { return { display: true, widthTwips: wordTextWidth(content.value), clearTabs: tabStopsToClear(content.value) }; }
    catch {
      // Some Word versions omit section metadata from an empty selection. Locate the owning section.
      const sections = ctx.document.sections;
      sections.load('items');
      await ctx.sync();
      const relations = sections.items.map((section) => section.body.getRange().compareLocationWith(range));
      await ctx.sync();
      const index = relations.findIndex((r) => ['Contains', 'Equal', 'ContainsStart', 'ContainsEnd'].includes(r.value));
      if (index < 0) throw new Error('Could not locate the equation section.');
      const sectionXml = sections.items[index].body.getOoxml();
      await ctx.sync();
      return { display: true, widthTwips: wordTextWidth(sectionXml.value),
        clearTabs: tabStopsToClear(content.value + sectionXml.value) };
    }
  }
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
    async numbering(action) {
      if (!['chapter', 'section', 'update', 'reset'].includes(action)) throw new Error('Unknown numbering action.');
      return Word.run(async (ctx) => {
        if (action === 'update') { await updateFields(ctx); return; }
        if (action === 'reset') {
          const fields = ctx.document.body.fields;
          fields.load('items/code');
          await ctx.sync();
          // Keep visible equation fields and unrelated SEQ fields, matching the Windows reset.
          for (let i = fields.items.length - 1; i >= 0; i--)
            if (isNumberingControl(fields.items[i].code)) fields.items[i].delete();
          ctx.document.body.getRange('Start').insertOoxml(buildNumberingControlOoxml('reset'), 'Replace');
          await ctx.sync();
          resetRequested = true;
        } else {
          const range = ctx.document.getSelection().getRange('End');
          const inserted = range.insertOoxml(buildNumberingControlOoxml(action, resetRequested), 'Replace');
          await ctx.sync();
          if (action === 'chapter') resetRequested = false;
          try { await placeCaret(ctx, inserted); } catch { /* keep the document edit */ }
        }
        await updateFields(ctx);
      });
    },
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
        let range;
        if (target) range = target.getRange();
        else if (near) range = near.getRange('End');
        else {
          range = ctx.document.getSelection();
          // Insert after any selected content; never overwrite text or an unrelated picture.
          range = range.getRange('End');
        }
        // Only new display equations get a number. Updating an image preserves adjacent fields.
        const layout = !target && Number.isInteger(msg.numberingStyle) ? await displayLayout(ctx, range) : null;
        const style = [0, 1, 2, 3].includes(msg.numberingStyle) ? msg.numberingStyle : 0;
        const ooxml = buildWordOoxml(msg, png, id, { ...layout, style });
        const inserted = range.insertOoxml(ooxml, 'Replace');
        await ctx.sync();
        let noticeKey = null;
        if (layout && style > 0) {
          try { await updateFields(ctx); } catch { noticeKey = 'numbering.updateFailed'; }
        }
        // Caret movement is cosmetic; never report a committed insertion as failed.
        try { await placeCaret(ctx, inserted); } catch { noticeKey ||= 'word.caretFailed'; }
        return { replacedKey: msg.targetKey || null, noticeKey, equation: {
          key: 'word:id:' + id, latex: msg.latex, fontSize: msg.fontSize, color: msg.color, legacy: false,
        } };
      });
    },
  };
}
