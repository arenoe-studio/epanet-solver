from __future__ import annotations

import tempfile
import time
from pathlib import Path

from api.epanet.materials import material_recommendations_for_network
from api.epanet.network_io import InpValidationError, load_network
from api.epanet.optimizer import optimize_diameters
from api.epanet.simulation import evaluate_network, run_simulation

from .shared import _build_remaining_errors

def _decode_inp(inp_bytes: bytes) -> str:
    return inp_bytes.decode("utf-8", errors="replace")


def _iter_section_rows(text: str, section: str) -> list[str]:
    wanted = section.strip().upper()
    in_section = False
    rows: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("[") and s.endswith("]"):
            in_section = s.upper() == wanted
            continue
        if not in_section:
            continue
        if s.startswith(";"):
            continue
        rows.append(s)
    return rows


def _warnings_from_inp_text(text: str) -> list[str]:
    warnings: list[str] = []
    if _iter_section_rows(text, "[PUMPS]"):
        warnings.append(
            "Sistem mendeteksi pompa. Analisis tetap bisa dijalankan namun pompa tidak dioptimasi."
        )
    if _iter_section_rows(text, "[TANKS]"):
        warnings.append("Sistem mendeteksi tangki. Analisis tetap bisa dijalankan.")
    return warnings


def _write_temp_inp(inp_bytes: bytes) -> Path:
    tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=".inp", delete=False, prefix="diameter_")
    try:
        tmp.write(inp_bytes)
        tmp.flush()
        return Path(tmp.name)
    finally:
        try:
            tmp.close()
        except Exception:
            pass


def _engine_used_from_sim(sim_results: dict) -> str:
    for k in ("_engine", "engine", "engineUsed", "_simulator", "simulator"):
        v = (sim_results or {}).get(k)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    return "wntr"


def _convergence_from_snapshots(snapshots: list[dict], final_eval: dict) -> str:
    if snapshots:
        last = snapshots[-1] or {}
        st = str(last.get("status") or "").strip().upper()
        if st in {"CONVERGED", "STUCK", "STAGNANT"}:
            return st
    return "CONVERGED" if bool(final_eval.get("all_vhl_ok", False)) else "STUCK"


def _build_diameter_changes(diameter_changes: dict) -> list[dict]:
    out: list[dict] = []
    for pipe_id, ch in (diameter_changes or {}).items():
        before_m = float((ch or {}).get("before", 0.0) or 0.0)
        after_m = float((ch or {}).get("after", 0.0) or 0.0)
        category = str((ch or {}).get("category") or "")
        reason = category if category else str((ch or {}).get("reason") or "")
        out.append(
            {
                "pipeId": str(pipe_id),
                "oldDiameterMm": round(before_m * 1000.0, 3),
                "newDiameterMm": round(after_m * 1000.0, 3),
                "reason": reason or "OK",
            }
        )
    out.sort(key=lambda r: r["pipeId"])
    return out


def _status_from_pipe(eval_results: dict, pipe_id: str) -> tuple[str, str, float, float]:
    ps = (eval_results.get("pipe_status") or {}).get(pipe_id, {}) or {}
    composite = str(ps.get("composite") or "OK")
    v = float(ps.get("velocity", 0.0) or 0.0)
    hl = float(ps.get("headloss", 0.0) or 0.0)

    velocity_status = "OK"
    headloss_status = "OK"
    if composite == "V-HIGH":
        velocity_status = "V-HIGH"
    elif composite == "V-LOW":
        velocity_status = "V-LOW"
    elif composite == "HL-HIGH":
        headloss_status = "HL-HIGH"
    elif composite == "HL-SMALL":
        headloss_status = "HL-SMALL"
        velocity_status = "V-HIGH"
    return velocity_status, headloss_status, v, hl

def analyze_diameter(
    inp_bytes: bytes,
    filename: str,
    max_iterations: int = 50,
    time_budget_s: float = 180.0,
) -> dict:
    """
    Jalankan analisis optimasi diameter.
    Return dict hasil analisis.
    Raise InpValidationError jika file tidak valid.
    Raise RuntimeError jika simulasi tidak konvergen.
    """
    started = time.time()
    text = _decode_inp(inp_bytes)
    warnings = _warnings_from_inp_text(text)

    tmp_path: Path | None = None
    wn = None
    try:
        tmp_path = _write_temp_inp(inp_bytes)
        wn = load_network(tmp_path)
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass

    sim_baseline = run_simulation(wn)
    baseline_eval = evaluate_network(wn, sim_baseline)

    wn_opt, _final_eval_from_opt, diameter_changes_map, snapshots = optimize_diameters(
        wn,
        max_iterations=max_iterations,
        time_budget_s=time_budget_s,
    )

    sim_after = run_simulation(wn_opt)
    final_eval = evaluate_network(wn_opt, sim_after)

    engine_used = _engine_used_from_sim(sim_after)

    violations_before = list(baseline_eval.get("violations", []) or [])
    violations_after = list(final_eval.get("violations", []) or [])

    duration_seconds = round(time.time() - started, 3)
    convergence = _convergence_from_snapshots(snapshots, final_eval)

    # Only keep violations still present after optimization.
    remaining_errors = _build_remaining_errors(violations_after)

    diameter_changes = _build_diameter_changes(diameter_changes_map)

    pipes_out: list[dict] = []
    for pid in getattr(wn_opt, "pipe_name_list", []) or []:
        pipe = wn_opt.get_link(pid)
        velocity_status, headloss_status, v, hl = _status_from_pipe(final_eval, pid)
        pipes_out.append(
            {
                "id": str(pid),
                "diameterMm": round(float(getattr(pipe, "diameter", 0.0)) * 1000.0, 3),
                "velocityMs": round(float(v), 3),
                "headlossPerKm": round(float(hl), 3),
                "velocityStatus": velocity_status,
                "headlossStatus": headloss_status,
            }
        )
    pipes_out.sort(key=lambda r: r["id"])

    nodes_out: list[dict] = []
    for nid, info in (final_eval.get("node_status") or {}).items():
        code = str((info or {}).get("code") or "P-OK")
        nodes_out.append(
            {
                "id": str(nid),
                "pressureM": round(float((info or {}).get("pressure", 0.0) or 0.0), 3),
                "pressureStatus": "OK" if code == "P-OK" else code,
            }
        )
    nodes_out.sort(key=lambda r: r["id"])

    materials_map = material_recommendations_for_network(wn_opt, sim_after) or {}
    materials_out: list[dict] = []
    for pid, m in materials_map.items():
        materials_out.append(
            {
                "pipeId": str(pid),
                "material": str(m.get("material", "")),
                "roughness": float(m.get("C", 0.0) or 0.0),
            }
        )
    materials_out.sort(key=lambda r: r["pipeId"])

    return {
        "success": True,
        "filename": str(filename or "network.inp"),
        "engineUsed": engine_used or "wntr",
        "summary": {
            "issuesFound": len(violations_before),
            "issuesFixed": len(violations_before) - len(violations_after),
            "remainingIssues": len(violations_after),
            "iterations": len(snapshots),
            "durationSeconds": float(duration_seconds),
            "convergenceStatus": convergence,
        },
        "diameterChanges": diameter_changes,
        "pipes": pipes_out,
        "nodes": nodes_out,
        "materials": materials_out,
        "remainingErrors": remaining_errors,
        "warnings": warnings,
        "pressureAnalysisAvailable": True,
    }
