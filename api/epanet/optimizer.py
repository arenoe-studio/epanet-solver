"""
optimizer.py - Modul 2: Iterasi diameter otomatis (fokus Velocity & Headloss).

Implements the priority passes described in EPANET_Solver_Logic_Documentation.md:
  HL-SMALL -> HL-HIGH -> V-HIGH -> V-LOW

Stopping criteria for Modul 2:
  - all V/HL flags OK (pressure is handled by Modul 3 / PRV).
  - or max iterations reached / no changes / stagnant / time budget exceeded.
"""

from __future__ import annotations

import copy
import time

import wntr

from .config import HL_MAX, HW_C_DEFAULT, MAX_ITERATIONS, VELOCITY_MAX
from .diameter import (
    ceil_standard_diameter,
    d_min_for_headloss,
    d_min_for_vmax,
    next_diameter_down,
)
from .materials import recommend_material
from .simulation import evaluate_network, run_simulation


def _pipe_working_pressure_m(
    wn: wntr.network.WaterNetworkModel,
    head_series,
) -> dict[str, float]:
    head = head_series.to_dict() if hasattr(head_series, "to_dict") else dict(head_series)
    out: dict[str, float] = {}
    for pid in wn.pipe_name_list:
        pipe = wn.get_link(pid)
        n1, n2 = pipe.start_node_name, pipe.end_node_name
        h1 = float(head.get(n1, 0.0))
        h2 = float(head.get(n2, 0.0))
        e1 = float(getattr(wn.get_node(n1), "elevation", 0.0))
        e2 = float(getattr(wn.get_node(n2), "elevation", 0.0))
        out[pid] = ((h1 + h2) / 2.0) - ((e1 + e2) / 2.0)
    return out


def _apply_material_roughness(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
) -> dict[str, dict]:
    head = sim_results.get("head")
    if head is None:
        return {}

    p_work = _pipe_working_pressure_m(wn, head)
    materials: dict[str, dict] = {}
    for pid in wn.pipe_name_list:
        pipe = wn.get_link(pid)
        d_mm = float(pipe.diameter) * 1000.0
        rec = recommend_material(float(p_work.get(pid, 0.0)), d_mm)
        pipe.roughness = float(rec["C"])
        materials[pid] = {
            "material": rec["material"],
            "C": float(rec["C"]),
            "notes": rec.get("notes", []),
            "pressureWorkingM": float(p_work.get(pid, 0.0)),
            "diameterMm": d_mm,
        }
    return materials


def optimize_diameters(
    wn_orig: wntr.network.WaterNetworkModel,
    max_iterations: int | None = None,
    time_budget_s: float | None = None,
) -> tuple[wntr.network.WaterNetworkModel, dict, dict, list]:
    wn = copy.deepcopy(wn_orig)
    diameter_changes: dict = {}
    snapshots: list = []

    limit = int(max_iterations if max_iterations is not None else MAX_ITERATIONS)
    started = time.time()

    prev_problem_pipes: set[str] = set()

    for iteration in range(1, limit + 1):
        if time_budget_s is not None and (time.time() - started) > float(time_budget_s):
            break

        sim_before = run_simulation(wn)
        eval_before = evaluate_network(wn, sim_before)

        if eval_before.get("all_vhl_ok", False):
            snapshots.append(
                {
                    "iter": iteration,
                    "status": "CONVERGED",
                    "pass": None,
                    "changes": [],
                    "sim_before": sim_before,
                    "eval_before": eval_before,
                    "sim_after": sim_before,
                    "eval_after": eval_before,
                }
            )
            break

        pass_order = ["HL-SMALL", "HL-HIGH", "V-HIGH", "V-LOW"]
        pass_to_run = None
        for p in pass_order:
            if any(info.get("composite") == p for info in eval_before["pipe_status"].values()):
                pass_to_run = p
                break
        if pass_to_run is None:
            pass_to_run = "V-LOW" if any("V-LOW" in " ".join(info.get("flags", [])) for info in eval_before["pipe_status"].values()) else None

        changes_this_iter: list = []
        current_problem_pipes: set[str] = set()

        head = sim_before.get("head")
        p_work = _pipe_working_pressure_m(wn, head) if head is not None else {}

        for pid, info in eval_before["pipe_status"].items():
            if info.get("ok", False):
                continue
            if pass_to_run and info.get("composite") != pass_to_run:
                continue

            current_problem_pipes.add(pid)
            pipe = wn.get_link(pid)
            d_old = float(pipe.diameter)
            flow = float(info.get("flow", 0.0))

            d_mm_now = d_old * 1000.0
            rec_mat = recommend_material(float(p_work.get(pid, 0.0)), d_mm_now)
            C = float(rec_mat.get("C", HW_C_DEFAULT))

            if pass_to_run == "V-LOW":
                d_target = next_diameter_down(d_old)
                reason = "V-LOW -> diameter turun (cari V >= 0.3 m/s)"
            else:
                d_v = d_min_for_vmax(flow, v_max=VELOCITY_MAX)
                d_hl = d_min_for_headloss(flow, hl_target_per_km=HL_MAX, C=C)
                if pass_to_run == "HL-HIGH":
                    d_calc = d_hl
                elif pass_to_run == "V-HIGH":
                    d_calc = d_v
                else:
                    d_calc = max(d_v, d_hl)

                d_target = ceil_standard_diameter(d_calc)
                reason = f"{pass_to_run} -> D_rec {d_target*1000:.0f} mm"

            if abs(d_target - d_old) < 1e-12:
                continue

            pipe.diameter = float(d_target)
            diameter_changes[pid] = {
                "before": diameter_changes.get(pid, {}).get("before", d_old),
                "after": float(d_target),
                "reason": reason,
                "category": pass_to_run,
            }
            changes_this_iter.append(
                {
                    "pipe": pid,
                    "d_before": d_old,
                    "d_after": float(d_target),
                    "reason": reason,
                    "category": pass_to_run,
                }
            )

        _apply_material_roughness(wn, sim_before)

        sim_after = run_simulation(wn)
        eval_after = evaluate_network(wn, sim_after)

        if eval_after.get("all_vhl_ok", False):
            status = "CONVERGED"
        elif not changes_this_iter:
            status = "STUCK"
        elif current_problem_pipes == prev_problem_pipes:
            status = "STAGNANT"
        else:
            status = "RUNNING"

        snapshots.append(
            {
                "iter": iteration,
                "status": status,
                "pass": pass_to_run,
                "changes": changes_this_iter,
                "sim_before": sim_before,
                "eval_before": eval_before,
                "sim_after": sim_after,
                "eval_after": eval_after,
            }
        )

        if status in ("CONVERGED", "STUCK", "STAGNANT"):
            break

        prev_problem_pipes = current_problem_pipes

    sim_final = run_simulation(wn)
    _apply_material_roughness(wn, sim_final)
    sim_final2 = run_simulation(wn)
    final_eval = evaluate_network(wn, sim_final2)

    return wn, final_eval, diameter_changes, snapshots

