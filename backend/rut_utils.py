"""Utilidades RUT chileno: dígito verificador y validación."""
from __future__ import annotations

import re
from typing import Any


def calcular_dv(cuerpo: str) -> str:
    """Módulo 11: retorna '0'-'9' o 'K'."""
    cuerpo = re.sub(r"\D", "", str(cuerpo or ""))
    if not cuerpo:
        raise ValueError("Cuerpo de RUT vacío")
    s = 0
    m = 2
    for d in reversed(cuerpo):
        s += int(d) * m
        m = 2 if m == 7 else m + 1
    r = 11 - (s % 11)
    if r == 11:
        return "0"
    if r == 10:
        return "K"
    return str(r)


def limpiar_entrada(rut: str) -> str:
    return (
        str(rut or "")
        .strip()
        .replace("'", "")
        .replace('"', "")
        .replace(" ", "")
        .upper()
    )


def extraer_cuerpo_dv(rut: str, *, generar_dv: bool) -> tuple[str, str | None, str]:
    """
    Devuelve (cuerpo, dv_o_None, modo).
    modo: 'completo' | 'sin_dv' | 'invalido'
    """
    raw = limpiar_entrada(rut)
    if not raw:
        return "", None, "invalido"

    if "-" in raw:
        partes = raw.split("-")
        if len(partes) != 2:
            return raw, None, "invalido"
        cuerpo = partes[0].replace(".", "")
        dv = partes[1].replace(".", "")
        if not cuerpo.isdigit() or not dv or len(dv) != 1:
            return cuerpo, dv or None, "invalido"
        return cuerpo, dv.upper(), "completo"

    solo = raw.replace(".", "")
    if not solo:
        return "", None, "invalido"

    # Listado sin dígito: todo el número es el cuerpo
    if generar_dv:
        if not solo.isdigit():
            # Permite terminar en K por error de pegado → quitar y recalcular
            if solo[-1] == "K" and solo[:-1].isdigit():
                return solo[:-1], None, "sin_dv"
            return solo, None, "invalido"
        return solo, None, "sin_dv"

    # Con DV implícito (último carácter)
    if len(solo) < 2:
        return solo, None, "invalido"
    cuerpo, dv = solo[:-1], solo[-1]
    if not cuerpo.isdigit():
        return cuerpo, dv, "invalido"
    if not (dv.isdigit() or dv == "K"):
        return cuerpo, dv, "invalido"
    return cuerpo, dv, "completo"


def validar_rut(cuerpo: str, dv: str) -> bool:
    try:
        return calcular_dv(cuerpo).upper() == str(dv).upper()
    except ValueError:
        return False


def formatear_rut(cuerpo: str, dv: str, formato: str, k_minuscula: bool) -> str:
    dv_out = dv
    if k_minuscula and dv_out.upper() == "K":
        dv_out = "k"
    elif dv_out.upper() == "K":
        dv_out = "K"
    else:
        dv_out = str(dv_out)

    if formato == "Sin Puntos y Con Guión":
        return f"{cuerpo}-{dv_out}"
    if formato == "Sin Puntos y Sin Guión":
        return f"{cuerpo}{dv_out}"
    # Formato Original (Normalizado) = con puntos y guión
    try:
        cuerpo_puntos = f"{int(cuerpo):,}".replace(",", ".")
    except ValueError:
        cuerpo_puntos = cuerpo
    return f"{cuerpo_puntos}-{dv_out}"


def normalizar_lista(
    ruts: str,
    *,
    formato: str,
    k_minuscula: bool,
    generar_dv: bool = False,
    validar: bool = True,
) -> dict[str, Any]:
    texto = str(ruts or "").replace("\r", "")
    lista = [r.strip() for r in texto.split("\n") if r.strip()]

    resultados: list[str] = []
    validos = 0
    invalidos = 0
    dv_generados = 0
    detalle_invalidos: list[str] = []

    for original in lista:
        cuerpo, dv, modo = extraer_cuerpo_dv(original, generar_dv=generar_dv)

        if modo == "invalido" or not cuerpo or not cuerpo.isdigit():
            invalidos += 1
            detalle_invalidos.append(original)
            resultados.append(f"{original}  # INVÁLIDO")
            continue

        if modo == "sin_dv" or dv is None:
            try:
                dv = calcular_dv(cuerpo)
                dv_generados += 1
            except ValueError:
                invalidos += 1
                detalle_invalidos.append(original)
                resultados.append(f"{original}  # INVÁLIDO")
                continue
            es_valido = True
        else:
            es_valido = validar_rut(cuerpo, dv) if validar else True
            if validar and not es_valido:
                invalidos += 1
                detalle_invalidos.append(original)
                # Aun así devolvemos formateado + marca para que vean el problema
                resultados.append(
                    f"{formatear_rut(cuerpo, dv, formato, k_minuscula)}  # INVÁLIDO (DV no coincide)"
                )
                continue

        validos += 1
        resultados.append(formatear_rut(cuerpo, dv, formato, k_minuscula))

    return {
        "ruts": "\n".join(resultados),
        "total": len(resultados),
        "validos": validos,
        "invalidos": invalidos,
        "dv_generados": dv_generados,
        "invalidos_lista": detalle_invalidos,
    }
