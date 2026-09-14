// Settings sheet: General (language, theme, behaviour, defaults, preview, hotkeys), Snippets
// (table + JSON, import/export) and a searchable Shortcuts reference generated from the catalog.

import { describeResult } from './snippets.js';
import { prettyStroke } from './keymap.js';
import { t, getLanguage } from './i18n.js';

export class SettingsPanel {
  constructor({ sheet, backdrop, app }) {
    this.sheet = sheet;
    this.backdrop = backdrop;
    this.app = app;
    this.tab = 'general';
    this.snippetQuery = '';
    this.shortcutQuery = '';
    this.jsonMode = false;
    backdrop.addEventListener('click', () => this.close());
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.listening) { e.stopPropagation(); this.close(); } });
  }

  get isOpen() { return !this.sheet.hidden; }

  open(tab) {
    if (tab) this.tab = tab;
    this.sheet.hidden = false;
    this.backdrop.hidden = false;
    this.render();
  }

  close() {
    this.sheet.hidden = true;
    this.backdrop.hidden = true;
    this.jsonMode = false;
    this.app.focusEditor();
  }

  refresh() { if (this.isOpen && !this.listening) this.render(); }

  render() {
    const s = this.sheet;
    s.innerHTML = `
      <div class="sheet-head"><h2>TeXture</h2><span class="spacer"></span>
        <button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5 5 15"/></svg></button></div>
      <nav class="sheet-tabs">
        <button class="ptab" data-tab="general"></button>
        <button class="ptab" data-tab="snippets"></button>
        <button class="ptab" data-tab="shortcuts"></button>
      </nav>
      <div class="sheet-body"></div>`;
    s.querySelector('[data-close]').onclick = () => this.close();
    s.querySelectorAll('[data-tab]').forEach((b) => {
      b.textContent = t('set.tab.' + b.dataset.tab);
      b.classList.toggle('active', b.dataset.tab === this.tab);
      b.onclick = () => { this.tab = b.dataset.tab; this.jsonMode = false; this.render(); };
    });
    const body = s.querySelector('.sheet-body');
    if (this.tab === 'general') this.renderGeneral(body);
    else if (this.tab === 'snippets') this.renderSnippets(body);
    else this.renderShortcuts(body);
  }

  // ---------------------------------------------------------------- general
  renderGeneral(body) {
    const app = this.app;
    const st = app.settings;
    const doc = t('doc.' + app.host);

    body.appendChild(sec(t('set.sec.appearance')));
    body.appendChild(field(t('set.language'), '', seg(
      [['ko', '한국어'], ['en', 'English']], getLanguage(), (v) => app.patchSettings({ language: v }))));
    body.appendChild(field(t('set.theme'), t('set.theme.hint'), seg(
      [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], st.theme || 'auto', (v) => app.patchSettings({ theme: v }))));

    body.appendChild(sec(t('set.sec.workflow')));
    if (app.capabilities.focusDocument) {
      body.appendChild(field(t('set.afterInsert'), t('set.afterInsert.hint', { doc }), seg(
        [['document', t('set.afterInsert.doc', { doc })], ['editor', t('set.afterInsert.editor')]],
        st.afterInsert || 'document', (v) => app.patchSettings({ afterInsert: v }))));
    }
    body.appendChild(field(t('set.defaultSize'), t('set.defaultSize.hint'), number(app.defaultFontSize(), 4, 200, 0.5,
      (v) => app.patchSettings({ hosts: { [app.host]: { fontSize: v } } }))));
    body.appendChild(field(t('set.snippets'), t('set.snippets.hint'), toggle(st.snippets !== false, (v) => app.patchSettings({ snippets: v }))));
    body.appendChild(field(t('set.autocomplete'), t('set.autocomplete.hint'), toggle(st.autocomplete !== false, (v) => app.patchSettings({ autocomplete: v }))));
    body.appendChild(field(t('set.autoPair'), t('set.autoPair.hint'), toggle(st.autoPair !== false, (v) => app.patchSettings({ autoPair: v }))));
    body.appendChild(field(t('set.chords'), t('set.chords.hint'), toggle(st.chords !== false, (v) => app.patchSettings({ chords: v }))));

    body.appendChild(sec(t('set.sec.preview')));
    const minPt = parseFloat(st.previewMinPt) || 14;
    const maxPt = parseFloat(st.previewMaxPt) || 24;
    body.appendChild(field(t('set.previewMin'), t('set.previewMin.hint'), number(minPt, 6, 72, 1,
      (v) => app.patchSettings({ previewMinPt: v, previewMaxPt: Math.max(v, maxPt) }))));
    body.appendChild(field(t('set.previewMax'), '', number(maxPt, 6, 96, 1,
      (v) => app.patchSettings({ previewMaxPt: v, previewMinPt: Math.min(v, minPt) }))));

    if (app.capabilities.hotkeys) {
      body.appendChild(sec(t('set.sec.hotkeys')));
      const hk = st.hotkeys || {};
      body.appendChild(field(t('set.hk.pane'), t('set.hk.pane.hint'), this.hotkeyInput('pane', hk.pane)));
      body.appendChild(field(t('set.hk.popup'), '', this.hotkeyInput('popup', hk.popup)));
      body.appendChild(field(t('set.hk.capture'), '', this.hotkeyInput('capture', hk.capture)));
    }

    const about = document.createElement('p');
    about.className = 'hint';
    about.textContent = t('set.about', { v: app.version });
    body.appendChild(about);
  }

  hotkeyInput(id, value) {
    const b = document.createElement('button');
    b.className = 'hotkey-input';
    b.textContent = value || '—';
    b.title = t('set.hk.title');
    b.onclick = () => {
      this.listening = true;
      b.classList.add('listening');
      b.textContent = t('set.hk.listen');
      const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (/^(Control|Shift|Alt|Meta)/.test(e.code)) return;
        document.removeEventListener('keydown', onKey, true);
        this.listening = false;
        b.classList.remove('listening');
        if (e.key === 'Escape' || !(e.ctrlKey || e.altKey) || !/^(Key[A-Z]|Digit\d)$/.test(e.code)) {
          b.textContent = value || '—';
          if (e.key !== 'Escape') this.app.toast(t('toast.hotkeyInvalid'));
          return;
        }
        const combo = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.code.replace(/^Key|^Digit/, '')].filter(Boolean).join('+');
        b.textContent = combo;
        this.app.patchSettings({ hotkeys: { [id]: combo } });
      };
      document.addEventListener('keydown', onKey, true);
    };
    return b;
  }

  // ---------------------------------------------------------------- snippets
  renderSnippets(body) {
    const app = this.app;
    const bar = document.createElement('div');
    bar.className = 'toolbar-row';
    bar.innerHTML = `
      <input class="search">
      <button class="ghost" data-act="json"></button>
      <button class="ghost" data-act="import">Import</button>
      <button class="ghost" data-act="export">Export</button>
      <button class="ghost" data-act="reset">Reset</button>`;
    const search = bar.querySelector('.search');
    search.placeholder = t('snip.search');
    search.value = this.snippetQuery;
    search.hidden = this.jsonMode;
    bar.querySelector('[data-act=json]').textContent = this.jsonMode ? t('snip.table') : 'JSON';
    bar.querySelector('[data-act=json]').onclick = () => { this.jsonMode = !this.jsonMode; this.render(); };
    bar.querySelector('[data-act=import]').onclick = () => app.importSnippets();
    bar.querySelector('[data-act=export]').onclick = () => app.exportSnippets();
    bar.querySelector('[data-act=reset]').onclick = () => {
      if (confirm(t('snip.resetConfirm'))) { app.resetSnippets(); this.render(); }
    };
    body.appendChild(bar);

    if (this.jsonMode) {
      const ta = document.createElement('textarea');
      ta.className = 'json';
      ta.spellcheck = false;
      ta.value = JSON.stringify(app.snippets, null, 2);
      const row = document.createElement('div');
      row.className = 'toolbar-row';
      row.style.marginTop = '8px';
      const save = document.createElement('button');
      save.className = 'primary';
      save.textContent = t('snip.save');
      save.onclick = () => {
        try {
          const list = JSON.parse(ta.value);
          if (!Array.isArray(list)) throw new Error(t('snip.err.array'));
          list.forEach((s, i) => { if (!s || typeof s.trigger !== 'string' || typeof s.replacement !== 'string') throw new Error(t('snip.err.item', { n: i + 1 })); });
          app.setSnippets(list);
          this.jsonMode = false;
          this.render();
          app.toast(t('toast.snippetsSaved'));
        } catch (err) {
          app.toast(t('toast.jsonError', { msg: err.message }), true);
        }
      };
      row.appendChild(save);
      body.append(ta, row);
      return;
    }

    const table = document.createElement('table');
    table.className = 'list';
    table.innerHTML = `<thead><tr><th style="width:36px"></th><th></th><th></th><th style="width:28px"></th></tr></thead><tbody></tbody>`;
    const ths = table.querySelectorAll('th');
    ths[0].textContent = t('snip.col.on'); ths[1].textContent = t('snip.col.trigger'); ths[2].textContent = t('snip.col.result');
    const tbody = table.querySelector('tbody');
    const draw = () => {
      tbody.replaceChildren();
      const q = this.snippetQuery.toLowerCase();
      app.snippets.forEach((snip, idx) => {
        const guide = snip.isRegex ? (snip.showGuide || snip.trigger) : snip.trigger;
        const result = describeResult(snip);
        if (q && !(guide.toLowerCase().includes(q) || result.toLowerCase().includes(q))) return;
        const tr = document.createElement('tr');
        if (snip.enabled === false) tr.className = 'off';
        const on = toggle(snip.enabled !== false, (v) => {
          const list = app.snippets.slice();
          list[idx] = { ...snip, enabled: v };
          if (v) delete list[idx].enabled;
          app.setSnippets(list);
          tr.classList.toggle('off', !v);
        });
        const td0 = document.createElement('td'); td0.appendChild(on);
        const td1 = document.createElement('td'); td1.innerHTML = '<code></code>'; td1.firstChild.textContent = guide + (snip.isRegex ? '  (regex)' : '');
        const td2 = document.createElement('td'); td2.innerHTML = '<code class="res"></code>'; td2.firstChild.textContent = result;
        const td3 = document.createElement('td');
        const del = document.createElement('button');
        del.className = 'row-btn'; del.title = t('snip.delete'); del.textContent = '✕';
        del.onclick = () => { const list = app.snippets.slice(); list.splice(idx, 1); app.setSnippets(list); draw(); };
        td3.appendChild(del);
        tr.append(td0, td1, td2, td3);
        tbody.appendChild(tr);
      });
    };
    search.oninput = () => { this.snippetQuery = search.value; draw(); };
    draw();

    const add = document.createElement('div');
    add.className = 'toolbar-row';
    add.style.marginTop = '10px';
    add.innerHTML = `
      <input class="search" data-f="t" style="flex:0 0 110px;min-width:0">
      <input class="search" data-f="r">
      <button class="ghost" data-act="add"></button>`;
    add.querySelector('[data-f=t]').placeholder = t('snip.trigger.ph');
    add.querySelector('[data-f=r]').placeholder = t('snip.result.ph');
    add.querySelector('[data-act=add]').textContent = t('snip.add');
    add.querySelector('[data-act=add]').onclick = () => {
      const trigger = add.querySelector('[data-f=t]').value;
      const replacement = add.querySelector('[data-f=r]').value;
      if (!trigger || !replacement) { app.toast(t('toast.needTrigger')); return; }
      app.setSnippets([{ trigger, replacement }, ...app.snippets.filter((s) => s.trigger !== trigger)]);
      this.render();
    };
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = t('snip.hint');
    body.append(table, add, hint);
  }

  // ---------------------------------------------------------------- shortcuts
  renderShortcuts(body) {
    const app = this.app;
    const search = document.createElement('input');
    search.className = 'search';
    search.placeholder = t('sc.search');
    search.value = this.shortcutQuery;
    search.style.width = '100%';
    search.style.marginBottom = '8px';
    const list = document.createElement('div');
    const draw = () => {
      const q = this.shortcutQuery.toLowerCase();
      list.replaceChildren();
      const rows = (title, pairs) => {
        const filtered = pairs.filter(([k, d]) => !q || k.toLowerCase().includes(q) || d.toLowerCase().includes(q));
        if (!filtered.length) return;
        list.appendChild(sec(title));
        const tbl = document.createElement('table');
        tbl.className = 'list';
        for (const [k, d] of filtered) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td style="width:44%"><span class="keycap"></span></td><td></td>';
          tr.querySelector('.keycap').textContent = k;
          tr.children[1].textContent = d;
          tbl.appendChild(tr);
        }
        list.appendChild(tbl);
      };
      rows(t('sc.editor'), [
        ['Ctrl+Enter', t('sc.k.insert')],
        ['Esc', t('sc.k.esc')],
        ['Tab / Shift+Tab', t('sc.k.tab')],
        ['\\ + a–z', t('sc.k.ac')],
        ['{ ( [', t('sc.k.pair')],
        ['Ctrl+Z / Ctrl+Y', t('sc.k.undo')],
        [t('sc.k.colorKey'), t('sc.k.color')],
        ['Ctrl+M, 3, 3', t('sc.k.matrix')],
      ]);
      const hk = app.settings.hotkeys || {};
      if (app.capabilities.hotkeys) rows(t('sc.office'), [[hk.pane || '', t('sc.k.pane')], [hk.popup || '', t('sc.k.popup')], [hk.capture || '', t('sc.k.capture')]]);
      const singles = [];
      for (const item of app.catalog?.items || []) {
        for (const alt of (item.keys || '').split(' or ')) {
          if (alt && !alt.includes(', ')) singles.push([prettyStroke(alt), `${item.name} — ${item.tex.replace(/\$\d/g, '□')}`]);
        }
      }
      rows(t('sc.single'), singles);
      for (const [combo, prefix] of app.keymap?.prefixes || []) {
        const key = 'prefix.' + combo;
        const label = t(key) !== key ? t(key) : prefix.label;
        rows(`${prefix.spec} · ${label}`, prefix.entries.map((e) =>
          [`${prefix.spec}, ${prettyStroke(e.spec)}`, `${e.item.glyph ? e.item.glyph + '  ' : ''}${e.item.name} — ${e.item.tex.replace(/\$\d/g, '□')}`]));
      }
      for (const [, o] of app.keymap?.oneshots || []) rows(o.spec, [[`${o.spec}, ${t('sc.letter')}`, o.name + ' — ' + o.wrap.replace('#', 'x')]]);
    };
    search.oninput = () => { this.shortcutQuery = search.value; draw(); };
    draw();
    body.append(search, list);
  }
}

// ---------------------------------------------------------------- small builders
function sec(title) {
  const h = document.createElement('h3');
  h.className = 'sec';
  h.textContent = title;
  return h;
}

function field(label, hint, control) {
  const row = document.createElement('div');
  row.className = 'field';
  const l = document.createElement('div');
  l.className = 'lbl';
  l.textContent = label;
  if (hint) { const s = document.createElement('small'); s.textContent = hint; l.appendChild(s); }
  row.append(l, control);
  return row;
}

function seg(options, current, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'seg';
  for (const [value, label] of options) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', value === current);
    b.onclick = () => {
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(value);
    };
    wrap.appendChild(b);
  }
  return wrap;
}

function toggle(checked, onChange) {
  const label = document.createElement('label');
  label.className = 'switch';
  label.innerHTML = '<input type="checkbox"><span></span>';
  const input = label.querySelector('input');
  input.checked = checked;
  input.onchange = () => onChange(input.checked);
  return label;
}

function number(value, min, max, step, onChange) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min); input.max = String(max); input.step = String(step);
  input.className = 'num-input';
  input.value = value;
  input.onchange = () => {
    const v = parseFloat(input.value);
    if (v >= min && v <= max) onChange(v); else input.value = value;
  };
  return input;
}
