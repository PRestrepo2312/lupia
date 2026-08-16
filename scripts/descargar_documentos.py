"""Descarga (y opcionalmente exporta el texto de) los documentos de un proceso SECOP II.

Usa el mismo motor que la app (engine/documentos.py): HTTP puro, sin navegador ni captcha.

Uso:
    python scripts/descargar_documentos.py CO1.NTC.1303415
    python scripts/descargar_documentos.py "https://community.secop.gov.co/...noticeUID=CO1.NTC.1303415..."
    python scripts/descargar_documentos.py CO1.NTC.1303415 --out ./expediente --texto

--texto genera además un mapa .txt con el texto extraído de cada documento (para revisarlo aparte).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine import documentos  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Descarga los documentos de un proceso SECOP II.")
    ap.add_argument("proceso", help="noticeUID (CO1.NTC.xxxx) o la URL del proceso")
    ap.add_argument("--out", default=None, help="carpeta de salida (por defecto ./secop_downloads/<uid>)")
    ap.add_argument("--texto", action="store_true", help="también extrae el texto de cada documento a un .txt")
    args = ap.parse_args()

    uid = documentos.notice_uid_desde_url(args.proceso)
    if not uid:
        print("ERROR: no pude identificar el noticeUID.")
        sys.exit(1)

    destino = Path(args.out) if args.out else Path("secop_downloads") / uid
    destino.mkdir(parents=True, exist_ok=True)
    sesion = documentos._session()

    print(f"Proceso: {uid}")
    docs = documentos.listar(uid, sesion)
    print(f"{len(docs)} documento(s). Descargando en {destino.resolve()}\n")

    mapa = []
    for d in docs:
        nombre, tipo, contenido = documentos.descargar(d["doc_id"], sesion)
        ruta = destino / nombre
        if ruta.exists():
            ruta = destino / f"{d['doc_id']}_{nombre}"
        ruta.write_bytes(contenido)
        print(f"  [OK] {ruta.name} ({len(contenido):,} bytes)")
        if args.texto:
            texto = documentos.extraer_texto(nombre, contenido)
            mapa.append(f"===== {nombre} ({tipo}) =====\n{texto}\n")

    if args.texto:
        (destino / "_mapa_texto.txt").write_text("\n".join(mapa), encoding="utf-8")
        print(f"\nTexto extraído -> {(destino / '_mapa_texto.txt').resolve()}")
    print("\nListo.")


if __name__ == "__main__":
    main()
