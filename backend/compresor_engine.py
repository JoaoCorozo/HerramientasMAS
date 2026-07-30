"""Motor multiplataforma del compresor MP4 (FFmpeg + plantilla ZIP).

Reemplaza el sidecar PowerShell en Docker/Linux y también funciona en Windows
si hay `ffmpeg` en PATH o `compresor_video/bin/ffmpeg.exe`.
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import threading
import time
import unicodedata
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

COMPRESOR_ROOT = Path(
    os.getenv("COMPRESOR_ROOT", str(Path(__file__).resolve().parent.parent / "compresor_video"))
).resolve()
INPUT_DIR = COMPRESOR_ROOT / "input"
OUTPUT_DIR = COMPRESOR_ROOT / "output"
TEMP_DIR = COMPRESOR_ROOT / "temp"
JOBS_DIR = TEMP_DIR / "jobs"
PROCESSING_DIR = TEMP_DIR / "processing"
PACKAGES_DIR = TEMP_DIR / "paquetes"
LOGS_DIR = COMPRESOR_ROOT / "logs"
TEMPLATE_DIR = COMPRESOR_ROOT / "carpeta para el video"
APP_LOG_PATH = LOGS_DIR / "app.log"

LMS_CATALOG: dict[str, dict[str, str]] = {
    "enaex_hispano": {
        "key": "enaex_hispano",
        "label": "Enaex Hispano",
        "slug": "enaex_hispano",
        "base_url": "https://enaexacademy.enaex.com/course/view.php?id=",
    },
    "enaex_ingles": {
        "key": "enaex_ingles",
        "label": "Enaex Inglés",
        "slug": "enaex_ingles",
        "base_url": "https://enaexacademyen.enaex.com/course/view.php?id=",
    },
    "enaex_brasil": {
        "key": "enaex_brasil",
        "label": "Enaex Brasil",
        "slug": "enaex_brasil",
        "base_url": "https://enaexacademybrasil.enaex.com/course/view.php?id=",
    },
    "habitat": {
        "key": "habitat",
        "label": "Habitat",
        "slug": "habitat",
        "base_url": "https://personas.afphabitat.cl/course/view.php?id=",
    },
    "bex": {
        "key": "bex",
        "label": "BEX",
        "slug": "bex",
        "base_url": "https://www.gestiondepersonasbex.cl/course/view.php?id=",
    },
    "banco_internacional": {
        "key": "banco_internacional",
        "label": "Banco Internacional",
        "slug": "banco_internacional",
        "base_url": "https://plataformaavanza.interconecta2.cl/course/view.php?id=",
    },
    "transelec": {
        "key": "transelec",
        "label": "Transelec",
        "slug": "transelec",
        "base_url": "https://www.portalaprende.com/course/view.php?id=",
    },
    "aza": {
        "key": "aza",
        "label": "AZA",
        "slug": "aza",
        "base_url": "https://www.azacapacita.cl/course/view.php?id=",
    },
    "carozzi": {
        "key": "carozzi",
        "label": "Carozzi",
        "slug": "carozzi",
        "base_url": "https://micamino.carozzicorp.com/course/view.php?id=",
    },
}


def _now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat(timespec="seconds")


def _safe_slug(value: str, fallback: str = "archivo") -> str:
    if not value or not value.strip():
        return fallback
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(c for c in normalized if not unicodedata.combining(c))
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")
    slug = re.sub(r"_+", "_", slug)
    return slug or fallback


def _get_lms(lms: str) -> dict[str, str] | None:
    return LMS_CATALOG.get((lms or "").strip().lower())


def resolve_ffmpeg() -> Path | None:
    """Busca ffmpeg en env, bin local (Windows) o PATH."""
    env_path = os.getenv("FFMPEG_PATH", "").strip()
    if env_path:
        p = Path(env_path)
        if p.is_file():
            return p.resolve()

    local_exe = COMPRESOR_ROOT / "bin" / "ffmpeg.exe"
    if local_exe.is_file():
        return local_exe.resolve()

    local_bin = COMPRESOR_ROOT / "bin" / "ffmpeg"
    if local_bin.is_file():
        return local_bin.resolve()

    which = shutil.which("ffmpeg")
    if which:
        return Path(which).resolve()
    return None


def ensure_dirs() -> None:
    for folder in (
        INPUT_DIR,
        OUTPUT_DIR,
        TEMP_DIR,
        JOBS_DIR,
        PROCESSING_DIR,
        PACKAGES_DIR,
        LOGS_DIR,
        COMPRESOR_ROOT / "bin",
    ):
        folder.mkdir(parents=True, exist_ok=True)


def _app_log(message: str) -> None:
    line = f"{_now_iso()} {message}"
    logger.info(message)
    try:
        ensure_dirs()
        with APP_LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def _validate_template() -> None:
    if not TEMPLATE_DIR.is_dir():
        raise RuntimeError(f"No existe la carpeta plantilla: {TEMPLATE_DIR}")
    if not any(TEMPLATE_DIR.iterdir()):
        raise RuntimeError("La carpeta plantilla está vacía.")
    if not (TEMPLATE_DIR / "index.html").is_file():
        raise RuntimeError("La plantilla debe incluir index.html.")


def _file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def _probe_duration_seconds(ffmpeg: Path, input_path: Path) -> float:
    try:
        proc = subprocess.run(
            [str(ffmpeg), "-hide_banner", "-i", str(input_path)],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        text = (proc.stderr or "") + (proc.stdout or "")
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+)\.(\d+)", text)
        if not match:
            return 0.0
        hh, mm, ss, cc = (int(match.group(i)) for i in range(1, 5))
        return hh * 3600 + mm * 60 + ss + (cc / 100.0)
    except Exception as exc:
        _app_log(f"Sonda de duración falló (no crítico): {exc}")
        return 0.0


def _read_ffmpeg_progress(progress_file: Path, duration: float, started: float) -> int:
    if duration > 0 and progress_file.is_file():
        try:
            data = progress_file.read_bytes()
            if data:
                tail = data[-4096:].decode("ascii", errors="ignore")
                matches = re.findall(r"out_time_us=(\d+)", tail)
                if matches:
                    sec = int(matches[-1]) / 1_000_000.0
                    return max(5, min(95, int((sec / duration) * 95)))
        except OSError:
            pass
    elapsed = max(0, int(time.time() - started))
    return max(5, min(95, 5 + int(elapsed * 1.5)))


def _unique_zip_path(input_path: Path, height: int, lms: str, course_id: str) -> Path:
    clean_name = _safe_slug(input_path.stem, "video")
    lms_info = _get_lms(lms)
    clean_lms = lms_info["slug"] if lms_info else _safe_slug(lms, "lms")
    clean_course = re.sub(r"[^0-9]", "", course_id or "")
    stem = f"{clean_name}_{clean_lms}_curso_{clean_course}_{height}p"
    candidate = OUTPUT_DIR / f"{stem}.zip"
    counter = 2
    while candidate.exists():
        candidate = OUTPUT_DIR / f"{stem}_{counter}.zip"
        counter += 1
    return candidate


def _write_redirect_index(dest: Path, base_url: str, course_id: str) -> None:
    target = f"{base_url}{course_id}"
    dest.write_text(
        f"""<html>
<head>
<script type="text/javascript">
location.href = "{target}";
</script>
</head>
<body>
</body>
</html>
""",
        encoding="utf-8",
    )


def _build_zip_package(
    temp_mp4: Path,
    final_zip: Path,
    package_dir: Path,
    lms_info: dict[str, str],
    course_id: str,
) -> Path:
    if package_dir.exists():
        shutil.rmtree(package_dir, ignore_errors=True)
    package_dir.mkdir(parents=True, exist_ok=True)

    for item in TEMPLATE_DIR.iterdir():
        dest = package_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)

    shutil.copy2(temp_mp4, package_dir / "video.mp4")
    _write_redirect_index(package_dir / "index2.html", lms_info["base_url"], course_id)

    output_path = final_zip
    if output_path.exists():
        stem = output_path.stem
        n = 2
        while True:
            candidate = output_path.with_name(f"{stem}_{n}.zip")
            if not candidate.exists():
                output_path = candidate
                break
            n += 1

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in package_dir.rglob("*"):
            if path.is_file():
                zf.write(path, arcname=str(path.relative_to(package_dir)))
    return output_path


class CompresorEngine:
    """Cola en proceso (un video a la vez), API compatible con el sidecar PS."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._items: dict[str, dict] = {}
        self._cancel_requested = False
        self._queue_started_at: float | None = None
        self._queue_finished_at: float | None = None
        self._worker_thread: threading.Thread | None = None
        self._current_proc: subprocess.Popen | None = None
        ensure_dirs()

    def _plain_item(self, item: dict) -> dict:
        return {
            "id": item.get("id"),
            "name": item.get("name"),
            "path": item.get("path"),
            "size": item.get("size", 0),
            "status": item.get("status"),
            "message": item.get("message"),
            "progress": item.get("progress", 0),
            "output": item.get("output") or "",
            "finalSize": item.get("finalSize", 0),
            "reductionPercent": item.get("reductionPercent"),
            "resolution": item.get("resolution", 720),
            "source": item.get("source"),
            "sourceLabel": item.get("sourceLabel"),
            "elapsedSeconds": item.get("elapsedSeconds", 0),
            "startedAt": item.get("startedAt") or "",
            "finishedAt": item.get("finishedAt") or "",
            "lms": item.get("lms") or "",
            "lmsLabel": item.get("lmsLabel") or "",
            "courseId": item.get("courseId") or "",
            "zipName": item.get("zipName") or "",
        }

    def _queue_info(self) -> tuple[bool, int]:
        active = any(i.get("status") in ("running", "queued") for i in self._items.values())
        elapsed = 0
        if self._queue_started_at is not None:
            end = self._queue_finished_at or time.time()
            elapsed = max(0, int(end - self._queue_started_at))
        return active, elapsed

    def get_items_response(self) -> dict:
        with self._lock:
            ffmpeg = resolve_ffmpeg()
            active, elapsed = self._queue_info()
            return {
                "ok": True,
                "ffmpegExists": bool(ffmpeg),
                "inputDir": str(INPUT_DIR),
                "outputDir": str(OUTPUT_DIR),
                "queueActive": active,
                "queueElapsedSeconds": elapsed,
                "items": [self._plain_item(i) for i in self._items.values()],
                "engine": "python",
            }

    def _new_item(self, path: Path, source: str, source_label: str) -> dict:
        return {
            "id": uuid.uuid4().hex[:12],
            "name": path.name,
            "path": str(path.resolve()),
            "size": _file_size(path),
            "status": "pending",
            "message": "Pendiente.",
            "progress": 0,
            "output": "",
            "finalSize": 0,
            "reductionPercent": None,
            "resolution": 720,
            "source": source,
            "sourceLabel": source_label,
            "lms": "",
            "lmsLabel": "",
            "courseId": "",
            "zipName": "",
            "elapsedSeconds": 0,
            "startedAt": "",
            "finishedAt": "",
            "cancelPath": "",
            "tempOutput": "",
            "packageDir": "",
            "ffmpegPid": 0,
        }

    def scan_input(self) -> dict:
        with self._lock:
            ensure_dirs()
            active = any(i.get("status") in ("running", "queued") for i in self._items.values())
            if active:
                raise RuntimeError("No se puede escanear mientras hay una cola activa.")

            files = sorted(INPUT_DIR.glob("*.mp4"))
            paths = {str(p.resolve()) for p in files}

            for item_id in list(self._items.keys()):
                item = self._items[item_id]
                if item.get("source") == "input" and item.get("status") != "running":
                    if item.get("path") not in paths:
                        del self._items[item_id]

            for path in files:
                full = str(path.resolve())
                existing = next((i for i in self._items.values() if i.get("path") == full), None)
                if existing:
                    existing["name"] = path.name
                    existing["size"] = _file_size(path)
                    existing["source"] = "input"
                    existing["sourceLabel"] = "Desde input"
                    if existing.get("status") in ("error", "canceled"):
                        existing["status"] = "pending"
                        existing["message"] = "Pendiente."
                        existing["progress"] = 0
                    continue
                item = self._new_item(path, "input", "Desde input")
                self._items[item["id"]] = item

            _app_log(f"Videos encontrados: {len(files)}")
            response = self.get_items_response()
            response["found"] = len(files)
            return response

    def clear_queue(self) -> dict:
        with self._lock:
            removed_files = 0
            removed_items = 0
            for item_id in list(self._items.keys()):
                item = self._items[item_id]
                if item.get("status") in ("running", "queued"):
                    continue
                path = Path(item.get("path") or "")
                if path.is_file():
                    try:
                        path.unlink()
                        removed_files += 1
                    except OSError:
                        pass
                del self._items[item_id]
                removed_items += 1

            for path in list(INPUT_DIR.glob("*.mp4")):
                referenced = any(i.get("path") == str(path.resolve()) for i in self._items.values())
                if referenced:
                    continue
                try:
                    path.unlink()
                    removed_files += 1
                except OSError:
                    pass

            self._queue_started_at = None
            self._queue_finished_at = None
            response = self.get_items_response()
            response["removedFiles"] = removed_files
            response["removedItems"] = removed_items
            response["message"] = (
                f"Se borraron {removed_files} archivo(s) de input "
                f"y {removed_items} de la cola."
            )
            return response

    def remove_item(self, item_id: str) -> dict:
        with self._lock:
            item = self._items.get(item_id)
            if not item:
                raise RuntimeError("Video no encontrado.")
            if item.get("status") in ("running", "queued"):
                raise RuntimeError("No se puede quitar un video en proceso. Detén la cola primero.")
            path = Path(item.get("path") or "")
            if path.is_file():
                try:
                    path.unlink()
                except OSError:
                    pass
            del self._items[item_id]
            return self.get_items_response()

    def stop_queue(self) -> dict:
        with self._lock:
            self._cancel_requested = True
            for item in self._items.values():
                if item.get("status") == "queued":
                    item["status"] = "pending"
                    item["message"] = "Pendiente."
                    item["progress"] = 0
                elif item.get("status") == "running":
                    item["message"] = "Cancelando..."
                    cancel_path = Path(item.get("cancelPath") or "")
                    if cancel_path:
                        try:
                            cancel_path.write_text("cancel", encoding="ascii")
                        except OSError:
                            pass
                    proc = self._current_proc
                    if proc and proc.poll() is None:
                        try:
                            proc.terminate()
                            try:
                                proc.wait(timeout=3)
                            except subprocess.TimeoutExpired:
                                proc.kill()
                        except OSError:
                            pass
                    item["status"] = "canceled"
                    item["progress"] = 0
                    item["message"] = "Cancelado por usuario."
                    item["finishedAt"] = _now_iso()
            return self.get_items_response()

    def start_queue(self, payload: dict) -> dict:
        with self._lock:
            height = int(payload.get("resolution") or 720)
            if height not in (480, 720):
                height = 720
            lms = str(payload.get("lms") or "").strip().lower()
            course_id = str(payload.get("courseId") or "").strip()
            lms_info = _get_lms(lms)
            if not lms_info:
                raise RuntimeError("Selecciona una opción de LMS antes de optimizar.")
            if not re.fullmatch(r"\d+", course_id):
                raise RuntimeError("Ingresa un ID de curso numérico.")

            ffmpeg = resolve_ffmpeg()
            if not ffmpeg:
                raise RuntimeError(
                    "No se encontró FFmpeg. En Docker se instala automáticamente; "
                    "en local copie ffmpeg.exe a compresor_video/bin/ o agréguelo al PATH."
                )
            _validate_template()

            pending = [
                i for i in self._items.values() if i.get("status") in ("pending", "error", "canceled")
            ]
            if not pending and not any(i.get("status") in ("queued", "running") for i in self._items.values()):
                # re-scan input if empty queue but files exist
                self.scan_input()
                pending = [
                    i
                    for i in self._items.values()
                    if i.get("status") in ("pending", "error", "canceled")
                ]
            if not pending:
                raise RuntimeError("No hay videos pendientes para optimizar.")

            for item in pending:
                item["status"] = "queued"
                item["message"] = "En cola."
                item["progress"] = 0
                item["resolution"] = height
                item["lms"] = lms_info["key"]
                item["lmsLabel"] = lms_info["label"]
                item["courseId"] = course_id
                item["finishedAt"] = ""
                item["output"] = ""
                item["zipName"] = ""
                item["finalSize"] = 0
                item["reductionPercent"] = None

            self._cancel_requested = False
            self._queue_started_at = time.time()
            self._queue_finished_at = None
            self._ensure_worker()
            response = self.get_items_response()
            response["warning"] = None
            return response

    def open_output(self) -> dict:
        ensure_dirs()
        opened = False
        if os.name == "nt":
            try:
                os.startfile(str(OUTPUT_DIR))  # type: ignore[attr-defined]
                opened = True
            except OSError:
                opened = False
        zips = sorted(OUTPUT_DIR.glob("*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
        return {
            "ok": True,
            "opened": opened,
            "outputDir": str(OUTPUT_DIR),
            "files": [{"name": z.name, "size": z.stat().st_size} for z in zips[:50]],
            "message": (
                "Carpeta de salida abierta."
                if opened
                else "Usa Descargar ZIP en cada video finalizado (modo Docker/servidor)."
            ),
        }

    def resolve_download(self, zip_name: str) -> Path:
        safe = Path(zip_name).name
        if not safe.lower().endswith(".zip"):
            raise RuntimeError("Solo se permiten archivos ZIP.")
        path = (OUTPUT_DIR / safe).resolve()
        if not str(path).startswith(str(OUTPUT_DIR.resolve())):
            raise RuntimeError("Ruta inválida.")
        if not path.is_file():
            raise RuntimeError("ZIP no encontrado.")
        return path

    def _ensure_worker(self) -> None:
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._worker_thread = threading.Thread(target=self._worker_loop, name="compresor-worker", daemon=True)
        self._worker_thread.start()

    def _worker_loop(self) -> None:
        while True:
            item = None
            with self._lock:
                if self._cancel_requested:
                    # keep loop until no queued remain (already flipped to pending)
                    pass
                item = next((i for i in self._items.values() if i.get("status") == "queued"), None)
                if not item:
                    self._queue_finished_at = time.time()
                    return
            try:
                self._process_item(item)
            except Exception as exc:
                _app_log(f"Error inesperado en worker: {exc}")
                with self._lock:
                    item["status"] = "error"
                    item["message"] = "Error inesperado al procesar el video."
                    item["progress"] = 0
                    item["finishedAt"] = _now_iso()

    def _process_item(self, item: dict) -> None:
        ensure_dirs()
        ffmpeg = resolve_ffmpeg()
        if not ffmpeg:
            with self._lock:
                item["status"] = "error"
                item["message"] = "Falta FFmpeg."
                item["finishedAt"] = _now_iso()
            return

        lms_info = _get_lms(item.get("lms") or "") or LMS_CATALOG["enaex_hispano"]
        height = int(item.get("resolution") or 720)
        input_path = Path(item["path"])
        item_id = item["id"]
        cancel_path = JOBS_DIR / f"{item_id}.cancel"
        progress_file = JOBS_DIR / f"{item_id}.progress"
        temp_output = PROCESSING_DIR / f"{item_id}.mp4"
        package_dir = PACKAGES_DIR / item_id
        final_zip = _unique_zip_path(input_path, height, item.get("lms") or "", item.get("courseId") or "")

        for p in (cancel_path, progress_file, temp_output):
            try:
                if p.exists():
                    p.unlink()
            except OSError:
                pass
        if package_dir.exists():
            shutil.rmtree(package_dir, ignore_errors=True)

        started = time.time()
        with self._lock:
            item["status"] = "running"
            item["progress"] = 5
            item["message"] = "Procesando..."
            item["startedAt"] = _now_iso()
            item["finishedAt"] = ""
            item["cancelPath"] = str(cancel_path)
            item["tempOutput"] = str(temp_output)
            item["packageDir"] = str(package_dir)
            item["output"] = str(final_zip)
            item["zipName"] = final_zip.name
            item["elapsedSeconds"] = 0

        if not input_path.is_file():
            with self._lock:
                item["status"] = "error"
                item["message"] = "No se encontró el video original."
                item["finishedAt"] = _now_iso()
            return

        duration = _probe_duration_seconds(ffmpeg, input_path)
        vf = (
            f"scale='if(gt(ih,{height}),-2,trunc(iw/2)*2)':"
            f"'if(gt(ih,{height}),{height},trunc(ih/2)*2)'"
        )
        cmd = [
            str(ffmpeg),
            "-y",
            "-nostdin",
            "-v",
            "error",
            "-hide_banner",
            "-progress",
            str(progress_file),
            "-i",
            str(input_path),
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-threads",
            "0",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(temp_output),
        ]
        _app_log(f"Inicio FFmpeg: {item['name']}")

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
            )
        except OSError as exc:
            with self._lock:
                item["status"] = "error"
                item["message"] = f"No se pudo iniciar FFmpeg: {exc}"
                item["finishedAt"] = _now_iso()
            return

        with self._lock:
            self._current_proc = proc
            item["ffmpegPid"] = proc.pid or 0

        while proc.poll() is None:
            if cancel_path.exists() or self._cancel_requested:
                try:
                    proc.terminate()
                    proc.wait(timeout=5)
                except Exception:
                    try:
                        proc.kill()
                    except OSError:
                        pass
                break
            progress = _read_ffmpeg_progress(progress_file, duration, started)
            with self._lock:
                item["progress"] = progress
                item["message"] = "Procesando..."
                item["elapsedSeconds"] = int(time.time() - started)
            time.sleep(1)

        stderr = ""
        try:
            if proc.stderr:
                stderr = proc.stderr.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        exit_code = proc.returncode if proc.returncode is not None else -1
        with self._lock:
            self._current_proc = None

        elapsed_total = int(time.time() - started)
        if cancel_path.exists() or self._cancel_requested:
            for p in (temp_output, progress_file):
                try:
                    p.unlink(missing_ok=True)
                except OSError:
                    pass
            shutil.rmtree(package_dir, ignore_errors=True)
            with self._lock:
                item["status"] = "canceled"
                item["progress"] = 0
                item["message"] = "Cancelado por usuario."
                item["elapsedSeconds"] = elapsed_total
                item["finishedAt"] = _now_iso()
            return

        if exit_code == 0 and temp_output.is_file():
            with self._lock:
                item["progress"] = 96
                item["message"] = "Creando paquete ZIP..."
                item["elapsedSeconds"] = elapsed_total
            try:
                output_path = _build_zip_package(
                    temp_output,
                    final_zip,
                    package_dir,
                    lms_info,
                    item.get("courseId") or "",
                )
                final_size = _file_size(output_path)
                original = int(item.get("size") or 0)
                reduction = None
                if original > 0:
                    reduction = round((1 - (final_size / float(original))) * 100, 1)
                with self._lock:
                    item["status"] = "done"
                    item["progress"] = 100
                    item["message"] = "Finalizado."
                    item["output"] = str(output_path)
                    item["zipName"] = output_path.name
                    item["finalSize"] = final_size
                    item["reductionPercent"] = reduction
                    item["elapsedSeconds"] = int(time.time() - started)
                    item["finishedAt"] = _now_iso()
                _app_log(f"ZIP final: {output_path}")
            except Exception as exc:
                _app_log(f"Error creando ZIP: {exc}")
                with self._lock:
                    item["status"] = "error"
                    item["message"] = "No se pudo crear el paquete ZIP."
                    item["finishedAt"] = _now_iso()
                    item["elapsedSeconds"] = elapsed_total
            finally:
                try:
                    temp_output.unlink(missing_ok=True)
                except OSError:
                    pass
                try:
                    progress_file.unlink(missing_ok=True)
                except OSError:
                    pass
                shutil.rmtree(package_dir, ignore_errors=True)
            return

        for p in (temp_output, progress_file):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
        shutil.rmtree(package_dir, ignore_errors=True)
        detail = (stderr or "").strip()[:300]
        with self._lock:
            item["status"] = "error"
            item["progress"] = 0
            item["message"] = (
                "No se pudo comprimir el video."
                + (f" ({detail})" if detail else "")
            )
            item["elapsedSeconds"] = elapsed_total
            item["finishedAt"] = _now_iso()


_ENGINE: CompresorEngine | None = None
_ENGINE_LOCK = threading.Lock()


def get_engine() -> CompresorEngine:
    global _ENGINE
    with _ENGINE_LOCK:
        if _ENGINE is None:
            _ENGINE = CompresorEngine()
        return _ENGINE
