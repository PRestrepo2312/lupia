"""Ingesta completa de una sola vez (util en local y en la EC2):

    python scripts/ingesta_completa.py [--covid]

Descarga contratos del terremoto, arma el historial de proveedores,
calcula las senales y deja el cache SQLite listo para la API.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import db, ingesta, senales  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main() -> None:
    t0 = time.time()
    db.init_db()

    n = ingesta.descargar_terremoto()
    print(f"[1/3] Contratos del terremoto guardados: {n} ({time.time()-t0:.0f}s)")

    h = ingesta.actualizar_historial_proveedores()
    print(f"[2/3] Historial de proveedores actualizado: {h} NITs ({time.time()-t0:.0f}s)")

    s = senales.calcular_todas()
    print(f"[3/3] Senales calculadas: {s} ({time.time()-t0:.0f}s)")

    if "--covid" in sys.argv:
        c = ingesta.descargar_covid()
        print(f"[extra] Contratos COVID (calibracion): {c} ({time.time()-t0:.0f}s)")

    with db.get_conn() as conn:
        alertas = conn.execute(
            "SELECT senal, COUNT(*) AS n FROM alertas GROUP BY senal"
        ).fetchall()
    print("Alertas por senal:", {a["senal"]: a["n"] for a in alertas})


if __name__ == "__main__":
    main()
