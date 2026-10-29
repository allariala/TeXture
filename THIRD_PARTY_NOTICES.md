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
**GNU GPL v3** ([`licenses/GPL-3.0.txt`](licenses/GPL-3.0.txt)); TeXture's engine source and dependency pins are in
[`windows/capture/`](windows/capture). A binary release must also provide the corresponding source for its
bundled GPL dependencies; see [`windows/capture/BUILD.md`](windows/capture/BUILD.md).
The companion `TeXture_Source_v2.1.1.zip` supplies a matching source snapshot,
exact-version dependency source archives and model/configuration material.
Obtain it beside the installer at https://github.com/allariala/TeXture/releases/tag/v2.1.1
(or the same release's Assets list if that URL has not yet been published).
See `SOURCE_AVAILABILITY.md`, `REBUILDING.md` and `SOURCE_INDEX.json` in the source archive.
The add-ins and OCR are separately licensed programs communicating through a local HTTP API;
the MIT license does not replace the OCR or third-party license terms.

| Component | License |
|---|---|
| [texify](https://github.com/VikParuchuri/texify) 0.2.1 (code) | GPL-3.0-or-later |
| texify model weights and derivative/configuration material (`vikp/texify`, `texify_weights.pt`) | CC BY-SA 4.0 — attribution and conversion details in `MODEL_NOTICE.md`; full terms in `licenses/CC-BY-SA-4.0.txt` |
| [PyTorch](https://pytorch.org/) | Main project BSD-3-Clause; the distributed wheel also contains third-party code under additional licenses. Its complete collected notices are under `licenses/ocr/`. |
| [Hugging Face Transformers](https://github.com/huggingface/transformers) | Apache-2.0 |
| [FastAPI](https://github.com/tiangolo/fastapi) / [Starlette](https://github.com/encode/starlette) | MIT / BSD-3-Clause |
| [Uvicorn](https://github.com/encode/uvicorn) | BSD-3-Clause |
| [Pillow](https://github.com/python-pillow/Pillow) | MIT-CMU (HPND) |
| [PyInstaller](https://pyinstaller.org/) bootloader | GPL-2.0 with the bootloader exception (allows distributing the built exe) |

Complete collected upstream license directories, package metadata and source archive
identities are installed under `licenses/ocr/`. These include native-component
notices shipped with the PyTorch and NumPy distributions; their terms are not
replaced by the short component summaries above. CPython's source/license and
the PyInstaller bootloader source/license/exception accompany the source asset.
The source asset includes the exact shipped model derivative under CC BY-SA 4.0;
its earlier quantization recipe was not recorded in the inherited project.

## Build tools (not redistributed)

[Inno Setup](https://jrsoftware.org/isinfo.php) (installer), Visual Studio / MSBuild, Python.

## Mac web add-in (`mac/`)

Uses the shared vendored MathJax 3.2.2 (Apache-2.0) and the Microsoft-hosted Office JavaScript API.
The editor is served by GitHub Pages; unlike Windows, the Mac version requires network access.
