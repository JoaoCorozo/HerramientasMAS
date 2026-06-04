"""Generación de paquetes HTML/ZIP para videos Moodle."""

from __future__ import annotations

import html
import re
import shutil
import zipfile
from pathlib import Path

from paths import PLANTILLA_VIDEO_DIR

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"}
INVALID_FOLDER_CHARS = re.compile(r'[<>:"/\\|?*]')

INDEX2_TEMPLATE = """<html>

<head>
    <script type="text/javascript">
        location.href = {url_js};

    </script>
</head>
<body>
</body>
</html>
"""


def validar_nombre_carpeta(nombre: str) -> str | None:
    nombre = nombre.strip()
    if not nombre:
        return "Ingresa un nombre para la carpeta principal."
    if INVALID_FOLDER_CHARS.search(nombre):
        return 'El nombre no puede contener: < > : " / \\ | ? *'
    return None


def validar_url_curso(url: str) -> str | None:
    url = url.strip()
    if not url:
        return "Ingresa la URL del curso."
    if not (url.startswith("http://") or url.startswith("https://")):
        return "La URL debe comenzar con http:// o https://"
    return None


def crear_index2(course_url: str) -> str:
    url_js = html.escape(course_url.strip(), quote=True)
    return INDEX2_TEMPLATE.format(url_js=f'"{url_js}"')


def copiar_plantilla(destino: Path) -> None:
    for item in PLANTILLA_VIDEO_DIR.iterdir():
        if item.name == "video.mp4":
            continue
        target = destino / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


def _zip_directorio(origen: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(origen.rglob("*")):
            if file_path.is_file():
                zf.write(file_path, file_path.relative_to(origen).as_posix())


def generar_paquetes_video(
    carpeta_destino: Path,
    nombre_lote: str,
    course_url: str,
    videos: list[Path],
) -> Path:
    if not PLANTILLA_VIDEO_DIR.is_dir():
        raise FileNotFoundError(f"No se encontró la plantilla en: {PLANTILLA_VIDEO_DIR}")

    lote_dir = carpeta_destino / nombre_lote.strip()
    lote_dir.mkdir(parents=True, exist_ok=True)

    index2_content = crear_index2(course_url)

    for index, video_path in enumerate(videos, start=1):
        paquete_dir = lote_dir / str(index)
        if paquete_dir.exists():
            shutil.rmtree(paquete_dir)
        paquete_dir.mkdir(parents=True)

        copiar_plantilla(paquete_dir)
        shutil.copy2(video_path, paquete_dir / "video.mp4")
        (paquete_dir / "index2.html").write_text(index2_content, encoding="utf-8")

        zip_path = lote_dir / f"{index}.zip"
        if zip_path.exists():
            zip_path.unlink()
        _zip_directorio(paquete_dir, zip_path)

    return lote_dir


def crear_zip_lote(lote_dir: Path, zip_path: Path) -> Path:
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(lote_dir.rglob("*")):
            if file_path.is_file():
                zf.write(file_path, file_path.relative_to(lote_dir.parent).as_posix())
    return zip_path
