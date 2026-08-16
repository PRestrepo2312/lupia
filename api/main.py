"""API de LupIA.

Correr desde la raiz del proyecto:
    uvicorn api.main:app --reload --port 8010
"""
import json

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine import config, convocatorias, correo, db, ia, ingesta, proveedores, senales

from api.auth import router as auth_router, usuario_actual

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


def _sin_acentos(texto: str) -> str:
    import unicodedata
    nfd = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn").lower()


def _foco_territorial(conn, pregunta: str) -> dict | None:
    """Si la pregunta menciona un departamento o ciudad del cache, arma un recorte con sus datos."""
    # signos de puntuacion pegados ("¿en pereira?") no deben romper el match
    limpio = "".join(c if c.isalnum() or c.isspace() else " " for c in _sin_acentos(pregunta))
    q = f" {' '.join(limpio.split())} "
    territorios = conn.execute(
        "SELECT DISTINCT departamento AS t FROM contratos "
        "UNION SELECT DISTINCT ciudad AS t FROM contratos"
    ).fetchall()
    mencionados = [f["t"] for f in territorios
                   if f["t"] and len(f["t"]) >= 4 and f" {_sin_acentos(f['t'])} " in q]
    if not mencionados:
        return None
    marcas = ",".join("?" for _ in mencionados)
    agregado = dict(conn.execute(
        f"""
        SELECT COUNT(*) AS contratos, COALESCE(SUM(valor_del_contrato),0) AS valor_total
        FROM contratos WHERE departamento IN ({marcas}) OR ciudad IN ({marcas})
        """,
        (*mencionados, *mencionados),
    ).fetchone())
    muestra = [dict(f) for f in conn.execute(
        f"""
        SELECT c.nombre_entidad, c.ciudad, c.departamento, c.descripcion_del_proceso,
               c.valor_del_contrato, c.proveedor_adjudicado, c.modalidad_de_contratacion,
               c.fecha_de_firma, a.senal, a.score
        FROM contratos c LEFT JOIN alertas a ON a.id_contrato = c.id_contrato
        WHERE c.departamento IN ({marcas}) OR c.ciudad IN ({marcas})
        ORDER BY c.valor_del_contrato DESC LIMIT 15
        """,
        (*mencionados, *mencionados),
    )]
    return {
        "territorios_detectados": mencionados,
        "contratos": agregado["contratos"],
        "valor_total": agregado["valor_total"],
        "mayores_contratos": muestra,
    }


@app.post("/ia/chat")
def ia_chat(entrada: PreguntaChat):
    """Chat ciudadano: la IA responde sobre TODO el cache nacional, no solo la emergencia."""
    with db.get_conn() as conn:
        resumen_deptos = [dict(f) for f in conn.execute(
            """
            SELECT c.departamento, COUNT(DISTINCT c.id_contrato) AS contratos,
                   SUM(c.valor_del_contrato) AS valor_total,
                   COUNT(DISTINCT a.id) AS senales
            FROM contratos c LEFT JOIN alertas a ON a.id_contrato = c.id_contrato
            GROUP BY c.departamento ORDER BY valor_total DESC
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
        foco = _foco_territorial(conn, entrada.pregunta)
    contexto = {
        "ventana": ("contratos firmados desde el 10 de agosto de 2026, "
                    "TODOS los departamentos del pais (cobertura nacional)"),
        "resumen_por_departamento": resumen_deptos,
        "principales_senales": top_senales,
    }
    if foco:
        contexto["datos_del_territorio_preguntado"] = foco
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


@app.get("/suscripciones/mias")
def mis_suscripciones(usuario: dict = Depends(usuario_actual)):
    """Las alertas activas del usuario autenticado (para verlas y desactivarlas)."""
    with db.get_conn() as conn:
        return [dict(f) for f in conn.execute(
            "SELECT id, departamento, municipio, creada_en FROM suscripciones "
            "WHERE correo = ? ORDER BY id", (usuario["correo"],),
        )]


@app.delete("/suscripciones/{sid}")
def borrar_suscripcion(sid: int, usuario: dict = Depends(usuario_actual)):
    with db.get_conn() as conn:
        conn.execute("DELETE FROM suscripciones WHERE id = ? AND correo = ?",
                     (sid, usuario["correo"]))
    return {"ok": True}


# ---------- perfil de empresa (onboarding Modo Empresa) ----------

class PerfilEmpresa(BaseModel):
    tiene_empresa: bool
    nit: str | None = None
    intereses: list[str] = []  # ejecutados | en_ejecucion | convocatorias


@app.post("/empresa/perfil")
def guardar_perfil_empresa(p: PerfilEmpresa, usuario: dict = Depends(usuario_actual)):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO empresa_perfil (correo, tiene_empresa, nit, intereses) VALUES (?,?,?,?) "
            "ON CONFLICT (correo) DO UPDATE SET tiene_empresa=excluded.tiene_empresa, "
            "nit=excluded.nit, intereses=excluded.intereses",
            (usuario["correo"], int(p.tiene_empresa),
             "".join(c for c in (p.nit or "") if c.isdigit()) or None,
             ",".join(p.intereses)),
        )
    return {"ok": True}


@app.get("/empresa/perfil")
def ver_perfil_empresa(usuario: dict = Depends(usuario_actual)):
    with db.get_conn() as conn:
        fila = conn.execute(
            "SELECT tiene_empresa, nit, intereses FROM empresa_perfil WHERE correo = ?",
            (usuario["correo"],),
        ).fetchone()
    if not fila:
        raise HTTPException(404, "Sin perfil de empresa todavia")
    return {"tiene_empresa": bool(fila["tiene_empresa"]), "nit": fila["nit"],
            "intereses": (fila["intereses"] or "").split(",") if fila["intereses"] else []}


# ---------- convocatorias segun perfil ----------

def _nit_del_usuario(correo_usuario: str) -> str | None:
    with db.get_conn() as conn:
        fila = conn.execute(
            "SELECT nit FROM empresa_perfil WHERE correo = ?", (correo_usuario,)
        ).fetchone()
    return fila["nit"] if fila else None


@app.get("/empresa/convocatorias")
def convocatorias_empresa(usuario: dict = Depends(usuario_actual)):
    """Convocatorias abiertas (p6dx-8zbt) rankeadas por afinidad con el perfil del NIT."""
    nit = _nit_del_usuario(usuario["correo"])
    try:
        items = convocatorias.buscar(nit)
    except Exception:
        raise HTTPException(503, "datos.gov.co no respondio, intenta en unos segundos")
    return {"nit": nit, "con_historial": bool(nit), "convocatorias": items}


@app.post("/empresa/convocatorias/enviar")
def enviar_convocatorias_usuario(usuario: dict = Depends(usuario_actual)):
    """Envia por Brevo las convocatorias del perfil al correo del usuario."""
    if not config.BREVO_API_KEY:
        raise HTTPException(503, "Falta BREVO_API_KEY en el .env")
    nit = _nit_del_usuario(usuario["correo"])
    try:
        items = convocatorias.buscar(nit)
    except Exception:
        raise HTTPException(503, "datos.gov.co no respondio, intenta en unos segundos")
    if not items:
        raise HTTPException(404, "No hay convocatorias abiertas que calcen con el perfil hoy")
    correo.enviar_correo(
        [usuario["correo"]],
        "LupIA · Convocatorias abiertas que calzan con tu perfil",
        correo.html_convocatorias(items),
    )
    return {"ok": True, "enviadas": len(items)}


@app.post("/convocatorias/enviar-correos")
def enviar_convocatorias_todos(maximo: int = 20):
    """Barrido: manda convocatorias a cada perfil con interes 'convocatorias' (cron/manual)."""
    if not config.BREVO_API_KEY:
        raise HTTPException(503, "Falta BREVO_API_KEY en el .env")
    with db.get_conn() as conn:
        perfiles = [dict(f) for f in conn.execute(
            "SELECT correo, nit FROM empresa_perfil "
            "WHERE tiene_empresa = 1 AND intereses LIKE ? LIMIT ?",
            ("%convocatorias%", maximo),
        )]
    enviados = 0
    for p in perfiles:
        try:
            items = convocatorias.buscar(p["nit"])
            if not items:
                continue
            correo.enviar_correo(
                [p["correo"]],
                "LupIA · Convocatorias abiertas que calzan con tu perfil",
                correo.html_convocatorias(items),
            )
            enviados += 1
        except Exception:
            continue
    return {"correos_enviados": enviados, "perfiles_revisados": len(perfiles)}


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
                f"LupIA · Nueva señal en {c['departamento']}",
                correo.html_alerta(c, alertas),
            )
            conn.execute(
                "UPDATE alertas SET enviada=1 WHERE id_contrato=?", (p["id_contrato"],)
            )
            enviados += 1
    return {"correos_enviados": enviados}
