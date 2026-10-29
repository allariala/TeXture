# Offline OCR build (2.1)

The distributed engine uses texify 0.2.1's architecture and preprocessing with security-patched
libraries. The upstream package's old Pillow/Transformers upper bounds are deliberately overridden;
the compatibility adapter is `OfflineProcessor` in `texture_capture.py`. Keep those tested pins.
Python 3.13 x64 is used for the Windows CPU build; Windows x64 is required for OCR.

Create `windows/capture/.venv`, then use its Python:

```powershell
python -m pip install -r windows/capture/requirements-runtime.txt
python -m pip install --no-deps texify==0.2.1
python -m pip install pyinstaller==6.20.0 pyinstaller-hooks-contrib==2026.4
```

Model preparation is a maintainer-only operation. `convert_model.py` must run in the original
trusted model's build environment (texify 0.2.1 / Transformers 4.37.2), with the known local
`texify_model.pt`. Never run the converter on an untrusted downloaded/uploaded model. It produces
`texify_weights.pt` and `models/model_config.json`. The deployed engine only reads the weights using
`weights_only=True` and checks the compiled-in SHA256; it does not execute a pickled model object.
The large weight files stay outside Git. Corresponding model files must accompany a binary release.

The normal Windows installer build regenerates `model_integrity.py`, builds OCR, signs the OCR
executable, builds signed VSTO manifests and signs the installer/uninstaller:

```powershell
pwsh windows/installer/build.ps1
```

It requires Visual Studio Office build tools, Inno Setup 7 (or compatible 6), the Windows SDK signing tool and the
private signing key in the maintainer's Windows certificate store. The key is never distributed.
The self-signed public certificate is shipped for inspecting signatures; no global trust is installed.

Before packaging, use pip-audit against `requirements-runtime.txt` and the build environment,
and verify the packaged engine's authenticated PNG input and equation recognition. The build
virtual environment is not bundled into the release. For GPL compliance distribute the engine's
corresponding source and exact dependency source/version information with the release; the TeXture
repository alone does not include the source of every third-party library.

For a distributable release, use the PowerShell 7 wrapper instead:

```powershell
pwsh windows/installer/package-release.ps1
```

This collects versioned dependency sources and notices, builds the signed installer,
then creates its matching `TeXture_Source_v<version>.zip` and `SHA256SUMS_v<version>.txt`.
`-SkipOcrBuild` reuses the existing engine only when OCR sources/model are unchanged.
Upload both binary and source assets; see `RELEASE_UPLOAD.md`. The model derivative
is CC BY-SA 4.0 as described in `MODEL_NOTICE.md`, not GPL or the application's MIT license.
