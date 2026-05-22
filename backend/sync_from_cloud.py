import os
import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

# Asegurar que el directorio de backend esté en el path para importar models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import models

# 1. Configuración de URLs (definir POSTGRES_DATABASE_URL en backend/.env)
SQLITE_URL = "sqlite:///./users.db"
POSTGRES_URL = os.getenv("POSTGRES_DATABASE_URL")
if not POSTGRES_URL:
    print("[ERROR] Defina POSTGRES_DATABASE_URL antes de sincronizar desde la nube.")
    sys.exit(1)

sqlite_engine = create_engine(SQLITE_URL)
SqliteSession = sessionmaker(bind=sqlite_engine)

postgres_engine = create_engine(POSTGRES_URL)
PostgresSession = sessionmaker(bind=postgres_engine)

def main():
    print("==================================================")
    print(" Descargando Datos de la Nube a tu PC Local...   ")
    print("==================================================")
    
    # Asegurar que existan las tablas locales
    print("\n -> Verificando tablas en tu base de datos local...")
    models.Base.metadata.create_all(bind=sqlite_engine)
    
    pg_db = PostgresSession()
    sl_db = SqliteSession()

    try:
        # --- 1. Sincronizar Usuarios de la Nube a Local ---
        print("\n[1/2] Descargando Usuarios...")
        cloud_users = pg_db.query(models.User).all()
        
        print(" -> Limpiando usuarios antiguos locales...")
        sl_db.query(models.User).delete()
        
        for u in cloud_users:
            new_u = models.User(
                username=u.username,
                hashed_password=u.hashed_password,
                role=u.role,
                permissions_json=u.permissions_json
            )
            sl_db.add(new_u)
            print(f"    + Usuario '{u.username}' descargado a tu PC.")
            
        # --- 2. Sincronizar Datos de Módulos (AppData) de la Nube a Local ---
        print("\n[2/2] Descargando Datos de los Módulos...")
        cloud_data = pg_db.query(models.AppData).all()
        
        print(" -> Limpiando datos locales antiguos...")
        sl_db.query(models.AppData).delete()
        
        for d in cloud_data:
            new_d = models.AppData(
                username=d.username,
                module_name=d.module_name,
                payload_json=d.payload_json
            )
            sl_db.add(new_d)
            print(f"    + Datos de '{d.module_name}' ({d.username}) descargados a tu PC.")
            
        # Guardar todos los cambios locales
        sl_db.commit()
        print("\n==================================================")
        print(" ¡Descarga e Importación Completada Exitosamente! ")
        print(" Tu base de datos local está sincronizada con ")
        print(" todo lo que tienes actualmente en internet.       ")
        print(" Puedes iniciar tu app local y verás todos tus datos. ")
        print("==================================================")
        
    except Exception as e:
        sl_db.rollback()
        print(f"\n[ERROR] Ocurrió un fallo durante la descarga: {e}")
    finally:
        pg_db.close()
        sl_db.close()

if __name__ == "__main__":
    main()
