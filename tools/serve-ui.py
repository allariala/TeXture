"""Serves ui/ for browser development (the page falls back to its mock host outside Office).

    python tools/serve-ui.py [port]

Responses are sent with Cache-Control: no-store so edits show up on every reload.
"""
import functools
import http.server
import os
import sys

UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".json": "application/json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=UI_DIR)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"TeXture UI on http://127.0.0.1:{port}/index.html?host=ppt")
        httpd.serve_forever()
