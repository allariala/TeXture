import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/js/focus-policy.js', import.meta.url), 'utf8');
const { bindEditorFocus } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
function element(tag, { classes = [], attrs = [], parent = null } = {}) {
  return { closest(selector) {
    const matches = selector.split(',').map((s) => s.trim()).some((part) =>
      part.startsWith('.') ? classes.includes(part.slice(1)) :
        part.startsWith('[') ? attrs.includes(part.slice(1, -1)) : part === tag);
    return matches ? this : parent?.closest(selector) || null;
  } };
}
function browser(officeMode = true) {
  const documentHandlers = {}, windowHandlers = {};
  const document = { activeElement: element('body'), addEventListener: (name, fn) => { documentHandlers[name] = fn; } };
  const window = { addEventListener: (name, fn) => { windowHandlers[name] = fn; } };
  const state = { focuses: 0, settings: false };
  bindEditorFocus({ document, window, officeMode, editor: { focus: () => state.focuses++ }, isSettingsOpen: () => state.settings });
  return { document, state, mouse: (target) => documentHandlers.mousedown({ target }), focus: () => windowHandlers.focus() };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('Mac select and option interaction does not schedule editor focus or close the native popup', async () => {
  for (const tag of ['select', 'option']) {
    const b = browser();
    b.document.activeElement = element(tag);
    b.mouse(b.document.activeElement);
    b.focus();
    await tick();
    assert.equal(b.state.focuses, 0);
  }
});
test('Office window focus never steals the insertion point from Word, even while a native popup reports body focus', () => {
  const b = browser();
  b.focus();
  assert.equal(b.state.focuses, 0);
});
test('a background-click timer cannot steal focus from a select that opened in the meantime', async () => {
  const b = browser();
  b.mouse(element('div'));
  b.document.activeElement = element('select');
  await tick();
  assert.equal(b.state.focuses, 0);
});
test('reset confirmation, links and editable controls retain their own keyboard focus', async () => {
  for (const target of [element('span', { parent: element('div', { classes: ['word-numbering'] }) }),
    element('a'), element('div', { attrs: ['contenteditable'] }), element('div', { attrs: ['tabindex'] })]) {
    const b = browser();
    b.mouse(target);
    await tick();
    assert.equal(b.state.focuses, 0);
  }
});
test('intentional background clicks still restore editor focus; settings block recovery', async () => {
  const b = browser();
  b.mouse(element('div'));
  await tick();
  assert.equal(b.state.focuses, 1);
  b.state.settings = true;
  b.mouse(element('div'));
  await tick();
  assert.equal(b.state.focuses, 1);
});
test('Windows development window retains background focus recovery without overriding controls', () => {
  const b = browser(false);
  b.focus();
  assert.equal(b.state.focuses, 1);
  b.document.activeElement = element('select');
  b.focus();
  assert.equal(b.state.focuses, 1);
});
