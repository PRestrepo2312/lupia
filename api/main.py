"""API de LupIA.

Correr desde la raiz del proyecto:
    uvicorn api.main:app --reload --port 8010
"""
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine import config, correo, db, ia, ingesta, proveedores, senales

from api.auth import router as auth_router

app = FastAPI(
    title="LupIA API",
    description=(
        "La lupa ciudadana sobre la plata de la reconstruccion. "
        "LupIA no acusa: senala lo que amerita revision, con datos oficiales."
    ),
)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.include_router(auth_router)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    if config.MODO_DEMO:
        ingesta.cargar_seed()
        senales.calcular_todas()


# ---------- salud ----------

@app.get("/salud")
def salud():
    with db.get_conn() as conn:
        contratos = conn.execute("SELECT COUNT(*) AS n FROM contratos").fetchone()["n"]
        alertas = conn.execute("SELECT COUNT(*) AS n FROM alertas").fetchone()["n"]
    return {"ok": True, "modo_demo": config.MODO_DEMO, "base": "postgres" if db.IS_PG else "sqlite",
            "contratos": contratos, "alertas": alertas}


# ---------- ingesta ----------

@app.post("/ingesta/terremoto")
def ingesta_terremoto():
    n = ingesta.descargar_terremoto()
    h = ingesta.actualizar_historial_proveedores() if not config.MODO_DEMO else 0
    resultado = senales.calcular_todas()
    return {"contratos": n, "historial_proveedores": h, "senales": resultado}


@app.post("/ingesta/covid")
def ingesta_covid():
    return {"contratos": ingesta.descargar_covid()}


# ---------- monitor ----------

@app.get("/resumen")
def resumen(solo_emergencia: bool = False):
    """Agregados por departamento para el feed del monitor.

    El cache es nacional; con solo_emergencia=1 se filtra a los 5 departamentos foco.
    """
    sql = """
        SELECT c.departamento,
               COUNT(DISTINCT c.id_contrato) AS contratos,
               SUM(c.valor_del_contrato) AS total,
               COUNT(DISTINCT a.id) AS alertas
        FROM contratos c
        LEFT JOIN alertas a ON a.id_contrato = c.id_contrato
        WHERE c.origen = 'terremoto'
    """
    params: list = []
    if solo_emergencia:
        marcas = ",".join("?" for _ in config.DEPARTAMENTOS_EMERGENCIA)
        sql += f" AND c.departamento IN ({marcas})"
        params.extend(config.DEPARTAMENTOS_EMERGENCIA)
    sql += " GROUP BY c.departamento ORDER BY total DESC"
    with db.get_conn() as conn:
        return [dict(f) for f in conn.execute(sql, params)]


@app.get("/proveedores/{nit}")
def trazabilidad_proveedor(nit: str):
    """Perfil completo de un NIT en SECOP II (con cache local de 24h)."""
    import requests as _requests
    try:
        perfil = proveedores.trazabilidad(nit)
    except _requests.RequestException:
        raise HTTPException(
            503, "datos.gov.co está intermitente en este momento; intenta de nuevo en unos segundos",
        )
    if perfil is None:
        raise HTTPException(404, f"El NIT {nit} no registra contratos en SECOP II")
    return perfil


@app.get("/alertas")
def listar_alertas(departamento: str | None = None, limite: int = 50):
    sql = """
        SELECT a.id, a.id_contrato, a.senal, a.score, a.detalle, a.creada_en,
               c.nombre_entidad, c.departamento, c.ciudad, c.valor_del_contrato,
               c.proveedor_adjudicado, c.descripcion_del_proceso, c.urlproceso,
               c.fecha_de_firma, c.modalidad_de_contratacion, c.documento_proveedor
        FROM alertas a JOIN contratos c ON c.id_contrato = a.id_contrato
    """
    params: list = []
    if departamento:
        sql += " WHERE c.departamento = ?"
        params.append(departamento)
    sql += " ORDER BY a.score DESC, c.valor_del_contrato DESC LIMIT ?"
    params.append(limite)
    with db.get_conn() as conn:
        return [dict(f) for f in conn.execute(sql, params)]


@app.get("/contratos/{id_contrato}")
def detalle_contrato(id_contrato: str):
    with db.get_conn() as conn:
        c = conn.execute(
            "SELECT * FROM contratos WHERE id_contrato = ?", (id_contrato,)
        ).fetchone()
        if not c:
            raise HTTPException(404, "Contrato no encontrado")
        alertas = [
            dict(a) for a in conn.execute(
                "SELECT senal, score, detalle FROM alertas WHERE id_contrato = ?",
                (id_contrato,),
            )
        ]
    contrato = dict(c)
    contrato["datos_json"] = json.loads(contrato.get("datos_json") or "{}")
    contrato["alertas"] = alertas
    return contrato


# ---------- IA ----------

class TextoEntrada(BaseModel):
    descripcion: str


@app.post("/ia/pertinencia")
def ia_pertinencia(entrada: TextoEntrada):
    r = ia.clasificar_pertinencia(entrada.descripcion)
    if r is None:
        raise HTTPException(503, "IA no disponible (modo demo o sin credenciales)")
    return r


class PreguntaChat(BaseModel):
    pregunta: str


@app.post("/ia/chat")
def ia_chat(entrada: PreguntaChat):
    """Chat ciudadano: Claude responde sobre los datos reales del cache."""
    with db.get_conn() as conn:
        resumen_deptos = [dict(f) for f in conn.execute(
            """
            SELECT c.departamento, COUNT(DISTINCT c.id_contrato) AS contratos,
                   SUM(c.valor_del_contrato) AS valor_total,
                   COUNT(DISTINCT a.id) AS senales
            FROM contratos c LEFT JOIN alertas a ON a.id_contrato = c.id_contrato
            WHERE c.origen='terremoto' GROUP BY c.departamento ORDER BY valor_total DESC
            """
        )]
        top_senales = [dict(f) for f in conn.execute(
            """
            SELECT a.senal, a.score, a.detalle, c.departamento, c.ciudad,
                   c.nombre_entidad, c.valor_del_contrato
            FROM alertas a JOIN contratos c ON c.id_contrato = a.id_contrato
            ORDER BY a.score DESC, c.valor_del_contrato DESC LIMIT 20
            """
        )]
    contexto = {
        "corte": "contratos firmados desde 2026-08-10, todo el pais",
        "resumen_por_departamento": resumen_deptos,
        "principales_senales": top_senales,
    }
    respuesta = ia.responder_chat(entrada.pregunta, contexto)
    if respuesta is None:
        raise HTTPException(503, "IA no disponible (modo demo o sin credenciales)")
    return {"respuesta": respuesta}


@app.post("/ia/explicar/{id_contrato}")
def ia_explicar(id_contrato: str):
    contrato = detalle_contrato(id_contrato)
    texto = ia.explicar_alerta(contrato, contrato["alertas"])
    if texto is None:
        raise HTTPException(503, "IA no disponible (modo demo o sin credenciales)")
    return {"explicacion": texto}


# ---------- suscripciones y correos ----------

class Suscripcion(BaseModel):
    correo: str
    departamento: str | None = None
    municipio: str | None = None


@app.post("/suscripciones")
def crear_suscripcion(s: Suscripcion):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO suscripciones (correo, departamento, municipio) VALUES (?,?,?) "
            "ON CONFLICT DO NOTHING",
            (s.correo, s.departamento, s.municipio),
        )
    return {"ok": True}


@app.post("/alertas/enviar-correos")
def enviar_correos(maximo: int = 10):
    """Manda por Brevo las alertas pendientes a los suscriptores del departamento.

    Este es EL momento del video: el correo llegando al celular.
    """
    if not config.BREVO_API_KEY:
        raise HTTPException(503, "Falta BREVO_API_KEY en el .env")
    enviados = 0
    with db.get_conn() as conn:
        pendientes = conn.execute(
            """
            SELECT DISTINCT a.id_contrato FROM alertas a
            JOIN contratos c ON c.id_contrato = a.id_contrato
            WHERE a.enviada = 0 ORDER BY a.score DESC LIMIT ?
            """,
            (maximo,),
        ).fetchall()
        for p in pendientes:
            c = dict(conn.execute(
                "SELECT * FROM contratos WHERE id_contrato=?", (p["id_contrato"],)
            ).fetchone())
            alertas = [dict(a) for a in conn.execute(
                "SELECT senal, score, detalle FROM alertas WHERE id_contrato=?",
                (p["id_contrato"],),
            )]
            destinatarios = [
                r["correo"] for r in conn.execute(
                    "SELECT DISTINCT correo FROM suscripciones "
                    "WHERE departamento IS NULL OR departamento = ?",
                    (c["departamento"],),
                )
            ]
            if not destinatarios:
                continue
            correo.enviar_correo(
                destinatarios,
                f"🔍 LupIA: nueva señal en {c['departamento']}",
                correo.html_alerta(c, alertas),
            )
            conn.execute(
                "UPDATE alertas SET enviada=1 WHERE id_contrato=?", (p["id_contrato"],)
            )
            enviados += 1
    return {"correos_enviados": enviados}
