// Auto-expanding snippets (v1.2 behaviour and defaults, now with undo support and import/export).
// Format: { trigger, replacement, isRegex?, showGuide?, enabled? }. In replacements, $0 is the caret
// and $1..$9 become slots; for regex triggers [[n]] inserts capture group n.

const GREEK = 'alpha|Alpha|beta|Beta|gamma|Gamma|delta|Delta|epsilon|Epsilon|varepsilon|zeta|Zeta|eta|Eta|theta|Theta|vartheta|iota|Iota|kappa|Kappa|lambda|Lambda|mu|Mu|nu|Nu|xi|Xi|omicron|Omicron|pi|Pi|rho|Rho|sigma|Sigma|tau|Tau|upsilon|Upsilon|phi|Phi|varphi|chi|Chi|psi|Psi|omega|Omega|partial';
const SYMBOL = 'infty|pm|mp|dots|nabla|times|cdot|parallel|equiv|neq|geq|leq|gg|ll|sim|simeq|propto|leftrightarrow|to|mapsto|implies|impliedby|cap|cup|in|notin|setminus|subseteq|supseteq|emptyset|exists|forall|approx|therefore|iff|ln|log|min|max|inf|sup|because|sin|cos|tan|atan|asin|acos|sec|csc';

export const DEFAULT_SNIPPETS = [
  { trigger: '\\b(' + GREEK + ')', replacement: '\\[[1]]', isRegex: true, showGuide: 'alpha' },
  { trigger: '\\b(' + SYMBOL + ')', replacement: '\\[[1]]', isRegex: true, showGuide: 'infty, sin' },
  { trigger: '@mk', replacement: '$$0$' },
  { trigger: '@dm', replacement: '$$\n\t$0\n$$' },
  { trigger: '@al', replacement: '\\begin{align*}\n$0\n\\end{align*}' },
  { trigger: '@sum', replacement: '\\sum_{$0}^{$1}' },
  { trigger: '@int', replacement: '\\int_{$0}^{$1}' },
  { trigger: '@lim', replacement: '\\lim_{$0 \\to \\infty}' },
  { trigger: '@prod', replacement: '\\prod_{$0}^{$1}' },
  { trigger: '@([pbBvV]mat)', replacement: '\\begin{[[0]]rix}\n$0 & $1 \\\\\n$2 & $3\n\\end{[[0]]rix}', isRegex: true, showGuide: '@pmat, @bmat' },
  { trigger: '@case', replacement: '\\begin{cases} $0 & \\text{if } $1 \\\\ $2 & \\text{otherwise} \\end{cases}' },
  { trigger: 'mrm', replacement: '\\mathrm{$0}' },
  { trigger: 'mbf', replacement: '\\mathbf{$0}' },
  { trigger: 'mbb', replacement: '\\mathbb{$0}' },
  { trigger: 'mca', replacement: '\\mathcal{$0}' },
  { trigger: 'tt', replacement: '\\text{$0}' },
  { trigger: 'bm', replacement: '\\boldsymbol{$0}' },
  { trigger: '//', replacement: '\\frac{$0}{$1}' },
  { trigger: '^', replacement: '^{$0}' },
  { trigger: '_', replacement: '_{$0}' },
  { trigger: '===', replacement: '\\equiv' },
  { trigger: '!=', replacement: '\\neq' },
  { trigger: '>=', replacement: '\\geq' },
  { trigger: '<=', replacement: '\\leq' },
  { trigger: '>>', replacement: '\\gg' },
  { trigger: '<<', replacement: '\\ll' },
  { trigger: 'simm', replacement: '\\sim' },
  { trigger: 'sim=', replacement: '\\simeq' },
  { trigger: 'prop', replacement: '\\propto' },
  { trigger: 'sq', replacement: '\\sqrt{$0}' },
  { trigger: 'hat', replacement: '\\hat{$0}' },
  { trigger: 'bar', replacement: '\\bar{$0}' },
  { trigger: 'til', replacement: '\\tilde{$0}' },
  { trigger: 'und', replacement: '\\underline{$0}' },
  { trigger: 'ddot', replacement: '\\ddot{$0}' },
  { trigger: 'dot', replacement: '\\dot{$0}' },
  { trigger: 'cdot', replacement: '\\cdot' },
  { trigger: 'cdots', replacement: '\\cdots' },
  { trigger: 'vec', replacement: '\\vec{$0}' },
  { trigger: 'par', replacement: '\\frac{\\partial $0}{\\partial $1}' },
  { trigger: 'avg', replacement: '\\langle $0 \\rangle' },
  { trigger: 'norm', replacement: '\\left\\lVert $0 \\right\\rVert' },
  { trigger: 'lr(', replacement: '\\left( $0 \\right)' },
  { trigger: 'lr{', replacement: '\\left\\{ $0 \\right\\}' },
  { trigger: 'lr[', replacement: '\\left[ $0 \\right]' },
  { trigger: 'lr\\|', replacement: '\\left\\| $0 \\right\\|' },
  { trigger: 'lr|', replacement: '\\left| $0 \\right|' },
  { trigger: 'lr<', replacement: '\\left< $0 \\right>' },
  { trigger: 'ob', replacement: '\\overbrace{$0}^{$1}' },
  { trigger: 'ub', replacement: '\\underbrace{$0}_{$1}' },
];

export function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SNIPPETS));
}

/**
 * Finds the snippet whose trigger ends right before the caret. Returns
 * { start, end, template } or null. Same guards as v1.2: never after a backslash, never in the middle
 * of a word, and plain triggers do not fire after "@".
 */
export function findSnippet(text, caret, snippets) {
  const before = text.slice(0, caret);
  for (const snip of snippets) {
    if (!snip || snip.enabled === false || !snip.trigger) continue;
    let length = 0;
    let match = null;
    if (snip.isRegex) {
      try {
        match = before.match(new RegExp('(?:' + snip.trigger + ')$'));
      } catch { continue; }
      if (match) length = match[0].length;
    } else if (before.endsWith(snip.trigger)) {
      length = snip.trigger.length;
    }
    if (!length) continue;

    const charBefore = before.charAt(before.length - length - 1);
    if (charBefore === '\\') continue;
    if (!snip.trigger.startsWith('@') && charBefore === '@') continue;
    const firstChar = snip.isRegex ? match[0].charAt(0) : snip.trigger.charAt(0);
    if (/[a-zA-Z]/.test(firstChar) && /[a-zA-Z]/.test(charBefore)) continue;

    let template = String(snip.replacement);
    if (snip.isRegex) {
      template = template.replace(/\[\[(\d+)\]\]/g, (m, n) => match[parseInt(n, 10) + 1] || match[0].trim());
    }
    return { start: caret - length, end: caret, template };
  }
  return null;
}

/** Human-readable preview of a snippet result for the guide table. */
export function describeResult(snip) {
  if (snip.isRegex) {
    const guide = snip.showGuide || snip.trigger;
    return guide.split(',').map((g) => '\\' + g.trim().replace(/^@/, '')).join(', ');
  }
  return String(snip.replacement).replace(/\$\d/g, '□').replace(/\n/g, '↵');
}
