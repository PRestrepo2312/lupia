"""Validador de conexiones de LupIA. Correr: python scripts/validar_apis.py

Verifica en orden:
  1. datos.gov.co alcanzable y datasets vivos
  2. App Token valido (si esta en el .env)
  3. La consulta principal (volumen de contratos desde el sismo)
  4. Brevo (API key de correos)
  5. Credenciales de IA (Bedrock / Anthropic API key)
"""
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent.parent
load_dotenv(BASE / ".env")

DOMINIO = os.getenv("SODA_DOMAIN", "www.datos.gov.co")
TOKEN = os.getenv("SODA_APP_TOKEN", "")
if "PEGA_AQUI" in TOKEN:
    TOKEN = ""
FECHA_SISMO = os.getenv("FECHA_SISMO", "2026-08-10T00:00:00")
DEPARTAMENTOS = [d.strip() for d in os.getenv(
    "DEPARTAMENTOS_EMERGENCIA", "Chocó,Risaralda,Quindío,Caldas,Valle del Cauca"
).split(",")]

DATASETS = {
    "SECOP II Contratos": os.getenv("DATASET_CONTRATOS", "jbjy-vk9h"),
    "SECOP II Procesos": os.getenv("DATASET_PROCESOS", "p6dx-8zbt"),
    "Proveedores": os.getenv("DATASET_PROVEEDORES", "qmzu-gj57"),
    "Tienda Virtual": os.getenv("DATASET_TIENDA_VIRTUAL", "rgxm-mmea"),
}

resultados: list[tuple[str, str]] = []


def check(nombre: str, ok: bool, detalle: str = "") -> None:
    marca = "[OK]  " if ok else "[FALLA]"
    print(f"{marca} {nombre}" + (f" -> {detalle}" if detalle else ""))
    resultados.append((nombre, "OK" if ok else "FALLA"))


def pendiente(nombre: str, detalle: str) -> None:
    print(f"[PEND] {nombre} -> {detalle}")
    resultados.append((nombre, "PENDIENTE"))


def soda(dataset: str, params: dict, con_token: bool = True) -> requests.Response:
    headers = {"X-App-Token": TOKEN} if (TOKEN and con_token) else {}
    return requests.get(
        f"https://{DOMINIO}/resource/{dataset}.json",
        params=params, headers=headers, timeout=120,
    )


print("=" * 60)
print("LupIA - Validacion de APIs")
print("=" * 60)

# 1. Datasets
for nombre, ds in DATASETS.items():
    try:
        r = soda(ds, {"$limit": 1})
        check(f"Dataset {nombre} ({ds})", r.status_code == 200, f"HTTP {r.status_code}")
    except requests.RequestException as e:
        check(f"Dataset {nombre} ({ds})", False, str(e))

# 2. App token
if TOKEN:
    try:
        r = soda(DATASETS["SECOP II Contratos"], {"$limit": 1})
        if r.status_code == 200:
            check("App Token datos.gov.co", True, "aceptado")
        elif r.status_code == 403:
            check("App Token datos.gov.co", False, "403: token invalido, revisalo")
        else:
            check("App Token datos.gov.co", False, f"HTTP {r.status_code}")
    except requests.RequestException as e:
        check("App Token datos.gov.co", False, str(e))
else:
    pendiente("App Token datos.gov.co", "sin token en .env (funciona con rate limit compartido)")

# 3. Query critica: volumen desde el sismo
try:
    valores = ",".join(f"'{d}'" for d in DEPARTAMENTOS)
    q = (
        "SELECT departamento, count(id_contrato) AS n, sum(valor_del_contrato) AS total "
        f"WHERE fecha_de_firma >= '{FECHA_SISMO}' AND departamento in({valores}) "
        "GROUP BY departamento ORDER BY total DESC"
    )
    r = soda(DATASETS["SECOP II Contratos"], {"$query": q})
    r.raise_for_status()
    filas = r.json()
    total_n = sum(int(f["n"]) for f in filas)
    total_v = sum(float(f["total"]) for f in filas)
    check("Query volumen post-sismo", total_n > 0,
          f"{total_n} contratos / ${total_v:,.0f} en {len(filas)} departamentos")
    for f in filas:
        print(f"        - {f['departamento']}: {f['n']} contratos, ${float(f['total']):,.0f}")
except (requests.RequestException, ValueError, KeyError) as e:
    check("Query volumen post-sismo", False, str(e))

# 4. Brevo
brevo_key = os.getenv("BREVO_API_KEY", "")
if brevo_key:
    try:
        r = requests.get(
            "https://api.brevo.com/v3/account",
            headers={"api-key": brevo_key, "accept": "application/json"}, timeout=30,
        )
        if r.status_code == 200:
            cuenta = r.json()
            check("Brevo API key", True, cuenta.get("email", "cuenta valida"))
        else:
            check("Brevo API key", False, f"HTTP {r.status_code}: revisala en app.brevo.com/settings/keys/api")
    except requests.RequestException as e:
        check("Brevo API key", False, str(e))
else:
    pendiente("Brevo API key", "falta BREVO_API_KEY en .env")

# 5. IA
proveedor = os.getenv("IA_PROVEEDOR", "bedrock")
anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
if proveedor == "anthropic" and anthropic_key:
    try:
        r = requests.get(
            "https://api.anthropic.com/v1/models",
            headers={"x-api-key": anthropic_key, "anthropic-version": "2023-06-01"},
            params={"limit": 1}, timeout=30,
        )
        check("Anthropic API key", r.status_code == 200, f"HTTP {r.status_code}")
    except requests.RequestException as e:
        check("Anthropic API key", False, str(e))
else:
    try:
        import boto3
        ident = boto3.client("sts", region_name=os.getenv("AWS_REGION", "us-east-1")).get_caller_identity()
        check("Credenciales AWS (Bedrock)", True, f"cuenta {ident['Account']}")
    except Exception as e:  # noqa: BLE001 - cualquier fallo de credenciales cuenta
        pendiente("Credenciales AWS (Bedrock)", f"no validadas: {e}")

print("=" * 60)
fallas = [n for n, r in resultados if r == "FALLA"]
pendientes = [n for n, r in resultados if r == "PENDIENTE"]
print(f"Resultado: {len(resultados) - len(fallas) - len(pendientes)} OK, "
      f"{len(pendientes)} pendientes, {len(fallas)} fallas")
if fallas:
    print("Fallas: " + ", ".join(fallas))
    sys.exit(1)
