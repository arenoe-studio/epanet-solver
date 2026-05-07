from __future__ import annotations

import tempfile
from pathlib import Path

from api.epanet.network_io import InpValidationError, load_network
from api.epanet.prv import analyze_prv_recommendations, build_pressure_followup
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
    tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=".inp", delete=False, prefix="pressure_")
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


def analyze_pressure(inp_bytes: bytes, filename: str) -> dict:
    """
    Jalankan analisis pressure jaringan.
    Return dict hasil analisis + rekomendasi PRV jika ada P-HIGH.
    Raise InpValidationError jika file tidak valid.
    Raise RuntimeError jika simulasi tidak konvergen.
    """
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

    sim = run_simulation(wn)
    ev = evaluate_network(wn, sim)

    engine_used = _engine_used(sim)

    nodes_out: list[dict] = []
    for nid, info in (ev.get("node_status") or {}).items():
        if str(nid).startswith("J_PRV_"):
            continue
        code = str((info or {}).get("code") or "P-OK")
        pressure = float((info or {}).get("pressure", 0.0) or 0.0)
        elev = 0.0
        try:
            elev = float(getattr(wn.get_node(str(nid)), "elevation", 0.0) or 0.0)
        except Exception:
            elev = 0.0
        nodes_out.append(
            {
                "id": str(nid),
                "elevationM": elev,
                "pressureM": pressure,
                "pressureStatus": "OK" if code == "P-OK" else code,
            }
        )
    nodes_out.sort(key=lambda r: r["id"])

    has_phigh = any(n.get("pressureStatus") == "P-HIGH" for n in nodes_out)
    prv_reco_out = None
    add_prv_available = False
    if has_phigh:
        prv = analyze_prv_recommendations(wn, sim, ev) or {}
        add_prv_available = bool(prv.get("needed"))
        recommendations = []
        for rec in prv.get("recommendations") or []:
            recommendations.append(
                {
                    "pipeId": str(rec.get("pipeId", "")),
                    "upstreamNode": str(rec.get("upstreamNode", "")),
                    "downstreamNode": str(rec.get("downstreamNode", "")),
                    "settingM": float(rec.get("settingHeadM", 0.0) or 0.0),
                    "coveredNodes": [str(x) for x in (rec.get("coveredNodes") or [])],
                    "estimatedPressureAfter": {
                        str(k): float(v or 0.0)
                        for k, v in (rec.get("estimatedPressuresM") or {}).items()
                    },
                }
            )

        # Use build_pressure_followup ONLY to surface unresolved nodes (remaining P-HIGH).
        follow = build_pressure_followup(wn, sim, ev, prv)
        unresolved = [str(row.get("id")) for row in (follow.get("remainingHighNodes") or [])]
        prv_reco_out = {
            "needed": bool(prv.get("needed")),
            "recommendations": recommendations,
            "unresolvedNodes": unresolved,
        }

    remaining_errors = _build_remaining_errors(list(ev.get("violations", []) or []))

    return {
        "success": True,
        "filename": str(filename or "network.inp"),
        "engineUsed": engine_used,
        "nodes": nodes_out,
        "prvRecommendation": prv_reco_out,
        "remainingErrors": remaining_errors,
        "warnings": warnings,
        "addPrvAvailable": bool(add_prv_available),
    }
