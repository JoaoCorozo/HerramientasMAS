"""Separador de cursos aprobados Carozzi por courseid (Activos / Inactivos)."""

from __future__ import annotations

import io
import re
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

import pandas as pd

from carozzi_chile_comparador import _buscar_columna, _leer_csv


def parsear_ids_activos(texto: str) -> list[str]:
    """Acepta IDs separados por coma, punto y coma, espacio o salto de línea."""
    if not texto or not str(texto).strip():
        raise ValueError("Indica al menos un ID de curso activo.")
    partes = re.split(r"[\s,;]+", str(texto).strip())
    ids: list[str] = []
    vistos: set[str] = set()
    for p in partes:
        if not p:
            continue
        cid = p.strip()
        if cid.endswith(".0"):
            cid = cid[:-2]
        if not cid or cid in vistos:
            continue
        if not re.fullmatch(r"\d+", cid):
            raise ValueError(f"ID de curso inválido: «{p}». Usa solo números (ej. 10, 12).")
        vistos.add(cid)
        ids.append(cid)
    if not ids:
        raise ValueError("Indica al menos un ID de curso activo.")
    return ids


def _normalizar_courseid(valor) -> str:
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return ""
    s = str(valor).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


def leer_cursos_aprobados(ruta: Path | str) -> pd.DataFrame:
    path = Path(ruta)
    if path.suffix.lower() != ".csv":
        raise ValueError("El listado de cursos aprobados debe ser CSV (.csv).")

    df = _leer_csv(path)
    if df.empty:
        raise ValueError("El CSV está vacío.")

    col_id = _buscar_columna(df, ["courseid", "course_id", "id_curso", "Course ID"])
    if not col_id:
        raise ValueError(
            "No se encontró la columna courseid en el CSV. "
            "Se espera el export «listado cursos aprobados por usuarios»."
        )

    out = df.copy()
    out["_courseid_norm"] = out[col_id].map(_normalizar_courseid)
    return out


def listar_cursos_unicos(ruta: Path | str) -> list[dict]:
    df = leer_cursos_aprobados(ruta)
    col_curso = _buscar_columna(df, ["curso", "fullname", "course", "nombre"])
    col_short = _buscar_columna(df, ["shortname", "short_name"])

    grupos = df.groupby("_courseid_norm", dropna=False)
    items: list[dict] = []
    for cid, grupo in grupos:
        if not cid:
            continue
        curso = ""
        shortname = ""
        if col_curso:
            vals = grupo[col_curso].dropna().astype(str).str.strip()
            vals = vals[vals != ""]
            if len(vals):
                curso = vals.iloc[0]
        if col_short:
            vals = grupo[col_short].dropna().astype(str).str.strip()
            vals = vals[vals != ""]
            if len(vals):
                shortname = vals.iloc[0]
        items.append(
            {
                "courseid": str(cid),
                "curso": curso,
                "shortname": shortname,
                "filas": int(len(grupo)),
            }
        )

    def _sort_key(item: dict):
        cid = item["courseid"]
        return (0, int(cid)) if cid.isdigit() else (1, cid)

    items.sort(key=_sort_key)
    return items


def procesar_separacion(
    ruta_csv: Path | str,
    ids_activos: list[str] | str,
    destino: Path | str | BinaryIO,
) -> dict:
    if isinstance(ids_activos, str):
        ids = parsear_ids_activos(ids_activos)
    else:
        ids = parsear_ids_activos(",".join(ids_activos))

    ids_set = set(ids)
    df = leer_cursos_aprobados(ruta_csv)

    mask = df["_courseid_norm"].isin(ids_set)
    df_activos = df.loc[mask].drop(columns=["_courseid_norm"])
    df_inactivos = df.loc[~mask].drop(columns=["_courseid_norm"])

    presentes = sorted(
        {c for c in df["_courseid_norm"].unique() if c in ids_set},
        key=lambda x: (0, int(x)) if str(x).isdigit() else (1, str(x)),
    )
    ausentes = [c for c in ids if c not in set(df["_courseid_norm"].unique())]

    resumen = pd.DataFrame(
        [
            {"concepto": "Total filas CSV", "valor": len(df)},
            {"concepto": "Filas activos", "valor": len(df_activos)},
            {"concepto": "Filas inactivos", "valor": len(df_inactivos)},
            {"concepto": "IDs activos solicitados", "valor": ", ".join(ids)},
            {"concepto": "IDs encontrados en CSV", "valor": ", ".join(presentes) or "(ninguno)"},
            {
                "concepto": "IDs solicitados sin filas",
                "valor": ", ".join(ausentes) if ausentes else "(ninguno)",
            },
        ]
    )

    with pd.ExcelWriter(destino, engine="openpyxl") as writer:
        resumen.to_excel(writer, sheet_name="Resumen", index=False)
        df_activos.to_excel(writer, sheet_name="Activos", index=False)
        df_inactivos.to_excel(writer, sheet_name="Inactivos", index=False)

    return {
        "total": int(len(df)),
        "activos": int(len(df_activos)),
        "inactivos": int(len(df_inactivos)),
        "ids_solicitados": ids,
        "ids_encontrados": presentes,
        "ids_sin_filas": ausentes,
    }


def generar_reporte_bytes(
    ruta_csv: Path | str,
    ids_activos: list[str] | str,
) -> tuple[bytes, str, dict]:
    buf = io.BytesIO()
    stats = procesar_separacion(ruta_csv, ids_activos, buf)
    filename = f"Carozzi_Cursos_Activos_Inactivos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return buf.getvalue(), filename, stats
