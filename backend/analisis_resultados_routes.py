"""API Análisis de Resultados (informe de respuestas Moodle / LMS)."""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

import models
from analisis_resultados import analizar_respuestas, build_excel_analisis
from deps import require_permission
from security_utils import generic_error_detail, read_upload_limited, safe_upload_filename

router = APIRouter(prefix="/api/analisis-resultados", tags=["analisis-resultados"])


async def _save_upload(upload: UploadFile, temp_dir: Path) -> Path:
    safe = safe_upload_filename(upload.filename)
    path = temp_dir / safe
    data = await read_upload_limited(upload)
    path.write_bytes(data)
    return path


@router.post("/preview")
async def api_analisis_preview(
    respuestas: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("analisis_resultados")),
):
    temp_dir = Path(tempfile.mkdtemp())
    try:
        path_r = await _save_upload(respuestas, temp_dir)
        result = analizar_respuestas(path_r)
        return {
            "resumen": result["resumen"],
            "validacion": result["validacion"],
            "metodologia": result["metodologia"],
            "preview_preguntas_dificiles": result["preview_preguntas_dificiles"],
            "preview_nominativos": result["preview_nominativos"],
            "preview_detalle": result["preview_detalle"],
            "total_preguntas": len(result["preguntas"]),
            "total_detalle": len(result["detalle_respuestas"]),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "análisis de resultados"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/excel")
async def api_analisis_excel(
    respuestas: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("analisis_resultados")),
):
    temp_dir = Path(tempfile.mkdtemp())
    try:
        path_r = await _save_upload(respuestas, temp_dir)
        result = analizar_respuestas(path_r)
        content, filename = build_excel_analisis(result)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "exportación análisis"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
