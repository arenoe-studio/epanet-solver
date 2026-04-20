# CANONICAL SOURCE: scripts/epanet/config.py — keep in sync
"""
config.py â€” Konstanta & konfigurasi global
Standar: Permen PU No. 18/2007
"""

# ---------------------------------------------------------------------------
# Standar teknis Permen PU No. 18/2007
# ---------------------------------------------------------------------------
PRESSURE_MIN  = 10.0   # m   â€” tekanan minimum di junction
PRESSURE_MAX  = 80.0   # m   â€” tekanan maksimum di junction
VELOCITY_MIN  = 0.3    # m/s â€” kecepatan minimum di pipa
VELOCITY_MAX  = 2.5    # m/s â€” kecepatan maksimum di pipa
HL_MAX        = 10.0   # m/km â€” headloss per km maksimum

# ---------------------------------------------------------------------------
# Diameter nominal standar yang tersedia di pasaran (mm)
# Dikonversi ke meter untuk kalkulasi internal
# ---------------------------------------------------------------------------
DIAMETER_SIZES_MM: list[int]   = [40, 50, 63, 75, 90, 110, 125, 150, 200, 250, 315, 400, 500]
DIAMETER_SIZES_M:  list[float] = [d / 1000.0 for d in DIAMETER_SIZES_MM]

# ---------------------------------------------------------------------------
# Parameter optimasi
# ---------------------------------------------------------------------------
MAX_ITERATIONS = 50

# Koefisien kekasaran Hazen-Williams default (PVC/HDPE baru)
HW_C_DEFAULT = 140.0

# ---------------------------------------------------------------------------
# PRV (Pressure Reducing Valve)
# ---------------------------------------------------------------------------
PRV_PRESSURE_TARGET = 60.0  # m (target pressure downstream, nilai tengah 10â€“80)
PRV_MAX_ITERATIONS = 10
PRV_MAX_STAGES = 4

# ---------------------------------------------------------------------------
# Folder & path
# ---------------------------------------------------------------------------
OUTPUT_FOLDER_NAME = "data_output"

SEARCH_PATHS = [
    ".",
    "data_Input",
    "data_input",
    "input",
    "Input",
]

