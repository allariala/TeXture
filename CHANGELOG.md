# Changelog

## 2.0.5 (Mac Word web add-in; pending Mac verification)

- Add a neutral zero-width text run after unnumbered centered SVG equations, separating the picture character from the paragraph-ending typing boundary.
- Leave numbered equations, inline equations, SVG data and equation dimensions unchanged.

## 2.0.4 (Mac Word web add-in; pending Mac verification)

- Fix editor focus recovery stealing focus from native numbering dropdowns and from the Word document.
- Remove empty-range OOXML/page-width queries from equation insertion. Use paragraph centering without numbers and margin-relative positional tabs with numbers.
- Detect paragraph-start insertion from its text/pictures rather than comparing zero-length range locations.
- Include the failed insertion stage and native Word error code in error messages; preserve the Enter-related caret/baseline safeguards.
- Use blue Word icons from the existing Windows icon and version the web entry point/changed module chain to avoid mixed cached releases.

## 2.0.3 (Mac Word web add-in; pending Mac verification)

- Add the Windows numbering formats `(1)`, `(1.1)` and `(1.1.1)`, New Chapter, New Section, Update and confirmed Reset in the web editor.
- Preserve Windows-compatible SEQ field names and existing visible numbers when editing equations or resetting counters.
- Center new paragraph-start equations using page-width-aware tab stops, even without numbering; keep text/table insertions inline.
- Clear inherited custom tab stops and isolate SVG character baseline formatting from the next paragraph.
- Place the insertion caret outside the image and clear supported insertion-point baseline formatting; the web add-in does not intercept native Word Enter keys.
- Keep Windows VSTO code and existing PowerPoint insertion unchanged. Mac rendering, field calculation and Enter behavior require manual verification.

## 2.2.0 (Windows)

- Add a lowercase `hwp` button immediately left of the four-square palette icon.
- Convert LaTeX to editable Hancom equation script and copy Unicode text only, preserving existing Office insertion paths.
- Parse nested fractions, roots, scripts, styles, matrices, cases, alignment environments and documented symbols without additional dependencies.
- Use `root {n} of {...}` for indexed roots, preserve fraction grouping, explicitly restore nested italic/roman font scopes, and keep consecutive function names upright.
- Convert positive math spacing without warnings (`quad`/`qquad` → four/eight HWP quarter-spaces).
- Report unsupported syntax with source positions; require acknowledgement of approximations before copying.
- Invalidate the WebView2 UI cache by content as well as version so same-version reinstalls load current files.
- Include 30 regression tests covering the three-line aerodynamic equation, representative equations, font scope, spacing and clipboard safeguards.
- Consolidate HWP usage, support limits and Hancom attribution in README and include it in the installer; remove the separate docs directory.

## 2.1.1 (Windows)

- Word: editing a pasted equation updates that copy without changing the original or leaving an extra picture.
- Word: identify pictures by native ranges/shape IDs instead of copied metadata or managed COM-wrapper references.
- Word: preserve equations when pressing Enter immediately after them, clear inherited baseline offsets, and place the caret after updated equations.
- Keep the existing table baseline workaround and the Program Files deployment without adding root/publisher trust certificates.
- Update the release build for Inno Setup 7 and keep development add-in registration intact during packaging.

## 2.1.0 (Windows)

- Preserve the 2.0.1 editor features while hardening offline OCR and deployment.
- Delete temporary captures on success and failure; use unique names for simultaneous captures.
- Clean up our own abandoned captures older than a day on the next capture.
- Require authentication, reject browser origins, limit PNG size/dimensions and remove legacy OCR fallback.
- Use integrity-checked model weights loaded with `weights_only=True`, without remote model code.
- Update/audit OCR dependencies; restrict WebView2 messages, resources, permissions and downloads.
- Sign the installer, uninstaller and OCR executable. Keep all-users Program Files installation
  without adding root/publisher certificates, and remove legacy TeXture certificate trust on upgrade.

## 2.0.1 (Windows / Mac)

- Snippets and shortcuts no longer add a space after the command (`theta` → `\theta`, `min` → `\min`),
  so subscripts and superscripts can be typed straight after them.
- Mac: the toolbar no longer sits under the task pane's own add-in button.
- The settings button is a gear again (the old icon looked like a light/dark switch).

## 2.0.0 (Windows)

Complete rework of the Windows add-ins on one shared code base.

**New**
- One editor for PowerPoint and Word (sidebar or floating popup), light/dark following the Office theme,
  Korean/English UI.
- MathType-style shortcuts (`Ctrl+G, A` → α, `Ctrl+F` fraction, `Ctrl+R` root, `Ctrl+M, 3, 3` → 3×3 matrix, …)
  with a floating hint palette; ribbon galleries and an in-editor palette with the same symbols.
- LaTeX autocomplete, template slots (□) navigated with Tab, bracket auto-closing, undo-safe snippets.
- Snippet manager with import/export (shared file format for Windows and Mac).
- Drafts and unapplied edits are never lost when you click elsewhere or change slides.
- Font size and colour are remembered globally and stored per equation; colour just a selected part
  (`\textcolor`). Vivid default colours.
- "As new" inserts a copy of the equation being edited next to it.
- Live preview with configurable minimum/maximum size and horizontal scrolling.

**Fixed**
- Grouped equations can be edited; replacing keeps the group, layer order, name and animations (one undo step).
- Editing never deletes the original before the new equation exists.
- After inserting, focus returns to the slide with the equation selected.
- Hotkeys no longer steal Alt+Shift+E/Q/S from other applications, and they work while typing in the editor.
- Capture waits for the OCR engine; the capture button works like the hotkey.
- Word: text typed next to an equation in a table no longer turns white.
- Closing PowerPoint no longer breaks capture in Word; no leaked task panes.

**Installer**
- Single all-users installer with a real uninstaller; it no longer changes machine-wide .NET trust settings
  and never closes Office on its own.

## 1.2.3
- 글꼴 개별 색상 미적용 오류를 수정하였습니다.

## 1.2.2
- 라이트 모드에서 상태바 글씨 색상을 수정하였습니다.
- 프로그램 아이콘을 수정하였습니다.
- 통합 설치 파일로 변경하였습니다.

## 1.2.1
- AI 캡처 모델 압축 (1.16 GB → 450 MB), 캡처 시 로컬 AI 서버 구동, 동적 포트 할당, 상태바 추가.

## 1.2.0
- Windows / Mac 버전 분리, PowerPoint·Word 설치 파일 통합, 수식 캡처 입력(Alt+Shift+S), 편집기 개선.
