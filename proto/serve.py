"""Mini serveur HTTP qui force Content-Type: text/html; charset=utf-8.

Sans ça, le SimpleHTTPRequestHandler de la stdlib renvoie juste
"text/html" et certains browsers headless (preview MCP) tombent
en fallback Latin-1 → accents cassés.
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class UTF8Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
    }


if __name__ == "__main__":
    # Sert le dossier où vit ce script, indépendamment du cwd d'invocation.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    print(f"Boa Club proto sur http://localhost:{port}/", flush=True)
    HTTPServer(("", port), UTF8Handler).serve_forever()
