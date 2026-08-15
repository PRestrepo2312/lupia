"""Cliente minimo para la API SODA de datos.gov.co (sin sodapy, solo requests).

datos.gov.co devuelve 500/503 intermitentes con frecuencia: todo GET reintenta
con backoff exponencial antes de rendirse.
"""
import time

import requests

from . import config


def _headers() -> dict:
    h = {"Accept": "application/json"}
    if config.SODA_APP_TOKEN:
        h["X-App-Token"] = config.SODA_APP_TOKEN
    return h


def soda_get(dataset_id: str, params: dict | None = None, query: str | None = None,
             timeout: int = 120, intentos: int = 5) -> list[dict]:
    """GET a /resource/{id}.json. Usa `query` (SoQL completo) o `params` ($where, $select...)."""
    url = f"https://{config.SODA_DOMAIN}/resource/{dataset_id}.json"
    p = dict(params or {})
    if query:
        p["$query"] = query
    ultimo_error: Exception | None = None
    for intento in range(intentos):
        try:
            r = requests.get(url, params=p, headers=_headers(), timeout=timeout)
            if r.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {r.status_code}", response=r)
            r.raise_for_status()
            return r.json()
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as e:
            respuesta = getattr(e, "response", None)
            # 4xx distintos de 429 no se reintentan: son errores nuestros
            if respuesta is not None and respuesta.status_code < 500 \
                    and respuesta.status_code != 429:
                raise
            ultimo_error = e
            if intento < intentos - 1:
                time.sleep(2 ** intento)  # 1, 2, 4, 8 segundos
    raise ultimo_error  # type: ignore[misc]


def soda_get_all(dataset_id: str, where: str, select: str | None = None,
                 page: int = 10000, max_rows: int = 200000) -> list[dict]:
    """Descarga paginada estable (orden por :id)."""
    rows: list[dict] = []
    offset = 0
    while offset < max_rows:
        params = {"$where": where, "$order": ":id", "$limit": page, "$offset": offset}
        if select:
            params["$select"] = select
        lote = soda_get(dataset_id, params=params)
        rows.extend(lote)
        if len(lote) < page:
            break
        offset += page
    return rows


def filtro_departamentos() -> str:
    """Clausula SoQL: departamento in('Chocó','Risaralda',...)."""
    valores = ",".join(f"'{d}'" for d in config.DEPARTAMENTOS_EMERGENCIA)
    return f"departamento in({valores})"
