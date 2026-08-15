"""Autenticacion de LupIA: correo+clave, codigo por correo (OTP), Google SSO y JWT.

- Claves: hash scrypt (stdlib, sin dependencias fragiles).
- Tokens: JWT HS256 (pyjwt), vigencia JWT_HORAS.
- OTP: 6 digitos, 10 min de vigencia, un solo uso, maximo 3 activos por correo.
- Google: se verifica el ID token (credential del boton de Google) contra
  https://oauth2.googleapis.com/tokeninfo y se valida el aud (GOOGLE_CLIENT_ID).
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
import requests

from . import config, correo, db

OTP_VIGENCIA_MIN = 10
OTP_MAX_ACTIVOS = 3


# ---------- claves (scrypt) ----------

def hash_clave(clave: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(clave.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{h.hex()}"


def verificar_clave(clave: str, guardado: str | None) -> bool:
    if not guardado or ":" not in guardado:
        return False
    salt_hex, h_hex = guardado.split(":", 1)
    h = hashlib.scrypt(clave.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(h.hex(), h_hex)


# ---------- usuarios ----------

def normalizar(correo_: str) -> str:
    return correo_.strip().lower()


def obtener_usuario(conn, correo_: str):
    return conn.execute(
        "SELECT * FROM usuarios WHERE correo = ?", (normalizar(correo_),)
    ).fetchone()


def crear_usuario(conn, correo_: str, nombre: str | None = None,
                  hash_: str | None = None, google_sub: str | None = None):
    conn.execute(
        "INSERT INTO usuarios (correo, nombre, hash_clave, google_sub) VALUES (?,?,?,?) "
        "ON CONFLICT (correo) DO NOTHING",
        (normalizar(correo_), nombre, hash_, google_sub),
    )
    return obtener_usuario(conn, correo_)


def marcar_ingreso(conn, usuario_id: int) -> None:
    conn.execute(
        "UPDATE usuarios SET ultimo_ingreso = ? WHERE id = ?",
        (_ahora().isoformat(), usuario_id),
    )


# ---------- OTP ----------

def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def generar_codigo(correo_: str, proposito: str) -> tuple[str, bool, str | None]:
    """Crea y guarda un codigo. Devuelve (codigo, enviado_por_correo, error_envio).

    Sin BREVO_API_KEY, o si Brevo rechaza el envio (ej: IP no autorizada), el
    codigo NO viaja por correo y el endpoint decide si exponerlo como modo dev.
    Limite: OTP_MAX_ACTIVOS codigos vigentes por correo.
    """
    correo_ = normalizar(correo_)
    ahora = _ahora()
    with db.get_conn() as conn:
        activos = conn.execute(
            "SELECT COUNT(*) AS n FROM codigos_otp "
            "WHERE correo = ? AND proposito = ? AND usado = 0 AND expira_en > ?",
            (correo_, proposito, ahora.isoformat()),
        ).fetchone()["n"]
        if activos >= OTP_MAX_ACTIVOS:
            raise ValueError(
                "Ya se enviaron varios codigos. Espera unos minutos e intenta de nuevo."
            )
        codigo = f"{secrets.randbelow(1_000_000):06d}"
        expira = (ahora + timedelta(minutes=OTP_VIGENCIA_MIN)).isoformat()
        conn.execute(
            "INSERT INTO codigos_otp (correo, codigo, proposito, expira_en) VALUES (?,?,?,?)",
            (correo_, codigo, proposito, expira),
        )

    enviado = False
    error_envio: str | None = None
    if config.BREVO_API_KEY:
        titulo = ("Tu codigo para entrar a LupIA" if proposito == "ingreso"
                  else "Codigo para restablecer tu contraseña en LupIA")
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px">
          <h2 style="color:#1a1a2e">🔍 LupIA</h2>
          <p>{'Usa este codigo para ingresar' if proposito == 'ingreso'
              else 'Usa este codigo para restablecer tu contraseña'}:</p>
          <p style="font-size:34px;font-weight:bold;letter-spacing:8px">{codigo}</p>
          <p style="color:#666">Vence en {OTP_VIGENCIA_MIN} minutos. Si no lo pediste, ignora este correo.</p>
        </div>
        """
        try:
            correo.enviar_correo([correo_], titulo, html)
            enviado = True
        except requests.RequestException as e:
            cuerpo = getattr(getattr(e, "response", None), "text", "") or str(e)
            error_envio = cuerpo[:200]
    return codigo, enviado, error_envio


def validar_codigo(correo_: str, codigo: str, proposito: str) -> bool:
    """Valida y consume el codigo (un solo uso)."""
    correo_ = normalizar(correo_)
    with db.get_conn() as conn:
        fila = conn.execute(
            "SELECT id, expira_en FROM codigos_otp "
            "WHERE correo = ? AND codigo = ? AND proposito = ? AND usado = 0 "
            "ORDER BY id DESC LIMIT 1",
            (correo_, codigo.strip(), proposito),
        ).fetchone()
        if not fila:
            return False
        if fila["expira_en"] < _ahora().isoformat():
            return False
        conn.execute("UPDATE codigos_otp SET usado = 1 WHERE id = ?", (fila["id"],))
    return True


# ---------- JWT ----------

def crear_token(usuario_id: int, correo_: str) -> str:
    ahora = _ahora()
    return jwt.encode(
        {
            "sub": str(usuario_id),
            "correo": normalizar(correo_),
            "iat": ahora,
            "exp": ahora + timedelta(hours=config.JWT_HORAS),
        },
        config.JWT_SECRETO,
        algorithm="HS256",
    )


def decodificar_token(token: str) -> dict:
    """Lanza jwt.InvalidTokenError (incluye expiracion) si no es valido."""
    return jwt.decode(token, config.JWT_SECRETO, algorithms=["HS256"])


# ---------- Google SSO ----------

def verificar_token_google(credential: str) -> dict:
    """Verifica el ID token que entrega el boton de Google Identity Services.

    Devuelve {correo, nombre, sub}. Lanza ValueError si no es valido.
    """
    if not config.GOOGLE_CLIENT_ID:
        raise ValueError(
            "Falta GOOGLE_CLIENT_ID en el .env. Crear credencial OAuth en "
            "console.cloud.google.com > APIs y servicios > Credenciales > "
            "ID de cliente OAuth (aplicacion web) y agregar los origenes autorizados."
        )
    r = requests.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": credential}, timeout=15,
    )
    if r.status_code != 200:
        raise ValueError("Token de Google invalido o vencido")
    datos = r.json()
    if datos.get("aud") != config.GOOGLE_CLIENT_ID:
        raise ValueError("El token de Google no corresponde a esta aplicacion (aud)")
    if str(datos.get("email_verified")).lower() != "true":
        raise ValueError("El correo de la cuenta Google no esta verificado")
    return {
        "correo": normalizar(datos["email"]),
        "nombre": datos.get("name"),
        "sub": datos["sub"],
    }
