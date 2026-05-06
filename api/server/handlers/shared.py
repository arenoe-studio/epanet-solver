from __future__ import annotations


def _explain(issue: str) -> tuple[str, str, str]:
    i = (issue or "").upper()
    if i == "P-NEG":
        return (
            "m",
            "Tekanan negatif menandakan energi (head) tidak cukup di lokasi tersebut atau hasil solver tidak valid.",
            "Periksa elevasi, head sumber (reservoir/tank), dan headloss rute menuju node. "
            "Pertimbangkan pembagian zona, PRV/valve setting, atau penambahan sumber/booster bila diperlukan.",
        )
    if i == "P-LOW":
        return (
            "m",
            "Tekanan di bawah batas minimum (10 m) biasanya terjadi karena headloss terlalu besar atau head sumber terlalu rendah.",
            "Evaluasi pipa dengan headloss tinggi di rute menuju node ini (perbesar diameter), "
            "kurangi demand yang tidak realistis, atau tambah head sumber.",
        )
    if i == "P-HIGH":
        return (
            "m",
            "Tekanan di atas batas maksimum (80 m) menandakan head berlebih di zona tersebut.",
            "Pertimbangkan pemasangan PRV/pembagian zona tekanan. Pastikan juga head sumber tidak terlalu tinggi.",
        )
    if i == "V-HIGH":
        return (
            "m/s",
            "Kecepatan aliran terlalu tinggi mengindikasikan diameter pipa terlalu kecil untuk debit yang lewat.",
            "Perbesar diameter pipa pada segmen ini atau evaluasi pembagian aliran (looping, parallel pipe).",
        )
    if i == "V-LOW":
        return (
            "m/s",
            "Kecepatan terlalu rendah biasanya terjadi karena diameter terlalu besar atau debit sangat kecil.",
            "Pertimbangkan penurunan diameter atau evaluasi demand agar lebih representatif.",
        )
    if i == "HL-HIGH":
        return (
            "m/km",
            "Headloss per km terlalu tinggi menandakan rugi energi besar (diameter kecil/roughness rendah/debit besar).",
            "Perbesar diameter pipa, cek nilai roughness (Hazen-Williams C), dan evaluasi rute dengan kehilangan energi tinggi.",
        )
    return ("", "Masalah masih tersisa setelah optimasi.", "Evaluasi ulang input jaringan dan parameter simulasi.")


def _build_remaining_errors(violations: list[dict]) -> list[dict]:
    out: list[dict] = []
    for v in violations or []:
        issue = str(v.get("issue") or v.get("type") or "")
        unit, explanation, suggestion = _explain(issue)
        out.append(
            {
                "type": str(issue),
                "elementId": str(v.get("element") or ""),
                "value": float(v.get("value", 0.0) or 0.0),
                "unit": unit or str(v.get("unit") or ""),
                "explanation": explanation,
                "suggestion": suggestion,
            }
        )
    return out

