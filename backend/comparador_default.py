"""Comparador genérico: empareja 2 nóminas por campos mapeados (CSV/XLSX)."""

from __future__ import annotations

import csv
import io
import json
import re
import warnings
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


def _detectar_encoding(ruta: Path | str) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            with open(ruta, encoding=encoding) as f:
                f.readline()
            return encoding
        except UnicodeDecodeError:
            continue
    return "latin-1"


def _detectar_separador(texto: str) -> str:
    primera = texto.splitlines()[0] if texto else ""
    try:
        dialecto = csv.Sniffer().sniff(texto[:8192], delimiters=";,")
        if dialecto.delimiter in (";", ","):
            return dialecto.delimiter
    except csv.Error:
        pass
    return ";" if primera.count(";") >= primera.count(",") else ","


def _leer_csv(ruta: Path | str) -> pd.DataFrame:
    encoding = _detectar_encoding(ruta)
    with open(ruta, encoding=encoding, errors="replace") as f:
        texto = f.read()
    sep = _detectar_separador(texto)
    kwargs = dict(sep=sep, dtype=str, engine="python", quotechar='"', skipinitialspace=True)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=pd.errors.ParserWarning)
        try:
            return pd.read_csv(io.StringIO(texto), on_bad_lines="warn", **kwargs)
        except TypeError:
            return pd.read_csv(
                io.StringIO(texto),
                error_bad_lines=False,
                warn_bad_lines=False,
                **kwargs,
            )


def leer_nomina(ruta: Path | str, hoja: str | None = None) -> pd.DataFrame:
    path = Path(ruta)
    ext = path.suffix.lower()
    if ext in (".xlsx", ".xls"):
        if hoja and hoja.strip() and hoja.strip().casefold() not in ("activa (por defecto)", "activa"):
            df = pd.read_excel(path, sheet_name=hoja, dtype=str)
        else:
            df = pd.read_excel(path, dtype=str)
    elif ext == ".csv":
        df = _leer_csv(path)
    else:
        raise ValueError("Solo se permiten archivos Excel (.xlsx/.xls) o CSV (.csv).")

    if df is None or df.empty:
        raise ValueError(f"El archivo «{path.name}» está vacío o no se pudo leer.")

    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    for col in df.columns:
        df[col] = df[col].fillna("").astype(str).str.strip().replace({"nan": "", "None": ""})
    return df


def inspeccionar_archivo(ruta: Path | str, hoja: str | None = None) -> dict:
    path = Path(ruta)
    hojas: list[str] = []
    if path.suffix.lower() in (".xlsx", ".xls"):
        xl = pd.ExcelFile(path)
        hojas = [str(n) for n in xl.sheet_names]
    df = leer_nomina(ruta, hoja)
    return {
        "nombre": path.name,
        "columnas": list(df.columns),
        "filas": int(len(df)),
        "hojas": hojas,
    }


def normalizar_valor_clave(valor) -> str:
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return ""
    s = str(valor).strip()
    if s.endswith(".0") and s[:-2].replace(".", "", 1).isdigit():
        s = s[:-2]
    s = s.replace("\xa0", "").replace(" ", "")
    return re.sub(r"[^0-9A-Za-z]", "", s).upper()


def _parsear_mapeos(mapeos: list[dict] | str) -> list[tuple[str, str]]:
    if isinstance(mapeos, str):
        try:
            mapeos = json.loads(mapeos)
        except json.JSONDecodeError as e:
            raise ValueError(f"mapeos inválidos: {e}") from e
    if not isinstance(mapeos, list) or not mapeos:
        raise ValueError("Indica al menos un par de campos para comparar.")

    pares: list[tuple[str, str]] = []
    for i, item in enumerate(mapeos, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Mapeo #{i} inválido.")
        c1 = str(item.get("col1") or item.get("nomina1") or "").strip()
        c2 = str(item.get("col2") or item.get("nomina2") or "").strip()
        if not c1 or not c2:
            raise ValueError(f"Mapeo #{i}: elige campo de nómina 1 y de nómina 2.")
        pares.append((c1, c2))
    return pares


def _agregar_clave(df: pd.DataFrame, columnas: list[str]) -> pd.DataFrame:
    out = df.copy()
    partes = [out[c].map(normalizar_valor_clave) for c in columnas]
    clave = partes[0]
    for p in partes[1:]:
        clave = clave + "||" + p
    vacio = partes[0].eq("")
    for p in partes[1:]:
        vacio = vacio | p.eq("")
    out["_clave"] = clave.where(~vacio, "")
    out = out[out["_clave"] != ""].copy()
    out = out.drop_duplicates(subset=["_clave"], keep="first")
    return out


def _estilo_hoja(ws, fill: PatternFill):
    font_header = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    for cell in ws[1]:
        cell.font = font_header
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 28
    for idx, col in enumerate(ws.columns, start=1):
        sample = col[: min(40, len(col))]
        max_len = max((len(str(c.value or "")) for c in sample), default=10)
        ws.column_dimensions[get_column_letter(idx)].width = min(max(max_len + 3, 12), 42)
    if ws.max_row >= 1 and ws.max_column >= 1:
        ws.auto_filter.ref = f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"


def procesar_comparacion(
    ruta1: Path | str,
    ruta2: Path | str,
    mapeos: list[dict] | str,
    fuente: str,
    destino: Path | str | BinaryIO,
    hoja1: str | None = None,
    hoja2: str | None = None,
) -> dict:
    pares = _parsear_mapeos(mapeos)
    fuente = str(fuente).strip()
    if fuente not in ("1", "2"):
        raise ValueError("fuente debe ser «1» (nómina 1) o «2» (nómina 2).")

    df1 = leer_nomina(ruta1, hoja1)
    df2 = leer_nomina(ruta2, hoja2)

    cols1 = [c for c, _ in pares]
    cols2 = [c for _, c in pares]
    for c in cols1:
        if c not in df1.columns:
            raise ValueError(f"La nómina 1 no tiene la columna «{c}».")
    for c in cols2:
        if c not in df2.columns:
            raise ValueError(f"La nómina 2 no tiene la columna «{c}».")

    a = _agregar_clave(df1, cols1)
    b = _agregar_clave(df2, cols2)
    keys1 = set(a["_clave"])
    keys2 = set(b["_clave"])
    comunes = keys1 & keys2
    solo1 = keys1 - keys2
    solo2 = keys2 - keys1

    preferida = "1" if fuente == "1" else "2"
    df_pref = a if preferida == "1" else b
    df_otra = b if preferida == "1" else a
    solo_pref = solo1 if preferida == "1" else solo2
    solo_otra = solo2 if preferida == "1" else solo1
    etiqueta_pref = "Nómina 1" if preferida == "1" else "Nómina 2"
    etiqueta_otra = "Nómina 2" if preferida == "1" else "Nómina 1"

    cols_pref = [c for c in df_pref.columns if c != "_clave"]
    cols_otra = [c for c in df_otra.columns if c != "_clave"]
    cols_union = list(cols_pref)
    for c in cols_otra:
        if c not in cols_union:
            cols_union.append(c)

    coinciden = df_pref[df_pref["_clave"].isin(comunes)].copy()
    coinciden.insert(0, "Origen", etiqueta_pref)
    coinciden = coinciden.drop(columns=["_clave"])

    no_pref = df_pref[df_pref["_clave"].isin(solo_pref)].copy()
    no_pref.insert(0, "Origen", etiqueta_pref)
    no_pref = no_pref.drop(columns=["_clave"])

    no_otra = df_otra[df_otra["_clave"].isin(solo_otra)].copy()
    no_otra.insert(0, "Origen", etiqueta_otra)
    no_otra = no_otra.drop(columns=["_clave"])

    no_coinciden = pd.concat([no_pref, no_otra], ignore_index=True, sort=False)
    for c in ["Origen"] + cols_union:
        if c not in no_coinciden.columns:
            no_coinciden[c] = ""
    no_coinciden = no_coinciden[["Origen"] + cols_union]

    fill_ok = PatternFill(start_color="548235", end_color="548235", fill_type="solid")
    fill_miss = PatternFill(start_color="C00000", end_color="C00000", fill_type="solid")

    with pd.ExcelWriter(destino, engine="openpyxl") as writer:
        coinciden.to_excel(writer, sheet_name="Coinciden", index=False)
        no_coinciden.to_excel(writer, sheet_name="No coinciden", index=False)
        _estilo_hoja(writer.sheets["Coinciden"], fill_ok)
        _estilo_hoja(writer.sheets["No coinciden"], fill_miss)

    return {
        "coinciden": int(len(coinciden)),
        "no_coinciden": int(len(no_coinciden)),
        "solo_nomina1": int(len(solo1)),
        "solo_nomina2": int(len(solo2)),
        "nomina1": int(len(a)),
        "nomina2": int(len(b)),
        "fuente": preferida,
        "campos": [{"col1": x, "col2": y} for x, y in pares],
    }


def generar_reporte_bytes(
    ruta1: Path | str,
    ruta2: Path | str,
    mapeos: list[dict] | str,
    fuente: str,
    hoja1: str | None = None,
    hoja2: str | None = None,
) -> tuple[bytes, str, dict]:
    buf = io.BytesIO()
    stats = procesar_comparacion(ruta1, ruta2, mapeos, fuente, buf, hoja1=hoja1, hoja2=hoja2)
    filename = f"Comparador_Default_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return buf.getvalue(), filename, stats
