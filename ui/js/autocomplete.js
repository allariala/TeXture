// LaTeX command autocomplete: typing "\fr" offers \frac{□}{□}, \frown, … with a rendered preview and the
// MathType shortcut. ↑/↓ choose, Enter/Tab accept, Esc dismisses.

import { renderSmall } from './render.js';
import { t } from './i18n.js';

const MAX_ROWS = 8;

export class Autocomplete {
  constructor({ editor, popup, anchor }) {
    this.editor = editor;
    this.popup = popup;
    this.anchor = anchor;
    this.entries = [];
    this.rows = [];
    this.index = 0;
    this.token = null;
    popup.addEventListener('mousedown', (e) => e.preventDefault());
  }

  setCatalog(catalog) {
    const seen = new Set();
    const add = (tex, meta = {}) => {
      const m = /^\\([A-Za-z]+)/.exec(tex);
      if (!m || seen.has(tex)) return;
      seen.add(tex);
      this.entries.push({ cmd: m[1], tex, glyph: meta.glyph || null, name: meta.name || '', keys: meta.keys || '' });
    };
    // Catalog items first (they carry glyphs and shortcuts), then the plain command list.
    for (const item of catalog.items || []) if (item.tex && item.tex.startsWith('\\') && !item.mode?.startsWith('action')) add(item.tex, item);
    for (const tex of catalog.commands || []) add(tex);
  }

  get visible() { return !this.popup.hidden; }

  /** Re-evaluates the token before the caret; call after every user edit. */
  update() {
    const ed = this.editor;
    if (ed.hasSelection) return this.hide();
    const before = ed.value.slice(0, ed.selStart);
    const m = /\\([A-Za-z]+)$/.exec(before);
    if (!m || before.endsWith('\\\\' + m[1])) return this.hide();
    const word = m[1];
    const lower = word.toLowerCase();

    const exact = [];
    const prefix = [];
    const loose = [];
    for (const e of this.entries) {
      if (e.cmd === word && e.tex === '\\' + word) exact.push(e);
      else if (e.cmd.startsWith(word)) prefix.push(e);
      else if (e.cmd.toLowerCase().startsWith(lower)) loose.push(e);
    }
    prefix.sort((a, b) => a.cmd.length - b.cmd.length);
    const list = [...prefix, ...loose].slice(0, MAX_ROWS);
    // Nothing to add when the only candidate is exactly what was typed.
    if (list.length === 0 || (list.length === 1 && list[0].tex === '\\' + word && exact.length === 0)) return this.hide();

    this.token = { start: ed.selStart - word.length - 1, end: ed.selStart, word };
    this.rows = list;
    this.index = 0;
    this.render();
  }

  render() {
    const frag = document.createDocumentFragment();
    this.rows.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'ac-item' + (i === this.index ? ' sel' : '');
      const g = document.createElement('div');
      g.className = 'g';
      if (entry.glyph) g.textContent = entry.glyph;
      else renderSmall(entry.tex).then((svg) => { if (svg && row.isConnected) g.replaceChildren(svg); });
      const c = document.createElement('div');
      c.className = 'c';
      const shown = entry.tex.replace(/\$\d/g, '□').replace(/\n/g, ' ');
      const b = document.createElement('b');
      b.textContent = shown.slice(0, this.token.word.length + 1);
      c.append(b, document.createTextNode(shown.slice(this.token.word.length + 1)));
      const k = document.createElement('div');
      k.className = 'k';
      k.textContent = entry.keys ? entry.keys.split(' or ')[0] : '';
      row.append(g, c, k);
      row.addEventListener('mouseenter', () => { this.index = i; this.highlight(); });
      row.addEventListener('click', () => this.accept(i));
      frag.appendChild(row);
    });
    const foot = document.createElement('div');
    foot.className = 'ac-foot';
    foot.textContent = t('ac.footer');
    frag.appendChild(foot);
    this.popup.replaceChildren(frag);
    this.popup.hidden = false;
    this.position();
  }

  highlight() {
    [...this.popup.querySelectorAll('.ac-item')].forEach((el, i) => el.classList.toggle('sel', i === this.index));
  }

  position() {
    const caret = this.anchor();
    const wrap = this.popup.parentElement;
    const width = this.popup.offsetWidth;
    const height = this.popup.offsetHeight;
    let left = Math.min(Math.max(6, caret.left - 12), wrap.clientWidth - width - 6);
    let top = caret.top + caret.height + 4;
    if (top + height > wrap.clientHeight && caret.top - height - 4 > 0) top = caret.top - height - 4;
    this.popup.style.left = Math.max(6, left) + 'px';
    this.popup.style.top = Math.max(4, top) + 'px';
  }

  handleKeydown(e) {
    if (!this.visible) return false;
    switch (e.key) {
      case 'ArrowDown': this.index = (this.index + 1) % this.rows.length; this.highlight(); return true;
      case 'ArrowUp': this.index = (this.index - 1 + this.rows.length) % this.rows.length; this.highlight(); return true;
      case 'Enter':
      case 'Tab': this.accept(this.index); return true;
      case 'Escape': this.hide(); return true;
      default: return false;
    }
  }

  accept(i) {
    const entry = this.rows[i];
    const token = this.token;
    this.hide();
    if (!entry || !token) return;
    this.editor.insertTemplate(entry.tex, { mode: 'wrap', replaceStart: token.start, replaceEnd: token.end });
  }

  hide() {
    this.popup.hidden = true;
    this.token = null;
  }
}
