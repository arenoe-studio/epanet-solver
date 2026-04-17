"""
network_io.py — Load, sanitasi, dan ekspor file .inp EPANET
"""

import tempfile
import wntr
from pathlib import Path

from .config import SEARCH_PATHS


# ===========================================================================
# LOAD & SANITASI
# ===========================================================================

class InpValidationError(Exception):
    """File .inp tidak sesuai format/standar yang didukung sistem."""


def _iter_section_rows(lines: list[str], section: str) -> list[str]:
    """Ambil baris data (bukan komentar) dalam sebuah section."""
    wanted = section.upper()
    in_section = False
    rows: list[str] = []
    for line in lines:
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


def validate_inp_file(inp_path: Path) -> None:
    """
    Validasi minimal sesuai EPANET_Solver_Logic_Documentation.md:
      - Section wajib ada: [JUNCTIONS], [RESERVOIRS], [PIPES], [OPTIONS]
      - Minimal 1 reservoir dan 1 junction
      - Minimal 1 pipa yang menghubungkan reservoir ke jaringan
      - OPTIONS: Units=LPS dan Headloss=H-W
    """
    text = inp_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    required = ["[JUNCTIONS]", "[RESERVOIRS]", "[PIPES]", "[OPTIONS]"]
    found_sections = {line.strip().upper() for line in lines if line.strip().startswith("[")}
    missing = [s for s in required if s not in found_sections]
    if missing:
        raise InpValidationError(f"Missing section(s): {', '.join(missing)}")

    junction_rows = _iter_section_rows(lines, "[JUNCTIONS]")
    reservoir_rows = _iter_section_rows(lines, "[RESERVOIRS]")
    pipe_rows = _iter_section_rows(lines, "[PIPES]")
    option_rows = _iter_section_rows(lines, "[OPTIONS]")

    if not junction_rows:
        raise InpValidationError("Invalid .inp: [JUNCTIONS] kosong.")
    if not reservoir_rows:
        raise InpValidationError("Invalid .inp: [RESERVOIRS] kosong.")
    if not pipe_rows:
        raise InpValidationError("Invalid .inp: [PIPES] kosong.")

    units = None
    headloss = None
    for row in option_rows:
        parts = row.split()
        if len(parts) < 2:
            continue
        key = parts[0].upper()
        val = parts[1].upper()
        if key == "UNITS":
            units = val
        elif key == "HEADLOSS":
            headloss = val

    if units != "LPS":
        raise InpValidationError("Invalid .inp: UNITS harus LPS.")
    if headloss not in ("H-W", "HW", "HAZEN-WILLIAMS"):
        raise InpValidationError("Invalid .inp: HEADLOSS harus H-W (Hazen-Williams).")

    reservoir_ids = {r.split()[0] for r in reservoir_rows if r.split()}
    ok_connection = False
    for row in pipe_rows:
        parts = row.split()
        if len(parts) < 3:
            continue
        n1, n2 = parts[1], parts[2]
        if (n1 in reservoir_ids) ^ (n2 in reservoir_ids):
            ok_connection = True
            break
    if not ok_connection:
        raise InpValidationError(
            "Invalid .inp: tidak ada pipa yang menghubungkan reservoir ke jaringan."
        )


def sanitize_inp_vertices(inp_path: Path) -> str:
    """
    Bersihkan section [VERTICES] dari referensi pipa yang tidak terdaftar
    di [PIPES]. Vertices hanya koordinat visual — tidak mempengaruhi hidraulik.

    Mengembalikan konten .inp yang sudah bersih sebagai string.
    """
    with open(inp_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()

    # Kumpulkan semua pipe ID valid dari [PIPES]
    valid_ids: set[str] = set()
    in_pipes = False
    for line in lines:
        s = line.strip()
        if s.upper().startswith("[PIPES]"):
            in_pipes = True
            continue
        if s.startswith("[") and in_pipes:
            in_pipes = False
            continue
        if in_pipes and s and not s.startswith(";"):
            parts = s.split()
            if parts:
                valid_ids.add(parts[0])

    # Filter baris [VERTICES] yang merujuk pipa tidak valid
    cleaned: list[str] = []
    in_vertices = False
    removed = 0
    for line in lines:
        s = line.strip()
        if s.upper().startswith("[VERTICES]"):
            in_vertices = True
            cleaned.append(line)
            continue
        if s.startswith("[") and in_vertices:
            in_vertices = False
        if in_vertices and s and not s.startswith(";"):
            parts = s.split()
            if parts and parts[0] not in valid_ids:
                removed += 1
                continue
        cleaned.append(line)

    if removed:
        print(f"      [sanitize] {removed} baris vertices tidak valid dibuang.")

    return "\n".join(cleaned)


def load_network(inp_path: Path) -> wntr.network.WaterNetworkModel:
    """
    Muat WaterNetworkModel dari file .inp.
    Jika gagal (misal vertices korup), sanitasi dulu lalu coba lagi.
    """
    validate_inp_file(inp_path)
    try:
        return wntr.network.WaterNetworkModel(str(inp_path))
    except Exception:
        pass

    clean = sanitize_inp_vertices(inp_path)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".inp", delete=False,
        encoding="utf-8", prefix="wntr_clean_"
    ) as tmp:
        tmp.write(clean)
        tmp_path = tmp.name

    try:
        wn = wntr.network.WaterNetworkModel(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return wn


def find_inp_file(start_dir: Path) -> Path:
    """Cari file .inp secara otomatis di folder proyek."""
    for sub in SEARCH_PATHS:
        folder = start_dir / sub
        if folder.exists():
            found = sorted(folder.glob("*.inp"))
            if found:
                return found[0]
    for f in sorted(start_dir.glob("*.inp")):
        return f
    raise FileNotFoundError(
        f"Tidak ada file .inp di folder proyek ({start_dir}).\n"
        "Letakkan file .inp di folder 'data_Input/' atau root proyek."
    )


# ===========================================================================
# EKSPOR .INP TEROPTIMASI
# ===========================================================================

def export_optimized_inp(
    original_inp_path: Path,
    wn_optimized: wntr.network.WaterNetworkModel,
    output_path: Path,
) -> None:
    """
    Ekspor jaringan teroptimasi ke file .inp siap buka di EPANET 2.2.

    Metode utama: wntr.network.write_inpfile (model sudah bersih dari sanitasi).
    Fallback: patch teks asli per-baris jika WNTR write gagal.
    """
    try:
        wntr.network.write_inpfile(wn_optimized, str(output_path))
        print(f"  [OK] File teroptimasi: {output_path}")
        return
    except Exception as e:
        print(f"      [warn] wntr.write_inpfile gagal ({e}), beralih ke fallback.")

    # Fallback: patch teks, sanitasi vertices dulu
    clean = sanitize_inp_vertices(original_inp_path)
    lines, new_lines, in_pipes = clean.splitlines(), [], False

    for line in lines:
        stripped = line.strip().upper()
        if stripped.startswith("[PIPES]"):
            in_pipes = True
            new_lines.append(line)
            continue
        if stripped.startswith("[") and in_pipes:
            in_pipes = False
        if in_pipes and line.strip() and not line.strip().startswith(";"):
            parts = line.split()
            if len(parts) >= 6:
                try:
                    pipe = wn_optimized.get_link(parts[0])
                    parts[4] = f"{pipe.diameter * 1000.0:.4f}"
                    parts[5] = f"{float(getattr(pipe, 'roughness', parts[5])):.4f}"
                    new_lines.append("  ".join(parts))
                    continue
                except Exception:
                    pass
        new_lines.append(line)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))

    print(f"  [OK] File teroptimasi (fallback): {output_path}")
