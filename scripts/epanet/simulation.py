"""
simulation.py — Simulasi hidraulik & evaluasi standar Permen PU No. 18/2007
"""

import wntr
import pandas as pd
import os

from .config import (
    PRESSURE_MIN, PRESSURE_MAX,
    VELOCITY_MIN, VELOCITY_MAX,
    HL_MAX,
)

# ===========================================================================
# UNIT CONSISTENCY AUDIT (pressure vs head vs elevation)
# ===========================================================================

def _epanet_inp_units(wn: wntr.network.WaterNetworkModel) -> str:
    try:
        units = getattr(wn.options.hydraulic, "inpfile_units", None) or getattr(
            wn.options.hydraulic, "inp_units", None
        )
        return str(units or "LPS").strip().upper()
    except Exception:
        return "LPS"

def _junction_elevations_m(wn: wntr.network.WaterNetworkModel) -> pd.Series:
    elev: dict[str, float] = {}
    for nid in wn.junction_name_list:
        try:
            elev[nid] = float(getattr(wn.get_node(nid), "elevation", 0.0))
        except Exception:
            elev[nid] = 0.0
    return pd.Series(elev, dtype="float64")

def _pressure_from_head_m(wn: wntr.network.WaterNetworkModel, head_m: pd.Series) -> pd.Series:
    elev_m = _junction_elevations_m(wn)
    head_j = head_m.reindex(elev_m.index).astype("float64")
    return (head_j - elev_m).astype("float64")

def _median_abs_diff(a: pd.Series, b: pd.Series) -> float | None:
    try:
        aa = a.astype("float64")
        bb = b.astype("float64")
        d = (aa - bb).abs()
        d = d[pd.notna(d)]
        if d.empty:
            return None
        return float(d.median())
    except Exception:
        return None

def _attach_unit_audit(sim_results: dict, audit: dict) -> dict:
    # Keep audit data JSON-serializable; never put pandas objects here.
    sim_results["_unit_audit"] = audit
    return sim_results


# ===========================================================================
# SIMULASI HIDRAULIK
# ===========================================================================

def run_simulation(wn: wntr.network.WaterNetworkModel) -> dict:
    """
    Jalankan simulasi hidraulik steady-state dan kembalikan dict hasil:
      pressure : Series (junction → tekanan m)
      velocity : Series (pipa → kecepatan m/s)
      headloss : Series (pipa → headloss per km, m/km)
      flow     : Series (pipa → debit m³/s)
      head     : Series (node → head, m)

    Catatan: wn.sim_time direset ke 0 sebelum setiap run agar iterasi
    ke-2+ tidak dimulai dari akhir durasi simulasi (bug WNTR WNTRSimulator).
    """
    wn.sim_time = 0
    # PRV/valves are accurately supported by EPANET engine. WNTRSimulator can
    # silently ignore or approximate some controls/valves, causing PRV installs
    # to have no effect in results.
    simulator = (os.environ.get("EPANET_SOLVER_SIMULATOR") or "auto").strip().lower()
    require_epanet = (os.environ.get("EPANET_SOLVER_REQUIRE_EPANET") or "1").strip().lower() in (
        "1",
        "true",
        "yes",
        "y",
        "on",
    )

    if simulator == "wntr" and require_epanet:
        raise RuntimeError(
            "Mode simulator 'wntr' dinonaktifkan karena EPANET Toolkit wajib. "
            "Set EPANET_SOLVER_REQUIRE_EPANET=0 untuk mengizinkan fallback WNTR."
        )

    if simulator == "epanet":
        results = wntr.sim.EpanetSimulator(wn).run_sim()
    elif simulator == "wntr":
        results = wntr.sim.WNTRSimulator(wn).run_sim()
    else:
        try:
            results = wntr.sim.EpanetSimulator(wn).run_sim()
        except Exception as e:
            if require_epanet:
                raise RuntimeError(
                    "EPANET toolkit tidak tersedia / gagal dijalankan. "
                    "Install EPANET toolkit agar EpanetSimulator bisa jalan, "
                    "atau set EPANET_SOLVER_REQUIRE_EPANET=0 untuk mengizinkan fallback WNTR."
                ) from e
            # Fallback to WNTRSimulator for environments without EPANET toolkit.
            results = wntr.sim.WNTRSimulator(wn).run_sim()

    if results.node["pressure"].empty:
        raise RuntimeError(
            "Simulasi tidak menghasilkan data. "
            "Periksa konvergensi jaringan atau parameter simulasi."
        )

    velocity = results.link["velocity"].iloc[0]
    flow     = results.link["flowrate"].iloc[0]
    head     = results.node["head"].iloc[0].astype("float64")

    pressure_raw = results.node["pressure"].iloc[0].astype("float64")
    pressure_raw = pressure_raw[pressure_raw.index.isin(wn.junction_name_list)]

    # Prefer a consistent definition: pressure (m) == head (m) - elevation (m).
    pressure = _pressure_from_head_m(wn, head)
    pressure = pressure[pressure.index.isin(wn.junction_name_list)]

    audit: dict = {"source": str(simulator), "inpUnits": _epanet_inp_units(wn), "warnings": []}
    med_abs = _median_abs_diff(
        pressure_raw.reindex(wn.junction_name_list),
        pressure.reindex(wn.junction_name_list),
    )
    if med_abs is not None and med_abs > 0.5:
        audit["warnings"].append(
            f"Pressure mismatch vs (head-elev): median |Δ|={med_abs:.3f} m; using (head-elev)."
        )

    # Headloss per km dari selisih head ujung-ujung pipa (WNTR tidak expose langsung)
    hl_per_km = {}
    for pid in wn.pipe_name_list:
        pipe = wn.get_link(pid)
        L_km = pipe.length / 1000.0
        h1   = head.get(pipe.start_node_name, 0.0)
        h2   = head.get(pipe.end_node_name,   0.0)
        hl_per_km[pid] = abs(h1 - h2) / L_km if L_km > 0 else 0.0

    return _attach_unit_audit(
        {
            "pressure": pressure,
            "velocity": velocity.reindex(wn.pipe_name_list).fillna(0),
            "headloss": pd.Series(hl_per_km),
            "flow":     flow.reindex(wn.pipe_name_list).fillna(0),
            "head":     head,
        },
        audit,
    )


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
                flags.append(f"P-HIGH-PRV ({p:.2f} m upstream of PRV — by design)")
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

        # Priority mapping for pipe issues:
        #   V-HIGH / HL-SMALL → HIGH (erosion / undersized pipe)
        #   HL-HIGH           → MEDIUM
        #   V-LOW             → LOW    (sedimentation risk, not urgent)
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

# Weighted scoring: one CRITICAL violation (negative pressure / cavitation) is
# worse than many MEDIUM issues. Lets the report flag cases where fixing one
# problem created a more severe one elsewhere.
SEVERITY_WEIGHTS = {
    "CRITICAL": 100.0,
    "HIGH":     10.0,
    "MEDIUM":   3.0,
    "LOW":      1.0,
}


def severity_breakdown(violations: list[dict]) -> dict[str, int]:
    """Count violations by priority bucket (CRITICAL/HIGH/MEDIUM/LOW)."""
    buckets = {k: 0 for k in SEVERITY_WEIGHTS}
    for v in violations or []:
        pri = str(v.get("priority", "MEDIUM")).upper()
        if pri not in buckets:
            pri = "MEDIUM"
        buckets[pri] += 1
    return buckets


def severity_score(violations: list[dict]) -> float:
    """Weighted sum across severity buckets."""
    b = severity_breakdown(violations)
    return sum(b[k] * SEVERITY_WEIGHTS[k] for k in b)
