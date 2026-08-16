"use client";
import { useEffect, useState } from "react";
import { T, fmtM } from "@/lib/theme";
import { DEPARTAMENTOS } from "@/lib/data";
import { Convocatoria, Suscripcion, Usuario, lupia } from "@/lib/api";

const FOCO = ["Chocó", "Risaralda", "Quindío", "Caldas", "Valle del Cauca"];

interface Props { usuario: Usuario; onClose: () => void; onToast: (t: string) => void }

type Tab = "mias" | "nuevas" | "oportunidades";

export function AlertasPanel({ usuario, onClose, onToast }: Props) {
  const [tab, setTab] = useState<Tab>("mias");
  const [sel, setSel] = useState<string[]>([]);
  const [todoElPais, setTodoElPais] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activas, setActivas] = useState<Suscripcion[] | null>(null);
  const [oportunidades, setOportunidades] = useState<Convocatoria[] | null>(null);
  const [oportError, setOportError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargarActivas = () =>
    lupia.misSuscripciones().then(setActivas).catch(() => setActivas([]));
  useEffect(() => { cargarActivas(); }, []);

  // Al abrir "oportunidades", cruza el perfil con procesos abiertos (aviso proactivo)
  useEffect(() => {
    if (tab !== "oportunidades" || oportunidades !== null) return;
    setOportError(null);
    lupia.convocatorias()
      .then((r) => {
        setOportunidades(r.convocatorias);
        if (!r.con_historial) setOportError("Guarda el NIT de tu empresa en Modo Empresa para afinar las oportunidades a tu perfil.");
      })
      .catch(() => setOportError("No pude traer las oportunidades ahora. Intenta en unos segundos."));
  }, [tab, oportunidades]);

  const desactivar = async (s: Suscripcion) => {
    try {
      await lupia.borrarSuscripcion(s.id);
      onToast(`Alerta de ${s.departamento ?? "todo el país"} desactivada`);
      cargarActivas();
    } catch { onToast("No pude desactivar la alerta"); }
  };

  const alternar = (d: string) => {
    setTodoElPais(false);
    setSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : s.length >= 3 ? s : [...s, d]));
  };

  const guardar = async () => {
    setCargando(true); setError(null);
    try {
      if (todoElPais) await lupia.suscribir(usuario.correo, null);
      else for (const d of sel) await lupia.suscribir(usuario.correo, d);
      onToast(todoElPais ? "Listo: te avisamos de señales nuevas en todo el país" : `Listo: te avisamos en ${sel.join(", ")}`);
      setSel([]); setTodoElPais(false);
      cargarActivas();
      setTab("mias");
    } catch { setError("No pude guardar la suscripción. ¿Está corriendo la API?"); }
    setCargando(false);
  };

  const enviarOportunidades = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await lupia.enviarConvocatorias();
      onToast(`Te enviamos ${r.enviadas} oportunidad(es) al correo`);
    } catch (e: any) { onToast(e?.message || "No pude enviar el correo"); }
    setEnviando(false);
  };

  const chip = (d: string, on: boolean, destacado = false) => (
    <button key={d} onClick={() => alternar(d)}
      style={{ border: `1px solid ${on ? T.ink : destacado ? "#c98a6b" : "#d8d3c7"}`, background: on ? T.ink : T.surface, color: on ? T.surface : T.ink2, fontSize: 13, fontWeight: 500, padding: "7px 13px", borderRadius: 99, cursor: "pointer" }}>
      {d}
    </button>
  );

  const tabs: [Tab, string][] = [["mias", "Mis alertas"], ["nuevas", "Agregar"], ["oportunidades", "Oportunidades"]];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.5)", zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, borderRadius: 16, maxWidth: 620, width: "100%", margin: "auto", overflow: "hidden", animation: "lupFade .2s ease both" }}>
        <div style={{ padding: "18px 26px 0", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Alertas y oportunidades</div>
            <div style={{ fontSize: 12, color: T.muted, marginLeft: 2 }}>· {usuario.correo}</div>
            <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 18, color: T.muted, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map(([k, etq]) => {
              const on = tab === k;
              return (
                <button key={k} onClick={() => setTab(k)}
                  style={{ border: "none", borderBottom: `2px solid ${on ? T.ink : "transparent"}`, background: "none", color: on ? T.ink : T.muted, fontSize: 13.5, fontWeight: on ? 600 : 500, padding: "8px 12px 12px", cursor: "pointer" }}>
                  {etq}{k === "mias" && activas ? ` (${activas.length})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "20px 26px", maxHeight: "60vh", overflowY: "auto" }} className="lup-scroll">
          {tab === "mias" && (
            <div>
              {!activas && <div style={{ fontSize: 13, color: T.muted }}>Cargando tus alertas…</div>}
              {activas && activas.length === 0 && (
                <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
                  Aún no tienes alertas. Ve a <strong>Agregar</strong> para elegir tus territorios y recibir un correo cuando el motor detecte una señal nueva.
                </div>
              )}
              {activas && activas.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {activas.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, borderRadius: 10, padding: "11px 14px", background: T.surface }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.bajo, flex: "none" }} />
                      <span style={{ flex: 1, fontSize: 13.5, color: T.ink2 }}>{s.departamento ?? "Todo el país"}</span>
                      <button onClick={() => desactivar(s)} style={{ border: "1px solid #d8d3c7", background: T.surface, color: T.muted, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, cursor: "pointer" }}>Desactivar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "nuevas" && (
            <div>
              <button onClick={() => { setTodoElPais(!todoElPais); setSel([]); }}
                style={{ border: `1px solid ${todoElPais ? T.ink : "#d8d3c7"}`, background: todoElPais ? T.ink : T.surface, color: todoElPais ? T.surface : T.ink, fontSize: 13.5, fontWeight: 600, padding: "9px 16px", borderRadius: 99, cursor: "pointer", marginBottom: 16 }}>
                Todo el país
              </button>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>FOCO DE LA EMERGENCIA · SISMO 10 AGO</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                {FOCO.map((d) => chip(d, sel.includes(d), true))}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>TODOS LOS DEPARTAMENTOS</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxHeight: 150, overflowY: "auto" }} className="lup-scroll">
                {DEPARTAMENTOS.filter((d) => !FOCO.includes(d)).map((d) => chip(d, sel.includes(d)))}
              </div>
              {error && <div style={{ fontSize: 12.5, color: T.alto, background: "#fbeee9", border: "1px solid #ecd5cc", borderRadius: 8, padding: "9px 12px", marginTop: 14 }}>{error}</div>}
              <button onClick={guardar} disabled={cargando || (!todoElPais && sel.length === 0)}
                style={{ marginTop: 16, border: "none", background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: "12px 20px", borderRadius: 9, cursor: "pointer", opacity: cargando || (!todoElPais && sel.length === 0) ? 0.6 : 1 }}>
                {cargando ? "Guardando…" : "Activar alertas"}
              </button>
            </div>
          )}

          {tab === "oportunidades" && (
            <div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>
                Procesos abiertos en SECOP II que calzan con tu perfil. Así ves las oportunidades para aplicar sin tener que buscarlas.
              </div>
              {oportunidades === null && !oportError && <div style={{ fontSize: 13, color: T.muted }}>Cruzando tu perfil con los procesos abiertos…</div>}
              {oportError && <div style={{ fontSize: 12.5, color: T.medio, background: "#faf4ea", border: "1px solid #eadfd2", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>{oportError}</div>}
              {oportunidades && oportunidades.length === 0 && !oportError && (
                <div style={{ fontSize: 13.5, color: T.muted }}>Hoy no hay procesos abiertos que superen el umbral de afinidad. Vuelve a mirar mañana.</div>
              )}
              {oportunidades && oportunidades.length > 0 && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {oportunidades.slice(0, 6).map((o) => (
                      <div key={o.id_del_proceso} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", background: T.surface }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.ia }}>{o.afinidad}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>AFINIDAD</span>
                          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>{fmtM(Math.round(o.precio_base / 1e6))}</span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 3 }}>{o.objeto}</div>
                        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{o.entidad} · {o.departamento}</div>
                        {o.url && <a href={o.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: T.ia, display: "inline-block", marginTop: 5 }}>Ver en SECOP II ↗</a>}
                      </div>
                    ))}
                  </div>
                  <button onClick={enviarOportunidades} disabled={enviando}
                    style={{ marginTop: 14, border: `1px solid ${T.ink}`, background: T.surface, color: T.ink, fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 9, cursor: "pointer", opacity: enviando ? 0.7 : 1 }}>
                    {enviando ? "Enviando…" : "Enviármelas al correo"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
