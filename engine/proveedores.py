"""Trazabilidad de un proveedor (perfil por NIT).

Estrategia para que responda rapido aunque datos.gov.co este intermitente:
- UNA sola consulta SODA trae todos los contratos del NIT; los agregados
  (por año, top entidades, desde el sismo) se calculan en Python.
- Reintentos cortos (el proxy del front corta a los 30s).
- El perfil se guarda en la tabla proveedores_perfil: consultas repetidas
  responden desde el cache sin tocar datos.gov.co.

SECOP II cubre procesos electronicos (~2018 en adelante); el historico viejo
esta en SECOP I, que hoy no expone API publica estable.
"""
import json
from collections import defaultdict
from datetime import datetime, timezone

from . import config, db, soda

CACHE_HORAS = 24
CACHE_VERSION = 2  # subirlo invalida perfiles cacheados con el shape viejo
CAMPOS_NIT = ("id_contrato,referencia_del_contrato,proveedor_adjudicado,fecha_de_firma,"
              "fecha_de_inicio_del_contrato,fecha_de_fin_del_contrato,estado_contrato,"
              "tipo_de_contrato,modalidad_de_contratacion,valor_del_contrato,"
              "nombre_entidad,nit_entidad,departamento,ciudad,descripcion_del_proceso,urlproceso")


def _contratos_del_nit(nit: str) -> list[dict]:
    """Todos los contratos del NIT en una sola consulta (exacto; si no, con DV)."""
    for filtro in (f"documento_proveedor = '{nit}'", f"documento_proveedor like '{nit}%'"):
        filas = soda.soda_get(
            config.DATASET_CONTRATOS,
            params={"$where": filtro, "$select": CAMPOS_NIT, "$limit": 3000},
            timeout=12, intentos=2,
        )
        if filas:
            return filas
    return []


def _armar_perfil(nit: str, filas: list[dict]) -> dict:
    def valor(f):
        try:
            return float(f.get("valor_del_contrato") or 0)
        except (TypeError, ValueError):
            return 0.0

    fechas = sorted(f["fecha_de_firma"] for f in filas if f.get("fecha_de_firma"))
    nombres: dict[str, int] = defaultdict(int)
    por_anio: dict[str, dict] = defaultdict(lambda: {"n": 0, "total": 0.0})
    entidades: dict[tuple, dict] = defaultdict(lambda: {"n": 0, "total": 0.0})
    sismo_n, sismo_total = 0, 0.0

    for f in filas:
        v = valor(f)
        if f.get("proveedor_adjudicado"):
            nombres[f["proveedor_adjudicado"]] += 1
        if f.get("fecha_de_firma"):
            anio = f["fecha_de_firma"][:4]
            por_anio[anio]["n"] += 1
            por_anio[anio]["total"] += v
            if f["fecha_de_firma"] >= config.FECHA_SISMO:
                sismo_n += 1
                sismo_total += v
        clave = (f.get("nombre_entidad"), f.get("departamento"))
        entidades[clave]["n"] += 1
        entidades[clave]["total"] += v

    top_entidades = sorted(
        ({"nombre_entidad": k[0], "departamento": k[1], "n": str(v["n"]), "total": str(v["total"])}
         for k, v in entidades.items()),
        key=lambda x: -float(x["total"]),
    )[:15]
    for f in filas:  # urlproceso llega como {"url": ...}
        if isinstance(f.get("urlproceso"), dict):
            f["urlproceso"] = f["urlproceso"].get("url")
    recientes = sorted(filas, key=lambda f: f.get("fecha_de_firma") or "", reverse=True)[:10]
    cuantiosos = sorted(filas, key=valor, reverse=True)[:20]

    return {
        "version": CACHE_VERSION,
        "nit": nit,
        "razones_sociales": [n for n, _ in sorted(nombres.items(), key=lambda x: -x[1])[:3]],
        "totales": {
            "contratos": len(filas),
            "valor_total": sum(valor(f) for f in filas),
            "primer_contrato": fechas[0] if fechas else None,
            "ultimo_contrato": fechas[-1] if fechas else None,
        },
        "por_anio": [{"anio": a, "n": str(d["n"]), "total": str(d["total"])}
                     for a, d in sorted(por_anio.items())],
        "top_entidades": top_entidades,
        "desde_sismo": {"n": str(sismo_n), "total": str(sismo_total)},
        "contratos_recientes": recientes,
        "contratos_top": cuantiosos,
        "registro_proveedor": [],
        "nota": (
            "Fuente: SECOP II (datos.gov.co). Cubre procesos electronicos (~2018 en "
            "adelante); contratos anteriores pueden estar en SECOP I. LupIA no acusa: "
            "estos son datos oficiales para que cualquiera verifique."
        ),
    }


def _cache_leer(nit: str) -> dict | None:
    with db.get_conn() as conn:
        fila = conn.execute(
            "SELECT datos_json, actualizado_en FROM proveedores_perfil WHERE nit = ?", (nit,)
        ).fetchone()
    if not fila:
        return None
    edad_h = (
        datetime.now(timezone.utc)
        - datetime.fromisoformat(fila["actualizado_en"])
    ).total_seconds() / 3600
    if edad_h >= CACHE_HORAS:
        return None
    perfil = json.loads(fila["datos_json"])
    return perfil if perfil.get("version") == CACHE_VERSION else None


def _cache_guardar(nit: str, perfil: dict) -> None:
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO proveedores_perfil (nit, datos_json, actualizado_en) VALUES (?,?,?) "
            "ON CONFLICT(nit) DO UPDATE SET datos_json=excluded.datos_json, "
            "actualizado_en=excluded.actualizado_en",
            (nit, json.dumps(perfil, ensure_ascii=False),
             datetime.now(timezone.utc).isoformat()),
        )


def trazabilidad(nit: str) -> dict | None:
    """Perfil completo del NIT. None si no aparece en SECOP II.

    Lanza requests.RequestException si datos.gov.co no responde (sin cache previo).
    """
    nit = "".join(c for c in nit if c.isdigit())
    if not nit:
        return None

    cacheado = _cache_leer(nit)
    if cacheado is not None:
        return cacheado

    filas = _contratos_del_nit(nit)
    if not filas:
        return None
    perfil = _armar_perfil(nit, filas)

    # Registro del proveedor: dato bonito pero opcional — un solo intento corto
    try:
        perfil["registro_proveedor"] = soda.soda_get(
            config.DATASET_PROVEEDORES,
            params={"$where": f"nit like '{nit}%'", "$limit": 3},
            timeout=8, intentos=1,
        )
    except Exception:  # noqa: BLE001 - dataset intermitente; el perfil sirve sin el
        pass

    _cache_guardar(nit, perfil)
    return perfil
