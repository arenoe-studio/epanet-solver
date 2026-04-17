# CANONICAL SOURCE: scripts/epanet/optimizer.py — keep in sync
"""
optimizer.py â€” Optimasi diameter pipa dengan Analytical Window Method

Strategi per pipa:
  â€¢ V-LOW / HL-HIGH / HL-SMALL â†’ analytical_optimal_diameter(flow)
      FEASIBLE  : diameter optimal yang memenuhi V dan HL sekaligus
      INFEASIBLE: flow terlalu kecil; pakai D_min, tandai untuk solusi operasional
      CONFLICT  : tidak ada D yang memenuhi keduanya; prioritaskan HL
  â€¢ P-HIGH  â†’ skip (ditangani PRV, bukan diameter)
  â€¢ P-LOW   â†’ naikkan diameter pipa upstream

Loop berhenti bila CONVERGED, STUCK, atau STAGNANT.
"""

import copy
import wntr

from .config import MAX_ITERATIONS, PRESSURE_MIN
from .diameter import analytical_optimal_diameter, next_diameter_up, d_max_for_vmin
from .simulation import run_simulation, evaluate_network


def optimize_diameters(
    wn_orig: wntr.network.WaterNetworkModel,
    max_iterations: int | None = None,
) -> tuple[wntr.network.WaterNetworkModel, dict, dict, list]:
    """
    Optimasi diameter pipa secara analitis + validasi simulasi.

    Returns:
      wn_optimized    â€” model jaringan dengan diameter baru
      final_eval      â€” hasil evaluate_network setelah optimasi
      diameter_changes â€” {pipe_id: {before, after, reason, category}}
      snapshots       â€” list per iterasi {iter, status, changes,
                        sim_before, eval_before, sim_after, eval_after}
    """
    wn               = copy.deepcopy(wn_orig)
    diameter_changes: dict = {}
    snapshots:        list = []
    prev_problem_pipes: set = set()

    limit = max_iterations if max_iterations is not None else MAX_ITERATIONS

    for iteration in range(1, limit + 1):
        sim_before  = run_simulation(wn)
        eval_before = evaluate_network(wn, sim_before)

        # Selesai â€” semua kriteria terpenuhi
        if eval_before["all_ok"]:
            snapshots.append({
                "iter": iteration, "status": "CONVERGED", "changes": [],
                "sim_before": sim_before, "eval_before": eval_before,
                "sim_after":  sim_before, "eval_after":  eval_before,
            })
            return wn, eval_before, diameter_changes, snapshots

        changes_this_iter:    list = []
        current_problem_pipes: set = set()

        # --- Pipa: Analytical Window Method ----------------------------------
        for pipe_id, info in eval_before["pipe_status"].items():
            if info["ok"]:
                continue

            current_problem_pipes.add(pipe_id)
            pipe  = wn.get_link(pipe_id)
            d_old = pipe.diameter
            flow  = info["flow"]

            d_optimal, category = analytical_optimal_diameter(flow)

            composite = info["composite"]
            if category == "INFEASIBLE":
                reason = (
                    f"INFEASIBLE â€” flow {abs(flow)*1000:.3f} L/s terlalu kecil "
                    f"(D_max_V={d_max_for_vmin(flow)*1000:.1f} mm < 40 mm)"
                )
            elif category == "CONFLICT":
                reason = (
                    f"CONFLICT â€” V & HL bertentangan, prioritas HL "
                    f"â†’ {d_optimal*1000:.0f} mm, V-LOW diterima"
                )
            else:
                reason = f"{composite} â†’ OPTIMAL {d_optimal*1000:.0f} mm"

            if abs(d_optimal - d_old) < 1e-6:
                continue

            pipe.diameter = d_optimal
            diameter_changes[pipe_id] = {
                "before":   diameter_changes.get(pipe_id, {}).get("before", d_old),
                "after":    d_optimal,
                "reason":   reason,
                "category": category,
            }
            changes_this_iter.append({
                "pipe":     pipe_id,
                "d_before": d_old,
                "d_after":  d_optimal,
                "reason":   reason,
                "category": category,
            })

        # --- Node P-LOW: naikkan diameter pipa upstream ----------------------
        for nid, ninfo in eval_before["node_status"].items():
            if ninfo["ok"] or ninfo["pressure"] >= PRESSURE_MIN:
                continue
            for pipe_id in wn.pipe_name_list:
                pipe = wn.get_link(pipe_id)
                if pipe.end_node_name != nid:
                    continue
                d_old = pipe.diameter
                d_new = next_diameter_up(d_old)
                if abs(d_new - d_old) < 1e-6:
                    continue
                pipe.diameter = d_new
                reason = f"P-LOW upstream â†’ {nid}"
                diameter_changes[pipe_id] = {
                    "before":   diameter_changes.get(pipe_id, {}).get("before", d_old),
                    "after":    d_new,
                    "reason":   reason,
                    "category": "P-LOW",
                }
                changes_this_iter.append({
                    "pipe": pipe_id, "d_before": d_old, "d_after": d_new,
                    "reason": reason, "category": "P-LOW",
                })

        # --- Evaluasi setelah perubahan --------------------------------------
        sim_after  = run_simulation(wn)
        eval_after = evaluate_network(wn, sim_after)

        if eval_after["all_ok"]:
            status = "CONVERGED"
        elif not changes_this_iter:
            status = "STUCK"
        elif current_problem_pipes == prev_problem_pipes:
            status = "STAGNANT"
        else:
            status = "RUNNING"

        snapshots.append({
            "iter": iteration, "status": status, "changes": changes_this_iter,
            "sim_before": sim_before, "eval_before": eval_before,
            "sim_after":  sim_after,  "eval_after":  eval_after,
        })

        if status in ("CONVERGED", "STUCK", "STAGNANT"):
            break

        prev_problem_pipes = current_problem_pipes

    final_eval = snapshots[-1]["eval_after"]
    return wn, final_eval, diameter_changes, snapshots

