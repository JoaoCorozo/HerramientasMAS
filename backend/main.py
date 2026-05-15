from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import os
import csv
from datetime import datetime
import openpyxl

from database import engine, get_db, Base
import models
import auth

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Herramientas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin_user:
        hashed_pw = auth.get_password_hash("admin123")
        admin_user = models.User(
            username="admin", 
            hashed_password=hashed_pw, 
            role="superadmin", 
            permissions_json='["comparador", "rut", "textos", "capacitaciones", "enlaces", "recordatorios"]'
        )
        db.add(admin_user)
        db.commit()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = auth.decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_permission(module_name: str):
    def permission_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role == "superadmin":
            return current_user
        user_permissions = json.loads(current_user.permissions_json)
        if module_name not in user_permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        return current_user
    return permission_checker

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "permissions": json.loads(current_user.permissions_json)
    }

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    permissions: list[str]

@app.get("/api/users")
def get_users(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Not superadmin")
    users = db.query(models.User).all()
    return [{"id": u.id, "username": u.username, "role": u.role, "permissions": json.loads(u.permissions_json)} for u in users]

@app.post("/api/users")
def create_user(user: UserCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Not superadmin")
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        role=user.role,
        permissions_json=json.dumps(user.permissions)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "username": db_user.username}

@app.put("/api/users/{user_id}")
def update_user(user_id: int, user: UserCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Not superadmin")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.username = user.username
    if user.password:
        db_user.hashed_password = auth.get_password_hash(user.password)
    db_user.role = user.role
    db_user.permissions_json = json.dumps(user.permissions)
    db.commit()
    return {"status": "updated"}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Not superadmin")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete default admin")
    db.delete(db_user)
    db.commit()
    return {"status": "deleted"}

# === RUTAS PARA NORMALIZADOR DE RUT ===
class RutInput(BaseModel):
    ruts: str
    formato: str
    k_minuscula: bool

@app.post("/api/rut/normalizar")
def normalizar_rut(data: RutInput, current_user: models.User = Depends(require_permission("rut"))):
    ruts_limpios = data.ruts.replace("'", "").replace('"', "").replace('\r', '')
    lista_ruts = [r.strip() for r in ruts_limpios.split('\n') if r.strip()]
    
    resultados = []
    for rut in lista_ruts:
        rut_base = rut.upper().replace(".", "")
        if "-" not in rut_base and len(rut_base) > 1:
            rut_base = rut_base[:-1] + "-" + rut_base[-1]
            
        partes = rut_base.split("-")
        if len(partes) != 2:
            resultados.append(rut)
            continue
            
        cuerpo, dv = partes[0], partes[1]
        if data.k_minuscula and dv == 'K': dv = 'k'
            
        if data.formato == "Sin Puntos y Con Guión":
            resultados.append(f"{cuerpo}-{dv}")
        elif data.formato == "Sin Puntos y Sin Guión":
            resultados.append(f"{cuerpo}{dv}")
        else:
            cuerpo_puntos = f"{int(cuerpo):,}".replace(",", ".") if cuerpo.isdigit() else cuerpo
            resultados.append(f"{cuerpo_puntos}-{dv}")
            
    return {"ruts": "\n".join(resultados), "total": len(resultados)}


# === RUTAS PARA NORMALIZADOR DE NOMBRES ===
class NombresInput(BaseModel):
    nombres: str
    formato: str

@app.post("/api/nombres/normalizar")
def normalizar_nombres(data: NombresInput, current_user: models.User = Depends(require_permission("textos"))):
    nombres_limpios = data.nombres.replace("'", "").replace('"', "").replace('\r', '')
    lista_nombres = [n.strip() for n in nombres_limpios.split('\n') if n.strip()]
    
    resultados = []
    for nom in lista_nombres:
        if data.formato == "Mayúsculas": resultados.append(nom.upper())
        elif data.formato == "Minúsculas": resultados.append(nom.lower())
        else: resultados.append(nom.title())
            
    return {"nombres": "\n".join(resultados), "total": len(resultados)}


# === CRUD JSON ===
def get_json_db(db_name: str, username: str):
    path = f"{username}_{db_name}_db.json"
    if not os.path.exists(path):
        return {} if db_name == "recordatorios" else []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {} if db_name == "recordatorios" else []

def save_db(db_name: str, username: str, data):
    path = f"{username}_{db_name}_db.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

@app.get("/api/db/{db_name}")
def read_db(db_name: str, current_user: models.User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        user_permissions = json.loads(current_user.permissions_json)
        if db_name not in user_permissions:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    if db_name not in ["capacitaciones", "enlaces", "recordatorios"]:
        raise HTTPException(status_code=404, detail="DB not found")
    return get_json_db(db_name, current_user.username)

@app.post("/api/db/{db_name}")
def write_db(db_name: str, data: dict | list = Body(...), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        user_permissions = json.loads(current_user.permissions_json)
        if db_name not in user_permissions:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    if db_name not in ["capacitaciones", "enlaces", "recordatorios"]:
        raise HTTPException(status_code=404, detail="DB not found")
    save_db(db_name, current_user.username, data)
    return {"status": "success"}

# === COMPARADOR DE DATOS ===
def column_index_from_string(col):
    col = col.upper()
    num = 0
    for c in col:
        num = num * 26 + (ord(c) - ord('A')) + 1
    return num

def extraer_excel(path, col_ini_letra, col_fin_letra, fila_ini, fila_fin, hoja_name=None):
    usuarios = set()
    row_map = {}
    col_num_1 = column_index_from_string(col_ini_letra)
    col_num_2 = column_index_from_string(col_fin_letra) if col_fin_letra else col_num_1
    c_start, c_end = min(col_num_1, col_num_2), max(col_num_1, col_num_2)
    
    wb = openpyxl.load_workbook(path, data_only=True)
    if hoja_name and hoja_name != "Activa (Por defecto)" and hoja_name in wb.sheetnames:
        sheet = wb[hoja_name]
    else:
        sheet = wb.active
    max_row = fila_fin if fila_fin else sheet.max_row
    
    for row in sheet.iter_rows(min_row=fila_ini, max_row=max_row, min_col=1, max_col=sheet.max_column, values_only=True):
        for c_idx in range(c_start - 1, c_end):
            if c_idx < len(row):
                val = row[c_idx]
                if val is not None and str(val).strip() != "":
                    clean_val = str(val).strip().lower()
                    usuarios.add(clean_val)
                    if clean_val not in row_map:
                        row_map[clean_val] = list(row)
    return usuarios, row_map

@app.post("/api/excel/hojas")
async def get_excel_hojas(file: UploadFile = File(...), current_user: models.User = Depends(require_permission("comparador"))):
    try:
        path = f"temp_{file.filename}"
        with open(path, "wb") as f: f.write(await file.read())
        wb = openpyxl.load_workbook(path, read_only=True)
        hojas = wb.sheetnames
        wb.close()
        os.remove(path)
        return {"hojas": hojas}
    except Exception as e:
        return {"hojas": []}

@app.post("/api/abrir-ruta")
async def abrir_ruta_local(req: Request, current_user: models.User = Depends(require_permission("recordatorios"))):
    try:
        data = await req.json()
        ruta = data.get("ruta", "")
        if ruta and os.path.exists(ruta):
            # En Windows os.startfile abre carpetas/archivos
            os.startfile(ruta)
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/comparador")
async def api_comparar(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
    tipo_reporte: str = Form(...),
    c_ini1: str = Form("A"),
    c_fin1: str = Form(""),
    f_ini1: int = Form(2),
    f_fin1: str = Form(""),
    hoja1: str = Form("Activa (Por defecto)"),
    c_ini2: str = Form("A"),
    c_fin2: str = Form(""),
    f_ini2: int = Form(2),
    f_fin2: str = Form(""),
    hoja2: str = Form("Activa (Por defecto)"),
    current_user: models.User = Depends(require_permission("comparador"))
):
    try:
        path1 = f"temp_{file1.filename}"
        path2 = f"temp_{file2.filename}"
        
        with open(path1, "wb") as f: f.write(await file1.read())
        with open(path2, "wb") as f: f.write(await file2.read())
            
        f_fin1_int = int(f_fin1) if f_fin1.isdigit() else None
        f_fin2_int = int(f_fin2) if f_fin2.isdigit() else None
        
        datos1, rows1 = extraer_excel(path1, c_ini1, c_fin1 if c_fin1 else None, f_ini1, f_fin1_int, hoja1)
        datos2, rows2 = extraer_excel(path2, c_ini2, c_fin2 if c_fin2 else None, f_ini2, f_fin2_int, hoja2)
        
        coincidencias = datos1.intersection(datos2)
        solo_1 = datos1 - datos2
        solo_2 = datos2 - datos1
        
        wb_out = openpyxl.Workbook()
        wb_out.remove(wb_out.active)
        hay_diferencias = len(solo_1) + len(solo_2) > 0
        hay_coincidencias = len(coincidencias) > 0

        if tipo_reporte in ["diferencias", "ambos"] and hay_diferencias:
            ws_diff = wb_out.create_sheet("Diferencias")
            max_len = 0
            for d in solo_1: max_len = max(max_len, len(rows1.get(d, [])))
            for d in solo_2: max_len = max(max_len, len(rows2.get(d, [])))
            header_row = [f"Columna {i+1}" for i in range(max_len)] + ["Estado (Diferencia)"]
            ws_diff.append(header_row)
            
            for dato in solo_1:
                row_data = list(rows1.get(dato, [dato]))
                while len(row_data) < max_len: row_data.append("")
                row_data.append(f"Solo en {file1.filename}")
                ws_diff.append(row_data)
            for dato in solo_2:
                row_data = list(rows2.get(dato, [dato]))
                while len(row_data) < max_len: row_data.append("")
                row_data.append(f"Solo en {file2.filename}")
                ws_diff.append(row_data)

        if tipo_reporte in ["coincidencias", "ambos"] and hay_coincidencias:
            ws_coinc = wb_out.create_sheet("Coincidencias")
            max_len1 = max([len(rows1.get(d, [])) for d in coincidencias] + [0])
            max_len2 = max([len(rows2.get(d, [])) for d in coincidencias] + [0])
            header_row = [f"Base Col {i+1}" for i in range(max_len1)] + ["|| MATCH ||"] + [f"Contraste Col {i+1}" for i in range(max_len2)]
            ws_coinc.append(header_row)
            
            for dato in coincidencias:
                r1 = list(rows1.get(dato, [dato]))
                while len(r1) < max_len1: r1.append("")
                r2 = list(rows2.get(dato, [dato]))
                while len(r2) < max_len2: r2.append("")
                ws_coinc.append(r1 + ["<--- SI --->"] + r2)

        if not wb_out.sheetnames:
            ws_empty = wb_out.create_sheet("Sin Datos")
            ws_empty.append(["No hubo datos para el reporte seleccionado."])

        out_name = f"Reporte_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        wb_out.save(out_name)
        
        os.remove(path1)
        os.remove(path2)

        return FileResponse(path=out_name, filename=out_name, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
