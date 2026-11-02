"""Descarga del manual de usuario filtrado por permisos."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

import models
from deps import get_current_user
from manual_usuario import build_manual_docx

router = APIRouter(prefix="/api/manual", tags=["manual"])


@router.get("/usuario")
async def descargar_manual_usuario(
    current_user: models.User = Depends(get_current_user),
):
    content, filename, _modules = build_manual_docx(current_user)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
