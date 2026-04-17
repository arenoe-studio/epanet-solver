# CANONICAL SOURCE: scripts/epanet/diameter.py — keep in sync
"""
diameter.py â€” Utilitas diameter pipa & Analytical Window Method

Analytical Window Method:
  Untuk setiap pipa, hitung diameter standar optimal secara langsung
  dari debit aktual â€” tanpa trial-and-error bolak-balik.

  Window valid = [D_min_HL, D_max_V]
    D_max_V  = sqrt(4|Q| / pi*V_min)              (kontinuitas, batas atas V)
    D_min_HL = (10.67*1000*Q^1.852 / C^1.852*HL)^(1/4.87)  (Hazen-Williams)

  Tiga kasus:
    FEASIBLE  â€” ada diameter standar dalam window
    INFEASIBLE â€” D_max_V < 40 mm (flow terlalu kecil)
    CONFLICT  â€” D_min_HL > D_max_V (prioritaskan HL, terima V-LOW)
"""

import math
import numpy as np

from .config import (
    DIAMETER_SIZES_M,
    VELOCITY_MIN, VELOCITY_MAX,
    HL_MAX, HW_C_DEFAULT,
)


# ===========================================================================
# PENCARIAN DIAMETER STANDAR
# ===========================================================================

def next_diameter_up(d_m: float) -> float:
    """Diameter standar berikutnya yang lebih besar (meter)."""
    for size in DIAMETER_SIZES_M:
        if size > d_m + 1e-6:
            return size
    return DIAMETER_SIZES_M[-1]


def next_diameter_down(d_m: float) -> float:
    """Diameter standar berikutnya yang lebih kecil (meter)."""
    for size in reversed(DIAMETER_SIZES_M):
        if size < d_m - 1e-6:
            return size
    return DIAMETER_SIZES_M[0]


def nearest_standard_diameter(d_m: float) -> float:
    """Bulatkan ke diameter standar terdekat."""
    arr = np.array(DIAMETER_SIZES_M)
    return DIAMETER_SIZES_M[int(np.argmin(np.abs(arr - d_m)))]


# ===========================================================================
# ANALYTICAL WINDOW METHOD â€” fungsi bantu
# ===========================================================================

def hw_d_min_for_hl(
    flow_m3s: float,
    hl_max_per_km: float = HL_MAX,
    C: float = HW_C_DEFAULT,
) -> float:
    """
    Diameter minimum (m) agar HL â‰¤ hl_max_per_km â€” Hazen-Williams terbalik.
    D = (10.67 * 1000 * Q^1.852 / (C^1.852 * HL))^(1/4.87)
    """
    Q = abs(flow_m3s)
    if Q < 1e-9:
        return 0.0
    return (10.67 * 1000.0 * Q**1.852 / (C**1.852 * hl_max_per_km)) ** (1.0 / 4.87)


def d_max_for_vmin(flow_m3s: float, v_min: float = VELOCITY_MIN) -> float:
    """
    Diameter maksimum (m) agar V â‰¥ v_min â€” persamaan kontinuitas.
    D_max = sqrt(4 * |Q| / pi * V_min)
    """
    Q = abs(flow_m3s)
    if Q < 1e-9:
        return 0.0
    return math.sqrt(4.0 * Q / (math.pi * v_min))


# ===========================================================================
# ANALYTICAL WINDOW METHOD â€” fungsi utama
# ===========================================================================

def analytical_optimal_diameter(
    flow_m3s: float,
    C: float = HW_C_DEFAULT,
) -> tuple[float, str]:
    """
    Hitung diameter standar optimal secara analitis untuk debit tertentu.

    Returns: (diameter_m, kategori)
      "FEASIBLE"   â€” diameter memenuhi V_min, V_max, dan HL_max
      "INFEASIBLE" â€” flow terlalu kecil; pakai D_min (40 mm), perlu solusi operasional
      "CONFLICT"   â€” tidak ada D standar yang memenuhi keduanya; prioritaskan HL
    """
    Q = abs(flow_m3s)

    d_max_v  = d_max_for_vmin(Q)
    d_min_hl = hw_d_min_for_hl(Q, C=C)
    d_min_v  = math.sqrt(4.0 * Q / (math.pi * VELOCITY_MAX)) if Q > 1e-9 else 0.0
    d_lower  = max(d_min_hl, d_min_v)

    # INFEASIBLE: flow terlalu kecil untuk diameter minimum katalog
    if d_max_v < DIAMETER_SIZES_M[0] - 1e-6:
        return DIAMETER_SIZES_M[0], "INFEASIBLE"

    # FEASIBLE: ada diameter standar dalam window [d_lower, d_max_v]
    in_window = [d for d in DIAMETER_SIZES_M if d_lower - 1e-6 <= d <= d_max_v + 1e-6]
    if in_window:
        return max(in_window), "FEASIBLE"

    # CONFLICT: D_min_HL > D_max_V â€” prioritaskan HL, terima V-LOW
    above = [d for d in DIAMETER_SIZES_M if d >= d_lower - 1e-6]
    return (min(above) if above else DIAMETER_SIZES_M[-1]), "CONFLICT"


# ===========================================================================
# FORMAT HELPER
# ===========================================================================

def mm(d_m: float) -> str:
    """Format meter ke string mm."""
    return f"{d_m * 1000:.0f} mm"


def status_symbol(ok: bool) -> str:
    return "OK" if ok else "FAIL"

