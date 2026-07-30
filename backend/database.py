import os

from sqlalchemy import create_engine
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
    # Evita conexiones muertas tras idle (Docker / proxies)
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
