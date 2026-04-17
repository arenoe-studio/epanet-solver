"""
Local dev helper for Phase 3.

Runs a minimal HTTP server that exposes:
  POST http://localhost:8000/api/analyze_python

This is NOT deployed to Vercel.
"""

from http.server import HTTPServer
from pathlib import Path
import sys


def main():
    repo_root = Path(__file__).resolve().parents[1]
    api_dir = repo_root / "api"
    sys.path.insert(0, str(api_dir))

    # analyze_python.py defines `class handler(BaseHTTPRequestHandler)`
    from analyze_python import handler as AnalyzeHandler  # type: ignore

    class RoutedHandler(AnalyzeHandler):
        def do_POST(self):
            if self.path != "/api/analyze_python":
                self.send_response(404)
                self.end_headers()
                return
            return super().do_POST()

    server = HTTPServer(("127.0.0.1", 8000), RoutedHandler)
    print("Local Python server listening on http://localhost:8000/api/analyze_python")
    server.serve_forever()


if __name__ == "__main__":
    main()

