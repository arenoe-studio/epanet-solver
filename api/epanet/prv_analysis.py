"""
prv_analysis.py - PRV (Pressure Reducing Valve) analysis + follow-up.
"""

from __future__ import annotations

from dataclasses import dataclass

import wntr

from .config import PRV_PRESSURE_TARGET
from .prv_helpers import (
    _bfs_reachable,
    _directed_edges_from_flow,
    _is_synthetic_prv_node,
    _node_elev,
    _pipe_dir,
    _restrict_to_band,
)

@dataclass
class PrvRecommendation:
    pipe_id: str
    upstream_node: str
    downstream_node: str
    covered_nodes: list[str]
    setting_head_m: float
    elevation_max_m: float

    # NOTE:
    # In some deployed environments we've observed `TypeError: PrvRecommendation() takes no arguments`,
    # which implies `__init__` was not generated (or was stripped) and the class fell back to
    # `object.__init__`. Defining an explicit initializer hardens this codepath and keeps the
    # runtime behavior stable regardless of dataclass codegen.
    def __init__(
        self,
        pipe_id: str,
        upstream_node: str,
        downstream_node: str,
        covered_nodes: list[str],
        setting_head_m: float,
        elevation_max_m: float,
    ) -> None:
        self.pipe_id = pipe_id
        self.upstream_node = upstream_node
        self.downstream_node = downstream_node
        self.covered_nodes = covered_nodes
        self.setting_head_m = setting_head_m
        self.elevation_max_m = elevation_max_m


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
        if (not _is_synthetic_prv_node(str(nid)))
        and any("P-HIGH" in f for f in info.get("flags", []))
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
        # Avoid recommending PRVs on pipes that are already adjacent to a PRV we
        # inserted (synthetic junctions). Putting PRVs in series with no demand
        # between them is almost always redundant in EPANET and can lead to the
        # "2 PRV on one original link" outcome across stages.
        try:
            pipe = wn.get_link(pid)
            if str(pipe.start_node_name).startswith("J_PRV_") or str(pipe.end_node_name).startswith(
                "J_PRV_"
            ):
                continue
        except Exception:
            continue
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
