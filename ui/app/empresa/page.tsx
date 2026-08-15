"use client";
import { useState } from "react";
import { T, fmtM } from "@/lib/theme";
import { lupia } from "@/lib/api";

// Convocatorias sugeridas: demo del matching (la version real cruza p6dx-8zbt con el perfil)
const PROCESOS = [
  { afinidad: 92, entidad: "Alcaldía de Dosquebradas", dept: "Risaralda", objeto: "Reparación de 18 viviendas con daño estructural leve", valor: 740, cierra: "en 3 días", razon: "Coincide con tu historial en obra menor · misma UNSPSC" },
  { afinidad: 78, entidad: "Alcaldía de Calarcá", dept: "Quindío", objeto: "Adecuación de dos sedes educativas usadas como albergue", valor: 1120, cierra: "en 5 días", razon: "Objeto afín; requiere experiencia en sedes educativas" },
  { afinidad: 61, entidad: "Gobernación de Risaralda", dept: "Risaralda", objeto: "Interventoría técnica a obras de estabilización de taludes", valor: 420, cierra: "en 8 días", razon: "Afinidad parcial: exige interventor con matrícula vigente" },
];

interface ContratoNit {
  id_contrato: string; referencia_del_contrato?: string; fecha_de_firma?: string;
  fecha_de_inicio_del_contrato?: string; fecha_de_fin_del_contrato?: string;
  estado_contrato?: string; tipo_de_contrato?: string; modalidad_de_contratacion?: string;
  valor_del_contrato?: string; nombre_entidad?: string; nit_entidad?: string;
  departamento?: string; ciudad?: string; descripcion_del_proceso?: string; urlproceso?: string;
}

interface Perfil {
  nit: string;
  razones_sociales: string[];
  totales: { contratos: number; valor_total: number; primer_contrato: string | null; ultimo_contrato: string | null };
  top_entidades: { nombre_entidad: string; departamento: string; n: string; total: string }[];
  desde_sismo: { n: string; total: string | null };
  registro_proveedor: { nombre?: string; fecha_creacion?: string; espyme?: string }[];
  contratos_top?: ContratoNit[];
}

const soloFecha = (v?: string) => (v ? v.slice(0, 10) : "—");
const enMillones = (v?: string) => fmtM(Math.round((parseFloat(v || "0") || 0) / 1e6));

export default function Page() {
  const [nit, setNit] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [detalle, setDetalle] = useState<ContratoNit | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    const limpio = nit.replace(/\D/g, "");
    if (!limpio || cargando) return;
    setCargando(true); setError(null); setPerfil(null);
    try {
      setPerfil(await lupia.proveedor(limpio));
    } catch (e: any) {
      setError(e?.status === 404
        ? "Ese NIT no registra contratos en SECOP II (procesos electrónicos, ~2018 en adelante)."
        : "No pude consultar el NIT. ¿Está corriendo la API? datos.gov.co también puede estar intermitente.");
    }
    setCargando(false);
  };

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12 };
  const reg = perfil?.registro_proveedor?.[0];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 30, letterSpacing: "-0.025em", margin: 0, fontWeight: 700 }}>Modo Empresa</h1>
        <span style={{ fontFamily: T.mono, fontSize: 10, background: T.ink, color: T.surface, padding: "4px 9px", borderRadius: 4 }}>PRO</span>
      </div>
      <p style={{ margin: "0 0 26px", fontSize: 14.5, color: T.muted, lineHeight: 1.55, maxWidth: 640 }}>El mismo motor, al otro lado: escribe tu NIT y LupIA arma tu perfil real con lo que ya has ejecutado en SECOP II.</p>

      <div style={{ ...card, padding: "20px 22px", display: "flex", gap: 14, alignItems: "center", marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>NIT</div>
        <input value={nit} onChange={(e) => setNit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="860077014 (sin dígito de verificación)"
          style={{ fontFamily: T.mono, fontSize: 15, border: "1px solid #d8d3c7", borderRadius: 8, padding: "10px 14px", background: "#f9f8f4", minWidth: 260 }} />
        <button onClick={buscar} disabled={cargando} style={{ border: "none", background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: "11px 18px", borderRadius: 8, cursor: "pointer", opacity: cargando ? 0.7 : 1 }}>
          {cargando ? "Consultando SECOP…" : "Armar mi perfil"}
        </button>
        {error && <div style={{ fontSize: 13, color: T.alto }}>{error}</div>}
      </div>

      {perfil && (
        <div style={{ ...card, padding: "22px 26px", marginBottom: 22, animation: "lupFade .3s ease both" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{perfil.razones_sociales[0] ?? `NIT ${perfil.nit}`}</div>
            <span style={{ fontFamily: T.mono, fontSize: 10, background: "#eef3f6", color: T.ia, padding: "3px 8px", borderRadius: 4 }}>PERFIL REAL · SECOP II</span>
            {reg?.espyme === "SI" && <span style={{ fontFamily: T.mono, fontSize: 10, background: "#f2f6f3", color: T.bajo, padding: "3px 8px", borderRadius: 4 }}>PYME</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 5 }}>CONTRATOS</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{perfil.totales.contratos}</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 5 }}>VALOR EJECUTADO</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtM(Math.round(perfil.totales.valor_total / 1e6))}</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 5 }}>ACTIVO DESDE</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{perfil.totales.primer_contrato?.slice(0, 4) ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 5 }}>DESDE EL SISMO</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{perfil.desde_sismo?.n ?? "0"} contrato(s)</div>
            </div>
          </div>
          {perfil.top_entidades.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>PRINCIPALES ENTIDADES CONTRATANTES</div>
              {perfil.top_entidades.slice(0, 5).map((e) => (
                <div key={e.nombre_entidad + e.departamento} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #f0ece2" }}>
                  <span style={{ color: T.ink2, flex: 1 }}>{e.nombre_entidad} · {e.departamento}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{e.n} contrato(s) · {fmtM(Math.round((+e.total || 0) / 1e6))}</span>
                </div>
              ))}
            </div>
          )}

          {(perfil.contratos_top?.length ?? 0) > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>CONTRATOS MÁS CUANTIOSOS</div>
                <div style={{ fontSize: 11.5, color: T.faint }}>clic en una fila para ver el detalle</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: T.muted, fontFamily: T.mono, fontSize: 10.5 }}>
                      <th style={{ padding: "8px 10px" }}>#</th>
                      <th style={{ padding: "8px 10px" }}>MONTO</th>
                      <th style={{ padding: "8px 10px" }}>OBJETO</th>
                      <th style={{ padding: "8px 10px" }}>ENTIDAD</th>
                      <th style={{ padding: "8px 10px" }}>F. INICIO</th>
                      <th style={{ padding: "8px 10px" }}>F. FIN</th>
                      <th style={{ padding: "8px 10px" }}>DEPTO</th>
                      <th style={{ padding: "8px 10px" }}>LINK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfil.contratos_top!.map((ct, i) => (
                      <tr key={ct.id_contrato} onClick={() => setDetalle(ct)} className="lup-card"
                        style={{ borderTop: "1px solid #f0ece2", cursor: "pointer" }}>
                        <td style={{ padding: "10px", color: T.faint }}>{i + 1}</td>
                        <td style={{ padding: "10px", fontWeight: 700, whiteSpace: "nowrap" }}>{enMillones(ct.valor_del_contrato)}</td>
                        <td style={{ padding: "10px", color: T.ink2, maxWidth: 320 }}>{(ct.descripcion_del_proceso || "").slice(0, 90)}{(ct.descripcion_del_proceso || "").length > 90 ? "…" : ""}</td>
                        <td style={{ padding: "10px", color: T.ink2 }}>{(ct.nombre_entidad || "").slice(0, 30)}</td>
                        <td style={{ padding: "10px", fontFamily: T.mono, fontSize: 11.5, whiteSpace: "nowrap" }}>{soloFecha(ct.fecha_de_inicio_del_contrato)}</td>
                        <td style={{ padding: "10px", fontFamily: T.mono, fontSize: 11.5, whiteSpace: "nowrap" }}>{soloFecha(ct.fecha_de_fin_del_contrato)}</td>
                        <td style={{ padding: "10px", color: T.muted }}>{ct.departamento}</td>
                        <td style={{ padding: "10px" }}>
                          {ct.urlproceso && (
                            <a href={ct.urlproceso} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              style={{ color: T.ia, fontWeight: 700 }}>↗</a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {detalle && (
        <div onClick={() => setDetalle(null)} style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.5)", zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, borderRadius: 16, maxWidth: 640, width: "100%", margin: "auto", overflow: "hidden", animation: "lupFade .2s ease both" }}>
            <div style={{ background: T.ia, color: T.surface, padding: "16px 24px", display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Detalles del contrato</div>
              <button onClick={() => setDetalle(null)} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 18, color: T.surface, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 18px" }}>
                {([
                  ["CONTRATO", detalle.id_contrato],
                  ["REFERENCIA", detalle.referencia_del_contrato || "—"],
                  ["PROVEEDOR", `${perfil?.razones_sociales[0] ?? ""} · NIT ${perfil?.nit}`],
                  ["ENTIDAD", `${detalle.nombre_entidad ?? ""}${detalle.nit_entidad ? ` · NIT ${detalle.nit_entidad}` : ""}`],
                  ["TERRITORIO", `${detalle.departamento ?? ""}${detalle.ciudad ? ` · ${detalle.ciudad}` : ""}`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, padding: "6px 0", fontSize: 13.5 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, paddingTop: 2 }}>{k}</span>
                    <span style={{ color: T.ink2 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {([
                  ["VALOR", enMillones(detalle.valor_del_contrato)],
                  ["ESTADO", detalle.estado_contrato || "—"],
                  ["TIPO", detalle.tipo_de_contrato || "—"],
                  ["FIRMA", soloFecha(detalle.fecha_de_firma)],
                  ["INICIO", soloFecha(detalle.fecha_de_inicio_del_contrato)],
                  ["TERMINACIÓN", soloFecha(detalle.fecha_de_fin_del_contrato)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>OBJETO · {detalle.modalidad_de_contratacion || ""}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: T.ink2 }}>{detalle.descripcion_del_proceso || "No publicado"}</div>
              </div>
              {detalle.urlproceso && (
                <a href={detalle.urlproceso} target="_blank" rel="noreferrer"
                  style={{ border: `1px solid ${T.ink}`, background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: 12, borderRadius: 9, textAlign: "center" }}>
                  Abrir el contrato original en SECOP II ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Convocatorias de reconstrucción que te calzan</div>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.faint }}>VISTA PREVIA DEL MATCHING · EN DESARROLLO</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PROCESOS.map((p) => (
          <div key={p.objeto} style={{ ...card, padding: "20px 22px", display: "grid", gridTemplateColumns: "84px 1fr 190px", gap: 22, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: T.ia }}>{p.afinidad}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>AFINIDAD</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginBottom: 6 }}>{p.entidad} · {p.dept}</div>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{p.objeto}</div>
              <div style={{ fontSize: 13, color: T.muted }}>{p.razon}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>{fmtM(p.valor)}</div>
              <div style={{ fontSize: 12.5, color: T.alto, marginTop: 3 }}>Cierra {p.cierra}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: T.faint, lineHeight: 1.6, maxWidth: 720 }}>
        El perfil se arma en vivo con datos oficiales de SECOP II. Las convocatorias sugeridas son una vista previa del matching (cruce con procesos abiertos del dataset p6dx-8zbt) — próximo en el roadmap.
      </div>
    </main>
  );
}
