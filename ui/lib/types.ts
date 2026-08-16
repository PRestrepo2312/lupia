// Categoria = tipo de contrato real de SECOP (Obra, Suministros, Prestación de servicios, ...)
export type Categoria = string;

export interface Capa { capa: string; titulo: string; metrica: string; pct: number; detalle: string; }
export interface Evidencia { fuente: string; dato: string; }

export interface Contrato {
  id: string;
  idContrato: string;
  objeto: string;
  entidad: string;
  proveedor?: string;
  nit?: string;
  dept: string;
  ciudad: string;
  lat: number;
  lon: number;
  valor: number;          // millones COP
  score: number;          // 0-100 riesgo
  cat: Categoria;
  evento: string;         // foco/noticia que lo origina
  fecha: string;
  modalidad: string;
  senales?: string[];
  iaTexto?: string;
  capas?: Capa[];
  evidencia?: Evidencia[];
  url?: string;           // enlace real al proceso en SECOP II
}

export interface TrazaItem { fecha: string; evento: string; }
