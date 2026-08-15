# 🔍 LupIA

**La lupa ciudadana sobre la plata de la reconstrucción.**

> 📹 Video (60s): _[pendiente — Persona 3]_ · 🌐 Demo en vivo: _[pendiente — URL EC2]_ ·
> ▶️ Corre en 1 comando: `docker compose up`

## El problema

El 10 de agosto de 2026 un sismo M7.4 (epicentro San José del Palmar, Chocó) activó el
desastre nacional y la urgencia manifiesta: la mayor ola de contratación directa —sin
licitación— en 27 años. **A 5 días del sismo ya hay 1.736 contratos firmados por más de
$72.000 millones COP en Chocó, Risaralda, Quindío, Caldas y Valle del Cauca**
(fuente: SECOP II, datos.gov.co, consulta 2026-08-15). Nadie los lee en tiempo real.

## La solución

LupIA **lee** con IA cada contrato de la reconstrucción en SECOP II, **detecta** señales de
riesgo, las **explica** en lenguaje ciudadano, **avisa** por correo cuando aparece algo
nuevo y entrega el **documento para actuar** (derecho de petición / denuncia en PDF).

_[3 pantallazos: feed · detalle con IA · correo — pendiente]_

## Cómo usa IA (el núcleo)

1. **Entender** — Claude clasifica la pertinencia del objeto con la emergencia (score
   0–100 + razón) y extrae del texto libre qué se compra y cuánto → precio unitario.
2. **Razonar** — agente con tool `consultar_secop`: cruza historial del proveedor, precios
   históricos por UNSPSC y concentración, y arma el score con evidencia.
3. **Explicar y actuar** — explicación en cristiano, alerta por correo (Brevo), PDF listo
   para radicar.

Las reglas duras son guardarraíles verificables; la IA hace lo que las reglas no pueden:
leer texto libre. Diagramas en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Señales que detecta

| Señal | Cómo |
|---|---|
| ★ Objeto sin relación con la emergencia | Claude clasifica la descripción (IA) |
| ★ Sobrecosto vs. histórico | Claude extrae cantidades → precio unitario vs. p90 UNSPSC (IA + datos) |
| Contratista debutante | Primera aparición del NIT en SECOP + contrato alto (regla) |
| Concentración anómala | Mismo NIT ganando con varias entidades desde el sismo (regla) |

## Cómo correrlo

```bash
# Modo demo (sin llaves, con datos reales de muestra):
docker compose up
# UI: http://localhost:3000 · API: http://localhost:8010/docs

# Modo completo:
cp .env.example .env   # llenar SODA_APP_TOKEN, BREVO_API_KEY y credenciales de IA
python scripts/validar_apis.py          # valida todas las conexiones
MODO_DEMO=0 docker compose up
curl -X POST localhost:8010/ingesta/terremoto   # descarga y calcula señales

# Desarrollo local sin Docker:
uvicorn api.main:app --reload --port 8010     # backend
cd ui && npm install && npm run dev           # front en http://localhost:3000
```

Estructura: `api/` (FastAPI + auth JWT) · `engine/` (ingesta, señales, correo, IA, dual
SQLite/Postgres) · `ui/` (Next.js 14: monitor, mapa, empresa, chat, login) · `prompts/`
· `data/seed/` · `scripts/` · `docs/`.

## Sostenibilidad (freemium)

El ciudadano **nunca** paga: monitor, chat con cupo, alertas y PDF gratis; las alertas
vuelven a ser dato abierto y el motor es open source. Paga quien gana contratos con la
información (Pro/Empresa: matching por NIT, precios históricos, radar) y quien vigila a
escala (institucional / cooperación). Costos casi cero: datos gratis, LLM centavos, correos
gratis.

## Lenguaje responsable

**LupIA no acusa.** Señala anomalías estadísticas que ameritan revisión, siempre con el
porqué y el link al contrato original en SECOP para que cualquiera verifique.

## Equipo

_[nombres]_ — hecho con Cursor + Claude durante la Hackathon CTW 2026.
