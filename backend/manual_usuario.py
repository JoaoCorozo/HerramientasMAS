"""Manual de usuario por módulos → DOCX filtrado por permisos."""
from __future__ import annotations

import io
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

# Secciones comunes (siempre en el manual descargado)
INTRO_SECTIONS: list[dict[str, Any]] = [
    {
        "title": "¿Qué es esta plataforma?",
        "body": [
            "Es un sitio web interno para tareas de capacitación y LMS. Se usa desde el navegador (Chrome, Edge o Firefox), sin instalar programas.",
            "En el menú izquierdo solo verás las herramientas que tu administrador te habilitó. Este manual descarga únicamente las secciones de los módulos a los que tienes acceso.",
        ],
    },
    {
        "title": "Entrar a la plataforma",
        "body": [
            "1. Abre el enlace que te entregaron.",
            "2. Escribe tu usuario y contraseña.",
            "3. Haz clic en Iniciar Sesión.",
            "Si olvidaste la contraseña o no puedes entrar, contacta a tu administrador o a sistemas. No compartas tu clave.",
        ],
    },
    {
        "title": "Pantalla principal",
        "body": [
            "A la izquierda está el menú Herramientas. La opción activa se resalta.",
            "Abajo puedes cambiar la Apariencia (claro/oscuro y estilo visual). El navegador recordará tu preferencia.",
            "Al terminar tu trabajo, usa Cerrar Sesión.",
        ],
    },
]

# Contenido por permiso de módulo (solo usuarios finales)
MODULE_MANUAL: dict[str, dict[str, Any]] = {
    "comparador": {
        "title": "Comparador de Datos",
        "body": [
            "Compara dos archivos Excel y descarga un reporte con diferencias, coincidencias o ambos.",
            "Pasos:",
            "1. Sube el Archivo Principal (base) y el Archivo de Contraste.",
            "2. Ajusta columnas, filas e hoja si es necesario.",
            "3. Elige el tipo de reporte: Solo diferencias, Solo coincidencias o Ambos (2 hojas).",
            "4. Haz clic en Comenzar comparación y descarga el Excel resultante.",
            "Consejo: usa la misma columna clave en ambos archivos (por ejemplo RUT o código). La plataforma no modifica tus archivos originales.",
        ],
    },
    "rut": {
        "title": "Normalizador RUT",
        "body": [
            "Deja una lista de RUT chilenos con el mismo formato.",
            "Pasos:",
            "1. Pega un RUT por línea en el cuadro izquierdo.",
            "2. Elige el formato (con o sin puntos y guión; K en minúscula si aplica).",
            "3. Haz clic en Normalizar y copia el resultado de la derecha.",
        ],
    },
    "textos": {
        "title": "Normalizador de Textos",
        "body": [
            "Transforma listas de texto a MAYÚSCULAS, minúsculas o Formato Título.",
            "Pasos:",
            "1. Pega una línea por registro.",
            "2. Elige el formato deseado.",
            "3. Normalizar y copiar el resultado.",
        ],
    },
    "capacitaciones": {
        "title": "Capacitaciones Mod 1",
        "body": [
            "Agenda personal de capacitaciones (título, enlace, duración, notas y fecha). En general solo tú ves lo que guardas con tu usuario.",
            "Pasos:",
            "1. Entra al módulo y revisa el listado (puedes buscar).",
            "2. Nueva Capacitación → completa al menos el título y guarda.",
            "3. Para eliminar, usa el icono de papelera en la fila correspondiente.",
        ],
    },
    "enlaces": {
        "title": "Enlaces de interés",
        "body": [
            "Catálogo de enlaces útiles organizados por empresa.",
            "Pasos:",
            "1. Filtra por empresa o busca por texto.",
            "2. Agrega un enlace con título, URL, empresa y notas opcionales.",
            "3. Ábrelo en una pestaña nueva, edítalo o elimínalo desde cada tarjeta.",
        ],
    },
    "recordatorios": {
        "title": "Calendario y tareas",
        "body": [
            "Agenda tareas por día, márcalas como hechas e importa varias desde Excel.",
            "Calendario: las flechas cambian de mes. Naranja = pendientes, verde = completadas. Haz clic en un día para ver sus tareas.",
            "Nueva tarea: indica título y, si aplica, curso, grupo, asunto, cuerpo de mail, correo de aviso y notas.",
            "Importar: pega columnas Día y Tarea desde Excel y confirma en el asistente.",
            "Mail Composer: el botón abre el sitio externo de BEX con los campos listos; no envía el correo desde esta plataforma.",
            "Los recordatorios automáticos por SMTP los configura normalmente el área de sistemas.",
        ],
    },
    "consulta_cursos": {
        "title": "Reporte Consulta Cursos",
        "body": [
            "Pega el texto de una consulta de cursos desde Moodle y genera un Excel ordenado.",
            "Pasos:",
            "1. Pega el texto completo de la consulta.",
            "2. Previsualizar para ver totales (registros, cursos, usuarios).",
            "3. Elige varias hojas (una por curso) o una sola hoja.",
            "4. Descargar Excel.",
        ],
    },
    "usuarios_duplicados": {
        "title": "Usuarios Duplicados",
        "body": [
            "Analiza un Excel de nómina o usuarios y detecta grupos duplicados según criterios del sistema (por ejemplo RUT o correo).",
            "Pasos:",
            "1. Sube el archivo Excel.",
            "2. Analizar y revisa los grupos encontrados.",
            "3. Descarga o copia los resultados. Queda un historial de análisis en la misma pantalla.",
        ],
    },
    "compresor_video": {
        "title": "Compresor MP4",
        "body": [
            "Comprime videos MP4 y genera un ZIP (reproductor + video) listo para subir a Moodle.",
            "Pasos:",
            "1. Elige resolución (720p o 480p) y calidad: Normal o Más compacto.",
            "2. Más compacto usa 480p y mayor compresión: recomendado para videos de una hora o más (Moodle suele rechazar archivos muy pesados).",
            "3. Agregar videos → Optimizar → indica LMS e ID de curso.",
            "4. Cuando termine, usa Descargar ZIP.",
            "En servidor, los archivos se procesan en el servidor: usa siempre el botón de descarga de la interfaz.",
        ],
    },
    "evaluaciones_moodle": {
        "title": "Evaluaciones Moodle",
        "body": [
            "Ayuda a preparar evaluaciones para importar o documentar en Moodle.",
            "Puedes:",
            "• Cargar un Word (.docx) para marcar la alternativa correcta y descargar el archivo modificado.",
            "• Pegar o cargar texto / formato GIFT (.txt).",
            "• Ordenar el texto de la evaluación.",
            "• Convertir a GIFT (con o sin negrita) para importar a Moodle.",
            "• Exportar a Word desde el editor.",
            "Flujo típico: pegar borrador → ordenar → convertir a GIFT → descargar .txt o Word.",
        ],
    },
    "analisis_resultados": {
        "title": "Análisis de Resultados",
        "body": [
            "Analiza el informe de respuestas de un quiz Moodle (un solo Excel).",
            "El archivo debe traer, por cada pregunta N: enunciado, respuesta del usuario y respuesta correcta. Funciona con columnas en español, inglés, portugués u otros idiomas del LMS.",
            "Pasos:",
            "1. Sube el Excel de respuestas.",
            "2. Previsualizar: verás porcentaje de acierto, preguntas difíciles y muestras.",
            "3. Descargar Excel con hojas Resumen, Por pregunta, Por usuario y Detalle de respuestas.",
            "Se considera acierto si la respuesta del usuario coincide con la correcta. Si una persona rindió varias veces (distinta hora de inicio), aparecen todos los intentos.",
            "Si el Excel trae RUT o nombre de usuario, también se incluye en el detalle.",
        ],
    },
    "generador": {
        "title": "Generador de Nóminas / Cargas",
        "body": [
            "Desde Generador de Nóminas eliges el cliente y el proceso. Cada cliente tiene reglas propias.",
            "BEX — Cargas e inducciones:",
            "1. Sube el Excel de dotación (títulos en la primera fila).",
            "2. Elige hoja y columnas (puedes usar Recomendadas Moodle).",
            "3. Mapea columnas, nombre de grupo y la columna de perfil de inducción (debe coincidir con los perfiles de la plataforma).",
            "4. Previsualiza y genera el ZIP con un CSV por perfil para subir a Moodle.",
            "Transelec: altas de usuarios nuevos, externos y asignación (quién falta en la nómina LMS).",
            "AZA: compara nóminas cliente vs plataforma y descarga un Excel con varias hojas de resultado.",
            "Resiter: genera CSV Moodle desde matriz SAP según perfil operacional, administrativo o CRM.",
            "Carozzi: comparar DNI/C.I., comparador Todos Chile y separar cursos activos/inactivos.",
            "EMIN: comparar nóminas y consolidar cambios del cliente.",
            "Si un cliente aparece como no disponible, aún no tiene proceso activo en tu instalación.",
        ],
    },
}

ADMIN_SECTION: dict[str, Any] = {
    "title": "Panel de Administrador (solo si aplica a tu usuario)",
    "body": [
        "Si eres superadministrador verás Panel de Administrador.",
        "Desde ahí puedes crear y editar usuarios, asignar permisos por módulo y, según la instalación, configurar el correo SMTP de recordatorios.",
        "Asigna a cada persona solo los módulos que necesita.",
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
    import json

    raw = getattr(user, "permissions_json", None) or "[]"
    try:
        perms = json.loads(raw) if isinstance(raw, str) else list(raw or [])
    except Exception:
        perms = []
    if not isinstance(perms, list):
        perms = []
    return [m for m in MODULE_ORDER if m in perms]


def build_manual_docx(user: Any) -> tuple[bytes, str, list[str]]:
    """Genera DOCX solo con intro + módulos permitidos. Retorna (bytes, filename, módulos)."""
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
        "Documento generado automáticamente según los permisos de tu cuenta. "
        "Solo incluye las herramientas a las que tienes acceso."
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
        doc.add_heading(section["title"], level=1)
        for line in section["body"]:
            doc.add_paragraph(line)

    for mod in allowed:
        section = MODULE_MANUAL.get(mod)
        if not section:
            continue
        doc.add_heading(section["title"], level=1)
        for line in section["body"]:
            doc.add_paragraph(line)

    if is_super:
        doc.add_heading(ADMIN_SECTION["title"], level=1)
        for line in ADMIN_SECTION["body"]:
            doc.add_paragraph(line)

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
