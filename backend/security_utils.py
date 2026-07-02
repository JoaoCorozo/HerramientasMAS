import base64
import hashlib
import html
import re
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from config import (
    APP_ENCRYPTION_KEY,
    MAX_UPLOAD_BYTES,
    MAX_VIDEO_BATCH_BYTES,
    MAX_VIDEO_UPLOAD_BYTES,
    VALID_MODULES,
)

_FILENAME_UNSAFE = re.compile(r"[^a-zA-Z0-9._-]+")


def safe_upload_filename(original: str | None) -> str:
    name = Path(original or "upload.xlsx").name
    if name in (".", "..") or ".." in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo no válido.",
        )
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, "xlsx"
    ext = ext.lower()
    if ext not in ("xlsx", "xls"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos Excel (.xlsx, .xls).",
        )
    safe_stem = _FILENAME_UNSAFE.sub("_", stem)[:80] or "upload"
    return f"{safe_stem}.{ext}"


def safe_csv_filename(original: str | None) -> str:
    name = Path(original or "upload.csv").name
    if name in (".", "..") or ".." in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo no válido.",
        )
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, "csv"
    ext = ext.lower()
    if ext != "csv":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos CSV (.csv).",
        )
    safe_stem = _FILENAME_UNSAFE.sub("_", stem)[:80] or "upload"
    return f"{safe_stem}.{ext}"


def safe_planilla_filename(original: str | None) -> str:
    """Excel o CSV para planillas de generador (Resiter, Transelec, etc.)."""
    name = Path(original or "upload.csv").name
    if name in (".", "..") or ".." in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo no válido.",
        )
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, "csv"
    ext = ext.lower()
    if ext not in ("csv", "xlsx", "xls", "xlsm"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos CSV (.csv) o Excel (.xlsx, .xls, .xlsm).",
        )
    safe_stem = _FILENAME_UNSAFE.sub("_", stem)[:80] or "upload"
    return f"{safe_stem}.{ext}"


VIDEO_EXTENSIONS = frozenset({".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"})


def safe_video_filename(original: str | None) -> str:
    name = Path(original or "video.mp4").name
    if name in (".", "..") or ".." in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo no válido.",
        )
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, "mp4"
    ext = f".{ext.lower()}"
    if ext not in VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de video no soportado. Use mp4, mov, avi, webm, mkv o m4v.",
        )
    safe_stem = _FILENAME_UNSAFE.sub("_", stem)[:80] or "video"
    return f"{safe_stem}{ext}"


async def read_upload_limited(
    file: UploadFile,
    *,
    max_bytes: int | None = None,
    label: str = "archivo",
) -> bytes:
    limit = max_bytes if max_bytes is not None else MAX_UPLOAD_BYTES
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El {label} supera el límite de {limit // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def read_video_upload_limited(file: UploadFile) -> bytes:
    return await read_upload_limited(
        file,
        max_bytes=MAX_VIDEO_UPLOAD_BYTES,
        label="video",
    )


async def stream_video_upload_to_file(
    file: UploadFile,
    dest: Path,
    *,
    max_bytes: int | None = None,
) -> int:
    limit = max_bytes if max_bytes is not None else MAX_VIDEO_UPLOAD_BYTES
    dest.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with dest.open("wb") as handle:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"El video supera el límite de {limit // (1024 * 1024)} MB.",
                )
            handle.write(chunk)
    return total


def escape_html(value) -> str:
    return html.escape(str(value) if value is not None else "", quote=True)


def _fernet():
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        return None
    if not APP_ENCRYPTION_KEY:
        return None
    derived = base64.urlsafe_b64encode(
        hashlib.sha256(APP_ENCRYPTION_KEY.encode("utf-8")).digest()
    )
    return Fernet(derived)


def encrypt_value(plain: str) -> str:
    if not plain:
        return plain
    f = _fernet()
    if f is None:
        return plain
    return "enc:" + f.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_value(stored: str) -> str:
    if not stored or not isinstance(stored, str):
        return stored or ""
    if not stored.startswith("enc:"):
        return stored
    f = _fernet()
    if f is None:
        return ""
    try:
        return f.decrypt(stored[4:].encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def protect_smtp_config(cfg: dict) -> dict:
    if not isinstance(cfg, dict):
        return cfg
    out = dict(cfg)
    pwd = out.get("password")
    if pwd and not str(pwd).startswith("enc:"):
        out["password"] = encrypt_value(str(pwd))
    return out


def expose_smtp_config(cfg: dict, include_secret: bool = False) -> dict:
    if not isinstance(cfg, dict):
        return cfg
    out = dict(cfg)
    pwd = out.get("password", "")
    if include_secret:
        out["password"] = decrypt_value(str(pwd)) if pwd else ""
    elif pwd:
        out["password"] = ""
        out["password_configured"] = True
    return out


def smtp_config_for_mailer(cfg: dict) -> dict:
    if not isinstance(cfg, dict):
        return cfg
    out = dict(cfg)
    if out.get("password"):
        out["password"] = decrypt_value(str(out["password"]))
    return out


def validate_permissions(permissions: list[str]) -> list[str]:
    invalid = [p for p in permissions if p not in VALID_MODULES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Permisos no válidos: {', '.join(invalid)}",
        )
    return permissions


def validate_role(role: str) -> str:
    from config import VALID_ROLES
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol no válido.",
        )
    return role


def generic_error_detail(exc: Exception, context: str = "operación") -> str:
    from config import IS_PRODUCTION
    if IS_PRODUCTION:
        return f"Error en la {context}. Contacte al administrador."
    return f"Error en la {context}: {exc}"
