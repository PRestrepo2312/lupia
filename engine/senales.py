"""Motor de senales de riesgo (reglas duras; Claude explica aparte).

Lenguaje responsable: son "senales que ameritan revision", nunca acusaciones.
"""
from . import config, db


def _upsert_alerta(conn, id_contrato: str, senal: str, score: int, detalle: str) -> None:
    conn.execute(
        "INSERT INTO alertas (id_contrato, senal, score, detalle) VALUES (?,?,?,?) "
        "ON CONFLICT(id_contrato, senal) DO UPDATE SET score=excluded.score, detalle=excluded.detalle",
        (id_contrato, senal, score, detalle),
    )


def senal_debutante(conn) -> int:
    """Senal 1: NIT sin historial en SECOP antes del sismo + contrato alto.

    Consorcios y uniones temporales se excluyen: se constituyen con NIT nuevo
    para cada proyecto, asi que "debutar" es inherente a la figura y marcarlos
    seria un falso positivo estructural (lenguaje responsable).
    """
    filas = conn.execute(
        """
        SELECT c.id_contrato, c.proveedor_adjudicado, c.documento_proveedor,
               c.valor_del_contrato, c.nombre_entidad
        FROM contratos c
        JOIN proveedores_historial h ON h.documento_proveedor = c.documento_proveedor
        WHERE c.origen='terremoto' AND h.contratos_previos = 0
          AND c.valor_del_contrato >= ?
          AND UPPER(c.proveedor_adjudicado) NOT LIKE 'CONSORCIO%'
          AND UPPER(c.proveedor_adjudicado) NOT LIKE 'UNION TEMPORAL%'
          AND UPPER(c.proveedor_adjudicado) NOT LIKE 'UNIÓN TEMPORAL%'
          AND UPPER(c.proveedor_adjudicado) NOT LIKE 'U.T.%'
        """,
        (config.UMBRAL_DEBUTANTE,),
    ).fetchall()
    for f in filas:
        detalle = (
            f"El proveedor {f['proveedor_adjudicado']} (NIT {f['documento_proveedor']}) "
            f"no registra contratos en SECOP II antes del sismo y recibe un contrato de "
            f"${f['valor_del_contrato']:,.0f} de {f['nombre_entidad']}."
        )
        _upsert_alerta(conn, f["id_contrato"], "debutante", 70, detalle)
    return len(filas)


def senal_sobrecosto(conn) -> int:
    """Senal 2: valor > p90 historico del mismo codigo UNSPSC.

    Requiere la tabla precios_unspsc precargada.
    Comparacion gruesa por contrato total; refinarla a valor unitario si hay tiempo.
    """
    tiene_precios = conn.execute("SELECT COUNT(*) AS n FROM precios_unspsc").fetchone()["n"]
    if not tiene_precios:
        return 0
    filas = conn.execute(
        """
        SELECT c.id_contrato, c.valor_del_contrato, c.codigo_de_categoria_principal,
               p.p90, p.mediana
        FROM contratos c
        JOIN precios_unspsc p ON p.codigo = c.codigo_de_categoria_principal
        WHERE c.origen='terremoto' AND c.valor_del_contrato > p.p90 AND p.n >= 10
        """
    ).fetchall()
    for f in filas:
        veces = f["valor_del_contrato"] / f["mediana"] if f["mediana"] else 0
        detalle = (
            f"El valor del contrato (${f['valor_del_contrato']:,.0f}) supera el percentil 90 "
            f"historico de su categoria UNSPSC {f['codigo_de_categoria_principal']} "
            f"(~{veces:.1f}x la mediana historica)."
        )
        _upsert_alerta(conn, f["id_contrato"], "sobrecosto", 80, detalle)
    return len(filas)


def senal_concentracion(conn, minimo_entidades: int = 3) -> int:
    """Senal 4: mismo NIT ganando con varias entidades desde el sismo."""
    filas = conn.execute(
        """
        SELECT documento_proveedor, proveedor_adjudicado,
               COUNT(DISTINCT nit_entidad) AS entidades,
               COUNT(*) AS contratos, SUM(valor_del_contrato) AS total
        FROM contratos
        WHERE origen='terremoto' AND documento_proveedor IS NOT NULL
        GROUP BY documento_proveedor, proveedor_adjudicado
        HAVING COUNT(DISTINCT nit_entidad) >= ?
        """,
        (minimo_entidades,),
    ).fetchall()
    n = 0
    for f in filas:
        ids = conn.execute(
            "SELECT id_contrato FROM contratos WHERE origen='terremoto' AND documento_proveedor=?",
            (f["documento_proveedor"],),
        ).fetchall()
        detalle = (
            f"{f['proveedor_adjudicado']} (NIT {f['documento_proveedor']}) ha ganado "
            f"{f['contratos']} contratos con {f['entidades']} entidades distintas desde el "
            f"sismo, por un total de ${f['total']:,.0f}."
        )
        for fila_id in ids:
            _upsert_alerta(conn, fila_id["id_contrato"], "concentracion", 60, detalle)
            n += 1
    return n


def calcular_todas() -> dict:
    with db.get_conn() as conn:
        return {
            "debutante": senal_debutante(conn),
            "sobrecosto": senal_sobrecosto(conn),
            "concentracion": senal_concentracion(conn),
        }
