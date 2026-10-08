"""Parser y generación CSV para generador Transelec (altas + matriz)."""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl

EMAIL_TRANSELEC_REGEX = re.compile(r"[\w.+-]+@transelec\.cl", re.IGNORECASE)
EMAIL_ANY_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)
EMAIL_GENERIC_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)
# RUT chileno: 1.234.567-8 / 12345678-9 / 123456789
RUT_REGEX = re.compile(
    r"\b(\d{1,2}(?:\.\d{3}){2}-[\dkK]|\d{7,8}-[\dkK]|\d{7,8}[\dkK])\b"
)
PARTICULAS_APELLIDO = {"de", "del", "la", "las", "los", "y", "san", "santa", "von", "van"}

ETIQUETAS_ALTAS = {
    "nombre": "Nombre",
    "rut": "Rut",
    "area": "Area",
    "cargo": "Cargo",
    "fecha inicio contractual": "Fecha inicio contractual",
    "centro de costo- oi": "Centro de Costo- OI",
    "tipo de contrato": "Tipo de Contrato",
    "ubicacion": "Ubicación",
    "ubicación": "Ubicación",
    "requerimientos tecnologicos": "Requerimientos Tecnológicos",
    "requerimientos tecnológicos": "Requerimientos Tecnológicos",
    "elementos de proteccion personal": "Elementos de Protección Personal",
    "elementos de protección personal": "Elementos de Protección Personal",
    "jefatura directa": "Jefatura directa",
    "jornada de trabajo": "Jornada de Trabajo",
}

# Alias → clave canónica (para pegados de correo/ticket con variantes)
ALIAS_ETIQUETAS: dict[str, str] = {
    "nombre": "nombre",
    "nombres": "nombre",
    "nombre completo": "nombre",
    "nombre y apellido": "nombre",
    "nombres y apellidos": "nombre",
    "nombre trabajador": "nombre",
    "nombre colaborador": "nombre",
    "apellido": "apellido",
    "apellidos": "apellido",
    "rut": "rut",
    "r.u.t": "rut",
    "r.u.t.": "rut",
    "run": "rut",
    "cedula": "rut",
    "cédula": "rut",
    "documento": "rut",
    "correo": "email",
    "correo electronico": "email",
    "correo electrónico": "email",
    "email": "email",
    "e-mail": "email",
    "mail": "email",
    "user": "email",
    # "usuario" solo si el valor parece correo (ver _asignar_campo);
    # "USUARIO Transelec ***" no debe pisar el email real.
    "usuario": "email",
    "cuenta": "email",
    "area": "area",
    "área": "area",
    "cargo": "cargo",
    "puesto": "cargo",
    "fecha inicio contractual": "fecha inicio contractual",
    "fecha de inicio": "fecha inicio contractual",
    "fecha inicio": "fecha inicio contractual",
    "fecha ingreso": "fecha inicio contractual",
    "fecha de ingreso": "fecha inicio contractual",
    "centro de costo- oi": "centro de costo- oi",
    "centro de costo": "centro de costo- oi",
    "centro de costo oi": "centro de costo- oi",
    "tipo de contrato": "tipo de contrato",
    "ubicacion": "ubicacion",
    "ubicación": "ubicacion",
    "requerimientos tecnologicos": "requerimientos tecnologicos",
    "requerimientos tecnológicos": "requerimientos tecnologicos",
    "elementos de proteccion personal": "elementos de proteccion personal",
    "elementos de protección personal": "elementos de proteccion personal",
    "jefatura directa": "jefatura directa",
    "jefe": "jefatura directa",
    "jornada de trabajo": "jornada de trabajo",
    "jornada": "jornada de trabajo",
}

ETIQUETAS_OBLIGATORIAS = {"nombre", "rut"}

_SEP_MISMA_LINEA = re.compile(r"\s*[:;=\|\t]\s*")
_SOLO_ETIQUETA = re.compile(r"^[\wÁÉÍÓÚáéíóúÑñ ./\-]{2,60}$")


def limpiar_rut(rut_raw: str) -> str:
    return str(rut_raw).replace(".", "").replace(" ", "").strip().upper()


def formatear_palabra_nombre(palabra: str) -> str:
    palabra = palabra.strip()
    if not palabra:
        return palabra
    if len(palabra) <= 3 and palabra.endswith("."):
        return palabra[0].upper() + palabra[1:].lower()
    if "-" in palabra:
        return "-".join(formatear_palabra_nombre(p) for p in palabra.split("-"))
    return palabra[0].upper() + palabra[1:].lower()


def formatear_nombre_partes(partes: list[str]) -> str:
    resultado = []
    for i, parte in enumerate(partes):
        fmt = formatear_palabra_nombre(parte)
        if i > 0 and parte.lower() in PARTICULAS_APELLIDO:
            fmt = parte.lower()
        resultado.append(fmt)
    return " ".join(resultado)


def sugerir_nombre_apellido(nombre_completo: str) -> tuple[str, str]:
    partes = str(nombre_completo).strip().split()
    if not partes:
        return "", ""
    if len(partes) == 1:
        return formatear_nombre_partes(partes), ""
    if len(partes) == 2:
        return formatear_nombre_partes([partes[0]]), formatear_nombre_partes([partes[1]])
    if len(partes) == 3:
        return formatear_nombre_partes([partes[0]]), formatear_nombre_partes(partes[1:])
    nombres = formatear_nombre_partes(partes[:2])
    apellidos = formatear_nombre_partes(partes[2:])
    return nombres, apellidos


def separar_nombre_mayusculas(nombre_completo: str) -> tuple[str, str]:
    nombre_limpio = str(nombre_completo).strip().upper()
    partes = nombre_limpio.split()
    if len(partes) <= 1:
        return nombre_limpio, ""
    if len(partes) == 2:
        return partes[0], partes[1]
    if len(partes) == 3:
        return partes[0], f"{partes[1]} {partes[2]}"
    return f"{partes[0]} {partes[1]}", " ".join(partes[2:])


def _texto_sin_caracteres_rotos(texto: str) -> bool:
    return "\ufffd" not in texto


def leer_lineas_archivo(ruta: Path | str) -> list[str]:
    ruta = Path(ruta)
    if ruta.suffix.lower() == ".csv":
        lineas_respaldo = None
        for encoding in ("utf-8-sig", "cp1252", "latin1", "utf-8"):
            try:
                with open(ruta, encoding=encoding) as archivo:
                    lineas = [linea.rstrip("\n\r") for linea in archivo.readlines()]
                if _texto_sin_caracteres_rotos("".join(lineas)):
                    return lineas
                if lineas_respaldo is None:
                    lineas_respaldo = lineas
            except UnicodeDecodeError:
                continue
        if lineas_respaldo is not None:
            return lineas_respaldo
        raise ValueError("No se pudo leer el CSV con las codificaciones habituales.")

    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    try:
        sheet = wb.active
        lineas = []
        for row in sheet.iter_rows(values_only=True):
            for valor in row:
                if valor is not None and str(valor).strip():
                    lineas.append(str(valor).strip())
    finally:
        wb.close()
    return lineas


def extraer_email(texto: str) -> str:
    """Prioriza @transelec.cl; si no hay, el primer correo válido del texto."""
    coincidencia = EMAIL_TRANSELEC_REGEX.search(texto or "")
    if coincidencia:
        return coincidencia.group(0).lower()
    generico = EMAIL_ANY_REGEX.search(texto or "")
    return generico.group(0).lower() if generico else ""


def extraer_rut_texto(texto: str) -> str:
    coincidencia = RUT_REGEX.search(texto or "")
    return coincidencia.group(1) if coincidencia else ""


def _normalizar_clave_etiqueta(texto: str) -> str:
    limpia = (
        str(texto or "")
        .strip()
        .lower()
        .replace("\xa0", " ")
        .replace("_", " ")
    )
    limpia = re.sub(r"\s+", " ", limpia)
    limpia = limpia.rstrip(":.;")
    return limpia


def _resolver_etiqueta(texto: str) -> str | None:
    limpia = _normalizar_clave_etiqueta(texto)
    if not limpia:
        return None
    if limpia in ALIAS_ETIQUETAS:
        return ALIAS_ETIQUETAS[limpia]
    # Quitar artículos iniciales (“el rut”, “el nombre”)
    for prefijo in ("el ", "la ", "los ", "las "):
        if limpia.startswith(prefijo):
            cand = limpia[len(prefijo) :]
            if cand in ALIAS_ETIQUETAS:
                return ALIAS_ETIQUETAS[cand]
    return None


def extraer_campo_etiqueta_lineas(lineas: list[str], etiqueta: str) -> str:
    etiqueta_lower = etiqueta.strip().lower()
    for linea in lineas:
        if ";" not in linea:
            continue
        clave, _, valor = linea.partition(";")
        if clave.strip().lower() == etiqueta_lower:
            return valor.strip()
    return ""


def _normalizar_etiqueta_linea(linea: str) -> str | None:
    """Compat: etiqueta sola en la línea (sin valor)."""
    return _resolver_etiqueta(linea)


def _partir_etiqueta_valor(linea: str) -> tuple[str | None, str]:
    """Detecta 'Etiqueta: valor', 'Etiqueta;valor', 'Etiqueta = valor', tab, etc."""
    linea = linea.strip()
    if not linea:
        return None, ""

    # Separadores explícitos
    for sep in (";", ":", "=", "|", "\t"):
        if sep in linea:
            izquierda, _, derecha = linea.partition(sep)
            key = _resolver_etiqueta(izquierda)
            if key and derecha.strip():
                return key, derecha.strip()
            # Si la izquierda es etiqueta pero el valor viene vacío, se trata en el bucle
            if key and not derecha.strip():
                return key, ""

    # "Nombre Juan Pérez" (etiqueta + valor sin separador) solo si la 1ª palabra es alias corto
    partes = linea.split(None, 1)
    if len(partes) == 2:
        key = _resolver_etiqueta(partes[0])
        if key and key in ("nombre", "rut", "email", "cargo", "area"):
            # Evitar falsos positivos tipo "Nombre de la empresa XYZ..."
            if key == "nombre" and partes[1].lower().startswith(("de la ", "de el ", "del ")):
                pass
            elif key == "email" and "@" not in partes[1]:
                # "USUARIO Transelec ***" no es un correo
                pass
            else:
                return key, partes[1].strip()

    # Línea que es solo etiqueta
    if _SOLO_ETIQUETA.match(linea) and _resolver_etiqueta(linea):
        return _resolver_etiqueta(linea), ""

    return None, ""


def _limpiar_valor_campo(key: str, valor: str) -> str:
    valor = valor.strip().strip('"').strip("'")
    valor = re.sub(r"\s+", " ", valor)
    # Cortar coletillas típicas al pegar un párrafo
    valor = re.split(
        r"(?i)\b(?:gracias|saludos|atte|atentamente|favor(?:\s+crear)?)\b",
        valor,
        maxsplit=1,
    )[0].strip(" .,-;")
    if key == "email":
        mail = extraer_email(valor)
        # Rechazar valores tipo "Transelec ***" que no son correo
        return mail
    if key == "rut":
        encontrado = extraer_rut_texto(valor)
        return encontrado or valor
    return valor


def _es_email_usable(valor: str) -> bool:
    v = (valor or "").strip().lower()
    return bool(v) and "@" in v and EMAIL_ANY_REGEX.fullmatch(v) is not None


def _asignar_campo(campos: dict[str, str], key: str, valor: str) -> None:
    limpio = _limpiar_valor_campo(key, valor)
    if not limpio:
        return
    if key == "email":
        if not _es_email_usable(limpio):
            return
        # No pisar un @transelec.cl ya detectado con otro correo genérico
        actual = campos.get("email", "")
        if actual.endswith("@transelec.cl") and not limpio.endswith("@transelec.cl"):
            return
        campos["email"] = limpio
        return
    # Primera asignación gana salvo que el nuevo aporte más información
    if key not in campos or not campos[key]:
        campos[key] = limpio
    elif key == "nombre" and len(limpio) > len(campos[key]):
        campos[key] = limpio


def _parece_ruido_correo(linea: str) -> bool:
    baja = linea.lower()
    ruido = (
        "de:",
        "from:",
        "enviado:",
        "sent:",
        "para:",
        "to:",
        "cc:",
        "asunto:",
        "subject:",
        "-----original",
        "confidential",
        "http://",
        "https://",
    )
    return any(baja.startswith(r) or r in baja[:40] for r in ruido[:8]) or any(
        r in baja for r in ruido[8:]
    )


def _preprocesar_lineas_pegado(lineas: list[str]) -> list[str]:
    """Separa etiquetas pegadas en el mismo párrafo (común al copiar desde correo)."""
    alias_pat = "|".join(
        re.escape(a) for a in sorted(ALIAS_ETIQUETAS.keys(), key=len, reverse=True)
    )
    splitter = re.compile(
        rf"(?i)(?<![A-Za-zÁÉÍÓÚáéíóúÑñ])({alias_pat})\s*([:;=\|\t])\s*"
    )
    out: list[str] = []
    for linea in lineas:
        if not linea.strip():
            out.append(linea)
            continue
        # Insertar saltos antes de cada "Etiqueta:" dentro de la línea
        partes = splitter.split(linea)
        if len(partes) == 1:
            out.append(linea)
            continue
        # split → [antes, etiqueta, sep, valor, etiqueta, sep, valor, ...]
        if partes[0].strip():
            out.append(partes[0].strip())
        i = 1
        while i + 2 < len(partes):
            etiqueta, sep, resto = partes[i], partes[i + 1], partes[i + 2]
            # resto puede incluir texto hasta la siguiente etiqueta (ya cortado por split)
            out.append(f"{etiqueta}{sep} {resto.strip()}")
            i += 3
        if i < len(partes) and str(partes[i]).strip():
            out.append(str(partes[i]).strip())
    return out


def extraer_campos_desde_lineas(lineas: list[str]) -> dict[str, str]:
    campos: dict[str, str] = {}
    # Normalizar espacios raros de Outlook / Word
    lineas_norm = [
        str(ln).replace("\xa0", " ").replace("\u200b", "").strip()
        for ln in lineas
    ]
    lineas_norm = _preprocesar_lineas_pegado(lineas_norm)
    texto_completo = "\n".join(lineas_norm)
    email_global = extraer_email(texto_completo)
    if email_global:
        campos["email"] = email_global

    i = 0
    while i < len(lineas_norm):
        linea = lineas_norm[i]
        if not linea:
            i += 1
            continue

        key, valor = _partir_etiqueta_valor(linea)
        if key:
            if valor:
                _asignar_campo(campos, key, valor)
                i += 1
                continue

            # Etiqueta sola → tomar siguientes líneas hasta la próxima etiqueta
            valores: list[str] = []
            j = i + 1
            while j < len(lineas_norm):
                siguiente = lineas_norm[j]
                if not siguiente:
                    if valores:
                        break
                    j += 1
                    continue
                if _parece_ruido_correo(siguiente):
                    break
                next_key, next_val = _partir_etiqueta_valor(siguiente)
                if next_key is not None:
                    # Si la siguiente línea ya trae etiqueta+valor, no la consumimos aquí
                    break
                if EMAIL_ANY_REGEX.fullmatch(siguiente) and key != "email":
                    break
                if key != "rut" and RUT_REGEX.fullmatch(siguiente.replace(" ", "")):
                    # RUT suelto: si buscábamos nombre, no lo mezclar
                    if key == "nombre":
                        break
                valores.append(siguiente)
                j += 1
                # Nombre/RUT suelen ser una sola línea de valor
                if key in ("nombre", "rut", "email", "apellido"):
                    break
            if valores:
                _asignar_campo(campos, key, " ".join(valores))
            i = j
            continue

        i += 1

    # Fallbacks si faltan campos clave
    if not campos.get("nombre"):
        campos["nombre"] = extraer_campo_etiqueta_lineas(lineas_norm, "Nombre")
    if not campos.get("nombre"):
        m = re.search(
            r"(?i)\b(?:nombre(?:\s+completo)?|nombres(?:\s+y\s+apellidos)?)\s*[:\-–]\s*([^\n\r|;]+)",
            texto_completo,
        )
        if m:
            campos["nombre"] = m.group(1).strip()
    if not campos.get("rut"):
        campos["rut"] = extraer_campo_etiqueta_lineas(lineas_norm, "Rut") or extraer_rut_texto(
            texto_completo
        )
    # Siempre preferir un correo real del texto completo si el campo quedó inválido
    if not _es_email_usable(campos.get("email", "")):
        campos["email"] = extraer_email(texto_completo)
    elif email_global and email_global.endswith("@transelec.cl"):
        campos["email"] = email_global

    # Unir apellido suelto al nombre si vino separado
    if campos.get("apellido") and campos.get("nombre"):
        if campos["apellido"].lower() not in campos["nombre"].lower():
            campos["nombre"] = f"{campos['nombre']} {campos['apellido']}".strip()

    return campos


def parsear_solicitud_altas(
    *,
    texto: str | None = None,
    ruta_archivo: Path | str | None = None,
) -> dict[str, Any]:
    if texto:
        # Unificar saltos y líneas “pegadas” por soft-breaks de correo
        crudo = texto.replace("\r\n", "\n").replace("\r", "\n")
        lineas = [ln.rstrip() for ln in crudo.split("\n")]
    elif ruta_archivo:
        lineas = leer_lineas_archivo(ruta_archivo)
    else:
        raise ValueError("Indica texto o archivo.")

    campos = extraer_campos_desde_lineas(lineas)
    nombre = campos.get("nombre", "").strip()
    rut = campos.get("rut", "").strip()
    email = campos.get("email", "").strip().lower()
    firstname, lastname = sugerir_nombre_apellido(nombre)

    extras = {}
    for k, v in campos.items():
        if k in ("nombre", "rut", "email", "apellido") or not v:
            continue
        label = ETIQUETAS_ALTAS.get(k)
        if label:
            extras[label] = v

    return {
        "email": email,
        "nombre_completo": nombre,
        "rut": rut,
        "firstname": firstname,
        "lastname": lastname,
        "campos_extra": extras,
        "email_es_transelec": bool(email) and email.endswith("@transelec.cl"),
    }


def es_email_valido_matriz(email: str) -> bool:
    if not email or email.lower() == "nan":
        return False
    return bool(EMAIL_GENERIC_REGEX.match(email))


def esta_marcado(valor: Any) -> bool:
    return str(valor).strip().upper() == "X"


def _leer_filas_matriz(ruta: Path | str) -> list[list[str]]:
    ruta = Path(ruta)
    filas: list[list[str]] = []
    if ruta.suffix.lower() == ".csv":
        for encoding in ("utf-8-sig", "cp1252", "latin1", "utf-8"):
            try:
                with open(ruta, encoding=encoding, newline="") as f:
                    reader = csv.reader(f, delimiter=";")
                    for row in reader:
                        filas.append([str(c).strip() if c else "" for c in row])
                return filas
            except UnicodeDecodeError:
                continue
        raise ValueError("No se pudo leer el CSV.")
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    try:
        sheet = wb.active
        for row in sheet.iter_rows(values_only=True):
            filas.append([str(c).strip() if c is not None else "" for c in row])
    finally:
        wb.close()
    return filas


def procesar_matriz(ruta: Path | str) -> dict[str, Any]:
    filas_raw = _leer_filas_matriz(ruta)
    fecha_hoy = datetime.today().strftime("%d-%m-%Y")
    nombre_grupo = f"Grupo {fecha_hoy}"

    filas_procesadas: list[dict[str, str]] = []
    ruts_vistos: dict[str, str] = {}  # rut -> etiqueta primera aparición
    emails_invalidos: list[str] = []
    omitidos_sin_x: list[str] = []
    omitidos_duplicado: list[str] = []

    for row in filas_raw:
        while len(row) < 6:
            row.append("")

        nombre_completo = row[0].strip()
        rut_raw = row[1].strip()
        if rut_raw.lower() in ("nan", "", "rut", "none") or not nombre_completo:
            continue

        email = row[2].strip()
        if email.lower() == "nan":
            email = ""

        col_sub = row[3]
        col_lineas = row[4]
        col_ambas = row[5]
        rut_limpio = limpiar_rut(rut_raw)
        firstname, lastname = separar_nombre_mayusculas(nombre_completo)

        fila: dict[str, str] = {
            "username": rut_limpio,
            "password": rut_limpio,
            "firstname": firstname.upper(),
            "lastname": lastname.upper(),
            "email": email,
            "address": rut_limpio,
            "auth": "manual",
            "institution": "TRANSELEC",
        }

        if esta_marcado(col_ambas):
            fila["course1"] = "Subestaciones"
            fila["group1"] = nombre_grupo
            fila["course2"] = "Líneas de transmisión"
            fila["group2"] = nombre_grupo
        elif esta_marcado(col_lineas):
            fila["course1"] = "Líneas de transmisión"
            fila["group1"] = nombre_grupo
        elif esta_marcado(col_sub):
            fila["course1"] = "Subestaciones"
            fila["group1"] = nombre_grupo
        else:
            omitidos_sin_x.append(f"{nombre_completo} ({rut_limpio})")
            continue

        if rut_limpio in ruts_vistos:
            previo = ruts_vistos[rut_limpio]
            omitidos_duplicado.append(
                f"{nombre_completo} ({rut_limpio}) — RUT repetido; ya estaba: {previo}"
            )
            continue

        if not es_email_valido_matriz(email):
            emails_invalidos.append(f"{nombre_completo} ({rut_limpio}): {email or '(vacío)'}")

        ruts_vistos[rut_limpio] = f"{nombre_completo} / {email or 'sin correo'}"
        filas_procesadas.append(fila)

    cols_order = [
        "username", "password", "firstname", "lastname", "email", "address",
        "auth", "institution", "course1", "group1", "course2", "group2",
    ]
    headers = cols_order
    preview_rows = []
    for fila in filas_procesadas[:15]:
        preview_rows.append([fila.get(c, "") for c in cols_order])

    return {
        "nombre_grupo": nombre_grupo,
        "headers": headers,
        "rows": filas_procesadas,
        "preview_rows": preview_rows,
        "total": len(filas_procesadas),
        "warnings": {
            "emails_invalidos": emails_invalidos,
            "omitidos_sin_x": omitidos_sin_x,
            "omitidos_duplicado": omitidos_duplicado,
        },
    }


def construir_fila_alta(datos: dict[str, str]) -> dict[str, str]:
    rut_limpio = limpiar_rut(datos["rut"])
    email = datos["email"].strip().lower()
    return {
        "username": email,
        "password": rut_limpio,
        "address": rut_limpio,
        "firstname": datos["firstname"].strip(),
        "lastname": datos["lastname"].strip(),
        "auth": "saml2",
        "idnumber": rut_limpio,
        "email": email,
        "suspended": "0",
        "institution": "TRANSELEC",
    }


def csv_bytes_desde_filas(
    filas: list[dict[str, str]],
    columnas_base: list[str],
    num_cursos: int = 0,
) -> bytes:
    columnas_cursos = []
    for i in range(1, num_cursos + 1):
        columnas_cursos.extend([f"course{i}", f"group{i}"])
    fieldnames = columnas_base + columnas_cursos

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, delimiter=";", extrasaction="ignore")
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)
    return buf.getvalue().encode("utf-8-sig")


def generar_csv_alta_bytes(datos: dict[str, str]) -> tuple[bytes, str]:
    """CSV de alta de usuario (sin columnas courseX / groupX)."""
    fila = construir_fila_alta(datos)
    columnas_base = [
        "username", "password", "address", "firstname", "lastname",
        "auth", "idnumber", "email", "suspended", "institution",
    ]
    content = csv_bytes_desde_filas([fila], columnas_base, num_cursos=0)
    fecha_str = datetime.today().strftime("%d-%m-%y")
    filename = f"Script_altas - {fecha_str}.csv"
    return content, filename


def generar_csv_matriz_bytes(resultado: dict[str, Any]) -> tuple[bytes, str]:
    filas = resultado["rows"]
    cols_order = resultado["headers"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=cols_order, delimiter=";", extrasaction="ignore")
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)
    nombre_grupo = resultado["nombre_grupo"].replace(" ", "_")
    filename = f"Script_{nombre_grupo}.csv"
    return buf.getvalue().encode("utf-8-sig"), filename
