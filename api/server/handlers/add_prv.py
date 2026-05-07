from __future__ import annotations

import tempfile
from pathlib import Path

from api.epanet.network_io import InpValidationError, load_network
from api.epanet.prv import apply_prvs, fine_tune_prvs
from api.epanet.simulation import evaluate_network, run_simulation

from .shared import _build_remaining_errors


def _decode_inp(inp_bytes: bytes) -> str:
    return inp_bytes.decode("utf-8", errors="replace")


def _iter_section_rows(text: str, section: str) -> list[str]:
    wanted = section.strip().upper()
    in_section = False
    rows: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("[") and s.endswith("]"):
            in_section = s.upper() == wanted
            continue
        if not in_section:
            continue
        if s.startswith(";"):
            continue
        rows.append(s)
    return rows


def _warnings_from_inp_text(text: str) -> list[str]:
    warnings: list[str] = []
    if _iter_section_rows(text, "[PUMPS]"):
        warnings.append(
            "Sistem mendeteksi pompa. Analisis tetap bisa dijalankan namun pompa tidak dioptimasi."
        )
    if _iter_section_rows(text, "[TANKS]"):
        warnings.append("Sistem mendeteksi tangki. Analisis tetap bisa dijalankan.")
    return warnings


def _write_temp_inp(inp_bytes: bytes) -> Path:
    tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=".inp", delete=False, prefix="addprv_")
    try:
        tmp.write(inp_bytes)
        tmp.flush()
        return Path(tmp.name)
    finally:
        try:
            tmp.close()
        except Exception:
            pass


def _engine_used(sim_results: dict) -> str:
    audit = (sim_results or {}).get("_unit_audit") or {}
    src = str(audit.get("source") or "").strip().lower()
    if src in {"epyt", "epanet", "wntr"}:
        return src
    return "wntr"


def add_prv(inp_bytes: bytes, filename: str, prv_recommendations: list[dict]) -> dict:
    """
    Pasang PRV otomatis berdasarkan rekomendasi dari analyze_pressure().
    prv_recommendations: list rekomendasi dari hasil analyze_pressure().
    Return dict hasil setelah PRV dipasang.
    Raise ValueError jika prv_recommendations kosong.
    Raise RuntimeError jika simulasi gagal setelah PRV dipasang.
    """
    if not prv_recommendations:
        raise ValueError(
            "Tidak ada rekomendasi PRV. Jalankan Run Analysis Pressure terlebih dahulu."
        )

    text = _decode_inp(inp_bytes)
    warnings = _warnings_from_inp_text(text)

    tmp_path: Path | None = None
    wn = None
    try:
        tmp_path = _write_temp_inp(inp_bytes)
        wn = load_network(tmp_path)
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass

    sim_before = run_simulation(wn)
    ev_before = evaluate_network(wn, sim_before)

    apply_log = apply_prvs(wn, prv_recommendations)
    prv_targets = {str(item.get("prvValve")): [str(item.get("junctionDown"))] for item in apply_log}
    _tune_log = fine_tune_prvs(wn, prv_targets)

    sim_after = run_simulation(wn)
    ev_after = evaluate_network(wn, sim_after)

    engine_used = _engine_used(sim_after)

    nodes_out: list[dict] = []
    before_map = ev_before.get("node_status") or {}
    for nid, info in (ev_after.get("node_status") or {}).items():
        if str(nid).startswith("J_PRV_"):
            continue
        code = str((info or {}).get("code") or "P-OK")
        before_p = None
        try:
            before_p = float(before_map.get(nid, {}).get("pressure"))  # type: ignore[arg-type]
        except Exception:
            before_p = None
        nodes_out.append(
            {
                "id": str(nid),
                "pressureM": float((info or {}).get("pressure", 0.0) or 0.0),
                "pressureStatus": "OK" if code == "P-OK" else code,
                "pressureBeforeM": before_p,
            }
        )
    nodes_out.sort(key=lambda r: r["id"])

    remaining_errors = _build_remaining_errors(list(ev_after.get("violations", []) or []))

    prv_installed = []
    for row in apply_log:
        prv_installed.append(
            {
                "pipeId": str(row.get("originalPipe", "")),
                "settingM": float(row.get("settingHeadM", 0.0) or 0.0),
                "upstreamNode": str(row.get("junctionUp", "")),
                "downstreamNode": str(row.get("junctionDown", "")),
            }
        )

    return {
        "success": True,
        "filename": str(filename or "network.inp"),
        "engineUsed": engine_used,
        "prvInstalled": prv_installed,
        "nodes": nodes_out,
        "remainingErrors": remaining_errors,
        "warnings": warnings,
        "downloadAvailable": True,
    }
