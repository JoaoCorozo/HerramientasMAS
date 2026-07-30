"""API del compresor MP4: motor Python in-process (Docker/Linux/Windows)."""
from __future__ import annotations

import logging

from compresor_engine import (
    COMPRESOR_ROOT,
    INPUT_DIR,
    OUTPUT_DIR,
    ensure_dirs,
    get_engine,
    resolve_ffmpeg,
)

logger = logging.getLogger(__name__)

# Re-export para rutas de upload
__all__ = [
    "COMPRESOR_ROOT",
    "INPUT_DIR",
    "OUTPUT_DIR",
    "clear_compresor_queue",
    "clear_input_folder",
    "ensure_compresor_server",
    "proxy_json",
    "resolve_download_zip",
]


def clear_input_folder() -> int:
    ensure_dirs()
    removed = 0
    for path in INPUT_DIR.glob("*.mp4"):
        try:
            path.unlink(missing_ok=True)
            removed += 1
        except OSError as exc:
            logger.warning("No se pudo borrar %s: %s", path, exc)
    return removed


def ensure_compresor_server() -> str:
    """Inicializa el motor y valida FFmpeg/plantilla. Devuelve etiqueta de motor."""
    ensure_dirs()
    engine = get_engine()
    ffmpeg = resolve_ffmpeg()
    if not ffmpeg:
        raise FileNotFoundError(
            "No se encontró FFmpeg. En Docker se instala en la imagen; "
            "en local agregue ffmpeg al PATH o copie ffmpeg.exe a "
            f"{COMPRESOR_ROOT / 'bin'}."
        )
    # touch engine / dirs
    engine.get_items_response()
    return "python://compresor-engine"


def proxy_json(method: str, api_path: str, payload: dict | None = None) -> dict:
    """Compatibilidad con las rutas existentes (antes HTTP al sidecar PS)."""
    ensure_compresor_server()
    engine = get_engine()
    path = api_path.rstrip("/") or "/"
    method_u = method.upper()
    body = payload if payload is not None else {}

    if path in ("/api/items", "/api/health") and method_u == "GET":
        return engine.get_items_response()
    if path == "/api/scan-input" and method_u == "POST":
        return engine.scan_input()
    if path == "/api/clear-input" and method_u == "POST":
        return engine.clear_queue()
    if path == "/api/start" and method_u == "POST":
        return engine.start_queue(body)
    if path == "/api/stop" and method_u == "POST":
        return engine.stop_queue()
    if path == "/api/remove" and method_u == "POST":
        item_id = str(body.get("id") or "")
        if not item_id:
            raise RuntimeError("Falta el id del video.")
        return engine.remove_item(item_id)
    if path == "/api/open-output" and method_u == "POST":
        return engine.open_output()

    raise RuntimeError(f"Ruta de compresor no soportada: {method_u} {api_path}")


def clear_compresor_queue() -> dict:
    ensure_compresor_server()
    engine = get_engine()
    # Detener si hay trabajo activo
    data = engine.get_items_response()
    active = bool(data.get("queueActive")) or any(
        (item or {}).get("status") in ("running", "queued")
        for item in (data.get("items") or [])
    )
    if active:
        try:
            engine.stop_queue()
        except Exception as exc:
            logger.warning("No se pudo detener cola antes de limpiar: %s", exc)
    return engine.clear_queue()


def resolve_download_zip(zip_name: str):
    ensure_compresor_server()
    return get_engine().resolve_download(zip_name)
