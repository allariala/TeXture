// Host implementation for the Office web add-in (PowerPoint for Mac / web). It speaks the same message
// protocol as the Windows add-in (see TeXtureRuntime.cs), so the editor UI is identical; features that a
// web add-in cannot provide (screen capture, Office hotkeys, moving focus back to the slide) are reported
// through init.capabilities and hidden by the UI.

const OFFICE_JS = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';
const LEGACY_PREFIX = 'PLX:';
const TAG = {
  latex: 'TEXTURE_LATEX', version: 'TEXTURE_VERSION', size: 'TEXTURE_FONTSIZE', color: 'TEXTURE_COLOR',
  bw: 'TEXTURE_BASEW', bh: 'TEXTURE_BASEH', id: 'TEXTURE_ID',
};
const LEGACY_TAGS = ['TEXTURE_CODE', 'POWERLATEX_CODE']; // PowerPoint upper-cases tag names

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('office.js could not be loaded'));
    document.head.appendChild(s);
  });
}

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('texture.' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem('texture.' + key);
      else localStorage.setItem('texture.' + key, JSON.stringify(value));
    } catch { /* storage unavailable */ }
  },
};

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null) delete target[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}

const defaults = () => ({
  theme: 'auto',
  afterInsert: 'editor',
  hosts: { ppt: { fontSize: 18, color: '#000000' } },
});

/** Resolves with a host object ({receive}) or rejects when not running inside Office. */
export async function createOfficeHost(dispatch) {
  await loadScript(OFFICE_JS);
  const info = await Office.onReady();
  if (!info || info.host !== Office.HostType.PowerPoint) throw new Error('not running in PowerPoint');

  const send = (msg) => setTimeout(() => dispatch(msg), 0);
  let inserting = false;

  const isDark = () => {
    const hex = Office.context.officeTheme && Office.context.officeTheme.bodyBackgroundColor;
    if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return matchMedia('(prefers-color-scheme: dark)').matches;
    const n = parseInt(hex.replace('#', ''), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum < 0.5;
  };

  // ------------------------------------------------------------------ equation metadata
  async function describe(ctx, shape, slideId) {
    shape.tags.load('items/key,items/value');
    await ctx.sync();
    const tag = (k) => { const t = shape.tags.items.find((x) => x.key === k); return t ? t.value : ''; };
    let latex = tag(TAG.latex);
    const v2 = !!latex;
    if (!latex && (shape.altTextDescription || '').startsWith(LEGACY_PREFIX)) latex = shape.altTextDescription.slice(4);
    if (!latex) for (const k of LEGACY_TAGS) { latex = tag(k); if (latex) break; }
    if (!latex && (shape.name || '').startsWith(LEGACY_PREFIX)) latex = shape.name.slice(4);
    if (!latex) return null;
    let fontSize = null;
    let color = null;
    if (v2) {
      const size = parseFloat(tag(TAG.size));
      const bw = parseFloat(tag(TAG.bw));
      if (size > 0) fontSize = bw > 0 && Math.abs(shape.width / bw - 1) > 0.01 ? Math.round(size * shape.width / bw * 2) / 2 : size;
      color = tag(TAG.color) || null;
    }
    return { key: slideId + '|' + shape.id, latex, fontSize, color, legacy: !v2 || fontSize == null, _id: tag(TAG.id) };
  }

  async function readSelection() {
    return PowerPoint.run(async (ctx) => {
      const shapes = ctx.presentation.getSelectedShapes();
      const slides = ctx.presentation.getSelectedSlides();
      shapes.load('items/id,items/name,items/altTextDescription,items/width');
      slides.load('items/id');
      await ctx.sync();
      if (shapes.items.length !== 1 || slides.items.length === 0) return null;
      return describe(ctx, shapes.items[0], slides.items[0].id);
    });
  }

  async function pushSelection() {
    if (inserting) return;
    try {
      const eq = await readSelection();
      if (eq) delete eq._id;
      send({ type: 'selection', equation: eq, note: null });
    } catch {
      send({ type: 'selection', equation: null, note: null });
    }
  }

  function findShape(ctx, key) {
    const [slideId, shapeId] = String(key).split('|');
    const shape = ctx.presentation.slides.getItem(slideId).shapes.getItemOrNullObject(shapeId);
    shape.load('id,left,top,width,height,name');
    return shape;
  }

  // ------------------------------------------------------------------ insert / replace
  function setSelectedSvg(svg) {
    return new Promise((resolve, reject) => {
      Office.context.document.setSelectedDataAsync(svg, { coercionType: Office.CoercionType.XmlSvg }, (r) =>
        (r.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(new Error(r.error ? r.error.message : 'insert failed'))));
    });
  }

  async function insert(msg) {
    inserting = true;
    try {
      // 1. Remember where the equation to replace / to insert next to is, and the shapes already present.
      const before = await PowerPoint.run(async (ctx) => {
        const slide = ctx.presentation.getSelectedSlides().getItemAt(0);
        slide.load('id');
        slide.shapes.load('items/id');
        const target = msg.targetKey ? findShape(ctx, msg.targetKey) : null;
        const near = msg.nearKey ? findShape(ctx, msg.nearKey) : null;
        await ctx.sync();
        const pick = (s) => (s && !s.isNullObject ? { left: s.left, top: s.top, height: s.height, name: s.name } : null);
        let oldId = '';
        if (target && !target.isNullObject) {
          const d = await describe(ctx, target, slide.id);
          oldId = d ? d._id : '';
        }
        return { slideId: slide.id, ids: slide.shapes.items.map((s) => s.id), target: pick(target), near: pick(near), oldId };
      });

      // 2. Insert the SVG (the only insertion path for vector images in a web add-in).
      await setSelectedSvg(msg.svg);

      // 3. Tag the new shape, put it in place and remove the old one.
      const equation = await PowerPoint.run(async (ctx) => {
        const slide = ctx.presentation.slides.getItem(before.slideId);
        slide.shapes.load('items/id,items/width,items/height');
        await ctx.sync();
        const shape = slide.shapes.items.find((s) => !before.ids.includes(s.id));
        if (!shape) throw new Error('The inserted equation could not be found.');
        const id = before.oldId || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : String(Date.now()));
        const tags = {
          [TAG.latex]: msg.latex, [TAG.version]: '2', [TAG.size]: String(msg.fontSize), [TAG.color]: msg.color || '#000000',
          [TAG.bw]: String(shape.width), [TAG.bh]: String(shape.height), [TAG.id]: id,
        };
        for (const [k, v] of Object.entries(tags)) shape.tags.add(k, v);
        shape.altTextDescription = LEGACY_PREFIX + msg.latex;
        if (before.target) {
          shape.left = before.target.left;
          shape.top = before.target.top;
          if (before.target.name) shape.name = before.target.name;
          slide.shapes.getItem(msg.targetKey.split('|')[1]).delete();
        } else if (before.near) {
          shape.left = before.near.left;
          shape.top = before.near.top + before.near.height + 12;
        }
        await ctx.sync();
        try { slide.setSelectedShapes([shape.id]); await ctx.sync(); } catch { /* PowerPointApi < 1.5 */ }
        return { key: before.slideId + '|' + shape.id, latex: msg.latex, fontSize: msg.fontSize, color: msg.color, legacy: false };
      });

      send({ type: 'inserted', requestId: msg.requestId, replacedKey: before.target ? msg.targetKey : null, equation, notice: null });
    } catch (err) {
      send({ type: 'error', requestId: msg.requestId, message: 'Insert failed: ' + (err && err.message ? err.message : err) });
    } finally {
      inserting = false;
    }
  }

  // ------------------------------------------------------------------ snippets import / export
  function exportSnippets(list) {
    const json = JSON.stringify({ format: 'texture-snippets', version: 1, exported: new Date().toISOString(), snippets: list }, null, 2);
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'texture-snippets.json';
      a.click();
    } catch { /* downloads can be blocked inside Office */ }
    if (navigator.clipboard) navigator.clipboard.writeText(json).catch(() => {});
  }

  function importSnippets() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try {
        const parsed = JSON.parse(await input.files[0].text());
        const list = Array.isArray(parsed) ? parsed : parsed.snippets;
        if (!Array.isArray(list)) throw new Error('no snippet list');
        store.set('snippets', list);
        send({ type: 'snippets', snippets: list });
      } catch (err) {
        send({ type: 'error', message: 'Import failed: ' + err.message });
      }
    };
    input.click();
  }

  // ------------------------------------------------------------------ protocol
  Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, () => pushSelection());

  return {
    receive(msg) {
      switch (msg.type) {
        case 'ready':
          send({
            type: 'init', host: 'ppt', surface: 'pane', version: '2.0.0',
            settings: deepMerge(defaults(), store.get('settings', {})),
            state: store.get('state.ppt', {}),
            snippets: store.get('snippets', null),
            dark: isDark(),
            server: 'Offline',
            capabilities: { capture: false, hotkeys: false, focusDocument: false },
          });
          pushSelection();
          break;
        case 'insert': insert(msg); break;
        case 'settings': store.set('settings', deepMerge(store.get('settings', {}), msg.patch)); break;
        case 'state': store.set('state.ppt', deepMerge(store.get('state.ppt', {}), msg.patch)); break;
        case 'snippets.save': store.set('snippets', msg.snippets); break;
        case 'snippets.export': exportSnippets(msg.snippets); break;
        case 'snippets.import': importSnippets(); break;
        default: break; // escape / hotkey / capture: not available in a web add-in
      }
    },
  };
}
