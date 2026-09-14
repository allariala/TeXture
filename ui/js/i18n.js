// Tiny i18n: Korean / English. Static markup uses data-i18n / data-i18n-title / data-i18n-placeholder /
// data-i18n-aria; code calls t('key', {vars}). The language is a user setting (settings.json).

const D = {
  // toolbar / editor
  'size.title': ['글꼴 크기 (pt) — Ctrl+Shift+, / Ctrl+Shift+.', 'Font size (pt) — Ctrl+Shift+, / Ctrl+Shift+.'],
  'size.down': ['작게', 'Smaller'],
  'size.up': ['크게', 'Larger'],
  'colors.title': ['색상 — 편집기에서 텍스트를 선택한 뒤 누르면 선택 부분만 색이 바뀝니다', 'Colour — with text selected in the editor, only the selection is coloured'],
  'color.custom': ['사용자 지정 색', 'Custom colour'],
  'color.Black': ['검정', 'Black'], 'color.Red': ['빨강', 'Red'], 'color.Green': ['초록', 'Green'],
  'color.Blue': ['파랑', 'Blue'], 'color.Orange': ['주황', 'Orange'], 'color.Magenta': ['자홍', 'Magenta'],
  'palette.toggle': ['기호 팔레트 열기/닫기', 'Show/hide the symbol palette'],
  'capture.title': ['화면 수식 캡처 (Alt+Shift+S)', 'Capture an equation from the screen (Alt+Shift+S)'],
  'settings.title': ['설정 · 스니펫 · 단축키', 'Settings · snippets · shortcuts'],
  'editor.placeholder': ['LaTeX 입력…  예: \\frac{a}{b}   ·   Ctrl+G, A → α   ·   \\ 입력 시 자동완성', 'Type LaTeX…  e.g. \\frac{a}{b}   ·   Ctrl+G, A → α   ·   \\ for autocomplete'],
  'preview.resize': ['드래그하여 미리보기 크기 조절', 'Drag to resize the preview'],
  'preview.empty': ['미리보기', 'Preview'],
  'btn.insert': ['삽입', 'Insert'],
  'btn.update': ['업데이트', 'Update'],
  'btn.new': ['새로 삽입', 'As new'],
  'btn.new.title': ['선택한 수식은 그대로 두고, 현재 내용을 새 수식으로 옆에 삽입합니다', 'Insert the current text as a new equation next to the selected one (the original stays)'],
  'btn.revert': ['되돌리기', 'Revert'],
  'btn.revert.title': ['이 수식의 변경 사항을 되돌립니다', 'Discard the changes to this equation'],
  'btn.clear.title': ['입력 지우기 (Ctrl+Z로 되돌릴 수 있음)', 'Clear the editor (Ctrl+Z to undo)'],
  'mode.new': ['새 수식', 'New equation'],
  'mode.edit': ['수식 편집 중', 'Editing equation'],
  'mode.legacy': ['편집 중 (v1.2 수식)', 'Editing (v1.2 equation)'],
  'mode.new.title': ['새 수식 — 입력 내용은 자동 저장됩니다.', 'New equation — your text is saved automatically.'],
  'mode.edit.title': ['문서에서 선택한 수식을 편집 중입니다. 다른 곳을 클릭해도 변경 내용은 보존됩니다.', 'Editing the selected equation. Changes are kept when you click elsewhere.'],
  'mode.unsaved': ['적용되지 않은 변경 사항', 'Unapplied changes'],
  'status.pending': ['적용되지 않은 수식 변경 {n}개 보존 중', '{n} unapplied equation edit(s) kept'],
  'server.title': ['오프라인 AI 수식 인식 엔진', 'Offline AI equation recognition'],
  'server.ready': ['OCR 준비됨', 'OCR ready'],
  'server.starting': ['OCR 시작 중…', 'OCR starting…'],
  'server.busy': ['인식 중…', 'Recognising…'],
  'server.offline': ['OCR 꺼짐', 'OCR offline'],
  // toasts
  'toast.texError': ['수식 오류: {msg}', 'LaTeX error: {msg}'],
  'toast.colorApplied': ['선택한 부분에 색을 적용했습니다.', 'Colour applied to the selection.'],
  'toast.migrated': ['v1.2에서 편집한 스니펫을 불러왔습니다.', 'Imported your snippets from v1.2.'],
  'toast.error': ['오류가 발생했습니다.', 'Something went wrong.'],
  'toast.recognising': ['수식을 인식하는 중…', 'Recognising the equation…'],
  'toast.captured': ['캡처한 수식을 입력했습니다. 확인 후 Ctrl+Enter로 삽입하세요.', 'Captured equation added — check it, then Ctrl+Enter to insert.'],
  'toast.ocrWarming': ['AI 인식 엔진을 준비하는 중입니다. 준비되면 캡처 화면이 열립니다…', 'Starting the recognition engine — the capture overlay opens when it is ready…'],
  'toast.snippetsSaved': ['스니펫을 저장했습니다.', 'Snippets saved.'],
  'toast.hotkeyInvalid': ['Ctrl 또는 Alt와 영문/숫자 키 조합을 사용하세요.', 'Use Ctrl or Alt with a letter or digit.'],
  'toast.needTrigger': ['트리거와 결과를 입력하세요.', 'Enter a trigger and a result.'],
  'toast.jsonError': ['JSON 오류: {msg}', 'JSON error: {msg}'],
  // palette / popups
  'palette.recent': ['최근', 'Recent'],
  'palette.recentEmpty': ['최근 삽입한 수식이 여기에 표시됩니다.', 'Equations you insert appear here.'],
  'palette.recentTip': ['클릭: 편집기에 불러오기', 'Click to load into the editor'],
  'group.structures': ['분수·첨자', 'Fractions & Scripts'], 'group.brackets': ['괄호', 'Brackets'],
  'group.calculus': ['미적분', 'Calculus'], 'group.matrices': ['행렬', 'Matrices'], 'group.accents': ['악센트', 'Accents'],
  'group.greek': ['그리스 문자', 'Greek'], 'group.operators': ['연산자', 'Operators'], 'group.relations': ['관계', 'Relations'],
  'group.arrows': ['화살표', 'Arrows'], 'group.sets': ['집합·논리', 'Sets & Logic'], 'group.misc': ['기타', 'Misc'],
  'ac.footer': ['↑↓ 선택 · Enter/Tab 입력 · Esc 닫기', '↑↓ choose · Enter/Tab accept · Esc close'],
  'chord.hint': ['다음 키를 누르거나 클릭하세요 · Esc 취소', 'Press the next key or click · Esc cancels'],
  'chord.oneshot': ['{name} — 다음 글자를 누르세요 · Esc 취소', '{name} — press the next character · Esc cancels'],
  'chord.matrix': ['행렬', 'Matrix'],
  'chord.matrixHint': ['행, 열 숫자 입력 (예: 3 3) 또는 클릭 · Esc 취소', 'Type rows then columns (e.g. 3 3) or click · Esc cancels'],
  'prefix.C:KeyG': ['그리스 문자', 'Greek'], 'prefix.C:KeyK': ['기호', 'Symbols'], 'prefix.CS:KeyK': ['연산자·논리', 'Operators & logic'],
  'prefix.C:KeyT': ['템플릿', 'Templates'], 'prefix.CS:KeyI': ['적분', 'Integrals'], 'prefix.CS:Digit6': ['위/아래 줄', 'Over / under bars'],
  'prefix.C:Digit6': ['장식', 'Embellishments'], 'prefix.C:Period': ['말줄임표', 'Ellipses'], 'prefix.C:KeyD': ['칠판 굵은체', 'Blackboard bold'],
  'prefix.C:KeyB': ['굵게', 'Bold'],
  // settings
  'set.tab.general': ['일반', 'General'], 'set.tab.snippets': ['스니펫', 'Snippets'], 'set.tab.shortcuts': ['단축키', 'Shortcuts'],
  'set.sec.appearance': ['화면', 'Appearance'], 'set.sec.workflow': ['작업 방식', 'Workflow'], 'set.sec.preview': ['미리보기', 'Live preview'],
  'set.sec.hotkeys': ['Office 단축키', 'Office hotkeys'],
  'set.language': ['언어', 'Language'],
  'set.theme': ['테마', 'Theme'], 'set.theme.hint': ['Auto는 Office 테마를 따릅니다.', 'Auto follows the Office theme.'],
  'set.afterInsert': ['삽입 후 포커스', 'Focus after inserting'],
  'set.afterInsert.hint': ['기본값: {doc}로 돌아가 수식이 선택된 상태 (방향키로 이동, Ctrl+D로 복제)', 'Default: back to the {doc} with the equation selected (arrow keys move it, Ctrl+D duplicates)'],
  'set.afterInsert.doc': ['{doc}로', 'To {doc}'], 'set.afterInsert.editor': ['편집기 유지', 'Stay in editor'],
  'doc.ppt': ['슬라이드', 'slide'], 'doc.word': ['문서', 'document'],
  'set.defaultSize': ['새 수식 기본 크기 (pt)', 'Default size for new equations (pt)'],
  'set.defaultSize.hint': ['마지막으로 사용한 크기가 자동으로 저장됩니다.', 'The last size you used is remembered.'],
  'set.previewMin': ['미리보기 최소 크기 (pt)', 'Preview minimum size (pt)'],
  'set.previewMin.hint': ['긴 수식은 이 크기까지만 줄어들고, 그 이상은 가로로 스크롤됩니다.', 'Long equations shrink down to this size, then scroll horizontally.'],
  'set.previewMax': ['미리보기 최대 크기 (pt)', 'Preview maximum size (pt)'],
  'set.snippets': ['스니펫 자동 확장', 'Auto-expand snippets'], 'set.snippets.hint': ['alpha → \\alpha, // → 분수 등', 'alpha → \\alpha, // → fraction, …'],
  'set.autocomplete': ['명령 자동완성', 'Command autocomplete'], 'set.autocomplete.hint': ['\\ 뒤에 영문을 입력하면 후보를 보여줍니다.', 'Suggestions after typing \\ and letters.'],
  'set.autoPair': ['괄호 자동 닫기', 'Auto-close brackets'], 'set.autoPair.hint': ['{ ( [ 입력 시 짝을 자동으로 넣습니다.', 'Typing { ( [ inserts the closing pair.'],
  'set.chords': ['MathType 단축키', 'MathType shortcuts'], 'set.chords.hint': ['Ctrl+G, A → α 등 (단축키 탭 참고)', 'Ctrl+G, A → α, … (see Shortcuts)'],
  'set.hk.pane': ['사이드바 열기', 'Open the sidebar'], 'set.hk.pane.hint': ['편집기 안에서도 동작합니다.', 'Also works while typing in the editor.'],
  'set.hk.popup': ['팝업 편집기 열기', 'Open the popup editor'], 'set.hk.capture': ['화면 수식 캡처', 'Capture from screen'],
  'set.hk.listen': ['키를 누르세요…', 'Press keys…'],
  'set.hk.title': ['클릭한 뒤 새 단축키를 누르세요 (Ctrl 또는 Alt 포함). Esc: 취소', 'Click, then press the new shortcut (with Ctrl or Alt). Esc cancels'],
  'set.about': ['TeXture {v} · 설정: %APPDATA%\\TeXture · 로그: %LOCALAPPDATA%\\TeXture\\logs', 'TeXture {v} · settings: %APPDATA%\\TeXture · logs: %LOCALAPPDATA%\\TeXture\\logs'],
  'snip.search': ['스니펫 검색…', 'Search snippets…'], 'snip.table': ['표', 'Table'],
  'snip.resetConfirm': ['모든 스니펫을 기본값으로 되돌릴까요?', 'Reset all snippets to the defaults?'],
  'snip.col.on': ['사용', 'On'], 'snip.col.trigger': ['트리거', 'Trigger'], 'snip.col.result': ['결과', 'Result'],
  'snip.delete': ['삭제', 'Delete'], 'snip.add': ['추가', 'Add'],
  'snip.trigger.ph': ['트리거 (예: RR)', 'Trigger (e.g. RR)'],
  'snip.result.ph': ['결과 (예: \\mathbb{R}, $0 = 커서, $1 = 빈칸)', 'Result (e.g. \\mathbb{R}; $0 = caret, $1 = slot)'],
  'snip.hint': ['내보낸 파일은 Windows와 Mac 사이에서 공유할 수 있습니다 (texture-snippets JSON).', 'Exported files can be shared between Windows and Mac (texture-snippets JSON).'],
  'snip.save': ['저장', 'Save'],
  'snip.err.array': ['최상위 값은 배열이어야 합니다.', 'The top level must be an array.'],
  'snip.err.item': ['{n}번째 항목에 trigger/replacement가 없습니다.', 'Item {n} has no trigger/replacement.'],
  'sc.search': ['단축키 또는 기호 검색 (예: gamma, Ctrl+K)…', 'Search shortcuts or symbols (e.g. gamma, Ctrl+K)…'],
  'sc.editor': ['편집기', 'Editor'], 'sc.office': ['Office (사이드바 / 팝업 / 캡처)', 'Office (sidebar / popup / capture)'],
  'sc.single': ['MathType 한 번에 누르는 단축키', 'MathType single-stroke'],
  'sc.letter': ['<글자>', '<letter>'],
  'sc.k.insert': ['수식 삽입 / 업데이트', 'Insert / update the equation'],
  'sc.k.esc': ['슬라이드(문서)로 돌아가기 — 입력 내용은 유지', 'Back to the slide/document — your text is kept'],
  'sc.k.tab': ['다음 / 이전 빈칸(□)으로 이동, 괄호 밖으로 나가기', 'Next / previous slot (□), or out of the bracket'],
  'sc.k.ac': ['LaTeX 명령 자동완성', 'LaTeX command autocomplete'],
  'sc.k.pair': ['괄호 자동 닫기 · 선택 영역 감싸기', 'Auto-close brackets · wrap the selection'],
  'sc.k.undo': ['실행 취소 / 다시 실행 (스니펫 확장 포함)', 'Undo / redo (including snippet expansion)'],
  'sc.k.color': ['선택한 부분만 색 지정 (\\textcolor)', 'Colour only the selection (\\textcolor)'],
  'sc.k.colorKey': ['텍스트 선택 + 색상 클릭', 'Select text + click a colour'],
  'sc.k.matrix': ['행렬 (예: Ctrl+M, 3, 3 → 3×3 bmatrix)', 'Matrix (e.g. Ctrl+M, 3, 3 → 3×3 bmatrix)'],
  'sc.k.pane': ['사이드바 열기', 'Open the sidebar'], 'sc.k.popup': ['팝업 편집기', 'Popup editor'], 'sc.k.capture': ['화면 수식 캡처', 'Capture from screen'],
};

let lang = 'ko';

export function defaultLanguage() {
  return (navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function setLanguage(value) {
  lang = value === 'en' ? 'en' : 'ko';
  document.documentElement.lang = lang;
}

export function getLanguage() { return lang; }

export function t(key, vars) {
  const entry = D[key];
  let s = entry ? entry[lang === 'en' ? 1 : 0] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

/** Applies translations to static markup. */
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
