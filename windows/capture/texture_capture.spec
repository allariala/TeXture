# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the TeXture OCR engine (API v3).
#   pyinstaller --noconfirm texture_capture.spec   ->  dist\texture_capture\texture_capture.exe (+ _internal\)
#
# One-folder build (not one-file): a one-file exe unpacks several hundred MB of torch into %TEMP% on
# every start; the folder build starts directly. UPX is off (it slows loading and breaks some torch DLLs).
# The installer adds texify_weights.pt and models\*.json next to the exe.
import os
diagnostic = os.environ.get('TEXTURE_BUILD_CONSOLE') == '1'
engine_name = 'texture_capture_debug' if diagnostic else 'texture_capture'

a = Analysis(
    ['texture_capture.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['texify.model.model', 'torch.ao.quantization', 'torch.backends.quantized'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'IPython', 'jupyter', 'notebook', 'pytest', 'tensorboard',
              'torchvision', 'torchaudio', 'tornado', 'pip_audit', 'python_multipart', 'multipart',
              'cryptography', 'timm'],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=engine_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=diagnostic,
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
    name=engine_name,
)
