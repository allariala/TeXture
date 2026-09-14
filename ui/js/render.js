// MathJax rendering: live preview, small cached renders (palette/autocomplete) and SVG export for Office.

export const SLOT = '□'; // □ — visible placeholder for empty template slots (MathType-style)

let readyPromise = null;

export function mathjaxReady() {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve) => {
    const check = () => {
      const mj = window.MathJax;
      if (mj && mj.startup && mj.startup.promise && mj.tex2svgPromise) {
        mj.startup.promise.then(() => {
          // With typeset:false MathJax never injects its CSS; without it the (visually hidden)
          // assistive MathML would render as a second copy of the equation.
          if (mj.svgStylesheet) document.head.appendChild(mj.svgStylesheet());
          resolve();
        });
      } else setTimeout(check, 30);
    };
    check();
  });
  return readyPromise;
}

// MathJax is not re-entrant: run conversions one at a time.
let chain = Promise.resolve();
function convert(tex, display = true) {
  const job = chain.then(async () => {
    await mathjaxReady();
    window.MathJax.texReset();
    return window.MathJax.tex2svgPromise(tex, { display });
  });
  chain = job.catch(() => {});
  return job;
}

/** Text the user typed → TeX MathJax should see (math delimiters and empty slots removed). */
export function toRenderable(tex, { keepSlots = false } = {}) {
  let t = tex.replace(/\$\$/g, '').replace(/^\s*\\\[|\\\]\s*$/g, '');
  t = keepSlots ? t.replace(/□/g, '{\\color{#9aa0a6}\\square}') : t.replace(/□/g, '');
  return t;
}

function errorOf(node) {
  const err = node.querySelector('[data-mjx-error]');
  if (err) return err.getAttribute('data-mjx-error') || 'LaTeX error';
  const merror = node.querySelector('[data-mml-node="merror"]');
  return merror ? (merror.getAttribute('title') || 'LaTeX error') : null;
}

let previewToken = 0;

/**
 * Renders the live preview. Returns {error} (null when fine). While there is an error the last
 * good render stays visible (dimmed), so the preview does not flicker while typing.
 */
export async function renderPreview(tex, container, { color = '#000000', dark = false, minPt = 14, maxPt = 24 } = {}) {
  const token = ++previewToken;
  const source = toRenderable(tex, { keepSlots: true });
  if (!source.trim()) {
    container.innerHTML = '';
    container.classList.remove('stale');
    return { error: null, empty: true };
  }
  let node;
  try {
    node = await convert(source);
  } catch (e) {
    if (token === previewToken) container.classList.add('stale');
    return { error: String(e.message || e) };
  }
  if (token !== previewToken) return { stale: true };

  const error = errorOf(node);
  if (error) {
    container.classList.add('stale');
    return { error };
  }
  // Black is shown as white on a dark preview background; the inserted equation keeps the real colour.
  const shown = dark && /^#?(000|000000)$/i.test(color.replace('#', '')) ? '#ffffff' : color;
  container.style.color = shown;
  container.style.fontSize = maxPt + 'pt';
  container.replaceChildren(node);
  container.classList.remove('stale');

  // Shrink wide equations to fit the pane, but never below minPt: beyond that the preview scrolls
  // horizontally. The SVG is measured (the mjx-container is a block element as wide as the pane).
  const available = container.parentElement.clientWidth - 32;
  const svg = node.querySelector('svg');
  const width = svg ? svg.getBoundingClientRect().width : 0;
  if (available > 0 && width > available) {
    container.style.fontSize = Math.max(minPt, Math.floor(maxPt * available / width * 2) / 2) + 'pt';
  }
  return { error: null };
}

const smallCache = new Map();

/** Small render for palette buttons / autocomplete rows (cached). Slots are drawn as grey boxes. */
export function renderSmall(tex) {
  if (smallCache.has(tex)) return smallCache.get(tex).then((n) => n && n.cloneNode(true));
  const source = tex.replace(/\$\d/g, SLOT).replace(/□/g, '{\\color{#9aa0a6}\\square}');
  const p = convert(source, false)
    .then((node) => (errorOf(node) ? null : node.querySelector('svg')))
    .catch(() => null);
  smallCache.set(tex, p);
  return p.then((n) => n && n.cloneNode(true));
}

/**
 * Builds the SVG inserted into Office. Sized so 1em equals the requested point size, thin rules are
 * thickened (PowerPoint drops hairlines when rasterising) and currentColor is baked in.
 * The SVG is otherwise untouched (no background/hit box) to keep it a clean, reusable vector.
 */
export async function exportSvg(tex, fontSizePt, color) {
  const source = toRenderable(tex);
  if (!source.trim()) return { error: 'empty' };
  const node = await convert(source);
  const error = errorOf(node);
  if (error) return { error };
  const original = node.querySelector('svg');
  if (!original) return { error: 'render failed' };
  const svg = original.cloneNode(true);

  const viewBox = (original.getAttribute('viewBox') || '').split(/\s+/).map(parseFloat);
  if (viewBox.length === 4) {
    const MATHJAX_EX = 430.554;
    const PT_TO_PX = 1.333;
    const unitsToPx = ((fontSizePt * (MATHJAX_EX / 1000)) * PT_TO_PX) / MATHJAX_EX;
    svg.setAttribute('width', (viewBox[2] * unitsToPx).toFixed(4) + 'px');
    svg.setAttribute('height', (viewBox[3] * unitsToPx).toFixed(4) + 'px');
  }

  const MIN = 60; // minimum rule thickness in MathJax units
  svg.querySelectorAll('rect, line, polyline, path').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'rect') {
      const h = parseFloat(el.getAttribute('height') || '0');
      const w = parseFloat(el.getAttribute('width') || '0');
      const thinH = h > 0 && h < MIN;
      const thinW = w > 0 && w < MIN;
      if (!thinH && !thinW) return;
      el.setAttribute('shape-rendering', 'crispEdges');
      if (thinH) {
        el.setAttribute('y', String(parseFloat(el.getAttribute('y') || '0') - (MIN - h) / 2));
        el.setAttribute('height', String(MIN));
      }
      if (thinW) {
        el.setAttribute('x', String(parseFloat(el.getAttribute('x') || '0') - (MIN - w) / 2));
        el.setAttribute('width', String(MIN));
      }
    } else if (tag === 'line' || tag === 'polyline' || (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none')) {
      el.setAttribute('shape-rendering', 'crispEdges');
      if (parseFloat(el.getAttribute('stroke-width') || '0') < MIN) el.setAttribute('stroke-width', String(MIN));
    }
  });

  svg.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
  });

  return { svg: svg.outerHTML.replace(/currentColor/g, color), error: null };
}
