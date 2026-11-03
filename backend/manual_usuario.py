"""Manual de usuario por módulos → DOCX filtrado por permisos (vista + proceso)."""
from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

# docs/capturas en el repo, o /app/docs/capturas en Docker
_CAPTURA_CANDIDATES = [
    Path(__file__).resolve().parents[1] / "docs" / "capturas",
    Path("/app/docs/capturas"),
    Path(__file__).resolve().parent / "manual_capturas",
]


def _capturas_dir() -> Path | None:
    for p in _CAPTURA_CANDIDATES:
        if p.is_dir():
            return p
    return None


def _resolve_image(filename: str) -> Path | None:
    base = _capturas_dir()
    if not base:
        return None
    path = base / filename
    return path if path.is_file() else None


def _add_images(doc: Document, images: list[dict[str, str]], width_in: float = 5.8) -> None:
    for img in images:
        path = _resolve_image(img["file"])
        if not path:
            continue
        caption = img.get("caption") or ""
        try:
            doc.add_picture(str(path), width=Inches(width_in))
            last = doc.paragraphs[-1]
            last.alignment = WD_ALIGN_PARAGRAPH.CENTER
        except Exception:
            continue
        if caption:
            cap = doc.add_paragraph()
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = cap.add_run(caption)
            run.italic = True
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)


INTRO_SECTIONS: list[dict[str, Any]] = [
    {
        "title": "¿Qué es esta plataforma?",
        "body": [
            "Es un sitio web interno para tareas de capacitación y LMS. Se usa desde el navegador (Chrome, Edge o Firefox), sin instalar programas.",
            "En el menú izquierdo solo verás las herramientas que tu administrador te habilitó. Este manual descarga únicamente las secciones de los módulos a los que tienes acceso.",
        ],
        "images": [],
    },
    {
        "title": "Entrar a la plataforma",
        "body": [
            "Abre el enlace que te entregaron, escribe tu usuario y contraseña, y haz clic en Iniciar Sesión. Si no puedes entrar, contacta a tu administrador o a sistemas. No compartas tu clave.",
        ],
        "images": [
            {"file": "01-login.png", "caption": "Vista: inicio de sesión"},
        ],
    },
    {
        "title": "Pantalla principal",
        "body": [
            "A la izquierda está el menú Herramientas: haz clic en la opción que necesites. Abajo puedes cambiar la Apariencia (claro/oscuro), descargar este manual y Cerrar Sesión.",
        ],
        "images": [
            {"file": "02-menu-lateral.png", "caption": "Vista: menú lateral"},
        ],
    },
]

MODULE_MANUAL: dict[str, dict[str, Any]] = {
    "comparador": {
        "title": "Comparador de Datos",
        "body": [
            "Sirve para comparar dos archivos Excel y obtener un reporte con diferencias, coincidencias o ambos.",
            "Proceso: sube el Archivo Principal (tu base) y el Archivo de Contraste. Ajusta hoja, columnas o filas solo si hace falta. Elige el tipo de reporte (solo diferencias, solo coincidencias o ambos) y haz clic en Comenzar comparación. Se descargará un Excel nuevo; tus archivos originales no se modifican. Usa la misma columna clave en ambos (por ejemplo RUT o código).",
        ],
        "images": [
            {"file": "04-comparador-vista.png", "caption": "Vista del módulo Comparador de Datos"},
        ],
    },
    "rut": {
        "title": "Normalizador RUT",
        "body": [
            "Sirve para dejar una lista de RUT chilenos con el mismo formato.",
            "Proceso: pega un RUT por línea en el cuadro de la izquierda, elige el formato (con o sin puntos y guión; K en minúscula si aplica), haz clic en Normalizar y copia el resultado de la derecha.",
        ],
        "images": [
            {"file": "07-rut.png", "caption": "Vista del módulo Normalizador RUT"},
        ],
    },
    "textos": {
        "title": "Normalizador de Textos",
        "body": [
            "Sirve para transformar listas de texto a MAYÚSCULAS, minúsculas o Formato Título.",
            "Proceso: pega una línea por registro, elige el formato deseado, haz clic en Normalizar y copia el resultado.",
        ],
        "images": [
            {"file": "08-textos.png", "caption": "Vista del módulo Normalizador de Textos"},
        ],
    },
    "capacitaciones": {
        "title": "Capacitaciones Mod 1",
        "body": [
            "Sirve como agenda personal de capacitaciones (título, enlace, duración, notas y fecha). En general solo tú ves lo que guardas con tu usuario.",
            "Proceso: revisa el listado (puedes buscar). Para agregar, usa Nueva Capacitación, completa al menos el título y guarda. Para quitar una, usa el icono de papelera en esa fila.",
        ],
        "images": [
            {"file": "09-capacitaciones.png", "caption": "Vista del módulo Capacitaciones"},
        ],
    },
    "enlaces": {
        "title": "Enlaces de interés",
        "body": [
            "Sirve para guardar y organizar enlaces útiles por empresa.",
            "Proceso: filtra por empresa o busca por texto. Para agregar, indica título, URL, empresa y notas opcionales, y guarda. Desde cada tarjeta puedes abrir el enlace, editarlo o eliminarlo.",
        ],
        "images": [
            {"file": "11-enlaces.png", "caption": "Vista del módulo Enlaces de interés"},
        ],
    },
    "recordatorios": {
        "title": "Calendario y tareas",
        "body": [
            "Sirve para agendar tareas por día, marcarlas como hechas e importar varias desde Excel.",
            "Proceso: navega el mes con las flechas (naranja = pendientes, verde = completadas) y haz clic en un día para ver sus tareas. Para crear una, completa el título y, si aplica, curso, grupo, asunto, cuerpo de mail, correo de aviso y notas; luego guarda. Para importar, pega columnas Día y Tarea desde Excel y confirma en el asistente. El botón Abrir Mail Composer abre el sitio externo de BEX con los campos listos; no envía el correo desde esta plataforma.",
        ],
        "images": [
            {"file": "12-recordatorios-calendario.png", "caption": "Vista del módulo Calendario y tareas"},
        ],
    },
    "consulta_cursos": {
        "title": "Reporte Consulta Cursos",
        "body": [
            "Sirve para convertir el texto de una consulta de cursos de Moodle en un Excel ordenado.",
            "Proceso: pega el texto completo de la consulta, usa Previsualizar para revisar totales, elige si quieres varias hojas (una por curso) o una sola hoja, y descarga el Excel.",
        ],
        "images": [
            {"file": "21-consulta-cursos.png", "caption": "Vista del módulo Reporte Consulta Cursos"},
        ],
    },
    "usuarios_duplicados": {
        "title": "Usuarios Duplicados",
        "body": [
            "Sirve para analizar un Excel de nómina o usuarios y detectar grupos duplicados (por ejemplo mismo RUT o correo).",
            "Proceso: sube el archivo Excel, haz clic en Analizar, revisa los grupos encontrados y descarga o copia los resultados. En la misma pantalla queda un historial de análisis previos.",
        ],
        "images": [
            {"file": "22-usuarios-duplicados.png", "caption": "Vista del módulo Usuarios Duplicados"},
        ],
    },
    "compresor_video": {
        "title": "Compresor MP4",
        "body": [
            "Sirve para comprimir videos MP4 y generar un ZIP (reproductor + video) listo para subir a Moodle.",
            "Proceso: elige resolución (720p o 480p) y calidad (Normal o Más compacto; Más compacto se recomienda para videos de una hora o más). Agrega los videos, haz clic en Optimizar e indica LMS e ID de curso. Cuando termine el proceso, usa Descargar ZIP. En servidor, usa siempre el botón de descarga de la interfaz.",
        ],
        "images": [
            {"file": "23-compresor-videos.png", "caption": "Vista del módulo Compresor MP4"},
        ],
    },
    "evaluaciones_moodle": {
        "title": "Evaluaciones Moodle",
        "body": [
            "Sirve para preparar evaluaciones para importar o documentar en Moodle.",
            "Proceso: pega o carga el borrador (texto, GIFT .txt o Word .docx). Usa Ordenar para limpiar el contenido. Convierte a GIFT (con o sin negrita) para importar a Moodle, o exporta a Word. Si cargas un Word, puedes marcar la alternativa correcta y descargar el archivo modificado. Flujo habitual: pegar → ordenar → convertir a GIFT → descargar.",
        ],
        "images": [
            {"file": "24-evaluaciones-moodle.png", "caption": "Vista del módulo Evaluaciones Moodle"},
        ],
    },
    "analisis_resultados": {
        "title": "Análisis de Resultados",
        "body": [
            "Sirve para analizar el informe de respuestas de un quiz Moodle a partir de un solo Excel.",
            "Proceso: sube el Excel exportado desde Moodle (debe traer enunciado, respuesta del usuario y respuesta correcta por pregunta). Usa Previsualizar para ver porcentaje de acierto y preguntas difíciles. Luego descarga el Excel con las hojas Resumen, Por pregunta, Por usuario y Detalle de respuestas. Se considera acierto si la respuesta coincide con la correcta; si alguien rindió varias veces, aparecen todos los intentos.",
        ],
        "images": [
            {"file": "25-analisis-resultados.png", "caption": "Vista del módulo Análisis de Resultados"},
        ],
    },
    "generador": {
        "title": "Generador de Nóminas / Cargas",
        "body": [
            "Sirve para generar cargas o comparaciones según el cliente. Entra a Generador de Nóminas, elige el cliente y el proceso.",
            "Proceso BEX (cargas e inducciones): sube el Excel de dotación con títulos en la primera fila; elige hoja y columnas (puedes usar Recomendadas Moodle); mapea columnas, nombre de grupo y la columna de perfil de inducción (debe coincidir con los perfiles de la plataforma); previsualiza y genera el ZIP con un CSV por perfil para Moodle.",
            "Otros clientes: Transelec (altas, externos, asignación), AZA (comparar nóminas), Resiter (CSV desde matriz SAP), Carozzi (comparar DNI/C.I., Todos Chile, separar cursos) y EMIN (comparar nóminas y consolidar cambios). Cada uno sigue un asistente similar: subir archivo, revisar opciones y descargar el resultado. Si un cliente aparece como no disponible, aún no tiene proceso activo en tu instalación.",
        ],
        "images": [
            {"file": "15-generador-paso1.png", "caption": "Vista del módulo Generador de Nóminas"},
        ],
    },
}

ADMIN_SECTION: dict[str, Any] = {
    "title": "Panel de Administrador (solo si aplica a tu usuario)",
    "body": [
        "Si eres superadministrador verás Panel de Administrador.",
        "Proceso: crea o edita usuarios, asigna solo los módulos que cada persona necesita y, según la instalación, configura el correo SMTP de recordatorios. Asigna el mínimo de permisos necesario.",
    ],
    "images": [
        {"file": "19-admin-usuarios.png", "caption": "Vista del panel de administración de usuarios"},
    ],
}

MODULE_ORDER = [
    "comparador",
    "rut",
    "textos",
    "capacitaciones",
    "enlaces",
    "recordatorios",
    "consulta_cursos",
    "usuarios_duplicados",
    "compresor_video",
    "evaluaciones_moodle",
    "analisis_resultados",
    "generador",
]


def _allowed_modules(user: Any) -> list[str]:
    if getattr(user, "role", None) == "superadmin":
        return list(MODULE_ORDER)
    raw = getattr(user, "permissions_json", None) or "[]"
    try:
        perms = json.loads(raw) if isinstance(raw, str) else list(raw or [])
    except Exception:
        perms = []
    if not isinstance(perms, list):
        perms = []
    return [m for m in MODULE_ORDER if m in perms]


def _write_section(doc: Document, section: dict[str, Any]) -> None:
    doc.add_heading(section["title"], level=1)
    for line in section.get("body") or []:
        doc.add_paragraph(line)
    _add_images(doc, section.get("images") or [])


def build_manual_docx(user: Any) -> tuple[bytes, str, list[str]]:
    """Genera DOCX solo con intro + módulos permitidos (vista + proceso)."""
    allowed = _allowed_modules(user)
    is_super = getattr(user, "role", None) == "superadmin"

    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    title = doc.add_heading("Manual de usuario — Plataforma de Herramientas LMS", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT

    p = doc.add_paragraph()
    run = p.add_run(
        "Documento generado según los permisos de tu cuenta. "
        "Cada módulo muestra la vista de la herramienta y el proceso para usarla."
    )
    run.italic = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    username = getattr(user, "username", "") or ""
    nombre = (getattr(user, "nombre", None) or "").strip()
    doc.add_paragraph(f"Usuario: {nombre or username}")
    if allowed:
        labels = [MODULE_MANUAL[m]["title"] for m in allowed if m in MODULE_MANUAL]
        doc.add_paragraph("Módulos incluidos: " + ", ".join(labels))
    else:
        doc.add_paragraph(
            "Tu cuenta no tiene módulos asignados. Solicita permisos a tu administrador."
        )

    for section in INTRO_SECTIONS:
        _write_section(doc, section)

    for mod in allowed:
        section = MODULE_MANUAL.get(mod)
        if section:
            _write_section(doc, section)

    if is_super:
        _write_section(doc, ADMIN_SECTION)

    doc.add_heading("Ayuda", level=1)
    doc.add_paragraph(
        "Si no ves una herramienta que necesitas, pide a tu administrador que te habilite el permiso."
    )
    doc.add_paragraph(
        "Para problemas de acceso (usuario, contraseña o enlace de la plataforma), contacta a sistemas o al responsable que te dio la cuenta."
    )

    buf = io.BytesIO()
    doc.save(buf)
    safe_user = "".join(c if c.isalnum() or c in "-_" else "_" for c in username)[:40] or "usuario"
    filename = f"Manual_Herramientas_LMS_{safe_user}.docx"
    return buf.getvalue(), filename, allowed
