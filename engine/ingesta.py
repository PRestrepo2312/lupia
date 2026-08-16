"""Ingesta desde datos.gov.co hacia el cache SQLite.

Dos capas:
- terremoto: contratos firmados desde el 10-ago en los 5 departamentos (monitor en vivo)
- covid: urgencia manifiesta mar-jun 2020 (calibracion del motor)
"""
import json

from . import config, db, soda


def cargar_seed() -> int:
    """Modo demo: carga data/seed/*.json al cache sin tocar internet ni llaves."""
    total = 0
    for archivo in sorted(config.SEED_DIR.glob("contratos_*.json")):
        origen = archivo.stem.replace("contratos_", "")
        filas = json.loads(archivo.read_text(encoding="utf-8"))
        total += db.guardar_contratos(filas, origen=origen)
    return total


def descargar_terremoto() -> int:
    """Contratos firmados desde el sismo. Ambito nacional por defecto;
    AMBITO_INGESTA=emergencia limita a los 5 departamentos."""
    if config.MODO_DEMO:
        return cargar_seed()
    where = f"fecha_de_firma >= '{config.FECHA_SISMO}'"
    if config.AMBITO_INGESTA == "emergencia":
        where += f" AND {soda.filtro_departamentos()}"
    filas = soda.soda_get_all(config.DATASET_CONTRATOS, where=where)
    return db.guardar_contratos(filas, origen="terremoto")


def descargar_covid() -> int:
    where = (
        f"fecha_de_firma between '{config.COVID_DESDE}' and '{config.COVID_HASTA}' "
        "AND upper(justificacion_modalidad_de) like '%URGENCIA%'"
    )
    filas = soda.soda_get_all(config.DATASET_CONTRATOS, where=where)
    return db.guardar_contratos(filas, origen="covid")


def actualizar_historial_proveedores(lote: int = 200) -> int:
    """Para cada NIT con contratos del terremoto, cuenta su historial ANTES del sismo.

    Un solo query SODA agrupado por cada lote de NITs (no uno por NIT).
    contratos_previos = 0  =>  candidato a senal 'debutante'.
    """
    with db.get_conn() as conn:
        nits = [
            r["documento_proveedor"]
            for r in conn.execute(
                "SELECT DISTINCT documento_proveedor FROM contratos "
                "WHERE origen='terremoto' AND documento_proveedor IS NOT NULL"
            )
        ]

    actualizados = 0
    with db.get_conn() as conn:
        for i in range(0, len(nits), lote):
            grupo = [n for n in nits[i:i + lote] if n and "'" not in n]
            if not grupo:
                continue
            valores = ",".join(f"'{n}'" for n in grupo)
            q = (
                "SELECT documento_proveedor, count(id_contrato) AS n, "
                "min(fecha_de_firma) AS primera "
                f"WHERE documento_proveedor in({valores}) "
                f"AND fecha_de_firma < '{config.FECHA_SISMO}' "
                "GROUP BY documento_proveedor"
            )
            historial = {
                r["documento_proveedor"]: r
                for r in soda.soda_get(config.DATASET_CONTRATOS, query=q)
            }
            for nit in grupo:
                r = historial.get(nit)
                conn.execute(
                    "INSERT INTO proveedores_historial "
                    "(documento_proveedor, contratos_previos, primera_fecha) VALUES (?,?,?) "
                    "ON CONFLICT(documento_proveedor) DO UPDATE SET "
                    "contratos_previos=excluded.contratos_previos, "
                    "primera_fecha=excluded.primera_fecha",
                    (nit, int(r["n"]) if r else 0, r["primera"] if r else None),
                )
                actualizados += 1
    return actualizados
