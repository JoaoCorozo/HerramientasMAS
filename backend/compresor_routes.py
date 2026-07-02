"""Rutas API del compresor de videos MP4 integrado en la plataforma."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

import models
from compresor_service import INPUT_DIR, ensure_compresor_server, proxy_json
from deps import require_permission
from security_utils import generic_error_detail, safe_video_filename, stream_video_upload_to_file

router = APIRouter(prefix="/api/compresor-video", tags=["compresor-video"])


@router.get("/status")
async def compresor_status(
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        base = await asyncio.to_thread(ensure_compresor_server)
        data = await asyncio.to_thread(proxy_json, "GET", "/api/items")
        return {"running": True, "baseUrl": base, **data}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/items")
async def compresor_items(
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        return await asyncio.to_thread(proxy_json, "GET", "/api/items")
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/upload")
async def compresor_upload(
    files: list[UploadFile] = File(...),
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    if not files:
        raise HTTPException(status_code=400, detail="Seleccione al menos un video MP4.")

    try:
        INPUT_DIR.mkdir(parents=True, exist_ok=True)
        saved_names: list[str] = []
        for upload in files:
            safe_name = safe_video_filename(upload.filename)
            if not safe_name.lower().endswith(".mp4"):
                raise HTTPException(status_code=400, detail=f"Formato no soportado: {upload.filename}")
            dest = INPUT_DIR / safe_name
            stem = dest.stem
            suffix = dest.suffix
            counter = 1
            while dest.exists():
                dest = INPUT_DIR / f"{stem}_{counter}{suffix}"
                counter += 1
            await stream_video_upload_to_file(upload, dest)
            saved_names.append(dest.name)

        return {"ok": True, "uploaded": len(saved_names), "files": saved_names}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=generic_error_detail(exc, "carga de videos"))


@router.post("/scan")
async def compresor_scan(
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        return await asyncio.to_thread(proxy_json, "POST", "/api/scan-input", {})
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/start")
async def compresor_start(
    payload: dict,
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        return await asyncio.to_thread(proxy_json, "POST", "/api/start", payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/stop")
async def compresor_stop(
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        return await asyncio.to_thread(proxy_json, "POST", "/api/stop", {})
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/remove")
async def compresor_remove(
    payload: dict,
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        return await asyncio.to_thread(proxy_json, "POST", "/api/remove", payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/open-output")
async def compresor_open_output(
    current_user: models.User = Depends(require_permission("compresor_video")),
):
    try:
        return await asyncio.to_thread(proxy_json, "POST", "/api/open-output", {})
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
