"""
reporter.py - Export Markdown report aligned with EPANET_Solver_Logic_Documentation.md.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import wntr

from .config import PRESSURE_MAX, PRESSURE_MIN
from .diameter import status_symbol
from .simulation import severity_breakdown, severity_score


def _violation_table(md: list[str], violations: list[dict]) -> None:
    md.append("| No | Elemen | Tipe | Masalah | Nilai | Threshold | Satuan | Prioritas |")
    md.append("|----|--------|------|---------|-------|-----------|--------|-----------|")
    for i, v in enumerate(violations, 1):
        md.append(
            f"| {i} | {v.get('element')} | {v.get('type')} | {v.get('issue')} "
            f"| {float(v.get('value', 0.0)):.3f} | {v.get('threshold')} | {v.get('unit')} | {v.get('priority', '—')} |"
        )


def _node_before_after_table(md: list[str], wn: wntr.network.WaterNetworkModel, before_eval: dict, after_eval: dict) -> None:
    md.append("| Node | Elev (m) | Demand (L/s) | P Before (m) | P After (m) | St.B | St.A | Flag After |")
    md.append("|------|----------|-------------|--------------|-------------|------|------|-----------|")

    for nid in sorted(wn.junction_name_list):
        node = wn.get_node(nid)
        elev = float(node.elevation)
        dem = (
            float(node.demand_timeseries_list[0].base_value) * 1000.0
            if node.demand_timeseries_list
            else 0.0
        )
        p_b = float(before_eval["node_status"].get(nid, {}).get("pressure", 0.0))
        p_a = float(after_eval["node_status"].get(nid, {}).get("pressure", 0.0))
        ok_b = bool(before_eval["node_status"].get(nid, {}).get("ok", True))
        ok_a = bool(after_eval["node_status"].get(nid, {}).get("ok", True))
        flags = after_eval["node_status"].get(nid, {}).get("flags", [])
        md.append(
            f"| {nid} | {elev:.2f} | {dem:.3f} | {p_b:.2f} | {p_a:.2f} "
            f"| {status_symbol(ok_b)} | {status_symbol(ok_a)} | {'; '.join(flags) if flags else '—'} |"
        )


def _pipe_before_after_table(
    md: list[str],
    wn: wntr.network.WaterNetworkModel,
    before_eval: dict,
    after_eval: dict,
) -> None:
    md.append(
        "| Pipe | Dir (start→end) | Len (m) | D Before (mm) | D After (mm) "
        "| Flow Before (L/s) | Flow After (L/s) "
        "| V Before (m/s) | V After (m/s) | HL Before (m/km) | HL After (m/km) | St.B | St.A | Flag After |"
    )
    md.append(
        "|------|-----------------|---------|--------------|-------------|"
        "------------------|----------------|"
        "---------------|--------------|----------------|---------------|------|------|-----------|"
    )

    for pid in sorted(wn.pipe_name_list):
        pipe = wn.get_link(pid)
        ps_b = before_eval["pipe_status"].get(pid, {})
        ps_a = after_eval["pipe_status"].get(pid, {})
        flags = list(ps_a.get("flags", []))
        flow_b_lps = float(ps_b.get("flow", 0.0)) * 1000.0
        flow_a_lps = float(ps_a.get("flow", 0.0)) * 1000.0
        if flow_a_lps < 0:
            flags.append("FLOW-REV (arah pipa perlu dibalik)")
        dir_label = f"{pipe.start_node_name}→{pipe.end_node_name}"
        md.append(
            f"| {pid} | {dir_label} | {float(pipe.length):.1f} "
            f"| {float(ps_b.get('diameter', pipe.diameter)) * 1000:.0f} "
            f"| {float(ps_a.get('diameter', pipe.diameter)) * 1000:.0f} "
            f"| {flow_b_lps:.3f} | {flow_a_lps:.3f} "
            f"| {float(ps_b.get('velocity', 0.0)):.3f} | {float(ps_a.get('velocity', 0.0)):.3f} "
            f"| {float(ps_b.get('headloss', 0.0)):.2f} | {float(ps_a.get('headloss', 0.0)):.2f} "
            f"| {status_symbol(bool(ps_b.get('ok', True)))} | {status_symbol(bool(ps_a.get('ok', True)))} "
            f"| {'; '.join(flags) if flags else '—'} |"
        )


def _reversed_flow_table(md: list[str], wn: wntr.network.WaterNetworkModel, after_eval: dict) -> None:
    rows = []
    for pid in sorted(wn.pipe_name_list):
        ps = after_eval["pipe_status"].get(pid, {})
        q = float(ps.get("flow", 0.0))
        if q < 0:
            pipe = wn.get_link(pid)
            rows.append((pid, pipe.start_node_name, pipe.end_node_name, abs(q) * 1000.0))
    if not rows:
        md.append("_Tidak ada pipa dengan arah aliran terbalik._")
        return
    md.append("| Pipe | Defined (start→end) | Actual flow direction | |Q| (L/s) | Saran |")
    md.append("|------|--------------------|-----------------------|----------|-------|")
    for pid, s, e, q in rows:
        md.append(
            f"| {pid} | {s}→{e} | {e}→{s} | {q:.3f} | "
            f"Balik urutan node di [PIPES] jadi `{e} {s}` agar arah definisi sesuai aliran. |"
        )


def _material_table(md: list[str], materials: dict[str, dict]) -> None:
    md.append("| Pipe | D (mm) | P_kerja (m) | Material | C | Notes |")
    md.append("|------|--------|-------------|----------|---|-------|")
    for pid, rec in sorted(materials.items()):
        notes = rec.get("notes") or []
        md.append(
            f"| {pid} | {float(rec.get('diameterMm', 0.0)):.0f} | {float(rec.get('pressureWorkingM', 0.0)):.2f} "
            f"| {rec.get('material', '—')} | {float(rec.get('C', 0.0)):.0f} | {'; '.join(notes) if notes else '—'} |"
        )


def _prv_recommendations(md: list[str], prv: dict) -> None:
    recs = prv.get("recommendations") or []
    if not recs:
        md.append("_Tidak ada rekomendasi PRV._")
        return

    md.append("| No | Pipe | Upstream | Downstream | Setting (m) | Covered Nodes |")
    md.append("|----|------|----------|------------|------------|--------------|")
    for i, r in enumerate(recs, 1):
        md.append(
            f"| {i} | {r.get('pipeId')} | {r.get('upstreamNode')} | {r.get('downstreamNode')} "
            f"| {float(r.get('settingHeadM', 0.0)):.1f} | {', '.join(r.get('coveredNodes', []))} |"
        )


def _join_pressure_nodes(rows: list[dict] | None) -> str:
    data = rows or []
    if not data:
        return "—"
    return ", ".join(f"{row.get('id')} ({float(row.get('pressure', 0.0)):.2f} m)" for row in data)


def _join_prv_recommendation_debug(rows: list[dict] | None) -> str:
    data = rows or []
    if not data:
        return "—"
    return "; ".join(
        f"{row.get('pipeId')} ({float(row.get('settingHeadM', 0.0)):.1f} m -> {', '.join(row.get('coveredNodes') or [])})"
        for row in data
    )


def _join_prv_applied_debug(rows: list[dict] | None) -> str:
    data = rows or []
    if not data:
        return "—"
    return "; ".join(
        f"{row.get('prvValve')} pada {row.get('originalPipe')} ({float(row.get('settingHeadM', 0.0)):.1f} m)"
        for row in data
    )


def export_markdown_report(
    inp_path: Path,
    file_name: str,
    wn_orig: wntr.network.WaterNetworkModel,
    baseline_eval: dict,
    after_eval: dict,
    diameter_changes: dict,
    snapshots: list,
    materials: dict[str, dict],
    prv: dict | None,
    output_path: Path,
    report_kind: str,
    prv_fix_log: list[dict] | None = None,
    prv_tune_log: list[dict] | None = None,
    pressure_followup: dict | None = None,
    prv_debug_log: list[dict] | None = None,
) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md: list[str] = []
    md.append("# Laporan Analisis Jaringan Distribusi Air Bersih")
    md.append(f"## EPANET Solver — {file_name} — {now}")
    md.append("")

    md.append("## Ringkasan Eksekutif")
    md.append("")
    md.append(f"- Report: **{report_kind.upper()}**")
    md.append(f"- Nodes (junctions): **{wn_orig.num_junctions}**")
    md.append(f"- Pipes: **{wn_orig.num_pipes}**")
    md.append(f"- Pelanggaran awal: **{len(baseline_eval.get('violations', []))}**")
    md.append(f"- Pelanggaran akhir: **{len(after_eval.get('violations', []))}**")
    md.append("")

    sev_b = severity_breakdown(baseline_eval.get("violations", []))
    sev_a = severity_breakdown(after_eval.get("violations", []))
    score_b = severity_score(baseline_eval.get("violations", []))
    score_a = severity_score(after_eval.get("violations", []))

    md.append("### Keparahan Pelanggaran")
    md.append("")
    md.append("| Level | Before | After | Δ |")
    md.append("|-------|--------|-------|---|")
    for level in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        b = sev_b.get(level, 0)
        a = sev_a.get(level, 0)
        delta = a - b
        arrow = "↑" if delta > 0 else ("↓" if delta < 0 else "=")
        md.append(f"| {level} | {b} | {a} | {arrow} {delta:+d} |")
    md.append("")

    if score_a > score_b + 1e-6:
        verdict = (
            f"⚠ **Skor keparahan memburuk: {score_b:.0f} → {score_a:.0f}** "
            "(fix menimbulkan pelanggaran lebih berat di tempat lain)."
        )
    elif score_a + 1e-6 < score_b:
        verdict = f"✓ Skor keparahan membaik: {score_b:.0f} → {score_a:.0f}."
    else:
        verdict = f"Skor keparahan tidak berubah: {score_b:.0f}."
    md.append(f"> {verdict}")
    md.append("")
    if sev_a.get("CRITICAL", 0) > 0:
        md.append(
            "> ⚠ Terdapat pelanggaran **CRITICAL** (tekanan negatif/kavitasi). "
            "Wajib ditangani sebelum implementasi fisik."
        )
        md.append("")

    md.append("## Masalah Ditemukan (Kondisi Awal)")
    md.append("")
    if baseline_eval.get("violations"):
        _violation_table(md, baseline_eval["violations"])
    else:
        md.append("Tidak ada pelanggaran pada kondisi awal.")
    md.append("")

    md.append("## Hasil Node — Before vs After")
    md.append("")
    _node_before_after_table(md, wn_orig, baseline_eval, after_eval)
    md.append("")

    md.append("## Hasil Pipa — Before vs After")
    md.append("")
    _pipe_before_after_table(md, wn_orig, baseline_eval, after_eval)
    md.append("")

    md.append("## Pipa dengan Arah Aliran Terbalik")
    md.append("")
    _reversed_flow_table(md, wn_orig, after_eval)
    md.append("")

    md.append("## Rekomendasi Material per Pipa")
    md.append("")
    if materials:
        _material_table(md, materials)
    else:
        md.append("_Material tidak tersedia._")
    md.append("")

    md.append("## Rekomendasi PRV")
    md.append("")
    if prv and prv.get("needed"):
        _prv_recommendations(md, prv)
        md.append("")
        md.append(
            "> Catatan: Estimasi rekomendasi berdasarkan kalkulasi statis. Nilai aktual bisa berbeda."
        )
        unresolved = prv.get("unresolvedNodes") or []
        if unresolved:
            md.append("")
            md.append(
                "> ⚠ Node berikut tidak tercakup oleh rekomendasi PRV otomatis "
                f"(**{', '.join(unresolved)}**) — rentang elevasi subtree melebihi "
                f"{PRESSURE_MAX - PRESSURE_MIN:.0f} m. Pertimbangkan penambahan PRV manual "
                "di pipa hilir pada band elevasi yang lebih rendah."
            )
    else:
        md.append("_Tidak ada node P-HIGH, PRV tidak diperlukan._")
    md.append("")

    md.append("## Log Iterasi Diameter")
    md.append("")
    if snapshots:
        md.append("| Iter | Pass | Status | Changes | Pelanggaran (V/HL) |")
        md.append("|------|------|--------|---------|-------------------|")
        for s in snapshots:
            ev_b = s.get("eval_before", {})
            vhl_ok = bool(ev_b.get("all_vhl_ok", False))
            vhl_count = 0
            for v in ev_b.get("violations", []):
                if v.get("type") == "PIPE":
                    vhl_count += 1
            md.append(
                f"| {s.get('iter')} | {s.get('pass') or '—'} | {s.get('status')} | {len(s.get('changes') or [])} | "
                f"{'OK' if vhl_ok else str(vhl_count)} |"
            )
    else:
        md.append("_Tidak ada iterasi (jaringan sudah memenuhi standar V/HL)._")
    md.append("")

    if diameter_changes:
        md.append("## Ringkasan Total Perubahan Diameter")
        md.append("")
        md.append("| Pipe | D Awal (mm) | D Akhir (mm) | Alasan |")
        md.append("|------|------------|-------------|--------|")
        for pid, ch in sorted(diameter_changes.items()):
            md.append(
                f"| {pid} | {float(ch.get('before', 0.0))*1000:.0f} | {float(ch.get('after', 0.0))*1000:.0f} | {ch.get('reason', '—')} |"
            )
        md.append("")

    if report_kind == "final":
        md.append("## Log Fix PRV")
        md.append("")
        if prv_fix_log:
            md.append("### Struktur PRV yang Ditambahkan")
            md.append("")
            md.append("| No | Original Pipe | PipeA | PRV Valve | PipeB | Setting (m) |")
            md.append("|----|---------------|-------|----------|-------|-------------|")
            for i, row in enumerate(prv_fix_log, 1):
                md.append(
                    f"| {i} | {row.get('originalPipe')} | {row.get('pipeA')} | {row.get('prvValve')} | {row.get('pipeB')} | {float(row.get('settingHeadM', 0.0)):.1f} |"
                )
            md.append("")
        if prv_tune_log:
            md.append("### Fine-tuning Setting PRV")
            md.append("")
            md.append("| Iter | Delta Setting (m) | Min P (m) | Max P (m) | Status | Keterangan |")
            md.append("|------|------------------|-----------|-----------|--------|------------|")
            for row in prv_tune_log:
                md.append(
                    f"| {row.get('iter')} | {float(row.get('deltaSettingM', 0.0)):.2f} | "
                    f"{float(row.get('minP', 0.0)):.2f} | {float(row.get('maxP', 0.0)):.2f} | "
                    f"{row.get('status', '—')} | {row.get('reason', '') or '—'} |"
                )
            md.append("")
            final_row = prv_tune_log[-1] if prv_tune_log else None
            if final_row and final_row.get("status") in {"CONFLICT", "STAGNANT", "CLAMPED", "MAX_ITER"}:
                md.append(
                    "> ⚠ Fine-tune berhenti dengan status "
                    f"**{final_row.get('status')}** — {final_row.get('reason') or 'tidak dapat konvergen'}. "
                    "Periksa apakah jaringan butuh PRV tambahan di lokasi dengan elevasi rendah."
                )
                md.append("")

        if pressure_followup:
            md.append("## Evaluasi Lanjutan Tekanan")
            md.append("")
            md.append(f"- Status akhir: **{pressure_followup.get('status', 'unknown')}**")
            md.append(
                f"- Sisa P-HIGH: **{len(pressure_followup.get('remainingHighNodes') or [])}**, "
                f"P-LOW: **{len(pressure_followup.get('remainingLowNodes') or [])}**, "
                f"P-NEG: **{len(pressure_followup.get('remainingNegativeNodes') or [])}**"
            )
            for item in pressure_followup.get("recommendations") or []:
                md.append(f"- {item}")
            md.append("")

        if prv_debug_log:
            md.append("## Trace Fix Pressure per Stage")
            md.append("")
            for row in prv_debug_log:
                md.append(f"### Stage {row.get('stage')}")
                md.append("")
                before = row.get("before") or {}
                after = row.get("after") or {}
                md.append(
                    f"- Sebelum stage: P-HIGH **{before.get('highCount', 0)}**, "
                    f"P-LOW **{before.get('lowCount', 0)}**, P-NEG **{before.get('negativeCount', 0)}**"
                )
                md.append(
                    f"- Node P-HIGH sebelum: {_join_pressure_nodes(before.get('highNodes'))}"
                )
                md.append(
                    f"- Rekomendasi PRV: {_join_prv_recommendation_debug(row.get('recommendations'))}"
                )
                md.append(
                    f"- PRV terpasang: {_join_prv_applied_debug(row.get('applied'))}"
                )
                tuning = row.get("tuningEnd") or {}
                if tuning:
                    md.append(
                        f"- Tuning berhenti di status **{tuning.get('status', 'unknown')}** "
                        f"(minP={float(tuning.get('minP', 0.0)):.2f} m, maxP={float(tuning.get('maxP', 0.0)):.2f} m)"
                    )
                    if tuning.get("reason"):
                        md.append(f"- Alasan tuning: {tuning.get('reason')}")
                md.append(
                    f"- Setelah stage: P-HIGH **{after.get('highCount', 0)}**, "
                    f"P-LOW **{after.get('lowCount', 0)}**, P-NEG **{after.get('negativeCount', 0)}**"
                )
                md.append(
                    f"- Node P-HIGH sesudah: {_join_pressure_nodes(after.get('highNodes'))}"
                )
                md.append(f"- Status follow-up: **{row.get('followupStatus', 'unknown')}**")
                md.append("")

    md.append("## Referensi Standar")
    md.append("")
    md.append("- Permen PU No. 18/2007 (kriteria P, V, HL)")
    md.append("- EPANET 2.2 Users Manual (Hazen-Williams C)")
    md.append("")

    output_path.write_text("\n".join(md), encoding="utf-8")
