from __future__ import annotations

import base64
import os
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from api.epanet.materials import material_recommendations_for_network
from api.epanet.network_io import InpValidationError, export_optimized_inp, load_network
from api.epanet.optimizer import optimize_diameters
from api.epanet.prv import analyze_prv_recommendations, apply_prvs, fine_tune_prvs
from api.epanet.reporter import export_markdown_report
from api.epanet.simulation import evaluate_network, run_simulation


class UserError(Exception):
    """Invalid user input."""


@dataclass(frozen=True)
class AnalysisFiles:
    optimized_inp_v1: Path
    report_md_v1: Path
    optimized_inp_final: Path | None
    report_md_final: Path | None


def _tmp_root() -> Path:
    return Path(os.environ.get("TMPDIR") or tempfile.gettempdir())


def _b64_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


def analyze_inp_bytes(
    *,
    filename: str,
    inp_bytes: bytes,
    action: str,
    max_iterations: int,
    time_budget_s: float,
    work_dir: Path | None = None,
    embed_files_base64: bool = True,
) -> tuple[dict, AnalysisFiles]:
    if not filename.lower().endswith(".inp"):
        raise UserError("Invalid file type (expected .inp).")
    if len(inp_bytes) > 25 * 1024 * 1024:
        raise UserError("File too large (max 25MB).")
    if action not in ("analyze", "fix_pressure"):
        raise UserError("Invalid action (expected analyze or fix_pressure).")

    started = time.time()

    tmp_dir = (work_dir or (_tmp_root() / "epanet-solver"))
    tmp_dir.mkdir(parents=True, exist_ok=True)

    inp_path = tmp_dir / f"{uuid.uuid4()}.inp"
    inp_path.write_bytes(inp_bytes)

    out_inp_v1 = tmp_dir / f"{uuid.uuid4()}_optimized_network_v1.inp"
    out_md_v1 = tmp_dir / f"{uuid.uuid4()}_analysis_report_v1.md"
    out_inp_final: Path | None = None
    out_md_final: Path | None = None

    try:
        wn = load_network(inp_path)

        sim_baseline = run_simulation(wn)
        baseline_eval = evaluate_network(wn, sim_baseline)

        wn_opt, _after_eval, diameter_changes, snapshots = optimize_diameters(
            wn,
            max_iterations=max_iterations,
            time_budget_s=time_budget_s,
        )

        sim_after = run_simulation(wn_opt)
        after_eval = evaluate_network(wn_opt, sim_after)

        materials_v1 = material_recommendations_for_network(wn_opt, sim_after)
        prv_advice = analyze_prv_recommendations(wn_opt, sim_after, after_eval)

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
            prv=prv_advice,
            output_path=out_md_v1,
            report_kind="analyze",
        )

        final_eval = after_eval
        final_sim = sim_after
        prv_fix_log: list[dict] | None = None
        prv_tune_log: list[dict] | None = None

        if action == "fix_pressure" and prv_advice.get("needed") and prv_advice.get("recommendations"):
            prv_fix_log = apply_prvs(wn_opt, prv_advice["recommendations"])
            prv_valves = [row.get("prvValve") for row in (prv_fix_log or []) if row.get("prvValve")]
            prv_tune_log = fine_tune_prvs(wn_opt, [str(v) for v in prv_valves])

            final_sim = run_simulation(wn_opt)
            final_eval = evaluate_network(wn_opt, final_sim)

            out_inp_final = tmp_dir / f"{uuid.uuid4()}_optimized_network_final.inp"
            out_md_final = tmp_dir / f"{uuid.uuid4()}_analysis_report_final.md"

            materials_final = material_recommendations_for_network(wn_opt, final_sim)
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
                prv=prv_advice,
                output_path=out_md_final,
                report_kind="fix_pressure",
                prv_fix_log=prv_fix_log,
                prv_tune_log=prv_tune_log,
            )

        nodes_data: list[dict] = []
        for nid in wn.junction_name_list:
            b = baseline_eval["node_status"].get(nid, {})
            a = final_eval["node_status"].get(nid, {})
            nodes_data.append(
                {
                    "id": nid,
                    "pressureBefore": round(float(b.get("pressure", 0.0)), 3),
                    "pressureAfter": round(float(a.get("pressure", 0.0)), 3),
                    "codeBefore": b.get("code"),
                    "codeAfter": a.get("code"),
                }
            )

        pipes_data: list[dict] = []
        for pid in wn.pipe_name_list:
            b = baseline_eval["pipe_status"].get(pid, {})
            a = final_eval["pipe_status"].get(pid, {})
            try:
                d_before_mm = float(wn.get_link(pid).diameter) * 1000.0
            except Exception:
                d_before_mm = 0.0
            try:
                d_after_mm = float(getattr(wn_opt.get_link(pid), "diameter", 0.0)) * 1000.0
            except Exception:
                # When PRVs are applied, the original pipe is removed/split.
                d_after_mm = 0.0
            pipes_data.append(
                {
                    "id": pid,
                    "velocityBefore": round(float(b.get("velocity", 0.0)), 4),
                    "velocityAfter": round(float(a.get("velocity", 0.0)), 4),
                    "headlossBefore": round(float(b.get("headloss", 0.0)), 3),
                    "headlossAfter": round(float(a.get("headloss", 0.0)), 3),
                    "diameterBeforeMm": round(d_before_mm, 1),
                    "diameterAfterMm": round(d_after_mm, 1),
                    "compositeBefore": b.get("composite"),
                    "compositeAfter": a.get("composite"),
                }
            )

        materials_current = material_recommendations_for_network(wn_opt, final_sim)
        materials_data: list[dict] = []
        for pid, m in (materials_current or {}).items():
            materials_data.append(
                {
                    "pipeId": pid,
                    "diameterMm": round(float(m.get("diameterMm", 0.0)), 1),
                    "material": m.get("material", ""),
                    "C": float(m.get("C", 130)),
                    "pressureWorkingM": round(float(m.get("pressureWorkingM", 0.0)), 2),
                    "notes": list(m.get("notes", [])),
                }
            )

        response: dict = {
            "success": True,
            "summary": {
                "iterations": len(snapshots),
                "issuesFound": len(baseline_eval.get("violations", [])),
                "issuesFixed": len(baseline_eval.get("violations", []))
                - len(final_eval.get("violations", [])),
                "remainingIssues": len(final_eval.get("violations", [])),
                "duration": round(time.time() - started, 3),
                "nodes": wn.num_junctions,
                "pipes": wn.num_pipes,
                "fileName": filename,
                "action": action,
            },
            "prv": prv_advice,
            "nodes": nodes_data,
            "pipes": pipes_data,
            "materials": materials_data,
            "files": {},
            "filesV1": {"inpPath": str(out_inp_v1), "mdPath": str(out_md_v1)},
            "filesFinal": (
                {"inpPath": str(out_inp_final), "mdPath": str(out_md_final)}
                if out_inp_final and out_md_final
                else None
            ),
        }

        if embed_files_base64:
            response["filesV1"] = {"inp": _b64_file(out_inp_v1), "md": _b64_file(out_md_v1)}
            response["filesFinal"] = (
                {"inp": _b64_file(out_inp_final), "md": _b64_file(out_md_final)}
                if out_inp_final and out_md_final
                else None
            )
            response["files"] = (
                response["filesFinal"]
                if action == "fix_pressure" and response["filesFinal"]
                else response["filesV1"]
            )
        else:
            response["files"] = (
                response["filesFinal"]
                if action == "fix_pressure" and response.get("filesFinal")
                else response.get("filesV1")
            )

        return (
            response,
            AnalysisFiles(
                optimized_inp_v1=out_inp_v1,
                report_md_v1=out_md_v1,
                optimized_inp_final=out_inp_final,
                report_md_final=out_md_final,
            ),
        )
    finally:
        try:
            inp_path.unlink(missing_ok=True)
        except Exception:
            pass
