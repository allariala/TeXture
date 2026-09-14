# Third-party notices

TeXture itself (add-ins, shared UI, installer scripts) is released under the [MIT License](LICENSE).
It uses or redistributes the following third-party components. Full license texts are in [`licenses/`](licenses).

## Shipped with the add-ins

| Component | Version | License | Where |
|---|---|---|---|
| [MathJax](https://www.mathjax.org/) (`tex-svg-full.js`) | 3.2.2 | Apache License 2.0 — [`licenses/Apache-2.0.txt`](licenses/Apache-2.0.txt) | `ui/vendor/mathjax/` |
| [Microsoft Edge WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2) (`Microsoft.Web.WebView2.*.dll`, `WebView2Loader.dll`) | 1.0.3912.50 | BSD-style Microsoft license — [`licenses/WebView2-SDK-LICENSE.txt`](licenses/WebView2-SDK-LICENSE.txt) | installed next to each add-in |
| Microsoft Visual Studio Tools for Office runtime utilities (`Microsoft.Office.Tools.Common.v4.0.Utilities.dll`) | 10.0 | Redistributable part of the VSTO runtime (Microsoft Software License) | installed next to each add-in |

Not redistributed (must already be on the PC): .NET Framework 4.7.2+, the VSTO runtime, the WebView2 runtime,
Microsoft Office. The ribbon icons are drawn at runtime with the Windows font *Cambria Math* (not shipped).

## Offline OCR engine (`texture_capture.exe`)

The screen-capture recognition engine is a **separate program** (it runs in its own process and talks to the add-in
over a local HTTP connection). Because it bundles texify, the engine binary is distributed under the
**GNU GPL v3** ([`licenses/GPL-3.0.txt`](licenses/GPL-3.0.txt)); its complete source is in
[`windows/capture/`](windows/capture). The MIT license of the rest of TeXture is not affected (mere aggregation).

| Component | License |
|---|---|
| [texify](https://github.com/VikParuchuri/texify) 0.2.1 (code) | GPL-3.0-or-later |
| texify model weights (`vikp/texify` on Hugging Face, quantised copy `texify_model.pt`) | see the [model card](https://huggingface.co/vikp/texify) for the current terms |
| [PyTorch](https://pytorch.org/) | BSD-3-Clause |
| [Hugging Face Transformers](https://github.com/huggingface/transformers) | Apache-2.0 |
| [FastAPI](https://github.com/tiangolo/fastapi) / [Starlette](https://github.com/encode/starlette) | MIT / BSD-3-Clause |
| [Uvicorn](https://github.com/encode/uvicorn) | BSD-3-Clause |
| [Pillow](https://github.com/python-pillow/Pillow) | MIT-CMU (HPND) |
| [PyInstaller](https://pyinstaller.org/) bootloader | GPL-2.0 with the bootloader exception (allows distributing the built exe) |

## Build tools (not redistributed)

[Inno Setup](https://jrsoftware.org/isinfo.php) (installer), Visual Studio / MSBuild, Python.

## Mac web add-in (`mac/`)

Uses MathJax 3 from the jsDelivr CDN (Apache-2.0) and the Office JavaScript API; see `mac/package.json` for the
development dependencies (not shipped to users).
