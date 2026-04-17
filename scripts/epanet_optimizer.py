"""
EPANET Network Analyzer & Diameter Optimizer
=============================================
Standar: Permen PU No. 18/2007

Penggunaan:
  python epanet_optimizer.py
  python epanet_optimizer.py --input path/to/network.inp
  python epanet_optimizer.py --no-optimize
"""

import sys
import copy
import argparse
from pathlib import Path

# Paksa output UTF-8 agar karakter Unicode tampil benar di terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Periksa ketersediaan library
# ---------------------------------------------------------------------------
def _is_installed(pkg: str) -> bool:
    try:
        __import__(pkg)
        return True
    except ImportError:
        return False

_MISSING = [pkg for pkg in ("wntr", "pandas", "numpy") if not _is_installed(pkg)]
if _MISSING:
    print("=" * 60)
    print("ERROR: Library berikut belum terinstal:")
    for pkg in _MISSING:
        print(f"  - {pkg}")
    print(f"\n  pip install {' '.join(_MISSING)}")
    print("=" * 60)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Import modul internal
# ---------------------------------------------------------------------------
from epanet.config import OUTPUT_FOLDER_NAME, MAX_ITERATIONS
from epanet.network_io import find_inp_file, load_network, export_optimized_inp
from epanet.diameter import ceil_standard_diameter
from epanet.simulation import run_simulation, evaluate_network
from epanet.optimizer import optimize_diameters
from epanet.reporter import export_markdown_report
from epanet.materials import material_recommendations_for_network
from epanet.prv import analyze_prv_recommendations


# ===========================================================================
# MAIN
# ===========================================================================

def main() -> None:
    parser = argparse.ArgumentParser(
        description="EPANET Network Analyzer & Optimizer (Permen PU No. 18/2007)"
    )
    parser.add_argument("--input", "-i",
                        help="Path ke file .inp (default: cari otomatis)")
    parser.add_argument("--no-optimize", action="store_true",
                        help="Hanya analisis, tanpa iterasi optimasi diameter")
    args = parser.parse_args()

    # --- Lokasi file .inp ---------------------------------------------------
    script_dir  = Path(__file__).parent
    project_dir = script_dir.parent

    if args.input:
        inp_path = Path(args.input).resolve()
        if not inp_path.exists():
            print(f"ERROR: File tidak ditemukan: {inp_path}")
            sys.exit(1)
    else:
        try:
            inp_path = find_inp_file(project_dir)
        except FileNotFoundError as e:
            print(f"ERROR: {e}")
            sys.exit(1)

    output_dir = project_dir / OUTPUT_FOLDER_NAME
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("  EPANET Network Analyzer — Permen PU No. 18/2007")
    print("=" * 65)
    print(f"  File input   : {inp_path}")
    print(f"  Folder output: {output_dir}")
    print()

    # --- Load & simulasi awal -----------------------------------------------
    print("[1/4] Memuat jaringan dari file .inp ...")
    wn_orig = load_network(inp_path)

    for pid in wn_orig.pipe_name_list:
        pipe = wn_orig.get_link(pid)
        pipe.diameter = ceil_standard_diameter(float(pipe.diameter))

    print("[2/4] Menjalankan simulasi hidraulik awal ...")
    before_sim  = run_simulation(wn_orig)
    before_eval = evaluate_network(wn_orig, before_sim)
    print(f"      → Ditemukan {len(before_eval['violations'])} pelanggaran")

    # --- Optimasi -----------------------------------------------------------
    diameter_changes: dict = {}
    snapshots:        list = []

    if args.no_optimize:
        print("[3/4] Optimasi dilewati (--no-optimize aktif).")
        wn_opt     = copy.deepcopy(wn_orig)
        after_eval = before_eval
    else:
        print(f"[3/4] Mengoptimasi diameter (maks {MAX_ITERATIONS} iterasi) ...")
        wn_opt, after_eval, diameter_changes, snapshots = optimize_diameters(wn_orig)
        print(
            f"      → {len(diameter_changes)} pipa diubah; "
            f"{len(after_eval['violations'])} pelanggaran tersisa"
        )

    # --- Ekspor -------------------------------------------------------------
    print("[4/4] Mengekspor hasil ...")
    sim_after = run_simulation(wn_opt)
    after_eval = evaluate_network(wn_opt, sim_after)
    materials = material_recommendations_for_network(wn_opt, sim_after)
    prv = analyze_prv_recommendations(wn_opt, sim_after, after_eval)

    export_optimized_inp(inp_path, wn_opt, output_dir / "optimized_network_v1.inp")
    export_markdown_report(
        inp_path=inp_path,
        file_name=inp_path.name,
        wn_orig=wn_orig,
        baseline_eval=before_eval,
        after_eval=after_eval,
        diameter_changes=diameter_changes,
        snapshots=snapshots,
        materials=materials,
        prv=prv,
        output_path=output_dir / "analysis_report_v1.md",
        report_kind="v1",
    )

    # --- Ringkasan ----------------------------------------------------------
    print()
    print("=" * 65)
    print("  SELESAI")
    print("=" * 65)
    print(f"  Pelanggaran sebelum : {len(before_eval['violations'])}")
    if not args.no_optimize:
        print(f"  Pelanggaran sesudah : {len(after_eval['violations'])}")
        print(f"  Diameter diubah     : {len(diameter_changes)} pipa")
    print(f"  File output         : {output_dir}/")
    print(f"    • optimized_network_v1.inp")
    print(f"    • analysis_report_v1.md")

    if after_eval["violations"]:
        print()
        print("  PERINGATAN: Masih ada pelanggaran tersisa.")
        print("  Cek 'Remaining Issues' di laporan untuk rekomendasi lanjutan.")
    print()


if __name__ == "__main__":
    main()
