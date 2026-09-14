// Symbol/template palette under the toolbar (same catalog as the ribbon) plus a "Recent" tab with the
// last inserted equations. Clicking never steals focus from the editor, so a selection can be wrapped.

import { renderSmall } from './render.js';
import { t } from './i18n.js';

export class Palette {
  constructor({ root, tabs, grid, onPick, onRecent, getRecent, onStateChange }) {
    Object.assign(this, { root, tabs, grid, onPick, onRecent, getRecent, onStateChange });
    this.catalog = null;
    this.tab = 'structures';
    this.open = true;
    root.addEventListener('mousedown', (e) => { if (e.target.closest('.pitem')) e.preventDefault(); });
  }

  setCatalog(catalog) {
    this.catalog = catalog;
    this.renderTabs();
    this.renderGrid();
  }

  setState({ open, tab }) {
    if (typeof open === 'boolean') this.open = open;
    if (tab) this.tab = tab;
    this.root.classList.toggle('collapsed', !this.open);
    if (this.catalog) { this.renderTabs(); this.renderGrid(); }
  }

  toggle() {
    this.open = !this.open;
    this.root.classList.toggle('collapsed', !this.open);
    this.onStateChange({ open: this.open, tab: this.tab });
    return this.open;
  }

  renderTabs() {
    const frag = document.createDocumentFragment();
    const groups = [...this.catalog.groups, { id: 'recent', label: 'Recent', short: '⟲' }];
    const label = (g) => { const k = g.id === 'recent' ? 'palette.recent' : 'group.' + g.id; return t(k) !== k ? t(k) : g.label; };
    for (const g of groups) {
      const b = document.createElement('button');
      b.className = 'ptab' + (g.id === this.tab && this.open ? ' active' : '');
      b.setAttribute('role', 'tab');
      b.title = label(g);
      b.innerHTML = '<span class="glyph"></span><span class="lbl"></span>';
      b.querySelector('.glyph').textContent = g.short || '';
      b.querySelector('.lbl').textContent = label(g);
      b.addEventListener('click', () => {
        if (this.tab === g.id && this.open) { this.toggle(); this.renderTabs(); return; }
        this.tab = g.id;
        if (!this.open) { this.open = true; this.root.classList.remove('collapsed'); }
        this.onStateChange({ open: this.open, tab: this.tab });
        this.renderTabs();
        this.renderGrid();
      });
      frag.appendChild(b);
    }
    this.tabs.replaceChildren(frag);
  }

  renderGrid() {
    const frag = document.createDocumentFragment();
    if (this.tab === 'recent') {
      const recent = this.getRecent();
      if (!recent.length) {
        const empty = document.createElement('div');
        empty.className = 'palette-empty';
        empty.textContent = t('palette.recentEmpty');
        frag.appendChild(empty);
      }
      for (const latex of recent) {
        const b = this.button(latex, null, latex + '\n' + t('palette.recentTip'));
        b.classList.add('recent-item');
        b.addEventListener('click', () => this.onRecent(latex));
        frag.appendChild(b);
      }
    } else {
      for (const item of this.catalog.items) {
        if (item.g !== this.tab) continue;
        const tip = [item.name, item.tex.replace(/\$\d/g, '□'), item.keys ? 'MathType: ' + item.keys : ''].filter(Boolean).join('\n');
        const b = this.button(item.tex, item.tpl ? null : item.glyph, tip);
        b.addEventListener('click', () => this.onPick(item));
        frag.appendChild(b);
      }
    }
    this.grid.replaceChildren(frag);
  }

  button(tex, glyph, title) {
    const b = document.createElement('button');
    b.className = 'pitem';
    b.title = title;
    if (glyph) {
      const s = document.createElement('span');
      s.className = 'txt';
      s.textContent = glyph;
      b.appendChild(s);
    } else {
      renderSmall(tex).then((svg) => { if (svg) b.replaceChildren(svg); else b.textContent = tex.slice(0, 6); });
    }
    return b;
  }
}
