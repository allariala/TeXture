# SPDX-License-Identifier: GPL-3.0-or-later
"""Small, dependency-light boundary for the offline OCR service."""
import hmac
import io
from PIL import Image

MAX_UPLOAD_BYTES = 32 * 1024 * 1024
MAX_PIXELS = 32 * 1024 * 1024


def valid_token(expected, supplied):
    return bool(expected) and hmac.compare_digest(expected.encode(), (supplied or "").encode())


def decode_capture(data):
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("Capture is empty or exceeds 32 MB")
    # Check actual format, not the filename or HTTP content type.
    with Image.open(io.BytesIO(data), formats=["PNG"]) as source:
        if source.width * source.height > MAX_PIXELS:
            raise ValueError("Capture exceeds 32 megapixels")
        source.load()
        return source.convert("RGB")
