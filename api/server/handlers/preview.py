from __future__ import annotations

import tempfile
from pathlib import Path

from api.epanet.network_io import InpValidationError, load_network


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


def _parse_options(option_rows: list[str]) -> tuple[str, str]:
    units = ""
    headloss = ""
    for row in option_rows:
        parts = row.split()
        if len(parts) < 2:
            continue
        key = parts[0].strip().upper()
        val = parts[1].strip()
        if key == "UNITS":
            units = val
        elif key == "HEADLOSS":
            headloss = val
    return units, headloss


def _validate_units_lps(units: str) -> None:
    u = (units or "").strip()
    if u.upper() != "LPS":
        shown = u or "UNKNOWN"
        raise InpValidationError(
            f"File ini menggunakan unit {shown}. Sistem hanya mendukung "
            "LPS. Silakan ubah setting UNITS di EPANET menjadi LPS sebelum upload ulang."
        )


def _parse_junctions(junction_rows: list[str]) -> tuple[list[dict], float]:
    nodes: list[dict] = []
    total_demand_lps = 0.0
    for row in junction_rows:
        parts = row.split()
        if not parts:
            continue
        node_id = str(parts[0])
        elevation_m = float(parts[1]) if len(parts) >= 2 else 0.0
        demand_lps = float(parts[2]) if len(parts) >= 3 else 0.0
        nodes.append(
            {
                "id": node_id,
                "elevationM": elevation_m,
                "demandLps": demand_lps,
            }
        )
        total_demand_lps += demand_lps
    return nodes, float(total_demand_lps)


def _normalize_pipe_status(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return "Open"
    u = s.upper()
    if u in {"OPEN", "O"}:
        return "Open"
    if u in {"CLOSED", "C"}:
        return "Closed"
    if u == "CV":
        return "CV"
    return s


def _parse_pipes(pipe_rows: list[str]) -> list[dict]:
    pipes: list[dict] = []
    for row in pipe_rows:
        parts = row.split()
        if len(parts) < 6:
            continue
        pipe_id = str(parts[0])
        length_m = float(parts[3])
        diameter_mm = float(parts[4])
        roughness = float(parts[5])
        status = _normalize_pipe_status(parts[7] if len(parts) >= 8 else "")
        pipes.append(
            {
                "id": pipe_id,
                "diameterMm": diameter_mm,
                "lengthM": length_m,
                "roughness": roughness,
                "status": status,
            }
        )
    return pipes


def _write_temp_inp(inp_bytes: bytes, suffix: str = ".inp") -> Path:
    tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=suffix, delete=False, prefix="preview_")
    try:
        tmp.write(inp_bytes)
        tmp.flush()
        return Path(tmp.name)
    finally:
        try:
            tmp.close()
        except Exception:
            pass


def preview_inp(inp_bytes: bytes, filename: str) -> dict:
    """
    Parse file .inp tanpa simulasi. Return dict hasil preview.
    Raise InpValidationError jika unit bukan LPS.
    """
    text = _decode_inp(inp_bytes)

    option_rows = _iter_section_rows(text, "[OPTIONS]")
    junction_rows = _iter_section_rows(text, "[JUNCTIONS]")
    pipe_rows = _iter_section_rows(text, "[PIPES]")
    reservoir_rows = _iter_section_rows(text, "[RESERVOIRS]")
    tank_rows = _iter_section_rows(text, "[TANKS]")
    pump_rows = _iter_section_rows(text, "[PUMPS]")
    valve_rows = _iter_section_rows(text, "[VALVES]")

    units, headloss = _parse_options(option_rows)
    _validate_units_lps(units)

    nodes, total_demand_lps = _parse_junctions(junction_rows)
    pipes = _parse_pipes(pipe_rows)

    warnings: list[str] = []
    if pump_rows:
        warnings.append(
            "Sistem mendeteksi pompa. Analisis tetap bisa dijalankan namun pompa tidak dioptimasi."
        )
    if tank_rows:
        warnings.append("Sistem mendeteksi tangki. Analisis tetap bisa dijalankan.")

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

    return {
        "success": True,
        "filename": str(filename or "network.inp"),
        "networkInfo": {
            "units": str(units or ""),
            "headlossFormula": str(headloss or ""),
            "junctionCount": int(getattr(wn, "num_junctions", 0) or 0),
            "pipeCount": int(getattr(wn, "num_pipes", 0) or 0),
            "reservoirCount": int(getattr(wn, "num_reservoirs", 0) or 0),
            "tankCount": int(getattr(wn, "num_tanks", 0) or 0),
            "pumpCount": int(getattr(wn, "num_pumps", 0) or 0),
            "valveCount": int(getattr(wn, "num_valves", 0) or 0),
            "totalDemandLps": float(total_demand_lps),
        },
        "pipes": pipes,
        "nodes": nodes,
        "warnings": warnings,
    }

