# CANONICAL SOURCE: scripts/epanet/simulation.py — keep in sync
"""
simulation.py â€” Simulasi hidraulik & evaluasi standar Permen PU No. 18/2007
"""

import wntr
import pandas as pd
import os
import tempfile
from pathlib import Path

from .config import (
    PRESSURE_MIN, PRESSURE_MAX,
    VELOCITY_MIN, VELOCITY_MAX,
    HL_MAX,
)

def _run_epyt_on_inp(inp_path: Path) -> dict[str, dict[str, float]]:
    """
    Run EPANET Toolkit via EPyT (epyt) on an .inp file and return raw maps:
      node_pressure, node_head, link_flow, link_velocity, link_headloss
    """
    from epyt import epanet  # type: ignore

    d = epanet(str(inp_path))
    d.openHydraulicAnalysis()
    d.initializeHydraulicAnalysis()
    d.runHydraulicAnalysis()

    node_ids = list(d.getNodeNameID())
    link_ids = list(d.getLinkNameID())

    pressures = list(d.getNodePressure())
    heads = list(d.getNodeHydraulicHead())
    flows = list(d.getLinkFlows())
    velocities = list(d.getLinkVelocity())
    headloss = list(d.getLinkHeadloss())

    d.closeHydraulicAnalysis()

    node_pressure = {str(nid): float(p) for nid, p in zip(node_ids, pressures)}
    node_head = {str(nid): float(h) for nid, h in zip(node_ids, heads)}
    link_flow = {str(lid): float(q) for lid, q in zip(link_ids, flows)}
    link_velocity = {str(lid): float(v) for lid, v in zip(link_ids, velocities)}
    link_headloss = {str(lid): float(hl) for lid, hl in zip(link_ids, headloss)}

    return {
        "node_pressure": node_pressure,
        "node_head": node_head,
        "link_flow": link_flow,
        "link_velocity": link_velocity,
        "link_headloss": link_headloss,
    }


def _run_simulation_epyt(wn: wntr.network.WaterNetworkModel) -> dict:
    """
    Run simulation using EPANET Toolkit via EPyT.
    We export the current WNTR model to a temporary .inp to preserve the rest of
    the pipeline (optimizer/PRV still mutate the WNTR model in memory).
    """
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".inp",
            delete=False,
            encoding="utf-8",
        ) as tmp:
            tmp_path = tmp.name

        wntr.network.write_inpfile(wn, tmp_path)

        raw = _run_epyt_on_inp(Path(tmp_path))

        head = pd.Series(raw["node_head"])
        pressure = pd.Series(raw["node_pressure"])
        pressure = pressure[pressure.index.isin(wn.junction_name_list)]

        velocity_map = raw["link_velocity"]
        flow_map = raw["link_flow"]

        velocity = pd.Series({pid: float(velocity_map.get(pid, 0.0)) for pid in wn.pipe_name_list})
        flow = pd.Series({pid: float(flow_map.get(pid, 0.0)) for pid in wn.pipe_name_list})

        hl_per_km: dict[str, float] = {}
        for pid in wn.pipe_name_list:
            pipe = wn.get_link(pid)
            L_km = pipe.length / 1000.0
            h1 = float(head.get(pipe.start_node_name, 0.0))
            h2 = float(head.get(pipe.end_node_name, 0.0))
            hl_per_km[pid] = abs(h1 - h2) / L_km if L_km > 0 else 0.0

        return {
            "pressure": pressure,
            "velocity": velocity.reindex(wn.pipe_name_list).fillna(0),
            "headloss": pd.Series(hl_per_km),
            "flow": flow.reindex(wn.pipe_name_list).fillna(0),
            "head": head,
        }
    finally:
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass


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
      head     : Series (node â†’ head, m)

    Catatan: wn.sim_time direset ke 0 sebelum setiap run agar iterasi
    ke-2+ tidak dimulai dari akhir durasi simulasi (bug WNTR WNTRSimulator).
    """
    wn.sim_time = 0
    # PRV/valves are accurately supported by EPANET engine. WNTRSimulator can
    # silently ignore or approximate some controls/valves, causing PRV installs
    # to have no effect in results.
    simulator = (os.environ.get("EPANET_SOLVER_SIMULATOR") or "epyt").strip().lower()
    require_epanet = (os.environ.get("EPANET_SOLVER_REQUIRE_EPANET") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "y",
        "on",
    )

    if simulator == "epyt":
        return _run_simulation_epyt(wn)
    if simulator == "epanet":
        results = wntr.sim.EpanetSimulator(wn).run_sim()
    elif simulator == "wntr":
        results = wntr.sim.WNTRSimulator(wn).run_sim()
    else:
        try:
            return _run_simulation_epyt(wn)
        except Exception as e:
            if require_epanet:
                raise RuntimeError(
                    "EPANET toolkit tidak tersedia / gagal dijalankan via EPyT (epyt). "
                    "Pastikan shared library EPANET tersedia (libepanet.so), atau "
                    "set EPANET_SOLVER_SIMULATOR=wntr untuk memaksa fallback."
                ) from e
            try:
                results = wntr.sim.EpanetSimulator(wn).run_sim()
            except Exception:
                # Fallback to WNTRSimulator for environments without EPANET toolkit.
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
        "head":     head,
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
    vhl_violations = 0

    # --- Tekanan node --------------------------------------------------------
    # Synthetic junctions created by apply_prvs (J_PRV_*) sit on the upstream
    # side of a PRV valve; they carry unregulated upstream pressure by design.
    # Exclude them from violation counting but keep them in node_status.
    node_status: dict = {}
    for nid, p in pressure.items():
        is_synthetic = str(nid).startswith("J_PRV_")
        flags: list[str] = []
        if p < 0:
            code = "P-NEG"
            flags.append(f"P-NEG ({p:.2f} m)")
            if not is_synthetic:
                violations.append({
                    "element": nid, "type": "NODE", "issue": "P-NEG",
                    "value": p, "threshold": 0.0, "unit": "m", "priority": "CRITICAL",
                })
        elif p < PRESSURE_MIN:
            code = "P-LOW"
            flags.append(f"P-LOW ({p:.2f} m < {PRESSURE_MIN} m)")
            if not is_synthetic:
                violations.append({
                    "element": nid, "type": "NODE", "issue": "P-LOW",
                    "value": p, "threshold": PRESSURE_MIN, "unit": "m", "priority": "HIGH",
                })
        elif p > PRESSURE_MAX:
            code = "P-HIGH"
            if is_synthetic:
                flags.append(f"P-HIGH-PRV ({p:.2f} m upstream of PRV - by design)")
            else:
                flags.append(f"P-HIGH ({p:.2f} m > {PRESSURE_MAX} m)")
                violations.append({
                    "element": nid, "type": "NODE", "issue": "P-HIGH",
                    "value": p, "threshold": PRESSURE_MAX, "unit": "m", "priority": "MEDIUM",
                })
        else:
            code = "P-OK"

        node_status[nid] = {
            "pressure": p,
            "ok": len(flags) == 0 or is_synthetic,
            "flags": flags,
            "code": code,
            "synthetic": is_synthetic,
        }

    # --- Kecepatan & headloss pipa ------------------------------------------
    pipe_status: dict = {}
    for pid in wn.pipe_name_list:
        v   = abs(float(velocity.get(pid, 0.0)))
        hl  = float(headloss.get(pid, 0.0))
        d_m = wn.get_link(pid).diameter
        fl  = float(sim_results["flow"].get(pid, 0.0))

        flags, issues = [], set()

        if v > VELOCITY_MAX:
            flags.append(f"V-HIGH ({v:.3f} m/s > {VELOCITY_MAX})")
            issues.add("V-HIGH")
        if v < VELOCITY_MIN:
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

        _pipe_priority = {
            "V-HIGH": "HIGH",
            "HL-SMALL": "HIGH",
            "HL-HIGH": "MEDIUM",
            "V-LOW": "LOW",
        }
        for code in issues:
            priority = _pipe_priority.get(code, "MEDIUM")
            violations.append({
                "element": pid, "type": "PIPE", "issue": code,
                "value":     v   if "V" in code else hl,
                "threshold": VELOCITY_MAX if code == "V-HIGH" else
                             (VELOCITY_MIN if code == "V-LOW" else HL_MAX),
                "unit":      "m/s" if "V" in code else "m/km",
                "priority":  priority,
            })
            vhl_violations += 1

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
        "all_vhl_ok":  vhl_violations == 0,
    }


# ===========================================================================
# SEVERITY SCORING
# ===========================================================================

SEVERITY_WEIGHTS = {
    "CRITICAL": 100.0,
    "HIGH":     10.0,
    "MEDIUM":   3.0,
    "LOW":      1.0,
}


def severity_breakdown(violations: list[dict]) -> dict[str, int]:
    buckets = {k: 0 for k in SEVERITY_WEIGHTS}
    for v in violations or []:
        pri = str(v.get("priority", "MEDIUM")).upper()
        if pri not in buckets:
            pri = "MEDIUM"
        buckets[pri] += 1
    return buckets


def severity_score(violations: list[dict]) -> float:
    b = severity_breakdown(violations)
    return sum(b[k] * SEVERITY_WEIGHTS[k] for k in b)
