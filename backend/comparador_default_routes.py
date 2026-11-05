"""Rutas API comparador genérico (/comparador-default)."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

import models
from comparador_default import generar_reporte_bytes, inspeccionar_archivo
from deps import require_permission
from security_utils import generic_error_detail, read_upload_limited, safe_planilla_filename

router = APIRouter(prefix="/api/comparador-default", tags=["comparador-default"])


@router.post("/inspect")
async def api_comparador_default_inspect(
    archivo1: UploadFile = File(...),
    archivo2: UploadFile = File(...),
    hoja1: str | None = Form(None),
    hoja2: str | None = Form(None),
    current_user: models.User = Depends(require_permission("comparador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        path1 = Path(temp_dir) / ("1_" + safe_planilla_filename(archivo1.filename))
        path2 = Path(temp_dir) / ("2_" + safe_planilla_filename(archivo2.filename))
        path1.write_bytes(await read_upload_limited(archivo1))
        path2.write_bytes(await read_upload_limited(archivo2))
        return {
            "nomina1": inspeccionar_archivo(path1, hoja1),
            "nomina2": inspeccionar_archivo(path2, hoja2),
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=generic_error_detail(e, "inspección comparador default"),
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/comparar")
async def api_comparador_default_comparar(
    archivo1: UploadFile = File(...),
    archivo2: UploadFile = File(...),
    mapeos: str = Form(...),
    fuente: str = Form("1"),
    hoja1: str | None = Form(None),
    hoja2: str | None = Form(None),
    current_user: models.User = Depends(require_permission("comparador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        path1 = Path(temp_dir) / ("1_" + safe_planilla_filename(archivo1.filename))
        path2 = Path(temp_dir) / ("2_" + safe_planilla_filename(archivo2.filename))
        path1.write_bytes(await read_upload_limited(archivo1))
        path2.write_bytes(await read_upload_limited(archivo2))

        content, filename, stats = generar_reporte_bytes(
            path1, path2, mapeos, fuente, hoja1=hoja1, hoja2=hoja2
        )
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Stats": json.dumps(stats),
        }
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=generic_error_detail(e, "comparación default"),
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
