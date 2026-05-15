import os
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

SQLITE_URL = "sqlite:///./users.db"
POSTGRES_URL = "postgresql://neondb_owner:npg_9HSUXfrkqB7C@ep-silent-leaf-acaw6aak.sa-east-1.aws.neon.tech/neondb?sslmode=require"

sqlite_engine = create_engine(SQLITE_URL)
SqliteSession = sessionmaker(bind=sqlite_engine)

postgres_engine = create_engine(POSTGRES_URL)
PostgresSession = sessionmaker(bind=postgres_engine)

# Crear tablas en postgres
models.Base.metadata.create_all(bind=postgres_engine)

def main():
    pg_db = PostgresSession()
    sl_db = SqliteSession()

    print("Migrando Usuarios...")
    users = sl_db.query(models.User).all()
    for u in users:
        exists = pg_db.query(models.User).filter(models.User.username == u.username).first()
        if not exists:
            new_u = models.User(
                username=u.username,
                hashed_password=u.hashed_password,
                role=u.role,
                permissions_json=u.permissions_json
            )
            pg_db.add(new_u)
            print(f"Usuario {u.username} migrado.")
    
    pg_db.commit()

    print("Migrando Archivos JSON a AppData...")
    for f in os.listdir("."):
        if f.endswith("_db.json"):
            parts = f.replace("_db.json", "").split("_")
            if len(parts) >= 2:
                username = parts[0]
                module_name = parts[1]
                
                with open(f, "r", encoding="utf-8") as file:
                    try:
                        data = json.load(file)
                        payload = json.dumps(data)
                        
                        existing = pg_db.query(models.AppData).filter(
                            models.AppData.username == username,
                            models.AppData.module_name == module_name
                        ).first()
                        
                        if existing:
                            existing.payload_json = payload
                        else:
                            new_data = models.AppData(
                                username=username,
                                module_name=module_name,
                                payload_json=payload
                            )
                            pg_db.add(new_data)
                        print(f"Archivo {f} migrado a PostgreSQL.")
                    except Exception as e:
                        print(f"Error procesando {f}: {e}")

    pg_db.commit()
    pg_db.close()
    sl_db.close()
    print("Migracion a Supabase completada con éxito!")

if __name__ == "__main__":
    main()
