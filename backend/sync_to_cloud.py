import os
import sys
import json
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
    print("[ERROR] Defina POSTGRES_DATABASE_URL antes de sincronizar a la nube.")
    sys.exit(1)

sqlite_engine = create_engine(SQLITE_URL)
SqliteSession = sessionmaker(bind=sqlite_engine)

postgres_engine = create_engine(POSTGRES_URL)
PostgresSession = sessionmaker(bind=postgres_engine)

def main():
    print("==================================================")
    print("  Sincronización Inteligente (Local -> Nube)      ")
    print("==================================================")
    
    # 1. Verificar que la base de datos SQLite local exista
    if not os.path.exists("./users.db"):
        print("\n[ERROR] No se encontró el archivo local 'users.db' en el directorio de ejecución.")
        print("Asegúrate de haber iniciado la aplicación local al menos una vez para generar los datos.")
        return

    # Asegurar que existan las tablas en Postgres
    print("\n -> Verificando tablas en la nube...")
    models.Base.metadata.create_all(bind=postgres_engine)
    
    pg_db = PostgresSession()
    sl_db = SqliteSession()

    try:
        # --- 1. Sincronizar Usuarios (Smart Merge) ---
        print("\n[1/2] Sincronizando Usuarios...")
        local_users = sl_db.query(models.User).all()
        
        # Mapeamos roles locales para saber quién es superadmin
        superadmins = {u.username for u in local_users if u.role == "superadmin"}
        
        for lu in local_users:
            # Buscar si el usuario ya existe en la nube
            cu = pg_db.query(models.User).filter(models.User.username == lu.username).first()
            if not cu:
                # Si no existe en la nube, lo creamos
                new_u = models.User(
                    username=lu.username,
                    hashed_password=lu.hashed_password,
                    role=lu.role,
                    permissions_json=lu.permissions_json
                )
                pg_db.add(new_u)
                print(f"    [NUEVO] Usuario '{lu.username}' subido a la nube.")
            else:
                # Si ya existe, NO sobrescribimos su contraseña ni datos para evitar pisar cambios en la nube
                # a menos que sea el propio administrador ('Joao' o superadmin) que quiera actualizar sus permisos
                if lu.username in superadmins:
                    cu.role = lu.role
                    cu.permissions_json = lu.permissions_json
                    # Nota: Mantenemos la contraseña de la nube por seguridad si se cambió allí
                    print(f"    [ACTUALIZADO] Permisos del administrador '{lu.username}' sincronizados.")
                else:
                    print(f"    [CONSERVADO] Usuario '{lu.username}' ya existe en la nube. Se conservan sus credenciales web.")

        # --- 2. Sincronizar Datos de Módulos (Smart AppData Merge) ---
        print("\n[2/2] Sincronizando Datos de los Módulos...")
        local_data = sl_db.query(models.AppData).all()
        
        for ld in local_data:
            # Buscar el registro correspondiente en la nube
            cd = pg_db.query(models.AppData).filter(
                models.AppData.username == ld.username,
                models.AppData.module_name == ld.module_name
            ).first()
            
            if not cd:
                # Caso A: No existe en la nube -> Lo subimos directo
                new_d = models.AppData(
                    username=ld.username,
                    module_name=ld.module_name,
                    payload_json=ld.payload_json
                )
                pg_db.add(new_d)
                print(f"    [NUEVO] Módulo '{ld.module_name}' del usuario '{ld.username}' subido.")
            else:
                # Caso B: Existe tanto local como en la nube
                # Si el usuario es el administrador principal (superadmin), sobrescribimos la nube con su local
                if ld.username in superadmins or ld.username == "Joao":
                    cd.payload_json = ld.payload_json
                    print(f"    [SOBREESCRITO] Módulo '{ld.module_name}' de tu usuario administrador '{ld.username}' actualizado en la nube.")
                else:
                    # Si es un usuario estándar (ej: Felipe)
                    # Comparamos si el contenido local es diferente al de la nube
                    if cd.payload_json != ld.payload_json:
                        # Si en la nube está vacío o es un array/objeto vacío, podemos subir lo local sin riesgo
                        cloud_empty = cd.payload_json in (None, "", "[]", "{}")
                        if cloud_empty:
                            cd.payload_json = ld.payload_json
                            print(f"    [COMPLETADO] Módulo '{ld.module_name}' del usuario '{ld.username}' subido (estaba vacío en la nube).")
                        else:
                            # Si no está vacío y es diferente, PRESERVAMOS lo de la nube para no pisar cambios del usuario
                            print(f"    [PRESERVADO] El usuario '{ld.username}' modificó sus propios datos de '{ld.module_name}' en internet. No se sobrescribieron.")
                    else:
                        print(f"    [AL DÍA] Módulo '{ld.module_name}' de '{ld.username}' sin cambios.")
            
        # Guardar todos los cambios fusionados en la nube
        pg_db.commit()
        print("\n==================================================")
        print(" ¡Sincronización Inteligente Completada!         ")
        print(" Se subieron tus datos nuevos y se respetaron    ")
        # Mensaje final aclaratorio
        print(" los cambios de los usuarios en internet.        ")
        print("==================================================")
        
    except Exception as e:
        pg_db.rollback()
        print(f"\n[ERROR] Ocurrió un fallo durante la sincronización: {e}")
    finally:
        pg_db.close()
        sl_db.close()

if __name__ == "__main__":
    main()
