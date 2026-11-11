import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/js/office-word.js', import.meta.url), 'utf8');
const { describeWordPicture, buildWordOoxml, svgDimensions, createWordAdapter, numberingRuns,
  numberingControlCodes, buildNumberingControlOoxml, isNumberingControl, wordOperationError } =
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

const pageXml = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1440" w:right="1440"/></w:sectPr>';
function mockWord(selected, all, { failCaret = false, atStart = false, inTable = false, initialFields = [], failUpdate = false,
  selectionXml = pageXml } = {}) {
  const operations = [];
  const fields = initialFields.map((field) => makeField(field.code || field, !!field.locked));
  function makeField(code, locked = false) {
    const field = { code, locked,
      delete() { operations.push(['deleteField', code]); fields.splice(fields.indexOf(field), 1); },
      updateResult() { if (failUpdate) throw new Error('field update unavailable'); operations.push(['updateField', code]); },
    };
    return field;
  }
  operations.fields = fields;
  const fieldCollection = { get items() { return fields; }, load() {} };
  const range = (name) => ({
    font: new Proxy({}, { set(target, key, value) { operations.push(['font', name, key, value]); target[key] = value; return true; } }),
    inlinePictures: { items: selected, load() {} },
    paragraphs: { getFirst: () => ({ getRange: () => ({ expandTo: () => ({ text: atStart ? '' : 'text', load() {},
      inlinePictures: { items: [], load() {} } }) }) }) },
    compareLocationWith() { return { value: atStart ? 'Equal' : 'After' }; },
    parentTableCellOrNullObject: { isNullObject: !inTable, load() {} },
    getOoxml: () => { operations.push(['readOoxml']); return { value: selectionXml }; },
    getRange(location) { operations.push(['range', name, location]); return range(name + ':' + location); },
    insertOoxml(xml, location) {
      operations.push(['insert', name, location, xml]);
      const added = [...xml.matchAll(/w:instr="([^"]*)"/g)].map((match) => makeField(match[1].trim()));
      if (name === 'body:Start') fields.unshift(...added); else fields.push(...added);
      return range('inserted');
    },
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
    body: { inlinePictures: { items: wrappedAll, load() {} }, fields: fieldCollection, getRange: (where) => range('body:' + where) },
    sections: { items: [{ body: { getRange: () => ({ compareLocationWith: () => ({ value: 'Contains' }) }),
      getOoxml: () => ({ value: pageXml }) } }], load() {} },
  } };
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
  .replace(/import\('\.\/office-word\.js(?:\?[^']*)?'\)/, "import('data:text/javascript;base64," + Buffer.from(source).toString('base64') + "')");
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

test('number formats use exactly the Windows counter names and switches', () => {
  const codes = (style) => [...numberingRuns(style).matchAll(/w:instr=" ([^"]*) "/g)].map((m) => m[1]);
  assert.deepEqual(codes(0), []);
  assert.deepEqual(codes(1), ['SEQ EqGlobal \\* ARABIC']);
  assert.deepEqual(codes(2), ['SEQ Chapter \\c', 'SEQ EqCh \\* ARABIC']);
  assert.deepEqual(codes(3), ['SEQ Chapter \\c', 'SEQ Section \\c', 'SEQ EqSec \\* ARABIC']);
  assert.deepEqual(numberingControlCodes('chapter'), ['SEQ Chapter \\n \\h', 'SEQ Section \\r 0 \\h', 'SEQ EqCh \\r 0 \\h', 'SEQ EqSec \\r 0 \\h']);
  assert.deepEqual(numberingControlCodes('section'), ['SEQ Section \\n \\h', 'SEQ EqSec \\r 0 \\h']);
  assert.equal(numberingControlCodes('chapter', true)[0], 'SEQ Chapter \\r 1 \\h');
  assert.throws(() => numberingControlCodes('other'));
});

test('numbered display tabs are margin-relative and require no page-size lookup', () => {
  const markup = buildWordOoxml(message, 'cG5n', 'id', { display: true, style: 3 });
  assert.ok(markup.includes('<w:ptab w:alignment="center" w:relativeTo="margin"'));
  assert.ok(markup.includes('<w:ptab w:alignment="right" w:relativeTo="margin"'));
  assert.equal([...markup.matchAll(/<w:fldSimple /g)].length, 3);
  assert.ok(markup.includes('<w:t>(</w:t>'));
  assert.ok(markup.includes('<w:t>)</w:t>'));
});

test('display insertion is centered even with numbering off; inline and table equations stay unnumbered', async () => {
  for (const [atStart, inTable, style, expectedDisplay, expectedFields] of [
    [true, false, 0, true, 0], [true, false, 2, true, 2], [false, false, 3, false, 0], [true, true, 1, false, 0],
  ]) {
    const operations = mockWord([], [], { atStart, inTable });
    await createWordAdapter({ renderPng: async () => 'cG5n' }).insert({ ...message, numberingStyle: style });
    const markup = operations.find((op) => op[0] === 'insert')[3];
    assert.equal(markup.includes('<w:jc w:val="center"/>') || markup.includes('<w:ptab'), expectedDisplay);
    assert.equal(operations.fields.length, expectedFields);
    assert.equal(operations.filter((op) => op[0] === 'updateField').length, expectedFields);
  }
});

test('empty paragraphs insert without reading selection or section OOXML', async () => {
  const operations = mockWord([], [], { atStart: true, selectionXml: '<w:document/>' });
  await createWordAdapter({ renderPng: async () => 'cG5n' }).insert({ ...message, numberingStyle: 1 });
  assert.ok(operations.find((op) => op[0] === 'insert')[3].includes('w:relativeTo="margin"'));
  assert.ok(!operations.some((op) => op[0] === 'readOoxml'));
});

test('updating an existing numbered image does not add or replace its adjacent number fields', async () => {
  const old = picture();
  const operations = mockWord([old], [old], { atStart: true, initialFields: ['SEQ EqGlobal \\* ARABIC'] });
  await createWordAdapter({ renderPng: async () => 'cG5n' }).insert({ ...message, targetKey: 'word:id:old', numberingStyle: 3 });
  assert.equal(operations.fields.length, 1);
  const markup = operations.find((op) => op[0] === 'insert')[3];
  assert.ok(!markup.includes('<w:fldSimple'));
  assert.ok(!operations.some((op) => op[0] === 'deleteField'));
});

test('reset removes only hidden TeXture control fields and leaves visible or unrelated fields intact', async () => {
  const initialFields = ['SEQ Chapter \\n \\h', 'SEQ EqGlobal \\* ARABIC', 'SEQ EqGlobalExtra \\h', 'PAGE', 'SEQ Figure \\h'];
  const operations = mockWord([], [], { initialFields });
  const adapter = createWordAdapter();
  await adapter.numbering('reset');
  assert.deepEqual(operations.filter((op) => op[0] === 'deleteField').map((op) => op[1]), ['SEQ Chapter \\n \\h']);
  assert.deepEqual(operations.fields.slice(0, 5).map((field) => field.code),
    ['Chapter', 'Section', 'EqGlobal', 'EqCh', 'EqSec'].map((name) => `SEQ ${name} \\r 0 \\h`));
  assert.deepEqual(operations.fields.slice(5).map((field) => field.code), initialFields.slice(1));
  await adapter.numbering('chapter');
  assert.equal(operations.fields.at(-4).code, 'SEQ Chapter \\r 1 \\h');
  await adapter.numbering('chapter');
  assert.equal(operations.fields.at(-4).code, 'SEQ Chapter \\n \\h');
  assert.equal(isNumberingControl('SEQ EqGlobalExtra \\h'), false);
  assert.equal(isNumberingControl('SEQ EqGlobal \\* ARABIC'), false);
});

test('new section resets only its equation counter; update skips locked fields', async () => {
  const operations = mockWord([], [], { initialFields: [{ code: 'SEQ EqGlobal \\* ARABIC', locked: true }] });
  const adapter = createWordAdapter();
  await adapter.numbering('section');
  assert.deepEqual(operations.fields.slice(1).map((field) => field.code), ['SEQ Section \\n \\h', 'SEQ EqSec \\r 0 \\h']);
  operations.length = 0;
  await adapter.numbering('update');
  assert.equal(operations.filter((op) => op[0] === 'updateField').length, 2);
  await assert.rejects(adapter.numbering('unknown'), /Unknown/);
});

test('committed equation is reported once even if field refresh fails', async () => {
  const operations = mockWord([], [], { atStart: true, failUpdate: true });
  const result = await createWordAdapter({ renderPng: async () => 'cG5n' }).insert({ ...message, numberingStyle: 1 });
  assert.equal(operations.filter((op) => op[0] === 'insert').length, 1);
  assert.equal(result.noticeKey, 'numbering.updateFailed');
  assert.ok(result.equation.key);
});

test('Enter regression: keep SVG bytes and dimensions; isolate picture baseline from following text', async () => {
  const styled = { ...message, svg: svg.replace('<svg ', '<svg style="vertical-align:-0.5ex" ') };
  const inline = buildWordOoxml(styled, 'cG5n', 'id');
  assert.ok(inline.includes(Buffer.from(styled.svg).toString('base64')));
  assert.ok(inline.includes('<w:position w:val="-4"/>'));
  const display = buildWordOoxml(styled, 'cG5n', 'id', { display: true, widthTwips: 9026 });
  assert.ok(!display.includes('<w:position w:val="-4"/>'));
  const tail = display.slice(display.lastIndexOf('<w:p>'));
  assert.ok(tail.includes('<w:textAlignment w:val="baseline"/>'));
  assert.ok(tail.includes('<w:position w:val="0"/>'));
  assert.ok(!tail.includes('w:drawing'));
  officeEnvironment('Word', 'word');
  const operations = mockWord([], []);
  const result = await createWordAdapter({ renderPng: async () => 'cG5n' }).insert(message);
  assert.equal(result.noticeKey, null);
  assert.ok(operations.some((op) => op[0] === 'font' && op[1] === 'inserted:End' && op[2] === 'position' && op[3] === 0));
  assert.ok(!operations.some((op) => op[0] === 'font' && op[1].includes('Whole')));
});

test('numbering capability is limited to desktop Word with WordApi 1.5', async () => {
  for (const [host, hostId, platform, expected] of [
    ['Word', 'word', 'Mac', true], ['Word', 'word', 'OfficeOnline', false], ['PowerPoint', 'ppt', 'Mac', false],
  ]) {
    officeEnvironment(host, hostId);
    Office.onReady = async () => ({ host, platform });
    const messages = [];
    const backend = await createOfficeHost((message) => messages.push(message));
    backend.receive({ type: 'ready' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(messages.find((message) => message.type === 'init').capabilities.numbering, expected);
  }
});

test('ordinary inherited tab stops cannot intercept positional equation tabs', () => {
  const markup = buildWordOoxml(message, 'cG5n', 'id', { display: true, style: 1 });
  assert.ok(!markup.includes('<w:tab '));
  assert.ok(!markup.includes('<w:tab/>'));
  const plain = buildWordOoxml(message, 'cG5n', 'id', { display: true, style: 0 });
  assert.ok(plain.includes('<w:jc w:val="center"/>'));
  assert.ok(!plain.includes('w:ptab'));
});

test('blank Word errors include the failing stage and native error code without dumping document data', () => {
  assert.equal(wordOperationError('paragraph.layout', { message: '', code: 'GeneralException',
    debugInfo: { errorLocation: 'Range.expandTo', fullStatements: 'PRIVATE DOCUMENT CONTENT' } }).message,
  '[paragraph.layout] GeneralException / Range.expandTo');
});

test('a native layout failure reaches the user with its stage and code before any insertion', async () => {
  globalThis.Word = { run: async (callback) => callback({ document: { getSelection: () => ({
    getRange: () => ({ paragraphs: { getFirst() { throw { code: 'GeneralException', message: '' }; } } }),
  }) } }) };
  await assert.rejects(createWordAdapter({ renderPng: async () => 'cG5n' })
    .insert({ ...message, numberingStyle: 0 }), /\[paragraph.layout\] GeneralException/);
});

test('unnumbered centered equations have a real neutral text boundary after the SVG, before the paragraph mark', () => {
  const markup = buildWordOoxml(message, 'cG5n', 'id', { display: true, style: 0 });
  const firstParagraph = markup.slice(markup.indexOf('<w:body>'), markup.indexOf('</w:p>'));
  const drawingEnd = firstParagraph.indexOf('</w:drawing></w:r>');
  const boundary = firstParagraph.slice(drawingEnd + '</w:drawing></w:r>'.length);
  assert.equal(boundary, '<w:r><w:rPr><w:position w:val="0"/><w:vertAlign w:val="baseline"/></w:rPr><w:t xml:space="preserve">&#8203;</w:t></w:r>');
  assert.ok(firstParagraph.includes('<w:jc w:val="center"/>'));
  assert.ok(markup.includes(Buffer.from(svg).toString('base64')));
  assert.ok(markup.includes('cx="228600" cy="152400"'));
  assert.ok(!markup.includes('<w:fldSimple'));
});

test('the Enter text boundary is restricted to unnumbered display equations', () => {
  for (const options of [{ display: false, style: 0 }, { display: true, style: 1 },
    { display: true, style: 2 }, { display: true, style: 3 }]) {
    const markup = buildWordOoxml(message, 'cG5n', 'id', options);
    assert.ok(!markup.includes('&#8203;'));
  }
});
