"""
Internal helpers for PRV logic (split from prv.py).
"""

from __future__ import annotations

from collections import deque
from typing import Iterable

import wntr

from .config import PRESSURE_MAX, PRESSURE_MIN, PRV_PRESSURE_TARGET

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


def _node_elev(wn: wntr.network.WaterNetworkModel, nid: str) -> float:
    try:
        return float(wn.get_node(nid).elevation)
    except Exception:
        return 0.0


def _feasible_setting(
    elev_prv_ref: float,
    covered_elevs: list[float],
) -> tuple[float | None, float, float]:
    """
    Static-head feasibility for a single PRV covering nodes with given elevations.
    Model: P_node ≈ setting + (elev_prv_ref - elev_node).
    Requires for all covered nodes: PRESSURE_MIN ≤ P_node ≤ PRESSURE_MAX.

    Returns (setting, lo_bound, hi_bound).
    setting is None when infeasible (hi_bound < lo_bound).
    """
    if not covered_elevs:
        return PRV_PRESSURE_TARGET, PRESSURE_MIN, PRESSURE_MAX

    elev_high = max(covered_elevs)
    elev_low = min(covered_elevs)
    # upper bound — lowest node receives the highest pressure
    hi_bound = PRESSURE_MAX - (elev_prv_ref - elev_low)
    # lower bound — highest node receives the lowest pressure
    lo_bound = PRESSURE_MIN - (elev_prv_ref - elev_high)

    if hi_bound + 1e-6 < lo_bound:
        return None, lo_bound, hi_bound

    # PRV setting cannot go below 0 m. If hi_bound < 0 the lowest covered node
    # would still exceed PMAX even at setting=0 — recommendation is infeasible.
    if hi_bound < 0.0:
        return None, lo_bound, hi_bound

    target = float(PRV_PRESSURE_TARGET)
    setting = max(lo_bound, min(hi_bound, target))
    setting = max(0.0, setting)
    return setting, lo_bound, hi_bound


def _restrict_to_band(
    candidate_high_nodes: list[str],
    node_elev: dict[str, float],
    elev_prv_ref: float,
) -> tuple[list[str], float | None]:
    """
    Given candidate P-HIGH nodes reachable downstream from a pipe, pick the
    largest subset whose elevation span is small enough that a single PRV
    setting can keep all of them within [PRESSURE_MIN, PRESSURE_MAX].

    Greedy: sort by elevation descending, start from the highest node, keep
    adding lower-elevation nodes while the resulting set remains feasible.
    """
    if not candidate_high_nodes:
        return [], None

    sorted_nodes = sorted(candidate_high_nodes, key=lambda n: -node_elev.get(n, 0.0))
    selected: list[str] = []
    best_setting: float | None = None

    for n in sorted_nodes:
        trial = selected + [n]
        trial_elevs = [node_elev.get(x, 0.0) for x in trial]
        setting, _, _ = _feasible_setting(elev_prv_ref, trial_elevs)
        if setting is None:
            break
        selected = trial
        best_setting = setting

    return selected, best_setting


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


def _current_setting(valve) -> float:
    try:
        return float(
            getattr(valve, "initial_setting", getattr(valve, "setting", 0.0)) or 0.0
        )
    except Exception:
        return 0.0


def _is_synthetic_prv_node(node_id: str) -> bool:
    return str(node_id).startswith("J_PRV_")


def _normalize_prv_targets(
    prv_targets: dict[str, list[str]] | list[str],
) -> dict[str, list[str]]:
    if not prv_targets:
        return {}
    if isinstance(prv_targets, dict):
        return {
            str(valve_id): sorted({str(nid) for nid in (node_ids or [])})
            for valve_id, node_ids in prv_targets.items()
        }
    return {str(valve_id): [] for valve_id in prv_targets}


def _discover_prv_zone_targets(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
    seed_targets: dict[str, list[str]],
) -> dict[str, list[str]]:
    flow = sim_results.get("flow")
    flow_by_pipe = flow.to_dict() if hasattr(flow, "to_dict") else dict(flow or {})
    adj = _directed_edges_from_flow(wn, flow_by_pipe)
    synthetic_nodes = {str(nid) for nid in wn.junction_name_list if _is_synthetic_prv_node(str(nid))}

    zone_targets: dict[str, list[str]] = {}
    for valve_id, seed_nodes in seed_targets.items():
        try:
            valve = wn.get_link(valve_id)
            start_node = str(valve.end_node_name)
            own_nodes = {str(valve.start_node_name), str(valve.end_node_name)}
        except Exception:
            zone_targets[valve_id] = list(seed_nodes)
            continue

        blocked_synthetic = synthetic_nodes.difference(own_nodes)
        seen = {start_node}
        queue = deque([start_node])
        real_nodes: set[str] = set()

        while queue:
            current = queue.popleft()
            if (
                not _is_synthetic_prv_node(current)
                and current in wn.junction_name_list
            ):
                real_nodes.add(str(current))

            for nxt in adj.get(current, []):
                nxt = str(nxt)
                if nxt in seen:
                    continue
                seen.add(nxt)
                if nxt in blocked_synthetic:
                    continue
                queue.append(nxt)

        zone_targets[valve_id] = sorted(real_nodes.union(seed_nodes))

    return zone_targets


