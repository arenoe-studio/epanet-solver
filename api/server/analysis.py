from __future__ import annotations

import base64
import json
import math
import os
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from api.epanet.config import PRV_MAX_STAGES
from api.epanet.materials import material_recommendations_for_network
from api.epanet.network_io import InpValidationError, export_optimized_inp, load_network
from api.epanet.optimizer import optimize_diameters
from api.epanet.prv import (
    analyze_prv_recommendations,
    apply_prvs,
    build_pressure_followup,
    fine_tune_prvs,
)
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


def _build_prv_targets(applied_rows: list[dict], recommendations: list[dict]) -> dict[str, list[str]]:
    recommendation_by_pipe = {
        str(rec.get("pipeId")): [str(nid) for nid in (rec.get("coveredNodes") or [])]
        for rec in (recommendations or [])
    }

    return {
        str(row.get("prvValve")): recommendation_by_pipe.get(str(row.get("originalPipe")), [])
        for row in (applied_rows or [])
        if row.get("prvValve")
    }


def _finite_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return v


def _round_or_none(value: object, ndigits: int) -> float | None:
    v = _finite_float(value)
    if v is None:
        return None
    return round(v, ndigits)


def _sim_value(sim_results: dict, key: str, element_id: str) -> float | None:
    series = (sim_results or {}).get(key)
    if series is None:
        return None
    try:
        return _finite_float(series.get(element_id))
    except Exception:
        return None


def _junction_base_demand_m3s(junction: object) -> float:
    try:
        demand_list = getattr(junction, "demand_timeseries_list", None)
        if demand_list:
            total = 0.0
            for ts in demand_list:
                try:
                    total += float(getattr(ts, "base_value"))
                except Exception:
                    continue
            return total
    except Exception:
        pass

    try:
        return float(getattr(junction, "base_demand", 0.0) or 0.0)
    except Exception:
        return 0.0


def _flow_dir(q_m3s: object) -> str | None:
    q = _finite_float(q_m3s)
    if q is None:
        return None
    if abs(q) < 1e-12:
        return "zero"
    return "start_to_end" if q > 0 else "end_to_start"


def _pressure_debug_snapshot(eval_results: dict) -> dict:
    node_status = eval_results.get("node_status", {})

    def _collect(code: str) -> list[dict]:
        rows: list[dict] = []
        for nid, info in node_status.items():
            if str(nid).startswith("J_PRV_"):
                continue
            if info.get("code") != code:
                continue
            rows.append(
                {
                    "id": str(nid),
                    "pressure": round(float(info.get("pressure", 0.0)), 2),
                }
            )
        rows.sort(key=lambda row: (row["pressure"], row["id"]))
        return rows

    high = _collect("P-HIGH")
    low = _collect("P-LOW")
    neg = _collect("P-NEG")
    return {
        "highCount": len(high),
        "lowCount": len(low),
        "negativeCount": len(neg),
        "highNodes": high,
        "lowNodes": low,
        "negativeNodes": neg,
    }

def _disconnected_junctions(wn: object) -> list[str]:
    """
    Best-effort connectivity check: junctions that are not connected to any
    reservoir/tank.

    Disconnected nodes often produce misleading / garbage head & pressure values
    (depending on engine behavior and convergence).
    """
    try:
        import networkx as nx  # type: ignore
    except Exception:
        return []

    try:
        graph = wn.get_graph()  # type: ignore[attr-defined]
    except Exception:
        return []

    try:
        undirected = graph.to_undirected()
    except Exception:
        try:
            undirected = nx.Graph(graph)
        except Exception:
            return []

    sources: list[str] = []
    try:
        sources.extend([str(x) for x in getattr(wn, "reservoir_name_list", [])])
    except Exception:
        pass
    try:
        sources.extend([str(x) for x in getattr(wn, "tank_name_list", [])])
    except Exception:
        pass

    if not sources:
        return []

    reachable: set[str] = set()
    for s in sources:
        if s not in undirected:
            continue
        try:
            reachable |= {str(n) for n in nx.node_connected_component(undirected, s)}
        except Exception:
            continue

    try:
        junctions = {str(x) for x in getattr(wn, "junction_name_list", [])}
    except Exception:
        return []

    return sorted(junctions - reachable)


def _sim_diagnostics(wn: object, sim_results: dict) -> dict:
    """
    Small, frontend-safe diagnostics to help debug suspicious head/pressure.
    Returns only scalar stats + a pressure/head consistency check:
      consistencyDiffM = pressure - (head - elevation)
    """
    pressure = (sim_results or {}).get("pressure")
    head = (sim_results or {}).get("head")

    def _series_minmax(series: object) -> tuple[float | None, str | None, float | None, str | None]:
        if series is None:
            return None, None, None, None
        try:
            items = list(getattr(series, "items")())
        except Exception:
            try:
                items = list(series.items())  # type: ignore[union-attr]
            except Exception:
                return None, None, None, None
        values: list[tuple[str, float]] = []
        for k, v in items:
            fv = _finite_float(v)
            if fv is None:
                continue
            values.append((str(k), fv))
        if not values:
            return None, None, None, None
        min_id, min_v = min(values, key=lambda kv: kv[1])
        max_id, max_v = max(values, key=lambda kv: kv[1])
        return min_v, min_id, max_v, max_id

    p_min, p_min_id, p_max, p_max_id = _series_minmax(pressure)
    h_min, h_min_id, h_max, h_max_id = _series_minmax(head)

    very_negative_nodes: list[dict] = []
    very_negative_count = 0
    try:
        if pressure is not None:
            items = list(getattr(pressure, "items")())
            rows: list[tuple[str, float]] = []
            for nid, p in items:
                fp = _finite_float(p)
                if fp is None:
                    continue
                if fp < -200.0:
                    very_negative_count += 1
                    rows.append((str(nid), float(fp)))
            rows.sort(key=lambda r: r[1])
            for nid, fp in rows[:20]:
                elev = None
                try:
                    n = getattr(wn, "get_node")(nid)
                    elev = _finite_float(getattr(n, "elevation", None))
                except Exception:
                    elev = None
                hh = None
                try:
                    if head is not None:
                        hh = _finite_float(getattr(head, "get")(nid))
                except Exception:
                    hh = None
                very_negative_nodes.append(
                    {
                        "id": nid,
                        "pressureM": round(fp, 2),
                        "headM": round(hh, 2) if hh is not None else None,
                        "elevationM": round(elev, 2) if elev is not None else None,
                    }
                )
    except Exception:
        very_negative_nodes = []
        very_negative_count = 0

    disconnected = _disconnected_junctions(wn)

    # pressure should equal (head - elevation) when pressure is in meters
    max_abs_diff = None
    try:
        diffs: list[float] = []
        for nid in getattr(wn, "junction_name_list", []) or []:
            if pressure is None or head is None:
                break
            p = _finite_float(getattr(pressure, "get")(nid))
            h = _finite_float(getattr(head, "get")(nid))
            if p is None or h is None:
                continue
            try:
                elev = float(getattr(getattr(wn, "get_node")(nid), "elevation", 0.0))
            except Exception:
                elev = 0.0
            diffs.append(float(p) - (float(h) - elev))
        if diffs:
            max_abs_diff = max(abs(d) for d in diffs)
    except Exception:
        max_abs_diff = None

    max_elev = None
    max_elev_id = None
    try:
        elevs: list[tuple[str, float]] = []
        for nid in getattr(wn, "junction_name_list", []) or []:
            try:
                elevs.append((str(nid), float(getattr(getattr(wn, "get_node")(nid), "elevation", 0.0))))
            except Exception:
                continue
        if elevs:
            max_elev_id, max_elev = max(elevs, key=lambda kv: kv[1])
    except Exception:
        pass

    return {
        "minPressureM": _round_or_none(p_min, 3),
        "minPressureNode": p_min_id,
        "maxPressureM": _round_or_none(p_max, 3),
        "maxPressureNode": p_max_id,
        "minHeadM": _round_or_none(h_min, 3),
        "minHeadNode": h_min_id,
        "maxHeadM": _round_or_none(h_max, 3),
        "maxHeadNode": h_max_id,
        "maxElevationM": _round_or_none(max_elev, 3),
        "maxElevationNode": max_elev_id,
        "pressureHeadConsistencyMaxAbsDiffM": _round_or_none(max_abs_diff, 6),
        "disconnectedJunctionCount": len(disconnected),
        "disconnectedJunctions": disconnected[:50],
        "veryNegativePressureCount": int(very_negative_count),
        "veryNegativePressureNodes": very_negative_nodes,
    }


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
        prv_debug_log: list[dict] = []

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
            prv_debug_log=prv_debug_log,
        )

        final_eval = after_eval
        final_sim = sim_after
        prv_fix_log: list[dict] | None = None
        prv_tune_log: list[dict] | None = None
        pressure_followup = build_pressure_followup(wn_opt, final_sim, final_eval, prv_advice)

        if action == "fix_pressure" and prv_advice.get("needed") and prv_advice.get("recommendations"):
            current_prv_advice = prv_advice
            prv_fix_log = []
            prv_tune_log = []

            for stage in range(1, PRV_MAX_STAGES + 1):
                recommendations = current_prv_advice.get("recommendations") or []
                if not recommendations:
                    break
                stage_debug = {
                    "stage": stage,
                    "before": _pressure_debug_snapshot(final_eval),
                    "recommendations": [
                        {
                            "pipeId": str(rec.get("pipeId")),
                            "settingHeadM": round(float(rec.get("settingHeadM", 0.0)), 2),
                            "coveredNodes": [str(nid) for nid in (rec.get("coveredNodes") or [])],
                        }
                        for rec in recommendations
                    ],
                }

                stage_fix_log = apply_prvs(wn_opt, recommendations)
                if not stage_fix_log:
                    stage_debug["status"] = "no_prv_applied"
                    prv_debug_log.append(stage_debug)
                    break
                prv_fix_log.extend(dict(row, stage=stage) for row in stage_fix_log)
                stage_debug["applied"] = [
                    {
                        "prvValve": str(row.get("prvValve")),
                        "originalPipe": str(row.get("originalPipe")),
                        "settingHeadM": round(float(row.get("settingHeadM", 0.0)), 2),
                    }
                    for row in stage_fix_log
                ]

                prv_targets = _build_prv_targets(stage_fix_log, recommendations)
                stage_tune_log = fine_tune_prvs(wn_opt, prv_targets)
                if stage_tune_log:
                    prv_tune_log.extend(dict(row, iter=f"S{stage}-{row.get('iter')}") for row in stage_tune_log)
                if stage_tune_log:
                    last_tune = stage_tune_log[-1]
                    stage_debug["tuningEnd"] = {
                        "status": str(last_tune.get("status", "unknown")),
                        "reason": str(last_tune.get("reason", "")),
                        "minP": round(float(last_tune.get("minP", 0.0)), 2),
                        "maxP": round(float(last_tune.get("maxP", 0.0)), 2),
                    }

                # Rerun Modul 2 AFTER every PRV stage so V/HL optimization adapts
                # to the new head distribution before we judge the remaining
                # pressure issues.
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
                    s2["iter"] = f"PRV{stage}-R2-{s.get('iter')}"
                    snapshots.append(s2)

                if prv_targets:
                    stage_tune_log2 = fine_tune_prvs(wn_opt, prv_targets)
                    if stage_tune_log2:
                        prv_tune_log.extend(
                            dict(row, iter=f"S{stage}-R2-{row.get('iter')}") for row in stage_tune_log2
                        )

                final_sim = run_simulation(wn_opt)
                final_eval = evaluate_network(wn_opt, final_sim)
                pressure_followup = build_pressure_followup(wn_opt, final_sim, final_eval, current_prv_advice)
                stage_debug["after"] = _pressure_debug_snapshot(final_eval)
                stage_debug["followupStatus"] = str(pressure_followup.get("status", "unknown"))
                prv_debug_log.append(stage_debug)
                if pressure_followup.get("status") == "resolved":
                    break

                current_prv_advice = analyze_prv_recommendations(wn_opt, final_sim, final_eval)
                if not current_prv_advice.get("needed") or not current_prv_advice.get("recommendations"):
                    break

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
                pressure_followup=pressure_followup,
                prv_debug_log=prv_debug_log,
            )

        # --- Build supplementary per-element data (frontend contract) ---

        nodes_data: list[dict] = []
        for nid in wn.junction_name_list:
            junction = wn_opt.get_node(nid)
            elev = float(getattr(junction, "elevation", 0.0))
            base_demand_m3s = _junction_base_demand_m3s(junction)

            # 3-stage values:
            # - Awal: baseline (original network)
            # - Diameter: after diameter optimization (v1)
            # - Tekanan: after PRV/Fix Pressure (final), may equal Diameter when not available
            h_awal = _sim_value(sim_baseline, "head", nid)
            h_diameter = _sim_value(sim_after, "head", nid)
            h_tekanan = _sim_value(final_sim, "head", nid)

            p_awal = _sim_value(sim_baseline, "pressure", nid)
            p_diameter = _sim_value(sim_after, "pressure", nid)
            p_tekanan = _sim_value(final_sim, "pressure", nid)

            p_before = _finite_float(baseline_eval.get("node_status", {}).get(nid, {}).get("pressure"))
            p_after = _finite_float(final_eval.get("node_status", {}).get(nid, {}).get("pressure"))
            code = final_eval["node_status"].get(nid, {}).get("code", "P-OK")
            nodes_data.append(
                {
                    "id": nid,
                    "elevation": _round_or_none(elev, 2),
                    "baseDemandLps": round(base_demand_m3s * 1000.0, 2),
                    "headAwalM": _round_or_none(h_awal, 2),
                    "headDiameterM": _round_or_none(h_diameter, 2),
                    "headTekananM": _round_or_none(h_tekanan, 2),
                    "pressureAwalM": _round_or_none(p_awal, 2),
                    "pressureDiameterM": _round_or_none(p_diameter, 2),
                    "pressureTekananM": _round_or_none(p_tekanan, 2),
                    "pressureBefore": _round_or_none(p_before, 2),
                    "pressureAfter": _round_or_none(p_after, 2),
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

            # 3-stage values
            d_awal_mm = float(baseline_eval["pipe_status"].get(pid, {}).get("diameter", 0.0)) * 1000.0
            d_diameter_mm = float(after_eval["pipe_status"].get(pid, {}).get("diameter", 0.0)) * 1000.0
            d_tekanan_mm = float(final_eval["pipe_status"].get(pid, {}).get("diameter", 0.0)) * 1000.0

            q_awal_m3s = _sim_value(sim_baseline, "flow", pid)
            q_diameter_m3s = _sim_value(sim_after, "flow", pid)
            q_tekanan_m3s = _sim_value(final_sim, "flow", pid)

            q_awal_lps = q_awal_m3s * 1000.0 if q_awal_m3s is not None else None
            q_diameter_lps = q_diameter_m3s * 1000.0 if q_diameter_m3s is not None else None
            q_tekanan_lps = q_tekanan_m3s * 1000.0 if q_tekanan_m3s is not None else None

            v_diameter = float(after_eval["pipe_status"].get(pid, {}).get("velocity", 0.0))
            v_tekanan = float(final_eval["pipe_status"].get(pid, {}).get("velocity", 0.0))

            hl_diameter = float(after_eval["pipe_status"].get(pid, {}).get("headloss", 0.0))
            hl_tekanan = float(final_eval["pipe_status"].get(pid, {}).get("headloss", 0.0))

            roughness_c = _finite_float(getattr(pipe, "roughness", None))
            if roughness_c is not None and roughness_c <= 0:
                roughness_c = None

            start_node = str(getattr(pipe, "start_node_name", ""))
            end_node = str(getattr(pipe, "end_node_name", ""))
            pipes_data.append(
                {
                    "id": pid,
                    "fromNode": start_node,
                    "toNode": end_node,
                    "length": round(float(getattr(pipe, "length", 0.0)), 1),
                    "roughnessC": _round_or_none(roughness_c, 3),
                    "diameterAwalMm": _round_or_none(d_awal_mm, 1),
                    "diameterDiameterMm": _round_or_none(d_diameter_mm, 1),
                    "diameterTekananMm": _round_or_none(d_tekanan_mm, 1),
                    "flowAwalLps": _round_or_none(q_awal_lps, 3),
                    "flowDiameterLps": _round_or_none(q_diameter_lps, 3),
                    "flowTekananLps": _round_or_none(q_tekanan_lps, 3),
                    "flowAwalLpsAbs": _round_or_none(abs(q_awal_lps) if q_awal_lps is not None else None, 3),
                    "flowDiameterLpsAbs": _round_or_none(
                        abs(q_diameter_lps) if q_diameter_lps is not None else None, 3
                    ),
                    "flowTekananLpsAbs": _round_or_none(abs(q_tekanan_lps) if q_tekanan_lps is not None else None, 3),
                    "flowAwalDir": _flow_dir(q_awal_m3s),
                    "flowDiameterDir": _flow_dir(q_diameter_m3s),
                    "flowTekananDir": _flow_dir(q_tekanan_m3s),
                    "velocityAwalMps": round(v_before, 3),
                    "velocityDiameterMps": round(v_diameter, 3),
                    "velocityTekananMps": round(v_tekanan, 3),
                    "unitHeadlossAwalMkm": round(hl_before, 2),
                    "unitHeadlossDiameterMkm": round(hl_diameter, 2),
                    "unitHeadlossTekananMkm": round(hl_tekanan, 2),
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
                    total_demand_m3s += _junction_base_demand_m3s(j)
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

        diagnostics = {
            "baseline": _sim_diagnostics(wn, sim_baseline),
            "afterDiameter": _sim_diagnostics(wn_opt, sim_after),
            "final": _sim_diagnostics(wn_opt, final_sim),
        }

        warnings: list[str] = []
        baseline_diag = diagnostics.get("baseline") or {}
        try:
            disconnected_count = int(baseline_diag.get("disconnectedJunctionCount") or 0)
            if disconnected_count > 0:
                disconnected = baseline_diag.get("disconnectedJunctions") or []
                suffix = ""
                if disconnected:
                    sample = [str(x) for x in disconnected[:12]]
                    suffix = f" Contoh: {', '.join(sample)}"
                    if len(disconnected) > 12:
                        suffix += ", …"
                warnings.append(
                    "Sebagian junction tidak terhubung ke reservoir/tank (disconnected). "
                    f"Hasil head/pressure untuk node ini tidak valid. Count={disconnected_count}.{suffix}"
                )
        except Exception:
            pass
        try:
            min_p = _finite_float(baseline_diag.get("minPressureM"))
            if min_p is not None and min_p < -200.0:
                sample_rows = baseline_diag.get("veryNegativePressureNodes") or []
                suffix = ""
                if sample_rows:
                    rows = []
                    for row in sample_rows[:8]:
                        try:
                            rows.append(f"{row.get('id')}({row.get('pressureM')}m)")
                        except Exception:
                            continue
                    if rows:
                        suffix = " Contoh: " + ", ".join(rows) + (", …" if len(sample_rows) > 8 else "")
                warnings.append(
                    "Tekanan awal sangat negatif (< -200 m). Ini hampir selalu menandakan hasil solver tidak valid "
                    "(non-konvergen, disconnected, atau unit mismatch)." + suffix
                )
        except Exception:
            pass
        try:
            diff = _finite_float(baseline_diag.get("pressureHeadConsistencyMaxAbsDiffM"))
            if diff is not None and diff > 1e-3:
                warnings.append(
                    "Konsistensi pressure vs (head - elevation) tidak nol. Ini biasanya menandakan pressure tidak "
                    "berunit meter (mis. kPa/psi) atau ada anomali hasil solver."
                )
        except Exception:
            pass

        # Surface simulator-side unit conversion warnings (if any).
        try:
            stage_sims = {
                "baseline": sim_baseline,
                "afterDiameter": sim_after,
                "final": final_sim,
            }
            for stage, sim in stage_sims.items():
                ua = (sim or {}).get("_unit_audit") or {}
                for msg in ua.get("warnings") or []:
                    warnings.append(f"[{stage}] {msg}")
        except Exception:
            pass

        # Persist diagnostics for post-mortem debugging when running as jobs.
        try:
            if work_dir:
                (Path(work_dir) / "solver_diagnostics.json").write_text(
                    json.dumps(
                        {
                            "warnings": warnings,
                            "diagnostics": diagnostics,
                            "simulatorEnv": os.environ.get("EPANET_SOLVER_SIMULATOR"),
                            "requireEpanetEnv": os.environ.get("EPANET_SOLVER_REQUIRE_EPANET"),
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
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
                "pressureOptimizationAvailable": bool(out_inp_final and out_md_final),
            },
            "prv": {**prv_advice, "postFix": pressure_followup},
            "prvDebug": prv_debug_log,
            "nodes": nodes_data,
            "pipes": pipes_data,
            "materials": materials_data,
            "networkInfo": {
                "totalDemandLps": round(total_demand_m3s * 1000.0, 2),
                "headReservoirM": round(head_reservoir_m, 1),
                "unitAudit": {
                    "baseline": (sim_baseline or {}).get("_unit_audit"),
                    "afterDiameter": (sim_after or {}).get("_unit_audit"),
                    "final": (final_sim or {}).get("_unit_audit"),
                },
            },
            "diagnostics": diagnostics,
            "warnings": warnings,
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
