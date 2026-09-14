# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the TeXture OCR engine (API v2).
#   pyinstaller --noconfirm texture_capture.spec   ->  dist\texture_capture\texture_capture.exe (+ _internal\)
#
# One-folder build (not one-file): a one-file exe unpacks several hundred MB of torch into %TEMP% on
# every start; the folder build starts directly. UPX is off (it slows loading and breaks some torch DLLs).
# The installer adds texify_model.pt and models\*.json next to the exe.

a = Analysis(
    ['texture_capture.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['texify.model.model', 'torch.ao.quantization', 'torch.backends.quantized'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'IPython', 'jupyter', 'notebook', 'pytest', 'tensorboard'],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='texture_capture',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='texture_capture',
)
