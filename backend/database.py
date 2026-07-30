import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import SQLALCHEMY_DATABASE_URL


def normalize_database_url(url: str) -> str:
    """Normaliza URLs comunes a drivers SQLAlchemy."""
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://") :]
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


SQLALCHEMY_DATABASE_URL_NORMALIZED = normalize_database_url(SQLALCHEMY_DATABASE_URL)

connect_args: dict = {}
engine_kwargs: dict = {}

if SQLALCHEMY_DATABASE_URL_NORMALIZED.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif SQLALCHEMY_DATABASE_URL_NORMALIZED.startswith("mysql"):
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
    }
elif SQLALCHEMY_DATABASE_URL_NORMALIZED.startswith("postgresql"):
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

engine = create_engine(
    SQLALCHEMY_DATABASE_URL_NORMALIZED,
    connect_args=connect_args,
    **engine_kwargs,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_user_schema() -> None:
    """Agrega columnas nuevas en `users` sin Alembic (SQLite / MySQL / PostgreSQL)."""
    insp = inspect(engine)
    if not insp.has_table("users"):
        return
    existing = {col["name"] for col in insp.get_columns("users")}
    dialect = engine.dialect.name
    alters: list[str] = []
    if "email" not in existing:
        if dialect == "sqlite":
            alters.append("ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT ''")
        else:
            alters.append("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL")
    if "nombre" not in existing:
        if dialect == "sqlite":
            alters.append("ALTER TABLE users ADD COLUMN nombre VARCHAR(100) DEFAULT ''")
        else:
            alters.append("ALTER TABLE users ADD COLUMN nombre VARCHAR(100) NULL")
    if "apellido" not in existing:
        if dialect == "sqlite":
            alters.append("ALTER TABLE users ADD COLUMN apellido VARCHAR(100) DEFAULT ''")
        else:
            alters.append("ALTER TABLE users ADD COLUMN apellido VARCHAR(100) NULL")
    if "must_change_password" not in existing:
        if dialect == "sqlite":
            alters.append(
                "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0 NOT NULL"
            )
        elif dialect == "mysql":
            alters.append(
                "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0"
            )
        else:
            alters.append(
                "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE"
            )
    if not alters:
        return
    with engine.begin() as conn:
        for stmt in alters:
            conn.execute(text(stmt))
