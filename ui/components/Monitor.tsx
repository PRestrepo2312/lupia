"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Contrato } from "@/lib/types";
import { getContratos, lupia } from "@/lib/api";
import { CATEGORIAS, DEPARTAMENTOS, GLIFOS, EVENTOS } from "@/lib/data";
import { T, fmtM, riesgo, nivelLabel } from "@/lib/theme";
import { ContractDetail } from "./ContractDetail";

const MapaClient = dynamic(() => import("./MapaClient").then((m) => m.MapaClient), { ssr: false });

const POR_PAGINA = 10;

interface Salud { contratos: number; alertas: number }

export function Monitor() {
  const [data, setData] = useState<Contrato[]>([]);
  const [salud, setSalud] = useState<Salud | null>(null);
  const [valorTotal, setValorTotal] = useState<number | null>(null);   // millones COP
  const [deptosConSenales, setDeptosConSenales] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("Todas");
  const [dep, setDep] = useState<string>("Todos");
  const [evento, setEvento] = useState<string>("Todos los eventos");
  const [sel, setSel] = useState<string | null>(null);
  const [vista, setVista] = useState<"tabla" | "mapa">("tabla");
  const [pagina, setPagina] = useState(1);

  useEffect(() => { setPagina(1); }, [cat, dep, evento]);

  useEffect(() => {
    getContratos().then(setData);
    lupia.salud().then((s) => setSalud({ contratos: s.contratos, alertas: s.alertas })).catch(() => setSalud(null));
    lupia.resumen().then((r) => {
      setValorTotal(Math.round(r.reduce((a, f) => a + (f.total || 0), 0) / 1e6));
      setDeptosConSenales(r.filter((f) => f.alertas > 0).length);
    }).catch(() => {});
  }, []);

  const visibles = useMemo(() => data
    .filter((c) => (cat === "Todas" || c.cat === cat)
      && (dep === "Todos" || c.dept === dep)
      && (cat !== "Emergencias y desastres" || evento === "Todos los eventos" || c.evento === evento))
    .sort((a, b) => b.score - a.score), [data, cat, dep, evento]);

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginados = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const seleccionado = data.find((c) => c.id === sel);
  if (seleccionado) return <ContractDetail c={seleccionado} onBack={() => setSel(null)} />;

  // KPIs reales del motor (con fallback a lo visible cuando no hay backend)
  const total = valorTotal ?? data.reduce((a, c) => a + c.valor, 0);
  const kpis = [
    { label: "CONTRATOS LEÍDOS", value: (salud?.contratos ?? data.length).toLocaleString("es-CO"), sub: "desde el sismo · todo el país", color: T.ink },
    { label: "VALOR ANALIZADO", value: fmtM(total), sub: "SECOP II · datos.gov.co", color: T.ink },
    { label: "SEÑALES QUE AMERITAN REVISIÓN", value: String(salud?.alertas ?? data.length), sub: "verificables una a una", color: T.alto },
    { label: "DEPARTAMENTOS CON SEÑALES", value: String(deptosConSenales ?? new Set(data.map((c) => c.dept)).size), sub: "de 33 monitoreados", color: T.medio },
  ];

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", color: T.alto, marginBottom: 10 }}>MONITOR DE CONTRATACIÓN PÚBLICA · FOCO ACTIVO: SISMO 10 AGO 2026</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.025em", margin: "0 0 10px", fontWeight: 700 }}>La plata pública, leída contrato por contrato.</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: T.muted }}>LupIA lee SECOP II por categoría en los 33 departamentos. El foco se mueve con la agenda del país; hoy está en la reconstrucción del sismo.</p>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textAlign: "right", lineHeight: 1.7 }}>{salud ? "● Sincronizado con SECOP II" : "Vista de ejemplo · sin conexión"}<br />Fuente oficial: datos.gov.co</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: T.line, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 30 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: T.surface, padding: "20px 22px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.06em", color: T.muted, marginBottom: 10 }}>{k.label}</div>
            <div style={{ fontSize: 29, fontWeight: 700, letterSpacing: "-0.03em", color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de control compacta: vista + categoria + territorio en una sola linea */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", background: "#eae7de", borderRadius: 9, padding: 3 }}>
          {(["tabla", "mapa"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)}
              style={{ border: "none", background: vista === v ? T.surface : "transparent", color: vista === v ? T.ink : T.muted, fontSize: 13, fontWeight: vista === v ? 600 : 500, padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}>
              {v === "tabla" ? "▤ Tabla" : "◎ Mapa"}
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => { setCat(e.target.value); if (e.target.value !== "Emergencias y desastres") setEvento("Todos los eventos"); }}
          style={{ fontSize: 13, color: T.ink2, border: "1px solid #d8d3c7", background: T.surface, borderRadius: 99, padding: "8px 12px", cursor: "pointer", maxWidth: 240 }}>
          {["Todas", ...CATEGORIAS].map((c) => {
            const lote = c === "Todas" ? data : data.filter((x) => x.cat === c);
            return <option key={c} value={c}>{GLIFOS[c] ?? "◇"} {c === "Todas" ? "Todas las categorías" : c} ({lote.length})</option>;
          })}
        </select>
        <select value={dep} onChange={(e) => setDep(e.target.value)}
          style={{ fontSize: 13, color: T.ink2, border: "1px solid #d8d3c7", background: T.surface, borderRadius: 99, padding: "8px 12px", cursor: "pointer", maxWidth: 240 }}>
          {["Todos", ...DEPARTAMENTOS].map((d) => {
            const n = d === "Todos" ? data.length : data.filter((c) => c.dept === d).length;
            return <option key={d} value={d}>{d === "Todos" ? "Todos los departamentos" : d}{n ? ` (${n})` : ""}</option>;
          })}
        </select>
        {vista === "tabla" && (
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: "auto" }}>
            {visibles.length} señales · pág. {pagina}/{totalPaginas}
          </span>
        )}
      </div>

      {cat === "Emergencias y desastres" && vista === "tabla" && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginRight: 4 }}>EVENTO</span>
          {["Todos los eventos", ...EVENTOS].map((e) => {
            const on = evento === e;
            return <button key={e} onClick={() => setEvento(e)} style={{ border: `1px ${on ? "solid" : "dashed"} ${on ? T.alto : "#d8d3c7"}`, background: on ? T.alto : T.surface, color: on ? T.surface : T.ink2, fontSize: 12, padding: "6px 12px", borderRadius: 99, cursor: "pointer" }}>{e}</button>;
          })}
        </div>
      )}

      {vista === "mapa" && (
        <div style={{ margin: "0 -28px" }}>
          <MapaClient />
        </div>
      )}

      <div style={{ display: vista === "tabla" ? "flex" : "none", flexDirection: "column", gap: 12 }}>
        {visibles.length === 0 && (
          <div style={{ background: T.surface, border: "1px dashed #d8d3c7", borderRadius: 12, padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin contratos publicados con estos filtros</div>
            <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, maxWidth: 460, margin: "0 auto" }}>LupIA cubre los 33 departamentos. Que un territorio no tenga contratos también es un hallazgo: significa que aún no publica en SECOP II.</div>
          </div>
        )}
        {paginados.map((c) => {
          const color = riesgo(c.score);
          return (
            <div key={c.id} onClick={() => setSel(c.id)} className="lup-card" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "20px 22px", display: "grid", gridTemplateColumns: "96px 1fr 210px", gap: 24, cursor: "pointer", animation: "lupFade .3s ease both" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color }}>{c.score}</div>
                <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: "0.06em", color, textAlign: "center" }}>{nivelLabel(c.score)}</div>
                <div style={{ width: "100%", height: 3, background: T.lineSoft, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.score}%`, background: color }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{c.cat} · {c.dept} · {c.ciudad} · {c.fecha}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, background: "#eef3f6", color: T.ia, padding: "2px 7px", borderRadius: 4 }}>ANALIZADO POR IA</span>
                </div>
                <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: 6 }}>{c.objeto}</div>
                <div style={{ fontSize: 13.5, color: T.muted, marginBottom: 12 }}>{c.entidad}{c.proveedor ? ` → ${c.proveedor}` : ""}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(c.senales ?? [c.evento]).map((s) => (
                    <span key={s} style={{ fontSize: 12, fontWeight: 500, border: "1px solid #eadfd2", color: "#7d5a1c", background: "#faf4ea", padding: "4px 9px", borderRadius: 6 }}>{s}</span>
                  ))}
                </div>
              </div>
              <div style={{ borderLeft: `1px solid ${T.lineSoft}`, paddingLeft: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>VALOR</div>
                  <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>{fmtM(c.valor)}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.modalidad}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ia }}>Ver análisis →</div>
              </div>
            </div>
          );
        })}
      </div>

      {vista === "tabla" && totalPaginas > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 20 }}>
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}
            style={{ border: "1px solid #d8d3c7", background: T.surface, color: pagina === 1 ? T.faint : T.ink, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9, cursor: pagina === 1 ? "default" : "pointer" }}>← Anterior</button>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>página {pagina} de {totalPaginas}</span>
          <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
            style={{ border: "1px solid #d8d3c7", background: T.surface, color: pagina === totalPaginas ? T.faint : T.ink, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9, cursor: pagina === totalPaginas ? "default" : "pointer" }}>Siguiente →</button>
        </div>
      )}

      <div style={{ marginTop: 28, fontSize: 12.5, lineHeight: 1.6, color: T.muted, background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 18px", maxWidth: 820 }}>
        LupIA no acusa a nadie. Señala contratos cuyas características ameritan revisión, siempre con el porqué y el enlace al documento oficial en SECOP II. {salud ? "Cifras oficiales de SECOP II (datos.gov.co), contratos firmados desde el 10 de agosto de 2026." : "Sin backend conectado: las cifras de esta vista son simuladas."}
      </div>
    </main>
  );
}
