"""
Copia todos los datos de SQLite local (users.db) a MySQL (Docker u otro).

Uso (desde backend/):
  set MYSQL_SYNC_URL=mysql+pymysql://herramientas:PASS@127.0.0.1:3306/herramientas?charset=utf8mb4
  py sync_sqlite_to_mysql.py

O lee MYSQL_* / DATABASE_URL del .env de la raíz del repo / backend/.env.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import models


def _mysql_url() -> str:
    explicit = os.getenv("MYSQL_SYNC_URL") or os.getenv("TARGET_DATABASE_URL")
    if explicit:
        url = explicit.strip()
        if url.startswith("mysql://"):
            url = "mysql+pymysql://" + url[len("mysql://") :]
        return url

    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = os.getenv("MYSQL_PORT", "3306")
    db = os.getenv("MYSQL_DATABASE", "herramientas")
    user = os.getenv("MYSQL_USER", "herramientas")
    password = os.getenv("MYSQL_PASSWORD", "")
    if not password:
        print("[ERROR] Define MYSQL_SYNC_URL o MYSQL_PASSWORD (y resto MYSQL_*).")
        sys.exit(1)
    return (
        f"mysql+pymysql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{db}?charset=utf8mb4"
    )


def main() -> None:
    sqlite_path = Path(__file__).parent / "users.db"
    if not sqlite_path.is_file():
        print(f"[ERROR] No existe {sqlite_path}")
        sys.exit(1)

    mysql_url = _mysql_url()
    print("==================================================")
    print("  Migracion Local SQLite -> MySQL (Docker)        ")
    print("==================================================")
    print(f" Origen: {sqlite_path}")
    print(f" Destino: {mysql_url.split('@')[-1]}")

    src_engine = create_engine(f"sqlite:///{sqlite_path.as_posix()}")
    dst_engine = create_engine(mysql_url)

    models.Base.metadata.create_all(bind=dst_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)
    src = SrcSession()
    dst = DstSession()

    try:
        # Orden por FKs: hijos primero al borrar; padres primero al insertar
        print("\n -> Limpiando tablas destino...")
        dst.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for table in (
            "profile_courses",
            "induction_profiles",
            "moodle_courses",
            "app_data",
            "users",
        ):
            dst.execute(text(f"DELETE FROM {table}"))
        dst.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        dst.commit()

        # Users
        users = src.query(models.User).all()
        print(f"\n[1/5] Usuarios: {len(users)}")
        for u in users:
            dst.add(
                models.User(
                    id=u.id,
                    username=u.username,
                    hashed_password=u.hashed_password,
                    role=u.role,
                    permissions_json=u.permissions_json,
                    email=getattr(u, "email", "") or "",
                    nombre=getattr(u, "nombre", "") or "",
                    apellido=getattr(u, "apellido", "") or "",
                    must_change_password=bool(getattr(u, "must_change_password", False)),
                )
            )
        dst.flush()

        # AppData
        app_rows = src.query(models.AppData).all()
        print(f"[2/5] AppData: {len(app_rows)}")
        for row in app_rows:
            dst.add(
                models.AppData(
                    id=row.id,
                    username=row.username,
                    module_name=row.module_name,
                    payload_json=row.payload_json,
                )
            )
        dst.flush()

        # Moodle courses
        courses = src.query(models.MoodleCourse).all()
        print(f"[3/5] Cursos Moodle: {len(courses)}")
        for c in courses:
            dst.add(
                models.MoodleCourse(
                    id=c.id,
                    moodle_id=c.moodle_id,
                    shortname=c.shortname,
                    fullname=c.fullname or "",
                    visible=c.visible if c.visible is not None else 1,
                )
            )
        dst.flush()

        # Profiles
        profiles = src.query(models.InductionProfile).all()
        print(f"[4/5] Perfiles: {len(profiles)}")
        for p in profiles:
            dst.add(
                models.InductionProfile(
                    id=p.id,
                    name=p.name,
                    name_key=p.name_key,
                )
            )
        dst.flush()

        # Profile courses
        links = src.query(models.ProfileCourse).all()
        print(f"[5/5] Cursos por perfil: {len(links)}")
        for link in links:
            dst.add(
                models.ProfileCourse(
                    id=link.id,
                    profile_id=link.profile_id,
                    course_id=link.course_id,
                    sort_order=link.sort_order or 0,
                )
            )

        dst.commit()
        print("\n==================================================")
        print(" Migracion completada. Reinicia el backend Docker:")
        print("   docker compose restart backend")
        print(" Luego entra con tus usuarios/claves locales.")
        print("==================================================")
    except Exception as e:
        dst.rollback()
        print(f"\n[ERROR] {e}")
        sys.exit(1)
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
