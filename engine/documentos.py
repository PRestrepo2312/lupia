"""Documentos de un proceso de SECOP II: listar, descargar y extraer texto.

Aprovecha que la pantalla de detalle solo pide captcha cuando la ruta viene con
mayusculas ("/Public/Tendering/OpportunityDetail/Index"). Si se pide en minusculas
el servidor entrega el HTML completo, del que se extraen los ids de cada documento;
luego se bajan del endpoint publico de archivos (RetrieveFile), que no pide captcha.
Todo por HTTP puro: no abre navegador ni resuelve captchas.
"""
import io
import re

import requests

HOST = "https://community.secop.gov.co"
# minusculas a proposito: el filtro del captcha es case-sensitive
DETAIL_PATH = "/public/tendering/opportunitydetail/index"
RETRIEVE_URL = HOST + "/Public/Archive/RetrieveFile/Index"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
DOC_ID_PATTERNS = [
    re.compile(r"documentFileId='\s*\+\s*'(\d+)'"),
    re.compile(r"docId='\s*\+\s*'(\d+)'"),
]
# tope de texto por documento que se envia a la IA / se cachea
MAX_TEXTO = 20000


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


# Clasificacion de importancia por el nombre del archivo. Los nombres en SECOP son
# muy descriptivos ("ESTUDIOS PREVIOS...", "COTIZACION...", "camara de comercio...").
# relevancia: alta = clave para auditar precio/objeto; media = contexto legal;
#             baja = soporte del proponente (no aporta al analisis de sobrecosto).
_REGLAS = [
    ("alta", "Estudio previo", ["estudio previo", "estudios previos", "analisis del sector",
                                "analisis de sector", "estudio de mercado", "estudio del sector",
                                "sondeo de mercado"]),
    ("alta", "Cotizacion / oferta", ["cotizacion", "oferta economica", "propuesta economica",
                                     "oferta tecnica y economica", "oferta mercantil"]),
    ("alta", "Presupuesto / APU", ["presupuesto", "analisis de precios", "precios unitarios",
                                   "apu", "presupuesto oficial"]),
    ("alta", "Contrato / minuta", ["contrato", "minuta"]),
    ("alta", "Pliego / invitacion", ["pliego", "invitacion", "terminos de referencia",
                                     "terminos y condiciones", "condiciones especiales"]),
    ("media", "Justificacion", ["justificacion", "modalidad"]),
    ("media", "Presupuestal (CDP/RP)", ["cdp", "certificado de disponibilidad", "registro presupuestal",
                                        "vigencia futura", "bpin", "mga"]),
    ("media", "Acto administrativo", ["resolucion", "decreto", "acuerdo", "acta"]),
    ("media", "Seleccion", ["informe de seleccion", "evaluacion", "adjudicacion",
                            "designacion", "supervision"]),
    ("baja", "Soporte del proponente", ["camara de comercio", "rut", "cedula", "antecedentes",
                                        "poliza", "garantia", "hoja de vida", "certificacion bancaria",
                                        "paz y salvo", "rup", "parafiscales", "seguridad social",
                                        "certificaciones", "experiencia"]),
]


def _sin_tildes(t: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", t or "")
                   if unicodedata.category(c) != "Mn").lower()


def clasificar(nombre: str) -> dict:
    """Devuelve {relevancia, categoria} segun el nombre del documento."""
    n = _sin_tildes(nombre)
    for relevancia, categoria, claves in _REGLAS:
        if any(k in n for k in claves):
            return {"relevancia": relevancia, "categoria": categoria}
    return {"relevancia": "media", "categoria": "Otro documento"}


_ORDEN_RELEVANCIA = {"alta": 0, "media": 1, "baja": 2}


def documentos_recomendados(docs: list[dict], maximo: int = 6) -> list[str]:
    """doc_ids sugeridos para el analisis IA: prioriza alta > media, excluye baja."""
    utiles = [d for d in docs if d.get("relevancia") != "baja"]
    utiles.sort(key=lambda d: _ORDEN_RELEVANCIA.get(d.get("relevancia"), 1))
    elegidos = [d["doc_id"] for d in utiles[:maximo]]
    return elegidos or [d["doc_id"] for d in docs[:maximo]]


def notice_uid_desde_url(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"noticeUID=([A-Za-z0-9.\-]+)", url, re.IGNORECASE)
    if m:
        return m.group(1)
    if re.fullmatch(r"CO1\.[A-Z]+\.\d+", url.strip(), re.IGNORECASE):
        return url.strip()
    return None


def _sanear(nombre: str) -> str:
    nombre = re.sub(r'[\\/*?:"<>|]', "_", nombre or "").strip()
    return nombre or "documento"


def _nombre_de_headers(headers, fallback: str) -> str:
    cd = headers.get("Content-Disposition", "")
    m = re.search(r'filename\*?="?([^";]+)"?', cd)
    if m:
        nombre = m.group(1)
        if "''" in nombre:  # RFC 5987: UTF-8''nombre
            nombre = nombre.split("''", 1)[1]
        return _sanear(requests.utils.unquote(nombre))
    return _sanear(fallback)


def _ids_de_documentos(html: str) -> list[str]:
    vistos: dict[str, None] = {}
    for patron in DOC_ID_PATTERNS:
        for m in patron.finditer(html):
            vistos.setdefault(m.group(1), None)
    return list(vistos.keys())


def listar(notice_uid: str, session: requests.Session | None = None) -> list[dict]:
    """Lista {doc_id, nombre, tipo, tam} de un proceso (headers, sin bajar el archivo)."""
    s = session or _session()
    url = f"{HOST}{DETAIL_PATH}?noticeUID={notice_uid}&isFromPublicArea=True"
    r = s.get(url, timeout=60)
    r.raise_for_status()
    if "GoogleReCaptcha" in r.url:
        raise RuntimeError("SECOP redirigio al captcha (cambio el filtro).")
    docs = []
    for doc_id in _ids_de_documentos(r.text):
        nombre, tipo, tam = _cabecera_documento(s, doc_id)
        docs.append({"doc_id": doc_id, "nombre": nombre, "tipo": tipo, "tam": tam,
                     **clasificar(nombre)})
    return docs


def _cabecera_documento(session: requests.Session, doc_id: str) -> tuple[str, str, int]:
    """Lee nombre/tipo/tamano sin descargar todo el cuerpo (stream + primer chunk)."""
    try:
        with session.get(RETRIEVE_URL, params=_params(doc_id), timeout=60, stream=True) as r:
            nombre = _nombre_de_headers(r.headers, f"{doc_id}.bin")
            tipo = r.headers.get("Content-Type", "").split(";")[0]
            tam = int(r.headers.get("Content-Length") or 0)
            return nombre, tipo, tam
    except requests.RequestException:
        return f"{doc_id}.bin", "", 0


def _params(doc_id: str) -> dict:
    return {"DocumentId": doc_id, "InCommunity": "False",
            "InPaymentGateway": "False", "DocUniqueIdentifier": ""}


def descargar(doc_id: str, session: requests.Session | None = None) -> tuple[str, str, bytes]:
    """Devuelve (nombre, content_type, contenido) de un documento."""
    s = session or _session()
    r = s.get(RETRIEVE_URL, params=_params(doc_id), timeout=180)
    r.raise_for_status()
    nombre = _nombre_de_headers(r.headers, f"{doc_id}.bin")
    tipo = r.headers.get("Content-Type", "application/octet-stream").split(";")[0]
    return nombre, tipo, r.content


def extraer_texto(nombre: str, contenido: bytes) -> str:
    """Texto plano de PDF/DOCX/XLSX/TXT. Cadena vacia si no se puede."""
    ext = (nombre.rsplit(".", 1)[-1] if "." in nombre else "").lower()
    try:
        if contenido[:4] == b"%PDF" or ext == "pdf":
            import pdfplumber
            with pdfplumber.open(io.BytesIO(contenido)) as pdf:
                partes = []
                for pagina in pdf.pages:
                    partes.append(pagina.extract_text() or "")
                    if sum(len(p) for p in partes) > MAX_TEXTO:
                        break
                return "\n".join(partes)[:MAX_TEXTO]
        if ext == "docx":
            import docx
            d = docx.Document(io.BytesIO(contenido))
            return "\n".join(p.text for p in d.paragraphs)[:MAX_TEXTO]
        if ext in ("xlsx", "xlsm"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
            filas = []
            for hoja in wb.worksheets:
                for fila in hoja.iter_rows(values_only=True):
                    filas.append(" | ".join("" if c is None else str(c) for c in fila))
                    if sum(len(f) for f in filas) > MAX_TEXTO:
                        break
            return "\n".join(filas)[:MAX_TEXTO]
        if ext in ("txt", "csv"):
            return contenido.decode("utf-8", errors="ignore")[:MAX_TEXTO]
    except Exception:
        return ""
    return ""


def descargar_y_extraer(docs: list[dict], session: requests.Session | None = None) -> list[dict]:
    """Baja cada documento y le agrega 'texto'. Reusa una sola sesion."""
    s = session or _session()
    salida = []
    for d in docs:
        try:
            nombre, tipo, contenido = descargar(d["doc_id"], s)
            texto = extraer_texto(nombre, contenido)
            salida.append({**d, "nombre": nombre, "tipo": tipo,
                           "tam": len(contenido), "texto": texto})
        except requests.RequestException:
            salida.append({**d, "texto": ""})
    return salida
