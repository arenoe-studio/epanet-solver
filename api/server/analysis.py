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
            report_kind="v1",
        )

        final_eval = after_eval
        final_sim = sim_after
        prv_fix_log: list[dict] | None = None
        prv_tune_log: list[dict] | None = None

        if action == "fix_pressure" and prv_advice.get("needed") and prv_advice.get("recommendations"):
            prv_fix_log = apply_prvs(wn_opt, prv_advice["recommendations"])
            prv_valves = [row.get("prvValve") for row in (prv_fix_log or []) if row.get("prvValve")]
            prv_tune_log = fine_tune_prvs(wn_opt, [str(v) for v in prv_valves])

            # Rerun Modul 2 AFTER PRV insertion so V/HL optimization adapts to
            # changed hydraulics. Keep this capped so server requests stay fast.
            rerun_budget = max(2.0, min(8.0, float(time_budget_s) * 0.4))
            rerun_iters = min(10, int(max_iterations))

            wn_opt2, _, diameter_changes2, snapshots2 = optimize_diameters(
                wn_opt,
                max_iterations=rerun_iters,
                time_budget_s=rerun_budget,
            )
            wn_opt = wn_opt2

            for pid, ch2 in (diameter_changes2 or {}).items():
                if pid in diameter_changes:
                    diameter_changes[pid]["after"] = ch2.get("after")
                    diameter_changes[pid]["reason"] = ch2.get("reason")
                    diameter_changes[pid]["category"] = ch2.get("category")
                else:
                    diameter_changes[pid] = ch2

            for s in snapshots2 or []:
                s2 = dict(s)
                s2["iter"] = f"R2-{s.get('iter')}"
                snapshots.append(s2)

            # After diameters changed again, re-tune PRVs once more (same PRV ids).
            if prv_valves:
                prv_tune_log2 = fine_tune_prvs(wn_opt, [str(v) for v in prv_valves])
                if prv_tune_log2:
                    prv_tune_log = (prv_tune_log or []) + [
                        dict(row, iter=f"R2-{row.get('iter')}") for row in prv_tune_log2
                    ]

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
                report_kind="final",
                prv_fix_log=prv_fix_log,
                prv_tune_log=prv_tune_log,
            )

        # --- Build supplementary per-element data (frontend contract) ---

        nodes_data: list[dict] = []
        for nid in wn_opt.junction_name_list:
            junction = wn_opt.get_node(nid)
            elev = float(getattr(junction, "elevation", 0.0))
            p_before = float(baseline_eval["node_status"].get(nid, {}).get("pressure", 0.0))
            p_after = float(final_eval["node_status"].get(nid, {}).get("pressure", 0.0))
            code = final_eval["node_status"].get(nid, {}).get("code", "P-OK")
            nodes_data.append(
                {
                    "id": nid,
                    "elevation": round(elev, 2),
                    "pressureBefore": round(p_before, 2),
                    "pressureAfter": round(p_after, 2),
                    "code": code,
                }
            )

        pipes_data: list[dict] = []
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
            pipes_data.append(
                {
                    "id": pid,
                    "length": round(float(getattr(pipe, "length", 0.0)), 1),
                    "diameterBefore": round(d_before_m * 1000.0, 1),
                    "diameterAfter": round(d_after_m * 1000.0, 1),
                    "velocityBefore": round(v_before, 3),
                    "velocityAfter": round(v_after, 3),
                    "headlossBefore": round(hl_before, 2),
                    "headlossAfter": round(hl_after, 2),
                    "code": composite,
                }
            )

        materials_current = material_recommendations_for_network(wn_opt, final_sim)
        p_high_nodes = {
            nid for nid, ns in final_eval["node_status"].items() if ns.get("code") == "P-HIGH"
        }
        materials_data: list[dict] = []
        for pid in wn_opt.pipe_name_list:
            m = (materials_current or {}).get(pid)
            if not m:
                continue
            pipe = wn_opt.get_link(pid)
            in_phigh_zone = (
                getattr(pipe, "start_node_name", None) in p_high_nodes
                or getattr(pipe, "end_node_name", None) in p_high_nodes
            )
            notes = list(m.get("notes", []))
            if in_phigh_zone:
                notes = ["Evaluasi ulang material setelah PRV dipasang"] + notes
            materials_data.append(
                {
                    "pipeId": pid,
                    "diameterMm": round(float(m.get("diameterMm", 0.0)), 1),
                    "material": m.get("material", ""),
                    "C": float(m.get("C", 130)),
                    "pressureWorkingM": round(float(m.get("pressureWorkingM", 0.0)), 2),
                    "notes": notes,
                }
            )

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
            "networkInfo": {
                "totalDemandLps": round(total_demand_m3s * 1000.0, 2),
                "headReservoirM": round(head_reservoir_m, 1),
            },
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
