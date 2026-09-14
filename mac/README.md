# TeXture for Mac (PowerPoint web add-in)

The Mac add-in is the same editor as on Windows (`../ui/`), running as an Office web add-in:
`ui/index.html?host=ppt&platform=office` loads Office.js and `ui/js/office-host.js` instead of the Windows bridge.

- `manifest.xml` — sideload this file (see the main README). It expects the repository to be published with
  GitHub Pages at `https://allariala.github.io/TeXture/` (Pages source: branch `main`, folder `/ (root)`).
  Hosting elsewhere: replace that base URL in the manifest.
- `assets/` — add-in icons.

Not available on Mac (web add-in limits): screen capture/OCR, Office hotkeys, returning focus to the slide.
Grouped equations are not detected on Mac. Requires PowerPoint for Mac 16.x with PowerPointApi 1.5
(Microsoft 365).
