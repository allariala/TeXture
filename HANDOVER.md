# TeXture 2.0 — handover (session 4)

Repository root: `TeXture 2.0/` (branch `refactor/unified-core`). Build: `pwsh windows\installer\build.ps1`
→ `windows\installer\Output\TeXture_Install_v2.0.0.exe` (≈518 MB, built this session).

## Session 4 — done
- **Word table cells**: reverted to the white `.` workaround (zero-width characters do not hold Word's baseline).
  Known side effect kept: text typed right next to that dot inherits white.
- **Ribbon** stays English (localisation dropped).
- **OCR engine v2** (`windows/capture/texture_capture.py`, one-folder PyInstaller build, shipped by the installer):
  shared by PowerPoint/Word, token-protected, exits with the last Office process, fully offline tokenizer,
  warm-up; ready ≈5 s, ≈1.5 s per recognition (tested frozen build).
- **Permanent installer**: 100-year signing certificate (`new-signing-cert.ps1`, valid until 2126), manifests
  signed with it. At the author's explicit request the installer registers the public certificate
  (`windows/installer/assets/TeXture-signing.cer`) in the machine's Trusted Root and Trusted Publishers stores
  (shown on the Ready page, removed on uninstall), so all users load the add-ins without prompts.
- **Mac**: shared UI runs as the PowerPoint web add-in (`ui/js/office-host.js`, `?platform=office`); new
  `mac/manifest.xml` (same add-in Id, v2.0.0.0) points to `https://allariala.github.io/TeXture/ui/index.html`.
  Verified in a browser (Office.js loads, falls back cleanly outside Office); **not yet tested in PowerPoint for Mac.**
- **Cleanup**: legacy folders/files moved to the Recycle Bin; debug/test scripts, old Mac sources and the v1.2
  manual removed from the repo. `..\TeXture v1.2.3` could not be recycled (path too long) — delete it manually.

## Next steps
1. Test the Mac add-in: publish the repo (Pages: `main`, `/`), sideload `mac/manifest.xml`, check insert/edit/
   size/colour/snippets in PowerPoint for Mac.
2. Install 2.0.0 (with OCR v2) on Windows and check capture from the button and `Alt+Shift+S`.
3. Back up the signing certificate (certmgr → Personal → "TeXture Add-in Signing" → Export with private key).

## Notes
- Command-line builds never touch the Office add-in registration.
- Browser UI testing: `python tools/serve-ui.py 8766` → `http://127.0.0.1:8766/index.html?host=ppt`.
- OCR build outputs (git-ignored): `windows/capture/dist/texture_capture/`, `windows/capture/texify_model.pt`.
