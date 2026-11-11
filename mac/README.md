# TeXture for Mac — PowerPoint / Word web add-ins

Windows와 같은 `ui/` 편집기를 Office.js로 연결합니다. Windows용 EXE나 인증서 설치는 필요하지 않습니다.
웹 UI를 HTTPS로 불러오므로 인터넷 연결이 필요합니다.

| 프로그램 | 설치할 manifest | 편집기 주소 |
|---|---|---|
| PowerPoint | [`manifest.xml`](manifest.xml) | `ui/index.html?host=ppt&platform=office` |
| Word | [`manifest-word.xml`](manifest-word.xml) | `ui/index.html?host=word&platform=office` |

두 manifest는 서로 다른 추가 기능 ID를 사용합니다. 기존 PowerPoint manifest는 교체할 필요가 없습니다.
Word 지원은 코드·OOXML·프로토콜 검사를 통과했으며, Mac Word 실기 검증은 아직 하지 않았습니다.

## 배포자가 먼저 할 일

이번 변경의 `ui/js/office-host.js`, `ui/js/office-word.js`, `ui/js/bridge.js`와
`mac/manifest-word.xml`을 같은 GitHub Pages 배포에 포함하세요.
manifest만 복사하고 웹 코드를 배포하지 않으면 Word에서 동작하지 않습니다.
현재 기본 주소는 `https://allariala.github.io/TeXture/`이며 Pages 설정은 `main` 브랜치,
`/ (root)`입니다. 다른 주소에 호스팅한다면 manifest의 기본 URL을 모두 변경하세요.
이 작업에서 원격 저장소 push나 사이트 배포는 자동 수행하지 않습니다.

## Mac에 적용하기

1. 최신 Word for Mac을 준비합니다. WordApi 1.3 이상과 SVG 지원이 필요하며, 최신 Microsoft 365를 권장합니다.
2. Word를 완전히 종료합니다.
3. 위의 `manifest-word.xml`을 실제 XML 파일로 저장합니다. GitHub 파일 화면의 HTML이나 `.txt` 파일을 저장하지 마세요.
4. Finder에서 **이동 → 폴더로 이동**을 열어 다음 경로로 이동합니다.

   ```text
   ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
   ```

   폴더가 없으면 생성한 뒤 `manifest-word.xml`을 복사합니다. 터미널에서는 다음 명령으로 생성할 수 있습니다.

   ```sh
   mkdir -p "$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
   ```

5. Word를 실행하고 문서를 엽니다. **홈 → TeXture** 또는
   **삽입 → 추가 기능 → 내 추가 기능**에서 TeXture를 엽니다. Office 버전에 따라 메뉴 이름은 다를 수 있습니다.
6. 수식을 입력한 뒤 **삽입** 또는 편집기 안에서 `Ctrl+Enter`로 커서 위치에 삽입합니다.
7. 삽입된 수식 그림 자체를 선택하면 편집기가 **수정** 모드가 됩니다. 바꾼 뒤 **업데이트**를 누릅니다.
   **+New**는 기존 수식을 남기고 바로 뒤에 새 수식을 삽입합니다.

## Word 수식 번호

WordApi 1.5 이상인 데스크톱 Word에서는 편집기 하단에 **식 번호** 도구가 표시됩니다.
기본 삽입·수정은 WordApi 1.3에서도 사용할 수 있지만, Word 웹 버전과 WordApi 1.5 미지원 버전에는
번호 도구를 표시하지 않습니다. 도구가 보이지 않으면 Word 업데이트와 웹 추가 기능 다시 열기를 확인하세요.

| 도구 | Windows와 같은 동작 |
|---|---|
| 없음 / `(1)` / `(1.1)` / `(1.1.1)` | 번호 없음 / 문서 전체 / 장별 / 장·절별 번호 |
| 새 장 | 현재 커서 뒤에 숨은 Chapter 증가 필드를 넣고 Section·EqCh·EqSec 카운터 초기화 |
| 새 절 | 현재 커서 뒤에 숨은 Section 증가 필드를 넣고 EqSec 카운터 초기화 |
| 번호 갱신 | 본문의 잠기지 않은 필드 갱신 |
| 전체 초기화 | 확인 후 숨은 TeXture 카운터 제어 필드만 제거하고 문서 시작에서 모든 카운터를 0으로 초기화 |

1. `(1.1)` 또는 `(1.1.1)`을 사용할 경우 해당 장의 시작 위치에서 **새 장**을 누릅니다.
   절별 번호라면 절의 시작 위치에서 **새 절**도 누릅니다. 이 버튼은 제목이나 Word 구역 나누기를 만들지 않습니다.
2. 표 밖 문단 시작에 커서를 두고 수식을 삽입합니다. 가운데 탭에 수식, 오른쪽 탭에 번호가 들어가며
   다음 문단으로 커서가 이동합니다. **없음**을 선택해도 문단 시작 수식의 가운데 정렬은 유지됩니다.
3. 본문 중간과 표 안에서는 Windows처럼 인라인 수식으로 삽입하며 번호를 붙이지 않습니다.
4. 기존 수식의 **업데이트**는 그림만 교체해 옆의 번호를 유지합니다. 번호 형식 선택은 새로 삽입하는 수식에 적용됩니다.
5. 수식을 삭제하거나 옮긴 뒤 **번호 갱신**을 누릅니다. **전체 초기화** 후 처음 누르는 **새 장**은 1부터 시작합니다.

카운터 이름과 필드 코드는 Windows와 같습니다: `EqGlobal`, `Chapter`, `Section`, `EqCh`, `EqSec`.
문서에 저장되는 실제 Word `SEQ` 필드이므로 단순 텍스트 번호가 아닙니다.
Windows의 리본 대신 웹 편집기 하단에서 조작합니다. 번호 형식 선택은 이 웹 추가 기능의 설정으로 저장됩니다.

문단 너비·탭 정렬과 번호 계산은 실제 Mac Word에서 확인해야 합니다. 이전 버전과 달리 삽입 뒤 커서를
그림 밖의 텍스트 범위로 이동하고 다음 문단의 기준선 서식을 초기화합니다. Windows의 네이티브 Enter
키보드 훅을 웹 추가 기능에 이식한 것은 아닙니다. 사용자가 그림을 다시 선택한 상태에서 Enter를 누르는
Word 자체 동작까지 가로채지는 않습니다. 오류 안내가 나오면 그림 선택을 해제하고 뒤쪽 본문에서 입력하세요.

PowerPoint도 같은 절차로 `manifest.xml`을 다음 폴더에 복사합니다.

```text
~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef
```

추가 기능이 보이지 않으면 Word를 완전히 종료한 뒤 파일 위치·확장자와 Pages 배포 완료 여부를 확인하세요.
Office 연결 오류가 나면 오류를 표시하며, 가짜 문서 편집 모드로 전환하지 않습니다.
제거할 때는 해당 앱을 종료하고 복사한 manifest 파일을 삭제합니다. 문서 안의 수식은 유지됩니다.

공식 적용 안내: [Sideload Office Add-ins on Mac](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac).
이 방식은 수동 사이드로딩이며 Microsoft Marketplace 등록·인증을 의미하지 않습니다.

## 지원 범위

- 공통 편집기: LaTeX 미리보기, 팔레트, 편집기 내부 단축키, 자동완성, 스니펫.
- Word: 인라인 SVG 수식 삽입·재편집, 크기·색상, PNG 호환 미리보기. LaTeX와 메타데이터는
  Windows Word와 같은 `PLX:` 대체 텍스트 / `TeXture:` JSON 제목 형식으로 문서에 저장합니다.
- 기존 Windows 인라인 수식도 위 메타데이터가 유지되어 있으면 읽고 수정할 수 있도록 구현했습니다.
  실제 Mac↔Windows 문서 왕복 검증은 아래 절차로 확인하세요.
- 웹 설정·스니펫은 Office 웹뷰의 로컬 저장소에 보관합니다. Word와 PowerPoint의 작성 중 상태는 분리됩니다.
  Windows EXE의 `%APPDATA%` 설정을 자동 가져오지는 않습니다.
- 화면 캡처/OCR, Office 문서에 포커스가 있을 때의 네이티브 단축키, 문서로 강제 포커스 복귀는 지원하지 않습니다.
- Word의 식 번호는 위 도구로 지원하며 실제 Mac 검증은 진행 전입니다. 떠 있는 수식 그림은 지원하지 않습니다.
  선택을 해제한 수식을 다시 찾는 범위는 본문 인라인 그림입니다. 머리글·각주 등의 수식은 별도 검증 대상입니다.
- PowerPoint의 그룹 내부 수식 감지 제한은 기존과 같습니다. PowerPointApi 1.5가 필요합니다.
- HWP 복사는 공통 UI에 있지만 Mac 클립보드 권한 및 한글 프로그램에서의 실제 동작은 검증하지 않았습니다.

## Mac Word에서 확인할 항목

1. 새 `.docx`에서 분수·행렬·여러 줄·한글 포함 수식을 삽입하고 주변 문장·표가 유지되는지 확인합니다.
2. 수식을 선택해 LaTeX·크기·색상을 수정합니다. **+New**가 원본을 남기는지도 확인합니다.
3. 일반 텍스트나 다른 그림을 선택한 채 새 수식을 삽입해 기존 내용이 삭제되지 않는지 확인합니다.
4. 수식 복사·붙여넣기 후 각각 수정하고, 수식을 삭제한 뒤의 오래된 수정 요청이 다른 수식을 바꾸지 않는지 확인합니다.
5. 저장·재실행 후 다시 편집하고, Windows TeXture와 문서를 왕복해 크기·색상·SVG·메타데이터 보존을 확인합니다.
6. 기존 PowerPoint 추가 기능의 삽입·수정도 확인합니다. Word 코드는 Word에서만 불러옵니다.
7. 세 번호 형식과 새 장·새 절·갱신·초기화를 확인하고, Windows에서 만든 번호 문서도 왕복 확인합니다.
8. 번호 **없음**에서도 문단 시작 수식이 가운데 정렬되는지 확인합니다. 사용자 지정 탭이 있는 문단도 확인합니다.
9. 수식 삽입·수정 직후 본문에서 Enter를 눌러 그림 크기·비율·벡터 내용이 유지되고 다음 문단의 글자가 위아래로 치우치지 않는지 확인합니다.

Office 없이 실행하는 회귀 검사:

```sh
node --test tests/office-word.test.mjs
```

자동 검사는 메타데이터·OOXML 생성과 Word API 호출 흐름을 검증합니다.
실제 Mac Office의 렌더링·선택 이벤트·문서 저장 결과를 대신하지 않습니다.
