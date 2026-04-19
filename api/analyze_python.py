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


def _env_int(name: str, default: int) -> int:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    try:
        return int(str(v).strip())
    except Exception:
        return default


def _env_float(name: str, default: float) -> float:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    try:
        return float(str(v).strip())
    except Exception:
        return default


# Keep within typical serverless time limits by default; override on dedicated backends.
MAX_ITERATIONS_SERVERLESS = _env_int("EPANET_SOLVER_MAX_ITERATIONS", 15)
OPTIMIZER_TIME_BUDGET_S = _env_float("EPANET_SOLVER_TIME_BUDGET_S", 20.0)


# Make bundled epanet package importable
THIS_DIR = Path(__file__).parent
sys.path.insert(0, str(THIS_DIR))

try:
    from epanet.network_io import InpValidationError  # type: ignore
except Exception:  # pragma: no cover
    class InpValidationError(Exception):
        pass


def _get_tmp_dir() -> Path:
    return Path(os.environ.get("TMPDIR") or tempfile.gettempdir())


def _read_multipart_file(handler: BaseHTTPRequestHandler) -> tuple[str, bytes, str]:
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
    action = None
    try:
        action = form.getfirst("action")
    except Exception:
        action = None
    return filename, data, (action or "analyze")


def _b64_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        start = time.time()
        tmp_dir = _get_tmp_dir()
        inp_path = None
        out_inp_v1 = None
        out_md_v1 = None
        out_inp_final = None
        out_md_final = None

        try:
            os.chdir(str(tmp_dir))

            filename, inp_bytes, action = _read_multipart_file(self)
            if not filename.lower().endswith(".inp"):
                raise UserError("Invalid file type (expected .inp).")
            if len(inp_bytes) > 10 * 1024 * 1024:
                raise UserError("File too large (max 10MB).")

            inp_path = tmp_dir / f"{uuid.uuid4()}.inp"
            inp_path.write_bytes(inp_bytes)

            from epanet.network_io import export_optimized_inp, load_network
            from epanet.optimizer import optimize_diameters
            from epanet.reporter import export_markdown_report
            from epanet.materials import material_recommendations_for_network
            from epanet.prv import analyze_prv_recommendations, apply_prvs, fine_tune_prvs
            from epanet.simulation import run_simulation, evaluate_network

            if action not in ("analyze", "fix_pressure"):
                raise UserError("Invalid action (expected analyze or fix_pressure).")

            wn = load_network(inp_path)

            # Modul 1: baseline
            sim_baseline = run_simulation(wn)
            baseline_eval = evaluate_network(wn, sim_baseline)

            # Modul 2: diameter optimization (serverless guard)
            wn_opt, after_eval, diameter_changes, snapshots = optimize_diameters(
                wn,
                max_iterations=MAX_ITERATIONS_SERVERLESS,
                time_budget_s=OPTIMIZER_TIME_BUDGET_S,
            )

            sim_after = run_simulation(wn_opt)
            after_eval = evaluate_network(wn_opt, sim_after)

            materials_v1 = material_recommendations_for_network(wn_opt, sim_after)
            prv = analyze_prv_recommendations(wn_opt, sim_after, after_eval)

            out_inp_v1 = tmp_dir / f"{uuid.uuid4()}_optimized_network_v1.inp"
            out_md_v1 = tmp_dir / f"{uuid.uuid4()}_analysis_report_v1.md"

            export_optimized_inp(inp_path, wn_opt, out_inp_v1)
            export_markdown_report(
                inp_path=inp_path,
                file_name=filename,
                wn_orig=wn,
                baseline_eval=baseline_eval,
                after_eval=after_eval,
                diameter_changes=diameter_changes,
                snapshots=snapshots,
                materials=materials_v1,
                prv=prv,
                output_path=out_md_v1,
                report_kind="v1",
            )

            prv_fix_log = None
            prv_tune_log = None
            final_eval = after_eval
            final_sim_results = sim_after

            if action == "fix_pressure" and prv.get("needed"):
                prv_fix_log = apply_prvs(wn_opt, prv.get("recommendations") or [])
                prv_valves = [row.get("prvValve") for row in (prv_fix_log or []) if row.get("prvValve")]
                prv_tune_log = fine_tune_prvs(wn_opt, prv_valves)

                # Rerun Modul 2 AFTER PRV insertion so V/HL optimization adapts to
                # changed hydraulics. Use a fixed budget (not derived from elapsed
                # wall-time) so results are reproducible across runs.
                rerun_budget = 8.0
                rerun_iters = min(10, MAX_ITERATIONS_SERVERLESS)

                wn_opt2, _, diameter_changes2, snapshots2 = optimize_diameters(
                    wn_opt,
                    max_iterations=rerun_iters,
                    time_budget_s=rerun_budget,
                )
                wn_opt = wn_opt2

                # Merge diameter change history: preserve earliest "before" while
                # updating latest "after"/reason.
                for pid, ch2 in (diameter_changes2 or {}).items():
                    if pid in diameter_changes:
                        diameter_changes[pid]["after"] = ch2.get("after")
                        diameter_changes[pid]["reason"] = ch2.get("reason")
                        diameter_changes[pid]["category"] = ch2.get("category")
                    else:
                        diameter_changes[pid] = ch2

                # Append rerun snapshots with phase-aware iteration labels.
                for s in snapshots2 or []:
                    s2 = dict(s)
                    s2["iter"] = f"R2-{s.get('iter')}"
                    snapshots.append(s2)

                # After diameters changed again, re-tune PRVs once more (same PRV ids).
                if prv_valves:
                    prv_tune_log2 = fine_tune_prvs(wn_opt, prv_valves)
                    if prv_tune_log2:
                        prv_tune_log = (prv_tune_log or []) + [
                            dict(row, iter=f"R2-{row.get('iter')}") for row in prv_tune_log2
                        ]

                sim_final = run_simulation(wn_opt)
                final_eval = evaluate_network(wn_opt, sim_final)
                final_sim_results = sim_final
                materials_final = material_recommendations_for_network(wn_opt, sim_final)

                out_inp_final = tmp_dir / f"{uuid.uuid4()}_optimized_network_final.inp"
                out_md_final = tmp_dir / f"{uuid.uuid4()}_analysis_report_final.md"

                export_optimized_inp(inp_path, wn_opt, out_inp_final)
                export_markdown_report(
                    inp_path=inp_path,
                    file_name=filename,
                    wn_orig=wn,
                    baseline_eval=baseline_eval,
                    after_eval=final_eval,
                    diameter_changes=diameter_changes,
                    snapshots=snapshots,
                    materials=materials_final,
                    prv=prv,
                    output_path=out_md_final,
                    report_kind="final",
                    prv_fix_log=prv_fix_log,
                    prv_tune_log=prv_tune_log,
                )

            # --- Build supplementary per-element data ---

            nodes_data = []
            for nid in wn_opt.junction_name_list:
                junction = wn_opt.get_node(nid)
                elev = float(getattr(junction, "elevation", 0.0))
                p_before = float(baseline_eval["node_status"].get(nid, {}).get("pressure", 0.0))
                p_after = float(final_eval["node_status"].get(nid, {}).get("pressure", 0.0))
                code = final_eval["node_status"].get(nid, {}).get("code", "P-OK")
                nodes_data.append({
                    "id": nid,
                    "elevation": round(elev, 2),
                    "pressureBefore": round(p_before, 2),
                    "pressureAfter": round(p_after, 2),
                    "code": code,
                })

            pipes_data = []
            for pid in wn_opt.pipe_name_list:
                pipe = wn_opt.get_link(pid)
                dc = (diameter_changes or {}).get(pid, {})
                d_before_m = float(dc.get("before") or pipe.diameter)
                d_after_m = float(dc.get("after") or pipe.diameter)
                v_before = float(baseline_eval["pipe_status"].get(pid, {}).get("velocity", 0.0))
                v_after = float(final_eval["pipe_status"].get(pid, {}).get("velocity", 0.0))
                hl_before = float(baseline_eval["pipe_status"].get(pid, {}).get("headloss", 0.0))
                hl_after = float(final_eval["pipe_status"].get(pid, {}).get("headloss", 0.0))
                composite = final_eval["pipe_status"].get(pid, {}).get("composite", "OK")
                pipes_data.append({
                    "id": pid,
                    "length": round(float(pipe.length), 1),
                    "diameterBefore": round(d_before_m * 1000, 1),
                    "diameterAfter": round(d_after_m * 1000, 1),
                    "velocityBefore": round(v_before, 3),
                    "velocityAfter": round(v_after, 3),
                    "headlossBefore": round(hl_before, 2),
                    "headlossAfter": round(hl_after, 2),
                    "code": composite,
                })

            materials_current = material_recommendations_for_network(wn_opt, final_sim_results)
            p_high_nodes = {
                nid for nid, ns in final_eval["node_status"].items()
                if ns.get("code") == "P-HIGH"
            }
            materials_data = []
            for pid in wn_opt.pipe_name_list:
                m = materials_current.get(pid)
                if not m:
                    continue
                pipe = wn_opt.get_link(pid)
                in_phigh_zone = (
                    pipe.start_node_name in p_high_nodes
                    or pipe.end_node_name in p_high_nodes
                )
                notes = list(m.get("notes", []))
                if in_phigh_zone:
                    notes = ["Evaluasi ulang material setelah PRV dipasang"] + notes
                materials_data.append({
                    "pipeId": pid,
                    "diameterMm": round(float(m.get("diameterMm", 0)), 1),
                    "material": m.get("material", ""),
                    "C": float(m.get("C", 130)),
                    "pressureWorkingM": round(float(m.get("pressureWorkingM", 0)), 2),
                    "notes": notes,
                })

            total_demand_m3s = 0.0
            try:
                for _, j in wn.junctions():
                    try:
                        total_demand_m3s += float(j.base_demand)
                    except Exception:
                        pass
            except Exception:
                pass

            head_reservoir_m = 0.0
            try:
                for _, res in wn.reservoirs():
                    try:
                        head_reservoir_m = float(res.head_timeseries.base_value)
                    except Exception:
                        try:
                            head_reservoir_m = float(res.head)
                        except Exception:
                            pass
                    break
            except Exception:
                pass

            response = {
                "success": True,
                "summary": {
                    "iterations": len(snapshots),
                    "issuesFound": len(baseline_eval.get("violations", [])),
                    "issuesFixed": len(baseline_eval.get("violations", []))
                    - len(final_eval.get("violations", [])),
                    "remainingIssues": len(final_eval.get("violations", [])),
                    "duration": round(time.time() - start),
                    "nodes": wn.num_junctions,
                    "pipes": wn.num_pipes,
                    "fileName": filename,
                },
                "prv": prv,
                "filesV1": {"inp": _b64_file(out_inp_v1), "md": _b64_file(out_md_v1)},
                "filesFinal": (
                    {"inp": _b64_file(out_inp_final), "md": _b64_file(out_md_final)}
                    if out_inp_final and out_md_final
                    else None
                ),
                # Backward-compatible: "files" points to the most relevant output for this action
                "files": (
                    {"inp": _b64_file(out_inp_final), "md": _b64_file(out_md_final)}
                    if action == "fix_pressure" and out_inp_final and out_md_final
                    else {"inp": _b64_file(out_inp_v1), "md": _b64_file(out_md_v1)}
                ),
                "nodes": nodes_data,
                "pipes": pipes_data,
                "materials": materials_data,
                "networkInfo": {
                    "totalDemandLps": round(total_demand_m3s * 1000, 2),
                    "headReservoirM": round(head_reservoir_m, 1),
                },
            }

            self._respond(200, response)

        except (UserError, InpValidationError) as e:
            self._respond(422, {"success": False, "refund": False, "error": str(e)})
        except Exception:
            traceback.print_exc()
            self._respond(500, {"success": False, "refund": True, "error": "System error"})
        finally:
            for p in (inp_path, out_inp_v1, out_md_v1, out_inp_final, out_md_final):
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
