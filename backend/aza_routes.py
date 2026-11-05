"""Rutas API AZA: comparador de nóminas y altas CSV."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from aza_altas import construir_fila, generar_csv_bytes, preview_transformacion
from aza_comparador import generar_reporte_bytes
from aza_db import ensure_aza_seeded, get_catalog, save_catalog
from database import get_db
from deps import require_permission
from security_utils import generic_error_detail, read_upload_limited, safe_csv_filename

router = APIRouter(prefix="/api/generador/aza", tags=["aza"])


def _nomina_csv_ok(filename: str | None) -> str:
    return safe_csv_filename(filename)


class AzaAltaPersona(BaseModel):
    nombre: str = ""
    rut: str = ""
    correo: str = ""
    email: str = ""
    empresa: str = ""
    malla: str = ""
    tipousuario: str = ""
    firstname: str = ""
    lastname: str = ""


class AzaAltasRequest(BaseModel):
    personas: list[AzaAltaPersona] = Field(default_factory=list)


class AzaMallaItem(BaseModel):
    tipousuario: str
    malla: str


class AzaCatalogBody(BaseModel):
    empresas: list[str] = Field(default_factory=list)
    mallas: list[AzaMallaItem] = Field(default_factory=list)


@router.get("/altas/catalogo")
def api_aza_altas_catalogo(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    cat = get_catalog(db)
    return {
        "mallas": cat["mallas"],
        "empresas": cat["empresas"],
        "empresas_sugeridas": cat["empresas"],
        "auth": "saml2",
    }


@router.put("/altas/catalogo")
def api_aza_altas_catalogo_update(
    body: AzaCatalogBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    try:
        return save_catalog(
            db,
            empresas=body.empresas,
            mallas=[m.model_dump() for m in body.mallas],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/altas/preview")
def api_aza_altas_preview(
    body: AzaAltaPersona,
    current_user: models.User = Depends(require_permission("generador")),
):
    try:
        return preview_transformacion(body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/altas/generar")
def api_aza_altas_generar(
    body: AzaAltasRequest,
    current_user: models.User = Depends(require_permission("generador")),
):
    if not body.personas:
        raise HTTPException(status_code=400, detail="Agrega al menos una persona.")
    filas: list[dict[str, Any]] = []
    try:
        for i, p in enumerate(body.personas, start=1):
            try:
                filas.append(
                    construir_fila(
                        nombre=p.nombre,
                        rut=p.rut,
                        correo=p.correo or p.email,
                        empresa=p.empresa,
                        malla=p.malla,
                        tipousuario=p.tipousuario,
                        firstname=p.firstname,
                        lastname=p.lastname,
                    )
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Fila {i}: {e}",
                ) from e
        content, filename = generar_csv_bytes(filas)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "altas AZA")) from e

    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/comparar")
async def api_aza_comparar(
    archivo_cliente: UploadFile = File(...),
    archivo_plataforma: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        path_cli = Path(temp_dir) / _nomina_csv_ok(archivo_cliente.filename)
        path_plat = Path(temp_dir) / _nomina_csv_ok(archivo_plataforma.filename)
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
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "comparación AZA"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
