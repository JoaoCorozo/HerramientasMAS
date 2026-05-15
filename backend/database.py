from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import os

# SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"
# Fallback a Produccion si no se detecta la variable
DEFAULT_URL = "postgresql://neondb_owner:npg_9HSUXfrkqB7C@ep-silent-leaf-acaw6aak.sa-east-1.aws.neon.tech/neondb?sslmode=require"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_URL)

# engine = create_engine(
#     SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
# )
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
