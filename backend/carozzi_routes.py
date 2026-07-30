"""Rutas API comparadores Carozzi (Molitalia DNI + Todos Chile)."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

import models
from carozzi_chile_comparador import generar_reporte_bytes as generar_reporte_chile_bytes
from carozzi_comparador import generar_reporte_bytes
from deps import require_permission
from security_utils import generic_error_detail, read_upload_limited, safe_csv_filename, safe_planilla_filename

router = APIRouter(prefix="/api/generador/carozzi", tags=["carozzi"])


@router.post("/comparar")
async def api_carozzi_comparar(
    archivo_cliente: UploadFile = File(...),
    archivo_plataforma: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        path_cli = Path(temp_dir) / safe_planilla_filename(archivo_cliente.filename)
        path_plat = Path(temp_dir) / safe_csv_filename(archivo_plataforma.filename)
        path_cli.write_bytes(await read_upload_limited(archivo_cliente))
        path_plat.write_bytes(await read_upload_limited(archivo_plataforma))

        content, filename, stats = generar_reporte_bytes(path_cli, path_plat)
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
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "comparación Carozzi"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/comparar-todos-chile")
async def api_carozzi_comparar_todos_chile(
    archivo_plataforma: UploadFile = File(...),
    archivo_bbdd: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    """Compara Todos.xlsx (RUT) vs export BBDD CSV (username)."""
    temp_dir = tempfile.mkdtemp()
    try:
        path_plat = Path(temp_dir) / safe_planilla_filename(archivo_plataforma.filename)
        path_bbdd = Path(temp_dir) / safe_csv_filename(archivo_bbdd.filename)
        path_plat.write_bytes(await read_upload_limited(archivo_plataforma))
        path_bbdd.write_bytes(await read_upload_limited(archivo_bbdd))

        content, filename, stats = generar_reporte_chile_bytes(path_plat, path_bbdd)
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
            detail=generic_error_detail(e, "comparación Carozzi Todos Chile"),
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
