"""Generador de CSV de altas AZA (formato Moodle / ALTAS_AZA)."""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from typing import Any

CSV_HEADERS = [
    "address",
    "firstname",
    "lastname",
    "email",
    "empresa",
    "malla",
    "tipousuario",
    "firstnamephonetic",
    "lastnamephonetic",
    "username",
    "auth",
    "password",
    "suspended",
]

AUTH_DEFAULT = "saml2"
SUSPENDED_DEFAULT = "0"


def formatear_rut_con_puntos(rut_raw: str) -> str:
    """20536828-0 → 20.536.828-0 (address / password AZA)."""
    limpio = str(rut_raw or "").replace(".", "").replace(" ", "").strip().upper()
    if not limpio:
        return ""
    if "-" in limpio:
        cuerpo, dv = limpio.rsplit("-", 1)
    else:
        cuerpo, dv = limpio[:-1], limpio[-1]
    cuerpo = re.sub(r"\D", "", cuerpo)
    if not cuerpo or not dv:
        raise ValueError("RUT inválido")
    grupos: list[str] = []
    while len(cuerpo) > 3:
        grupos.insert(0, cuerpo[-3:])
        cuerpo = cuerpo[:-3]
    if cuerpo:
        grupos.insert(0, cuerpo)
    return f"{'.'.join(grupos)}-{dv}"


def separar_nombre(nombre_completo: str) -> tuple[str, str]:
    """
    'Bastián Ovalle Ortiz' → ('Bastián', 'Ovalle Ortiz')
    Primera palabra = firstname; el resto = lastname.
    """
    partes = str(nombre_completo or "").strip().split()
    if not partes:
        return "", ""
    if len(partes) == 1:
        return partes[0], ""
    return partes[0], " ".join(partes[1:])


def construir_fila(
    *,
    nombre: str,
    rut: str,
    correo: str,
    empresa: str,
    malla: str,
    tipousuario: str,
    firstname: str | None = None,
    lastname: str | None = None,
) -> dict[str, str]:
    email = str(correo or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("Correo inválido")
    empresa_v = str(empresa or "").strip()
    malla_v = str(malla or "").strip()
    tipo_v = str(tipousuario or "").strip()
    if not empresa_v:
        raise ValueError("Empresa es obligatoria (relleno manual)")
    if not malla_v:
        raise ValueError("Malla es obligatoria (relleno manual)")
    if not tipo_v:
        raise ValueError("Tipo de usuario es obligatorio (relleno manual)")

    address = formatear_rut_con_puntos(rut)
    if firstname is not None and str(firstname).strip():
        fn = str(firstname).strip()
        ln = str(lastname or "").strip()
    else:
        fn, ln = separar_nombre(nombre)
    if not fn:
        raise ValueError("Nombre / firstname obligatorio")

    return {
        "address": address,
        "firstname": fn,
        "lastname": ln,
        "email": email,
        "empresa": empresa_v,
        "malla": malla_v,
        "tipousuario": tipo_v,
        "firstnamephonetic": f"{ln}, {fn}" if ln else fn,
        "lastnamephonetic": address,
        "username": email,
        "auth": AUTH_DEFAULT,
        "password": address,
        "suspended": SUSPENDED_DEFAULT,
    }


def generar_csv_bytes(filas: list[dict[str, str]]) -> tuple[bytes, str]:
    if not filas:
        raise ValueError("No hay filas para generar")
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=CSV_HEADERS,
        delimiter=";",
        lineterminator="\n",
        extrasaction="ignore",
    )
    writer.writeheader()
    for fila in filas:
        writer.writerow({h: fila.get(h, "") for h in CSV_HEADERS})
    # UTF-8 con BOM (Excel / Moodle)
    content = ("\ufeff" + buf.getvalue()).encode("utf-8")
    year = datetime.now().strftime("%Y")
    filename = f"ALTAS_AZA_{year}.csv"
    return content, filename


def preview_transformacion(payload: dict[str, Any]) -> dict[str, Any]:
    fila = construir_fila(
        nombre=str(payload.get("nombre") or ""),
        rut=str(payload.get("rut") or ""),
        correo=str(payload.get("correo") or payload.get("email") or ""),
        empresa=str(payload.get("empresa") or ""),
        malla=str(payload.get("malla") or ""),
        tipousuario=str(payload.get("tipousuario") or ""),
        firstname=payload.get("firstname"),
        lastname=payload.get("lastname"),
    )
    return {"fila": fila, "headers": CSV_HEADERS}
