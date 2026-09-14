// MathType-style keyboard shortcuts (single strokes like Ctrl+F and two-stroke chords like Ctrl+G, A),
// built from catalog.json. Keys are matched by physical key (KeyboardEvent.code), so shortcuts keep
// working while the Korean IME is active. While a chord is pending a floating hint palette shows every
// option, which doubles as a quick-insert palette (click works too).

import { renderSmall } from './render.js';
import { t } from './i18n.js';

const SYMBOL_KEYS = {
  ',': ['Comma', false], '<': ['Comma', true], '.': ['Period', false], '>': ['Period', true],
  '/': ['Slash', false], '?': ['Slash', true], ';': ['Semicolon', false], ':': ['Semicolon', true],
  "'": ['Quote', false], '"': ['Quote', true], '[': ['BracketLeft', false], '{': ['BracketLeft', true],
  ']': ['BracketRight', false], '}': ['BracketRight', true], '\\': ['Backslash', false], '|': ['Backslash', true],
  '-': ['Minus', false], '_': ['Minus', true], '=': ['Equal', false], '+': ['Equal', true],
  '`': ['Backquote', false], '~': ['Backquote', true],
  '!': ['Digit1', true], '@': ['Digit2', true], '#': ['Digit3', true], '$': ['Digit4', true], '%': ['Digit5', true],
  '^': ['Digit6', true], '&': ['Digit7', true], '*': ['Digit8', true], '(': ['Digit9', true], ')': ['Digit0', true],
};
const NAMED_KEYS = {
  Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown',
  Tab: 'Tab', Enter: 'Enter', Space: 'Space', Esc: 'Escape',
};
const PREFIX_LABELS = {
  'C:KeyG': 'Greek', 'C:KeyK': 'Symbols', 'CS:KeyK': 'Operators & logic', 'C:KeyT': 'Templates',
  'CS:KeyI': 'Integrals', 'CS:Digit6': 'Over / under bars', 'C:Digit6': 'Embellishments',
  'C:Period': 'Ellipses', 'C:KeyD': 'Blackboard bold', 'C:KeyB': 'Bold',
};

/** Parses one stroke such as "Ctrl+Shift+K", "Alt+~", "," or "Shift+Right". */
export function parseStroke(spec) {
  let rest = spec.trim();
  let ctrl = false, alt = false, shift = false;
  for (;;) {
    const m = /^(Ctrl|Alt|Shift)\+(.+)$/.exec(rest);
    if (!m) break;
    if (m[1] === 'Ctrl') ctrl = true; else if (m[1] === 'Alt') alt = true; else shift = true;
    rest = m[2];
  }
  let code = null;
  if (/^[A-Za-z]$/.test(rest)) code = 'Key' + rest.toUpperCase();
  else if (/^[0-9]$/.test(rest)) code = 'Digit' + rest;
  else if (SYMBOL_KEYS[rest]) { code = SYMBOL_KEYS[rest][0]; shift = shift || SYMBOL_KEYS[rest][1]; }
  else if (NAMED_KEYS[rest]) code = NAMED_KEYS[rest];
  if (!code) return null;
  return { ctrl, alt, shift, code };
}

export const comboOf = (s) => (s.ctrl ? 'C' : '') + (s.alt ? 'A' : '') + (s.shift ? 'S' : '') + ':' + s.code;

export function comboFromEvent(e, { ignoreCtrl = false } = {}) {
  if (!e.code || /^(Control|Shift|Alt|Meta)/.test(e.code)) return null;
  let code = e.code;
  if (/^Numpad\d$/.test(code)) code = 'Digit' + code.slice(6);
  return comboOf({ ctrl: e.ctrlKey && !ignoreCtrl, alt: e.altKey, shift: e.shiftKey, code });
}

/** "Shift+Right" → "⇧→" for the hint palette. */
export function prettyStroke(spec) {
  return spec.trim()
    .replace(/Shift\+/g, '⇧').replace(/Alt\+/g, 'Alt ').replace(/Ctrl\+/g, 'Ctrl ')
    .replace(/\bLeft\b/, '←').replace(/\bRight\b/, '→').replace(/\bUp\b/, '↑').replace(/\bDown\b/, '↓')
    .replace(/\bEnter\b/, '↵').replace(/\bTab\b/, '⇥').replace(/\bSpace\b/, '␣');
}

export class Keymap {
  constructor(catalog) {
    this.singles = new Map();   // combo → item
    this.prefixes = new Map();  // prefix combo → { label, spec, entries: [{combo, spec, item}] , map }
    this.oneshots = new Map();  // prefix combo → { wrap, upper, name, spec }

    for (const item of catalog.items || []) {
      if (!item.keys) continue;
      for (const alt of item.keys.split(' or ')) {
        const strokes = alt.split(', ');
        const first = parseStroke(strokes[0]);
        if (!first) continue;
        const firstCombo = comboOf(first);
        if (strokes.length === 1) { this.singles.set(firstCombo, item); continue; }
        const second = parseStroke(strokes[1]);
        if (!second) continue;
        let prefix = this.prefixes.get(firstCombo);
        if (!prefix) {
          prefix = { label: PREFIX_LABELS[firstCombo] || strokes[0], spec: strokes[0].trim(), entries: [], map: new Map() };
          this.prefixes.set(firstCombo, prefix);
        }
        const combo = comboOf(second);
        if (!prefix.map.has(combo)) {
          prefix.map.set(combo, item);
          prefix.entries.push({ combo, spec: strokes[1], item });
        }
      }
    }
    for (const o of catalog.oneshots || []) {
      const s = parseStroke(o.keys);
      if (s) this.oneshots.set(comboOf(s), { ...o, spec: o.keys, label: PREFIX_LABELS[comboOf(s)] || o.name });
    }
  }
}

export const MATRIX_COMBO = 'C:KeyM';

/** \begin{bmatrix} with rows×cols slots (first slot selected), one row per line. */
export function matrixTemplate(rows, cols) {
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < cols; c++) cells.push(r === 0 && c === 0 ? '$0' : '\u25A1');
    lines.push('  ' + cells.join(' & '));
  }
  return '\\begin{bmatrix}\n' + lines.join(' \\\\\n') + '\n\\end{bmatrix}';
}

export class ChordController {
  constructor({ keymap, popup, anchor, onApply, onLiteral, labels = {} }) {
    this.keymap = keymap;
    this.labels = labels;
    this.popup = popup;
    this.anchor = anchor;       // () => {top, height} caret rect relative to the editor
    this.onApply = onApply;     // (item) => void
    this.onLiteral = onLiteral; // (text) => void (one-shot styles)
    this.pending = null;
    popup.addEventListener('mousedown', (e) => e.preventDefault()); // keep the editor's selection
  }

  get isOpen() { return !!this.pending; }

  /** Returns true when the event was consumed. */
  handleKeydown(e) {
    if (this.pending) return this.handleSecond(e);
    const combo = comboFromEvent(e);
    if (!combo) return false;
    if (combo === MATRIX_COMBO) { this.openMatrix(); return true; }
    if (this.keymap.prefixes.has(combo) || this.keymap.oneshots.has(combo)) {
      this.open(combo);
      return true;
    }
    const item = this.keymap.singles.get(combo);
    if (item) { this.onApply(item); return true; }
    return false;
  }

  handleSecond(e) {
    if (/^(Control|Shift|Alt|Meta)/.test(e.code)) return true; // still composing the chord
    if (e.key === 'Escape') { this.close(); return true; }
    if (this.pending === MATRIX_COMBO) return this.handleMatrixKey(e);
    const prefixCombo = this.pending;
    // Holding Ctrl for the second key is forgiven (Ctrl+G, Ctrl+A works like Ctrl+G, A).
    const combo = comboFromEvent(e, { ignoreCtrl: true });
    const prefix = this.keymap.prefixes.get(prefixCombo);
    const item = prefix && prefix.map.get(combo);
    const oneshot = this.keymap.oneshots.get(prefixCombo);
    this.close();
    if (item) { this.onApply(item); return true; }
    if (oneshot && e.key && e.key.length === 1 && /\S/.test(e.key)) {
      const ch = oneshot.upper ? e.key.toUpperCase() : e.key;
      this.onLiteral(oneshot.wrap.replace('#', ch));
      return true;
    }
    return true; // unknown second key: swallow, like MathType
  }

  open(prefixCombo) {
    this.pending = prefixCombo;
    const prefix = this.keymap.prefixes.get(prefixCombo);
    const oneshot = this.keymap.oneshots.get(prefixCombo);
    const key = 'prefix.' + prefixCombo;
    const title = t(key) !== key ? t(key) : (prefix ? prefix.label : oneshot.label);
    const spec = prefix ? prefix.spec : oneshot.spec;

    const head = document.createElement('div');
    head.className = 'chord-head';
    head.innerHTML = `<b></b><span></span>`;
    head.querySelector('b').textContent = `${spec} · ${title}`;
    head.querySelector('span').textContent = oneshot && !prefix ? t('chord.oneshot', { name: title }) : t('chord.hint');
    const grid = document.createElement('div');
    grid.className = 'chord-grid';

    for (const entry of prefix ? prefix.entries : []) {
      const cell = document.createElement('div');
      cell.className = 'chord-key';
      cell.title = `${entry.item.name || ''}\n${entry.item.tex}`;
      const g = document.createElement('div');
      g.className = 'g';
      if (entry.item.glyph) g.textContent = entry.item.glyph;
      else renderSmall(entry.item.tex).then((svg) => { if (svg) g.replaceChildren(svg); else g.textContent = entry.item.tex; });
      const k = document.createElement('div');
      k.className = 'kk';
      k.textContent = prettyStroke(entry.spec);
      cell.append(g, k);
      cell.addEventListener('click', () => { this.close(); this.onApply(entry.item); });
      grid.appendChild(cell);
    }
    this.popup.replaceChildren(head, grid);
    this.popup.hidden = false;
    this.position();
  }

  // ---- Ctrl+M: matrix size picker (digits: rows then columns, e.g. 3 3 → 3×3; or click a cell)
  openMatrix() {
    this.pending = MATRIX_COMBO;
    this.matrixRows = 0;
    const MAX = 6;
    const head = document.createElement('div');
    head.className = 'chord-head';
    head.innerHTML = '<b></b><span></span>';
    head.querySelector('b').textContent = 'Ctrl+M · ' + t('chord.matrix');
    this.matrixHint = head.querySelector('span');
    this.matrixHint.textContent = t('chord.matrixHint');
    const grid = document.createElement('div');
    grid.className = 'matrix-grid';
    const cells = [];
    const paint = (r, c) => cells.forEach((cell) => cell.classList.toggle('on', cell._r <= r && cell._c <= c));
    for (let r = 1; r <= MAX; r++) {
      for (let c = 1; c <= MAX; c++) {
        const cell = document.createElement('div');
        cell.className = 'mcell';
        cell._r = r; cell._c = c;
        cell.addEventListener('mouseenter', () => { paint(r, c); this.matrixHint.textContent = `${r} × ${c}`; });
        cell.addEventListener('click', () => this.applyMatrix(r, c));
        cells.push(cell);
        grid.appendChild(cell);
      }
    }
    this.popup.replaceChildren(head, grid);
    this.popup.hidden = false;
    this.position();
  }

  handleMatrixKey(e) {
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (!digit) { this.close(); return true; }
    const n = parseInt(digit[1], 10);
    if (!this.matrixRows) {
      this.matrixRows = n;
      this.matrixHint.textContent = `${n} × ?`;
      return true;
    }
    this.applyMatrix(this.matrixRows, n);
    return true;
  }

  applyMatrix(rows, cols) {
    this.close();
    this.onApply({ tex: matrixTemplate(rows, cols), mode: 'wrap', name: `${rows}×${cols} matrix` });
  }

  position() {
    const caret = this.anchor();
    const wrap = this.popup.parentElement;
    const below = caret.top + caret.height + 6;
    const height = this.popup.offsetHeight;
    const top = below + height > wrap.clientHeight && caret.top - height - 6 > 0 ? caret.top - height - 6 : below;
    this.popup.style.top = Math.max(4, Math.min(top, wrap.clientHeight - 40)) + 'px';
  }

  close() {
    this.pending = null;
    this.popup.hidden = true;
  }
}

/** Parses a host hotkey setting ("Alt+Shift+E") for matching inside the editor. */
export function parseHotkey(text) {
  if (!text) return null;
  const parts = text.split('+').map((p) => p.trim());
  const key = parts.pop();
  const s = parseStroke([...parts, key].join('+'));
  return s ? comboOf(s) : null;
}
