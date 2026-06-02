"""
Catálogo y perfiles de inducción en base de datos.
El Excel «cursos bex Moodle» solo alimenta el catálogo (y el seed inicial de perfiles).
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

import models
from matriz_cursos import (
    _build_catalog,
    _build_profile_index,
    _read_ids_from_profile_sheet,
    normalize_text,
    read_workbook_sheets,
    _header_map,
    _is_catalog_sheet,
)
from paths import resolve_all_matriz_paths

logger = logging.getLogger("matriz_db")


def sync_catalog_from_excel(db: Session) -> int:
    """Importa/actualiza cursos desde el Excel catálogo. Devuelve cantidad upserted."""
    paths = resolve_all_matriz_paths()
    if not paths:
        return 0

    catalog: dict[str, str] = {}
    fullnames: dict[str, str] = {}
    visible_map: dict[str, int] = {}

    for path in paths:
        sheets = read_workbook_sheets(path)
        for sname, rows in sheets.items():
            if not rows:
                continue
            headers = _header_map(rows[0])
            if not _is_catalog_sheet(sname, headers):
                continue
            id_idx = headers.get("id")
            sn_idx = headers.get("shortname")
            fn_idx = headers.get("fullname")
            vis_idx = headers.get("visible")
            if id_idx is None or sn_idx is None:
                continue
            for row in rows[1:]:
                if id_idx >= len(row):
                    continue
                try:
                    mid = int(float(row[id_idx]))
                except (TypeError, ValueError):
                    continue
                sn = str(row[sn_idx]).strip() if sn_idx < len(row) else ""
                if not sn:
                    continue
                key = str(mid)
                catalog[key] = sn
                if fn_idx is not None and fn_idx < len(row):
                    fullnames[key] = str(row[fn_idx]).strip()
                if vis_idx is not None and vis_idx < len(row):
                    try:
                        visible_map[key] = int(float(row[vis_idx]))
                    except (TypeError, ValueError):
                        visible_map[key] = 1

    count = 0
    for mid_str, shortname in catalog.items():
        mid = int(mid_str)
        existing = (
            db.query(models.MoodleCourse)
            .filter(models.MoodleCourse.moodle_id == mid)
            .first()
        )
        if existing:
            existing.shortname = shortname
            existing.fullname = fullnames.get(mid_str, existing.fullname or "")
            existing.visible = visible_map.get(mid_str, existing.visible or 1)
        else:
            db.add(
                models.MoodleCourse(
                    moodle_id=mid,
                    shortname=shortname,
                    fullname=fullnames.get(mid_str, ""),
                    visible=visible_map.get(mid_str, 1),
                )
            )
        count += 1
    db.commit()
    return count


def seed_profiles_from_excel(db: Session, *, replace_existing: bool = False) -> int:
    """Crea perfiles y sus ids de curso desde hojas del Excel (solo si no existen o replace)."""
    paths = resolve_all_matriz_paths()
    if not paths:
        return 0

    sync_catalog_from_excel(db)

    profile_index: dict[str, dict[str, Any]] = {}
    for path in paths:
        sheets = read_workbook_sheets(path)
        profile_index.update(_build_profile_index(sheets))

    if not profile_index:
        from pathlib import Path

        legacy = Path(__file__).resolve().parents[1] / "MATRIZ_CURSOS_BEX.xlsx"
        if legacy.is_file():
            sheets = read_workbook_sheets(str(legacy))
            profile_index.update(_build_profile_index(sheets))

    created = 0
    for key, data in profile_index.items():
        name = data["sheet_name"]
        existing = (
            db.query(models.InductionProfile)
            .filter(models.InductionProfile.name_key == key)
            .first()
        )
        if existing and not replace_existing:
            _set_profile_courses_by_moodle_ids(db, existing.id, data["ids"])
            continue
        if existing and replace_existing:
            db.query(models.ProfileCourse).filter(
                models.ProfileCourse.profile_id == existing.id
            ).delete()
            existing.name = name
            _set_profile_courses_by_moodle_ids(db, existing.id, data["ids"])
            continue

        profile = models.InductionProfile(name=name, name_key=key)
        db.add(profile)
        db.flush()
        _set_profile_courses_by_moodle_ids(db, profile.id, data["ids"])
        created += 1

    db.commit()
    return created


def _set_profile_courses_by_moodle_ids(
    db: Session, profile_id: int, moodle_ids: list[str]
) -> None:
    db.query(models.ProfileCourse).filter(
        models.ProfileCourse.profile_id == profile_id
    ).delete()
    for order, mid_str in enumerate(moodle_ids):
        course = (
            db.query(models.MoodleCourse)
            .filter(models.MoodleCourse.moodle_id == int(mid_str))
            .first()
        )
        if course:
            db.add(
                models.ProfileCourse(
                    profile_id=profile_id,
                    course_id=course.id,
                    sort_order=order,
                )
            )


def ensure_matriz_seeded(db: Session) -> None:
    course_count = db.query(models.MoodleCourse).count()
    if course_count == 0:
        n = sync_catalog_from_excel(db)
        logger.info("Catálogo Moodle importado: %s cursos", n)

    profile_count = db.query(models.InductionProfile).count()
    if profile_count == 0:
        n = seed_profiles_from_excel(db)
        logger.info("Perfiles de inducción importados desde Excel: %s perfiles", n)


def courses_for_perfil(db: Session, perfil_norm: str, perfil_display: str = "") -> list[str]:
    profile = (
        db.query(models.InductionProfile)
        .filter(models.InductionProfile.name_key == perfil_norm)
        .first()
    )
    if not profile and perfil_display:
        profile = (
            db.query(models.InductionProfile)
            .filter(models.InductionProfile.name_key == normalize_text(perfil_display))
            .first()
        )
    if not profile:
        for p in db.query(models.InductionProfile).all():
            if perfil_norm in p.name_key or p.name_key in perfil_norm:
                profile = p
                break

    if not profile:
        return []

    links = (
        db.query(models.ProfileCourse)
        .filter(models.ProfileCourse.profile_id == profile.id)
        .order_by(models.ProfileCourse.sort_order)
        .all()
    )
    result: list[str] = []
    for link in links:
        if link.course and link.course.shortname:
            result.append(link.course.shortname)
    return result


def get_matriz_info_db(db: Session) -> dict[str, Any]:
    courses_n = db.query(models.MoodleCourse).count()
    profiles = db.query(models.InductionProfile).order_by(models.InductionProfile.name).all()
    perfiles_out = []
    for p in profiles:
        links = (
            db.query(models.ProfileCourse)
            .filter(models.ProfileCourse.profile_id == p.id)
            .order_by(models.ProfileCourse.sort_order)
            .all()
        )
        shortnames = [lnk.course.shortname for lnk in links if lnk.course]
        perfiles_out.append(
            {
                "id": p.id,
                "hoja": p.name,
                "clave": p.name_key,
                "cantidad_ids": len(links),
                "cursos": shortnames[:5],
            }
        )
    return {
        "loaded": courses_n > 0,
        "source": "database",
        "catalogo_cursos": courses_n,
        "perfiles": perfiles_out,
    }


def list_courses(db: Session, search: str = "", limit: int = 500) -> list[dict]:
    from sqlalchemy import String, func

    q = db.query(models.MoodleCourse).order_by(models.MoodleCourse.shortname)
    if search:
        term = f"%{search.strip().lower()}%"
        q = q.filter(
            func.lower(models.MoodleCourse.shortname).like(term)
            | func.lower(models.MoodleCourse.fullname).like(term)
            | func.cast(models.MoodleCourse.moodle_id, String).like(
                search.strip().replace("%", "")
            )
        )
    rows = q.limit(limit).all()
    return [
        {
            "id": c.id,
            "moodle_id": c.moodle_id,
            "shortname": c.shortname,
            "fullname": c.fullname,
            "visible": c.visible,
        }
        for c in rows
    ]


def list_profiles(db: Session) -> list[dict]:
    from sqlalchemy.orm import joinedload

    profiles = db.query(models.InductionProfile).order_by(models.InductionProfile.name).all()
    out = []
    for p in profiles:
        links = (
            db.query(models.ProfileCourse)
            .options(joinedload(models.ProfileCourse.course))
            .filter(models.ProfileCourse.profile_id == p.id)
            .order_by(models.ProfileCourse.sort_order)
            .all()
        )
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "name_key": p.name_key,
                "course_moodle_ids": [lnk.course.moodle_id for lnk in links if lnk.course],
                "courses": [
                    {
                        "moodle_id": lnk.course.moodle_id,
                        "shortname": lnk.course.shortname,
                    }
                    for lnk in links
                    if lnk.course
                ],
            }
        )
    return out


def create_profile(db: Session, name: str, course_moodle_ids: list[int]) -> dict:
    key = normalize_text(name)
    if db.query(models.InductionProfile).filter(models.InductionProfile.name_key == key).first():
        raise ValueError("Ya existe un perfil con ese nombre")
    profile = models.InductionProfile(name=name.strip(), name_key=key)
    db.add(profile)
    db.flush()
    _set_profile_courses_by_moodle_ids(db, profile.id, [str(i) for i in course_moodle_ids])
    db.commit()
    profiles = list_profiles(db)
    return next(p for p in profiles if p["id"] == profile.id)


def update_profile(
    db: Session, profile_id: int, name: str | None, course_moodle_ids: list[int] | None
) -> dict:
    profile = db.query(models.InductionProfile).filter(models.InductionProfile.id == profile_id).first()
    if not profile:
        raise ValueError("Perfil no encontrado")
    if name is not None:
        new_key = normalize_text(name)
        other = (
            db.query(models.InductionProfile)
            .filter(
                models.InductionProfile.name_key == new_key,
                models.InductionProfile.id != profile_id,
            )
            .first()
        )
        if other:
            raise ValueError("Ya existe otro perfil con ese nombre")
        profile.name = name.strip()
        profile.name_key = new_key
    if course_moodle_ids is not None:
        _set_profile_courses_by_moodle_ids(
            db, profile_id, [str(i) for i in course_moodle_ids]
        )
    db.commit()
    return next(p for p in list_profiles(db) if p["id"] == profile_id)


def delete_profile(db: Session, profile_id: int) -> None:
    profile = db.query(models.InductionProfile).filter(models.InductionProfile.id == profile_id).first()
    if not profile:
        raise ValueError("Perfil no encontrado")
    db.delete(profile)
    db.commit()
