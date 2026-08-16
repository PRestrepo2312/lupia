"""Envio de correos via Brevo (API transaccional) y plantillas HTML.

Brevo free tier: 300 correos/dia — de sobra para el demo.
Las plantillas siguen la paleta del sitio (ui/lib/theme.ts): crema, tinta,
azul IA y los colores de riesgo. Todo inline y en tablas: compatible email.
"""
import requests

from . import config

BREVO_BASE = "https://api.brevo.com/v3"

# Paleta compartida con el front (ui/lib/theme.ts)
BG = "#f5f4ef"
SURFACE = "#fffefb"
LINE = "#e2ded4"
INK = "#1b1a17"
INK2 = "#413e38"
MUTED = "#6b675f"
IA = "#2f5d78"
ALTO = "#b4442f"
MEDIO = "#a8761f"
BAJO = "#4a7a63"
SANS = "Helvetica,Arial,sans-serif"
MONO = "'Courier New',Courier,monospace"


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


# ---------- plantilla base ----------

def _base(eyebrow: str, contenido: str, pie: str | None = None) -> str:
    """Marco comun: fondo crema, tarjeta blanca, cabecera con el wordmark."""
    pie = pie or ("LupIA no acusa a nadie. Señala lo que amerita revisión, "
                  "con datos oficiales de SECOP II (datos.gov.co). Verifica siempre en la fuente.")
    return f"""<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:{BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;background:{SURFACE};border:1px solid {LINE};border-radius:14px;overflow:hidden">
      <tr><td style="padding:26px 32px 20px;border-bottom:1px solid {LINE}">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:10px">
            <div style="width:22px;height:22px;border:3px solid {INK};border-radius:50%"></div>
          </td>
          <td style="vertical-align:middle;font-family:{SANS};font-size:20px;font-weight:bold;
                     letter-spacing:-0.5px;color:{INK}">LupIA</td>
        </tr></table>
        <div style="font-family:{MONO};font-size:10px;letter-spacing:2px;color:{MUTED};
                    text-transform:uppercase;margin-top:14px">{eyebrow}</div>
      </td></tr>
      <tr><td style="padding:26px 32px 30px">{contenido}</td></tr>
      <tr><td style="padding:18px 32px 24px;border-top:1px solid {LINE}">
        <div style="font-family:{SANS};font-size:11.5px;line-height:1.6;color:{MUTED}">{pie}</div>
        <div style="font-family:{MONO};font-size:10px;letter-spacing:1px;color:{MUTED};margin-top:10px">
          <a href="https://lupia.click" style="color:{IA};text-decoration:none">LUPIA.CLICK</a>
          &nbsp;·&nbsp; MONITOR CIUDADANO DE CONTRATACION PUBLICA</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _boton(url: str, texto: str) -> str:
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
      <td style="background:{INK};border-radius:9px">
        <a href="{url}" style="display:inline-block;padding:12px 22px;font-family:{SANS};
           font-size:13.5px;font-weight:bold;color:{SURFACE};text-decoration:none">{texto}</a>
      </td></tr></table>"""


def _etiqueta(texto: str) -> str:
    return (f'<div style="font-family:{MONO};font-size:10px;letter-spacing:1.5px;'
            f'color:{MUTED};text-transform:uppercase;margin-bottom:5px">{texto}</div>')


def _color_riesgo(score) -> str:
    try:
        n = float(score)
    except (TypeError, ValueError):
        return MUTED
    return ALTO if n >= 70 else MEDIO if n >= 40 else BAJO


# ---------- plantillas ----------

def html_alerta(contrato: dict, alertas: list[dict]) -> str:
    valor = contrato.get("valor_del_contrato") or 0
    filas_senales = "".join(
        f"""<tr>
          <td style="padding:10px 0;border-top:1px solid {LINE};vertical-align:top;width:52px">
            <div style="width:40px;text-align:center;background:{_color_riesgo(a.get('score'))};
                        color:{SURFACE};font-family:{MONO};font-size:13px;font-weight:bold;
                        border-radius:8px;padding:7px 0">{a.get('score', '')}</div>
          </td>
          <td style="padding:10px 0 10px 14px;border-top:1px solid {LINE}">
            <div style="font-family:{SANS};font-size:13.5px;font-weight:bold;color:{INK}">{a.get('senal', '')}</div>
            <div style="font-family:{SANS};font-size:13px;line-height:1.55;color:{MUTED};margin-top:3px">{a.get('detalle', '')}</div>
          </td>
        </tr>"""
        for a in alertas
    )
    url = contrato.get("urlproceso") or "https://www.secop.gov.co"
    contenido = f"""
      {_etiqueta(f"{contrato.get('departamento', '')} · {contrato.get('ciudad', '')}")}
      <div style="font-family:{SANS};font-size:19px;font-weight:bold;line-height:1.35;
                  letter-spacing:-0.3px;color:{INK};margin-bottom:8px">
        {contrato.get('descripcion_del_proceso') or contrato.get('objeto_del_contrato', '')}</div>
      <div style="font-family:{SANS};font-size:13.5px;color:{INK2};margin-bottom:18px">
        {contrato.get('nombre_entidad', '')}
        {('&rarr; ' + contrato['proveedor_adjudicado']) if contrato.get('proveedor_adjudicado') else ''}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:{BG};border:1px solid {LINE};border-radius:10px;margin-bottom:18px">
        <tr>
          <td style="padding:14px 18px">{_etiqueta('Valor del contrato')}
            <div style="font-family:{SANS};font-size:20px;font-weight:bold;color:{INK}">${valor:,.0f}</div></td>
          <td style="padding:14px 18px">{_etiqueta('Modalidad')}
            <div style="font-family:{SANS};font-size:13.5px;color:{INK2}">{contrato.get('modalidad_de_contratacion', '—')}</div></td>
        </tr>
      </table>
      {_etiqueta('Señales que ameritan revisión')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas_senales}</table>
      {_boton(url, 'Ver el contrato original en SECOP II')}
    """
    return _base("Nueva señal detectada", contenido)


def html_convocatorias(items: list[dict], razon_social: str | None = None) -> str:
    filas = "".join(
        f"""<tr>
          <td style="padding:14px 0;border-top:1px solid {LINE};vertical-align:top;width:56px">
            <div style="font-family:{SANS};font-size:22px;font-weight:bold;color:{IA}">{c.get('afinidad')}</div>
            <div style="font-family:{MONO};font-size:9px;letter-spacing:1px;color:{MUTED}">AFINIDAD</div>
          </td>
          <td style="padding:14px 0 14px 16px;border-top:1px solid {LINE}">
            <div style="font-family:{MONO};font-size:10.5px;color:{MUTED};margin-bottom:4px">
              {c.get('entidad', '')} · {c.get('departamento', '')}</div>
            <div style="font-family:{SANS};font-size:14.5px;font-weight:bold;line-height:1.4;color:{INK}">{c.get('objeto', '')}</div>
            <div style="font-family:{SANS};font-size:12.5px;line-height:1.5;color:{MUTED};margin-top:4px">{c.get('razon', '')}</div>
            <div style="font-family:{SANS};font-size:13px;color:{INK2};margin-top:6px">
              Valor base <b>${c.get('precio_base', 0):,.0f}</b> · {c.get('modalidad', '')} · publicada {c.get('publicada', '')}</div>
            {f'<div style="margin-top:6px"><a href="{c["url"]}" style="font-family:{SANS};font-size:13px;font-weight:bold;color:{IA};text-decoration:none">Ver el proceso en SECOP II &rarr;</a></div>' if c.get('url') else ''}
          </td>
        </tr>"""
        for c in items
    )
    saludo = f" para {razon_social}" if razon_social else ""
    contenido = f"""
      <div style="font-family:{SANS};font-size:19px;font-weight:bold;letter-spacing:-0.3px;
                  color:{INK};margin-bottom:8px">Convocatorias abiertas que calzan con tu perfil{saludo}</div>
      <div style="font-family:{SANS};font-size:13.5px;line-height:1.6;color:{MUTED};margin-bottom:10px">
        Cruzamos tu historial real en SECOP II con los procesos abiertos y no adjudicados
        publicados en datos.gov.co. Estas son las mejores coincidencias de hoy.</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas}</table>
    """
    pie = ("La afinidad es una guía calculada por LupIA con el tipo de contrato, el territorio "
           "y el objeto de tu historial. Revisa siempre los pliegos completos en SECOP II.")
    return _base("Modo empresa · Matching de convocatorias", contenido, pie)


def html_codigo(codigo: str, proposito: str, minutos: int) -> str:
    accion = ("para entrar a LupIA" if proposito == "ingreso"
              else "para restablecer tu contraseña")
    contenido = f"""
      <div style="font-family:{SANS};font-size:16px;line-height:1.55;color:{INK2};margin-bottom:18px">
        Usa este código {accion}:</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:{BG};border:1px solid {LINE};border-radius:10px">
        <tr><td align="center" style="padding:22px 0">
          <div style="font-family:{MONO};font-size:36px;font-weight:bold;letter-spacing:10px;
                      color:{INK};padding-left:10px">{codigo}</div>
        </td></tr>
      </table>
      <div style="font-family:{SANS};font-size:13px;line-height:1.6;color:{MUTED};margin-top:16px">
        Vence en {minutos} minutos y solo sirve una vez.
        Si no lo pediste, ignora este correo: nadie puede entrar sin él.</div>
    """
    pie = "Este código lo pidió alguien desde lupia.click. LupIA nunca te pedirá el código por otro medio."
    return _base("Código de un solo uso", contenido, pie)
