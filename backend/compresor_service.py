"""API del compresor MP4: motor Python in-process (Docker/Linux/Windows)."""
from __future__ import annotations

import logging

from compresor_engine import (
    COMPRESOR_ROOT,
    ensure_dirs,
    ensure_user_dirs,
    get_engine,
    resolve_ffmpeg,
    user_input_dir,
)

logger = logging.getLogger(__name__)

__all__ = [
    "COMPRESOR_ROOT",
    "clear_compresor_queue",
    "clear_input_folder",
    "ensure_compresor_server",
    "proxy_json",
    "resolve_download_zip",
    "user_input_dir",
]


def clear_input_folder(username: str) -> int:
    inp, _ = ensure_user_dirs(username)
    removed = 0
    for path in inp.glob("*.mp4"):
        try:
            path.unlink(missing_ok=True)
            removed += 1
        except OSError as exc:
            logger.warning("No se pudo borrar %s: %s", path, exc)
    return removed


def ensure_compresor_server(username: str) -> str:
    """Inicializa el motor del usuario y valida FFmpeg/plantilla."""
    ensure_dirs()
    engine = get_engine(username)
    ffmpeg = resolve_ffmpeg()
    if not ffmpeg:
        raise FileNotFoundError(
            "No se encontró FFmpeg. En Docker se instala en la imagen; "
            "en local agregue ffmpeg al PATH o copie ffmpeg.exe a "
            f"{COMPRESOR_ROOT / 'bin'}."
        )
    engine.get_items_response()
    return "python://compresor-engine"


def proxy_json(method: str, api_path: str, payload: dict | None = None, *, username: str) -> dict:
    """Compatibilidad con las rutas existentes (antes HTTP al sidecar PS)."""
    ensure_compresor_server(username)
    engine = get_engine(username)
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


def clear_compresor_queue(username: str) -> dict:
    ensure_compresor_server(username)
    engine = get_engine(username)
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


def resolve_download_zip(zip_name: str, username: str):
    ensure_compresor_server(username)
    return get_engine(username).resolve_download(zip_name)
