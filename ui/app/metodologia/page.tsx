import { T } from "@/lib/theme";

const CAPAS = [
  { n: "1", titulo: "Entender", texto: "Claude lee el texto libre de cada contrato: clasifica de 0 a 100 qué tan relacionado está el objeto con el foco de gasto y extrae qué se compra y cuántas unidades, para calcular un precio unitario que el dato estructurado no trae.", tecnica: "clasificación + extracción estructurada" },
  { n: "2", titulo: "Razonar", texto: "Un agente con la herramienta consultar_secop cruza el histórico del proveedor, los precios de referencia por código UNSPSC y la concentración de adjudicaciones de la semana, y arma el score citando la evidencia.", tecnica: "agente + tool use sobre SECOP" },
  { n: "3", titulo: "Explicar y actuar", texto: "La misma señal se devuelve en lenguaje ciudadano, se envía por correo cuando aparece algo nuevo y se convierte en un derecho de petición listo para radicar.", tecnica: "generación + alertas + documento legal" },
];

const SENALES = [
  ["Objeto sin relación con el foco", "Claude clasifica la descripción del proceso frente al foco declarado y entrega score de pertinencia con la razón.", "IA"],
  ["Sobrecosto vs. histórico", "La IA extrae unidades del texto libre; el motor compara el precio unitario con la mediana y el p90 del mismo UNSPSC.", "IA + REGLA"],
  ["Contratista debutante", "Primera aparición del NIT en SECOP combinada con contrato de monto alto.", "REGLA"],
  ["Concentración anómala", "Mismo NIT adjudicado en varias entidades o departamentos en la misma semana.", "REGLA"],
  ["Fraccionamiento semántico", "Embeddings de descripciones para encontrar contratos gemelos de la misma entidad en fechas cercanas.", "IA"],
  ["Sin experiencia en el objeto", "El NIT nunca ha contratado el código UNSPSC que ahora ejecuta.", "REGLA"],
];

export default function Page() {
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 28px 80px" }}>
      <h1 style={{ fontSize: 30, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 700 }}>Metodología</h1>
      <p style={{ margin: "0 0 30px", fontSize: 14.5, color: T.muted, lineHeight: 1.55, maxWidth: 660 }}>LupIA monitorea la contratación pública por categoría y apunta el foco a lo que está pasando: hoy el sismo, mañana lo que traiga la agenda. Las reglas son guardarraíles verificables; la IA es el motor, porque hace lo que una regla no puede, que es leer.</p>

      <div className="metodo-capas" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: T.line, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 34 }}>
        {CAPAS.map((c) => (
          <div key={c.n} style={{ background: T.surface, padding: "24px 22px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ia, marginBottom: 12 }}>CAPA {c.n}</div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>{c.titulo}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.ink2 }}>{c.texto}</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0ece2" }}>{c.tecnica}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.06em", color: T.muted, marginBottom: 12 }}>SEÑALES QUE DETECTA</div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 34 }}>
        {SENALES.map(([nombre, como, tipo]) => (
          <div key={nombre} className="metodo-senal" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.6fr 120px", gap: 20, padding: "16px 22px", borderBottom: "1px solid #f0ece2", alignItems: "baseline" }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{nombre}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: T.ink2 }}>{como}</div>
            <div className="metodo-tipo" style={{ fontFamily: T.mono, fontSize: 10.5, color: tipo === "REGLA" ? T.muted : T.ia, textAlign: "right" }}>{tipo}</div>
          </div>
        ))}
      </div>

      <div className="metodo-cierre" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 12, padding: "22px 24px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Calibración</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.ink2 }}>El motor se calibró con la urgencia manifiesta del COVID-19 (marzo–junio 2020), donde los sobrecostos ya están documentados. Hoy apunta al sismo del 10 de agosto de 2026 con el mismo umbral.</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.alto}`, borderRadius: 12, padding: "22px 24px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: T.alto }}>Límites que declaramos</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.ink2 }}>Un score alto no implica irregularidad: puede haber justificación técnica que no está en el texto publicado. Las personas naturales de bajo monto se anonimizan. Ningún contratista se nombra junto a la palabra corrupción.</div>
        </div>
      </div>
    </main>
  );
}
