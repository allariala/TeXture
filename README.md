# TeXture

**LaTeX equations for PowerPoint and Word** — type LaTeX (or use MathType-style shortcuts), see a live
preview, and insert crisp vector (SVG) equations that stay editable. Windows also includes an offline AI
engine that turns a screenshot of an equation into LaTeX.

> 한국어 요약: TeXture는 PowerPoint·Word용 LaTeX 수식 편집기입니다. 아래 [빠른 설치](#빠른-설치-한국어)를 참고하세요.

| | Windows (2.0) | Mac |
|---|---|---|
| PowerPoint | ✅ | ✅ |
| Word | ✅ (incl. equation numbering) | — |
| Offline screen capture → LaTeX | ✅ | — |
| MathType-style shortcuts, palette, autocomplete, snippets | ✅ | ✅ (same editor) |
| Install | `.exe` installer | sideload `manifest.xml` |

---

## Install on Windows

**Requirements:** Windows 10/11, desktop Microsoft 365 / Office 2016 or later (32- or 64-bit),
.NET Framework 4.7.2+, Microsoft Edge WebView2 runtime and the VSTO runtime (all present on current
Windows/Office installations; the installer warns if one is missing).

1. **Uninstalling 1.2.x?** Remove *TeXture (PowerPoint)* and *TeXture (Word)* in *Settings → Apps* first.
2. Download `TeXture_Install_v2.0.1.exe` from the Releases page.
3. **Close PowerPoint and Word**, then run the installer (administrator rights are required; it installs for
   all users into `C:\Program Files\TeXture`).
4. Start PowerPoint or Word → **TeXture** tab.

The add-ins are signed with TeXture's own code-signing certificate (CN=TeXture Add-in Signing, valid until 2126).
The installer registers it in the PC's *Trusted Root Certification Authorities* and *Trusted Publishers* stores
(announced on the installer's Ready page), so every Windows user can use TeXture without security prompts and the
installation never expires. The certificate is not a CA and is only valid for code signing; uninstalling TeXture
(*Settings → Apps → TeXture*) removes it again.

### Using it
| | |
|---|---|
| Sidebar / popup editor | `Alt+Shift+E` / `Alt+Shift+Q` (ribbon: *Sidebar*, *Popup*) |
| Insert / update | `Ctrl+Enter` — afterwards the equation is selected on the slide (move it with the arrow keys, `Ctrl+D` duplicates) |
| Back to the slide without inserting | `Esc` (your text is kept) |
| Edit an equation | click it (also inside groups) — the editor switches to *Update* |
| Screen capture → LaTeX | `Alt+Shift+S` or the capture button (first start of the AI engine takes a while) |
| MathType shortcuts | `Ctrl+G, A` → α, `Ctrl+F` fraction, `Ctrl+R` root, `Ctrl+H`/`Ctrl+L` super/subscript, `Ctrl+M, 3, 3` → 3×3 matrix … (Settings → Shortcuts lists all) |
| Snippets | `alpha` → `\alpha`, `//` → fraction, `lr(` → `\left( \right)` … editable, import/export in Settings |
| Colour part of an equation | select text in the editor, click a colour |

Settings are stored in `%APPDATA%\TeXture`, logs in `%LOCALAPPDATA%\TeXture\logs`.

## Install on Mac

The Mac version is the same editor as on Windows, running as an Office web add-in for PowerPoint (online;
no screen capture, no Office hotkeys, no grouped-equation detection). It is served from
`https://allariala.github.io/TeXture/ui/` (this repository on GitHub Pages).

1. Download [`mac/manifest.xml`](mac/manifest.xml) (2.0 — **users of 1.x must replace their old manifest with this one**).
2. In Finder choose *Go → Go to Folder…* and open
   `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef` (create the `wef` folder if it does not exist).
3. Copy `manifest.xml` into that folder (replace the old file) and restart PowerPoint.
4. *Home → TeXture*, or *Insert → Add-ins → My Add-ins* → **TeXture**.

Publishing (maintainer): push this repository to `allariala/TeXture` and enable GitHub Pages for branch `main`,
folder `/ (root)`. Equations made on Mac and Windows are interchangeable (same `TEXTURE_*` tags and alt text).

---

## 빠른 설치 (한국어)

**Windows**
1. 이전 버전(1.2.x)이 있다면 *설정 → 앱*에서 *TeXture (PowerPoint)*, *TeXture (Word)*를 먼저 제거합니다.
2. `TeXture_Install_v2.0.1.exe`를 내려받습니다.
3. **PowerPoint와 Word를 모두 종료**한 뒤 설치 파일을 실행합니다(관리자 권한 필요).
4. PowerPoint/Word의 **TeXture** 탭에서 사용합니다. 설정 → 언어에서 한국어/English를 바꿀 수 있습니다.

**Mac** — Windows와 같은 편집기입니다(화면 캡처·단축키 제외). 2.0의 `mac/manifest.xml`을
`~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef` 폴더에 복사(기존 파일 교체)하고 PowerPoint를
다시 시작한 뒤 *홈 → TeXture* 또는 *삽입 → 추가 기능 → 내 추가 기능*에서 TeXture를 선택합니다.

---

## Repository layout

```
ui/                 shared editor UI (HTML/CSS/JS, MathJax): Windows (WebView2) and Mac (Office.js, ui/js/office-host.js)
windows/
  TeXture.Core/     shared C# engine: runtime, WebView2 host, settings, capture service, ribbon icons
  PowerPoint/       VSTO add-in (PowerPoint adapter + ribbon)
  Word/             VSTO add-in (Word adapter + ribbon, equation numbering)
  capture/          offline OCR engine (Python, texify) — GPL-3.0, see THIRD_PARTY_NOTICES.md
  installer/        Inno Setup script, build.ps1, new-signing-cert.ps1
mac/                Mac web add-in manifest + icons
tools/serve-ui.py   run the editor UI in a browser with a mock Office host
TeXture.sln
```

## License

MIT — see [LICENSE](LICENSE). Third-party components and the GPL-licensed OCR engine are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
