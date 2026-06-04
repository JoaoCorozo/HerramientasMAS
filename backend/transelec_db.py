"""Catálogo compartido Transelec (cursos altas + grupos) en AppData."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

import models

TRANSELEC_SHARED_USER = "__transelec__"
TRANSELEC_MODULE = "altas_catalog"

DEFAULT_CURSOS = [
    "Inducción Corporativa Transelec",
    "Modelo de Competencias Corporativas (Colaboradores)",
    "Modelo Prevención de Delitos 2025",
    "Tutorial Sistema Gestión de las Comunicaciones (SGC)",
    "Estrategia y Protocolo de Relacionamiento con Propietarios",
    "Regulación Eléctrica Nuevo Proceso de Elaboración de Normas Técnicas",
    "Plataforma PRISA",
    "Transmisión Eléctrica para No-Especialistas",
    "Excel Avanzado y Power BI",
    "Maniobras Operacionales de Subestaciones",
    "Termografía Infrarroja en Sistemas Eléctricos de AT y MT",
    "Lectura de Protecciones",
    "Técnicos de Operación de Subestaciones",
    "Puesta a Tierra",
    "Aspectos de Ingeniería Sísmica Aplicada",
    "Inducción de Seguridad y Salud Ocupacional",
    "Sistema de Gestión de Activos: una mirada estratégica.",
    "Modelo de Prevención de Delitos",
    "Sistema de Gestión de Activos: una mirada estratégica",
    "Regulación Eléctrica",
    "Estrategia Experiencia de Cliente",
    "Atención de clientes Transelec",
    "Módulo Empleado Central",
    "Ley Karin",
    "Modelo de Relacionamiento con Comunidades y Valor Social",
    "Ciberseguridad",
    "DataCamp",
    "Código de Ética Transelec",
    "Estudio de Valorización de la Transmisión (EVT)",
]

DEFAULT_GRUPOS = ["Grupo Dotación 2026"]


def _get_record(db: Session) -> models.AppData | None:
    return (
        db.query(models.AppData)
        .filter(
            models.AppData.username == TRANSELEC_SHARED_USER,
            models.AppData.module_name == TRANSELEC_MODULE,
        )
        .first()
    )


def get_catalog(db: Session) -> dict[str, list[str]]:
    rec = _get_record(db)
    if rec and rec.payload_json:
        try:
            data = json.loads(rec.payload_json)
            return {
                "cursos": list(data.get("cursos") or []),
                "grupos": list(data.get("grupos") or []),
            }
        except json.JSONDecodeError:
            pass
    return {"cursos": [], "grupos": []}


def save_catalog(db: Session, cursos: list[str], grupos: list[str]) -> dict[str, list[str]]:
    payload = json.dumps({"cursos": cursos, "grupos": grupos}, ensure_ascii=False)
    rec = _get_record(db)
    if rec:
        rec.payload_json = payload
    else:
        db.add(
            models.AppData(
                username=TRANSELEC_SHARED_USER,
                module_name=TRANSELEC_MODULE,
                payload_json=payload,
            )
        )
    db.commit()
    return {"cursos": cursos, "grupos": grupos}


def ensure_transelec_seeded(db: Session) -> None:
    cat = get_catalog(db)
    if cat["cursos"] and cat["grupos"]:
        return
    save_catalog(
        db,
        cursos=cat["cursos"] or list(DEFAULT_CURSOS),
        grupos=cat["grupos"] or list(DEFAULT_GRUPOS),
    )
