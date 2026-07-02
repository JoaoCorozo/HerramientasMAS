"""Servicio local del compresor de videos MP4 (PowerShell + FFmpeg)."""
from __future__ import annotations

import json
import logging
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

COMPRESOR_ROOT = Path(__file__).resolve().parent.parent / "compresor_video"
SERVER_PS1 = COMPRESOR_ROOT / "server" / "server.ps1"
INPUT_DIR = COMPRESOR_ROOT / "input"
EXPECTED_INPUT_DIR = INPUT_DIR.resolve()
PORT_RANGE = range(8787, 8798)
STARTUP_WAIT_SECONDS = 20
PROBE_TIMEOUT_SECONDS = 5


def is_port_open(port: int, timeout: float = 0.08) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _fetch_items_at(base_url: str, timeout: float = PROBE_TIMEOUT_SECONDS) -> dict | None:
    url = f"{base_url.rstrip('/')}/api/items"
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except Exception as exc:
        logger.debug("No se pudo consultar compresor en %s: %s", base_url, exc)
        return None


def _matches_our_instance(data: dict | None) -> bool:
    if not isinstance(data, dict):
        return False
    reported = data.get("inputDir")
    if not reported:
        return False
    try:
        return Path(reported).resolve() == EXPECTED_INPUT_DIR
    except OSError:
        return False


def get_compresor_base_url() -> str | None:
    """Devuelve la URL del compresor integrado en este proyecto."""
    for port in PORT_RANGE:
        if not is_port_open(port):
            continue
        base = f"http://127.0.0.1:{port}"
        data = _fetch_items_at(base)
        if _matches_our_instance(data):
            return base
        logger.warning(
            "Puerto %s ocupado por otro compresor (input=%s), se ignora.",
            port,
            (data or {}).get("inputDir"),
        )
    return None


def ensure_compresor_server() -> str:
    existing = get_compresor_base_url()
    if existing:
        return existing

    if not SERVER_PS1.is_file():
        raise FileNotFoundError(
            f"No se encontró el servidor del compresor en {SERVER_PS1}. "
            "Verifique que la carpeta compresor_video esté completa."
        )

    ffmpeg = COMPRESOR_ROOT / "bin" / "ffmpeg.exe"
    if not ffmpeg.is_file():
        raise FileNotFoundError(
            f"Falta FFmpeg en {ffmpeg}. Copie ffmpeg.exe desde la app original."
        )

    for folder in ("input", "output", "temp", "logs", "temp/jobs", "temp/processing", "temp/paquetes"):
        (COMPRESOR_ROOT / folder).mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["COMPRESOR_NO_BROWSER"] = "1"
    env["COMPRESOR_PLATFORM"] = "1"
    subprocess.Popen(
        [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(SERVER_PS1),
        ],
        cwd=str(COMPRESOR_ROOT),
        env=env,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )

    deadline = time.time() + STARTUP_WAIT_SECONDS
    while time.time() < deadline:
        url = get_compresor_base_url()
        if url:
            logger.info("Compresor de videos activo en %s", url)
            return url
        time.sleep(0.25)

    raise RuntimeError(
        "El compresor de videos no respondió a tiempo. "
        "Si tiene otra copia abierta (Downloads\\app), ciérrela y reintente. "
        "Revise compresor_video/logs/app.log."
    )


def proxy_json(method: str, api_path: str, payload: dict | None = None) -> dict:
    base = ensure_compresor_server()
    url = f"{base}{api_path}"
    headers = {"Content-Type": "application/json"}
    data: bytes | None = None
    if method.upper() in {"POST", "PUT", "PATCH"}:
        data = json.dumps(payload if payload is not None else {}).encode("utf-8")

    request = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            body = response.read().decode("utf-8")
            parsed = json.loads(body) if body else {"ok": True}
            if isinstance(parsed, dict) and parsed.get("inputDir") and not _matches_our_instance(parsed):
                raise RuntimeError(
                    "Se detectó un compresor ajeno en el puerto local. "
                    "Cierre la app standalone en Downloads\\app e intente de nuevo."
                )
            return parsed
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(detail)
        except json.JSONDecodeError:
            parsed = {"ok": False, "error": detail or exc.reason}
        if isinstance(parsed, dict) and parsed.get("error"):
            raise RuntimeError(str(parsed["error"])) from exc
        raise RuntimeError(detail or exc.reason) from exc
