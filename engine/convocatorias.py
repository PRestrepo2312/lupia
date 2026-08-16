"""Matching de convocatorias abiertas (dataset p6dx-8zbt) contra el perfil de una empresa.

La afinidad se calcula con el historial real del NIT en SECOP II:
tipos de contrato que ya ejecuto, departamentos donde ya trabajo y las
palabras mas frecuentes de los objetos de sus contratos. Sin NIT se cae a
un perfil generico de reconstruccion (obra/suministro en los departamentos
de la emergencia).
"""
import time
import unicodedata
from collections import Counter

from . import config, proveedores, soda

# Palabras que no dicen nada del sector (aparecen en casi todo objeto contractual)
_GENERICAS = {
    "prestacion", "servicios", "servicio", "apoyo", "gestion", "profesionales",
    "profesional", "contrato", "contratar", "municipio", "departamento", "objeto",
    "realizar", "mediante", "actividades", "desarrollo", "proceso", "procesos",
    "entidad", "vigencia", "conforme", "acuerdo", "marco", "dentro", "para",
    "las", "los", "del", "con", "por", "una", "como", "sus", "que", "the",
}

_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 6 * 3600  # 6 horas


def _sin_acentos(texto: str) -> str:
    nfd = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn").lower().strip()


def _palabras_clave(descripciones: list[str], maximo: int = 6) -> list[str]:
    """Las palabras mas repetidas (>=5 letras, no genericas) del historial."""
    conteo: Counter[str] = Counter()
    for d in descripciones:
        for palabra in _sin_acentos(d).split():
            limpia = "".join(c for c in palabra if c.isalpha())
            if len(limpia) >= 5 and limpia not in _GENERICAS:
                conteo[limpia] += 1
    return [p for p, n in conteo.most_common(maximo) if n >= 2]


def _perfil_de_matching(nit: str | None) -> dict:
    """Extrae del historial del NIT: tipos de contrato, departamentos y palabras clave."""
    if not nit:
        return {
            "tipos": ["Obra", "Suministro", "Interventoría"],
            "departamentos": list(config.DEPARTAMENTOS_EMERGENCIA),
            "palabras": [],
            "razon_social": None,
        }
    perfil = proveedores.trazabilidad(nit)
    contratos = perfil.get("contratos_top") or []
    tipos = [t for t, _ in Counter(
        c.get("tipo_de_contrato") for c in contratos if c.get("tipo_de_contrato")
    ).most_common(3)]
    deptos = [e.get("departamento") for e in (perfil.get("top_entidades") or [])
              if e.get("departamento")][:6]
    palabras = _palabras_clave([c.get("descripcion_del_proceso") or "" for c in contratos])
    return {
        "tipos": tipos,
        "departamentos": deptos,
        "palabras": palabras,
        "razon_social": (perfil.get("razones_sociales") or [None])[0],
    }


def _traer_abiertos(tipos: list[str], dias: int = 45) -> list[dict]:
    """Procesos abiertos y no adjudicados publicados en los ultimos `dias`."""
    desde = time.strftime("%Y-%m-%d", time.localtime(time.time() - dias * 86400))
    condiciones = [
        "estado_de_apertura_del_proceso='Abierto'",
        "adjudicado='No'",
        "estado_del_procedimiento in('Publicado','Abierto')",
        f"fecha_de_publicacion_del >= '{desde}'",
        "precio_base > 0",
    ]
    if tipos:
        lista = ",".join("'" + t.replace("'", "") + "'" for t in tipos)
        condiciones.append(f"tipo_de_contrato in({lista})")
    campos = ("id_del_proceso,referencia_del_proceso,entidad,nit_entidad,"
              "departamento_entidad,ciudad_entidad,nombre_del_procedimiento,"
              "descripci_n_del_procedimiento,precio_base,modalidad_de_contratacion,"
              "tipo_de_contrato,fecha_de_publicacion_del,duracion,unidad_de_duracion,"
              "urlproceso")
    return soda.soda_get(
        config.DATASET_PROCESOS,
        params={
            "$where": " AND ".join(condiciones),
            "$select": campos,
            "$order": "fecha_de_publicacion_del DESC",
            "$limit": 400,
        },
        intentos=2,
        timeout=25,
    )


def buscar(nit: str | None) -> list[dict]:
    """Top de convocatorias abiertas con afinidad y razon explicada. Cache 6h."""
    llave = nit or "_generico"
    en_cache = _CACHE.get(llave)
    if en_cache and time.time() - en_cache[0] < _CACHE_TTL:
        return en_cache[1]

    matching = _perfil_de_matching(nit)
    procesos = _traer_abiertos(matching["tipos"])
    deptos_empresa = {_sin_acentos(d) for d in matching["departamentos"]}
    deptos_emergencia = {_sin_acentos(d) for d in config.DEPARTAMENTOS_EMERGENCIA}
    hoy = time.time()

    resultado = []
    for p in procesos:
        depto = p.get("departamento_entidad") or ""
        texto = _sin_acentos((p.get("nombre_del_procedimiento") or "")
                             + " " + (p.get("descripci_n_del_procedimiento") or ""))
        afinidad = 0
        razones = []
        if matching["tipos"] and p.get("tipo_de_contrato") in matching["tipos"]:
            afinidad += 40
            razones.append(f"tipo {p['tipo_de_contrato']} como tu historial" if nit
                           else f"tipo {p['tipo_de_contrato']}")
        if _sin_acentos(depto) in deptos_empresa:
            afinidad += 25
            razones.append(f"ya contrataste en {depto}" if nit else f"zona de emergencia: {depto}")
        elif _sin_acentos(depto) in deptos_emergencia:
            afinidad += 12
            razones.append(f"zona de reconstruccion: {depto}")
        coincidencias = [w for w in matching["palabras"] if w in texto]
        if coincidencias:
            afinidad += min(20, 7 * len(coincidencias))
            razones.append("objeto afin: " + ", ".join(coincidencias[:3]))
        fecha_pub = p.get("fecha_de_publicacion_del") or ""
        try:
            publicada = time.mktime(time.strptime(fecha_pub[:10], "%Y-%m-%d"))
            if hoy - publicada <= 7 * 86400:
                afinidad += 10
                razones.append("publicada esta semana")
        except (ValueError, OverflowError):
            pass
        if afinidad < 40:
            continue
        url = p.get("urlproceso")
        if isinstance(url, dict):
            url = url.get("url")
        resultado.append({
            "afinidad": min(98, afinidad),
            "id_del_proceso": p.get("id_del_proceso"),
            "referencia": p.get("referencia_del_proceso"),
            "entidad": p.get("entidad"),
            "departamento": depto,
            "ciudad": p.get("ciudad_entidad"),
            "objeto": p.get("nombre_del_procedimiento") or p.get("descripci_n_del_procedimiento"),
            "precio_base": float(p.get("precio_base") or 0),
            "modalidad": p.get("modalidad_de_contratacion"),
            "tipo_de_contrato": p.get("tipo_de_contrato"),
            "publicada": fecha_pub[:10],
            "duracion": f"{p.get('duracion', '')} {p.get('unidad_de_duracion', '')}".strip(),
            "url": url,
            "razon": " · ".join(razones),
        })

    resultado.sort(key=lambda x: (-x["afinidad"], -x["precio_base"]))
    top = resultado[:10]
    _CACHE[llave] = (time.time(), top)
    return top
