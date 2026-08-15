# LupIA — monitor de contratación pública (Next.js)

Mockup funcional exportado a Next.js 14 (App Router, TypeScript). Toda la data es simulada:
el objetivo es que puedas enchufar tu backend sin tocar la UI.

## Correr

```bash
npm install
npm run dev     # http://localhost:3000
```

## Estructura

```
app/
  layout.tsx            fuentes + reset global
  page.tsx              Monitor (feed + detalle)
  mapa/page.tsx         Mapa nacional (d3 + Natural Earth)
  empresa/page.tsx      Modo Empresa (matching por NIT)
  metodologia/page.tsx  Cómo funciona el motor
  api/contratos/route.ts  << PUNTO DE CONEXIÓN AL BACKEND
components/
  Header, Monitor, ContractDetail, ChatLupa, LoginModal, AuthProvider, MapaClient
lib/
  types.ts   contrato, capa de razonamiento, evidencia
  data.ts    datos mock (26 contratos, 5 con razonamiento completo)
  api.ts     getContratos(): usa /api/contratos y cae al mock si falla
  theme.ts   colores y tipografías
```

## Conectar el backend

1. **Lectura de contratos**: en `app/api/contratos/route.ts` reemplaza el `return` del mock por
   tu consulta (SQLite/Postgres/FastAPI). El contrato de datos es `Contrato` en `lib/types.ts`.
2. **Razonamiento de la IA**: los campos `iaTexto`, `capas` y `evidencia` son lo que la UI muestra
   en el detalle. Devuélvelos ya calculados desde tu motor.
3. **Chat**: `components/ChatLupa.tsx` tiene `respuestaMock()`. Cámbialo por un `fetch('/api/chat')`
   contra tu agente (Claude + tool `consultar_secop`).
4. **Alertas y login**: `components/LoginModal.tsx` y `AuthProvider` son de mentira (código 481902
   entra siempre). Sustituye por tu auth real (magic link / OTP / SSO).
5. **Trazabilidad**: `lib/data.ts → TRAZA`. Reemplaza por el historial real del contrato.

## Notas de diseño

- Estilos inline con tokens en `lib/theme.ts` (sin Tailwind, fácil de migrar si lo prefieres).
- Nada de dependencias de UI: solo React, d3 y topojson-client.
- El mapa usa geometría de Natural Earth (world-atlas). Para polígonos por departamento,
  cambia la fuente en `MapaClient.tsx` por un GeoJSON de departamentos de Colombia.
- Lenguaje responsable: la UI nunca afirma corrupción, señala lo que amerita revisión.
