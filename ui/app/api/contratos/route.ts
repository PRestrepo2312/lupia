import { NextResponse } from "next/server";
import { CONTRATOS } from "@/lib/data";
import { Contrato, Capa } from "@/lib/types";

export const dynamic = "force-dynamic";

// Fila cruda que devuelve GET /alertas del backend (una por señal)
interface AlertaApi {
  id: number; id_contrato: string; senal: string; score: number; detalle: string;
  nombre_entidad: string; departamento: string; ciudad: string | null;
  valor_del_contrato: number | null; proveedor_adjudicado: string | null;
  descripcion_del_proceso: string | null; urlproceso: string | null;
  fecha_de_firma: string | null; modalidad_de_contratacion: string | null;
  documento_proveedor: string | null; tipo_de_contrato: string | null;
}

const SENAL_LABEL: Record<string, string> = {
  debutante: "Contratista debutante",
  sobrecosto: "Sobrecosto vs. histórico",
  concentracion: "Concentración de adjudicaciones",
  pertinencia: "Objeto sin relación con la emergencia",
};

// Nombres del backend (SECOP) -> nombres de la UI
const DEPT_ALIAS: Record<string, string> = {
  "Distrito Capital de Bogotá": "Bogotá D.C.",
  "San Andrés, Providencia y Santa Catalina": "San Andrés y Providencia",
  "No Definido": "Sin territorio publicado",
};

// Centroides aproximados por departamento (para el mapa)
const COORDS: Record<string, [number, number]> = {
  "Amazonas": [-1.44, -71.57], "Antioquia": [6.55, -75.6], "Arauca": [6.55, -71.0],
  "Atlántico": [10.68, -74.96], "Bogotá D.C.": [4.65, -74.1], "Bolívar": [8.8, -74.4],
  "Boyacá": [5.55, -73.36], "Caldas": [5.28, -75.25], "Caquetá": [0.87, -73.84],
  "Casanare": [5.4, -71.6], "Cauca": [2.44, -76.82], "Cesar": [9.33, -73.65],
  "Chocó": [5.25, -76.83], "Córdoba": [8.36, -75.79], "Cundinamarca": [5.03, -74.03],
  "Guainía": [2.72, -68.82], "Guaviare": [2.04, -72.33], "Huila": [2.57, -75.58],
  "La Guajira": [11.47, -72.43], "Magdalena": [10.24, -74.26], "Meta": [3.34, -73.0],
  "Nariño": [1.29, -77.36], "Norte de Santander": [7.95, -72.9], "Putumayo": [0.44, -76.61],
  "Quindío": [4.46, -75.68], "Risaralda": [5.24, -75.99], "San Andrés y Providencia": [12.55, -81.72],
  "Santander": [6.69, -73.28], "Sucre": [9.06, -75.11], "Tolima": [4.03, -75.26],
  "Valle del Cauca": [3.87, -76.52], "Vaupés": [0.85, -70.81], "Vichada": [4.71, -69.41],
};

// Jitter determinista para que los puntos del mismo departamento no se apilen
function jitter(id: string): [number, number] {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [((h % 100) / 100 - 0.5) * 0.7, (((h >> 7) % 100) / 100 - 0.5) * 0.7];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10) : `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export async function GET(req: Request) {
  const errores: string[] = [];
  const debug = new URL(req.url).searchParams.has("debug");
  // Dos caminos al backend: URL directa (env inlineada en build) y el propio rewrite
  const bases = [
    process.env.LUPIA_API_URL,
    `${new URL(req.url).origin}/lupia-api`,
  ].filter(Boolean) as string[];

  let alertas: AlertaApi[] | null = null;
  for (const b of bases) {
    try {
      const r = await fetch(`${b}/alertas?limite=300`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const datos = (await r.json()) as AlertaApi[];
      if (!datos.length) throw new Error("0 alertas");
      alertas = datos;
      break;
    } catch (e) {
      errores.push(`${b} -> ${String(e)}`);
    }
  }
  if (!alertas) {
    if (debug) return NextResponse.json({ errores, env: process.env.LUPIA_API_URL ?? null });
    return NextResponse.json(CONTRATOS);
  }

  try {
    const porContrato = new Map<string, AlertaApi[]>();
    for (const a of alertas) {
      const lote = porContrato.get(a.id_contrato) ?? [];
      lote.push(a);
      porContrato.set(a.id_contrato, lote);
    }

    const contratos: Contrato[] = [];
    for (const [idContrato, lote] of porContrato) {
      const base = lote[0];
      const dept = DEPT_ALIAS[base.departamento] ?? base.departamento;
      const [clat, clon] = COORDS[dept] ?? [4.6, -74.1];
      const [jlat, jlon] = jitter(idContrato);
      const objeto = (base.descripcion_del_proceso || "Objeto no publicado").replace(/\s+/g, " ").trim();
      const score = Math.max(...lote.map((a) => a.score));
      const fecha = fmtFecha(base.fecha_de_firma);
      const modalidad = base.modalidad_de_contratacion ?? "";
      const nit = base.documento_proveedor ?? "";

      contratos.push({
        id: idContrato,
        idContrato,
        objeto: objeto.length > 220 ? objeto.slice(0, 217) + "…" : objeto,
        entidad: base.nombre_entidad,
        proveedor: base.proveedor_adjudicado ?? undefined,
        nit: nit || undefined,
        dept,
        ciudad: base.ciudad ?? "",
        lat: clat + jlat,
        lon: clon + jlon,
        valor: Math.round((base.valor_del_contrato ?? 0) / 1e6),
        score,
        cat: base.tipo_de_contrato || "Otro",
        evento: "Sismo 7,4 · 10 ago 2026",
        fecha,
        modalidad,
        senales: lote.map((a) => SENAL_LABEL[a.senal] ?? a.senal),
        iaTexto: lote.map((a) => a.detalle).join(" "),
        capas: lote.map((a): Capa => ({
          capa: "SEÑAL VERIFICABLE",
          titulo: SENAL_LABEL[a.senal] ?? a.senal,
          metrica: `${a.score}/100`,
          pct: a.score,
          detalle: a.detalle,
        })),
        evidencia: [
          { fuente: "FUENTE", dato: "SECOP II · datos.gov.co · dataset jbjy-vk9h (contratos electrónicos)" },
          { fuente: "MÉTODO", dato: "Señales calculadas por el motor de LupIA sobre datos oficiales; verifica el contrato original en SECOP." },
        ],
        url: base.urlproceso ?? undefined,
      });
    }
    return NextResponse.json(contratos.sort((a, b) => b.score - a.score || b.valor - a.valor));
  } catch (e) {
    // Error mapeando (no de conexion): visible con ?debug
    if (debug) return NextResponse.json({ errores: [...errores, `mapeo -> ${String(e)}`] });
    return NextResponse.json(CONTRATOS);
  }
}
