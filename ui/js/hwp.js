// Pure LaTeX → HWP equation script. No MathJax internals or Office dependencies.
// 본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// Sources and compatibility limits: README.md (HWP section). `exact` means a documented
// script equivalent, not that rendering has been verified in Hancom 2024.
export const HANCOM_NOTICE = '본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.';

const symbols = Object.create(null);
function map(names, target) {
  for (const name of names.split(' ')) symbols[name] = target || name;
}
map('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega vartheta varpi varsigma varupsilon varphi varepsilon');
for (const name of 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ')) map(name, name.toUpperCase());
map('sum prod coprod'); map('int oint'); map('iint', 'dint'); map('iiint', 'tint'); map('oiint', 'odint'); map('oiiint', 'otint');
map('bigcup', 'union'); map('bigcap', 'inter'); map('cup', 'smallunion'); map('cap', 'smallinter');
map('sqcap sqcup oplus ominus otimes odot oslash wedge vee subset supset subseteq supseteq sqsubset sqsupset sqsubseteq sqsupseteq in notin leq geq prec succ uplus');
map('ni owns', 'owns'); map('le', 'leq'); map('ge', 'geq'); map('ne neq', 'neq'); map('ll', '<<'); map('gg', '>>');
map('pm', 'plusminus'); map('mp', 'minusplus'); map('times'); map('div', 'divide'); map('cdot', '·');
map('circ bullet ast star bigcirc emptyset therefore because doteq sim approx simeq cong equiv asymp diamond forall partial propto dagger ddagger');
map('exists', 'exist'); map('neg lnot', 'lnot'); map('land', 'wedge'); map('lor', 'vee'); map('infty', 'inf'); map('nabla', '∇');
map('aleph hbar imath jmath ell wp'); map('Re', 'reimage'); map('Im', 'image');
map('leftarrow gets', 'larrow'); map('rightarrow to', 'rarrow'); map('leftrightarrow', 'lrarrow');
map('Leftarrow', 'LARROW'); map('Rightarrow implies', 'RARROW'); map('Leftrightarrow iff', 'LRARROW');
map('uparrow downarrow nearrow searrow swarrow nwarrow mapsto');
map('Uparrow', 'UPARROW'); map('Downarrow', 'DOWNARROW'); map('updownarrow', 'udarrow'); map('Updownarrow', 'UDARROW');
map('hookleftarrow', 'hookleft'); map('hookrightarrow', 'hookright');
map('longleftarrow', 'larrow'); map('longrightarrow', 'rarrow'); map('longleftrightarrow', 'lrarrow');
map('Longleftarrow', 'LARROW'); map('Longrightarrow', 'RARROW'); map('Longleftrightarrow', 'LRARROW');
map('ldots dots', 'ldots'); map('cdots vdots ddots triangle angle bot top models vdash'); map('perp', 'bot');
map('vert lvert rvert', 'vert'); map('Vert lVert rVert', 'VERT');
map('mid', 'vert'); map('parallel', 'VERT'); map('prime', 'prime');
map('langle', 'langle'); map('rangle', 'rangle'); map('lfloor', 'lfloor'); map('rfloor', 'rfloor'); map('lceil', 'lceil'); map('rceil', 'rceil');
map('lbrace', '{'); map('rbrace', '}'); map('lbrack', '['); map('rbrack', ']');
map('sin cos tan cot sec cosec csc arcsin arccos arctan sinh cosh tanh coth log ln lg exp max min lim det mod gcd asin acos atan lcm hom ker deg arg dim Pr');
map('sup inf sech csch');
const functions = new Set('sin cos tan cot sec cosec csc arcsin arccos arctan sinh cosh tanh coth log ln lg exp max min lim det mod gcd asin acos atan lcm hom ker deg arg dim Pr sup inf sech csch'.split(' '));
const limitOperators = new Set(['lim', 'max', 'min']);

const accents = { hat: 'hat', widehat: 'hat', check: 'check', tilde: 'tilde', widetilde: 'tilde', acute: 'acute', grave: 'grave', dot: 'dot', ddot: 'ddot', bar: 'bar', overline: 'bar', vec: 'vec', overrightarrow: 'vec', underline: 'under' };
const styles = { mathbf: 'bold', boldsymbol: 'bold', bm: 'bold', mathrm: 'rm', mathit: 'it', mathnormal: 'it', mathsf: 'rm', mathtt: 'rm', mathbb: 'rm', mathcal: 'it', mathscr: 'it', emph: 'it', textbf: 'bold', textrm: 'rm', textit: 'it' };
const approximate = new Set(['dfrac', 'tfrac', 'dbinom', 'tbinom', 'mathsf', 'mathtt', 'mathbb', 'mathcal', 'mathscr', 'widehat', 'widetilde', 'overrightarrow', 'longleftarrow', 'longrightarrow', 'longleftrightarrow', 'Longleftarrow', 'Longrightarrow', 'Longleftrightarrow']);
const layouts = { matrix: 'matrix', pmatrix: 'pmatrix', bmatrix: 'bmatrix', vmatrix: 'dmatrix', Vmatrix: 'matrix', Bmatrix: 'matrix', smallmatrix: 'matrix', array: 'matrix', cases: 'cases', rcases: 'matrix', align: 'eqalign', 'align*': 'eqalign', aligned: 'eqalign', split: 'eqalign', alignedat: 'eqalign', alignat: 'eqalign', 'alignat*': 'eqalign', gather: 'pile', 'gather*': 'pile', gathered: 'pile', multline: 'lpile', 'multline*': 'lpile', equation: '', 'equation*': '', displaymath: '', math: '' };
const node = (type, fields) => ({ type, ...fields });
const lit = (value) => node('literal', { value });
const group = (body) => node('group', { body });

// Token offsets always refer to the original input (including comments/wrappers).
function tokenize(source) {
  const tokens = [];
  const re = /%[^\r\n]*|\\(?:[a-zA-Z]+|[^\r\n])|\s+|[0-9]+(?:\.[0-9]+)?|[\s\S]/g;
  for (const m of source.matchAll(re)) {
    if (m[0][0] === '%') continue;
    tokens.push({ value: m[0], pos: m.index });
  }
  tokens.push({ value: '', pos: source.length });
  return tokens;
}

class Parser {
  constructor(source) {
    this.source = source;
    this.tokens = tokenize(source);
    this.i = 0;
    this.depth = 0;
    this.warnings = [];
    this.unsupported = [];
  }
  peek() { while (/^\s+$/.test(this.tokens[this.i].value)) this.i++; return this.tokens[this.i]; }
  take() { const t = this.peek(); this.i++; return t; }
  error(message, token = this.peek()) { const e = new Error(message); e.position = token.pos; throw e; }
  expect(value) { const t = this.take(); if (t.value !== value) this.error(`'${value}' 필요`, t); return t; }
  warn(message, token) { this.warnings.push(`${message} (위치 ${token.pos + 1})`); }
  raw() {
    this.expect('{');
    let depth = 1, text = '';
    while (depth) {
      const t = this.tokens[this.i++];
      if (!t || !t.value) this.error('닫히지 않은 텍스트 그룹', t || this.tokens[this.tokens.length - 1]);
      if (t.value === '{') depth++;
      if (t.value === '}') depth--;
      if (depth) text += t.value;
    }
    return text;
  }
  text(value, token) {
    // Quoted HWP strings must never leak structural #, &, braces or commands.
    value = value.replace(/\\([%&#_${} ])/g, '$1');
    if (/["\\\r\n]/.test(value)) this.error('텍스트의 중첩 명령·따옴표·줄바꿈은 지원하지 않습니다', token);
    return node('text', { value });
  }
  arg() {
    const t = this.peek();
    if (!t.value || ['}', '^', '_', '&', '\\\\', '\\end', '\\right'].includes(t.value)) this.error('명령의 인자가 없습니다', t);
    // TeX consumes one token for an unbraced argument: x^12 = (x^1)2.
    if (/^[0-9]/.test(t.value) && t.value.length > 1) {
      this.tokens.splice(this.i, 1, { value: t.value[0], pos: t.pos }, { value: t.value.slice(1), pos: t.pos + 1 });
    }
    return this.atom();
  }
  seq(stop = () => false, table = false) {
    if (++this.depth > 100) this.error('수식 중첩 한도(100)를 초과했습니다');
    const items = [];
    while (this.peek().value && !stop(this.peek().value)) {
      const t = this.peek();
      if (t.value === '^' || t.value === '_') {
        this.take();
        if (!items.length) this.error('첨자 앞에 항이 없습니다', t);
        let base = items.pop();
        if (base.type !== 'script') base = node('script', { base });
        const key = t.value === '^' ? 'sup' : 'sub';
        if (base[key]) this.error('중복 첨자', t);
        base[key] = this.arg(); items.push(base);
      } else if (t.value === "'") {
        if (!items.length) this.error('prime 앞에 항이 없습니다', t);
        let count = 0;
        while (this.peek().value === "'") { this.take(); count++; }
        items.push(node('script', { base: items.pop(), sup: lit(Array(count).fill('prime').join(' ')) }));
      } else if (['&', '\\\\'].includes(t.value)) {
        this.error(table ? '잘못된 행/열 경계' : '행/열 구분자는 정렬·행렬 환경 안에서만 사용하세요', t);
      } else if (['\\over', '\\atop', '\\choose'].includes(t.value)) {
        this.take();
        if (!items.length) this.error('분자 항이 없습니다', t);
        const right = this.seq(stop, table);
        if (!right.items.length) this.error('분모 항이 없습니다', t);
        const left = node('sequence', { items: items.splice(0) });
        items.push(node('fraction', { numerator: left, denominator: right, op: t.value.slice(1) }));
      } else if (['\\rm', '\\it', '\\bf'].includes(t.value)) {
        this.take(); items.push(node('style', { style: t.value === '\\bf' ? 'bold' : t.value.slice(1), body: this.seq(stop, table) }));
      } else items.push(this.atom());
    }
    this.depth--;
    return node('sequence', { items });
  }
  delimiter() {
    const t = this.take();
    const aliases = { '\\{': '{', '\\}': '}', '\\lbrace': '{', '\\rbrace': '}', '\\langle': 'langle', '\\rangle': 'rangle', '\\lfloor': 'lfloor', '\\rfloor': 'rfloor', '\\lceil': 'lceil', '\\rceil': 'rceil', '\\vert': '|', '\\lvert': '|', '\\rvert': '|', '\\Vert': '||', '\\lVert': '||', '\\rVert': '||', '\\|': '||', '\\backslash': 'backslash' };
    if (aliases[t.value]) return aliases[t.value];
    if (['(', ')', '[', ']', '|', '/', '.', '<', '>'].includes(t.value)) return t.value;
    this.error('괄호 기호가 필요합니다', t);
  }
  environment(t) {
    const name = this.raw();
    if (!Object.hasOwn(layouts, name)) this.error(`미지원 환경: ${name}`, t);
    let columns = null;
    if (name === 'array') {
      columns = this.raw().replace(/\s/g, '');
      if (!/^[lcr]+$/.test(columns)) this.error('array는 l/c/r 열 지정만 지원합니다', t);
    }
    if (/^align(?:ed)?at\*?$/.test(name)) {
      const count = this.raw();
      if (!/^[1-9][0-9]*$/.test(count)) this.error('alignat 열 수가 잘못되었습니다', t);
    }
    if (['smallmatrix', 'multline', 'multline*'].includes(name)) this.warn(`${name}: 크기/줄별 정렬을 근사합니다`, t);
    const rows = []; let cells = [];
    for (;;) {
      cells.push(this.seq(v => ['&', '\\\\', '\\end'].includes(v), true));
      const boundary = this.take();
      if (boundary.value === '&') {
        if (!layouts[name] || layouts[name] === 'pile' || layouts[name] === 'lpile') this.error(`${name}에서 &를 사용할 수 없습니다`, boundary);
        continue;
      }
      if (boundary.value === '\\\\') {
        if (!layouts[name]) this.error(`${name}에서 줄바꿈을 사용할 수 없습니다`, boundary);
        rows.push(cells); cells = [];
        if (this.peek().value === '[') {
          this.take(); this.seq(v => v === ']'); this.expect(']');
          this.warn('행간 지정은 기본 행간으로 근사합니다', boundary);
        }
        continue;
      }
      if (boundary.value !== '\\end') this.error(`닫히지 않은 환경: ${name}`, boundary);
      if (this.raw() !== name) this.error(`환경 종료가 일치하지 않습니다: ${name}`, boundary);
      if (cells.length > 1 || cells[0].items.length || !rows.length) rows.push(cells);
      break;
    }
    if (['matrix', 'pmatrix', 'bmatrix', 'dmatrix'].includes(layouts[name])) {
      const width = columns ? columns.length : rows[0].length;
      if (rows.some(r => r.length !== width)) this.error('행렬의 열 개수가 일치하지 않습니다', t);
    }
    return node('layout', { name, command: layouts[name], rows, columns });
  }
  atom() {
    if (++this.depth > 100) this.error('수식 중첩 한도(100)를 초과했습니다');
    const result = this.readAtom(); this.depth--; return result;
  }
  readAtom() {
    const t = this.take(), v = t.value;
    if (v === '{') { const body = this.seq(x => x === '}'); this.expect('}'); return group(body); }
    if (v === '$' || v === '\\(' || v === '\\[') {
      let close = v === '$' ? '$' : v === '\\(' ? '\\)' : '\\]';
      let doubled = false;
      if (v === '$' && this.peek().value === '$') { this.take(); doubled = true; }
      const body = this.seq(x => x === close); this.expect(close);
      if (doubled) this.expect('$');
      return group(body);
    }
    if (v === '\\begin') return this.environment(t);
    if (v === '\\left') {
      const left = this.delimiter();
      const body = this.seq(x => x === '\\right'); this.expect('\\right');
      return node('delimited', { left, right: this.delimiter(), body });
    }
    if (['}', '\\end', '\\right', '\\)', '\\]'].includes(v)) this.error('대응하는 시작 구문이 없습니다', t);
    if (!v || v === '□') this.error('비어 있는 수식 또는 템플릿 칸입니다', t);
    if (!v.startsWith('\\')) {
      if (v === '~') return lit('~');
      if (['#', '"', '`'].includes(v)) this.error('LaTeX 특수문자는 명시적으로 입력하세요', t);
      return lit(v);
    }
    const name = v.slice(1);
    if (approximate.has(name)) this.warn(`\\${name}: HWP의 가까운 표현으로 대체합니다`, t);
    if (Object.hasOwn(symbols, name)) {
      if (functions.has(name)) return node(limitOperators.has(name) ? 'operator' : 'text', { value: name });
      if (['{', '}'].includes(symbols[name])) return lit(`"${symbols[name]}"`);
      return lit(symbols[name]);
    }
    if (['frac', 'dfrac', 'tfrac', 'binom', 'dbinom', 'tbinom'].includes(name)) {
      return node('fraction', { numerator: this.arg(), denominator: this.arg(), op: name.includes('binom') ? 'choose' : 'over' });
    }
    if (name === 'sqrt') {
      let index = null;
      if (this.peek().value === '[') { this.take(); index = this.seq(x => x === ']'); this.expect(']'); }
      return node('root', { index, body: this.arg() });
    }
    if (accents[name]) return node('accent', { command: accents[name], body: this.arg() });
    if (styles[name] && name !== 'textrm') return node('style', { style: styles[name], body: this.arg() });
    if (['text', 'textrm', 'mbox', 'operatorname'].includes(name)) {
      if (name === 'operatorname' && this.peek().value === '*') { this.take(); this.warn('operatorname*: 첨자 위치는 HWP 기본값입니다', t); }
      return this.text(this.raw(), t);
    }
    if (['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle', 'limits', 'nolimits'].includes(name)) {
      this.warn(`\\${name}: 표시 크기/첨자 위치는 HWP 기본값입니다`, t); return lit('');
    }
    if ([',', ':', ';', '!', 'quad', 'qquad', 'enspace', 'thinspace', ' '].includes(name)) {
      // HWP ` is a quarter-space, not a printed comma. Positive math spaces
      // have deterministic equivalents; only discarded negative space warns.
      if (name === '!') { this.warn('\\!: 음수 간격을 생략합니다', t); return lit(''); }
      const widths = { ',': 1, ':': 2, ';': 3, quad: 4, qquad: 8, enspace: 2, thinspace: 1 };
      return lit(name === ' ' ? '~' : '`'.repeat(widths[name]));
    }
    if (['big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr', 'middle'].includes(name)) {
      this.warn(`\\${name}: 괄호 크기를 근사합니다`, t);
      const d = this.delimiter();
      return lit(d === '.' ? '' : ['{', '}'].includes(d) ? `"${d}"` : `bigg ${d}`);
    }
    if (name === 'not') return node('accent', { command: 'not', body: this.arg() });
    if (name === 'pmod') return node('delimited', { left: '(', right: ')', body: node('sequence', { items: [node('text', { value: 'mod' }), this.arg()] }) });
    if (name === 'bmod') return node('text', { value: 'mod' });
    if (name === 'xrightarrow' || name === 'xleftarrow') {
      let below = null;
      if (this.peek().value === '[') { this.take(); below = this.seq(x => x === ']'); this.expect(']'); }
      return node('relation', { arrow: name === 'xrightarrow' ? '->' : '<-', above: this.arg(), below });
    }
    if (['%', '&', '#', '_', '$', '{', '}'].includes(name)) return lit(`"${name}"`);
    if (name === '|') return lit('VERT');
    this.unsupported.push({ command: v, position: t.pos });
    this.error(`미지원 명령: ${v}`, t);
  }
}

function ungroup(n) {
  while (n.type === 'group') n = n.body;
  return n;
}

function emit(n, font = 'it') {
  // Arguments already have their own HWP braces. Reusing the TeX argument's
  // group produced repeated braces at every fraction/root/script boundary.
  const render = x => emit(x, font);
  const wrap = x => `{${render(ungroup(x))}}`;
  const scripts = x => (x.sub ? `_${wrap(x.sub)}` : '') + (x.sup ? `^${wrap(x.sup)}` : '');
  switch (n.type) {
    case 'literal': return n.value;
    case 'text': return `{rm "${n.value}" ${font}}`;
    case 'operator': return `{${n.value} ${font}}`;
    case 'sequence': return n.items.map(render).filter(Boolean).join(' ');
    case 'group': return wrap(n.body);
    case 'fraction': return `{${wrap(n.numerator)} ${n.op} ${wrap(n.denominator)}}`;
    // ROOT ... OF is the script syntax documented in Hancom's equation help.
    // A leading ^ without a base can truncate the surrounding fraction.
    case 'root': return n.index ? `{root ${wrap(n.index)} of ${wrap(n.body)}}` : `sqrt ${wrap(n.body)}`;
    case 'script': return n.base.type === 'operator'
      ? `{${n.base.value}${scripts(n)} ${font}}` : render(n.base) + scripts(n);
    // HWP's rm/it state must be explicitly restored; closing a group alone
    // does not reliably restore it in the user's Hancom 2024 script editor.
    // Restore the enclosing font, including nested mathrm/mathit/text scopes.
    case 'style': {
      const innerFont = n.style === 'bold' ? font : n.style;
      const body = emit(ungroup(n.body), innerFont);
      return n.style === 'bold' ? `{bold {${body}} ${font}}` : `{${innerFont} ${body} ${font}}`;
    }
    case 'accent': return `{${n.command} ${wrap(n.body)}}`;
    case 'delimited': return `left ${n.left} ${render(n.body)} right ${n.right}`;
    case 'relation': return n.below ? `rel ${n.arrow} ${wrap(n.above)} ${wrap(n.below)}` : `buildrel ${n.arrow} ${wrap(n.above)}`;
    case 'layout': {
      let content = n.rows.map(r => r.map(render).join(' & ')).join(' #\n');
      if (n.columns) content = [...n.columns].map((c, i) => `${c === 'l' ? 'lcol' : c === 'r' ? 'rcol' : 'col'} {${n.rows.map(r => render(r[i])).join(' # ')}}`).join(' ');
      const output = n.command ? `${n.command} {${content}}` : content;
      if (n.name === 'Bmatrix') return `left { ${output} right }`;
      if (n.name === 'Vmatrix') return `left || ${output} right ||`;
      if (n.name === 'rcases') return `left . ${output} right }`;
      return output;
    }
    default: throw new Error('Unknown HWP AST node');
  }
}

export const HWP_SUPPORT = Object.freeze({
  exact: Object.freeze([...Object.keys(symbols), ...Object.keys(accents), ...Object.keys(styles)].filter(x => !approximate.has(x))),
  approximate: Object.freeze([...approximate]),
  // All unrecognized commands fail closed; no user-defined macro expansion.
  unsupported: Object.freeze(['newcommand', 'renewcommand', 'def', 'underbrace', 'overbrace', 'color', 'textcolor', 'phantom', 'hphantom', 'vphantom', 'tag', 'label', 'ref', 'include', 'input']),
});

export function latexToHwp(input) {
  const source = typeof input === 'string' ? input : '';
  let parser;
  try {
    if (!source.trim()) throw new Error('수식을 입력하세요');
    if (source.length > 100000) throw new Error('수식 길이 한도(100,000자)를 초과했습니다');
    parser = new Parser(source);
    const ast = parser.seq();
    const script = emit(ast);
    if (!script.trim() || !/[\p{L}\p{N}]/u.test(script.replace(/\{\}|[~`]/g, ''))) throw new Error('복사할 수식이 없습니다');
    const warnings = [...new Set(parser.warnings)];
    return { script, warnings, unsupported: [], errors: [], status: warnings.length ? 'approximate' : 'exact' };
  } catch (e) {
    const position = e.position ?? 0;
    const line = source.slice(0, position).split('\n').length;
    const column = position - source.lastIndexOf('\n', position - 1);
    return { script: '', warnings: parser?.warnings || [], unsupported: parser?.unsupported || [], errors: [{ message: `${e.message} (${line}행 ${column}열)`, position, line, column }], status: 'unsupported' };
  }
}
