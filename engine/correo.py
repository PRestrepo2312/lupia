"""Envio de correos de alerta via Brevo (API transaccional).

Brevo free tier: 300 correos/dia — de sobra para el demo.
"""
import requests

from . import config

BREVO_BASE = "https://api.brevo.com/v3"


def _headers() -> dict:
    return {
        "api-key": config.BREVO_API_KEY,
        "accept": "application/json",
        "content-type": "application/json",
    }


def verificar_cuenta() -> dict:
    """GET /account — valida que la API key sirve. Lanza si no."""
    r = requests.get(f"{BREVO_BASE}/account", headers=_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def enviar_correo(destinatarios: list[str], asunto: str, html: str) -> dict:
    payload = {
        "sender": {"name": config.NOMBRE_REMITENTE, "email": config.CORREO_REMITENTE},
        "to": [{"email": d} for d in destinatarios],
        "subject": asunto,
        "htmlContent": html,
    }
    r = requests.post(f"{BREVO_BASE}/smtp/email", json=payload, headers=_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def html_alerta(contrato: dict, alertas: list[dict]) -> str:
    filas_senales = "".join(
        f"<li><b>{a['senal']}</b> (score {a['score']}): {a['detalle']}</li>"
        for a in alertas
    )
    url = contrato.get("urlproceso") or "https://www.secop.gov.co"
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px">
      <h2 style="color:#1a1a2e">LupIA — nueva señal en {contrato.get('departamento', '')}</h2>
      <p><b>{contrato.get('nombre_entidad', '')}</b> · {contrato.get('ciudad', '')}</p>
      <p>{contrato.get('descripcion_del_proceso') or contrato.get('objeto_del_contrato', '')}</p>
      <p>Valor: <b>${(contrato.get('valor_del_contrato') or 0):,.0f}</b> ·
         Proveedor: {contrato.get('proveedor_adjudicado', '')}</p>
      <ul>{filas_senales}</ul>
      <p><a href="{url}">Ver el contrato original en SECOP</a></p>
      <hr>
      <p style="color:#666;font-size:12px">LupIA no acusa. Señala lo que merece una mirada,
      con datos oficiales de datos.gov.co. Verifica siempre en la fuente.</p>
    </div>
    """
