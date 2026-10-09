"""One-time conversion of the maintainer's trusted legacy model (never run on user input).

Run with the original texify/transformers build environment. The distributed engine only loads
the resulting state_dict with weights_only=True; it never unpickles a model object.
"""
from pathlib import Path
import hashlib
import json
import torch

base = Path(__file__).resolve().parent
model = torch.load(base / "texify_model.pt", map_location="cpu", weights_only=False)
model.eval()
destination = base / "texify_weights.pt"
torch.save(model.state_dict(), destination)
(base / "models" / "model_config.json").write_text(json.dumps(model.config.to_dict(), indent=2), encoding="utf-8")
# Verify that the result needs no executable model classes when deserialized.
state = torch.load(destination, map_location="cpu", weights_only=True)
assert list(state) == list(model.state_dict())
with destination.open("rb") as stream:
    digest = hashlib.file_digest(stream, "sha256").hexdigest()
(base / "model.sha256").write_text(digest, encoding="ascii")
print(f"Converted {len(state)} state entries, SHA256={digest}")
