"use client";
import { useEffect, useState } from "react";
import { T, fmtM } from "@/lib/theme";
import { Convocatoria, PerfilEmpresa as PerfilGuardado, lupia } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

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
  const { auth, pedir, toast } = useAuth();
  const [modo, setModo] = useState<"mia" | "validar">("validar");
  const [guardado, setGuardado] = useState<PerfilGuardado | null>(null);
  const [nit, setNit] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [detalle, setDetalle] = useState<ContratoNit | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convocatorias, setConvocatorias] = useState<Convocatoria[] | null>(null);
  const [convError, setConvError] = useState(false);
  const [conHistorial, setConHistorial] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  const cargarConvocatorias = (todas: boolean) => {
    setConvocatorias(null); setConvError(false);
    lupia.convocatorias(todas)
      .then((r) => { setConvocatorias(r.convocatorias); setConHistorial(r.con_historial); })
      .catch(() => setConvError(true));
  };

  useEffect(() => {
    if (!auth) return;
    cargarConvocatorias(verTodas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, verTodas]);

  const enviarAlCorreo = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await lupia.enviarConvocatorias();
      toast(`Te enviamos ${r.enviadas} convocatoria(s) al correo`);
    } catch (e: any) {
      toast(e?.message || "No pude enviar el correo, intenta de nuevo");
    }
    setEnviando(false);
  };

  const buscar = async (valor?: string) => {
    const limpio = (valor ?? nit).replace(/\D/g, "");
    if (!limpio || cargando) return;
    setCargando(true); setError(null); setPerfil(null);
    try {
      setPerfil(await lupia.proveedor(limpio));
    } catch (e: any) {
      setError(e?.status === 404
        ? "Ese NIT no registra contratos en SECOP II (procesos electrónicos, ~2018 en adelante)."
        : "No pude consultar el NIT: datos.gov.co puede estar intermitente, intenta de nuevo en unos segundos.");
    }
    setCargando(false);
  };

  // Perfil de empresa guardado en el onboarding: carga su NIT automaticamente
  useEffect(() => {
    if (!auth) return;
    lupia.miPerfilEmpresa().then((p) => {
      setGuardado(p);
      if (p.tiene_empresa && p.nit) {
        setModo("mia");
        setNit(p.nit);
        buscar(p.nit);
      }
    }).catch(() => setGuardado(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12 };
  const reg = perfil?.registro_proveedor?.[0];

  if (!auth) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "70px 28px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="1.8">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15.5" r="1.6" fill={T.ink} stroke="none" />
          </svg>
        </div>
        <h1 style={{ fontSize: 28, letterSpacing: "-0.025em", margin: "0 0 10px", fontWeight: 700 }}>El Modo Empresa pide cuenta</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14.5, color: T.muted, lineHeight: 1.6 }}>
          Con tu cuenta puedes mapear tu empresa (procesos ejecutados, en ejecución y convocatorias
          que calcen con tu perfil) o simplemente validar cualquier NIT contra SECOP II.
          El monitor ciudadano sigue siendo abierto y gratuito.
        </p>
        <button onClick={() => pedir(null)} style={{ border: "none", background: T.ink, color: T.surface, fontSize: 14.5, fontWeight: 600, padding: "13px 26px", borderRadius: 9, cursor: "pointer" }}>
          Entrar o crear cuenta
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 30, letterSpacing: "-0.025em", margin: 0, fontWeight: 700 }}>Modo Empresa</h1>
        <span style={{ fontFamily: T.mono, fontSize: 10, background: T.ink, color: T.surface, padding: "4px 9px", borderRadius: 4 }}>PRO</span>
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 14.5, color: T.muted, lineHeight: 1.55, maxWidth: 640 }}>El mismo motor, al otro lado: LupIA arma un perfil real con lo ejecutado en SECOP II.</p>

      <div style={{ display: "flex", background: "#eae7de", borderRadius: 9, padding: 3, width: "fit-content", marginBottom: 18 }}>
        {([["mia", "Mi empresa"], ["validar", "Validar cualquier NIT"]] as const).map(([m, etiqueta]) => (
          <button key={m} onClick={() => setModo(m)}
            style={{ border: "none", background: modo === m ? T.surface : "transparent", color: modo === m ? T.ink : T.muted, fontSize: 13, fontWeight: modo === m ? 600 : 500, padding: "9px 18px", borderRadius: 6, cursor: "pointer" }}>
            {etiqueta}
          </button>
        ))}
      </div>

      {modo === "mia" && !guardado?.nit && (
        <div style={{ ...card, padding: "18px 22px", marginBottom: 18, fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
          Aún no has guardado el NIT de tu empresa. Escríbelo abajo y arma el perfil —
          quedará asociado a tu cuenta{guardado?.intereses?.includes("convocatorias") ? " y usaremos tu perfil para avisarte de convocatorias que calcen" : ""}.
        </div>
      )}

      <div style={{ ...card, padding: "20px 22px", marginBottom: 8, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>NIT</div>
        <input value={nit} onChange={(e) => setNit(e.target.value.replace(/[^\d.-]/g, ""))} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="123456789" inputMode="numeric"
          style={{ fontFamily: T.mono, fontSize: 15, border: "1px solid #d8d3c7", borderRadius: 8, padding: "10px 14px", background: "#f9f8f4", minWidth: 240 }} />
        <button onClick={() => buscar()} disabled={cargando} style={{ border: "none", background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: "11px 18px", borderRadius: 8, cursor: "pointer", opacity: cargando ? 0.7 : 1 }}>
          {cargando ? "Consultando SECOP…" : modo === "mia" ? "Armar mi perfil" : "Consultar historial"}
        </button>
        {error && <div style={{ fontSize: 13, color: T.alto }}>{error}</div>}
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: T.faint, lineHeight: 1.6, margin: "0 4px 22px", maxWidth: 760 }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: "0.06em", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 4, padding: "2px 6px", height: "fit-content", whiteSpace: "nowrap" }}>CÓMO</span>
        <span>
          Escribe solo los números del NIT, <strong>sin el dígito de verificación</strong> (el que va después
          del guion). Consultamos el historial completo de esa empresa en
          SECOP II: contratos, entidades, valores y fechas. Cubre procesos electrónicos (~2018 en adelante).
        </span>
      </div>

      {perfil && (
        <div style={{ ...card, padding: "22px 26px", marginBottom: 22, animation: "lupFade .3s ease both" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{perfil.razones_sociales[0] ?? `NIT ${perfil.nit}`}</div>
            <span style={{ fontFamily: T.mono, fontSize: 10, background: "#eef3f6", color: T.ia, padding: "3px 8px", borderRadius: 4 }}>PERFIL REAL · SECOP II</span>
            {reg?.espyme === "SI" && <span style={{ fontFamily: T.mono, fontSize: 10, background: "#f2f6f3", color: T.bajo, padding: "3px 8px", borderRadius: 4 }}>PYME</span>}
          </div>
          <div className="lup-empresa-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
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
        <div onClick={() => setDetalle(null)} className="lup-modal-ov" style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.5)", zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
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
              <div className="lup-valores-3" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{verTodas ? "Todas las convocatorias abiertas" : `Convocatorias que calzan con ${conHistorial ? "tu perfil" : "la reconstrucción"}`}</div>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, background: "#eef3f6", color: T.ia, padding: "3px 8px", borderRadius: 4 }}>PROCESOS ABIERTOS SECOP II</span>
        {convocatorias && convocatorias.length > 0 && !verTodas && (
          <button onClick={enviarAlCorreo} disabled={enviando}
            style={{ marginLeft: "auto", border: `1px solid ${T.ink}`, background: T.surface, color: T.ink, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", opacity: enviando ? 0.7 : 1 }}>
            {enviando ? "Enviando…" : "Enviármelas al correo"}
          </button>
        )}
      </div>
      <div style={{ display: "flex", background: "#eae7de", borderRadius: 9, padding: 3, width: "fit-content", marginBottom: 14 }}>
        {([[false, "Las que me calzan"], [true, "Ver todas las abiertas"]] as const).map(([v, etq]) => (
          <button key={etq} onClick={() => setVerTodas(v)}
            style={{ border: "none", background: verTodas === v ? T.surface : "transparent", color: verTodas === v ? T.ink : T.muted, fontSize: 12.5, fontWeight: verTodas === v ? 600 : 500, padding: "8px 14px", borderRadius: 6, cursor: "pointer" }}>
            {etq}
          </button>
        ))}
      </div>
      {convocatorias === null && !convError && (
        <div style={{ ...card, padding: "22px", fontSize: 13.5, color: T.muted }}>Cruzando tu perfil con los procesos abiertos de SECOP II…</div>
      )}
      {convError && (
        <div style={{ ...card, padding: "20px 22px", fontSize: 13.5, color: T.muted, lineHeight: 1.6, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span>datos.gov.co está intermitente en este momento. Reintenta en unos segundos.</span>
          <button onClick={() => cargarConvocatorias(verTodas)}
            style={{ border: `1px solid ${T.ink}`, background: T.surface, color: T.ink, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Reintentar</button>
        </div>
      )}
      {convocatorias && convocatorias.length === 0 && !convError && (
        <div style={{ ...card, padding: "22px", fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
          {verTodas
            ? "No hay procesos abiertos publicados en SECOP II en los últimos 45 días. Vuelve a mirar mañana."
            : <>No hay procesos abiertos que calcen con {conHistorial ? "tu historial" : "el perfil de reconstrucción"} por ahora. Prueba <strong>“Ver todas las abiertas”</strong> aquí arriba para explorar todo lo que hay publicado.</>}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(convocatorias ?? []).map((p) => (
          <div key={p.id_del_proceso} style={{ ...card, padding: "20px 22px", display: "grid", gridTemplateColumns: "84px 1fr 200px", gap: 22, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: T.ia }}>{p.afinidad}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>AFINIDAD</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginBottom: 6 }}>{p.entidad} · {p.departamento}{p.modalidad ? ` · ${p.modalidad}` : ""}</div>
              <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{p.objeto}</div>
              <div style={{ fontSize: 13, color: T.muted }}>{p.razon}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>{fmtM(Math.round(p.precio_base / 1e6))}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Publicada {p.publicada}{p.duracion ? ` · ${p.duracion}` : ""}</div>
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: T.ia, display: "inline-block", marginTop: 6 }}>Ver en SECOP II ↗</a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: T.faint, lineHeight: 1.6, maxWidth: 720 }}>
        El cruce es en vivo: procesos abiertos y no adjudicados del dataset oficial p6dx-8zbt (últimos 45 días),
        rankeados por afinidad con {conHistorial ? "el tipo de contrato, los territorios y el objeto de tu historial real" : "un perfil de obra y suministro en la zona de emergencia"}.
        La afinidad es una guía de LupIA; revisa siempre los pliegos en SECOP II.
      </div>
    </main>
  );
}
