# Arquitectura

LupIA corre en producción sobre AWS, con una arquitectura de bajo costo pensada para
escalar. Verificada el 16 de agosto de 2026.

![Arquitectura AWS de LupIA](Arquitectura%20AWS%20LupIA.jpeg)

## Flujo

- El navegador resuelve **lupia.click** por **Route 53** y carga el front desde **AWS Amplify**
  (Next.js con CloudFront).
- Las llamadas de datos entran por **AWS WAF** y el **Application Load Balancer**, que enruta a
  una tarea **ECS Fargate** con la API (FastAPI) dentro de un **VPC**, en subredes públicas
  repartidas en tres zonas de disponibilidad.
- La tarea consulta **PostgreSQL en RDS** (privada, cifrada) y sale a los servicios externos:
  **Amazon Bedrock** (IA), **Brevo** (correo) y **datos.gov.co / SECOP II** (fuente de datos).
- **GitHub** despliega automáticamente: Actions construye la imagen, la publica en **ECR** y
  actualiza el servicio de **ECS**; un webhook reconstruye el front en Amplify.

## Componentes

| Servicio | Rol | Configuración |
|---|---|---|
| Route 53 + ACM | DNS y TLS | zona lupia.click + certificado del ALB |
| Amplify + CloudFront | Frontend | Next.js SSR, build por push |
| WAF | Seguridad de borde | reglas administradas + rate limit |
| ALB | Balanceador | HTTPS, 3 AZ, health check `/salud` |
| ECS Fargate | API | contenedor FastAPI, sin servidores que administrar |
| RDS PostgreSQL | Base de datos | privada, cifrada en reposo |
| Bedrock (Amazon Nova) | IA | pertinencia, chat y análisis de documentos |
| ECR | Registro de imágenes | imagen de la API |
| Brevo | Correo | alertas y códigos de acceso |

## Notas de diseño

- **Motor dual SQLite/PostgreSQL**: el mismo código corre en local con SQLite (modo demo) y en
  producción con PostgreSQL, sin cambios.
- **Costo contenido**: infraestructura completa (WAF + ALB + Fargate + RDS) por un costo mensual
  de orden de decenas de dólares, apta para los créditos de la cuenta.
- **Seguridad**: la base de datos no tiene acceso público y el grupo de seguridad de la tarea
  solo acepta tráfico del balanceador.
