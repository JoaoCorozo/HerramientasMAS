"""Parser y generación CSV Moodle para generador Resiter."""

from __future__ import annotations

import csv
import io
import json
import re
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl
import pandas as pd

from paths import BACKEND_DIR

RESITER_HEADERS = [
    "RUT",
    "Nombre Colaborador a capacitar",
    "Correo Colaborador a capacitar",
    "Cargo Colaborador a capacitar",
    "CeCo (indicar número)",
    "Perfil SAP",
    "Cápsula a solicitar",
]

HEADER_KEYS = {
    "rut": "RUT",
    "nombre colaborador a capacitar": "Nombre Colaborador a capacitar",
    "correo colaborador a capacitar": "Correo Colaborador a capacitar",
    "cargo colaborador a capacitar": "Cargo Colaborador a capacitar",
    "ceco (indicar numero)": "CeCo (indicar número)",
    "ceco (indicar número)": "CeCo (indicar número)",
    "ceco": "CeCo (indicar número)",
    "perfil sap": "Perfil SAP",
    "capsula a solicitar": "Cápsula a solicitar",
    "cápsula a solicitar": "Cápsula a solicitar",
}

EMPRESA = "RESITER"
COUNTER_FILE = BACKEND_DIR / "data" / "resiter_download_seq.json"


def _normalize_label(text: str) -> str:
    s = str(text).strip().lower()
    s = s.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    s = re.sub(r"\s+", " ", s)
    return s


def _map_header_label(text: str) -> str | None:
    return HEADER_KEYS.get(_normalize_label(text))


def separar_nombre_completo(nombre_completo: str) -> tuple[str, str]:
    partes = str(nombre_completo).strip().split()
    if len(partes) <= 1:
        return str(nombre_completo).strip().upper(), ""
    if len(partes) == 2:
        return partes[0].upper(), partes[1].upper()
    if len(partes) == 3:
        return partes[0].upper(), f"{partes[1]} {partes[2]}".upper()
    nombres = f"{partes[0]} {partes[1]}".upper()
    apellidos = " ".join(partes[2:]).upper()
    return nombres, apellidos


def normalizar_rut(rut_raw: str) -> str:
    rut = str(rut_raw).strip().upper()
    if rut.endswith(".0") and rut.replace(".", "").replace("0", "").isdigit():
        rut = rut[:-2]
    rut = rut.replace(".", "").replace("-", "").replace(" ", "")
    rut = re.sub(r"[^0-9K]", "", rut)
    return rut


def clasificar_perfil(perfil_raw: str) -> tuple[str | None, str | None]:
    perfil = str(perfil_raw).strip()
    if not perfil or perfil.lower() == "nan":
        return None, "perfil sin valor correspondiente"
    perfil_lower = perfil.lower()
    if "operacional" in perfil_lower:
        return "operacional", None
    if "administrativo" in perfil_lower:
        return "administrativo", None
    if "crm" in perfil_lower:
        return "crm", None
    return None, f"perfil no reconocido: {perfil}"


def _asignar_cursos_por_perfil(fila: dict[str, str], perfil: str) -> None:
    if perfil == "operacional":
        fila.update(
            {
                "group1": "TODOS",
                "course1": "SAP01",
                "group2": "G SAP Bloqueados",
                "course2": "SAP01",
                "group3": "TODOS",
                "course3": "ISAP01",
            }
        )
    elif perfil == "administrativo":
        fila.update(
            {
                "group1": "TODOS",
                "course1": "SAP_PA",
                "group2": "G SAP Bloqueados",
                "course2": "SAP_PA",
                "group3": "TODOS",
                "course3": "ISAP01",
            }
        )
    elif perfil == "crm":
        fila.update(
            {
                "group1": "TODOS",
                "course1": "Cápsulas CRM",
                "group2": "Grupo CRM",
                "course2": "Cápsulas CRM",
            }
        )


def _record_vacio(record: dict[str, str]) -> bool:
    rut = normalizar_rut(record.get("RUT", ""))
    nombre = str(record.get("Nombre Colaborador a capacitar", "")).strip()
    return not rut and not nombre


def _record_desde_valores(valores: list[str]) -> dict[str, str]:
    record: dict[str, str] = {}
    for idx, header in enumerate(RESITER_HEADERS):
        record[header] = valores[idx].strip() if idx < len(valores) else ""
    return record


def _lineas_desde_texto(texto: str) -> list[str]:
    return [ln.strip() for ln in texto.replace("\r\n", "\n").replace("\r", "\n").split("\n")]


def _bloque_parece_encabezados(lineas: list[str], start: int = 0) -> bool:
    if start + len(RESITER_HEADERS) > len(lineas):
        return False
    coincidencias = 0
    for i, header in enumerate(RESITER_HEADERS):
        if _map_header_label(lineas[start + i]):
            coincidencias += 1
    return coincidencias >= max(4, len(RESITER_HEADERS) - 2)


def _registros_desde_bloques_verticales(lineas: list[str]) -> list[dict[str, str]]:
    limpias = [ln for ln in lineas if ln]
    if not limpias:
        return []

    start = 0
    if _bloque_parece_encabezados(limpias, 0):
        start = len(RESITER_HEADERS)

    registros: list[dict[str, str]] = []
    idx = start
    while idx + len(RESITER_HEADERS) <= len(limpias):
        record = _record_desde_valores(limpias[idx : idx + len(RESITER_HEADERS)])
        if not _record_vacio(record):
            registros.append(record)
        idx += len(RESITER_HEADERS)
    return registros


def _mapear_columnas_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    rename: dict[Any, str] = {}
    for col in df.columns:
        mapped = _map_header_label(str(col))
        if mapped:
            rename[col] = mapped
    if not rename:
        raise ValueError(
            "No se encontraron columnas de Resiter. Verifique encabezados como RUT, "
            "Nombre Colaborador a capacitar, Perfil SAP, etc."
        )
    out = df.rename(columns=rename)
    for header in RESITER_HEADERS:
        if header not in out.columns:
            out[header] = ""
    return out[RESITER_HEADERS]


def _registros_desde_dataframe(df: pd.DataFrame) -> list[dict[str, str]]:
    df = _mapear_columnas_dataframe(df)
    registros: list[dict[str, str]] = []
    for _, row in df.iterrows():
        record = {header: str(row.get(header, "") or "").strip() for header in RESITER_HEADERS}
        if _record_vacio(record):
            continue
        registros.append(record)
    return registros


def _leer_csv_archivo(ruta: Path) -> pd.DataFrame:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin1"):
        try:
            with open(ruta, encoding=encoding, errors="replace") as f:
                texto = f.read()
            break
        except OSError:
            continue
    else:
        raise ValueError("No se pudo leer el CSV.")

    for sep in (",", ";", "\t"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=pd.errors.ParserWarning)
                df = pd.read_csv(io.StringIO(texto), sep=sep, dtype=str, engine="python")
            if len(df.columns) > 1:
                return df
        except Exception:
            continue
    raise ValueError("No se pudo interpretar el CSV (use , o ; como separador).")


def _leer_excel_archivo(ruta: Path) -> pd.DataFrame:
    return pd.read_excel(ruta, dtype=str)


def _registros_desde_texto_tabular(texto: str) -> list[dict[str, str]] | None:
    for sep in ("\t", ",", ";"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=pd.errors.ParserWarning)
                df = pd.read_csv(io.StringIO(texto), sep=sep, dtype=str, engine="python")
            if len(df.columns) <= 1:
                continue
            mapped = [_map_header_label(str(c)) for c in df.columns]
            if sum(1 for m in mapped if m) >= 4:
                return _registros_desde_dataframe(df)
        except Exception:
            continue
    return None


def parse_registros_desde_texto(texto: str) -> list[dict[str, str]]:
    if not texto or not texto.strip():
        raise ValueError("Pega la matriz del cliente o los datos de colaboradores.")

    tabular = _registros_desde_texto_tabular(texto.strip())
    if tabular:
        return tabular

    lineas = _lineas_desde_texto(texto)
    verticales = _registros_desde_bloques_verticales(lineas)
    if verticales:
        return verticales

    raise ValueError(
        "No se pudo interpretar el texto. Use encabezados y filas como la matriz del cliente, "
        "o una tabla separada por tabulaciones/comas."
    )


def parse_registros_desde_archivo(ruta: Path | str) -> list[dict[str, str]]:
    ruta = Path(ruta)
    ext = ruta.suffix.lower()
    if ext == ".csv":
        df = _leer_csv_archivo(ruta)
    elif ext in (".xlsx", ".xls"):
        df = _leer_excel_archivo(ruta)
    else:
        raise ValueError("Formato no soportado. Use CSV o Excel (.xlsx, .xls).")
    registros = _registros_desde_dataframe(df)
    if not registros:
        raise ValueError("El archivo no contiene filas válidas.")
    return registros


def procesar_registros(registros: list[dict[str, str]]) -> dict[str, Any]:
    filas_procesadas: list[dict[str, str]] = []
    ruts_vistos: set[str] = set()
    omitidos_perfil: list[str] = []
    omitidos_duplicado: list[str] = []
    rut_dudoso: list[str] = []

    for record in registros:
        rut_raw = record.get("RUT", "")
        rut = normalizar_rut(rut_raw)
        nombre_completo = record.get("Nombre Colaborador a capacitar", "").strip()
        email = record.get("Correo Colaborador a capacitar", "").strip()
        if email.lower() == "nan":
            email = ""

        if not rut or rut.upper() == "NAN":
            continue

        if not re.fullmatch(r"\d+[0-9K]", rut):
            rut_dudoso.append(f"{rut_raw} -> {rut} ({nombre_completo})")

        if rut in ruts_vistos:
            omitidos_duplicado.append(f"{rut} ({nombre_completo})")
            continue

        perfil, error_perfil = clasificar_perfil(record.get("Perfil SAP", ""))
        if not perfil:
            msg = error_perfil or "perfil sin valor correspondiente"
            omitidos_perfil.append(f"{rut} ({nombre_completo}): {msg}")
            continue

        firstname, lastname = separar_nombre_completo(nombre_completo)
        fila = {
            "username": rut,
            "password": rut,
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "address": rut,
            "city": EMPRESA,
        }
        _asignar_cursos_por_perfil(fila, perfil)

        ruts_vistos.add(rut)
        filas_procesadas.append(fila)

    fieldnames: list[str] = []
    for fila in filas_procesadas:
        for key in fila:
            if key not in fieldnames:
                fieldnames.append(key)

    preview_rows = [[fila.get(col, "") for col in fieldnames] for fila in filas_procesadas[:15]]

    return {
        "headers": fieldnames,
        "rows": filas_procesadas,
        "preview_rows": preview_rows,
        "total": len(filas_procesadas),
        "warnings": {
            "omitidos_perfil": omitidos_perfil,
            "omitidos_duplicado": omitidos_duplicado,
            "rut_dudoso": rut_dudoso,
        },
    }


def procesar_archivo(ruta: Path | str) -> dict[str, Any]:
    return procesar_registros(parse_registros_desde_archivo(ruta))


def procesar_texto(texto: str) -> dict[str, Any]:
    return procesar_registros(parse_registros_desde_texto(texto))


def _load_counter_data() -> dict[str, int]:
    if not COUNTER_FILE.is_file():
        return {}
    try:
        return json.loads(COUNTER_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_counter_data(data: dict[str, int]) -> None:
    COUNTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    COUNTER_FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def obtener_nombre_salida() -> str:
    fecha = datetime.now().strftime("%d-%m-%Y")
    base = f"Resiter_script_{fecha}"
    data = _load_counter_data()
    n = int(data.get(fecha, 0))
    data[fecha] = n + 1
    _save_counter_data(data)
    if n == 0:
        return f"{base}.csv"
    return f"{base}_v{n}.csv"


def generar_csv_bytes(resultado: dict[str, Any]) -> tuple[bytes, str]:
    filas = resultado["rows"]
    if not filas:
        raise ValueError("No hay colaboradores válidos para generar el CSV.")
    fieldnames = resultado["headers"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, delimiter=";", extrasaction="ignore")
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)
    return buf.getvalue().encode("utf-8-sig"), obtener_nombre_salida()
