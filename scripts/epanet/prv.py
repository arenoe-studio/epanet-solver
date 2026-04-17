"""
prv.py - PRV (Pressure Reducing Valve) analysis + auto-fix (Modul 3).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Iterable

import wntr

from .config import PRESSURE_MAX, PRESSURE_MIN, PRV_MAX_ITERATIONS, PRV_PRESSURE_TARGET
from .simulation import evaluate_network, run_simulation


@dataclass(frozen=True)
class PrvRecommendation:
    pipe_id: str
    upstream_node: str
    downstream_node: str
    covered_nodes: list[str]
    setting_head_m: float
    elevation_max_m: float


def _directed_edges_from_flow(
    wn: wntr.network.WaterNetworkModel,
    flow_by_pipe: dict,
) -> dict[str, list[str]]:
    """
    Build a directed adjacency (node -> [node]) following flow direction.
    Uses sign of flow in each pipe.
    """
    adj: dict[str, list[str]] = {}
    for pid in wn.pipe_name_list:
        pipe = wn.get_link(pid)
        q = float(flow_by_pipe.get(pid, 0.0))
        if q >= 0:
            u, v = pipe.start_node_name, pipe.end_node_name
        else:
            u, v = pipe.end_node_name, pipe.start_node_name
        adj.setdefault(u, []).append(v)
    return adj


def _pipe_dir(
    wn: wntr.network.WaterNetworkModel,
    pipe_id: str,
    flow_by_pipe: dict,
) -> tuple[str, str]:
    pipe = wn.get_link(pipe_id)
    q = float(flow_by_pipe.get(pipe_id, 0.0))
    if q >= 0:
        return pipe.start_node_name, pipe.end_node_name
    return pipe.end_node_name, pipe.start_node_name


def _bfs_reachable(adj: dict[str, list[str]], start: str) -> set[str]:
    seen = {start}
    q = deque([start])
    while q:
        u = q.popleft()
        for v in adj.get(u, []):
            if v in seen:
                continue
            seen.add(v)
            q.append(v)
    return seen


def analyze_prv_recommendations(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
    eval_results: dict,
) -> dict:
    """
    Modul 3A: produce advisory PRV recommendations if P-HIGH exists.
    """
    high_nodes = {
        nid
        for nid, info in eval_results["node_status"].items()
        if any("P-HIGH" in f for f in info.get("flags", []))
    }
    if not high_nodes:
        return {"needed": False, "tokenCost": 6, "recommendations": []}

    flow = sim_results["flow"]
    flow_by_pipe = flow.to_dict() if hasattr(flow, "to_dict") else dict(flow)

    adj = _directed_edges_from_flow(wn, flow_by_pipe)

    # Candidate pipes: any pipe whose downstream node is a P-HIGH node
    candidate_pipes: set[str] = set()
    for pid in wn.pipe_name_list:
        u, v = _pipe_dir(wn, pid, flow_by_pipe)
        if v in high_nodes:
            candidate_pipes.add(pid)

    # Precompute coverage for set-cover greedy
    candidates = []
    for pid in sorted(candidate_pipes):
        u, v = _pipe_dir(wn, pid, flow_by_pipe)
        reachable = _bfs_reachable(adj, v)
        covered = sorted(high_nodes.intersection(reachable))
        if not covered:
            continue
        candidates.append((pid, u, v, set(covered), reachable))

    uncovered = set(high_nodes)
    chosen: list[PrvRecommendation] = []

    while uncovered and candidates:
        # pick max coverage among uncovered
        best = None
        best_count = -1
        for pid, u, v, covered_set, reachable in candidates:
            count = len(covered_set & uncovered)
            if count > best_count:
                best = (pid, u, v, covered_set, reachable)
                best_count = count
        if not best or best_count <= 0:
            break
        pid, u, v, covered_set, reachable = best

        # Compute elevation max among downstream reachable nodes (junctions only)
        elev_max = None
        for nid in reachable:
            if nid not in wn.junction_name_list:
                continue
            elev = float(wn.get_node(nid).elevation)
            elev_max = elev if elev_max is None else max(elev_max, elev)
        elev_max = float(elev_max or 0.0)
        setting_head = PRV_PRESSURE_TARGET + elev_max

        chosen.append(
            PrvRecommendation(
                pipe_id=pid,
                upstream_node=u,
                downstream_node=v,
                covered_nodes=sorted(covered_set & uncovered),
                setting_head_m=setting_head,
                elevation_max_m=elev_max,
            )
        )
        uncovered -= covered_set
        candidates = [c for c in candidates if c[0] != pid]

    # Build UI-friendly JSON
    recs = []
    for rec in chosen:
        est = {}
        for nid in rec.covered_nodes:
            try:
                elev = float(wn.get_node(nid).elevation)
            except Exception:
                elev = 0.0
            est[nid] = rec.setting_head_m - elev
        recs.append(
            {
                "pipeId": rec.pipe_id,
                "upstreamNode": rec.upstream_node,
                "downstreamNode": rec.downstream_node,
                "settingHeadM": rec.setting_head_m,
                "pressureTargetM": PRV_PRESSURE_TARGET,
                "elevationMaxM": rec.elevation_max_m,
                "coveredNodes": rec.covered_nodes,
                "estimatedPressuresM": est,
            }
        )

    return {"needed": True, "tokenCost": 6, "recommendations": recs}


def _midpoint_coords(wn: wntr.network.WaterNetworkModel, n1: str, n2: str) -> tuple[float, float]:
    try:
        x1, y1 = wn.get_node(n1).coordinates
        x2, y2 = wn.get_node(n2).coordinates
        return (float(x1) + float(x2)) / 2.0, (float(y1) + float(y2)) / 2.0
    except Exception:
        return 0.0, 0.0


def apply_prvs(
    wn: wntr.network.WaterNetworkModel,
    recommendations: Iterable[dict],
) -> list[dict]:
    """
    Apply PRV insertions into the network (Modul 3B structural changes).
    Returns a log list of applied edits.
    """
    log: list[dict] = []

    for idx, rec in enumerate(recommendations, 1):
        pipe_id = rec["pipeId"]
        setting = float(rec["settingHeadM"])
        pipe = wn.get_link(pipe_id)
        n1, n2 = pipe.start_node_name, pipe.end_node_name

        # Keep existing direction (physical), PRV is inserted on downstream side
        x_mid, y_mid = _midpoint_coords(wn, n1, n2)
        elev_mid = (float(getattr(wn.get_node(n1), "elevation", 0.0)) + float(getattr(wn.get_node(n2), "elevation", 0.0))) / 2.0

        j_up = f"J_PRV_{pipe_id}"
        j_dn = f"J_PRV_{pipe_id}_D"
        p_up = f"{pipe_id}_A"
        p_dn = f"{pipe_id}_B"
        v_id = f"PRV_{pipe_id}"

        # Ensure uniqueness (fallback with idx suffix)
        for name in (j_up, j_dn, p_up, p_dn, v_id):
            if name in wn.node_name_list or name in wn.link_name_list:
                suffix = f"_{idx}"
                j_up += suffix
                j_dn += suffix
                p_up += suffix
                p_dn += suffix
                v_id += suffix
                break

        # Remove original pipe
        wn.remove_link(pipe_id)

        # Add junctions (no demand)
        wn.add_junction(j_up, base_demand=0.0, elevation=elev_mid, coordinates=(x_mid, y_mid))
        wn.add_junction(j_dn, base_demand=0.0, elevation=elev_mid, coordinates=(x_mid, y_mid))

        # Split length
        L = float(pipe.length)
        L1 = L / 2.0
        L2 = L - L1

        wn.add_pipe(
            p_up,
            n1,
            j_up,
            length=L1,
            diameter=float(pipe.diameter),
            roughness=float(getattr(pipe, "roughness", 140.0)),
            minor_loss=float(getattr(pipe, "minor_loss", 0.0)),
        )
        wn.add_valve(
            v_id,
            j_up,
            j_dn,
            valve_type="PRV",
            diameter=float(pipe.diameter),
            initial_setting=setting,
        )
        wn.add_pipe(
            p_dn,
            j_dn,
            n2,
            length=L2,
            diameter=float(pipe.diameter),
            roughness=float(getattr(pipe, "roughness", 140.0)),
            minor_loss=float(getattr(pipe, "minor_loss", 0.0)),
        )

        log.append(
            {
                "originalPipe": pipe_id,
                "pipeA": p_up,
                "pipeB": p_dn,
                "prvValve": v_id,
                "junctionUp": j_up,
                "junctionDown": j_dn,
                "settingHeadM": setting,
            }
        )

    return log


def fine_tune_prvs(
    wn: wntr.network.WaterNetworkModel,
    prv_valve_ids: list[str],
) -> list[dict]:
    """
    Simple fine-tuning loop:
      - if any downstream node exceeds 80m, reduce setting
      - if any node drops below 10m, increase setting
    """
    tune_log: list[dict] = []
    for it in range(1, PRV_MAX_ITERATIONS + 1):
        sim = run_simulation(wn)
        ev = evaluate_network(wn, sim)

        max_p = max((float(v["pressure"]) for v in ev["node_status"].values()), default=0.0)
        min_p = min((float(v["pressure"]) for v in ev["node_status"].values()), default=0.0)

        delta = 0.0
        if max_p > PRESSURE_MAX:
            delta = -(max_p - PRESSURE_MAX)
        elif min_p < PRESSURE_MIN:
            delta = (PRESSURE_MIN - min_p)

        if abs(delta) < 1e-6:
            break

        for vid in prv_valve_ids:
            try:
                valve = wn.get_link(vid)
                new_setting = float(getattr(valve, "setting", 0.0)) + delta
                if hasattr(valve, "setting"):
                    valve.setting = new_setting
                if hasattr(valve, "initial_setting"):
                    valve.initial_setting = new_setting
            except Exception:
                continue

        tune_log.append({"iter": it, "deltaSettingM": delta, "minP": min_p, "maxP": max_p})

    return tune_log
