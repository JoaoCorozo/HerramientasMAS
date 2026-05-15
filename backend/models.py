from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    hashed_password = Column(String(255))
    role = Column(String(20), default="user") # "superadmin" or "user"
    permissions_json = Column(String(500), default="[]") # JSON list of modules e.g. ["comparador", "rut"]

class AppData(Base):
    __tablename__ = "app_data"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), index=True)
    module_name = Column(String(50), index=True) # "recordatorios", "enlaces", "capacitaciones"
    payload_json = Column(String) # Text content storing the actual JSON object
