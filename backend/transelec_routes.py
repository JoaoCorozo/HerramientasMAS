"""Rutas API generador Transelec."""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from deps import require_permission
from security_utils import generic_error_detail, read_upload_limited, safe_upload_filename
from transelec_db import ensure_transelec_seeded, get_catalog, save_catalog
from transelec_parser import (
    generar_csv_alta_bytes,
    generar_csv_matriz_bytes,
    parsear_solicitud_altas,
    procesar_matriz,
)

router = APIRouter(prefix="/api/generador/transelec", tags=["transelec"])


class ParseTextBody(BaseModel):
    texto: str


class GenerarAltaBody(BaseModel):
    email: str
    rut: str
    firstname: str
    lastname: str
    grupo: str
    forzar_email_no_transelec: bool = False


class CatalogBody(BaseModel):
    cursos: list[str]
    grupos: list[str]


class CursoNombreBody(BaseModel):
    nombre: str


class GrupoNombreBody(BaseModel):
    nombre: str


class EliminarCursosBody(BaseModel):
    nombres: list[str]


def _excel_name_ok(filename: str | None) -> str:
    name = Path(filename or "upload.xlsx").name
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(status_code=400, detail="Solo Excel (.xlsx, .xls) o CSV.")
    return name


@router.get("/config")
def api_transelec_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    ensure_transelec_seeded(db)
    return get_catalog(db)


@router.put("/config")
def api_transelec_config_update(
    body: CatalogBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    cursos = [c.strip() for c in body.cursos if c.strip()]
    grupos = [g.strip() for g in body.grupos if g.strip()]
    return save_catalog(db, cursos, grupos)


@router.post("/cursos")
def api_transelec_add_curso(
    body: CursoNombreBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre de curso vacío.")
    cat = get_catalog(db)
    if nombre in cat["cursos"]:
        raise HTTPException(status_code=400, detail="El curso ya existe.")
    cat["cursos"].append(nombre)
    return save_catalog(db, cat["cursos"], cat["grupos"])


@router.post("/cursos/eliminar")
def api_transelec_delete_cursos(
    body: EliminarCursosBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    eliminar = set(body.nombres)
    cat = get_catalog(db)
    cat["cursos"] = [c for c in cat["cursos"] if c not in eliminar]
    return save_catalog(db, cat["cursos"], cat["grupos"])


@router.post("/grupos")
def api_transelec_add_grupo(
    body: GrupoNombreBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre de grupo vacío.")
    cat = get_catalog(db)
    if nombre in cat["grupos"]:
        raise HTTPException(status_code=400, detail="El grupo ya existe.")
    cat["grupos"].append(nombre)
    return save_catalog(db, cat["cursos"], cat["grupos"])


@router.post("/altas/parse-texto")
def api_altas_parse_texto(
    body: ParseTextBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    try:
        return parsear_solicitud_altas(texto=body.texto)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/altas/parse-archivo")
async def api_altas_parse_archivo(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        safe = _excel_name_ok(file.filename)
        path = Path(temp_dir) / safe
        path.write_bytes(await read_upload_limited(file))
        return parsear_solicitud_altas(ruta_archivo=path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/altas/generar")
def api_altas_generar(
    body: GenerarAltaBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("generador")),
):
    ensure_transelec_seeded(db)
    cat = get_catalog(db)
    if not body.rut.strip() or not body.firstname.strip():
        raise HTTPException(status_code=400, detail="RUT y firstname son obligatorios.")
    if not body.email.strip():
        raise HTTPException(status_code=400, detail="Correo obligatorio.")
    if not body.grupo.strip():
        raise HTTPException(status_code=400, detail="Selecciona un grupo.")
    if not cat["cursos"]:
        raise HTTPException(status_code=400, detail="No hay cursos en el catálogo.")
    email = body.email.strip().lower()
    if not email.endswith("@transelec.cl") and not body.forzar_email_no_transelec:
        raise HTTPException(
            status_code=400,
            detail="El correo no es @transelec.cl. Confirma para generar igual.",
        )
    datos = {
        "email": email,
        "rut": body.rut,
        "firstname": body.firstname,
        "lastname": body.lastname,
    }
    content, filename = generar_csv_alta_bytes(datos, cat["cursos"], body.grupo.strip())
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/matriz/preview")
async def api_matriz_preview(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        safe = _excel_name_ok(file.filename)
        path = Path(temp_dir) / safe
        path.write_bytes(await read_upload_limited(file))
        return procesar_matriz(path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "previsualización matriz"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/matriz/generar")
async def api_matriz_generar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("generador")),
):
    temp_dir = tempfile.mkdtemp()
    try:
        safe = _excel_name_ok(file.filename)
        path = Path(temp_dir) / safe
        path.write_bytes(await read_upload_limited(file))
        resultado = procesar_matriz(path)
        if resultado["total"] == 0:
            raise HTTPException(status_code=400, detail="No se generaron filas válidas.")
        content, filename = generar_csv_matriz_bytes(resultado)
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=generic_error_detail(e, "generación matriz"))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
