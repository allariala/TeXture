// 전역 변수 설정
const editor = document.getElementById('editor');
const preview = document.getElementById('math-preview');
const fontSizeInput = document.getElementById('fontSize');
const snippetToggle = document.getElementById('snippetToggle');
const previewPane = document.getElementById('preview-pane');
const resizer = document.getElementById('resizer');
const customColorInput = document.getElementById('customColorInput');
const btnInsert = document.getElementById('btnInsert');

let activeColor = "#000000";
let isResizing = false;
let isInsertingProcess = false; 

// [복구 완료] 백스페이스 감지용 플래그
let isDeleting = false; 

let currentHost = null;
let activeMathShapeId = null; 

// ==========================================
// 스니펫 데이터
// ==========================================
const GREEK = "alpha|Alpha|beta|Beta|gamma|Gamma|delta|Delta|epsilon|Epsilon|varepsilon|zeta|Zeta|eta|Eta|theta|Theta|vartheta|iota|Iota|kappa|Kappa|lambda|Lambda|mu|Mu|nu|Nu|xi|Xi|omicron|Omicron|pi|Pi|rho|Rho|sigma|Sigma|tau|Tau|upsilon|Upsilon|phi|Phi|varphi|chi|Chi|psi|Psi|omega|Omega|partial";
const SYMBOL = "infty|pm|mp|dots|nabla|times|cdot|parallel|equiv|neq|geq|leq|gg|ll|sim|simeq|propto|leftrightarrow|to|mapsto|implies|impliedby|cap|cup|in|notin|setminus|subseteq|supseteq|emptyset|exists|forall|approx|therefore|iff|ln|log|min|max|inf|sup|because|sin|cos|tan|atan|asin|acos|sec|csc";

const defaultSnippets = [
    { trigger: "\\b(" + GREEK + ")", replacement: "\\[[1]]", isRegex: true, showGuide: "alpha" },
    { trigger: "\\b(" + SYMBOL + ")", replacement: "\\[[1]]", isRegex: true, showGuide: "infty, sum" },
    { trigger: "@mk", replacement: "$$0$" },
    { trigger: "@dm", replacement: "$$\n\t$0\n$$" },
    { trigger: "@al", replacement: "\\begin{align*}\n$0\n\\end{align*}" },
    { trigger: "@sum", replacement: "\\sum_{$0}^{}" },
    { trigger: "@int", replacement: "\\int_{$0}^{}" },
    { trigger: "@lim", replacement: "\\lim_{$0 \\to \\infty}" },
    { trigger: "@prod", replacement: "\\prod_{$0}^{}" },
    { trigger: "@([pbBvV]mat)", replacement: "\\begin{[[0]]rix}\n$0 & & \\\\ \n & &\n\\end{[[0]]rix}", isRegex: true, showGuide: "@pmat, @bmat" },
    { trigger: "@case", replacement: "\\begin{cases} $0 & \\text{if } $1 \\\\ $2 & \\text{otherwise} \\end{cases}" },
    { trigger: "mrm", replacement: "\\mathrm{$0}" },
    { trigger: "mbf", replacement: "\\mathbf{$0}" },
    { trigger: "mbb", replacement: "\\mathbb{$0}" },
    { trigger: "mca", replacement: "\\mathcal{$0}" },
    { trigger: "tt", replacement: "\\text{$0}" },
    { trigger: "bm", replacement: "\\boldsymbol{$0}" },
    { trigger: "//", replacement: "\\frac{$0}{$1}" },
    { trigger: "^", replacement: "^{$0}" },
    { trigger: "_", replacement: "_{$0}" },
    { trigger: "===", replacement: "\\equiv" },
    { trigger: "!=", replacement: "\\neq" },
    { trigger: ">=", replacement: "\\geq" },
    { trigger: "<=", replacement: "\\leq" },
    { trigger: ">>", replacement: "\\gg" },
    { trigger: "<<", replacement: "\\ll" },
    { trigger: "simm", replacement: "\\sim" },
    { trigger: "sim=", replacement: "\\simeq" },
    { trigger: "prop", replacement: "\\propto" },
    { trigger: "sq", replacement: "\\sqrt{$0}" },
    { trigger: "hat", replacement: "\\hat{$0}" },
    { trigger: "bar", replacement: "\\bar{$0}" },
    { trigger: "til", replacement: "\\tilde{$0}" },
    { trigger: "und", replacement: "\\underline{$0}" },
    { trigger: "ddot", replacement: "\\ddot{$0}" },
    { trigger: "dot", replacement: "\\dot{$0}" },
    { trigger: "cdot", replacement: "\\cdot" },
    { trigger: "cdots", replacement: "\\cdots" },
    { trigger: "vec", replacement: "\\vec{$0}" },
    { trigger: "par", replacement: "\\frac{\\partial $0}{\\partial }" },
    { trigger: "avg", replacement: "\\langle $0 \\rangle" },
    { trigger: "norm", replacement: "\\left\\lVert $0 \\right\\rVert" },
    { trigger: "lr(", replacement: "\\left( $0 \\right)" },
    { trigger: "lr{", replacement: "\\left\\{ $0 \\right\\}" },
    { trigger: "lr[", replacement: "\\left[ $0 \\right]" },
    { trigger: "lr|", replacement: "\\left| $0 \\right|" },
    { trigger: "lr<", replacement: "\\left< $0 \\right>" },
    { trigger: "ob", replacement: "\\overbrace{$0}^{$1}" },
    { trigger: "ub", replacement: "\\underbrace{$0}_{$1}" }
];

// ==========================================
// 깜빡임 로직
// ==========================================
function triggerBlink() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (currentHost === Office.HostType.PowerPoint) {
        editor.style.backgroundColor = isDark ? "#5c2312" : "#fbeae6";
    } else {
        editor.style.backgroundColor = isDark ? "#004080" : "#e8f4fd";
    }
    setTimeout(() => { editor.style.backgroundColor = ""; }, 400);
}

// 💡 강제 초기화
window.clearEditorState = function() {
    activeMathShapeId = null;
    editor.value = "";
    updatePreview();
    editor.focus();
}

// ==========================================
// 초기화
// ==========================================
Office.onReady((info) => {
    currentHost = info.host;
    
    const eventHandlerCallback = function(result) {
        if (result.status === Office.AsyncResultStatus.Failed) {
            console.warn("이벤트 등록 지연:", result.error.message);
        }
    };

    if (currentHost === Office.HostType.PowerPoint) {
        document.body.classList.add('host-powerpoint');
        document.getElementById('fontSize').value = 24;
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged, 
            onSelectionChangedPPT, 
            eventHandlerCallback
        );
    } else {
        document.getElementById('fontSize').value = 11;
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged, 
            onSelectionChangedWord, 
            eventHandlerCallback
        );
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    btnInsert.innerText = isMac ? "Insert (Cmd+Enter)" : "Insert (Ctrl+Enter)";
    btnInsert.onclick = insertVector;

    window.MathJax = { options: { enableMenu: false }, svg: { fontCache: 'none' } };
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
    script.async = true;
    document.head.appendChild(script);
    script.onload = () => { 
        renderGuideTable(); 
        updatePreview(); 
    };
});

// ==========================================
// UI & 에디터 로직
// ==========================================
resizer.onmousedown = () => { isResizing = true; document.body.style.userSelect = 'none'; };
window.onmouseup = () => { isResizing = false; document.body.style.userSelect = 'auto'; };
window.onmousemove = (e) => {
    if (!isResizing) return;
    const footerHeight = document.querySelector('.footer').offsetHeight;
    const newHeight = window.innerHeight - e.clientY - footerHeight;
    if (newHeight > 50 && newHeight < window.innerHeight * 0.8) previewPane.style.height = newHeight + 'px';
};

document.querySelectorAll('.color-dot[data-color]').forEach(dot => {
    dot.onclick = function () {
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        this.classList.add('active');
        activeColor = this.dataset.color;
        updatePreview();
    };
});

customColorInput.oninput = (e) => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    document.querySelector('.color-dot:last-of-type').classList.add('active');
    activeColor = e.target.value;
    updatePreview();
};

fontSizeInput.oninput = updatePreview;

editor.onkeydown = (e) => {
    // 💡 [복구 완료] 백스페이스/딜리트 시 isDeleting 플래그 켜기
    if (e.key === 'Backspace' || e.key === 'Delete') {
        isDeleting = true;
    } else {
        isDeleting = false;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        clearEditorStateSafely(true); // 강제 해제
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const pos = editor.selectionStart;
        const textAfter = editor.value.substring(pos);
        const matchIndex = textAfter.search(/[}\)\]]/);
        if (matchIndex !== -1) {
            const newPos = pos + matchIndex + 1;
            editor.setSelectionRange(newPos, newPos);
        } else {
            document.execCommand('insertText', false, '    ');
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        insertVector();
    }
};

editor.oninput = () => {
    if (editor.value.trim() === "") activeMathShapeId = null; 
    // 💡 방어막 적용! 지우는 중이 아닐 때만 스니펫 동작
    if (snippetToggle.checked && !isDeleting) handleSnippets();
    updatePreview();
};

// ==========================================
// 💡 개체 삽입 로직
// ==========================================
async function insertVector() {
    if (isInsertingProcess) return; 
    const tex = editor.value.replace(/\$\$/g, "");
    if (!tex.trim()) return;

    isInsertingProcess = true;
    const fontSizePt = parseInt(fontSizeInput.value) || (currentHost === Office.HostType.PowerPoint ? 24 : 11);

    try {
        MathJax.texReset();
        const node = await MathJax.tex2svgPromise(tex);
        const originalSvg = node.querySelector('svg');
        if (!originalSvg) throw new Error("SVG generation failed");

        const svgClone = originalSvg.cloneNode(true);
        const viewBoxAttr = originalSvg.getAttribute('viewBox');

        if (viewBoxAttr) {
            const viewBox = viewBoxAttr.split(' ').map(parseFloat);
            const MATHJAX_EX = 430.554;
            const ptToPx = 1.333;
            const svgUnitsToPx = ((fontSizePt * (MATHJAX_EX / 1000)) * ptToPx) / MATHJAX_EX;

            svgClone.setAttribute('width', (viewBox[2] * svgUnitsToPx).toFixed(4) + 'px');
            svgClone.setAttribute('height', (viewBox[3] * svgUnitsToPx).toFixed(4) + 'px');
        }

        // ── 색상 및 선 처리 ────────────────────────────────────────
        const MIN_BORDER_THICKNESS = 60; // 얇은 선 기준을 60으로 설정하여 PPT 렌더링 증발 방지

        svgClone.querySelectorAll('path, rect, line, polyline, polygon').forEach(el => {
            const tag = el.tagName.toLowerCase();

            if (tag === 'rect') {
                const h = parseFloat(el.getAttribute('height') || '0');
                const w = parseFloat(el.getAttribute('width') || '0');
                const isThinH = h > 0 && h < MIN_BORDER_THICKNESS;
                const isThinW = w > 0 && w < MIN_BORDER_THICKNESS;

                if (isThinH || isThinW) {
                    // 얇은 사각형(테두리/분수선) 처리
                    el.setAttribute('fill', activeColor);
                    el.setAttribute('stroke', 'none');
                    el.setAttribute('shape-rendering', 'crispEdges'); // ✨ 핵심: 선 뭉개짐(안티앨리어싱) 방지

                    // 두께를 60으로 키우되, 원래 중심축을 유지하도록 좌표(x, y) 보정
                    if (isThinH) {
                        const oldY = parseFloat(el.getAttribute('y') || '0');
                        el.setAttribute('y', String(oldY - (MIN_BORDER_THICKNESS - h) / 2));
                        el.setAttribute('height', String(MIN_BORDER_THICKNESS));
                    }
                    if (isThinW) {
                        const oldX = parseFloat(el.getAttribute('x') || '0');
                        el.setAttribute('x', String(oldX - (MIN_BORDER_THICKNESS - w) / 2));
                        el.setAttribute('width', String(MIN_BORDER_THICKNESS));
                    }
                } else {
                    // 두꺼운 사각형(배경색 등)
                    const existingFill = el.getAttribute('fill') || '';
                    if (existingFill !== 'none' && existingFill !== 'transparent') {
                        el.setAttribute('fill', activeColor);
                    }
                    el.setAttribute('stroke', 'none');
                }

            } else if (tag === 'line' || tag === 'polyline') {
                el.setAttribute('stroke', activeColor);
                el.setAttribute('fill', 'none');
                el.setAttribute('shape-rendering', 'crispEdges'); // 선 요소 뭉개짐 방지

                const sw = parseFloat(el.getAttribute('stroke-width') || '0');
                if (sw < MIN_BORDER_THICKNESS) {
                    el.setAttribute('stroke-width', String(MIN_BORDER_THICKNESS));
                }

            } else if (tag === 'path') {
                const existingStroke = el.getAttribute('stroke');
                if (existingStroke && existingStroke !== 'none') {
                    // 테두리 역할을 하는 path
                    el.setAttribute('stroke', activeColor);
                    el.setAttribute('shape-rendering', 'crispEdges'); // 뭉개짐 방지

                    const sw = parseFloat(el.getAttribute('stroke-width') || '0');
                    if (sw < MIN_BORDER_THICKNESS) {
                        el.setAttribute('stroke-width', String(MIN_BORDER_THICKNESS));
                    }
                } else {
                    // 일반 글자/수식 글리프
                    el.setAttribute('fill', activeColor);
                    el.setAttribute('stroke', 'none');
                }

            } else {
                // 그 외 요소
                el.setAttribute('fill', activeColor);
                el.setAttribute('stroke', 'none');
            }
        });

        // ── data-* 속성 제거 ───────────────────────────────────────
        svgClone.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
            });
        });

        // ── currentColor 치환 후 전송 ──────────────────────────────
        const finalSvg = svgClone.outerHTML.replace(/currentColor/g, activeColor);

        if (currentHost === Office.HostType.PowerPoint) {
            await performReplacementPPT(tex, finalSvg);
        } else {
            isInsertingProcess = false; 
        }

    } catch (err) {
        console.error("MathJax Error:", err);
        isInsertingProcess = false;
    }
}

// ==========================================
// 파워포인트 삽입 및 데이터 보존 로직
// ==========================================
async function performReplacementPPT(latexCode, svgString) {
    let targetLeft = -1, targetTop = -1;
    let existingShapeIds = [];

    try {
        await PowerPoint.run(async (context) => {
            const slide = context.presentation.getSelectedSlides().getItemAt(0);
            const allShapes = slide.shapes;
            allShapes.load("items");
            await context.sync();

            if (activeMathShapeId) {
                const oldShape = allShapes.getItemOrNullObject(activeMathShapeId);
                oldShape.load(["left", "top"]);
                await context.sync();

                if (!oldShape.isNullObject) {
                    targetLeft = oldShape.left;
                    targetTop = oldShape.top;
                }
            }

            const remainingShapes = slide.shapes;
            remainingShapes.load("items");
            await context.sync();
            existingShapeIds = remainingShapes.items.map(s => s.id);
        });
    } catch (e) {
        console.warn("삽입 전 동기화 오류:", e);
    }

    Office.context.document.setSelectedDataAsync(
        svgString,
        { coercionType: Office.CoercionType.XmlSvg },
        function (asyncResult) {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                setTimeout(async () => {
                    try {
                        await PowerPoint.run(async (context2) => {
                            const slide = context2.presentation.getSelectedSlides().getItemAt(0);
                            const allShapes = slide.shapes;
                            allShapes.load("items");
                            await context2.sync();

                            const newShape = allShapes.items.find(s => !existingShapeIds.includes(s.id));

                            if (newShape) {
                                newShape.altTextDescription = "PLX:" + latexCode;
                                newShape.name = "PLX:" + latexCode; 
                                newShape.tags.add("PowerLaTeX_Code", latexCode); 
                                
                                if (targetLeft !== -1 && targetTop !== -1) {
                                    newShape.left = targetLeft;
                                    newShape.top = targetTop;
                                }
                                
                                newShape.load("id");

                                if (activeMathShapeId) {
                                    const oldShapeToKill = slide.shapes.getItemOrNullObject(activeMathShapeId);
                                    oldShapeToKill.delete();
                                }

                                await context2.sync(); 
                                activeMathShapeId = newShape.id; 
                            }
                        }).catch(e => { console.warn("Webpack Overlay 방지용 억제:", e); }); // 빨간 에러 억제
                    } catch (err) {
                        console.error("후처리 에러:", err);
                    } finally {
                        isInsertingProcess = false;
                        editor.focus();
                    }
                }, 50); 
            } else {
                isInsertingProcess = false;
            }
        }
    );
}

// ==========================================
// 역참조 및 홀드 해제 로직
// ==========================================
function clearEditorStateSafely(force = false) {
    if (force || !document.hasFocus()) {
        if (editor.value !== "") {
            editor.value = "";
            updatePreview();
        }
        activeMathShapeId = null;
        if (force) editor.blur();
    }
}

async function onSelectionChangedPPT() {
    if (isInsertingProcess) return;

    try {
        await PowerPoint.run(async (context) => {
            const shapes = context.presentation.getSelectedShapes();
            shapes.load("items");
            await context.sync();

            if (shapes.items.length === 1) {
                const shape = shapes.items[0];
                shape.load(["id", "name", "altTextDescription", "tags"]);
                await context.sync();

                shape.tags.load("items");
                await context.sync();

                let latex = "";
                if (shape.altTextDescription && shape.altTextDescription.startsWith("PLX:")) {
                    latex = shape.altTextDescription.substring(4);
                } else if (shape.name && shape.name.startsWith("PLX:")) {
                    latex = shape.name.substring(4);
                } else {
                    const tag = shape.tags.items.find(t => t.key === "PowerLaTeX_Code");
                    if (tag) latex = tag.value;
                }

                if (latex) {
                    if (editor.value !== latex) {
                        editor.value = latex;
                        triggerBlink(); 
                    }
                    activeMathShapeId = shape.id; 
                    updatePreview();
                } else {
                    clearEditorStateSafely();
                }
            } else {
                clearEditorStateSafely();
            }
        }).catch(e => { console.warn("Webpack Overlay 방지용 억제:", e); }); // 빨간 에러 억제
    } catch (e) {
        clearEditorStateSafely();
    }
}

async function onSelectionChangedWord() {
    if (currentHost !== Office.HostType.Word) return;
    try {
        await Word.run(async (context) => {
            const pics = context.document.getSelection().inlinePictures;
            pics.load("items");
            await context.sync();
            if (pics.items.length > 0) {
                const pic = pics.items[0];
                pic.load("altTextTitle");
                await context.sync();
                if (pic.altTextTitle?.startsWith("PLX:")) {
                    const latex = pic.altTextTitle.substring(4);
                    if (document.getElementById('editor').value !== latex) {
                        document.getElementById('editor').value = latex;
                        triggerBlink();
                    }
                    updatePreview();
                }
            } else {
                clearEditorStateSafely();
            }
        }).catch(e => { console.warn("Webpack Overlay 방지용 억제:", e); }); // 빨간 에러 억제
    } catch (e) { 
        clearEditorStateSafely();
    } 
}

// ==========================================
// 렌더링 및 스니펫 
// ==========================================
function updatePreview() {
    const tex = editor.value.replace(/\$\$/g, "");
    
    // 1. 기본 폰트 크기 설정
    const defaultSize = 18;
    const minSize = 12;
    preview.style.fontSize = defaultSize + "pt";

    // 2. 다크모드 색상 반전 로직 (검정색 선택 시 프리뷰만 흰색으로)
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let displayColor = activeColor;
    if (isDark && (activeColor === "#000000" || activeColor.toLowerCase() === "#000")) {
        displayColor = "#ffffff";
    }
    preview.style.color = displayColor;

    if (window.MathJax && window.MathJax.tex2svgPromise) {
        MathJax.texReset();
        MathJax.tex2svgPromise(tex).then(node => {
            preview.innerHTML = '';
            preview.appendChild(node);

            // 3. ✨ 미리보기 창 초과 시 글자 크기 자동 축소 로직
            const mathWidth = node.getBoundingClientRect().width;
            const availableWidth = previewPane.clientWidth - 30; // 좌우 패딩 15px씩 제외

            // 수식 너비가 가용 너비보다 클 경우 비율에 맞춰 축소
            if (mathWidth > availableWidth && availableWidth > 0) {
                const scaleRatio = availableWidth / mathWidth;
                let newSize = Math.floor(defaultSize * scaleRatio);
                
                // 아무리 길어도 최소 12pt 밑으로는 작아지지 않도록 방어
                newSize = Math.max(minSize, newSize);
                preview.style.fontSize = newSize + "pt";
            }
        }).catch(err => { 
            // 타이핑 중 발생하는 일시적인 문법 오류는 무시
        });
    }
}

function toggleGuide(show) {
    document.getElementById('guide-modal').style.display = show ? 'flex' : 'none';
}

function handleSnippets() {
    const pos = editor.selectionStart;
    const text = editor.value;
    const before = text.substring(0, pos);
    const after = text.substring(pos);

    for (const snip of defaultSnippets) {
        let matchedLen = 0, matchResult = null;
        if (snip.isRegex) {
            const regex = new RegExp(snip.trigger + "$");
            matchResult = before.match(regex);
            if (matchResult) matchedLen = matchResult[0].length;
        } else if (before.endsWith(snip.trigger)) {
            matchedLen = snip.trigger.length;
        }

        if (matchedLen > 0) {
            const charBeforeMatch = before.charAt(before.length - matchedLen - 1);
            
            // 백슬래시, 단어 경계 방어막
            if (charBeforeMatch === '\\') continue;
            const isAtSnippet = snip.trigger.startsWith("@");
            if (!isAtSnippet && charBeforeMatch === '@') continue;
            const triggerStartChar = snip.isRegex ? matchResult[0].charAt(0) : snip.trigger.charAt(0);
            if (/[a-zA-Z]/.test(triggerStartChar) && /[a-zA-Z]/.test(charBeforeMatch)) continue;

            let replRaw = snip.replacement;
            if (snip.isRegex) {
                replRaw = replRaw.replace(/\[\[(\d+)\]\]/g, (m, p1) => matchResult[parseInt(p1) + 1] || matchResult[0].trim());
            }

            let cleanRepl = replRaw.replace(/\$[1-9]/g, "");
            const targetPos = cleanRepl.indexOf("$0");
            cleanRepl = cleanRepl.replace(/\$0/g, "");

            editor.value = before.slice(0, -matchedLen) + cleanRepl + after;
            const newCursorPos = pos - matchedLen + (targetPos !== -1 ? targetPos : cleanRepl.length);
            editor.selectionStart = editor.selectionEnd = newCursorPos;
            return;
        }
    }
}

function renderGuideTable() {
    document.getElementById('guide-content').innerHTML = defaultSnippets.map(s => {
        let triggerText = s.isRegex ? (s.showGuide || s.trigger) : s.trigger;
        let displayTrigger = triggerText.endsWith(" ") ? triggerText.trim() + " ␣" : triggerText;
        let resultPreview = s.isRegex && triggerText.includes(",") 
            ? triggerText.split(", ").map(ex => "\\" + ex.trim()).join(", ")
            : s.isRegex ? "\\" + triggerText.trim() : s.replacement.replace(/\$[0-9]/g, "■").replace(/\n/g, "↵");
        return `<tr><td><code>${displayTrigger}</code></td><td><code class="code-result">${resultPreview}</code></td></tr>`;
    }).join('');
}