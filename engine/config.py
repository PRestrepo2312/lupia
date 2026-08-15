"""Configuracion central de LupIA. Todo sale del .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# datos.gov.co
SODA_DOMAIN = os.getenv("SODA_DOMAIN", "www.datos.gov.co")
SODA_APP_TOKEN = os.getenv("SODA_APP_TOKEN", "")
if "PEGA_AQUI" in SODA_APP_TOKEN:
    SODA_APP_TOKEN = ""  # sin token funciona, pero con rate limit compartido

DATASET_CONTRATOS = os.getenv("DATASET_CONTRATOS", "jbjy-vk9h")
DATASET_PROCESOS = os.getenv("DATASET_PROCESOS", "p6dx-8zbt")
DATASET_PROVEEDORES = os.getenv("DATASET_PROVEEDORES", "qmzu-gj57")
DATASET_TIENDA_VIRTUAL = os.getenv("DATASET_TIENDA_VIRTUAL", "rgxm-mmea")

# Emergencia
FECHA_SISMO = os.getenv("FECHA_SISMO", "2026-08-10T00:00:00")
# Los 5 departamentos son el FOCO del monitor (UI, alertas priorizadas),
# no el limite del cache: la ingesta por defecto es nacional.
DEPARTAMENTOS_EMERGENCIA = [
    d.strip() for d in os.getenv(
        "DEPARTAMENTOS_EMERGENCIA",
        "Chocó,Risaralda,Quindío,Caldas,Valle del Cauca",
    ).split(",") if d.strip()
]
# AMBITO_INGESTA: "nacional" (todo el pais) | "emergencia" (solo los 5 departamentos)
AMBITO_INGESTA = os.getenv("AMBITO_INGESTA", "nacional")

# Ventana COVID para calibrar el motor (plan de dos capas del playbook)
COVID_DESDE = "2020-03-15T00:00:00"
COVID_HASTA = "2020-06-30T00:00:00"

# Base de datos: si DATABASE_URL apunta a Postgres se usa; si no, SQLite local
DATABASE_URL = os.getenv("DATABASE_URL", "")
DB_PATH = str(BASE_DIR / os.getenv("DB_PATH", "lupia.db"))

# Brevo
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
CORREO_REMITENTE = os.getenv("CORREO_REMITENTE", "alertas@lupia.co")
NOMBRE_REMITENTE = os.getenv("NOMBRE_REMITENTE", "LupIA")

# Autenticacion
JWT_SECRETO = os.getenv("JWT_SECRETO", "lupia-dev-cambia-esto-en-produccion")
JWT_HORAS = int(os.getenv("JWT_HORAS", "168"))  # 7 dias
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# IA
IA_PROVEEDOR = os.getenv("IA_PROVEEDOR", "bedrock")  # bedrock | anthropic
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-opus-5")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL_ID = os.getenv("ANTHROPIC_MODEL_ID", "claude-opus-5")

# Umbral minimo para que un contrato de un proveedor debutante genere alerta (COP)
UMBRAL_DEBUTANTE = float(os.getenv("UMBRAL_DEBUTANTE", "50000000"))  # 50M

# Modo demo: el repo corre SIN token y SIN API key usando data/seed/ (rubrica: "el MVP corre")
MODO_DEMO = os.getenv("MODO_DEMO", "0") == "1"
SEED_DIR = BASE_DIR / "data" / "seed"
