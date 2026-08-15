"""Endpoints de autenticacion de LupIA.

Cuatro formas de entrar:
  1. Correo + contraseña            POST /auth/registro, POST /auth/ingreso
  2. Codigo por correo (sin clave)  POST /auth/codigo/solicitar -> /auth/codigo/verificar
  3. Google SSO                     POST /auth/google (credential del boton de Google)
  4. Restablecer contraseña         POST /auth/restablecer/solicitar -> /auth/restablecer/confirmar

Modo dev: mientras no haya BREVO_API_KEY, los endpoints de solicitar codigo
devuelven el codigo en la respuesta (marcado modo_dev) para poder probar sin correo.
Con la llave puesta, el codigo viaja SOLO por correo.
"""
import jwt as pyjwt
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field

from engine import auth, config, db

router = APIRouter(prefix="/auth", tags=["autenticacion"])


# ---------- modelos ----------

class Registro(BaseModel):
    correo: EmailStr
    clave: str = Field(min_length=8, description="Minimo 8 caracteres")
    nombre: str | None = None


class Ingreso(BaseModel):
    correo: EmailStr
    clave: str


class SolicitudCodigo(BaseModel):
    correo: EmailStr


class VerificacionCodigo(BaseModel):
    correo: EmailStr
    codigo: str = Field(min_length=6, max_length=6)


class RestablecerConfirmacion(BaseModel):
    correo: EmailStr
    codigo: str = Field(min_length=6, max_length=6)
    nueva_clave: str = Field(min_length=8)


class CredencialGoogle(BaseModel):
    credential: str = Field(description="ID token que entrega el boton de Google")


# ---------- helpers ----------

def _respuesta_token(usuario) -> dict:
    with db.get_conn() as conn:
        auth.marcar_ingreso(conn, usuario["id"])
    return {
        "token": auth.crear_token(usuario["id"], usuario["correo"]),
        "tipo": "bearer",
        "usuario": {"id": usuario["id"], "correo": usuario["correo"],
                    "nombre": usuario["nombre"]},
    }


def _respuesta_codigo(enviado: bool, codigo: str, error_envio: str | None = None) -> dict:
    if enviado:
        return {"enviado": True, "mensaje": "Revisa tu correo: el codigo vence en 10 minutos."}
    # Modo dev: sin BREVO_API_KEY (o con Brevo rechazando el envio) el codigo se
    # devuelve aqui para no frenar el demo. NUNCA llega a produccion con correo activo.
    motivo = (f"Brevo rechazo el envio: {error_envio}" if error_envio
              else "Falta BREVO_API_KEY")
    return {"enviado": False, "modo_dev": True, "codigo": codigo,
            "mensaje": f"{motivo}. El codigo se devuelve aqui solo en desarrollo."}


def usuario_actual(authorization: str = Header(default="")) -> dict:
    """Dependencia para proteger endpoints: Authorization: Bearer <token>."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Falta el encabezado Authorization: Bearer <token>")
    try:
        datos = auth.decodificar_token(authorization.split(" ", 1)[1].strip())
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "La sesion vencio, ingresa de nuevo")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token invalido")
    with db.get_conn() as conn:
        usuario = auth.obtener_usuario(conn, datos["correo"])
    if not usuario:
        raise HTTPException(401, "El usuario ya no existe")
    return dict(usuario)


# ---------- 1. correo + contraseña ----------

@router.post("/registro")
def registro(r: Registro):
    with db.get_conn() as conn:
        if auth.obtener_usuario(conn, r.correo):
            raise HTTPException(409, "Ese correo ya esta registrado. Usa /auth/ingreso "
                                     "o /auth/restablecer/solicitar si olvidaste la clave.")
        usuario = auth.crear_usuario(conn, r.correo, nombre=r.nombre,
                                     hash_=auth.hash_clave(r.clave))
    return _respuesta_token(dict(usuario))


@router.post("/ingreso")
def ingreso(r: Ingreso):
    with db.get_conn() as conn:
        usuario = auth.obtener_usuario(conn, r.correo)
    if not usuario or not auth.verificar_clave(r.clave, usuario["hash_clave"]):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    return _respuesta_token(dict(usuario))


# ---------- 2. ingreso por codigo (sin contraseña) ----------

@router.post("/codigo/solicitar")
def codigo_solicitar(r: SolicitudCodigo):
    try:
        codigo, enviado, error_envio = auth.generar_codigo(r.correo, "ingreso")
    except ValueError as e:
        raise HTTPException(429, str(e))
    return _respuesta_codigo(enviado, codigo, error_envio)


@router.post("/codigo/verificar")
def codigo_verificar(r: VerificacionCodigo):
    if not auth.validar_codigo(r.correo, r.codigo, "ingreso"):
        raise HTTPException(401, "Codigo invalido o vencido")
    with db.get_conn() as conn:
        usuario = auth.obtener_usuario(conn, r.correo)
        if not usuario:  # primer ingreso: el codigo valida el correo, se crea la cuenta
            usuario = auth.crear_usuario(conn, r.correo)
    return _respuesta_token(dict(usuario))


# ---------- 3. Google SSO ----------

@router.post("/google")
def google(r: CredencialGoogle):
    try:
        datos = auth.verificar_token_google(r.credential)
    except ValueError as e:
        codigo_http = 503 if "GOOGLE_CLIENT_ID" in str(e) else 401
        raise HTTPException(codigo_http, str(e))
    with db.get_conn() as conn:
        usuario = auth.obtener_usuario(conn, datos["correo"])
        if not usuario:
            usuario = auth.crear_usuario(conn, datos["correo"], nombre=datos["nombre"],
                                         google_sub=datos["sub"])
        elif not usuario["google_sub"]:
            conn.execute("UPDATE usuarios SET google_sub = ? WHERE id = ?",
                         (datos["sub"], usuario["id"]))
    return _respuesta_token(dict(usuario))


# ---------- 4. restablecer contraseña ----------

@router.post("/restablecer/solicitar")
def restablecer_solicitar(r: SolicitudCodigo):
    with db.get_conn() as conn:
        existe = auth.obtener_usuario(conn, r.correo) is not None
    if not existe:
        # Respuesta identica exista o no el correo (no revelar cuentas registradas)
        return {"enviado": True, "mensaje": "Si el correo esta registrado, recibiras un codigo."}
    try:
        codigo, enviado, error_envio = auth.generar_codigo(r.correo, "restablecer")
    except ValueError as e:
        raise HTTPException(429, str(e))
    return _respuesta_codigo(enviado, codigo, error_envio)


@router.post("/restablecer/confirmar")
def restablecer_confirmar(r: RestablecerConfirmacion):
    if not auth.validar_codigo(r.correo, r.codigo, "restablecer"):
        raise HTTPException(401, "Codigo invalido o vencido")
    with db.get_conn() as conn:
        usuario = auth.obtener_usuario(conn, r.correo)
        if not usuario:
            raise HTTPException(404, "Ese correo no esta registrado")
        conn.execute("UPDATE usuarios SET hash_clave = ? WHERE id = ?",
                     (auth.hash_clave(r.nueva_clave), usuario["id"]))
    return {"ok": True, "mensaje": "Contraseña actualizada. Ya puedes ingresar."}


# ---------- sesion ----------

@router.get("/yo")
def yo(usuario: dict = Depends(usuario_actual)):
    return {"id": usuario["id"], "correo": usuario["correo"], "nombre": usuario["nombre"],
            "google": bool(usuario["google_sub"]), "creado_en": usuario["creado_en"]}


# ---------- pagina de prueba del boton de Google (mientras no hay front) ----------

@router.get("/google/prueba", response_class=HTMLResponse, include_in_schema=False)
def google_prueba():
    """Pagina minima con el boton oficial de Google para probar el SSO sin front.

    Requiere GOOGLE_CLIENT_ID en el .env y http://localhost:8010 como origen
    autorizado de JavaScript en la credencial OAuth de Google Cloud.
    """
    if not config.GOOGLE_CLIENT_ID:
        return HTMLResponse(
            "<h3>Falta GOOGLE_CLIENT_ID en el .env</h3>"
            "<p>Crea la credencial OAuth (aplicacion web) en console.cloud.google.com, "
            "agrega <code>http://localhost:8010</code> como origen autorizado de "
            "JavaScript, pega el ID en el .env y reinicia la API.</p>"
        )
    return HTMLResponse(f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>LupIA - prueba Google SSO</title></head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:40px auto">
  <h2>🔍 LupIA — prueba del ingreso con Google</h2>
  <p>Haz clic en el boton. El <code>credential</code> se envia a
     <code>POST /auth/google</code> y abajo aparece la respuesta (tu JWT).</p>
  <div id="g_id_onload" data-client_id="{config.GOOGLE_CLIENT_ID}"
       data-callback="alRecibir" data-auto_prompt="false"></div>
  <div class="g_id_signin" data-type="standard" data-text="signin_with"
       data-locale="es"></div>
  <pre id="salida" style="background:#f4f4f4;padding:12px;white-space:pre-wrap"></pre>
  <script>
    window.alRecibir = async (resp) => {{
      const r = await fetch('/auth/google', {{
        method: 'POST',
        headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{credential: resp.credential}}),
      }});
      document.getElementById('salida').textContent =
        'HTTP ' + r.status + '\\n' + JSON.stringify(await r.json(), null, 2);
    }};
  </script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</body></html>""")
