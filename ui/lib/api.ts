import { CONTRATOS } from "./data";
import { Contrato } from "./types";

/**
 * Capa de acceso al backend (FastAPI via el rewrite /lupia-api).
 * getContratos() usa /api/contratos (mapper server-side con fallback al mock).
 */

export async function getContratos(): Promise<Contrato[]> {
  try {
    const r = await fetch("/api/contratos", { cache: "no-store" });
    if (!r.ok) throw new Error("bad status");
    const data = (await r.json()) as Contrato[];
    return data.length ? data : CONTRATOS;
  } catch {
    return CONTRATOS;
  }
}

// ---------- sesion (token en localStorage) ----------

export interface Usuario { id: number; correo: string; nombre: string | null }

export const guardarSesion = (token: string, usuario: Usuario) => {
  localStorage.setItem("lupia_token", token);
  localStorage.setItem("lupia_usuario", JSON.stringify(usuario));
};
export const limpiarSesion = () => {
  localStorage.removeItem("lupia_token");
  localStorage.removeItem("lupia_usuario");
};
export const sesionGuardada = (): { token: string; usuario: Usuario } | null => {
  try {
    const token = localStorage.getItem("lupia_token");
    const usuario = localStorage.getItem("lupia_usuario");
    return token && usuario ? { token, usuario: JSON.parse(usuario) } : null;
  } catch {
    return null;
  }
};

// ---------- llamadas al backend ----------

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) { super(detail); this.status = status; }
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("lupia_token") : null;
  const r = await fetch(`/lupia-api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, cuerpo?.detail || `Error ${r.status}`);
  return cuerpo as T;
}

export const auth = {
  registro: (correo: string, clave: string, nombre?: string) =>
    api("/auth/registro", { method: "POST", body: JSON.stringify({ correo, clave, nombre }) }),
  ingreso: (correo: string, clave: string) =>
    api("/auth/ingreso", { method: "POST", body: JSON.stringify({ correo, clave }) }),
  solicitarCodigo: (correo: string) =>
    api("/auth/codigo/solicitar", { method: "POST", body: JSON.stringify({ correo }) }),
  verificarCodigo: (correo: string, codigo: string) =>
    api("/auth/codigo/verificar", { method: "POST", body: JSON.stringify({ correo, codigo }) }),
  restablecer: (correo: string) =>
    api("/auth/restablecer/solicitar", { method: "POST", body: JSON.stringify({ correo }) }),
  confirmarRestablecer: (correo: string, codigo: string, nueva_clave: string) =>
    api("/auth/restablecer/confirmar", { method: "POST", body: JSON.stringify({ correo, codigo, nueva_clave }) }),
  google: (credential: string) =>
    api("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
};

export interface Suscripcion { id: number; departamento: string | null; municipio: string | null }
export interface PerfilEmpresa { tiene_empresa: boolean; nit: string | null; intereses: string[] }
export interface PerfilPersona {
  correo?: string; nombre: string | null; telefono: string | null;
  ciudad: string | null; profesion: string | null; sobre_mi: string | null;
}
export interface DocumentoSecop {
  doc_id: string; nombre: string; tipo: string; tam: number;
  relevancia?: "alta" | "media" | "baja"; categoria?: string;
}
export interface AnalisisDocs {
  resumen: string; coherencia_objeto: string; analisis_precios: string;
  inconsistencias: string; nivel_alerta: string; banderas: string[];
  documentos_analizados?: string[];
}
export interface Convocatoria {
  afinidad: number; id_del_proceso: string; referencia: string | null;
  entidad: string; departamento: string; ciudad: string | null;
  objeto: string; precio_base: number; modalidad: string | null;
  tipo_de_contrato: string | null; publicada: string; duracion: string;
  url: string | null; razon: string;
}

export const lupia = {
  salud: () => api<{ ok: boolean; contratos: number; alertas: number; base: string }>("/salud"),
  resumen: (soloEmergencia = false) =>
    api<{ departamento: string; contratos: number; total: number; alertas: number }[]>(
      `/resumen${soloEmergencia ? "?solo_emergencia=1" : ""}`),
  proveedor: (nit: string) => api(`/proveedores/${encodeURIComponent(nit)}`),
  detalle: (id: string) => api<any>(`/contratos/${encodeURIComponent(id)}`),
  suscribir: (correo: string, departamento?: string | null) =>
    api("/suscripciones", { method: "POST", body: JSON.stringify({ correo, departamento }) }),
  misSuscripciones: () => api<Suscripcion[]>("/suscripciones/mias"),
  borrarSuscripcion: (id: number) => api(`/suscripciones/${id}`, { method: "DELETE" }),
  guardarPerfilEmpresa: (p: PerfilEmpresa) =>
    api("/empresa/perfil", { method: "POST", body: JSON.stringify(p) }),
  miPerfilEmpresa: () => api<PerfilEmpresa>("/empresa/perfil"),
  miPerfil: () => api<PerfilPersona>("/perfil"),
  guardarPerfil: (p: PerfilPersona) =>
    api("/perfil", { method: "POST", body: JSON.stringify(p) }),
  convocatorias: () =>
    api<{ nit: string | null; con_historial: boolean; convocatorias: Convocatoria[] }>("/empresa/convocatorias"),
  enviarConvocatorias: () =>
    api<{ ok: boolean; enviadas: number }>("/empresa/convocatorias/enviar", { method: "POST" }),
  chat: (pregunta: string) =>
    api<{ respuesta: string }>("/ia/chat", { method: "POST", body: JSON.stringify({ pregunta }) }),
  documentos: (id: string) =>
    api<{ notice_uid: string | null; documentos: DocumentoSecop[]; recomendados: string[]; desde_cache: boolean }>(
      `/contratos/${encodeURIComponent(id)}/documentos`),
  analizarDocumentos: (id: string, docIds?: string[]) =>
    api<{ analisis: AnalisisDocs; desde_cache: boolean }>(
      `/contratos/${encodeURIComponent(id)}/documentos/analizar`,
      { method: "POST", body: JSON.stringify(docIds ? { doc_ids: docIds } : {}) }),
  // rutas directas para <a href> / <iframe> (binario vía el proxy, sin token)
  urlDescargarDoc: (id: string, docId: string) =>
    `/lupia-api/contratos/${encodeURIComponent(id)}/documentos/${encodeURIComponent(docId)}/descargar`,
  urlVerDoc: (id: string, docId: string) =>
    `/lupia-api/contratos/${encodeURIComponent(id)}/documentos/${encodeURIComponent(docId)}/ver`,
  urlExportarDocs: (id: string) =>
    `/lupia-api/contratos/${encodeURIComponent(id)}/documentos/exportar`,
};
