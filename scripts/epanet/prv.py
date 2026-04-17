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
        # EPANET PRV "Setting" is a downstream pressure setpoint (m), not head.
        setting_head = float(PRV_PRESSURE_TARGET)

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
        est = {nid: rec.setting_head_m for nid in rec.covered_nodes}
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

def _node_xy(wn: wntr.network.WaterNetworkModel, nid: str) -> tuple[float, float]:
    try:
        x, y = wn.get_node(nid).coordinates
        return float(x), float(y)
    except Exception:
        return 0.0, 0.0

def _polyline_len(points: list[tuple[float, float]]) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        dx = x2 - x1
        dy = y2 - y1
        total += (dx * dx + dy * dy) ** 0.5
    return total

def _split_polyline_at_fraction(
    points: list[tuple[float, float]],
    fraction: float,
) -> tuple[tuple[float, float], list[tuple[float, float]], list[tuple[float, float]]]:
    """
    Split polyline (including endpoints) at a distance fraction [0..1].
    Returns: split_point, upstream_vertices, downstream_vertices
    (vertices lists exclude endpoints for their respective links).
    """
    if len(points) < 2:
        split = points[0] if points else (0.0, 0.0)
        return split, [], []

    f = float(fraction)
    if f <= 0.0:
        f = 0.5
    if f >= 1.0:
        f = 0.5

    total = _polyline_len(points)
    if total <= 1e-9:
        split = ((points[0][0] + points[-1][0]) / 2.0, (points[0][1] + points[-1][1]) / 2.0)
        return split, [], []

    target = total * f
    walked = 0.0

    for i, (p1, p2) in enumerate(zip(points, points[1:])):
        x1, y1 = p1
        x2, y2 = p2
        dx = x2 - x1
        dy = y2 - y1
        seg = (dx * dx + dy * dy) ** 0.5
        if seg <= 1e-12:
            continue
        if walked + seg + 1e-9 < target:
            walked += seg
            continue

        t = (target - walked) / seg
        if t <= 1e-8:
            split = points[i]
            up_pts = points[: i + 1]
            dn_pts = points[i:]
        elif t >= 1.0 - 1e-8:
            split = points[i + 1]
            up_pts = points[: i + 2]
            dn_pts = points[i + 1 :]
        else:
            split = (x1 + t * dx, y1 + t * dy)
            up_pts = points[: i + 1] + [split]
            dn_pts = [split] + points[i + 1 :]

        up_vertices = up_pts[1:-1] if len(up_pts) >= 3 else []
        dn_vertices = dn_pts[1:-1] if len(dn_pts) >= 3 else []
        return split, up_vertices, dn_vertices

    split = points[-1]
    return split, points[1:-1], []


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

        # Respect flow-based orientation from recommendations so PRV acts in the
        # correct upstream->downstream direction (EPANET PRV is directional).
        rec_up = rec.get("upstreamNode")
        rec_dn = rec.get("downstreamNode")
        if (
            isinstance(rec_up, str)
            and isinstance(rec_dn, str)
            and rec_up in (n1, n2)
            and rec_dn in (n1, n2)
            and rec_up != rec_dn
        ):
            up_node, dn_node = rec_up, rec_dn
            reversed_dir = up_node != n1
        else:
            up_node, dn_node = n1, n2
            reversed_dir = False

        raw_vertices = list(getattr(pipe, "vertices", []) or [])
        vertices = [(float(x), float(y)) for x, y in raw_vertices]
        if reversed_dir:
            vertices = list(reversed(vertices))

        points = [_node_xy(wn, up_node)] + vertices + [_node_xy(wn, dn_node)]
        (x_mid, y_mid), up_vertices, dn_vertices = _split_polyline_at_fraction(points, 0.5)

        elev_dn = float(getattr(wn.get_node(dn_node), "elevation", 0.0))
        # Use downstream-node elevation so the PRV pressure setpoint is
        # referenced to the downstream ground level (avoids inflated downstream
        # pressures when the midpoint elevation is high).
        elev_mid = elev_dn

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

        # Remove original pipe (after copying vertices for geometry preservation)
        wn.remove_link(pipe_id)

        # Add junctions (no demand)
        wn.add_junction(j_up, base_demand=0.0, elevation=elev_mid, coordinates=(x_mid, y_mid))
        wn.add_junction(j_dn, base_demand=0.0, elevation=elev_mid, coordinates=(x_mid, y_mid))

        # Split length
        L = float(pipe.length)
        L1 = L / 2.0
        L2 = L - L1

        roughness = float(getattr(pipe, "roughness", 140.0))
        minor_loss = float(getattr(pipe, "minor_loss", 0.0))

        wn.add_pipe(
            p_up,
            up_node,
            j_up,
            length=L1,
            diameter=float(pipe.diameter),
            roughness=roughness,
            minor_loss=minor_loss,
        )
        try:
            wn.get_link(p_up).vertices = up_vertices
        except Exception:
            pass
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
            dn_node,
            length=L2,
            diameter=float(pipe.diameter),
            roughness=roughness,
            minor_loss=minor_loss,
        )
        try:
            wn.get_link(p_dn).vertices = dn_vertices
        except Exception:
            pass

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

        # Ignore the synthetic PRV junctions; tune based on "real" nodes.
        pressures = [
            float(info["pressure"])
            for nid, info in ev["node_status"].items()
            if not str(nid).startswith("J_PRV_")
        ]
        max_p = max(pressures, default=0.0)
        min_p = min(pressures, default=0.0)

        delta = 0.0
        if max_p > PRESSURE_MAX:
            delta = -(max_p - PRESSURE_MAX)
        elif min_p < PRESSURE_MIN:
            delta = (PRESSURE_MIN - min_p)

        # Avoid overshooting by applying a capped step each iteration.
        step = max(-20.0, min(20.0, float(delta)))
        if abs(step) < 1e-6:
            break

        for vid in prv_valve_ids:
            try:
                valve = wn.get_link(vid)
                current = float(
                    getattr(valve, "initial_setting", getattr(valve, "setting", 0.0)) or 0.0
                )
                new_setting = max(0.0, current + step)
                if hasattr(valve, "initial_setting"):
                    valve.initial_setting = new_setting
            except Exception:
                continue

        tune_log.append({"iter": it, "deltaSettingM": step, "minP": min_p, "maxP": max_p})

    return tune_log
