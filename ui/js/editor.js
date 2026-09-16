// Text-editing primitives on top of the <textarea>: undo-safe edits, MathType-style slots (□),
// wrapping the selection or the previous atom, bracket auto-pairing and caret coordinates.

import { SLOT } from './render.js';

const OPEN_TO_CLOSE = { '{': '}', '(': ')', '[': ']' };
const CLOSERS = new Set(['}', ')', ']']);

export class TexEditor {
  constructor(textarea) {
    this.el = textarea;
    this.programmatic = 0;
  }

  get value() { return this.el.value; }
  get selStart() { return this.el.selectionStart; }
  get selEnd() { return this.el.selectionEnd; }
  get hasSelection() { return this.el.selectionStart !== this.el.selectionEnd; }
  get selectedText() { return this.el.value.slice(this.el.selectionStart, this.el.selectionEnd); }

  focus() { this.el.focus({ preventScroll: true }); }

  /**
   * Replaces [start, end) with text through execCommand('insertText') so Ctrl+Z / Ctrl+Y keep working
   * (assigning textarea.value would wipe the undo history, as v1.2's snippet expansion did).
   */
  replace(start, end, text, caretStart = null, caretEnd = null) {
    this.programmatic++;
    try {
      this.el.focus({ preventScroll: true });
      this.el.setSelectionRange(start, end);
      let ok = true;
      if (text.length > 0) ok = document.execCommand('insertText', false, text);
      else if (start !== end) ok = document.execCommand('delete');
      if (!ok) {
        // Fallback (should not happen in Chromium/WebKit): lose undo but keep correctness.
        this.el.setRangeText(text, start, end, 'end');
      }
      const s = caretStart === null ? start + text.length : caretStart;
      const e = caretEnd === null ? s : caretEnd;
      this.el.setSelectionRange(s, e);
    } finally {
      this.programmatic--;
    }
    this.el.dispatchEvent(new CustomEvent('texture:edited'));
  }

  /** Replaces the whole text as one undoable step. */
  setAll(text, caret = text.length) {
    this.replace(0, this.el.value.length, text, caret, caret);
  }

  /** Loads text without an undo entry (switching between equations should not be undoable). */
  load(text, selStart = null, selEnd = null) {
    this.programmatic++;
    try {
      this.el.value = text;
      const s = selStart === null ? text.length : Math.min(selStart, text.length);
      const e = selEnd === null ? s : Math.min(selEnd, text.length);
      this.el.setSelectionRange(s, e);
    } finally {
      this.programmatic--;
    }
  }

  /**
   * Inserts a catalog/snippet template at the caret.
   *  - $0 receives the selection (mode "wrap"), or the previous atom (mode "embellish");
   *    otherwise it becomes an empty slot □ that is pre-selected so typing replaces it.
   *  - $1..$9 become slots □ (Tab / Shift+Tab walk through them).
   *  - For snippets (asSnippet), $0 is a plain caret position, as in v1.2.
   */
  insertTemplate(template, { mode = 'wrap', asSnippet = false, replaceStart = null, replaceEnd = null } = {}) {
    let start = replaceStart ?? this.selStart;
    let end = replaceEnd ?? this.selEnd;
    let payload = replaceStart === null ? this.el.value.slice(start, end) : '';

    if (!payload && mode === 'embellish' && replaceStart === null) {
      const atom = previousAtom(this.el.value, start);
      if (atom) { start = atom[0]; payload = this.el.value.slice(atom[0], atom[1]); }
    }
    if (!template.includes('$0')) payload = '';

    const parts = template.split(/(\$\d)/);
    let out = '';
    let caret = null;
    let firstSlot = null;
    for (const part of parts) {
      const m = /^\$(\d)$/.exec(part);
      if (!m) { out += part; continue; }
      if (m[1] === '0') {
        if (payload) { out += payload; continue; }
        if (asSnippet) { caret = out.length; continue; }
      }
      if (firstSlot === null && !(m[1] === '0' && payload)) firstSlot = out.length;
      out += SLOT;
    }

    const base = start;
    if (caret !== null) this.replace(start, end, out, base + caret, base + caret);
    else if (firstSlot !== null) this.replace(start, end, out, base + firstSlot, base + firstSlot + 1);
    else this.replace(start, end, out);
  }

  /** Tab / Shift+Tab: select the next/previous empty slot, else jump past the next closing bracket. */
  nextSlot(backwards = false) {
    const v = this.el.value;
    if (backwards) {
      const idx = v.lastIndexOf(SLOT, Math.max(0, this.selStart - 1));
      if (idx >= 0 && idx < this.selStart) { this.el.setSelectionRange(idx, idx + 1); return true; }
      return false;
    }
    const from = this.selEnd;
    const idx = v.indexOf(SLOT, from);
    if (idx >= 0) { this.el.setSelectionRange(idx, idx + 1); return true; }
    // Otherwise jump past the next closing delimiter. A whole "\right…" token counts as one closer, so
    // Tab leaves \left| … \right| or \left\| … \right\| just like a brace.
    const m = /\\right\s*(?:\\[A-Za-z]+|\\.|.)|\\r(?:angle|Vert|vert|floor|ceil)\b|[}\])]/.exec(v.slice(from));
    if (m) {
      const pos = from + m.index + m[0].length;
      this.el.setSelectionRange(pos, pos);
      return true;
    }
    return false;
  }

  /** Auto-pairing. Returns true when the key was handled. */
  handlePairKey(key) {
    const v = this.el.value;
    const s = this.selStart;
    const e = this.selEnd;

    if (OPEN_TO_CLOSE[key]) {
      const before = v.slice(0, s);
      const escaped = before.endsWith('\\') && !before.endsWith('\\\\');
      let open = key;
      let close = OPEN_TO_CLOSE[key];
      if (escaped) {
        if (key !== '{') return false;
        close = '\\}';                                    // \{ → \{ \}
      } else if (/\\left$/.test(before)) {                // \left( → \left( … \right)
        open = key + ' ';
        close = ' \\right' + (key === '{' ? '\\}' : close);
        if (key === '{') open = '\\{ ';
      }
      if (s !== e) {
        const inner = v.slice(s, e);
        this.replace(s, e, open + inner + close, s + open.length, s + open.length + inner.length);
        return true;
      }
      // Do not pair right before a word character: the user is probably wrapping existing text.
      if (/[A-Za-z0-9\\]/.test(v.charAt(e))) return false;
      this.replace(s, e, open + close, s + open.length, s + open.length);
      return true;
    }

    if (CLOSERS.has(key) && s === e && v.charAt(s) === key) {
      this.el.setSelectionRange(s + 1, s + 1); // type over the auto-inserted closer
      return true;
    }
    return false;
  }

  /** Backspace inside an empty pair "{|}" removes both characters. */
  handlePairBackspace() {
    const v = this.el.value;
    const s = this.selStart;
    if (s !== this.selEnd || s === 0) return false;
    const open = v.charAt(s - 1);
    if (OPEN_TO_CLOSE[open] && v.charAt(s) === OPEN_TO_CLOSE[open]) {
      this.replace(s - 1, s + 1, '');
      return true;
    }
    return false;
  }

  /** Pixel position of the caret inside the textarea (for popups), via a mirrored div. */
  caretRect() {
    const ta = this.el;
    const style = getComputedStyle(ta);
    const mirror = document.createElement('div');
    for (const p of ['boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'tabSize', 'whiteSpace', 'wordWrap']) {
      mirror.style[p] = style[p];
    }
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', wordWrap: 'break-word', top: '0', left: '-9999px' });
    mirror.textContent = ta.value.slice(0, ta.selectionEnd);
    const marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const top = marker.offsetTop - ta.scrollTop;
    const left = marker.offsetLeft - ta.scrollLeft;
    const height = parseFloat(style.lineHeight) || 20;
    mirror.remove();
    return { top, left, height };
  }
}

/**
 * The atom just before `pos`, used by MathType-style embellishments (Ctrl+Alt+. on "x" → \dot{x}):
 * a braced group (with its command, e.g. \mathbf{v}), a control word (\alpha) or a single character.
 */
export function previousAtom(text, pos) {
  if (pos <= 0) return null;
  const ch = text.charAt(pos - 1);
  if (/\s/.test(ch)) return null;
  if (ch === '}') {
    let depth = 0;
    for (let i = pos - 1; i >= 0; i--) {
      const c = text.charAt(i);
      if (c === '}' && text.charAt(i - 1) !== '\\') depth++;
      else if (c === '{' && text.charAt(i - 1) !== '\\') {
        depth--;
        if (depth === 0) {
          const cmd = /\\[A-Za-z]+$/.exec(text.slice(0, i));
          return [cmd ? i - cmd[0].length : i, pos];
        }
      }
    }
    return null;
  }
  const word = /\\[A-Za-z]+$/.exec(text.slice(0, pos));
  if (word) return [pos - word[0].length, pos];
  if (/[A-Za-z0-9]/.test(ch) || ch.charCodeAt(0) > 127) return [pos - 1, pos];
  return null;
}
