"""
materials.py - Material recommendation + Hazen-Williams C assignment.

Decision matrix (from EPANET_Solver_Logic_Documentation.md):
  P <= 100m and D <= 110mm  -> PVC AW (PN10), C=140
  P <= 100m and D >  110mm  -> HDPE PE100 PN-10, C=140
  100m < P <= 160m          -> HDPE PE100 PN-16, C=140
  P > 160m                  -> Steel / GIP Heavy, C=120

Special note (GIP availability):
  If P > 160m and D_rec > 114mm, override to HDPE PE100 PN-16 + add note.
"""

from __future__ import annotations

import wntr


PVC_AW = {"material": "PVC AW (PN10)", "C": 140.0}
HDPE_PN10 = {"material": "HDPE PE100 PN-10", "C": 140.0}
HDPE_PN16 = {"material": "HDPE PE100 PN-16", "C": 140.0}
STEEL_GIP = {"material": "Steel / GIP Heavy", "C": 120.0}


def recommend_material(pressure_m: float, diameter_mm: float) -> dict:
    notes: list[str] = []

    if pressure_m <= 100.0:
        rec = PVC_AW if diameter_mm <= 110.0 else HDPE_PN10
    elif pressure_m <= 160.0:
        rec = HDPE_PN16
    else:
        rec = STEEL_GIP

    if rec is STEEL_GIP and diameter_mm > 114.0:
        rec = HDPE_PN16
        notes.append(
            "GIP tidak tersedia dalam diameter ini di pasaran Indonesia; diganti HDPE PE100 PN-16."
        )

    return {**rec, "notes": notes}


def pipe_working_pressure_m(
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


def material_recommendations_for_network(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
) -> dict[str, dict]:
    head = sim_results.get("head")
    if head is None:
        return {}
    p_work = pipe_working_pressure_m(wn, head)
    out: dict[str, dict] = {}
    for pid in wn.pipe_name_list:
        pipe = wn.get_link(pid)
        d_mm = float(pipe.diameter) * 1000.0
        rec = recommend_material(float(p_work.get(pid, 0.0)), d_mm)
        out[pid] = {
            "material": rec["material"],
            "C": float(rec["C"]),
            "notes": rec.get("notes", []),
            "pressureWorkingM": float(p_work.get(pid, 0.0)),
            "diameterMm": d_mm,
        }
    return out
