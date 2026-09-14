# Changelog

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
