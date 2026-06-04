"""Restablecer contraseña de un usuario local (SQLite).

Uso:
  cd backend
  py scripts/reset_password.py admin admin123
  py scripts/reset_password.py Joao mi_nueva_clave
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import auth
import models
from database import SessionLocal


def main() -> None:
    if len(sys.argv) != 3:
        print("Uso: py scripts/reset_password.py <usuario> <nueva_contraseña>")
        sys.exit(1)

    username, new_password = sys.argv[1].strip(), sys.argv[2]
    if not username or not new_password:
        print("Usuario y contraseña son obligatorios.")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username.ilike(username)).first()
        if not user:
            print(f"No existe el usuario «{username}» en la base de datos local.")
            sys.exit(1)
        user.hashed_password = auth.get_password_hash(new_password)
        db.commit()
        print(f"Contraseña actualizada para «{user.username}».")
    finally:
        db.close()


if __name__ == "__main__":
    main()
