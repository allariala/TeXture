# TeXture

**LaTeX equations for PowerPoint and Word** — type LaTeX (or use MathType-style shortcuts), see a live
preview, and insert crisp vector (SVG) equations that stay editable. Windows also includes an offline AI
engine that turns a screenshot of an equation into LaTeX, and a **`hwp`** button that copies editable
Hancom equation script for Hangul 2024.

> 한국어 요약: TeXture는 PowerPoint·Word용 LaTeX 수식 편집기이며, 한글 2024용 수식 스크립트 복사도 지원합니다. 아래 [빠른 설치](#빠른-설치-한국어)를 참고하세요.

| | Windows (2.2.0) | Mac |
|---|---|---|
| PowerPoint | ✅ | ✅ |
| Word | ✅ (incl. equation numbering) | — |
| Hangul 2024 equation script copy | ✅ | — (not verified) |
| Offline screen capture → LaTeX | ✅ | — |
| MathType-style shortcuts, palette, autocomplete, snippets | ✅ | ✅ (same editor) |
| Install | `.exe` installer | sideload `manifest.xml` |

---

## 한글 2024 수식 복사 (2.2.0)

Word 또는 PowerPoint의 TeXture에서 작성한 LaTeX를 **편집 가능한 한컴 수식 스크립트**로 복사합니다.
한글을 직접 실행하거나 커서 위치에 자동 삽입하는 기능은 아닙니다.

1. TeXture 편집기에 LaTeX 수식을 입력합니다.
2. 상단 네 칸 팔레트 아이콘 바로 왼쪽의 소문자 **`hwp`** 버튼을 누릅니다.
3. 한글 2024에서 `Ctrl+N,M`으로 수식 편집기를 엽니다.
4. **스크립트 입력창**에 `Ctrl+V`로 붙여넣고 삽입합니다. 삽입한 수식은 다시 열어 수정할 수 있습니다.

일반 문서 본문에 바로 붙여넣지 말고 수식 편집기의 스크립트 입력창을 사용하세요.
클립보드에는 일반 텍스트만 복사하며 기존 Word/PowerPoint 삽입·복사·단축키는 그대로 사용합니다.

| 지원 범위 | 내용 |
|---|---|
| 기본·연산 | 중첩 분수, 이항계수, 제곱근·n제곱근, 복합 첨자, 그리스 문자, 관계·집합·논리·화살표, 합·곱·다중 적분 |
| 함수·서체 | 삼각·역삼각·쌍곡선·로그·극한, 사용자 이름 연산자, 로만체·이탤릭체·볼드체, hat·bar·vec·dot 등의 장식 |
| 구조 | 행렬, 조건식, `align/aligned/split/gather/equation` 계열, `array`의 `l/c/r` 열 정렬, 수학 래퍼와 텍스트 |
| 간격 | `quad`·`qquad`는 한컴 작은 공백 4개·8개로 변환하며, 양수 수학 간격은 경고 없이 처리 |

동일하게 표현할 수 없는 특수 서체·크기·정렬 등은 근사 변환 경고를 확인한 경우에만 복사합니다.
미지원 명령, 잘못 닫힌 그룹·환경, 행렬 열 개수 불일치는 위치와 원인을 알리고 복사를 중단합니다.
취소·변환 오류 시 기존 클립보드와 편집 내용은 유지됩니다.
사용자 정의 매크로, `underbrace/overbrace`, 색상, phantom, 식 번호·참조, 복잡한 `array` 열 지정은 지원하지 않습니다.
입력은 100,000자, 중첩은 100단계로 제한합니다. 모든 LaTeX 문법의 변환을 보장하지 않습니다.

분수·n제곱근, 연속된 삼각함수, 중첩 서체와 여러 줄 수식의 대표 사례는 한글 2024에서 사용자 확인을 거쳤습니다.
버전이 같은 설치 파일을 다시 설치해도 UI 내용이 바뀌면 캐시를 갱신합니다.

**English:** Click **`hwp`**, immediately left of the four-square palette button, to copy the current
LaTeX as plain-text Hancom equation script. In Hangul 2024, open the equation editor with `Ctrl+N,M`,
paste into its **script input field**, and insert. Nested fractions, indexed roots, scripts, symbols,
functions, scoped fonts, matrices, cases and aligned equations are supported. Approximations require
acknowledgement; unsupported or malformed input stops copying. User-defined macros, braces used as
annotations, colors, phantom, equation references and complex array column specifications are unsupported.
Existing Word/PowerPoint insertion remains available.

공식 참고 자료: [수식 공개 규격 revision 1.3](https://cdn.hancom.com/link/docs/%ED%95%9C%EA%B8%80%EB%AC%B8%EC%84%9C%ED%8C%8C%EC%9D%BC%ED%98%95%EC%8B%9D_%EC%88%98%EC%8B%9D_revision1.3.pdf),
[수식 명령어 설명](https://help.hancom.com/hoffice/multi/ko_kr/hwp/insert/equation/equation%28explanation%29.htm),
[수식 입력과 ROOT 예제](https://help.hancom.com/hoffice130_assistant/ko-KR/Hwp/insert/equation/equation.htm).

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.

## Install on Windows

**Requirements:** 64-bit Windows 10/11, desktop Microsoft 365 / Office 2016 or later (32- or 64-bit),
.NET Framework 4.7.2+, Microsoft Edge WebView2 runtime and the VSTO runtime (all present on current
Windows/Office installations; the installer warns if one is missing).

1. **Uninstalling 1.2.x?** Remove *TeXture (PowerPoint)* and *TeXture (Word)* in *Settings → Apps* first.
2. Download `TeXture_Install_v2.2.0.exe` and its SHA256 checksum from the Releases page.
3. **Close PowerPoint and Word**, then run the installer (administrator rights are required; it installs for
   all users into `C:\Program Files\TeXture`).
4. Start PowerPoint or Word → **TeXture** tab.

**Updating from 2.0.x / 2.1.x:** run the 2.2.0 installer directly; uninstalling first is unnecessary.
Your settings in `%APPDATA%\TeXture` are retained. This release includes the earlier security and Word fixes.

The add-ins, installer, uninstaller and OCR executable are signed with TeXture's own code-signing certificate.
No certificates are added to Trusted Root or Trusted Publishers. VSTO trusts signed add-ins installed
by an administrator under Program Files, so installation is fixed to that location. Upgrading removes the old
TeXture certificate from the machine's trust stores. Self-signing does not provide a publicly verified identity:
Windows/SmartScreen may still warn. Organization policies may require IT administrator approval.

Windows OCR runs locally on CPU. Captures go only to the authenticated 127.0.0.1 service and are deleted after
recognition, including failures. Captures left by forced Office termination are removed on the next capture
once they are more than a day old. Inputs are limited to PNG,
32 MB and 32 megapixels; the distributed engine loads verified weights without executing model objects.

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
2. `TeXture_Install_v2.2.0.exe`와 SHA256 확인 파일을 내려받습니다.
3. **PowerPoint와 Word를 모두 종료**한 뒤 설치 파일을 실행합니다(관리자 권한 필요).
4. PowerPoint/Word의 **TeXture** 탭에서 사용합니다. 설정 → 언어에서 한국어/English를 바꿀 수 있습니다.

**2.0.x / 2.1.x에서 업데이트:** 기존 버전을 제거하지 않고 2.2.0 설치 파일을 바로 실행하면 됩니다.
`%APPDATA%\TeXture`의 사용자 설정은 유지됩니다. 이전 보안 업데이트와 Word 수정 사항도 포함됩니다.

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
tests/              HWP converter regression tests and equation fixtures
TeXture.sln
```

## Local Windows debugging

The HWP converter's 30 code-level regression tests run independently of Office/Hangul with Node.js 22+:

```powershell
node --test tests/hwp.test.mjs
```

After installing the Visual Studio Office/VSTO development tools and the .NET Framework
4.7.2 targeting pack, run this once on a new development PC in Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\installer\setup-dev-signing.ps1
```

This creates or reuses a local code-signing certificate in the current user's personal
store and configures **Debug only** in the ignored `.csproj.user` files for Word and
PowerPoint. It does not change Release signing or trusted root/publisher stores.
Reload the projects in Visual Studio, select `Debug`, set `WordLaTeX` or `PowerLaTeX`
as the startup project, and press F5. Release builds still need the release signing
certificate configured in the project files.

## License

Windows releases include a matching source/dependency/model archive. See
[source availability](SOURCE_AVAILABILITY.md)
and [rebuilding instructions](REBUILDING.md). Keep the source asset beside the installer when distributing it.

MIT — see [LICENSE](LICENSE). Third-party components and the GPL-licensed OCR engine are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
