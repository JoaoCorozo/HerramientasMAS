"""Rutas API generador Resiter."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response

import models
from deps import require_permission
from resiter_parser import generar_csv_bytes, procesar_archivo, procesar_texto
from security_utils import generic_error_detail, read_upload_limited, safe_planilla_filename

router = APIRouter(prefix="/api/generador/resiter", tags=["resiter"])


async def _procesar_desde_request(request: Request, file: UploadFile | None) -> dict:
    content_type = request.headers.get("content-type", "")

    if file is not None and file.filename:
        temp_dir = tempfile.mkdtemp()
        try:
            safe = safe_planilla_filename(file.filename)
            path = Path(temp_dir) / safe
            path.write_bytes(await read_upload_limited(file))
            return procesar_archivo(path)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    if "application/json" in content_type:
        data = await request.json()
        texto = str(data.get("texto", "")).strip()
        if not texto:
            raise HTTPException(status_code=400, detail="Pega la matriz o los datos de colaboradores.")
        return procesar_texto(texto)

    raise HTTPException(status_code=400, detail="Indica un archivo CSV/Excel o texto en JSON (campo texto).")


@router.post("/preview")
async def api_resiter_preview(
    request: Request,
    file: UploadFile | None = File(default=None),
    current_user: models.User = Depends(require_permission("generador")),
):
    try:
        return await _procesar_desde_request(request, file)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "previsualización Resiter"))


@router.post("/generar")
async def api_resiter_generar(
    request: Request,
    file: UploadFile | None = File(default=None),
    current_user: models.User = Depends(require_permission("generador")),
):
    try:
        resultado = await _procesar_desde_request(request, file)
        content, filename = generar_csv_bytes(resultado)
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "generación Resiter"))


# Compatibilidad con rutas anteriores (por si el front en caché las sigue llamando)
@router.post("/preview-texto")
async def api_resiter_preview_texto_legacy(
    request: Request,
    current_user: models.User = Depends(require_permission("generador")),
):
    return await api_resiter_preview(request, None, current_user)


@router.post("/generar-texto")
async def api_resiter_generar_texto_legacy(
    request: Request,
    current_user: models.User = Depends(require_permission("generador")),
):
    return await api_resiter_generar(request, None, current_user)
