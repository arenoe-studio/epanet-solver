"""
prv_apply.py - PRV (Pressure Reducing Valve) application + tuning.
"""

from __future__ import annotations

from typing import Iterable

import wntr

from .config import PRESSURE_MAX, PRESSURE_MIN, PRV_MAX_ITERATIONS
from .prv_helpers import (
    _current_setting,
    _discover_prv_zone_targets,
    _is_synthetic_prv_node,
    _node_xy,
    _normalize_prv_targets,
    _split_polyline_at_fraction,
)
from .simulation import evaluate_network, run_simulation

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


