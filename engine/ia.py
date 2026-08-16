"""Claude: clasificador de pertinencia (senal *1), extractor (senal *2) y explicador.

Plan A: Bedrock (AnthropicBedrockMantle). Plan B: API de Anthropic con API key.
En MODO_DEMO no se llama a la IA: la UI usa las salidas cacheadas del seed.
Los prompts viven en prompts/ (los afina Persona 3).
"""
import json
from pathlib import Path

from . import config

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

ESQUEMA_PERTINENCIA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "description": "Pertinencia 0-100 con la emergencia del sismo"},
        "razon": {"type": "string", "description": "Explicacion corta en lenguaje ciudadano"},
    },
    "required": ["score", "razon"],
    "additionalProperties": False,
}

ESQUEMA_ANALISIS_DOCS = {
    "type": "object",
    "properties": {
        "resumen": {"type": "string", "description": "Que contienen los documentos del proceso y que tan completo esta el expediente, en 2 frases"},
        "coherencia_objeto": {"type": "string", "description": "Si lo que dicen los documentos (objeto, cantidades, valor) coincide con el objeto y el valor del contrato registrado"},
        "analisis_precios": {"type": "string", "description": "Si hay cotizaciones, precios unitarios o estudio de mercado: compara con un rango de mercado razonable y di si lucen inflados o normales. Si NO hay precios en los documentos, dilo con franqueza"},
        "inconsistencias": {"type": "string", "description": "Fechas, montos, firmas o datos que no cuadran entre los documentos o contra el contrato. Si no se detectan, dilo"},
        "nivel_alerta": {"type": "string", "description": "una sola palabra: bajo, medio o alto"},
        "banderas": {"type": "array", "items": {"type": "string"}, "description": "Lista corta (0 a 5) de puntos concretos que un ciudadano deberia verificar"},
    },
    "required": ["resumen", "coherencia_objeto", "analisis_precios", "inconsistencias", "nivel_alerta", "banderas"],
    "additionalProperties": False,
}

ESQUEMA_EXTRACCION = {
    "type": "object",
    "properties": {
        "que_compra": {"type": "string"},
        "cantidad": {"type": ["integer", "null"]},
        "unidad": {"type": ["string", "null"]},
        "precio_unitario_estimable": {"type": "boolean"},
    },
    "required": ["que_compra", "cantidad", "unidad", "precio_unitario_estimable"],
    "additionalProperties": False,
}


def _leer_prompt(nombre: str) -> str:
    return (PROMPTS_DIR / f"{nombre}.md").read_text(encoding="utf-8")


def get_cliente():
    """Devuelve (cliente, model_id) segun IA_PROVEEDOR. None si estamos en modo demo."""
    if config.MODO_DEMO:
        return None, None
    if config.IA_PROVEEDOR == "anthropic" and config.ANTHROPIC_API_KEY:
        import anthropic
        return anthropic.Anthropic(), config.ANTHROPIC_MODEL_ID
    from anthropic import AnthropicBedrockMantle
    return AnthropicBedrockMantle(aws_region=config.AWS_REGION), config.BEDROCK_MODEL_ID


def _es_nova() -> bool:
    return config.IA_PROVEEDOR == "nova" and not config.MODO_DEMO


def _nova_texto(system: str, usuario: str, max_tokens: int = 1024) -> str | None:
    """Amazon Nova via la API Converse de Bedrock (disponible sin autorizacion previa)."""
    import boto3
    rt = boto3.client("bedrock-runtime", region_name=config.AWS_REGION)
    r = rt.converse(
        modelId=config.NOVA_MODEL_ID,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": usuario}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0.2},
    )
    return r["output"]["message"]["content"][0]["text"]


def _extraer_json(texto: str | None) -> dict | None:
    """Nova no garantiza JSON puro: intenta parseo directo y luego el primer {...}."""
    import re
    if not texto:
        return None
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", texto, re.DOTALL)
        try:
            return json.loads(m.group(0)) if m else None
        except json.JSONDecodeError:
            return None


def _ejemplo_valor(prop: dict):
    tipo = prop.get("type")
    tipos = tipo if isinstance(tipo, list) else [tipo]
    if "integer" in tipos or "number" in tipos:
        return 0
    if "boolean" in tipos:
        return False
    if "array" in tipos:
        items = prop.get("items", {"type": "string"})
        return [_ejemplo_valor(items), _ejemplo_valor(items)]
    if "object" in tipos:
        return {k: _ejemplo_valor(p) for k, p in prop.get("properties", {}).items()}
    return prop.get("description", "texto")


def _ejemplo_de(esquema: dict) -> dict:
    """Instancia de ejemplo a partir del esquema (los modelos chicos siguen mejor
    un ejemplo concreto que un JSON Schema, que tienden a repetir)."""
    return {llave: _ejemplo_valor(prop)
            for llave, prop in esquema.get("properties", {}).items()}


def _llamar_json(system: str, usuario: str, esquema: dict, max_tokens: int = 1024) -> dict | None:
    if _es_nova():
        system_json = (
            f"{system}\n\nResponde UNICAMENTE con un objeto JSON con exactamente "
            f"estas llaves y este formato (llena los VALORES para el caso que te dan, "
            f"sin markdown ni texto adicional):\n"
            f"{json.dumps(_ejemplo_de(esquema), ensure_ascii=False)}"
        )
        r = _extraer_json(_nova_texto(system_json, usuario, max_tokens))
        # Si repitio el esquema o faltan llaves obligatorias, no sirve
        if not r or "properties" in r or not all(k in r for k in esquema.get("required", [])):
            return None
        return r
    cliente, modelo = get_cliente()
    if cliente is None:
        return None
    resp = cliente.messages.create(
        model=modelo,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": usuario}],
        output_config={"format": {"type": "json_schema", "schema": esquema}},
    )
    if resp.stop_reason == "refusal":
        return None
    texto = next((b.text for b in resp.content if b.type == "text"), None)
    return json.loads(texto) if texto else None


def clasificar_pertinencia(descripcion: str) -> dict | None:
    """Senal *1: score 0-100 de relacion del objeto con la emergencia + razon."""
    return _llamar_json(_leer_prompt("pertinencia"), descripcion, ESQUEMA_PERTINENCIA)


def extraer_compra(descripcion: str) -> dict | None:
    """Senal *2: que se compra y cuantas unidades (para precio unitario)."""
    return _llamar_json(_leer_prompt("extraccion"), descripcion, ESQUEMA_EXTRACCION)


def responder_chat(pregunta: str, contexto: dict) -> str | None:
    """Chat ciudadano: responde con IA usando datos reales del cache como contexto."""
    cuerpo = (
        f"CONTEXTO (datos oficiales SECOP II):\n{json.dumps(contexto, ensure_ascii=False)}\n\n"
        f"PREGUNTA DEL CIUDADANO: {pregunta}"
    )
    if _es_nova():
        return _nova_texto(_leer_prompt("chat"), cuerpo)
    cliente, modelo = get_cliente()
    if cliente is None:
        return None
    resp = cliente.messages.create(
        model=modelo,
        max_tokens=1024,
        system=_leer_prompt("chat"),
        messages=[{"role": "user", "content": cuerpo}],
    )
    if resp.stop_reason == "refusal":
        return None
    return next((b.text for b in resp.content if b.type == "text"), None)


def analizar_documentos(contrato: dict, documentos: list[dict]) -> dict | None:
    """Lee los documentos del expediente y cruza objeto, valores y precios con IA."""
    docs_ctx = []
    presupuesto = 24000  # total de caracteres de texto que mandamos a la IA
    for d in documentos:
        texto = (d.get("texto") or "").strip()
        if not texto:
            continue
        recorte = texto[: min(len(texto), presupuesto)]
        presupuesto -= len(recorte)
        docs_ctx.append({"documento": d.get("nombre"), "extracto": recorte})
        if presupuesto <= 0:
            break
    if not docs_ctx:
        return None
    contexto = json.dumps(
        {
            "contrato": {k: contrato.get(k) for k in (
                "nombre_entidad", "departamento", "ciudad", "descripcion_del_proceso",
                "objeto_del_contrato", "valor_del_contrato", "proveedor_adjudicado",
                "modalidad_de_contratacion", "fecha_de_firma")},
            "documentos_del_expediente": docs_ctx,
        },
        ensure_ascii=False,
    )
    return _llamar_json(_leer_prompt("documentos"), contexto, ESQUEMA_ANALISIS_DOCS,
                        max_tokens=1500)


def explicar_alerta(contrato: dict, alertas: list[dict]) -> str | None:
    """Explicacion en lenguaje ciudadano de por que este contrato tiene senales."""
    contexto_nova = None
    if _es_nova():
        contexto_nova = True
    cliente, modelo = (None, None) if contexto_nova else get_cliente()
    if cliente is None and not contexto_nova:
        return None
    contexto = json.dumps(
        {
            "contrato": {k: contrato.get(k) for k in (
                "nombre_entidad", "departamento", "ciudad", "descripcion_del_proceso",
                "valor_del_contrato", "proveedor_adjudicado", "modalidad_de_contratacion",
                "fecha_de_firma")},
            "senales": alertas,
        },
        ensure_ascii=False,
    )
    resp = cliente.messages.create(
        model=modelo,
        max_tokens=1024,
        system=_leer_prompt("explicador"),
        messages=[{"role": "user", "content": contexto}],
    )
    if resp.stop_reason == "refusal":
        return None
    return next((b.text for b in resp.content if b.type == "text"), None)
