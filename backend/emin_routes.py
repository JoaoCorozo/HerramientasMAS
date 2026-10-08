"""Rutas API comparador / consolidación de nóminas EMIN."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

import models
from deps import require_permission
from emin_comparador import generar_reporte_bytes
from emin_consolidar import generar_reporte_bytes as generar_consolidacion_bytes
from security_utils import generic_error_detail, read_upload_limited, safe_planilla_filename

router = APIRouter(prefix="/api/generador/emin", tags=["emin"])


@router.post("/comparar")
async def api_emin_comparar(
    archivo_cliente: UploadFile = File(...),
    archivo_corregida: UploadFile = File(...),
    archivo_analizador: UploadFile | None = File(None),
    decisiones: str | None = Form(None),
    current_user: models.User = Depends(require_permission("generador")),
):
    """
    Compara nóminas. Si se adjunta el Excel del analizador y hay filas que el
    comparador no marcó, responde JSON needs_review para decidir en el modal.
    Con decisiones completas (o sin pendientes) responde el Excel.
    """
    temp_dir = tempfile.mkdtemp()
    try:
        path_cli = Path(temp_dir) / safe_planilla_filename(archivo_cliente.filename)
        path_corr = Path(temp_dir) / safe_planilla_filename(archivo_corregida.filename)
        path_cli.write_bytes(await read_upload_limited(archivo_cliente))
        path_corr.write_bytes(await read_upload_limited(archivo_corregida))

        path_an: Path | None = None
        if archivo_analizador is not None and archivo_analizador.filename:
            path_an = Path(temp_dir) / ("analizador_" + safe_planilla_filename(archivo_analizador.filename))
            path_an.write_bytes(await read_upload_limited(archivo_analizador))

        decisiones_map: dict[str, str] | None = None
        if decisiones:
            try:
                raw = json.loads(decisiones)
                if isinstance(raw, list):
                    decisiones_map = {
                        str(item["id"]): str(item["destino"])
                        for item in raw
                        if isinstance(item, dict) and item.get("id") and item.get("destino")
                    }
                elif isinstance(raw, dict):
                    decisiones_map = {str(k): str(v) for k, v in raw.items()}
            except (json.JSONDecodeError, TypeError, KeyError) as e:
                raise HTTPException(status_code=400, detail=f"decisiones inválidas: {e}") from e

        result = generar_reporte_bytes(
            path_cli,
            path_corr,
            ruta_analizador=path_an,
            decisiones=decisiones_map,
        )

        if result.get("status") == "needs_review":
            return JSONResponse(
                content={
                    "status": "needs_review",
                    "pending": result.get("pending") or [],
                    "stats": result.get("stats") or {},
                }
            )

        headers = {
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Report-Stats": json.dumps(result.get("stats") or {}),
        }
        return Response(
            content=result["content"],
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "comparación EMIN"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/consolidar-cambios")
async def api_emin_consolidar_cambios(
    archivo_antigua: UploadFile = File(...),
    archivo_nueva: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    """Une nómina antigua + nueva: identidad estable, resto parchado, altas incluidas."""
    temp_dir = tempfile.mkdtemp()
    try:
        path_ant = Path(temp_dir) / ("antigua_" + safe_planilla_filename(archivo_antigua.filename))
        path_nue = Path(temp_dir) / ("nueva_" + safe_planilla_filename(archivo_nueva.filename))
        path_ant.write_bytes(await read_upload_limited(archivo_antigua))
        path_nue.write_bytes(await read_upload_limited(archivo_nueva))

        content, filename, stats = generar_consolidacion_bytes(path_ant, path_nue)
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
            detail=generic_error_detail(e, "consolidación EMIN"),
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
