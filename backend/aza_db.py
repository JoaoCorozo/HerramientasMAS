"""Catálogo editable AZA (empresas + mallas/tipousuario) en AppData."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

import models
from aza_comparador import NOMBRE_MALLA_OFICIAL

AZA_SHARED_USER = "__aza__"
AZA_MODULE = "altas_catalog"

# Valores vigentes al primer arranque.
DEFAULT_EMPRESAS = [
    "ACEROS AZA S.A.",
    "ACEROS COX COMERCIAL S.A.",
    "SALOMÓN SACK S.A.",
    "ARMACERO MATCO S.A.",
    "AZA",
    "EcoAZA",
]

DEFAULT_MALLAS: list[dict[str, str]] = [
    {"tipousuario": "1", "malla": "AZA"},
    {"tipousuario": "2", "malla": "AZA Comercial"},
    {"tipousuario": "3", "malla": "Filiales"},
    {"tipousuario": "4", "malla": "Filiales Comercial"},
    {"tipousuario": "5", "malla": "Aza Lideres Operación / Ingenieros / Trainee"},
    {"tipousuario": "6", "malla": "EcoAZA"},
    {"tipousuario": "7", "malla": "Prof / Adm / Lideres Transversales AZA"},
]

# Mallas alineadas con el comparador AZA
assert {m["tipousuario"]: m["malla"] for m in DEFAULT_MALLAS} == NOMBRE_MALLA_OFICIAL


def default_catalog() -> dict[str, Any]:
    return {
        "empresas": list(DEFAULT_EMPRESAS),
        "mallas": [dict(x) for x in DEFAULT_MALLAS],
    }


def _get_record(db: Session) -> models.AppData | None:
    return (
        db.query(models.AppData)
        .filter(
            models.AppData.username == AZA_SHARED_USER,
            models.AppData.module_name == AZA_MODULE,
        )
        .first()
    )


def _normalize_mallas(raw: Any) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if not isinstance(raw, list):
        return out
    seen_tipos: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        tipo = str(item.get("tipousuario") or "").strip()
        nombre = str(item.get("malla") or "").strip()
        if not tipo or not nombre:
            continue
        if tipo in seen_tipos:
            continue
        seen_tipos.add(tipo)
        out.append({"tipousuario": tipo, "malla": nombre})
    out.sort(key=lambda m: (int(m["tipousuario"]) if m["tipousuario"].isdigit() else 999, m["tipousuario"]))
    return out


def _normalize_empresas(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for e in raw:
        nombre = str(e or "").strip()
        if not nombre:
            continue
        key = nombre.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(nombre)
    return out


def get_catalog(db: Session) -> dict[str, Any]:
    """Lee catálogo; si no hay datos guardados, siembra y devuelve los valores por defecto."""
    ensure_aza_seeded(db)
    rec = _get_record(db)
    if rec and rec.payload_json:
        try:
            data = json.loads(rec.payload_json)
            empresas = _normalize_empresas(data.get("empresas"))
            mallas = _normalize_mallas(data.get("mallas"))
            if empresas and mallas:
                return {"empresas": empresas, "mallas": mallas}
        except json.JSONDecodeError:
            pass
    return default_catalog()


def save_catalog(
    db: Session,
    *,
    empresas: list[str],
    mallas: list[dict[str, str]],
) -> dict[str, Any]:
    empresas_n = _normalize_empresas(empresas)
    mallas_n = _normalize_mallas(mallas)
    if not empresas_n:
        raise ValueError("Debe haber al menos una empresa.")
    if not mallas_n:
        raise ValueError("Debe haber al menos una malla (tipousuario + nombre).")
    payload = json.dumps(
        {"empresas": empresas_n, "mallas": mallas_n},
        ensure_ascii=False,
    )
    rec = _get_record(db)
    if rec:
        rec.payload_json = payload
    else:
        db.add(
            models.AppData(
                username=AZA_SHARED_USER,
                module_name=AZA_MODULE,
                payload_json=payload,
            )
        )
    db.commit()
    return {"empresas": empresas_n, "mallas": mallas_n}


def ensure_aza_seeded(db: Session) -> None:
    """Primer arranque: persiste defaults. Si ya hay catálogo, agrega empresas/mallas faltantes."""
    rec = _get_record(db)
    if rec and rec.payload_json:
        try:
            data = json.loads(rec.payload_json)
            empresas = _normalize_empresas(data.get("empresas"))
            mallas = _normalize_mallas(data.get("mallas"))
            if empresas and mallas:
                changed = False
                emp_keys = {e.casefold() for e in empresas}
                for e in DEFAULT_EMPRESAS:
                    if e.casefold() not in emp_keys:
                        empresas.append(e)
                        emp_keys.add(e.casefold())
                        changed = True
                tipos = {m["tipousuario"] for m in mallas}
                for dm in DEFAULT_MALLAS:
                    if dm["tipousuario"] not in tipos:
                        mallas.append(dict(dm))
                        tipos.add(dm["tipousuario"])
                        changed = True
                if changed:
                    save_catalog(db, empresas=empresas, mallas=mallas)
                return
        except json.JSONDecodeError:
            pass
    defaults = default_catalog()
    save_catalog(db, empresas=defaults["empresas"], mallas=defaults["mallas"])
