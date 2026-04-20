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


def analyze_prv_recommendations(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
    eval_results: dict,
) -> dict:
    """
    Modul 3A: produce advisory PRV recommendations if P-HIGH exists.

    Algorithm:
      1. Build directed graph from flow.
      2. For each pipe whose downstream reach contains ≥1 P-HIGH node, compute
         the largest feasible subset (elevation-band aware) it can cover with
         a single PRV setting.
      3. Greedy set-cover on those feasible subsets until all P-HIGH nodes are
         covered. Multiple PRVs may be recommended if a single one cannot span
         the whole elevation gradient.
      4. Remaining uncovered nodes are reported as `unresolvedNodes`.
    """
    high_nodes = {
        nid
        for nid, info in eval_results["node_status"].items()
        if any("P-HIGH" in f for f in info.get("flags", []))
    }
    if not high_nodes:
        return {"needed": False, "tokenCost": 3, "recommendations": [], "unresolvedNodes": []}

    flow = sim_results["flow"]
    flow_by_pipe = flow.to_dict() if hasattr(flow, "to_dict") else dict(flow)

    adj = _directed_edges_from_flow(wn, flow_by_pipe)
    node_elev = {nid: _node_elev(wn, nid) for nid in wn.junction_name_list}

    # Candidate pipes: any pipe whose downstream node leads to a P-HIGH node
    candidates: list[tuple[str, str, str, set[str], float]] = []
    for pid in sorted(wn.pipe_name_list):
        u, v = _pipe_dir(wn, pid, flow_by_pipe)
        reachable = _bfs_reachable(adj, v)
        covered_high = high_nodes.intersection(reachable)
        if not covered_high:
            continue
        elev_prv_ref = node_elev.get(v, 0.0)
        candidates.append((pid, u, v, covered_high, elev_prv_ref))

    uncovered = set(high_nodes)
    chosen: list[PrvRecommendation] = []
    used_pipes: set[str] = set()

    while uncovered and candidates:
        best = None
        best_setting: float | None = None
        best_selected: list[str] = []
        for pid, u, v, covered_high, elev_prv_ref in candidates:
            if pid in used_pipes:
                continue
            high_in_uncovered = [n for n in covered_high if n in uncovered]
            if not high_in_uncovered:
                continue
            selected, setting = _restrict_to_band(high_in_uncovered, node_elev, elev_prv_ref)
            if not selected or setting is None:
                continue
            if len(selected) > len(best_selected):
                best = (pid, u, v, elev_prv_ref)
                best_selected = selected
                best_setting = setting

        if best is None or not best_selected or best_setting is None:
            break

        pid, u, v, elev_prv_ref = best
        used_pipes.add(pid)

        reachable = _bfs_reachable(adj, v)
        elev_max = max(
            (node_elev[nid] for nid in reachable if nid in node_elev),
            default=elev_prv_ref,
        )

        chosen.append(
            PrvRecommendation(
                pipe_id=pid,
                upstream_node=u,
                downstream_node=v,
                covered_nodes=sorted(best_selected),
                setting_head_m=float(best_setting),
                elevation_max_m=float(elev_max),
            )
        )
        uncovered -= set(best_selected)

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

    return {
        "needed": True,
        "tokenCost": 3,
        "recommendations": recs,
        "unresolvedNodes": sorted(uncovered),
    }


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


def fine_tune_prvs(
    wn: wntr.network.WaterNetworkModel,
    prv_targets: dict[str, list[str]] | list[str],
) -> list[dict]:
    """
    Fine-tune PRV settings to keep real-node pressures within [PMIN, PMAX].
    If covered nodes per PRV are provided, each PRV is tuned against its own
    zone so one bad zone does not push every PRV in the same direction.

    Termination reasons (recorded in the last row's `status`):
      - OK          : all pressures within window
      - CONFLICT    : a zone has max>PMAX and min<PMIN simultaneously
      - STAGNANT    : zone pressures stop changing across an iteration
      - CLAMPED     : step would lower setting but valve is already at 0
      - MAX_ITER    : iteration budget exhausted
    """
    tune_log: list[dict] = []
    prev_signature: tuple[tuple[str, float, float, float], ...] | None = None
    zone_targets = _normalize_prv_targets(prv_targets)

    def _emit(
        it: int,
        valve_id: str,
        step: float,
        min_p: float,
        max_p: float,
        status: str,
        reason: str,
        node_ids: list[str] | None = None,
    ) -> None:
        tune_log.append(
            {
                "iter": f"{it}:{valve_id}",
                "valveId": valve_id,
                "deltaSettingM": float(step),
                "minP": float(min_p),
                "maxP": float(max_p),
                "status": status,
                "reason": reason,
                "coveredNodes": list(node_ids or []),
            }
        )

    def _zone_pressures(ev: dict, node_ids: list[str]) -> list[float]:
        values: list[float] = []
        for nid, info in ev["node_status"].items():
            if _is_synthetic_prv_node(str(nid)):
                continue
            if node_ids and nid not in node_ids:
                continue
            try:
                values.append(float(info["pressure"]))
            except Exception:
                continue
        return values

    last_iter = 0
    for it in range(1, PRV_MAX_ITERATIONS + 1):
        last_iter = it
        sim = run_simulation(wn)
        ev = evaluate_network(wn, sim)
        zone_targets = _discover_prv_zone_targets(wn, sim, zone_targets)

        overall_pressures = _zone_pressures(ev, [])
        overall_min = min(overall_pressures, default=0.0)
        overall_max = max(overall_pressures, default=0.0)

        zone_metrics: list[tuple[str, list[str], float, float, float]] = []
        for valve_id, node_ids in zone_targets.items():
            pressures = _zone_pressures(ev, node_ids)
            if not pressures:
                pressures = overall_pressures
            current_setting = 0.0
            try:
                current_setting = _current_setting(wn.get_link(valve_id))
            except Exception:
                current_setting = 0.0
            zone_metrics.append(
                (
                    valve_id,
                    node_ids,
                    min(pressures, default=0.0),
                    max(pressures, default=0.0),
                    current_setting,
                )
            )

        signature = tuple(
            (vid, round(min_p, 3), round(max_p, 3), round(setting, 3))
            for vid, _, min_p, max_p, setting in zone_metrics
        )
        if prev_signature is not None and signature == prev_signature:
            for valve_id, node_ids, min_p, max_p, _setting in zone_metrics:
                _emit(
                    it,
                    valve_id,
                    0.0,
                    min_p,
                    max_p,
                    "STAGNANT",
                    "Tekanan zona tidak berubah; setting PRV sudah jenuh.",
                    node_ids,
                )
            return tune_log
        prev_signature = signature

        zone_actions: list[tuple[str, list[str], float, float, float, str, str]] = []
        all_ok = True

        for valve_id, node_ids, min_p, max_p, current_setting in zone_metrics:
            if max_p > PRESSURE_MAX and min_p < PRESSURE_MIN:
                zone_actions.append(
                    (
                        valve_id,
                        node_ids,
                        0.0,
                        min_p,
                        max_p,
                        "CONFLICT",
                        "Zona ini punya P-HIGH dan P-LOW bersamaan; perlu split zone/PRV tambahan.",
                    )
                )
                all_ok = False
                continue

            if max_p <= PRESSURE_MAX and min_p >= PRESSURE_MIN:
                zone_actions.append(
                    (
                        valve_id,
                        node_ids,
                        0.0,
                        min_p,
                        max_p,
                        "OK",
                        "Semua tekanan zona dalam rentang.",
                    )
                )
                continue

            all_ok = False
            delta = -(max_p - PRESSURE_MAX) if max_p > PRESSURE_MAX else (PRESSURE_MIN - min_p)
            step = max(-15.0, min(15.0, float(delta)))

            if step < 0:
                if current_setting <= 1e-6:
                    zone_actions.append(
                        (
                            valve_id,
                            node_ids,
                            0.0,
                            min_p,
                            max_p,
                            "CLAMPED",
                            "Setting PRV sudah 0 m; tidak bisa diturunkan lagi.",
                        )
                    )
                    continue

            zone_actions.append((valve_id, node_ids, step, min_p, max_p, "STEP", ""))

        if all_ok:
            for valve_id, node_ids, _, min_p, max_p, _, _ in zone_actions:
                _emit(
                    it,
                    valve_id,
                    0.0,
                    min_p,
                    max_p,
                    "OK",
                    "Semua tekanan zona dalam rentang.",
                    node_ids,
                )
            return tune_log

        if any(action[5] in {"CONFLICT", "CLAMPED"} for action in zone_actions) and not any(
            action[5] == "STEP" for action in zone_actions
        ):
            for valve_id, node_ids, step, min_p, max_p, status, reason in zone_actions:
                _emit(it, valve_id, step, min_p, max_p, status, reason, node_ids)
            return tune_log

        for valve_id, node_ids, step, min_p, max_p, status, reason in zone_actions:
            if status == "STEP":
                try:
                    valve = wn.get_link(valve_id)
                    current = _current_setting(valve)
                    new_setting = max(0.0, current + step)
                    if hasattr(valve, "initial_setting"):
                        valve.initial_setting = new_setting
                except Exception:
                    status = "ERROR"
                    reason = "Valve tidak dapat diperbarui."
                    step = 0.0
            _emit(it, valve_id, step, min_p, max_p, status, reason, node_ids)

    for valve_id, node_ids in zone_targets.items():
        _emit(
            last_iter,
            valve_id,
            0.0,
            overall_min,
            overall_max,
            "MAX_ITER",
            "Iterasi maksimum tercapai.",
            node_ids,
        )
    return tune_log


def build_pressure_followup(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
    eval_results: dict,
    prv: dict | None = None,
) -> dict:
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
                    "pressure": float(info.get("pressure", 0.0)),
                    "elevation": _node_elev(wn, str(nid)),
                }
            )
        rows.sort(key=lambda row: (row["pressure"], row["elevation"], row["id"]))
        return rows

    high_nodes = _collect("P-HIGH")
    low_nodes = _collect("P-LOW")
    neg_nodes = _collect("P-NEG")

    followup_prv = {"recommendations": [], "unresolvedNodes": []}
    if high_nodes:
        followup_prv = analyze_prv_recommendations(wn, sim_results, eval_results)

    recommendations: list[str] = []
    actions: list[dict] = []

    if high_nodes:
        if followup_prv.get("recommendations"):
            recommendations.append(
                "Masih ada P-HIGH setelah fix. Tambahkan PRV bertingkat pada zona yang masih tinggi, bukan menggeser semua PRV bersama-sama."
            )
            actions.append(
                {
                    "type": "ADD_PRV_STAGE",
                    "message": "Tambahkan PRV tambahan pada zona tekanan tinggi yang masih tersisa.",
                    "nodes": [row["id"] for row in high_nodes],
                    "recommendations": followup_prv.get("recommendations") or [],
                    "unresolvedNodes": followup_prv.get("unresolvedNodes") or [],
                }
            )
        else:
            recommendations.append(
                "Masih ada P-HIGH, tetapi gradien elevasinya belum feasible untuk satu PRV. Bagi jaringan menjadi beberapa band elevasi."
            )

    if neg_nodes:
        recommendations.append(
            "Masih ada tekanan negatif. Kurangi penurunan head di zona PRV terkait, dan evaluasi kebutuhan booster pump atau reservoir antara."
        )
        actions.append(
            {
                "type": "BOOST_OR_REZONE",
                "message": "Node tekanan negatif perlu tambahan energi atau pembagian zona lebih pendek.",
                "nodes": [row["id"] for row in neg_nodes],
            }
        )
    elif low_nodes:
        recommendations.append(
            "Masih ada P-LOW. Naikkan setting PRV pada zona terkait secara selektif atau evaluasi lagi headloss lokal menuju node rendah."
        )
        actions.append(
            {
                "type": "RAISE_PRV_OR_RECHECK_PIPE",
                "message": "Node tekanan rendah perlu tuning PRV per zona atau evaluasi headloss lokal.",
                "nodes": [row["id"] for row in low_nodes],
            }
        )

    if not recommendations:
        recommendations.append("Semua tekanan node riil sudah berada dalam rentang 10–80 m.")

    status = "resolved"
    if high_nodes or low_nodes or neg_nodes:
        status = "partially_resolved" if prv and prv.get("needed") else "unresolved"

    return {
        "status": status,
        "remainingHighNodes": high_nodes,
        "remainingLowNodes": low_nodes,
        "remainingNegativeNodes": neg_nodes,
        "recommendations": recommendations,
        "recommendedActions": actions,
    }
