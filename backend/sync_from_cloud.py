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
