import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/js/office-word.js', import.meta.url), 'utf8');
const { describeWordPicture, buildWordOoxml, svgDimensions, createWordAdapter } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="16px"><text>α</text></svg>';
const message = { svg, latex: 'α & "x" < y', fontSize: 11, color: '#123456' };
const picture = (id = 'old') => ({ altTextDescription: 'PLX:x', width: 36, height: 12,
  altTextTitle: 'TeXture:' + JSON.stringify({ v: 2, size: 11, color: '#123456', bw: 18, id }) });

test('Windows Word metadata remains editable, including manual resizing', () => {
  assert.deepEqual(describeWordPicture(picture()), {
    key: 'word:id:old', latex: 'x', fontSize: 22, color: '#123456', legacy: false, _id: 'old',
  });
  assert.equal(describeWordPicture({ altTextDescription: 'ordinary picture' }), null);
  assert.equal(describeWordPicture({ altTextDescription: 'PLX:x', altTextTitle: 'TeXture:{bad' }).legacy, true);
});

test('OOXML embeds the original Unicode SVG, PNG fallback and escaped Windows metadata', () => {
  const ooxml = buildWordOoxml(message, 'cG5n', 'new');
  assert.ok(ooxml.includes(Buffer.from(svg).toString('base64')));
  assert.ok(ooxml.includes('image/svg+xml'));
  assert.ok(ooxml.includes('image/png'));
  assert.ok(ooxml.includes('asvg:svgBlip r:embed="rIdSvg"'));
  assert.ok(ooxml.includes('descr="PLX:α &amp; &quot;x&quot; &lt; y"'));
  assert.ok(ooxml.includes('cx="228600" cy="152400"'));
  const title = ooxml.match(/title="([^"]*)"/)[1].replace(/&quot;/g, '"');
  assert.deepEqual(JSON.parse(title.slice('TeXture:'.length)),
    { v: 2, size: 11, color: '#123456', bw: 18, bh: 12, id: 'new' });
  assert.ok(buildWordOoxml({ ...message, latex: 'a\nb\tc\rd' }, 'cG5n', 'new')
    .includes('descr="PLX:a&#10;b&#9;c&#13;d"'));
});

test('dimensions accept points and reject invalid sizes before insertion', () => {
  assert.deepEqual(svgDimensions('<svg width="18pt" height="12pt">'), { width: 24, height: 16 });
  assert.throws(() => svgDimensions('<svg width="0" height="12">'));
  assert.throws(() => svgDimensions('<svg width="bad" height="12">'));
});

function mockWord(selected, all, { failCaret = false } = {}) {
  const operations = [];
  const range = (name) => ({
    inlinePictures: { items: selected, load() {} },
    getRange(location) { operations.push(['range', name, location]); return range(name + ':' + location); },
    insertOoxml(xml, location) { operations.push(['insert', name, location, xml]); return range('inserted'); },
    select() { if (failCaret) throw new Error('focus unavailable'); },
  });
  const wrap = (item, name) => ({ ...item, getRange(location = 'Whole') {
    assert.ok(['Whole', 'Start', 'End'].includes(location));
    operations.push(['pictureRange', name, location]);
    return range(name + ':' + location);
  } });
  const wrappedAll = all.map((p, i) => wrap(p, 'picture' + i));
  const wrappedSelected = selected.map((p) => wrappedAll[all.indexOf(p)] || wrap(p, 'selected'));
  const selection = range('selection');
  selection.inlinePictures.items = wrappedSelected;
  const ctx = { sync: async () => {}, document: { getSelection: () => selection,
    body: { inlinePictures: { items: wrappedAll, load() {} } } } };
  globalThis.Word = { run: async (callback) => callback(ctx) };
  return operations;
}

test('new insertion collapses selection instead of replacing selected text', async () => {
  const operations = mockWord([], []);
  const result = await createWordAdapter({ renderPng: async () => 'cG5n' }).insert(message);
  assert.ok(operations.some((op) => op[0] === 'insert' && op[1] === 'selection:End'));
  assert.equal(result.replacedKey, null);
});

test('update replaces only the requested equation and preserves its ID', async () => {
  const old = picture();
  const operations = mockWord([], [picture('other'), old]);
  const result = await createWordAdapter({ renderPng: async () => 'cG5n' })
    .insert({ ...message, targetKey: 'word:id:old' });
  assert.equal(result.equation.key, 'word:id:old');
  assert.ok(operations.some((op) => op[0] === 'insert' && op[1] === 'picture1:Whole'));
});

test('missing or ambiguous targets fail without changing the document', async () => {
  for (const pictures of [[], [picture(), picture()]]) {
    const operations = mockWord([], pictures);
    await assert.rejects(createWordAdapter({ renderPng: async () => 'cG5n' })
      .insert({ ...message, targetKey: 'word:id:old' }), /removed or is ambiguous/);
    assert.ok(!operations.some((op) => op[0] === 'insert'));
  }
});

test('selected duplicate is preferred and +New inserts after it with a new ID', async () => {
  const old = picture();
  const operations = mockWord([old], [old, picture()]);
  const result = await createWordAdapter({ renderPng: async () => 'cG5n' })
    .insert({ ...message, nearKey: 'word:id:old' });
  assert.notEqual(result.equation.key, 'word:id:old');
  assert.ok(operations.some((op) => op[0] === 'insert' && op[1] === 'picture0:End'));
});

test('rendering failure makes no Word call; caret failure does not misreport a committed insertion', async () => {
  globalThis.Word = { run: () => { throw new Error('must not run'); } };
  await assert.rejects(createWordAdapter({ renderPng: async () => { throw new Error('bad SVG'); } }).insert(message), /bad SVG/);
  mockWord([], [], { failCaret: true });
  assert.ok((await createWordAdapter({ renderPng: async () => 'cG5n' }).insert(message)).equation);
});

const hostSource = (await readFile(new URL('../ui/js/office-host.js', import.meta.url), 'utf8'))
  .replace("import('./office-word.js')", "import('data:text/javascript;base64," + Buffer.from(source).toString('base64') + "')");
const { createOfficeHost } = await import('data:text/javascript;base64,' + Buffer.from(hostSource).toString('base64'));

function officeEnvironment(host, requestedHost, supportsWord = true) {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  globalThis.location = { search: '?host=' + requestedHost + '&platform=office' };
  globalThis.document = { createElement: () => ({}), head: { appendChild: (script) => queueMicrotask(() => script.onload()) } };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.Office = { HostType: { Word: 'Word', PowerPoint: 'PowerPoint' }, onReady: async () => ({ host }),
    EventType: { DocumentSelectionChanged: 'selection' }, context: {
      requirements: { isSetSupported: () => supportsWord }, document: { addHandlerAsync() {} },
    } };
  globalThis.Word = { run: async () => null };
  globalThis.PowerPoint = { run: async () => null };
  return data;
}

test('Word and PowerPoint initialize their own drafts with capture disabled', async () => {
  for (const [host, hostId] of [['Word', 'word'], ['PowerPoint', 'ppt']]) {
    const data = officeEnvironment(host, hostId);
    const messages = [];
    const backend = await createOfficeHost((message) => messages.push(message));
    backend.receive({ type: 'state', patch: { draft: hostId } });
    backend.receive({ type: 'ready' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const init = messages.find((message) => message.type === 'init');
    assert.equal(init.host, hostId);
    assert.equal(init.state.draft, hostId);
    assert.equal(init.capabilities.capture, false);
    assert.equal(init.settings.hosts.word.fontSize, 11);
    assert.equal(data.has('texture.state.' + (hostId === 'word' ? 'ppt' : 'word')), false);
  }
});

test('wrong manifest and unsupported Word API reject instead of simulating success', async () => {
  officeEnvironment('Word', 'ppt');
  await assert.rejects(createOfficeHost(() => {}), /manifest/);
  officeEnvironment('Word', 'word', false);
  await assert.rejects(createOfficeHost(() => {}), /WordApi 1.3/);
});
