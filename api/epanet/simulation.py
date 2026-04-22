# CANONICAL SOURCE: scripts/epanet/simulation.py — keep in sync
"""
simulation.py â€” Simulasi hidraulik & evaluasi standar Permen PU No. 18/2007
"""

import os
import tempfile
import threading
from pathlib import Path

import pandas as pd
import wntr

from .config import (
    PRESSURE_MIN, PRESSURE_MAX,
    VELOCITY_MIN, VELOCITY_MAX,
    HL_MAX,
)

class EpanetToolkitUnavailable(RuntimeError):
    """EPANET Toolkit via EPyT (epyt) is unavailable or failed to run."""

# ===========================================================================
# UNIT NORMALIZATION (EPANET vs WNTR vs EPyT)
# ===========================================================================

# EPANET flow units: SI set => length outputs in meters, pressure outputs in meters.
# US set => length outputs in feet, pressure outputs in psi.
_EPANET_SI_FLOW_UNITS_TO_M3S: dict[str, float] = {
    "LPS": 1.0e-3,                 # L/s
    "LPM": 1.0e-3 / 60.0,          # L/min
    "MLD": 1000.0 / 86400.0,       # million L/day = 1000 m3/day
    "CMH": 1.0 / 3600.0,           # m3/hour
    "CMD": 1.0 / 86400.0,          # m3/day
}

_EPANET_US_FLOW_UNITS_TO_M3S: dict[str, float] = {
    "CFS": 0.028316846592,         # ft3/s
    "GPM": 0.003785411784 / 60.0,  # US gal/min
    "MGD": (1_000_000.0 * 0.003785411784) / 86400.0,  # million US gal/day
    "IMGD": (1_000_000.0 * 0.00454609) / 86400.0,     # million imperial gal/day
    "AFD": 1233.48184 / 86400.0,   # acre-ft/day
}

_FT_TO_M = 0.3048
_PSI_TO_MH2O = 6894.757293168 / 9806.65  # psi -> meters of water column

def _epanet_inp_units(wn: wntr.network.WaterNetworkModel) -> str:
    try:
        units = getattr(wn.options.hydraulic, "inpfile_units", None) or getattr(
            wn.options.hydraulic, "inp_units", None
        )
        return str(units or "LPS").strip().upper()
    except Exception:
        return "LPS"

def _epanet_unit_factors(inp_units: str) -> dict[str, float]:
    u = (inp_units or "").strip().upper()
    flow_factor = _EPANET_SI_FLOW_UNITS_TO_M3S.get(u)
    if flow_factor is None:
        flow_factor = _EPANET_US_FLOW_UNITS_TO_M3S.get(u)

    # Default to SI (no conversion) if unit is unknown; we'll still run a
    # pressure/head consistency audit later.
    is_us = u in _EPANET_US_FLOW_UNITS_TO_M3S
    return {
        "length_to_m": _FT_TO_M if is_us else 1.0,
        "velocity_to_mps": _FT_TO_M if is_us else 1.0,
        "pressure_to_m": _PSI_TO_MH2O if is_us else 1.0,
        "flow_to_m3s": float(flow_factor) if flow_factor is not None else (1.0e-3 if u == "LPS" else 1.0),
        "is_us": 1.0 if is_us else 0.0,
    }

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

# EPANET toolkit bindings (both WNTR EpanetSimulator and EPyT) are not
# thread-safe. Concurrent calls can corrupt process memory and crash the
# server (e.g., glibc "double free or corruption").
_EPANET_TOOLKIT_LOCK = threading.Lock()


def _best_effort_close_epyt(handle: object) -> None:
    """
    Close an EPyT epanet() handle without invoking multiple teardown paths.

    EPyT exposes several teardown-ish methods across versions. Calling more
    than one can lead to double-free in the underlying native library.
    """
    close = getattr(handle, "close", None)
    if callable(close):
        try:
            close()
        except Exception:
            pass
        return

    close_network = getattr(handle, "closeNetwork", None)
    if callable(close_network):
        try:
            close_network()
        except Exception:
            pass
        return

    close_hyd = getattr(handle, "closeHydraulicAnalysis", None)
    if callable(close_hyd):
        try:
            close_hyd()
        except Exception:
            pass


def _run_epyt_on_inp(inp_path: Path) -> dict[str, dict[str, float]]:
    """
    Run EPANET Toolkit via EPyT (epyt) on an .inp file and return raw maps:
      node_pressure, node_head, link_flow, link_velocity, link_headloss
    """
    try:
        from epyt import epanet  # type: ignore
    except Exception as e:
        raise EpanetToolkitUnavailable(
            "EPANET Toolkit tidak tersedia (gagal import epyt)."
        ) from e

    node_ids: list = []
    link_ids: list = []
    pressures: list = []
    heads: list = []
    flows: list = []
    velocities: list = []
    headloss: list = []

    with _EPANET_TOOLKIT_LOCK:
        d = None
        try:
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
        except Exception as e:
            raise EpanetToolkitUnavailable("EPANET Toolkit gagal dijalankan (epyt).") from e
        finally:
            # EPyT can keep file handles open unless explicitly closed. If we
            # don't close them, long-running servers can hit EMFILE.
            if d is not None:
                _best_effort_close_epyt(d)
            d = None

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

        try:
            wntr.network.write_inpfile(wn, tmp_path)
        except Exception as e:
            raise RuntimeError("Gagal mengekspor model ke .inp untuk EPANET Toolkit.") from e

        raw = _run_epyt_on_inp(Path(tmp_path))

        inp_units = _epanet_inp_units(wn)
        factors = _epanet_unit_factors(inp_units)

        head = pd.Series(raw["node_head"], dtype="float64") * float(factors["length_to_m"])
        pressure_raw = pd.Series(raw["node_pressure"], dtype="float64") * float(factors["pressure_to_m"])

        velocity_map = raw["link_velocity"]
        flow_map = raw["link_flow"]

        velocity = (
            pd.Series({pid: float(velocity_map.get(pid, 0.0)) for pid in wn.pipe_name_list}, dtype="float64")
            * float(factors["velocity_to_mps"])
        )
        flow = (
            pd.Series({pid: float(flow_map.get(pid, 0.0)) for pid in wn.pipe_name_list}, dtype="float64")
            * float(factors["flow_to_m3s"])
        )

        # Prefer a consistent definition: pressure (m) == head (m) - elevation (m).
        # This also mitigates common EPANET/EPyT output unit mismatches (psi/kPa).
        pressure = _pressure_from_head_m(wn, head)

        audit: dict = {
            "source": "epyt",
            "inpUnits": inp_units,
            "factors": {
                "length_to_m": float(factors["length_to_m"]),
                "velocity_to_mps": float(factors["velocity_to_mps"]),
                "pressure_to_m": float(factors["pressure_to_m"]),
                "flow_to_m3s": float(factors["flow_to_m3s"]),
                "is_us": bool(factors["is_us"]),
            },
            "warnings": [],
        }

        # Compare EPyT-reported pressure vs computed (head-elev) after conversion.
        prj = pressure_raw.reindex(wn.junction_name_list)
        pcj = pressure.reindex(wn.junction_name_list)
        med_abs = _median_abs_diff(prj, pcj)
        if med_abs is not None and med_abs > 0.5:  # meters
            audit["warnings"].append(
                f"EPyT pressure mismatch vs (head-elev): median |Δ|={med_abs:.3f} m; using (head-elev)."
            )

        # Sanity check: reservoir heads should be close to model's reservoir head after conversion.
        try:
            ratios: list[float] = []
            for rid in wn.reservoir_name_list:
                try:
                    expected = float(wn.get_node(rid).head_timeseries.base_value)
                except Exception:
                    expected = float(getattr(wn.get_node(rid), "head", 0.0))
                measured = float(head.get(rid, float("nan")))
                if expected > 1e-9 and measured == measured:
                    ratios.append(measured / expected)
            if ratios:
                # If conversion is wrong, ratio will be wildly off (e.g. ~3.28 or ~0.3 or negative).
                rmed = float(pd.Series(ratios).median())
                audit["reservoirHeadRatioMedian"] = round(rmed, 6)
                if rmed < 0.2 or rmed > 5.0:
                    audit["warnings"].append(
                        f"Reservoir head ratio looks wrong (median={rmed:.3f}); EPyT results may be invalid."
                    )
        except Exception:
            pass

        hl_per_km: dict[str, float] = {}
        for pid in wn.pipe_name_list:
            pipe = wn.get_link(pid)
            L_km = pipe.length / 1000.0
            h1 = float(head.get(pipe.start_node_name, 0.0))
            h2 = float(head.get(pipe.end_node_name, 0.0))
            hl_per_km[pid] = abs(h1 - h2) / L_km if L_km > 0 else 0.0

        return _attach_unit_audit(
            {
            "pressure": pressure,
            "velocity": velocity.reindex(wn.pipe_name_list).fillna(0),
            "headloss": pd.Series(hl_per_km),
            "flow": flow.reindex(wn.pipe_name_list).fillna(0),
            "head": head,
            },
            audit,
        )
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
    simulator = (os.environ.get("EPANET_SOLVER_SIMULATOR") or "auto").strip().lower()
    require_epanet = (os.environ.get("EPANET_SOLVER_REQUIRE_EPANET") or "1").strip().lower() in (
        "1",
        "true",
        "yes",
        "y",
        "on",
    )

    if simulator == "wntr" and require_epanet:
        raise EpanetToolkitUnavailable(
            "Mode simulator 'wntr' dinonaktifkan karena EPANET Toolkit wajib. "
            "Set EPANET_SOLVER_REQUIRE_EPANET=0 untuk mengizinkan fallback WNTR."
        )

    if simulator == "epyt":
        try:
            return _run_simulation_epyt(wn)
        except EpanetToolkitUnavailable:
            if require_epanet:
                raise
            results = wntr.sim.WNTRSimulator(wn).run_sim()

    if simulator == "epanet":
        with _EPANET_TOOLKIT_LOCK:
            results = wntr.sim.EpanetSimulator(wn).run_sim()
    elif simulator == "wntr":
        results = wntr.sim.WNTRSimulator(wn).run_sim()
    else:  # auto
        try:
            with _EPANET_TOOLKIT_LOCK:
                results = wntr.sim.EpanetSimulator(wn).run_sim()
        except Exception:
            try:
                return _run_simulation_epyt(wn)
            except EpanetToolkitUnavailable:
                if require_epanet:
                    raise
                results = wntr.sim.WNTRSimulator(wn).run_sim()
            except Exception as e:
                if require_epanet:
                    raise EpanetToolkitUnavailable(
                        "EPANET Toolkit tidak tersedia / gagal dijalankan."
                    ) from e
                results = wntr.sim.WNTRSimulator(wn).run_sim()

    if results.node["pressure"].empty:
        raise RuntimeError(
            "Simulasi tidak menghasilkan data. "
            "Periksa konvergensi jaringan atau parameter simulasi."
        )

    # WNTR's Result object may carry units depending on the simulator backend.
    # Normalize to: head (m), pressure (m), flow (m3/s), velocity (m/s).
    head = results.node["head"].iloc[0].astype("float64")
    pressure_raw = results.node["pressure"].iloc[0].astype("float64")
    pressure_raw = pressure_raw[pressure_raw.index.isin(wn.junction_name_list)]

    velocity = results.link["velocity"].iloc[0]
    flow     = results.link["flowrate"].iloc[0]

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
