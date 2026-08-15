"""Capa de datos dual: PostgreSQL si hay DATABASE_URL, SQLite si no.

- Local / modo demo sin llaves: SQLite (cero administracion, sobrevive sin internet).
- Demo escalable en AWS: RDS PostgreSQL (DATABASE_URL=postgresql://...).

Las consultas se escriben con placeholders '?'; para Postgres se traducen a '%s'.
El SQL usado es el subconjunto comun a ambos motores (ON CONFLICT incluido).
"""
import json
import sqlite3

from . import config

IS_PG = config.DATABASE_URL.startswith("postgres")

_TABLA_CONTRATOS = """
CREATE TABLE IF NOT EXISTS contratos (
    id_contrato TEXT PRIMARY KEY,
    nombre_entidad TEXT,
    nit_entidad TEXT,
    departamento TEXT,
    ciudad TEXT,
    descripcion_del_proceso TEXT,
    objeto_del_contrato TEXT,
    tipo_de_contrato TEXT,
    modalidad_de_contratacion TEXT,
    justificacion_modalidad_de TEXT,
    valor_del_contrato DOUBLE PRECISION,
    fecha_de_firma TEXT,
    proveedor_adjudicado TEXT,
    documento_proveedor TEXT,
    codigo_de_categoria_principal TEXT,
    urlproceso TEXT,
    ultima_actualizacion TEXT,
    origen TEXT,
    datos_json TEXT
);
CREATE INDEX IF NOT EXISTS ix_contratos_depto ON contratos(departamento);
CREATE INDEX IF NOT EXISTS ix_contratos_prov ON contratos(documento_proveedor);
CREATE INDEX IF NOT EXISTS ix_contratos_origen ON contratos(origen);

CREATE TABLE IF NOT EXISTS proveedores_historial (
    documento_proveedor TEXT PRIMARY KEY,
    contratos_previos INTEGER,
    primera_fecha TEXT
);

CREATE TABLE IF NOT EXISTS precios_unspsc (
    codigo TEXT PRIMARY KEY,
    mediana DOUBLE PRECISION,
    p90 DOUBLE PRECISION,
    n INTEGER
);

CREATE TABLE IF NOT EXISTS proveedores_perfil (
    nit TEXT PRIMARY KEY,
    datos_json TEXT NOT NULL,
    actualizado_en TEXT NOT NULL
);
"""

SCHEMA_SQLITE = _TABLA_CONTRATOS + """
CREATE TABLE IF NOT EXISTS alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_contrato TEXT NOT NULL,
    senal TEXT NOT NULL,
    score INTEGER NOT NULL,
    detalle TEXT,
    creada_en TEXT DEFAULT (datetime('now')),
    enviada INTEGER DEFAULT 0,
    UNIQUE(id_contrato, senal)
);
CREATE TABLE IF NOT EXISTS suscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correo TEXT NOT NULL,
    departamento TEXT,
    municipio TEXT,
    creada_en TEXT DEFAULT (datetime('now')),
    UNIQUE(correo, departamento, municipio)
);
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correo TEXT NOT NULL UNIQUE,
    nombre TEXT,
    hash_clave TEXT,
    google_sub TEXT,
    creado_en TEXT DEFAULT (datetime('now')),
    ultimo_ingreso TEXT
);
CREATE TABLE IF NOT EXISTS codigos_otp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correo TEXT NOT NULL,
    codigo TEXT NOT NULL,
    proposito TEXT NOT NULL,
    expira_en TEXT NOT NULL,
    usado INTEGER DEFAULT 0,
    creado_en TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_otp_correo ON codigos_otp(correo, proposito);
"""

SCHEMA_PG = _TABLA_CONTRATOS + """
CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    id_contrato TEXT NOT NULL,
    senal TEXT NOT NULL,
    score INTEGER NOT NULL,
    detalle TEXT,
    creada_en TIMESTAMPTZ DEFAULT now(),
    enviada INTEGER DEFAULT 0,
    UNIQUE(id_contrato, senal)
);
CREATE TABLE IF NOT EXISTS suscripciones (
    id SERIAL PRIMARY KEY,
    correo TEXT NOT NULL,
    departamento TEXT,
    municipio TEXT,
    creada_en TIMESTAMPTZ DEFAULT now(),
    UNIQUE(correo, departamento, municipio)
);
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    correo TEXT NOT NULL UNIQUE,
    nombre TEXT,
    hash_clave TEXT,
    google_sub TEXT,
    creado_en TIMESTAMPTZ DEFAULT now(),
    ultimo_ingreso TEXT
);
CREATE TABLE IF NOT EXISTS codigos_otp (
    id SERIAL PRIMARY KEY,
    correo TEXT NOT NULL,
    codigo TEXT NOT NULL,
    proposito TEXT NOT NULL,
    expira_en TEXT NOT NULL,
    usado INTEGER DEFAULT 0,
    creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_otp_correo ON codigos_otp(correo, proposito);
"""

CAMPOS = [
    "id_contrato", "nombre_entidad", "nit_entidad", "departamento", "ciudad",
    "descripcion_del_proceso", "objeto_del_contrato", "tipo_de_contrato",
    "modalidad_de_contratacion", "justificacion_modalidad_de", "valor_del_contrato",
    "fecha_de_firma", "proveedor_adjudicado", "documento_proveedor",
    "codigo_de_categoria_principal", "urlproceso", "ultima_actualizacion",
]


class _PgConnection:
    """Adaptador con la misma interfaz que usamos de sqlite3: execute + with-commit."""

    def __init__(self) -> None:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        self._conn = psycopg2.connect(config.DATABASE_URL)
        self._factory = RealDictCursor

    def execute(self, sql: str, params=()):  # noqa: ANN001
        cur = self._conn.cursor(cursor_factory=self._factory)
        # psycopg2 usa %s como placeholder: escapar % literales (LIKE '...%')
        # ANTES de convertir los ? en %s
        cur.execute(sql.replace("%", "%%").replace("?", "%s"), list(params))
        return cur

    def executescript(self, script: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(script)

    def commit(self) -> None:
        self._conn.commit()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self._conn.commit()
        else:
            self._conn.rollback()
        self._conn.close()
        return False


def get_conn():
    if IS_PG:
        return _PgConnection()
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA_PG if IS_PG else SCHEMA_SQLITE)


def _valor(fila: dict, campo: str):
    v = fila.get(campo)
    if campo == "urlproceso" and isinstance(v, dict):  # Socrata devuelve {"url": ...}
        return v.get("url")
    if campo == "valor_del_contrato" and v is not None:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None
    return v


def guardar_contratos(filas: list[dict], origen: str) -> int:
    """Upsert de contratos crudos de SODA (delete+insert: identico en ambos motores)."""
    cols = CAMPOS + ["origen", "datos_json"]
    marcas = ",".join("?" for _ in cols)
    sql = f"INSERT INTO contratos ({','.join(cols)}) VALUES ({marcas})"
    n = 0
    with get_conn() as conn:
        for fila in filas:
            if not fila.get("id_contrato"):
                continue
            conn.execute("DELETE FROM contratos WHERE id_contrato = ?", (fila["id_contrato"],))
            valores = [_valor(fila, c) for c in CAMPOS]
            valores += [origen, json.dumps(fila, ensure_ascii=False)]
            conn.execute(sql, valores)
            n += 1
    return n
