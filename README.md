# LupIA

**Monitor ciudadano de la contratación pública con inteligencia artificial.**

LupIA lee la contratación pública de Colombia en SECOP II, contrato por contrato, y señala
lo que amerita revisión —con el porqué y el enlace al documento oficial— para que cualquier
ciudadano, periodista o empresa entienda en qué se está gastando la plata pública.

**Demo en vivo:** https://lupia.click · **API:** https://api.lupia.click/docs

---

## El problema

El 10 de agosto de 2026, un sismo de magnitud 7.4 activó el desastre nacional y la urgencia
manifiesta: una ola de contratación directa, sin licitación, para la reconstrucción. Se firman
miles de contratos en semanas y nadie los lee en tiempo real. La información es pública y
oficial, pero está dispersa y es ilegible para el ciudadano de a pie.

## La solución

LupIA convierte el dato abierto en vigilancia útil:

- **Lee** cada contrato de SECOP II y le calcula un riesgo de 0 a 100.
- **Señala** patrones que ameritan revisión (contratista nuevo, concentración de
  adjudicaciones) siempre con la evidencia y el enlace a la fuente.
- **Explica** en lenguaje claro y responde preguntas en un chat con IA sobre los datos reales.
- **Profundiza**: trae los documentos del expediente desde SECOP y los analiza con IA
  (coherencia objeto/valor, precios, inconsistencias).
- **Avisa** por correo cuando aparece una señal nueva en los territorios que sigues.
- **Modo Empresa**: con tu NIT arma tu perfil real en SECOP y te muestra las convocatorias
  abiertas que calzan con tu historial.

## Arquitectura

Desplegada en AWS: front en Amplify (Next.js), API en contenedor sobre ECS Fargate detrás de
un balanceador con WAF, base de datos PostgreSQL en RDS (privada), IA en Amazon Bedrock y
correos por Brevo. CI/CD automático desde GitHub.

![Arquitectura AWS de LupIA](docs/Arquitectura%20AWS%20LupIA.jpeg)

Detalle e inventario en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) · desplegado en AWS Amplify |
| Backend | FastAPI (Python) · JWT · contenedor en ECS Fargate |
| Base de datos | PostgreSQL en RDS · motor dual SQLite/PostgreSQL |
| IA | Amazon Bedrock (Amazon Nova) |
| Datos | SECOP II vía la API SODA de datos.gov.co |
| Correo | Brevo (API transaccional) |
| Infra | ALB + WAF · Route 53 · ACM · ECR · CI/CD con GitHub Actions |

## Cómo correrlo

Modo demo: corre con datos de muestra, sin necesidad de llaves.

```bash
docker compose up
# Front:  http://localhost:3000
# API:    http://localhost:8010/docs
```

Modo completo (datos en vivo de SECOP II, correos e IA):

```bash
cp .env.example .env          # completar SODA_APP_TOKEN, BREVO_API_KEY, credenciales de IA
python scripts/validar_apis.py   # valida las conexiones externas
docker compose up
```

Desarrollo sin Docker:

```bash
uvicorn api.main:app --reload --port 8010        # backend
cd ui && npm install && npm run dev              # frontend en http://localhost:3000
```

## Estructura del proyecto

```
api/        API FastAPI (endpoints, autenticación, documentación)
engine/     Motor: ingesta, señales, proveedores, convocatorias, IA, correo, BD dual
prompts/    Prompts de la IA
ui/         Aplicación Next.js (monitor, mapa, empresa, alertas, chat, login)
scripts/    Utilidades (validación de APIs, ingesta, generación de datos de demo, despliegue)
data/seed/  Datos de muestra para el modo demo
docs/       Arquitectura y documentación
```

## Lenguaje responsable

LupIA no acusa a nadie. Señala contratos cuyas características ameritan revisión, siempre con el
porqué y el enlace al documento oficial en SECOP II, para que cualquiera pueda verificarlo en la
fuente. La interpretación es del lector.

## Equipo

**SMR Devs** — Hackathon CTW 2026, track de Tecnología para la Transparencia.
