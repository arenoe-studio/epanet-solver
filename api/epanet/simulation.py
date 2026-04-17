# CANONICAL SOURCE: scripts/epanet/simulation.py — keep in sync
"""
simulation.py â€” Simulasi hidraulik & evaluasi standar Permen PU No. 18/2007
"""

import wntr
import pandas as pd

from .config import (
    PRESSURE_MIN, PRESSURE_MAX,
    VELOCITY_MIN, VELOCITY_MAX,
    HL_MAX,
)


# ===========================================================================
# SIMULASI HIDRAULIK
# ===========================================================================

def run_simulation(wn: wntr.network.WaterNetworkModel) -> dict:
    """
    Jalankan simulasi hidraulik steady-state dan kembalikan dict hasil:
      pressure : Series (junction â†’ tekanan m)
      velocity : Series (pipa â†’ kecepatan m/s)
      headloss : Series (pipa â†’ headloss per km, m/km)
      flow     : Series (pipa â†’ debit mÂ³/s)

    Catatan: wn.sim_time direset ke 0 sebelum setiap run agar iterasi
    ke-2+ tidak dimulai dari akhir durasi simulasi (bug WNTR WNTRSimulator).
    """
    wn.sim_time = 0
    results = wntr.sim.WNTRSimulator(wn).run_sim()

    if results.node["pressure"].empty:
        raise RuntimeError(
            "Simulasi tidak menghasilkan data. "
            "Periksa konvergensi jaringan atau parameter simulasi."
        )

    pressure = results.node["pressure"].iloc[0]
    pressure = pressure[pressure.index.isin(wn.junction_name_list)]

    velocity = results.link["velocity"].iloc[0]
    flow     = results.link["flowrate"].iloc[0]
    head     = results.node["head"].iloc[0]

    # Headloss per km dari selisih head ujung-ujung pipa (WNTR tidak expose langsung)
    hl_per_km = {}
    for pid in wn.pipe_name_list:
        pipe = wn.get_link(pid)
        L_km = pipe.length / 1000.0
        h1   = head.get(pipe.start_node_name, 0.0)
        h2   = head.get(pipe.end_node_name,   0.0)
        hl_per_km[pid] = abs(h1 - h2) / L_km if L_km > 0 else 0.0

    return {
        "pressure": pressure,
        "velocity": velocity.reindex(wn.pipe_name_list).fillna(0),
        "headloss": pd.Series(hl_per_km),
        "flow":     flow.reindex(wn.pipe_name_list).fillna(0),
    }


# ===========================================================================
# EVALUASI STANDAR
# ===========================================================================

def evaluate_network(
    wn: wntr.network.WaterNetworkModel,
    sim_results: dict,
) -> dict:
    """
    Evaluasi hasil simulasi terhadap standar Permen PU No. 18/2007.

    Returns dict:
      node_status : {node_id: {pressure, ok, flags}}
      pipe_status : {pipe_id: {velocity, headloss, diameter, flow, ok, flags, composite}}
      violations  : list of violation dicts
      all_ok      : bool
    """
    pressure = sim_results["pressure"]
    velocity = sim_results["velocity"]
    headloss = sim_results["headloss"]
    violations: list[dict] = []

    # --- Tekanan node --------------------------------------------------------
    node_status: dict = {}
    for nid, p in pressure.items():
        flags: list[str] = []
        if p < 0:
            flags.append(f"P-NEG ({p:.2f} m)")
        if p < PRESSURE_MIN:
            flags.append(f"P-LOW ({p:.2f} m < {PRESSURE_MIN} m)")
            violations.append({
                "element": nid, "type": "NODE", "issue": "P-LOW",
                "value": p, "threshold": PRESSURE_MIN, "unit": "m", "priority": "HIGH",
            })
        if p > PRESSURE_MAX:
            flags.append(f"P-HIGH ({p:.2f} m > {PRESSURE_MAX} m)")
            violations.append({
                "element": nid, "type": "NODE", "issue": "P-HIGH",
                "value": p, "threshold": PRESSURE_MAX, "unit": "m", "priority": "MEDIUM",
            })
        node_status[nid] = {"pressure": p, "ok": len(flags) == 0, "flags": flags}

    # --- Kecepatan & headloss pipa ------------------------------------------
    pipe_status: dict = {}
    for pid in wn.pipe_name_list:
        v   = float(velocity.get(pid, 0.0))
        hl  = float(headloss.get(pid, 0.0))
        d_m = wn.get_link(pid).diameter
        fl  = float(sim_results["flow"].get(pid, 0.0))

        flags, issues = [], set()

        if v > VELOCITY_MAX:
            flags.append(f"V-HIGH ({v:.3f} m/s > {VELOCITY_MAX})")
            issues.add("V-HIGH")
        if v < VELOCITY_MIN and abs(v) > 1e-6:
            flags.append(f"V-LOW ({v:.3f} m/s < {VELOCITY_MIN})")
            issues.add("V-LOW")
        if hl > HL_MAX:
            flags.append(f"HL-HIGH ({hl:.2f} m/km > {HL_MAX})")
            issues.add("HL-HIGH")

        if "V-HIGH" in issues and "HL-HIGH" in issues:
            composite = "HL-SMALL"
        elif "HL-HIGH" in issues:
            composite = "HL-HIGH"
        elif "V-LOW" in issues:
            composite = "V-LOW"
        else:
            composite = "OK"

        for code in issues:
            priority = "HIGH" if code in ("V-HIGH", "HL-SMALL") else "MEDIUM"
            violations.append({
                "element": pid, "type": "PIPE", "issue": code,
                "value":     v   if "V" in code else hl,
                "threshold": VELOCITY_MAX if code == "V-HIGH" else
                             (VELOCITY_MIN if code == "V-LOW" else HL_MAX),
                "unit":      "m/s" if "V" in code else "m/km",
                "priority":  priority,
            })

        pipe_status[pid] = {
            "velocity": v, "headloss": hl, "diameter": d_m,
            "flow": fl, "ok": len(flags) == 0,
            "flags": flags, "composite": composite,
        }

    return {
        "node_status": node_status,
        "pipe_status": pipe_status,
        "violations":  violations,
        "all_ok":      len(violations) == 0,
    }

