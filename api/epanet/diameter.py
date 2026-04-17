"""
diameter.py - Pipe diameter utilities (Modul 2)

Implements the formulas described in EPANET_Solver_Logic_Documentation.md:
  D_min_V  = sqrt(4 * Q / (pi * V_max))
  D_min_HL = (10.67 * 1000 * Q^1.852 / (C^1.852 * HL_target))^(1/4.87)

Then:
  D_calc = max(D_min_V, D_min_HL)
  D_rec  = smallest standard diameter >= D_calc
"""

from __future__ import annotations

import math

from .config import DIAMETER_SIZES_M, HL_MAX, HW_C_DEFAULT, VELOCITY_MAX


def next_diameter_up(d_m: float) -> float:
    """Next larger standard diameter (meters)."""
    for size in DIAMETER_SIZES_M:
        if size > d_m + 1e-6:
            return size
    return DIAMETER_SIZES_M[-1]


def next_diameter_down(d_m: float) -> float:
    """Next smaller standard diameter (meters)."""
    for size in reversed(DIAMETER_SIZES_M):
        if size < d_m - 1e-6:
            return size
    return DIAMETER_SIZES_M[0]


def ceil_standard_diameter(d_m: float) -> float:
    """Smallest standard diameter >= d_m (meters)."""
    for size in DIAMETER_SIZES_M:
        if size >= d_m - 1e-6:
            return size
    return DIAMETER_SIZES_M[-1]


def d_min_for_vmax(flow_m3s: float, v_max: float = VELOCITY_MAX) -> float:
    """Minimum diameter to keep velocity <= v_max, using continuity."""
    Q = abs(flow_m3s)
    if Q < 1e-12:
        return 0.0
    return math.sqrt(4.0 * Q / (math.pi * v_max))


def d_min_for_headloss(
    flow_m3s: float,
    hl_target_per_km: float = HL_MAX,
    C: float = HW_C_DEFAULT,
) -> float:
    """Minimum diameter to keep headloss <= hl_target_per_km (m/km), inverse Hazen-Williams."""
    Q = abs(flow_m3s)
    if Q < 1e-12:
        return 0.0
    return (10.67 * 1000.0 * Q**1.852 / (C**1.852 * hl_target_per_km)) ** (1.0 / 4.87)


def recommend_diameter(
    flow_m3s: float,
    C: float = HW_C_DEFAULT,
    hl_target_per_km: float = HL_MAX,
    v_max: float = VELOCITY_MAX,
) -> tuple[float, dict]:
    """Return (recommended_standard_diameter_m, meta dict)."""
    d_min_v = d_min_for_vmax(flow_m3s, v_max=v_max)
    d_min_hl = d_min_for_headloss(flow_m3s, hl_target_per_km=hl_target_per_km, C=C)
    d_calc = max(d_min_v, d_min_hl)
    return ceil_standard_diameter(d_calc), {"d_min_v": d_min_v, "d_min_hl": d_min_hl, "d_calc": d_calc}


def mm(d_m: float) -> str:
    return f"{d_m * 1000:.0f} mm"


def status_symbol(ok: bool) -> str:
    return "OK" if ok else "FAIL"

