"""Añade permiso 'generador' a usuarios que ya tenían el resto de módulos."""
import json
import sqlite3

DB = "users.db"
NEW_PERM = "generador"


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT id, username, permissions_json FROM users")
    updated = 0
    for uid, username, perms_raw in cur.fetchall():
        try:
            perms = json.loads(perms_raw or "[]")
        except json.JSONDecodeError:
            perms = []
        if NEW_PERM in perms:
            continue
        if "comparador" in perms or perms_raw and perms_raw != "[]":
            perms.append(NEW_PERM)
            cur.execute(
                "UPDATE users SET permissions_json = ? WHERE id = ?",
                (json.dumps(perms), uid),
            )
            updated += 1
            print(f"  + {username}: generador añadido")
    conn.commit()
    conn.close()
    print(f"Listo. {updated} usuario(s) actualizado(s).")


if __name__ == "__main__":
    main()
