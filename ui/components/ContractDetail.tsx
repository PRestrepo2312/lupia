"use client";
import { Contrato, TrazaItem } from "@/lib/types";
import { T, fmtM, riesgo, nivelLabel } from "@/lib/theme";
import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";
import { lupia } from "@/lib/api";

function trazaDesdePerfil(p: any): TrazaItem[] {
  const items: TrazaItem[] = [];
  const reg = p.registro_proveedor?.[0];
  if (reg?.fecha_creacion) items.push({ fecha: reg.fecha_creacion.slice(0, 10), evento: "Se registra como proveedor del Estado" });
  for (const a of p.por_anio ?? []) {
    items.push({ fecha: String(a.anio), evento: `${a.n} contrato(s) en SECOP II por ${fmtM(Math.round((+a.total || 0) / 1e6))}` });
  }
  const s = p.desde_sismo;
  if (s && s.n && s.n !== "0") items.push({ fecha: "SISMO→", evento: `Desde el 10 de agosto: ${s.n} contrato(s) por ${fmtM(Math.round((+s.total || 0) / 1e6))}` });
  return items.slice(-9);
}

export function ContractDetail({ c, onBack }: { c: Contrato; onBack: () => void }) {
  const { auth, usuario, pedir, toast } = useAuth();
  const [pdf, setPdf] = useState(false);
  const [traza, setTraza] = useState<TrazaItem[] | null>(null);
  const [trazaError, setTrazaError] = useState(false);
  const color = riesgo(c.score);

  // Trazabilidad real del NIT (historial completo en SECOP II)
  useEffect(() => {
    if (!auth || !c.nit) return;
    setTraza(null); setTrazaError(false);
    lupia.proveedor(c.nit).then((p) => setTraza(trazaDesdePerfil(p))).catch(() => setTrazaError(true));
  }, [auth, c.nit]);

  const avisarme = async () => {
    if (!auth || !usuario) return pedir("alertas");
    try {
      await lupia.suscribir(usuario.correo, c.dept);
      toast(`Te avisaremos de señales nuevas en ${c.dept}`);
    } catch {
      toast("No pude guardar la suscripción. ¿Está corriendo la API?");
    }
  };

  const descargarPeticion = () => {
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Derecho de petición · ${c.idContrato}</title>
<body style="font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.7;color:#222">
<div style="text-align:right">${c.ciudad || c.dept}, ${c.fecha}</div>
<p><strong>Señores<br>${c.entidad}<br>Oficina de Atención al Ciudadano</strong></p>
<p><strong>Referencia:</strong> Derecho de petición · Ley 1755 de 2015 · contrato ${c.idContrato}</p>
<p>En ejercicio del derecho fundamental de petición, solicito información sobre el contrato de la referencia, suscrito el ${c.fecha} por valor de ${fmtM(c.valor)} bajo la modalidad de ${c.modalidad || "contratación directa"}, cuyo objeto es "${c.objeto}".</p>
<p>Solicito: (i) los estudios previos y el análisis del sector que sustentan el precio pactado; (ii) la justificación de la relación del objeto contratado con la emergencia declarada; (iii) la experiencia acreditada por el contratista; (iv) copia de las actas de supervisión suscritas a la fecha.</p>
<p>Sustento la solicitud en información publicada por la propia entidad en SECOP II${c.url ? ` (${c.url})` : ""}. No formulo acusación alguna.</p>
<p>Atentamente,<br><br>_____________________<br>C.C. · correo de notificación</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `derecho-de-peticion-${c.idContrato}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Descargado: ábrelo, complétalo con tus datos e imprímelo o radícalo");
  };
  const meta = [
    ["ENTIDAD", c.entidad],
    ["PROVEEDOR", c.proveedor ? `${c.proveedor} · ${c.nit ?? ""}` : "No publicado"],
    ["VALOR", fmtM(c.valor)],
    ["FIRMA · MODALIDAD", `${c.fecha} · ${c.modalidad}`],
  ];
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12 };

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 80px" }}>
      <button onClick={onBack} style={{ border: "none", background: "none", color: T.muted, fontSize: 13, padding: 0, marginBottom: 20, cursor: "pointer" }}>← Volver al monitor</button>
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, padding: "26px 28px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{c.idContrato}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, background: "#fbeee9", color, padding: "3px 8px", borderRadius: 4 }}>RIESGO {c.score}/100 · {nivelLabel(c.score)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, background: "#eef3f6", color: T.ia, padding: "3px 8px", borderRadius: 4 }}>{c.cat.toUpperCase()}</span>
            </div>
            <h1 style={{ fontSize: 26, lineHeight: 1.25, letterSpacing: "-0.02em", margin: "0 0 18px", fontWeight: 700 }}>{c.objeto}</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
              {meta.map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 5 }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.ia}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: T.ia, color: T.surface, padding: "11px 22px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em" }}>ANÁLISIS DEL MOTOR</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, opacity: .75, marginLeft: "auto" }}>{c.capas?.length ?? 0} señal(es) · datos oficiales</span>
            </div>
            <div style={{ padding: "22px 26px 26px" }}>
              <p style={{ margin: "0 0 22px", fontSize: 15, lineHeight: 1.6 }}>{c.iaTexto ?? "Este contrato aún no tiene razonamiento generado en la demo. Conecta el motor para poblarlo."}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(c.capas ?? []).map((p) => (
                  <div key={p.titulo} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{p.capa}</span>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{p.titulo}</span>
                      <span style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: 13, color: p.pct > 60 ? T.alto : p.pct > 35 ? T.medio : T.bajo }}>{p.metrica}</span>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: T.ink2 }}>{p.detalle}</div>
                    <div style={{ marginTop: 12, height: 6, background: T.lineSoft, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p.pct}%`, background: p.pct > 60 ? T.alto : p.pct > 35 ? T.medio : T.bajo }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {c.evidencia && (
            <div style={{ ...card, padding: "22px 26px" }}>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.06em", color: T.muted, marginBottom: 14 }}>EVIDENCIA VERIFICABLE</div>
              {c.evidencia.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 13.5, lineHeight: 1.5, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f0ece2" }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, minWidth: 120 }}>{e.fuente}</span>
                  <span style={{ color: T.ink2 }}>{e.dato}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 96 }}>
          <div style={{ ...card, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Del dato a la acción</div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, marginBottom: 16 }}>Tres formas de hacer algo con esta señal.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={() => setPdf(true)} style={{ border: `1px solid ${T.ink}`, background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: 12, borderRadius: 9, cursor: "pointer", textAlign: "left" }}>Generar derecho de petición</button>
              <button onClick={avisarme} className="lup-card" style={{ border: "1px solid #d8d3c7", background: T.surface, color: T.ink, fontSize: 13.5, fontWeight: 600, padding: 12, borderRadius: 9, cursor: "pointer", textAlign: "left" }}>Avisarme si cambia o se adiciona{auth ? "" : " · requiere cuenta"}</button>
              <a href={c.url ?? "https://www.secop.gov.co"} target="_blank" rel="noreferrer" style={{ border: "1px solid #d8d3c7", background: T.surface, color: T.ink, fontSize: 13.5, fontWeight: 600, padding: 12, borderRadius: 9, textAlign: "left" }}>Abrir en SECOP II ↗</a>
            </div>
          </div>

          <div style={{ ...card, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>TRAZABILIDAD DEL PROVEEDOR</div>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.faint, marginLeft: "auto" }}>{auth ? (traza ? `${traza.length} REGISTROS` : trazaError ? "SIN DATOS" : "CARGANDO…") : "REQUIERE CUENTA"}</div>
            </div>
            {auth ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {!c.nit && <div style={{ fontSize: 12.5, color: T.muted }}>Este contrato no publica el NIT del proveedor.</div>}
                {trazaError && <div style={{ fontSize: 12.5, color: T.muted }}>El historial del NIT no está disponible en este momento (datos.gov.co intermitente).</div>}
                {(traza ?? []).map((t, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "66px 1fr", gap: 10, fontSize: 12.5, lineHeight: 1.45 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{t.fecha}</span>
                    <span style={{ color: T.ink2 }}>{t.evento}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: T.muted, marginBottom: 12 }}>Cada cambio, adición y prórroga queda registrado. Para verlo y seguirlo necesitas una cuenta.</div>
                <button onClick={() => pedir("traza")} style={{ width: "100%", border: `1px solid ${T.ink}`, background: T.surface, color: T.ink, fontSize: 13, fontWeight: 600, padding: 11, borderRadius: 9, cursor: "pointer" }}>Entrar para ver la trazabilidad</button>
              </>
            )}
          </div>

          <div style={{ fontSize: 11.5, lineHeight: 1.55, color: T.faint, padding: "0 4px" }}>Señal, no acusación. LupIA marca lo que amerita revisión con datos oficiales; la interpretación es del lector.</div>
        </div>
      </div>

      {pdf && (
        <div onClick={() => setPdf(false)} style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, maxWidth: 720, width: "100%", margin: "auto", overflow: "hidden" }}>
            <div style={{ padding: "20px 26px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Derecho de petición generado</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, background: "#eef3f6", color: T.ia, padding: "3px 8px", borderRadius: 4 }}>LEY 1755 DE 2015</div>
              <button onClick={() => setPdf(false)} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 18, color: T.muted, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 26, background: T.surfaceAlt }}>
              <div style={{ background: "#fff", border: "1px solid #d8d3c7", padding: "30px 34px", fontSize: 12.5, lineHeight: 1.7, color: "#2a2822", maxHeight: 340, overflow: "auto" }}>
                <div style={{ textAlign: "right", fontFamily: T.mono, fontSize: 11, color: T.muted }}>{c.ciudad}, {c.fecha}</div>
                <div style={{ marginTop: 16, fontWeight: 700 }}>Señores<br />{c.entidad}<br />Oficina de Atención al Ciudadano</div>
                <div style={{ marginTop: 14 }}><strong>Referencia:</strong> Derecho de petición · Ley 1755 de 2015 · contrato {c.idContrato}</div>
                <p style={{ margin: "14px 0 0" }}>En ejercicio del derecho fundamental de petición, solicito información sobre el contrato de la referencia, suscrito el {c.fecha} por valor de {fmtM(c.valor)} bajo la modalidad de {c.modalidad || "contratación directa"}, cuyo objeto es “{c.objeto}”.</p>
                <p style={{ margin: "12px 0 0" }}>Solicito: (i) los estudios previos y el análisis del sector que sustentan el precio unitario pactado; (ii) la justificación de la relación del objeto contratado con el foco de gasto declarado; (iii) la experiencia acreditada por el contratista; (iv) copia de las actas de supervisión suscritas a la fecha.</p>
                <p style={{ margin: "12px 0 0" }}>Sustento la solicitud en información publicada por la propia entidad en SECOP II. No formulo acusación alguna.</p>
                <div style={{ marginTop: 18 }}>Atentamente,<br />_____________________<br />C.C. · correo de notificación</div>
              </div>
            </div>
            <div style={{ padding: "18px 26px", display: "flex", gap: 10, alignItems: "center", borderTop: `1px solid ${T.line}` }}>
              <button onClick={descargarPeticion} style={{ border: "none", background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: "11px 18px", borderRadius: 9, cursor: "pointer" }}>Descargar documento</button>
              <div style={{ fontSize: 11.5, color: T.faint, marginLeft: "auto" }}>Se descarga listo para completar con tus datos e imprimir o radicar.</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
