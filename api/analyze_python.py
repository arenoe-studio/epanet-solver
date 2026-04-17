import base64
import cgi
import json
import os
import sys
import tempfile
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler
from pathlib import Path


class UserError(Exception):
    """File tidak valid — tidak refund token."""


MAX_ITERATIONS_SERVERLESS = 15  # keep within typical serverless time limits


# Make bundled epanet package importable
THIS_DIR = Path(__file__).parent
sys.path.insert(0, str(THIS_DIR))


def _get_tmp_dir() -> Path:
    return Path(os.environ.get("TMPDIR") or tempfile.gettempdir())


def _read_multipart_file(handler: BaseHTTPRequestHandler) -> tuple[str, bytes]:
    content_type = handler.headers.get("content-type") or handler.headers.get("Content-Type")
    if not content_type or "multipart/form-data" not in content_type:
        raise UserError("Invalid content-type (expected multipart/form-data).")

    environ = {
        "REQUEST_METHOD": "POST",
        "CONTENT_TYPE": content_type,
        "CONTENT_LENGTH": handler.headers.get("content-length") or handler.headers.get("Content-Length") or "0",
    }
    form = cgi.FieldStorage(fp=handler.rfile, headers=handler.headers, environ=environ)
    if "file" not in form:
        raise UserError("Missing form-data field: file")

    file_item = form["file"]
    filename = getattr(file_item, "filename", None) or "network.inp"
    data = file_item.file.read()
    return filename, data


def _b64_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        start = time.time()
        tmp_dir = _get_tmp_dir()
        inp_path = None
        out_inp = None
        out_md = None

        try:
            os.chdir(str(tmp_dir))

            filename, inp_bytes = _read_multipart_file(self)
            if not filename.lower().endswith(".inp"):
                raise UserError("Invalid file type (expected .inp).")
            if len(inp_bytes) > 10 * 1024 * 1024:
                raise UserError("File too large (max 10MB).")

            inp_path = tmp_dir / f"{uuid.uuid4()}.inp"
            inp_path.write_bytes(inp_bytes)

            from epanet.network_io import export_optimized_inp, load_network
            from epanet.optimizer import optimize_diameters
            from epanet.reporter import export_markdown_report

            wn = load_network(inp_path)
            wn_opt, final_eval, diameter_changes, snapshots = optimize_diameters(
                wn, max_iterations=MAX_ITERATIONS_SERVERLESS
            )

            before_eval = snapshots[0]["eval_before"] if snapshots else final_eval
            after_eval = final_eval

            out_inp = tmp_dir / f"{uuid.uuid4()}_optimized_network.inp"
            out_md = tmp_dir / f"{uuid.uuid4()}_analysis_report.md"

            export_optimized_inp(inp_path, wn_opt, out_inp)
            export_markdown_report(
                inp_path=inp_path,
                wn_orig=wn,
                before_eval=before_eval,
                after_eval=after_eval,
                diameter_changes=diameter_changes,
                snapshots=snapshots,
                output_path=out_md,
                optimize_ran=True,
            )

            response = {
                "success": True,
                "summary": {
                    "iterations": len(snapshots),
                    "issuesFound": len(before_eval.get("violations", [])),
                    "issuesFixed": len(before_eval.get("violations", []))
                    - len(after_eval.get("violations", [])),
                    "remainingIssues": len(after_eval.get("violations", [])),
                    "duration": round(time.time() - start),
                    "nodes": wn.num_junctions,
                    "pipes": wn.num_pipes,
                    "fileName": filename,
                },
                "files": {"inp": _b64_file(out_inp), "md": _b64_file(out_md)},
            }

            self._respond(200, response)

        except UserError as e:
            self._respond(422, {"success": False, "refund": False, "error": str(e)})
        except Exception:
            traceback.print_exc()
            self._respond(500, {"success": False, "refund": True, "error": "System error"})
        finally:
            for p in (inp_path, out_inp, out_md):
                if not p:
                    continue
                try:
                    Path(p).unlink(missing_ok=True)
                except Exception:
                    pass

    def log_message(self, format, *args):
        # Silence default request logging
        return

    def _respond(self, status: int, body: dict):
        body_bytes = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body_bytes)))
        self.end_headers()
        self.wfile.write(body_bytes)
