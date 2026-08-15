# Seed de datos (modo demo)

Muestra real de contratos SECOP II para que el repo corra **sin token y sin API keys**:

```bash
MODO_DEMO=1 docker compose up
```

Se genera con `python scripts/generar_seed.py` después de una ingesta real.
Fuente: datos.gov.co (dataset `jbjy-vk9h`, SECOP II — Contratos Electrónicos).
