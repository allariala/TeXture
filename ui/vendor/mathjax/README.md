# MathJax 3.2.2 (vendored)

`tex-svg-full.js` is the single-file MathJax component (TeX input with **all** extensions preloaded +
SVG output with the TeX font). Using the "full" build means nothing is fetched at runtime, so the
editor works fully offline and extensions such as `color`, `cancel`, `mhchem`, `physics`, `mathtools`
and `enclose` are always available.

Source: https://github.com/mathjax/MathJax/tree/3.2.2/es5 — Apache License 2.0.

`safe.js` is the matching official `es5/ui/safe.js` component, loaded locally to filter unsafe
links, CSS identifiers and styles in input mathematics. It requires no network connection.
