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
import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import engine, get_db, Base, SessionLocal
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

logger = logging.getLogger("recordatorios_mailer")

async def dispatcher_background_loop():
    logger.info("Recordatorios mailer background worker started.")
    while True:
        try:
            # Despierta cada 60 segundos
            await asyncio.sleep(60)
            
            db = SessionLocal()
            now = datetime.now()
            
            # Ejecutar despachos si ya son las 9:00 AM o más
            current_date_str = now.strftime("%Y-%m-%d")
            if now.hour >= 9:
                records = db.query(models.AppData).filter(models.AppData.module_name == "recordatorios").all()
                for rec in records:
                    if not rec.payload_json: continue
                    try:
                        tasks_db = json.loads(rec.payload_json)
                    except:
                        continue
                        
                    # Agrupar tareas pendientes por correo de notificación
                    grouped_tasks = {}
                    for date_str, task_list in list(tasks_db.items()):
                        if date_str <= current_date_str:
                            for idx, task in enumerate(task_list):
                                if not task.get("completada", False) and task.get("correo_notificacion") and not task.get("notificado", False):
                                    email = task.get("correo_notificacion").strip().lower()
                                    if email:
                                        if email not in grouped_tasks:
                                            grouped_tasks[email] = []
                                        grouped_tasks[email].append((date_str, idx, task))
                    
                    if not grouped_tasks:
                        continue
                        
                    # Cargar SMTP config de este usuario
                    smtp_rec = db.query(models.AppData).filter(
                        models.AppData.username == rec.username,
                        models.AppData.module_name == "smtp_config"
                    ).first()
                    
                    if not smtp_rec or not smtp_rec.payload_json:
                        continue
                        
                    try:
                        smtp_cfg = json.loads(smtp_rec.payload_json)
                    except:
                        continue
                        
                    if not smtp_cfg or not smtp_cfg.get("host") or not smtp_cfg.get("username") or not smtp_cfg.get("password"):
                        continue
                        
                    dirty = False
                    # Procesar cada destinatario y enviarle su resumen
                    for email, tasks_to_send in grouped_tasks.items():
                        try:
                            tasks_html = ""
                            for date_str, idx, t in tasks_to_send:
                                tasks_html += f"""
                                <div style="margin-bottom: 20px; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px; background-color: #fafafa; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                    <div style="margin-bottom: 12px; border-bottom: 1px solid #f4f4f5; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 16px; font-weight: bold; color: #8b5cf6;">📌 {t.get('titulo', 'Tarea')}</span>
                                        <span style="font-size: 12px; color: #a1a1aa; background-color: #f4f4f5; padding: 4px 8px; border-radius: 4px; font-weight: bold;">📅 {date_str}</span>
                                    </div>
                                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #3f3f46; line-height: 1.5;">{t.get('detalle', 'Sin detalles adicionales.')}</p>
                                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                """
                                if t.get("curso"):
                                    tasks_html += f"""
                                        <tr>
                                            <td style="padding: 4px 0; font-weight: bold; color: #71717a; width: 100px;">📚 Curso ID:</td>
                                            <td style="padding: 4px 0; color: #18181b;">{t.get('curso')}</td>
                                        </tr>
                                    """
                                if t.get("grupo"):
                                    tasks_html += f"""
                                        <tr>
                                            <td style="padding: 4px 0; font-weight: bold; color: #71717a;">👥 Grupo:</td>
                                            <td style="padding: 4px 0; color: #18181b;">{t.get('grupo')}</td>
                                        </tr>
                                    """
                                if t.get("asunto"):
                                    tasks_html += f"""
                                        <tr>
                                            <td style="padding: 4px 0; font-weight: bold; color: #71717a;">📝 Asunto:</td>
                                            <td style="padding: 4px 0; color: #18181b;">{t.get('asunto')}</td>
                                        </tr>
                                    """
                                tasks_html += """
                                    </table>
                                </div>
                                """

                            html_content = f"""
                            <html>
                            <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px; margin: 0;">
                                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                                    <div style="background-color: #8b5cf6; padding: 24px; color: #ffffff; text-align: center;">
                                        <h2 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">🔔 Resumen de Tareas Pendientes</h2>
                                        <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Plataforma de Herramientas BEX</p>
                                    </div>
                                    <div style="padding: 24px; color: #18181b;">
                                        <p style="font-size: 15px; color: #3f3f46; margin-top: 0; margin-bottom: 20px;">Tienes las siguientes tareas programadas para hoy:</p>
                                        
                                        {tasks_html}
                                        
                                        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;">
                                        <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin-bottom: 0; line-height: 1.5;">
                                            Este es un recordatorio automático consolidado enviado a las 9:00 AM.<br>
                                            Por favor, no respondas a este correo.
                                        </p>
                                    </div>
                                </div>
                            </body>
                            </html>
                            """
                            
                            msg = MIMEMultipart('alternative')
                            msg['Subject'] = f"🔔 Resumen de Tareas Pendientes ({len(tasks_to_send)} Tareas)"
                            sender_name = smtp_cfg.get("sender_name") or "Plataforma Herramientas"
                            sender_addr = smtp_cfg.get("sender_email") or smtp_cfg.get("username")
                            msg['From'] = f"{sender_name} <{sender_addr}>"
                            msg['To'] = email
                            
                            msg.attach(MIMEText(html_content, 'html'))
                            
                            # Conexión SMTP
                            srv = smtplib.SMTP(smtp_cfg["host"], int(smtp_cfg["port"]))
                            if smtp_cfg.get("use_tls", True) or int(smtp_cfg.get("port", 587)) == 587:
                                srv.starttls()
                            srv.login(smtp_cfg["username"], smtp_cfg["password"])
                            srv.sendmail(sender_addr, email, msg.as_string())
                            srv.quit()
                            
                            # Marcar como notificado
                            for date_str, idx, task in tasks_to_send:
                                tasks_db[date_str][idx]["notificado"] = True
                            dirty = True
                            logger.info(f"Consolidated notification email sent to {email} with {len(tasks_to_send)} tasks.")
                        except Exception as send_err:
                            logger.error(f"Error sending consolidated email to {email}: {send_err}")
                            
                    if dirty:
                        rec.payload_json = json.dumps(tasks_db)
                        db.commit()
                        
            db.close()
        except Exception as loop_err:
            logger.error(f"Error in dispatcher background loop: {loop_err}")

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
    asyncio.create_task(dispatcher_background_loop())

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
def get_json_db(db_name: str, username: str, db_session: Session):
    record = db_session.query(models.AppData).filter(
        models.AppData.username == username,
        models.AppData.module_name == db_name
    ).first()
    
    if record and record.payload_json:
        try:
            return json.loads(record.payload_json)
        except:
            pass
    return {} if db_name == "recordatorios" else []

def save_db(db_name: str, username: str, data, db_session: Session):
    payload = json.dumps(data)
    record = db_session.query(models.AppData).filter(
        models.AppData.username == username,
        models.AppData.module_name == db_name
    ).first()
    
    if record:
        record.payload_json = payload
    else:
        new_record = models.AppData(username=username, module_name=db_name, payload_json=payload)
        db_session.add(new_record)
    db_session.commit()

@app.get("/api/db/{db_name}")
def read_db(db_name: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "superadmin":
        user_permissions = json.loads(current_user.permissions_json)
        if db_name not in user_permissions and not (db_name == "smtp_config" and "recordatorios" in user_permissions):
            raise HTTPException(status_code=403, detail="Not enough permissions")
    if db_name not in ["capacitaciones", "enlaces", "recordatorios", "smtp_config"]:
        raise HTTPException(status_code=404, detail="DB not found")
    return get_json_db(db_name, current_user.username, db)

@app.post("/api/db/{db_name}")
def write_db(db_name: str, data: dict | list = Body(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "superadmin":
        user_permissions = json.loads(current_user.permissions_json)
        if db_name not in user_permissions and not (db_name == "smtp_config" and "recordatorios" in user_permissions):
            raise HTTPException(status_code=403, detail="Not enough permissions")
    if db_name not in ["capacitaciones", "enlaces", "recordatorios", "smtp_config"]:
        raise HTTPException(status_code=404, detail="DB not found")
    save_db(db_name, current_user.username, data, db)
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


# === GENERADOR DE CARGAS / SCRIPTS DE INDUCCIÓN ===
import zipfile
import shutil
import tempfile
import unicodedata
from fastapi import BackgroundTasks

def normalize_text(val):
    if val is None:
        return ""
    s = str(val).strip()
    s = "".join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return s.upper()

def clean_username_rut(rut_val):
    if not rut_val:
        return ""
    r = str(rut_val).strip().replace(".", "").replace("-", "").replace(" ", "")
    if not r:
        return ""
    if r[-1].upper() == 'K':
        r = r[:-1] + 'k'
    return r

@app.post("/api/excel/generar-carga")
async def api_generar_carga(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    grupo: str = Form(...),
    current_user: models.User = Depends(get_current_user)
):
    try:
        temp_dir = tempfile.mkdtemp()
        path = os.path.join(temp_dir, file.filename)
        with open(path, "wb") as f:
            f.write(await file.read())
            
        matriz_name = "MATRIZ_CURSOS_BEX.xlsx"
        matriz_path = os.path.join("..", matriz_name)
        if not os.path.exists(matriz_path):
            matriz_path = matriz_name
            
        if not os.path.exists(matriz_path):
            raise HTTPException(status_code=404, detail="No se encontró la base de datos de cursos 'MATRIZ_CURSOS_BEX.xlsx' en el servidor.")
            
        wb_matriz = openpyxl.load_workbook(matriz_path, data_only=True)
        mapa_cursos_perfil = {}
        for sname in wb_matriz.sheetnames:
            sheet_mat = wb_matriz[sname]
            cursos = []
            for r_idx in range(3, sheet_mat.max_row + 1):
                c_name = sheet_mat.cell(row=r_idx, column=1).value
                if c_name and str(c_name).strip():
                    cursos.append(str(c_name).strip())
            mapa_cursos_perfil[normalize_text(sname)] = cursos
            
        wb_matriz.close()
        
        wb_dot = openpyxl.load_workbook(path, data_only=True)
        sheet_dot = None
        for sname in wb_dot.sheetnames:
            if "FORMATO ENVIAR" in sname.upper():
                sheet_dot = wb_dot[sname]
                break
        if not sheet_dot:
            sheet_dot = wb_dot.active
            
        rows_dot = list(sheet_dot.iter_rows(values_only=True))
        if not rows_dot:
            raise HTTPException(status_code=400, detail="El archivo de dotación está vacío.")
            
        header = rows_dot[0]
        col_nombre = None
        col_run = None
        col_correo = None
        col_perfil = None
        
        for idx, col in enumerate(header):
            if not col: continue
            col_upper = str(col).upper()
            if "NOMBRE" in col_upper and "COLABORADOR" in col_upper:
                col_nombre = idx
            elif "RUN" in col_upper and "COLABORADOR" in col_upper:
                col_run = idx
            elif "CORREO" in col_upper and "COLABORADOR" in col_upper:
                col_correo = idx
            elif "PERFIL" in col_upper and "INDUCCI" in col_upper:
                col_perfil = idx
                
        if col_nombre is None or col_run is None or col_perfil is None:
            raise HTTPException(status_code=400, detail="No se encontraron las columnas NOMBRE COLABORADOR, RUN COLABORADOR o PERFIL DE INDUCCIÓN en la cabecera.")
            
        colaboradores_por_perfil = {}
        for r_idx, r in enumerate(rows_dot[1:]):
            nombre_val = r[col_nombre]
            run_val = r[col_run]
            perfil_val = r[col_perfil]
            correo_val = r[col_correo] if col_correo is not None else ""
            
            if not nombre_val or not run_val:
                continue
                
            username = clean_username_rut(run_val)
            if not username: continue
            
            nombre_clean = str(nombre_val).upper().strip()
            correo_clean = str(correo_val).upper().strip() if correo_val else ""
            perfil_clean = str(perfil_val).strip() if perfil_val else "SIN PERFIL"
            
            perfil_norm = normalize_text(perfil_clean)
            
            colab_info = {
                "username": username,
                "firstname": nombre_clean,
                "lastname": nombre_clean,
                "email": correo_clean,
                "department": perfil_clean.upper()
            }
            
            if perfil_norm not in colaboradores_por_perfil:
                colaboradores_por_perfil[perfil_norm] = {
                    "original_name": perfil_clean,
                    "items": []
                }
            colaboradores_por_perfil[perfil_norm]["items"].append(colab_info)
            
        wb_dot.close()
        
        generated_files = []
        for p_norm, p_data in colaboradores_por_perfil.items():
            original_name = p_data["original_name"]
            items = p_data["items"]
            
            cursos = mapa_cursos_perfil.get(p_norm, [])
            
            headers = ["username", "password", "firstname", "lastname", "email", "address", "auth", "department", "suspended"]
            for i in range(1, len(cursos) + 1):
                headers.append(f"group{i}")
                headers.append(f"course{i}")
                
            safe_p_name = "".join(c for c in p_norm if c.isalnum() or c in (" ", "_", "-")).replace(" ", "_")
            csv_filename = f"script_{safe_p_name}.csv"
            csv_filepath = os.path.join(temp_dir, csv_filename)
            
            with open(csv_filepath, mode="w", newline="", encoding="utf-8-sig") as csv_file:
                writer = csv.writer(csv_file, delimiter=";")
                writer.writerow(headers)
                
                for item in items:
                    row = [
                        item["username"],
                        item["username"],
                        item["firstname"],
                        item["lastname"],
                        item["email"],
                        item["username"],
                        "saml2",
                        item["department"],
                        "0"
                    ]
                    for idx, course in enumerate(cursos):
                        row.append(grupo)
                        row.append(course)
                    writer.writerow(row)
                    
            generated_files.append(csv_filepath)
            
        if not generated_files:
            raise HTTPException(status_code=400, detail="No se generaron registros válidos del archivo de entrada.")
            
        zip_name = f"Cargas_Induccion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        zip_path = os.path.join(temp_dir, zip_name)
        
        with zipfile.ZipFile(zip_path, "w") as zip_f:
            for fpath in generated_files:
                zip_f.write(fpath, os.path.basename(fpath))
                
        dest_zip_path = os.path.abspath(zip_name)
        shutil.copy(zip_path, dest_zip_path)
        
        shutil.rmtree(temp_dir)
        
        background_tasks.add_task(os.remove, dest_zip_path)
        return FileResponse(path=dest_zip_path, filename=zip_name, media_type="application/zip")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo al procesar: {str(e)}")

