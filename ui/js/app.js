// TeXture editor — application state and wiring.
//
// Editor state machine (fixes "the text disappears when I click away"):
//   insert mode  – writing a new equation. The text is the *draft*; it survives selection changes,
//                  slide changes and restarts (persisted per host) and is only cleared by inserting.
//   edit mode    – an equation is selected in the document. Unapplied changes are kept per equation
//                  (pending edits) and restored when that equation is selected again.
// Selecting something else never throws text away; it only switches which text is shown.

import { send, onMessage, isHosted } from './bridge.js';
import { renderPreview, exportSvg, toRenderable, SLOT } from './render.js';
import { TexEditor } from './editor.js';
import { cloneDefaults, findSnippet } from './snippets.js';
import { Keymap, ChordController, comboFromEvent, parseHotkey } from './keymap.js';
import { Autocomplete } from './autocomplete.js';
import { Palette } from './palette.js';
import { SettingsPanel } from './settings.js';
import { t, setLanguage, applyDom, defaultLanguage } from './i18n.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const HOST = params.get('host') === 'word' ? 'word' : 'ppt';
const DEFAULT_SIZE = { ppt: 18, word: 11 };
// Vivid primaries (highlighting on slides); green is toned to 0.8 so it stays readable on white.
const PRESET_COLORS = [
  ['#000000', 'Black'], ['#FF0000', 'Red'], ['#00CC00', 'Green'],
  ['#0000FF', 'Blue'], ['#FF8000', 'Orange'], ['#CC00CC', 'Magenta'],
];
const HISTORY_MAX = 30;

const ui = {
  editor: $('editor'),
  modeChip: $('modeChip'), modeLabel: $('modeLabel'), unsaved: $('unsavedDot'),
  fontSize: $('fontSize'), sizeUp: $('sizeUp'), sizeDown: $('sizeDown'), colors: $('colors'),
  btnPalette: $('btnPalette'), btnCapture: $('btnCapture'), btnSettings: $('btnSettings'),
  preview: $('preview'), previewEmpty: $('previewEmpty'), previewPane: $('previewPane'), errorPill: $('errorPill'),
  resizer: $('resizer'),
  btnInsert: $('btnInsert'), insertLabel: $('insertLabel'), btnNew: $('btnNew'), btnRevert: $('btnRevert'), btnClear: $('btnClear'),
  statusNote: $('statusNote'), server: $('serverStatus'), serverLabel: $('serverLabel'),
  toast: $('toast'),
};

const editor = new TexEditor(ui.editor);

const state = {
  settings: {},
  version: '',
  snippets: cloneDefaults(),
  customSnippets: false,
  catalog: null,
  keymap: null,
  officeDark: false,
  mode: 'insert',
  current: null,          // selected equation {key, latex, fontSize, color, legacy}
  pending: new Map(),     // key → {latex, fontSize, color, selStart, selEnd}
  draft: { latex: '', fontSize: null, color: null, selStart: 0, selEnd: 0 },
  history: [],
  fontSize: DEFAULT_SIZE[HOST],
  color: '#000000',
  busy: false,
  requestId: 0,
  deleting: false,
  note: '',
  lastRenderError: null,
  // What the host can do (the Mac web add-in has no capture, Office hotkeys or focus control).
  capabilities: { capture: true, hotkeys: true, focusDocument: true },
};

// ================================================================== public API used by other modules
const app = {
  host: HOST,
  get settings() { return state.settings; },
  get snippets() { return state.snippets; },
  get catalog() { return state.catalog; },
  get keymap() { return state.keymap; },
  get version() { return state.version; },
  get capabilities() { return state.capabilities; },
  defaultFontSize,
  patchSettings,
  setSnippets,
  resetSnippets() { setSnippets(null); },
  importSnippets() { send({ type: 'snippets.import', current: state.snippets }); },
  exportSnippets() { send({ type: 'snippets.export', snippets: state.snippets }); },
  focusEditor() { editor.focus(); },
  toast,
};

// ================================================================== settings helpers
function setting(name, fallback) {
  const v = state.settings[name];
  return v === undefined ? fallback : v;
}

function hostPrefs() {
  return (state.settings.hosts && state.settings.hosts[HOST]) || {};
}

function defaultFontSize() {
  const v = parseFloat(hostPrefs().fontSize);
  return v >= 4 && v <= 200 ? v : DEFAULT_SIZE[HOST];
}

function defaultColor() {
  return /^#[0-9a-f]{6}$/i.test(hostPrefs().color || '') ? hostPrefs().color.toUpperCase() : '#000000';
}

function clamp(v, lo, hi, fallback) {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete target[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}

function patchSettings(patch) {
  deepMerge(state.settings, JSON.parse(JSON.stringify(patch)));
  send({ type: 'settings', patch });
  applySettings();
}

const debounced = (fn, ms) => {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const sendDefaults = debounced(() => {
  send({ type: 'settings', patch: { hosts: { [HOST]: { ...hostPrefs() } } } });
}, 400);

/** The last size/colour the user picked becomes the default for new equations (also after restart). */
function saveDefaults() {
  deepMerge(state.settings, { hosts: { [HOST]: { fontSize: state.fontSize, color: state.color } } });
  sendDefaults();
}

const saveDraft = debounced(() => {
  send({ type: 'state', patch: { draft: { latex: state.draft.latex, fontSize: state.draft.fontSize, color: state.draft.color } } });
}, 500);

const saveUiLayout = debounced((patch) => send({ type: 'settings', patch }), 400);

// ================================================================== theme & settings application
function applyTheme() {
  const pref = setting('theme', 'auto');
  const dark = pref === 'dark' || (pref === 'auto' && state.officeDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  schedulePreview();
}

function applySettings() {
  setLanguage(setting('language', defaultLanguage()));
  applyDom();
  applyTheme();
  if (palette) palette.setState({ open: setting('paletteOpen', false), tab: setting('paletteTab', 'structures') });
  ui.btnPalette.classList.toggle('active', setting('paletteOpen', false));
  const h = parseFloat(setting('previewHeight', 0));
  if (h >= 56) ui.previewPane.style.height = h + 'px';
  hotkeys = Object.fromEntries(Object.entries(setting('hotkeys', {})).map(([id, spec]) => [parseHotkey(spec), id]));
  settingsPanel.refresh();
  if (palette) palette.renderTabs();
  renderColors();
  renderMode();
  setServerStatus(state.serverStatus);
}

let hotkeys = {};

// ================================================================== mode / state machine
function snapshot() {
  return { latex: editor.value, fontSize: state.fontSize, color: state.color, selStart: editor.selStart, selEnd: editor.selEnd };
}

function isDirty() {
  if (state.mode !== 'edit' || !state.current) return false;
  const c = state.current;
  return editor.value !== c.latex ||
    Math.abs(state.fontSize - (c.fontSize ?? state.fontSize)) > 0.01 ||
    (c.color && state.color.toUpperCase() !== c.color.toUpperCase());
}

/** Saves what the editor shows before switching to something else. */
function stashCurrent() {
  if (state.mode === 'insert') {
    state.draft = snapshot();
    saveDraft();
  } else if (state.current && state.current.key) {
    if (isDirty()) state.pending.set(state.current.key, snapshot());
    else state.pending.delete(state.current.key);
  }
}

function showDraft({ focus = false } = {}) {
  state.mode = 'insert';
  state.current = null;
  const d = state.draft;
  state.fontSize = d.fontSize ?? defaultFontSize();
  state.color = d.color ?? defaultColor();
  editor.load(d.latex || '', d.selStart ?? null, d.selEnd ?? null);
  afterStateChange();
  if (focus) editor.focus();
}

function showEquation(eq, { flash = true } = {}) {
  state.mode = 'edit';
  state.current = { ...eq, fontSize: eq.fontSize ?? null, color: eq.color ?? null };
  const p = eq.key ? state.pending.get(eq.key) : null;
  state.fontSize = p?.fontSize ?? eq.fontSize ?? defaultFontSize();
  state.color = (p?.color ?? eq.color ?? '#000000').toUpperCase();
  // A legacy (v1.2) equation has no stored size: treat the shown size as its size so it is not "dirty".
  if (state.current.fontSize == null) state.current.fontSize = state.fontSize;
  if (state.current.color == null) state.current.color = state.color;
  editor.load(p ? p.latex : eq.latex, p?.selStart ?? null, p?.selEnd ?? null);
  afterStateChange();
  if (flash) flashEditor();
}

function onSelection(eq, note) {
  state.note = note || '';
  const key = eq ? eq.key : null;

  if (eq && state.mode === 'edit' && state.current && key === state.current.key) {
    // Same equation again (e.g. after our own insert): refresh only if the user has not edited it.
    if (!isDirty() && eq.latex !== state.current.latex) showEquation(eq, { flash: false });
    renderStatus();
    return;
  }
  stashCurrent();
  if (eq) showEquation(eq);
  else showDraft();
}

function afterStateChange() {
  ui.fontSize.value = formatSize(state.fontSize);
  renderColors();
  renderMode();
  schedulePreview();
}

function renderMode() {
  const edit = state.mode === 'edit';
  const dirty = isDirty();
  ui.modeChip.classList.toggle('edit', edit);
  ui.modeLabel.textContent = edit ? t(state.current?.legacy ? 'mode.legacy' : 'mode.edit') : t('mode.new');
  ui.modeChip.title = t(edit ? 'mode.edit.title' : 'mode.new.title');
  ui.unsaved.hidden = !dirty;
  ui.insertLabel.textContent = t(edit && state.current?.key ? 'btn.update' : 'btn.insert');
  ui.btnNew.hidden = !edit;
  ui.btnRevert.hidden = !(edit && dirty);
  renderStatus();
}

function renderStatus() {
  const pendingCount = state.pending.size;
  let note = state.note;
  if (!note && pendingCount) note = t('status.pending', { n: pendingCount });
  ui.statusNote.textContent = note;
}

function flashEditor() {
  ui.editor.classList.add('flash');
  requestAnimationFrame(() => setTimeout(() => ui.editor.classList.remove('flash'), 60));
}

// ================================================================== text changes, preview
function onTextChanged() {
  if (state.mode === 'insert') {
    state.draft = snapshot();
    saveDraft();
  }
  renderMode();
  schedulePreview();
}

let previewQueued = false;
let errorTimer = 0;
function schedulePreview() {
  if (previewQueued) return;
  previewQueued = true;
  setTimeout(async () => {
    previewQueued = false;
    const dark = document.documentElement.dataset.theme === 'dark';
    const minPt = clamp(parseFloat(setting('previewMinPt', 14)), 6, 72, 14);
    const maxPt = Math.max(minPt, clamp(parseFloat(setting('previewMaxPt', 24)), 6, 96, 24));
    const result = await renderPreview(editor.value, ui.preview, { color: state.color, dark, minPt, maxPt });
    if (result.stale) return;
    ui.previewEmpty.hidden = !result.empty;
    state.lastRenderError = result.error || null;
    clearTimeout(errorTimer);
    if (!result.error) {
      ui.errorPill.hidden = true;
    } else {
      // Half-typed commands are errors for a moment; only complain once typing pauses.
      errorTimer = setTimeout(() => {
        ui.errorPill.textContent = '⚠ ' + result.error;
        ui.errorPill.hidden = false;
      }, ui.errorPill.hidden ? 700 : 0);
    }
  }, 40);
}

// ================================================================== insert / update
/**
 * Insert (new equation) or Update (selected equation). With asNew while editing, the current text is
 * inserted as an additional equation next to the selected one, which stays untouched.
 */
async function insert({ asNew = false } = {}) {
  if (state.busy) return;
  closeTransient();
  const latex = editor.value.replace(/□/g, '');
  if (!toRenderable(latex).trim()) { shake(ui.btnInsert); editor.focus(); return; }

  const { svg, error } = await exportSvg(latex, state.fontSize, state.color);
  if (error) {
    shake(ui.btnInsert);
    toast(t('toast.texError', { msg: error }), true);
    return;
  }
  setBusy(true);
  const requestId = ++state.requestId;
  const editing = state.mode === 'edit' && state.current;
  const targetKey = editing && !asNew ? state.current.key : null;
  const nearKey = editing && asNew ? state.current.key : null;
  state.inFlight = { requestId, latex, wasInsert: state.mode === 'insert', asNewFrom: nearKey };
  send({ type: 'insert', requestId, latex, svg, fontSize: state.fontSize, color: state.color, targetKey, nearKey });
  setTimeout(() => { if (state.busy && state.requestId === requestId) setBusy(false); }, 20000);
}

function onInserted(msg) {
  const flight = state.inFlight;
  state.inFlight = null;
  setBusy(false);
  if (msg.replacedKey) state.pending.delete(msg.replacedKey);
  // The edits went into the new copy; the original keeps its stored text.
  if (flight?.asNewFrom) state.pending.delete(flight.asNewFrom);
  if (flight?.wasInsert) {
    state.draft = { latex: '', fontSize: null, color: null, selStart: 0, selEnd: 0 };
    saveDraft();
  }
  addHistory(flight?.latex ?? msg.equation?.latex);
  if (msg.notice) toast(msg.notice);

  if (HOST === 'ppt' && msg.equation) {
    // PowerPoint selects the new equation; mirror that immediately (the selection event confirms it).
    state.mode = 'edit';
    state.current = { ...msg.equation, fontSize: state.fontSize, color: state.color };
    editor.load(msg.equation.latex);
    afterStateChange();
  } else {
    // Word leaves the caret after the equation: ready for the next new equation.
    showDraft();
  }
}

function setBusy(busy) {
  state.busy = busy;
  ui.btnInsert.classList.toggle('busy', busy);
}

function addHistory(latex) {
  if (!latex) return;
  state.history = [latex, ...state.history.filter((h) => h !== latex)].slice(0, HISTORY_MAX);
  send({ type: 'state', patch: { history: state.history } });
  if (palette && palette.tab === 'recent') palette.renderGrid();
}

function revert() {
  if (!state.current) return;
  state.pending.delete(state.current.key);
  showEquation({ ...state.current }, { flash: true });
  editor.focus();
}

/** "+New" while editing: insert the editor text as a new equation beside the selected one. */
function insertAsNew() {
  if (state.mode !== 'edit' || !state.current) return insert();
  return insert({ asNew: true });
}

// ================================================================== size & colour
function formatSize(v) { return String(Math.round(v * 10) / 10); }

function setFontSize(v, { persist = true } = {}) {
  if (!(v >= 4 && v <= 200)) { ui.fontSize.value = formatSize(state.fontSize); return; }
  state.fontSize = Math.round(v * 2) / 2;
  ui.fontSize.value = formatSize(state.fontSize);
  if (persist) saveDefaults();
  onTextChanged();
}

function renderColors() {
  const frag = document.createDocumentFragment();
  const current = state.color.toUpperCase();
  let matched = false;
  for (const [hex, name] of PRESET_COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch' + (hex === current ? ' active' : '');
    matched = matched || hex === current;
    b.style.background = hex;
    b.title = t('color.' + name);
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the editor selection
    b.addEventListener('click', () => pickColor(hex));
    frag.appendChild(b);
  }
  const custom = document.createElement('label');
  custom.className = 'swatch custom' + (matched ? '' : ' active');
  custom.title = t('color.custom');
  const input = document.createElement('input');
  input.type = 'color';
  input.value = current.toLowerCase();
  let savedSel = null;
  custom.addEventListener('mousedown', () => { savedSel = editor.hasSelection ? [editor.selStart, editor.selEnd] : null; });
  input.addEventListener('change', () => {
    if (savedSel) ui.editor.setSelectionRange(savedSel[0], savedSel[1]);
    pickColor(input.value.toUpperCase());
  });
  custom.appendChild(input);
  frag.appendChild(custom);
  ui.colors.replaceChildren(frag);
}

/**
 * With text selected: colour just that part (\textcolor{#RRGGBB}{…}, re-colouring an existing wrapper
 * instead of nesting). Without a selection: colour of the whole equation (stored on the shape).
 */
function pickColor(hex) {
  if (editor.hasSelection) {
    const v = editor.value;
    const s = editor.selStart;
    const e = editor.selEnd;
    const head = /\\textcolor\{#?[0-9A-Fa-f]{3,6}\}\{$/.exec(v.slice(0, s));
    if (head && v.charAt(e) === '}') {
      const start = s - head[0].length;
      const inner = v.slice(s, e);
      const same = hex.toUpperCase() === state.color.toUpperCase();
      const text = same ? inner : `\\textcolor{${hex}}{${inner}}`;
      editor.replace(start, e + 1, text, start + (same ? 0 : text.length - inner.length - 1), start + (same ? inner.length : text.length - 1));
    } else {
      const inner = v.slice(s, e);
      const open = `\\textcolor{${hex}}{`;
      editor.replace(s, e, open + inner + '}', s + open.length, s + open.length + inner.length);
    }
    toast(t('toast.colorApplied'));
    return;
  }
  state.color = hex.toUpperCase();
  saveDefaults();
  renderColors();
  onTextChanged();
}

// ================================================================== snippets
function setSnippets(list) {
  if (list === null) {
    state.snippets = cloneDefaults();
    state.customSnippets = false;
  } else {
    state.snippets = list;
    state.customSnippets = true;
  }
  send({ type: 'snippets.save', snippets: list });
  settingsPanel.refresh();
}

// Defaults added in later versions are merged once into customised lists (the user may delete them).
const ADDED_DEFAULTS = { '2.0': ['lr\\|'] };

function receiveSnippets(list) {
  if (Array.isArray(list)) {
    state.snippets = list;
    state.customSnippets = true;
    const done = setting('snippetDefaultsMerged', '');
    if (done !== '2.0') {
      const defaults = cloneDefaults();
      const missing = ADDED_DEFAULTS['2.0']
        .filter((trig) => !list.some((s) => s.trigger === trig))
        .map((trig) => defaults.find((d) => d.trigger === trig))
        .filter(Boolean);
      if (missing.length) setSnippets([...missing, ...list]);
      patchSettings({ snippetDefaultsMerged: '2.0' });
    }
  } else {
    state.snippets = cloneDefaults();
    state.customSnippets = false;
  }
  settingsPanel.refresh();
}

/** v1.2 kept edited snippets in WebView2 localStorage (same origin); move them to the shared file once. */
function migrateLegacySnippets(fromHost) {
  if (!isHosted || Array.isArray(fromHost)) return;
  try {
    const legacy = localStorage.getItem('TeXture_snippets');
    if (!legacy) return;
    const list = JSON.parse(legacy);
    if (Array.isArray(list) && list.length) {
      setSnippets(list);
      localStorage.setItem('TeXture_snippets_migrated', legacy);
      localStorage.removeItem('TeXture_snippets');
      toast(t('toast.migrated'));
    }
  } catch { /* ignore */ }
}

// ================================================================== keyboard
function closeTransient() {
  let closed = false;
  if (chords && chords.isOpen) { chords.close(); closed = true; }
  if (ac && ac.visible) { ac.hide(); closed = true; }
  return closed;
}

function applyCatalogItem(item) {
  const mode = item.mode || (item.tex.includes('$0') ? 'wrap' : 'insert');
  if (mode === 'action:sizeUp') return setFontSize(state.fontSize + 1);
  if (mode === 'action:sizeDown') return setFontSize(state.fontSize - 1);
  editor.insertTemplate(item.tex, { mode });
  editor.focus();
}

ui.editor.addEventListener('keydown', (e) => {
  state.deleting = e.key === 'Backspace' || e.key === 'Delete';
  if (e.isComposing || e.keyCode === 229) return;

  if (chords && chords.isOpen) { if (chords.handleKeydown(e)) e.preventDefault(); return; }
  if (ac.visible && ac.handleKeydown(e)) { e.preventDefault(); return; }

  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); insert(); return; }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (!closeTransient()) send({ type: 'escape' }); // back to the slide; the text stays
    return;
  }
  const combo = comboFromEvent(e);
  if (combo && hotkeys[combo]) { e.preventDefault(); send({ type: 'hotkey', id: hotkeys[combo] }); return; }
  if (chords && setting('chords', true) && chords.handleKeydown(e)) { e.preventDefault(); return; }

  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    editor.nextSlot(e.shiftKey);
    return;
  }
  if (setting('autoPair', true) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (e.key.length === 1) {
      // Let snippet triggers such as "lr(" win over auto-pairing.
      const before = editor.value.slice(0, editor.selStart) + e.key;
      const wouldSnippet = setting('snippets', true) && !editor.hasSelection && findSnippet(before, before.length, state.snippets);
      if (!wouldSnippet && editor.handlePairKey(e.key)) { e.preventDefault(); return; }
    } else if (e.key === 'Backspace' && editor.handlePairBackspace()) {
      e.preventDefault();
    }
  }
});

ui.editor.addEventListener('input', (e) => {
  if (editor.programmatic) return;
  if (!e.isComposing && setting('snippets', true) && !state.deleting && !editor.hasSelection) {
    const m = findSnippet(editor.value, editor.selStart, state.snippets);
    if (m) editor.insertTemplate(m.template, { asSnippet: true, replaceStart: m.start, replaceEnd: m.end });
  }
  if (setting('autocomplete', true)) ac.update(); else ac.hide();
  onTextChanged();
});
ui.editor.addEventListener('texture:edited', () => {
  if (setting('autocomplete', true) && !editor.programmatic) ac.update();
  onTextChanged();
});
ui.editor.addEventListener('compositionend', () => onTextChanged());
ui.editor.addEventListener('click', () => { ac.hide(); if (chords) chords.close(); });
ui.editor.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ui.editor) ac.hide(); }, 120));

// ================================================================== UI wiring
ui.btnInsert.addEventListener('click', insert);
ui.btnNew.addEventListener('click', insertAsNew);
ui.btnRevert.addEventListener('click', revert);
ui.btnClear.addEventListener('click', () => { editor.setAll(''); editor.focus(); });
ui.btnCapture.addEventListener('click', () => send({ type: 'capture' }));
ui.btnSettings.addEventListener('click', () => settingsPanel.open());
ui.btnPalette.addEventListener('click', () => {
  const open = palette.toggle();
  ui.btnPalette.classList.toggle('active', open);
  palette.renderTabs();
  editor.focus();
});
ui.sizeUp.addEventListener('click', () => setFontSize(state.fontSize + 1));
ui.sizeDown.addEventListener('click', () => setFontSize(state.fontSize - 1));
ui.fontSize.addEventListener('change', () => setFontSize(parseFloat(ui.fontSize.value)));
ui.fontSize.addEventListener('keydown', (e) => { if (e.key === 'Enter') { setFontSize(parseFloat(ui.fontSize.value)); editor.focus(); } });
ui.fontSize.addEventListener('wheel', (e) => { e.preventDefault(); setFontSize(state.fontSize + (e.deltaY < 0 ? 0.5 : -0.5)); }, { passive: false });

// preview resizer
(() => {
  let startY = 0, startH = 0, dragging = false;
  ui.resizer.addEventListener('mousedown', (e) => {
    dragging = true; startY = e.clientY; startH = ui.previewPane.offsetHeight;
    ui.resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const h = Math.max(56, Math.min(window.innerHeight * 0.7, startH + (startY - e.clientY)));
    ui.previewPane.style.height = h + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    ui.resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    state.settings.previewHeight = ui.previewPane.offsetHeight;
    saveUiLayout({ previewHeight: ui.previewPane.offsetHeight });
    schedulePreview();
  });
})();

// Clicking empty space puts the caret back in the editor (as in v1.2).
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('button, input, textarea, label, .popup, .sheet, .palette, .size, .colors')) return;
  setTimeout(() => editor.focus(), 0);
});
window.addEventListener('focus', () => {
  if (!settingsPanel.isOpen && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) editor.focus();
});
window.addEventListener('resize', schedulePreview);

// ================================================================== toast / helpers
let toastTimer = 0;
function toast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('error', !!isError);
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), isError ? 4200 : 2400);
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function setServerStatus(status) {
  state.serverStatus = status;
  const s = String(status || 'Offline');
  ui.server.className = 'server ' + (s.startsWith('Starting') ? 'starting' : s.startsWith('Idle') ? 'idle' : s.startsWith('Processing') ? 'busy' : '');
  ui.serverLabel.textContent = t(s.startsWith('Idle') ? 'server.ready' : s.startsWith('Starting') ? 'server.starting'
    : s.startsWith('Processing') ? 'server.busy' : 'server.offline');
}

// ================================================================== components
const settingsPanel = new SettingsPanel({ sheet: $('settingsSheet'), backdrop: $('settingsBackdrop'), app });
const ac = new Autocomplete({ editor, popup: $('acPopup'), anchor: () => editor.caretRect() });
let chords = null;
let palette = null;

async function loadCatalog() {
  try {
    const res = await fetch('data/catalog.json');
    state.catalog = await res.json();
  } catch (err) {
    console.error('catalog load failed', err);
    state.catalog = { groups: [], items: [], commands: [] };
  }
  state.keymap = new Keymap(state.catalog);
  chords = new ChordController({
    keymap: state.keymap,
    popup: $('chordPopup'),
    anchor: () => editor.caretRect(),
    onApply: applyCatalogItem,
    onLiteral: (text) => editor.replace(editor.selStart, editor.selEnd, text),
  });
  ac.setCatalog(state.catalog);
  palette = new Palette({
    root: $('palette'), tabs: $('paletteTabs'), grid: $('paletteGrid'),
    onPick: applyCatalogItem,
    onRecent: (latex) => { editor.setAll(latex); editor.focus(); },
    getRecent: () => state.history,
    onStateChange: ({ open, tab }) => {
      state.settings.paletteOpen = open;
      state.settings.paletteTab = tab;
      ui.btnPalette.classList.toggle('active', open);
      saveUiLayout({ paletteOpen: open, paletteTab: tab });
    },
  });
  palette.setState({ open: setting('paletteOpen', false), tab: setting('paletteTab', 'structures') });
  palette.setCatalog(state.catalog);
}

// ================================================================== host messages
onMessage((msg) => {
  switch (msg.type) {
    case 'init': {
      state.version = msg.version || '';
      state.capabilities = { ...state.capabilities, ...(msg.capabilities || {}) };
      ui.btnCapture.hidden = !state.capabilities.capture;
      ui.server.hidden = !state.capabilities.capture;
      state.settings = msg.settings || {};
      state.officeDark = !!msg.dark;
      const st = msg.state || {};
      state.history = Array.isArray(st.history) ? st.history.filter((h) => typeof h === 'string') : [];
      const d = st.draft || {};
      state.draft = { latex: d.latex || '', fontSize: d.fontSize ?? null, color: d.color ?? null, selStart: null, selEnd: null };
      receiveSnippets(msg.snippets);
      migrateLegacySnippets(msg.snippets);
      applySettings();
      setServerStatus(msg.server);
      if (state.mode === 'insert') showDraft();
      break;
    }
    case 'selection':
      onSelection(msg.equation || null, msg.note || '');
      break;
    case 'inserted':
      onInserted(msg);
      break;
    case 'error':
      if (msg.requestId && state.busy) setBusy(false);
      state.inFlight = null;
      toast(msg.message || t('toast.error'), true);
      break;
    case 'status':
      setServerStatus(msg.server);
      break;
    case 'settings':
      state.settings = msg.settings || state.settings;
      applySettings();
      if (state.mode === 'insert' && !editor.value) afterStateChange();
      break;
    case 'snippets':
      receiveSnippets(msg.snippets);
      break;
    case 'theme':
      state.officeDark = !!msg.dark;
      applyTheme();
      break;
    case 'notice':
      toast(t(msg.key));
      break;
    case 'captureStarted':
      toast(t('toast.recognising'));
      break;
    case 'captureResult': {
      const latex = msg.latex || '';
      if (!editor.value.trim() || (editor.selStart === 0 && editor.selEnd === editor.value.length)) editor.setAll(latex);
      else editor.replace(editor.selStart, editor.selEnd, latex);
      toast(t('toast.captured'));
      editor.focus();
      break;
    }
    case 'command':
      if (msg.name === 'insertTemplate' && msg.tex) applyCatalogItem({ tex: msg.tex, mode: msg.mode });
      else if (msg.name === 'openSettings') settingsPanel.open();
      break;
    case 'focus':
      if (!settingsPanel.isOpen) editor.focus();
      break;
    default:
      break;
  }
});

// Boot: the host answers "ready" with "init" followed by the current selection.
setLanguage(defaultLanguage());
applyDom();
loadCatalog().finally(() => send({ type: 'ready' }));
showDraft();
