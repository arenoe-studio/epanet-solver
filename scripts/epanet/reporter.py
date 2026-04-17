"""
reporter.py — Ekspor laporan analisis Markdown per iterasi
"""

from datetime import datetime
from pathlib import Path
import wntr

from .config import PRESSURE_MAX
from .diameter import status_symbol


# ===========================================================================
# HELPER: tabel node & pipa
# ===========================================================================

def _node_table(
    md: list,
    wn: wntr.network.WaterNetworkModel,
    eval_before: dict,
    eval_after: dict,
) -> None:
    """Tambahkan tabel node (before vs after) ke list md."""
    md.append(
        "| Node | Elevasi (m) | Demand (L/s) | P Before (m) | P After (m) "
        "| St.Before | St.After | Flag |"
    )
    md.append("|------|------------|-------------|-------------|------------|----------|---------|------|")

    for nid in sorted(wn.junction_name_list):
        node = wn.get_node(nid)
        elev = node.elevation
        dem  = (node.demand_timeseries_list[0].base_value * 1000.0
                if node.demand_timeseries_list else 0.0)
        p_b  = eval_before["node_status"].get(nid, {}).get("pressure", 0.0)
        p_a  = eval_after["node_status"].get(nid,  {}).get("pressure", 0.0)
        ok_b = eval_before["node_status"].get(nid, {}).get("ok", True)
        ok_a = eval_after["node_status"].get(nid,  {}).get("ok", True)
        flags = eval_after["node_status"].get(nid, {}).get("flags", [])
        md.append(
            f"| {nid} | {elev:.2f} | {dem:.3f} "
            f"| {p_b:.2f} | {p_a:.2f} "
            f"| {status_symbol(ok_b)} | {status_symbol(ok_a)} "
            f"| {'; '.join(flags) if flags else '—'} |"
        )


def _pipe_table(
    md: list,
    wn: wntr.network.WaterNetworkModel,
    eval_before: dict,
    eval_after: dict,
    changed_pipes: set,
) -> None:
    """Tambahkan tabel pipa (before vs after) ke list md. Pipa yang diubah ditandai ★."""
    md.append(
        "| Pipa | Pjg (m) | D Before (mm) | D After (mm) | Flow (L/s) "
        "| V Before (m/s) | V After (m/s) "
        "| HL Before (m/km) | HL After (m/km) | St.Before | St.After | Flag |"
    )
    md.append(
        "|------|--------|--------------|-------------|-----------|"
        "---------------|--------------|----------------|----------------|----------|---------|------|"
    )

    for pid in sorted(wn.pipe_name_list):
        pipe  = wn.get_link(pid)
        ps_b  = eval_before["pipe_status"].get(pid, {})
        ps_a  = eval_after["pipe_status"].get(pid,  {})
        flags = ps_a.get("flags", [])
        mark  = " ★" if pid in changed_pipes else ""
        md.append(
            f"| {pid}{mark} | {pipe.length:.1f} "
            f"| {ps_b.get('diameter', pipe.diameter) * 1000:.0f} "
            f"| {ps_a.get('diameter', pipe.diameter) * 1000:.0f} "
            f"| {ps_a.get('flow', 0.0) * 1000:.3f} "
            f"| {ps_b.get('velocity', 0.0):.3f} | {ps_a.get('velocity', 0.0):.3f} "
            f"| {ps_b.get('headloss', 0.0):.2f} | {ps_a.get('headloss', 0.0):.2f} "
            f"| {status_symbol(ps_b.get('ok', True))} "
            f"| {status_symbol(ps_a.get('ok', True))} "
            f"| {'; '.join(flags) if flags else '—'} |"
        )


def _violation_table(md: list, violations: list) -> None:
    """Tambahkan tabel pelanggaran ke list md."""
    md.append("| No | Elemen | Tipe | Masalah | Nilai | Threshold | Satuan |")
    md.append("|----|--------|------|---------|-------|-----------|--------|")
    for i, v in enumerate(violations, 1):
        md.append(
            f"| {i} | {v['element']} | {v['type']} | {v['issue']} "
            f"| {v['value']:.3f} | {v['threshold']} | {v['unit']} |"
        )


# ===========================================================================
# EKSPOR LAPORAN
# ===========================================================================

def export_markdown_report(
    inp_path:         Path,
    wn_orig:          wntr.network.WaterNetworkModel,
    before_eval:      dict,
    after_eval:       dict,
    diameter_changes: dict,
    snapshots:        list,
    output_path:      Path,
    optimize_ran:     bool,
) -> None:
    """Buat laporan analisis Markdown dengan detail per iterasi."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    total_demand = sum(
        wn_orig.get_node(n).demand_timeseries_list[0].base_value
        for n in wn_orig.junction_name_list
        if wn_orig.get_node(n).demand_timeseries_list
    )
    reservoir_str = ", ".join(
        f"{r}: {wn_orig.get_node(r).head_timeseries.base_value:.2f} m"
        for r in wn_orig.reservoir_name_list
    ) or "N/A"

    converged = after_eval["all_ok"]
    md: list[str] = []

    # -----------------------------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------------------------
    md += [
        "# Network Analysis Report", "",
        "## Summary", "",
        "| Parameter | Nilai |",
        "|-----------|-------|",
        f"| File input | `{inp_path.name}` |",
        f"| Tanggal simulasi | {now} |",
        f"| Total demand | {total_demand * 1000:.4f} L/s |",
        f"| Reservoir head | {reservoir_str} |",
        f"| Jumlah junction | {wn_orig.num_junctions} |",
        f"| Jumlah pipa | {wn_orig.num_pipes} |",
        f"| Status konvergensi | {'**CONVERGED ✓**' if converged else '**NOT CONVERGED ✗**'} |",
        f"| Optimasi dijalankan | {'Ya (' + str(len(snapshots)) + ' iterasi)' if optimize_ran else 'Tidak'} |",
        f"| Pelanggaran awal | {len(before_eval['violations'])} |",
        f"| Pelanggaran akhir | {len(after_eval['violations'])} |",
        f"| Diameter diubah | {len(diameter_changes)} pipa |",
        "",
    ]

    # -----------------------------------------------------------------------
    # KONDISI AWAL
    # -----------------------------------------------------------------------
    md += ["---", "", f"## Kondisi Awal (Sebelum Optimasi)", "",
           f"> **{len(before_eval['violations'])} pelanggaran** ditemukan pada kondisi awal.", ""]
    md.append("### Node Results"); md.append("")
    _node_table(md, wn_orig, before_eval, before_eval)
    md.append("")
    md.append("### Pipe Results"); md.append("")
    _pipe_table(md, wn_orig, before_eval, before_eval, set())
    md.append("")
    if before_eval["violations"]:
        md.append("### Pelanggaran Ditemukan"); md.append("")
        _violation_table(md, before_eval["violations"])
        md.append("")

    # -----------------------------------------------------------------------
    # SATU SEKSI PER ITERASI
    # -----------------------------------------------------------------------
    STATUS_LABEL = {
        "CONVERGED": "SELESAI ✓ — semua kriteria terpenuhi",
        "STUCK":     "BERHENTI — tidak ada perubahan yang mungkin",
        "STAGNANT":  "BERHENTI — tidak ada kemajuan",
        "RUNNING":   "Berjalan",
    }

    if optimize_ran:
        for snap in snapshots:
            ev_b = snap["eval_before"]
            ev_a = snap["eval_after"]
            changed_set = {ch["pipe"] for ch in snap["changes"]}
            label = STATUS_LABEL.get(snap["status"], snap["status"])

            md += [
                "---", "",
                f"## Iterasi {snap['iter']}", "",
                f"> Status: **{label}**  ",
                f"> Pelanggaran: **{len(ev_b['violations'])}** → **{len(ev_a['violations'])}**",
                "",
            ]

            if snap["changes"]:
                md += ["### Perubahan Diameter", "",
                       "| Pipa | Sebelum (mm) | Sesudah (mm) | Alasan |",
                       "|------|-------------|-------------|--------|"]
                for ch in snap["changes"]:
                    md.append(
                        f"| {ch['pipe']} | {ch['d_before']*1000:.0f} "
                        f"| {ch['d_after']*1000:.0f} | {ch['reason']} |"
                    )
                md += ["",
                       "_★ Pipa yang diubah ditandai bintang (★) di tabel pipa di bawah._",
                       ""]
            else:
                md += ["_Tidak ada perubahan diameter pada iterasi ini._", ""]

            md.append("### Node Results"); md.append("")
            _node_table(md, wn_orig, ev_b, ev_a)
            md.append("")

            md.append("### Pipe Results"); md.append("")
            _pipe_table(md, wn_orig, ev_b, ev_a, changed_set)
            md.append("")

            if ev_a["violations"]:
                md += ["### Pelanggaran Setelah Iterasi Ini", ""]
                _violation_table(md, ev_a["violations"])
                md.append("")
            else:
                md += ["**Semua kriteria terpenuhi setelah iterasi ini.** ✓", ""]

    # -----------------------------------------------------------------------
    # RINGKASAN TOTAL PERUBAHAN DIAMETER
    # -----------------------------------------------------------------------
    md += ["---", "", "## Ringkasan Total Perubahan Diameter", ""]
    if diameter_changes:
        md += [f"Total **{len(diameter_changes)}** pipa diubah selama proses optimasi:", "",
               "| Pipa | D Awal (mm) | D Akhir (mm) | Alasan |",
               "|------|------------|-------------|--------|"]
        for pid, ch in sorted(diameter_changes.items()):
            md.append(f"| {pid} | {ch['before']*1000:.0f} | {ch['after']*1000:.0f} | {ch['reason']} |")
    else:
        md.append("Tidak ada perubahan diameter (jaringan sudah memenuhi standar).")
    md.append("")

    # -----------------------------------------------------------------------
    # REMAINING ISSUES
    # -----------------------------------------------------------------------
    prv_candidates = [
        nid for nid, info in after_eval["node_status"].items()
        if not info["ok"] and any("P-HIGH" in f for f in info["flags"])
    ]
    md += ["---", "", "## Remaining Issues", ""]

    if after_eval["violations"]:
        md += [f"Masih terdapat **{len(after_eval['violations'])}** pelanggaran setelah optimasi:", "",
               "| No | Elemen | Tipe | Masalah | Nilai | Threshold | Satuan | Prioritas |",
               "|----|--------|------|---------|-------|-----------|--------|-----------|"]
        for i, v in enumerate(after_eval["violations"], 1):
            md.append(
                f"| {i} | {v['element']} | {v['type']} | {v['issue']} "
                f"| {v['value']:.3f} | {v['threshold']} | {v['unit']} | {v['priority']} |"
            )
        md.append("")
        if prv_candidates:
            md += ["### Rekomendasi Pemasangan PRV (Pressure Reducing Valve)", ""]
            for nid in prv_candidates:
                p = after_eval["node_status"][nid]["pressure"]
                md.append(f"- **Node {nid}**: tekanan {p:.2f} m > {PRESSURE_MAX} m → Pasang PRV")
            md.append("")
    else:
        md += ["**Tidak ada pelanggaran tersisa.** "
               "Jaringan memenuhi semua standar Permen PU No. 18/2007. ✓", ""]

    md += ["---",
           "_Laporan dihasilkan oleh EPANET Network Optimizer — Standar: Permen PU No. 18/2007_"]

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    print(f"  [OK] Laporan    : {output_path}")
