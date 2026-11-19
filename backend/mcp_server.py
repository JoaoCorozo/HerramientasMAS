"""Servidor MCP remoto (Streamable HTTP) para Grok Bot / clientes MCP.

Montado en FastAPI bajo `/mcp`. Requiere `MCP_ENABLED=true` y `MCP_API_KEY`.
Grok Bot debe alcanzar la URL por HTTPS público (no localhost ni solo VPN).
"""
from __future__ import annotations

import logging
from typing import Any

import config

logger = logging.getLogger("mcp_server")

MODULE_CATALOG = [
    {"id": "comparador", "ruta": "/", "descripcion": "Comparar dos Excels"},
    {"id": "rut", "ruta": "/rut", "descripcion": "Normalizar RUT chileno"},
    {"id": "textos", "ruta": "/textos", "descripcion": "Normalizar nombres/textos"},
    {"id": "capacitaciones", "ruta": "/capacitaciones", "descripcion": "Tabla de capacitaciones"},
    {"id": "enlaces", "ruta": "/enlaces", "descripcion": "Catálogo de enlaces"},
    {"id": "recordatorios", "ruta": "/recordatorios", "descripcion": "Calendario de tareas"},
    {"id": "generador", "ruta": "/generador", "descripcion": "CSV carga Moodle por perfil"},
    {"id": "consulta_cursos", "ruta": "/consulta-cursos", "descripcion": "Consulta cursos Moodle"},
    {"id": "compresor_video", "ruta": "/compresor-videos", "descripcion": "Compresor MP4"},
    {"id": "analisis_resultados", "ruta": "/analisis-resultados", "descripcion": "Análisis de resultados"},
]


def mcp_enabled() -> bool:
    return bool(getattr(config, "MCP_ENABLED", False) and getattr(config, "MCP_API_KEY", ""))


def build_mcp():
    """Crea la instancia FastMCP autenticada con Bearer token estático."""
    from fastmcp import FastMCP
    from fastmcp.server.auth.providers.jwt import StaticTokenVerifier

    api_key = (config.MCP_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("MCP_API_KEY es obligatorio cuando MCP_ENABLED=true")

    auth = StaticTokenVerifier(
        tokens={
            api_key: {
                "client_id": "grok-bot",
                "scopes": ["plataforma:read", "plataforma:tools"],
            }
        },
        required_scopes=["plataforma:tools"],
    )
    mcp = FastMCP(
        name="Plataforma Herramientas LMS",
        instructions=(
            "Herramientas de la Plataforma LMS BEX/MAS: salud, módulos, RUT, textos, "
            "perfiles de inducción y catálogo Moodle. Usa solo datos de lectura o "
            "normalización; no inventes IDs de curso."
        ),
        auth=auth,
    )

    @mcp.tool
    def platform_health() -> dict[str, Any]:
        """Estado básico de la API (salud, BD, matriz de cursos)."""
        from database import engine
        from paths import resolve_matriz_cursos_path

        dialect = getattr(getattr(engine, "dialect", None), "name", "unknown")
        return {
            "status": "ok",
            "env": config.APP_ENV,
            "database_dialect": dialect,
            "matriz_cursos": bool(resolve_matriz_cursos_path()),
            "mcp": True,
        }

    @mcp.tool
    def list_modules() -> dict[str, Any]:
        """Lista los módulos de la plataforma (id, ruta UI y descripción)."""
        return {"modules": MODULE_CATALOG, "total": len(MODULE_CATALOG)}

    @mcp.tool
    def normalize_rut(
        ruts: str,
        formato: str = "con_guion",
        generar_dv: bool = False,
        validar: bool = True,
        k_minuscula: bool = False,
    ) -> dict[str, Any]:
        """Normaliza una lista de RUT chilenos (uno por línea).

        formato: con_guion | sin_guion | puntos_guion (según rut_utils).
        generar_dv: si True, calcula el dígito verificador cuando falta.
        validar: verifica el DV con módulo 11.
        """
        from rut_utils import normalizar_lista

        return normalizar_lista(
            ruts,
            formato=formato,
            k_minuscula=k_minuscula,
            generar_dv=generar_dv,
            validar=validar,
        )

    @mcp.tool
    def normalize_textos(nombres: str, formato: str = "Título") -> dict[str, Any]:
        """Normaliza nombres/textos (uno por línea).

        formato: Mayúsculas | Minúsculas | Título (o Primera Letra Mayúscula).
        """
        limpios = nombres.replace("'", "").replace('"', "").replace("\r", "")
        lista = [n.strip() for n in limpios.split("\n") if n.strip()]
        out: list[str] = []
        for nom in lista:
            if formato == "Mayúsculas":
                out.append(nom.upper())
            elif formato == "Minúsculas":
                out.append(nom.lower())
            elif formato in ("Primera Letra Mayúscula", "Título", "Title"):
                out.append(nom.title())
            else:
                out.append(nom.strip())
        return {"nombres": "\n".join(out), "total": len(out)}

    @mcp.tool
    def list_induction_profiles() -> dict[str, Any]:
        """Lista perfiles de inducción Moodle y sus cursos asociados."""
        from database import SessionLocal
        from matriz_db import list_profiles

        db = SessionLocal()
        try:
            profiles = list_profiles(db)
            return {"perfiles": profiles, "total": len(profiles)}
        finally:
            db.close()

    @mcp.tool
    def search_moodle_courses(query: str = "", limit: int = 30) -> dict[str, Any]:
        """Busca cursos Moodle del catálogo por shortname, fullname o id."""
        from database import SessionLocal
        from matriz_db import list_courses

        lim = max(1, min(int(limit or 30), 100))
        db = SessionLocal()
        try:
            courses = list_courses(db, search=query or "", limit=lim)
            return {"cursos": courses, "total": len(courses), "query": query or ""}
        finally:
            db.close()

    @mcp.tool
    def courses_for_induction_profile(perfil: str) -> dict[str, Any]:
        """Devuelve los shortnames de cursos Moodle para un perfil de inducción."""
        from database import SessionLocal
        from matriz_db import courses_for_perfil
        from matriz_cursos import normalize_text

        name = (perfil or "").strip()
        if not name:
            return {"error": "Indica el nombre del perfil", "cursos": []}
        db = SessionLocal()
        try:
            key = normalize_text(name)
            courses = courses_for_perfil(db, key, name)
            return {"perfil": name, "perfil_key": key, "cursos": courses, "total": len(courses)}
        finally:
            db.close()

    @mcp.tool
    def matriz_summary() -> dict[str, Any]:
        """Resumen del catálogo Moodle y perfiles cargados en BD."""
        from database import SessionLocal
        from matriz_db import get_matriz_info_db

        db = SessionLocal()
        try:
            return get_matriz_info_db(db)
        finally:
            db.close()

    return mcp


def create_mcp_http_app():
    """ASGI app Streamable HTTP, stateless, para montar en FastAPI en `/mcp`."""
    if not mcp_enabled():
        return None
    try:
        mcp = build_mcp()
        # path="/" porque se monta en /mcp → endpoint final /mcp/
        return mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
    except Exception as exc:
        logger.exception("No se pudo crear el servidor MCP: %s", exc)
        raise
