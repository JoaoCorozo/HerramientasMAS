import os
import sqlite3
import json

# Renombrar archivos JSON
archivos = ["capacitaciones_db.json", "enlaces_db.json", "recordatorios_db.json"]
for db_name in archivos:
    if os.path.exists(db_name):
        new_name = f"Joao_{db_name}"
        if not os.path.exists(new_name):
            os.rename(db_name, new_name)
            print(f"Renamed {db_name} to {new_name}")
        else:
            print(f"{new_name} already exists.")
    else:
        print(f"File {db_name} not found.")

# Insertar el usuario Joao en users.db usando sqlite3 (o sqlalchemy)
# Para evitar dependencias complejas en el script rapido, uso sqlite3 directo
import bcrypt

def get_password_hash(password: str):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

try:
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    # Comprobar si existe
    cursor.execute("SELECT * FROM users WHERE username = ?", ("Joao",))
    user = cursor.fetchone()
    
    perms = json.dumps(["comparador", "rut", "textos", "capacitaciones", "enlaces", "recordatorios"])
    hashed_pw = get_password_hash("Joao123")
    
    if not user:
        cursor.execute(
            "INSERT INTO users (username, hashed_password, role, permissions_json) VALUES (?, ?, ?, ?)",
            ("Joao", hashed_pw, "superadmin", perms)
        )
        print("Usuario Joao creado como superadmin.")
    else:
        # Actualizar contraseña y rol por si acaso
        cursor.execute(
            "UPDATE users SET hashed_password = ?, role = ?, permissions_json = ? WHERE username = ?",
            (hashed_pw, "superadmin", perms, "Joao")
        )
        print("Usuario Joao actualizado.")
        
    conn.commit()
except Exception as e:
    print(f"Error con la BD: {e}")
finally:
    if 'conn' in locals():
        conn.close()

print("Migración completada.")
