"""TeXture offline OCR engine (API v2): screenshot of an equation -> LaTeX, using texify on the CPU.

Started by the TeXture add-in:  texture_capture.exe --port <port>
  TEXTURE_TOKEN       required value of the X-TeXture-Token header (per launch)
  TEXTURE_PARENT_PID  Office process that started the engine

One engine is shared by PowerPoint and Word (POST /attach?pid=...). It exits by itself when the last
attached Office process has exited, so nobody has to kill it by name.
Endpoints: GET / (health, {"api": 2}), POST /attach, POST /predict (multipart "file").
"""
import os
import sys

# Windowed (no console) builds have no stdout/stderr; printing would crash.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

BASE = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE, "models") if os.path.isdir(os.path.join(BASE, "models")) else BASE

# Fully offline: the tokenizer/processor configs ship in models/.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import argparse  # noqa: E402
import ctypes  # noqa: E402
import io  # noqa: E402
import re  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
import warnings  # noqa: E402

warnings.filterwarnings("ignore")

import torch  # noqa: E402
import torch.ao.quantization  # noqa: E402,F401  (PyInstaller: quantised model classes)
import torch.backends.quantized  # noqa: E402,F401
import transformers  # noqa: E402
from transformers import AutoConfig  # noqa: E402
import texify.model.model  # noqa: E402,F401  (PyInstaller: pickled model classes)
import texify.model.config as texify_config  # noqa: E402
import texify.settings as texify_settings  # noqa: E402
from texify.inference import batch_inference  # noqa: E402
from texify.model.processor import load_processor  # noqa: E402
from PIL import Image  # noqa: E402
from fastapi import FastAPI, File, Request, UploadFile  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
import uvicorn  # noqa: E402

# Inference is compute-bound: physical cores are faster than all logical ones (less contention).
torch.set_num_threads(max(1, (os.cpu_count() or 2) // 2))

# v1 assigned the *module* attribute, so load_processor() (which reads the settings object) still went to
# Hugging Face for the tokenizer. Point the settings object at the bundled folder.
texify_settings.settings.MODEL_CHECKPOINT = MODEL_DIR


def _patched_get_config(model_checkpoint):
    """texify 0.2 / newer transformers config compatibility."""
    config = AutoConfig.from_pretrained(model_checkpoint, trust_remote_code=True)
    encoder = getattr(config, "encoder", {})
    if not isinstance(encoder, dict):
        encoder = encoder.to_dict() if hasattr(encoder, "to_dict") else vars(encoder)
    decoder = getattr(config, "decoder", {})
    if not isinstance(decoder, dict):
        decoder = decoder.to_dict() if hasattr(decoder, "to_dict") else vars(decoder)
    config.encoder = texify_config.VariableDonutSwinConfig(**encoder)
    if hasattr(transformers, "DonutSwinConfig") and isinstance(decoder, dict) and "donut-swin" in decoder.get("model_type", ""):
        config.decoder = transformers.DonutSwinConfig(**decoder)
    return config


texify_config.get_config = _patched_get_config

TOKEN = os.environ.get("TEXTURE_TOKEN", "")
_clients = set()
_clients_lock = threading.Lock()
_infer_lock = threading.Lock()

processor = load_processor()
model = torch.load(os.path.join(BASE, "texify_model.pt"), map_location="cpu", weights_only=False)
model.eval()


def _recognise(img):
    with _infer_lock, torch.inference_mode():
        return batch_inference([img], model, processor)[0]


def _clean_latex(text):
    text = text.strip()
    if text.startswith("\\[") and text.endswith("\\]"):
        text = text[2:-2].strip()
    text = text.replace("$", "").replace("\\(", "").replace("\\)", "")
    return re.sub(r"\s+", " ", text).strip()


# Warm-up: the first inference allocates buffers and is several times slower; do it before reporting
# ready, so the user's first capture is fast.
try:
    _recognise(Image.new("RGB", (160, 48), "white"))
except Exception:
    pass

app = FastAPI()


@app.middleware("http")
async def _require_token(request: Request, call_next):
    if TOKEN and request.headers.get("x-texture-token") != TOKEN:
        return JSONResponse({"success": False, "error": "forbidden"}, status_code=403)
    return await call_next(request)


@app.get("/")
def health():
    return {"status": "ok", "api": 2}


@app.post("/attach")
def attach(pid: int):
    with _clients_lock:
        _clients.add(pid)
    return {"success": True}


@app.post("/predict")
def predict(file: UploadFile = File(...)):
    # Plain "def": FastAPI runs it in a worker thread, so health checks stay responsive meanwhile.
    try:
        img = Image.open(io.BytesIO(file.file.read())).convert("RGB")
        return {"success": True, "latex": _clean_latex(_recognise(img))}
    except Exception as e:  # reported to the add-in, which shows it to the user
        return {"success": False, "error": str(e)}


def _process_alive(pid):
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE
    if not handle:
        return False
    try:
        return kernel32.WaitForSingleObject(handle, 0) == 0x102  # WAIT_TIMEOUT: still running
    finally:
        kernel32.CloseHandle(handle)


def _watchdog():
    while True:
        time.sleep(2)
        with _clients_lock:
            _clients.intersection_update({p for p in _clients if _process_alive(p)})
            if not _clients:
                os._exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args, _ = parser.parse_known_args()

    parent = os.environ.get("TEXTURE_PARENT_PID", "")
    if parent.isdigit():
        _clients.add(int(parent))
        threading.Thread(target=_watchdog, daemon=True).start()

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_config=None, access_log=False)
