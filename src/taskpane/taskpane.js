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

let currentHost = null;
let activeMathShapeId = null; 

// ==========================================
// 스니펫 데이터
// ==========================================
const GREEK = "alpha|Alpha|beta|Beta|gamma|Gamma|delta|Delta|epsilon|Epsilon|varepsilon|zeta|Zeta|eta|Eta|theta|Theta|vartheta|iota|Iota|kappa|Kappa|lambda|Lambda|mu|Mu|nu|Nu|xi|Xi|omicron|Omicron|pi|Pi|rho|Rho|sigma|Sigma|tau|Tau|upsilon|Upsilon|phi|Phi|varphi|chi|Chi|psi|Psi|omega|Omega|partial";
const SYMBOL = "infty|pm|mp|dots|nabla|times|cdot|parallel|equiv|neq|geq|leq|gg|ll|sim|simeq|propto|leftrightarrow|to|mapsto|implies|impliedby|cap|cup|in|notin|setminus|subseteq|supseteq|emptyset|exists|forall|approx|therefore|iff|ln|log|min|max|inf|sup|because";

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
    { trigger: "txt", replacement: "\\text{$0}" },
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
    };
});

customColorInput.oninput = (e) => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    document.querySelector('.color-dot:last-of-type').classList.add('active');
    activeColor = e.target.value;
};

fontSizeInput.oninput = updatePreview;

editor.onkeydown = (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        activeMathShapeId = null;
        editor.value = "";
        updatePreview();
        editor.blur();
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
    if (snippetToggle.checked) handleSnippets();
    updatePreview();
};

// ==========================================
// 개체 삽입 로직
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

        svgClone.querySelectorAll('path, rect').forEach(el => {
            el.setAttribute('fill', activeColor);
            el.setAttribute('stroke', 'none');
        });
        svgClone.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
            });
        });

        const finalSvg = svgClone.outerHTML
            .replace(/fill="currentColor"/g, "")
            .replace(/stroke="currentColor"/g, "")
            .replace(/currentColor/g, activeColor);

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
    } catch (e) { }

    Office.context.document.setSelectedDataAsync(
        svgString,
        { coercionType: Office.CoercionType.XmlSvg },
        async function (asyncResult) {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
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
                    });
                } catch (err) {
                    console.error("후처리 에러:", err);
                } finally {
                    isInsertingProcess = false;
                    editor.focus();
                }
            } else {
                isInsertingProcess = false;
            }
        }
    );
}

// ==========================================
// 역참조 및 홀드 해제 로직
// ==========================================
function clearEditorStateSafely() {
    if (!document.hasFocus()) {
        if (editor.value !== "") {
            editor.value = "";
            updatePreview();
        }
        activeMathShapeId = null;
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
        });
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
        });
    } catch (e) { 
        clearEditorStateSafely();
    } 
}

// ==========================================
// 렌더링 및 스니펫
// ==========================================
function updatePreview() {
    const tex = editor.value.replace(/\$\$/g, "");
    preview.style.fontSize = fontSizeInput.value + "pt";
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    preview.style.color = isDark ? "#ffffff" : "#000000";

    if (window.MathJax && window.MathJax.tex2svgPromise) {
        MathJax.texReset();
        MathJax.tex2svgPromise(tex).then(node => {
            preview.innerHTML = '';
            preview.appendChild(node);
        }).catch(err => { });
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

            // [오타 수정] -len 대신 -matchedLen으로 정확히 치환!
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