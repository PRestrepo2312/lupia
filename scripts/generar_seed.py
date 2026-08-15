"""Genera data/seed/ a partir del cache SQLite ya poblado.

El seed permite que el repo corra con `docker compose up` SIN token ni API keys
(rubrica "Demo funcional"). Correr despues de la ingesta real:

    python scripts/generar_seed.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import db, config  # noqa: E402

MUESTRA = 300  # contratos del terremoto con mayor valor + todos los que tienen alertas


def main() -> None:
    config.SEED_DIR.mkdir(parents=True, exist_ok=True)
    with db.get_conn() as conn:
        filas = conn.execute(
            """
            SELECT c.datos_json FROM contratos c
            WHERE c.origen='terremoto'
            ORDER BY (SELECT COUNT(*) FROM alertas a WHERE a.id_contrato = c.id_contrato) DESC,
                     c.valor_del_contrato DESC
            LIMIT ?
            """,
            (MUESTRA,),
        ).fetchall()
    contratos = [json.loads(f["datos_json"]) for f in filas]
    destino = config.SEED_DIR / "contratos_terremoto.json"
    destino.write_text(json.dumps(contratos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Seed generado: {destino} ({len(contratos)} contratos)")


if __name__ == "__main__":
    main()
