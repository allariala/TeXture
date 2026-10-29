# Rebuilding the 2.1.1 Windows release

The companion `TeXture_Source_v2.1.1.zip` contains the TeXture source snapshot,
exact-version upstream source archives under `third-party-sources/`, model weights
and configuration, licenses, and `SOURCE_INDEX.json` (archive URLs, versions,
revisions and SHA256). `SOURCE_FILES.sha256` inventories the source snapshot.

The Word/PowerPoint add-ins and shared UI are MIT-licensed. The offline OCR
program's source is GPL-3.0-or-later (see `windows/capture/LICENSE`), with its
upstream components retaining their own notices. Model/configuration material is
CC BY-SA 4.0; see `windows/capture/MODEL_NOTICE.md`. The components have different
licenses; the application's MIT license does not override third-party licenses.

## Build environment

- Windows x64; Visual Studio with Office/VSTO development tools and .NET Framework
  4.7.2 targeting pack; Windows SDK signing tool; Inno Setup 7 (or compatible 6).
- CPython 3.13.9 x64, PyInstaller 6.20.0, pyinstaller-hooks-contrib 2026.4.
- Runtime versions are pinned in `windows/capture/requirements-runtime.txt`.
- PyTorch is the CPU build, 2.14.1+cpu; its actual source commit is recorded in
  `SOURCE_INDEX.json`, with Git submodule source archives and their placement paths.
- Office, VSTO Runtime, .NET Framework and WebView2 Runtime are prerequisites,
  not open-source files provided by this archive. WebView2 SDK binaries are
  redistributed under their included Microsoft license.

Use a clean virtual environment; do not copy the original maintainer's `.venv`:

```powershell
py -3.13 -m venv windows/capture/.venv
windows/capture/.venv/Scripts/python.exe -m pip install torch==2.14.1+cpu --index-url https://download.pytorch.org/whl/cpu
windows/capture/.venv/Scripts/python.exe -m pip install -r windows/capture/requirements-runtime.txt
windows/capture/.venv/Scripts/python.exe -m pip install --no-deps texify==0.2.1
windows/capture/.venv/Scripts/python.exe -m pip install pyinstaller==6.20.0 pyinstaller-hooks-contrib==2026.4
```

The included archives supply corresponding source for inspection/modification.
They are not wheels: building native dependencies from those sources also needs
their documented compiler/build tools. Preserve the pinned versions when using
upstream binary wheels instead. Extract PyTorch and its Git submodule archives
into the `source_path` locations recorded in `SOURCE_INDEX.json` if rebuilding it.
Some submodules reuse the same source archive in multiple locations. The public
Git tree snapshots in `third-party-sources/git-trees/` preserve every gitlink's
path and commit SHA; together with each upstream `.gitmodules` file they identify
all placements, including reused submodules.
The native tokenizers, safetensors, pydantic-core and hf-xet modules also have Rust
dependencies. Their resolved Cargo.lock registry/git source archives are included
in `third-party-sources/` and indexed with checksums. Rust toolchains are build
prerequisites, not included executable installers. The package-release wrapper
runs `prepare-rust-sources.ps1` before packaging so these sources/notices are retained.

The exact distributed model is already included as `windows/capture/texify_weights.pt`.
No download of a potentially changed model and no unpickling of a legacy model is
needed. `convert_model.py` documents the earlier maintainer-only conversion; do
not run it on an untrusted pickle. Model lineage limits are described in the model notice.

## Building and signing

Generate your own signing key; the maintainer's private key is neither included
nor required to modify or rebuild the programs:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File windows/installer/new-signing-cert.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File windows/installer/build.ps1
```

The build creates the OCR executable, builds both Release add-ins, signs their
manifests and the installer/uninstaller with timestamps, and creates the Inno
Setup EXE. Signing contacts the timestamp server. No root/publisher trust
certificates are installed. Regenerating source/license release assets uses
PowerShell 7 and `windows/installer/prepare-release-source.ps1`, then `-Finalize`
after packaging. Downloads are source archives, not executed programs.

For local debugging only, `windows/installer/setup-dev-signing.ps1` configures
your Debug certificate in ignored user settings. Modified binaries have different
hashes/signatures; byte-identical reconstruction is not promised. No installation
restriction requires the original author's signing key.
