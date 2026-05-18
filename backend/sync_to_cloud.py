import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Asegurar que el directorio de backend esté en el path para importar models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import models

# 1. Configuración de URLs
SQLITE_URL = "sqlite:///./users.db"
# URL de producción oficial en Neon
POSTGRES_URL = "postgresql://neondb_owner:npg_9HSUXfrkqB7C@ep-silent-leaf-acaw6aak.sa-east-1.aws.neon.tech/neondb?sslmode=require"

sqlite_engine = create_engine(SQLITE_URL)
SqliteSession = sessionmaker(bind=sqlite_engine)

postgres_engine = create_engine(POSTGRES_URL)
PostgresSession = sessionmaker(bind=postgres_engine)

def main():
    print("==================================================")
    print(" Sincronizando Base de Datos Local a la Nube...")
    print("==================================================")
    
    # 1. Verificar que la base de datos SQLite local exista
    if not os.path.exists("./users.db"):
        print("\n[ERROR] No se encontró el archivo local 'users.db' en el directorio de ejecución.")
        print("Asegúrate de haber iniciado la aplicación local al menos una vez para generar los datos.")
        return

    # Asegurar que existan las tablas en Postgres
    print("\n -> Creando tablas en la nube si no existen...")
    models.Base.metadata.create_all(bind=postgres_engine)
    
    pg_db = PostgresSession()
    sl_db = SqliteSession()

    try:
        # --- 1. Sincronizar Usuarios ---
        print("\n[1/2] Sincronizando Usuarios...")
        local_users = sl_db.query(models.User).all()
        
        print(" -> Limpiando usuarios antiguos en la nube...")
        pg_db.query(models.User).delete()
        
        for u in local_users:
            new_u = models.User(
                username=u.username,
                hashed_password=u.hashed_password,
                role=u.role,
                permissions_json=u.permissions_json
            )
            pg_db.add(new_u)
            print(f"    + Usuario '{u.username}' preparado.")
            
        # --- 2. Sincronizar Datos de Módulos (AppData) ---
        print("\n[2/2] Sincronizando Datos de los Módulos...")
        local_data = sl_db.query(models.AppData).all()
        
        print(" -> Limpiando datos antiguos en la nube...")
        pg_db.query(models.AppData).delete()
        
        for d in local_data:
            new_d = models.AppData(
                username=d.username,
                module_name=d.module_name,
                payload_json=d.payload_json
            )
            pg_db.add(new_d)
            print(f"    + Datos de '{d.module_name}' ({d.username}) preparados.")
            
        # Guardar todos los cambios en la nube
        pg_db.commit()
        print("\n==================================================")
        print(" ¡Sincronización completada exitosamente!")
        print(" Todos los datos locales se han subido a la nube.")
        print("==================================================")
        
    except Exception as e:
        pg_db.rollback()
        print(f"\n[ERROR] Ocurrió un fallo durante la sincronización: {e}")
    finally:
        pg_db.close()
        sl_db.close()

if __name__ == "__main__":
    main()
