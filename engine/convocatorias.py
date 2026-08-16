"""Matching de convocatorias abiertas (dataset p6dx-8zbt) contra el perfil de una empresa.

La afinidad se calcula con el historial real del NIT en SECOP II:
tipos de contrato que ya ejecuto, departamentos donde ya trabaja y las palabras
mas frecuentes de los objetos de sus contratos.

Robustez: el listado de procesos abiertos se trae UNA vez y se cachea a nivel
proceso (sirve a todos los NIT); datos.gov.co es intermitente, asi que si el
refresco falla se sigue sirviendo el ultimo listado bueno (stale-on-error).
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
_CACHE_TTL = 6 * 3600  # 6 horas por (nit, modo)

# Cache del listado crudo de procesos abiertos, compartido por todos los NIT
_ABIERTOS: tuple[float, list[dict]] | None = None
_ABIERTOS_TTL = 3600  # 1 hora


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
            "tipos": ["Obra", "Suministros", "Interventoría"],
            "departamentos": list(config.DEPARTAMENTOS_EMERGENCIA),
            "palabras": [],
            "razon_social": None,
        }
    try:
        perfil = proveedores.trazabilidad(nit)
    except Exception:
        perfil = None
    if not perfil:
        return {"tipos": [], "departamentos": [], "palabras": [], "razon_social": None}
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


def _traer_abiertos(dias: int = 45) -> list[dict]:
    """Procesos abiertos y no adjudicados de los ultimos `dias`. Cache 1h compartido.

    Si datos.gov.co falla y hay un listado previo, se devuelve ese (stale-on-error).
    """
    global _ABIERTOS
    if _ABIERTOS and time.time() - _ABIERTOS[0] < _ABIERTOS_TTL:
        return _ABIERTOS[1]

    desde = time.strftime("%Y-%m-%d", time.localtime(time.time() - dias * 86400))
    campos = ("id_del_proceso,referencia_del_proceso,entidad,nit_entidad,"
              "departamento_entidad,ciudad_entidad,nombre_del_procedimiento,"
              "descripci_n_del_procedimiento,precio_base,modalidad_de_contratacion,"
              "tipo_de_contrato,fecha_de_publicacion_del,duracion,unidad_de_duracion,"
              "urlproceso")
    try:
        filas = soda.soda_get(
            config.DATASET_PROCESOS,
            params={
                "$where": ("estado_de_apertura_del_proceso='Abierto' AND adjudicado='No' "
                           "AND estado_del_procedimiento in('Publicado','Abierto') "
                           f"AND fecha_de_publicacion_del >= '{desde}' AND precio_base > 0"),
                "$select": campos,
                "$order": "fecha_de_publicacion_del DESC",
                "$limit": 600,
            },
            intentos=4,
            timeout=25,
        )
        _ABIERTOS = (time.time(), filas)
        return filas
    except Exception:
        if _ABIERTOS:  # servir el ultimo listado bueno aunque este vencido
            return _ABIERTOS[1]
        raise


def _afinidad(p: dict, matching: dict, deptos_emergencia: set, hoy: float) -> tuple[int, list[str]]:
    depto = p.get("departamento_entidad") or ""
    texto = _sin_acentos((p.get("nombre_del_procedimiento") or "")
                         + " " + (p.get("descripci_n_del_procedimiento") or ""))
    deptos_empresa = {_sin_acentos(d) for d in matching["departamentos"]}
    con_nit = bool(matching["tipos"] or matching["departamentos"])
    afinidad = 0
    razones = []
    if matching["tipos"] and p.get("tipo_de_contrato") in matching["tipos"]:
        afinidad += 40
        razones.append(f"tipo {p['tipo_de_contrato']} como tu historial" if con_nit
                       else f"tipo {p['tipo_de_contrato']}")
    if _sin_acentos(depto) in deptos_empresa:
        afinidad += 25
        razones.append(f"ya contrataste en {depto}")
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
    return min(98, afinidad), razones


def _fila(p: dict, afinidad: int, razones: list[str]) -> dict:
    url = p.get("urlproceso")
    if isinstance(url, dict):
        url = url.get("url")
    return {
        "afinidad": afinidad,
        "id_del_proceso": p.get("id_del_proceso"),
        "referencia": p.get("referencia_del_proceso"),
        "entidad": p.get("entidad"),
        "departamento": p.get("departamento_entidad") or "",
        "ciudad": p.get("ciudad_entidad"),
        "objeto": p.get("nombre_del_procedimiento") or p.get("descripci_n_del_procedimiento"),
        "precio_base": float(p.get("precio_base") or 0),
        "modalidad": p.get("modalidad_de_contratacion"),
        "tipo_de_contrato": p.get("tipo_de_contrato"),
        "publicada": (p.get("fecha_de_publicacion_del") or "")[:10],
        "duracion": f"{p.get('duracion', '')} {p.get('unidad_de_duracion', '')}".strip(),
        "url": url,
        "razon": " · ".join(razones) if razones else "proceso abierto en tu ventana de interés",
    }


def buscar(nit: str | None, solo_afines: bool = True) -> list[dict]:
    """Convocatorias abiertas rankeadas por afinidad. Cache 6h por (nit, modo).

    solo_afines=True (default): solo las que superan el umbral de afinidad.
    solo_afines=False: TODAS las abiertas recientes, aunque no calcen con el perfil.
    """
    llave = f"{nit or '_gen'}::{'af' if solo_afines else 'all'}"
    en_cache = _CACHE.get(llave)
    if en_cache and time.time() - en_cache[0] < _CACHE_TTL:
        return en_cache[1]

    matching = _perfil_de_matching(nit)
    procesos = _traer_abiertos()
    deptos_emergencia = {_sin_acentos(d) for d in config.DEPARTAMENTOS_EMERGENCIA}
    hoy = time.time()

    resultado = []
    vistos: set = set()
    for p in procesos:
        afinidad, razones = _afinidad(p, matching, deptos_emergencia, hoy)
        if solo_afines and afinidad < 40:
            continue
        fila = _fila(p, afinidad, razones)
        # el dataset repite procesos (fases/lotes): dedup por objeto+entidad+valor
        clave = (_sin_acentos(fila["objeto"] or ""), fila["entidad"], round(fila["precio_base"]))
        if clave in vistos:
            continue
        vistos.add(clave)
        resultado.append(fila)

    resultado.sort(key=lambda x: (-x["afinidad"], -x["precio_base"]))
    top = resultado[: 10 if solo_afines else 40]
    _CACHE[llave] = (time.time(), top)
    return top
