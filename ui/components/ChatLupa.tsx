"use client";
import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { lupia } from "@/lib/api";

interface Msg { who: string; text: string }

const RESPUESTAS: Record<string, string> = {
  pereira: "En Pereira hay 14 contratos de urgencia manifiesta desde el 10 de agosto, por $8.420 millones.\n\nEl de mayor riesgo (87) es dotación administrativa: el objeto no describe atención de la emergencia y el precio unitario está 61% sobre la mediana histórica.",
  sobrecosto: "Cinco contratos superan la mediana histórica de su categoría en más del 30%.\n\nEl mayor diferencial está en equipos de cómputo en Pereira (+61%) y kits de aseo en Quibdó (+38%). En Quibdó parte del diferencial puede explicarse por flete fluvial: lo señalamos, no lo afirmamos.",
  debutantes: "Siete NIT aparecen por primera vez en SECOP con un contrato superior a $500 millones.\n\nDos se registraron en cámara de comercio en los últimos seis meses. Ser nuevo no es irregular; ser nuevo y adjudicatario directo de un monto alto sí amerita verificar.",
  generico: "Tengo cargados los contratos publicados en SECOP II con su score, el precio unitario extraído del texto y el historial de cada proveedor.\n\nPuedo responder por territorio, por categoría, por sobrecostos o por contratista nuevo.",
};

// Fallback local cuando la IA no esta conectada (sin credenciales de Bedrock)
function respuestaMock(q: string) {
  const t = q.toLowerCase();
  if (t.includes("pereira")) return RESPUESTAS.pereira;
  if (t.includes("sobrecosto") || t.includes("precio") || t.includes("caro")) return RESPUESTAS.sobrecosto;
  if (t.includes("nuevo") || t.includes("debut") || t.includes("primera")) return RESPUESTAS.debutantes;
  return RESPUESTAS.generico;
}

export function ChatLupa() {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pensando, setPensando] = useState(false);
  const ojos = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mover = (e: MouseEvent) => {
      ojos.current.forEach((el) => {
        if (!el) return;
        const b = el.getBoundingClientRect();
        const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
        const d = Math.hypot(dx, dy) || 1, m = Math.min(3.4, d / 22);
        el.style.transform = `translate(${(dx / d * m).toFixed(2)}px,${(dy / d * m).toFixed(2)}px)`;
      });
    };
    window.addEventListener("mousemove", mover);
    return () => window.removeEventListener("mousemove", mover);
  }, []);

  const preguntar = async (q: string) => {
    if (!q.trim() || pensando) return;
    setMsgs((m) => [...m, { who: "TÚ", text: q }]);
    setInput(""); setPensando(true); setAbierto(true);
    try {
      const r = await lupia.chat(q);
      setMsgs((m) => [...m, { who: "LUPIA · CLAUDE SOBRE SECOP II", text: r.respuesta }]);
    } catch {
      setMsgs((m) => [...m, {
        who: "LUPIA · RESPUESTA DE EJEMPLO",
        text: respuestaMock(q) + "\n\n(La IA aún no está conectada: esta es una respuesta de ejemplo.)",
      }]);
    }
    setPensando(false);
  };

  const sugerencias = ["¿En qué se está gastando la plata en Pereira?", "¿Cuáles contratos están sobre el precio histórico?", "¿Hay contratistas que aparecen por primera vez?"];

  return (
    <>
      <div onClick={() => setAbierto(!abierto)} title="Preguntar a LupIA" style={{ position: "fixed", right: 26, bottom: 26, width: 64, height: 64, zIndex: 56, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 8px 18px rgba(27,26,23,.26))" }}>
        <div style={{ position: "absolute", right: 4, bottom: 4, width: 20, height: 8, borderRadius: 99, background: T.ink, transform: "rotate(45deg)" }} />
        <div style={{ position: "relative", width: 54, height: 54, borderRadius: "50%", border: `5px solid ${T.ink}`, background: "#e9eef2", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ width: 15, height: 15, borderRadius: "50%", background: T.surface, border: `1.5px solid ${T.ink}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "lupBlink 5.5s infinite" }}>
              <div ref={(el) => { ojos.current[i] = el; }} style={{ width: 6, height: 6, borderRadius: "50%", background: T.ink, transition: "transform .08s linear" }} />
            </div>
          ))}
          <div style={{ position: "absolute", top: -5, left: -5, width: 22, height: 22, borderRadius: "50%", background: abierto ? T.ink : T.alto, color: T.surface, fontFamily: T.mono, fontSize: 9.5, display: "flex", alignItems: "center", justifyContent: "center" }}>{abierto ? "×" : "IA"}</div>
        </div>
      </div>

      {abierto && (
        <section style={{ position: "fixed", right: 26, bottom: 104, width: "min(390px, calc(100vw - 40px))", height: "min(560px, calc(100vh - 170px))", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 44px rgba(27,26,23,.18)", zIndex: 55, display: "flex", flexDirection: "column", overflow: "hidden", animation: "lupPop .22s ease both" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "15px 18px", borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ position: "relative", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", right: 1, bottom: 1, width: 11, height: 5, borderRadius: 99, background: T.ink, transform: "rotate(45deg)" }} />
              <div style={{ width: 25, height: 25, borderRadius: "50%", border: `3px solid ${T.ink}`, background: "#e9eef2" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Pregúntale a LupIA</div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{pensando ? "Escribiendo…" : "Lee SECOP II en tiempo real"}</div>
            </div>
            <button onClick={() => setAbierto(false)} style={{ border: "none", background: "none", fontSize: 17, color: T.muted, cursor: "pointer" }}>✕</button>
          </div>

          <div className="lup-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            {msgs.length === 0 && (
              <div style={{ background: "#f9f8f4", border: `1px solid ${T.line}`, borderRadius: 13, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.6 }}>
                Pregúntame en qué se está gastando la plata pública. Respondo con contratos publicados en SECOP II y te digo de dónde salió cada cifra.
              </div>
            )}
            {msgs.map((m, i) => {
              const mio = m.who === "TÚ";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: mio ? "flex-end" : "flex-start", animation: "lupFade .25s ease both" }}>
                  <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.06em", color: T.faint }}>{m.who}</div>
                  <div style={{ maxWidth: "88%", background: mio ? T.ink : "#f9f8f4", color: mio ? T.surface : T.ink, border: `1px solid ${mio ? T.ink : T.line}`, borderRadius: 13, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-line" }}>{m.text}</div>
                </div>
              );
            })}
            {pensando && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.ia }}>Consultando SECOP…</div>}
            {msgs.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.faint }}>PRUEBA CON</div>
                {sugerencias.map((q) => (
                  <button key={q} onClick={() => preguntar(q)} className="lup-card" style={{ border: `1px solid ${T.line}`, background: "#f9f8f4", color: T.ink, fontSize: 12.5, lineHeight: 1.4, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>{q}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: "none", borderTop: `1px solid ${T.lineSoft}`, padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && preguntar(input)} placeholder="¿Qué quieres saber?" style={{ flex: 1, minWidth: 0, border: "1px solid #d8d3c7", background: "#f9f8f4", borderRadius: 99, padding: "11px 15px", fontSize: 13.5, outline: "none" }} />
              <button onClick={() => preguntar(input)} style={{ flex: "none", width: 38, height: 38, borderRadius: "50%", border: "none", background: T.ink, color: T.surface, fontSize: 15, cursor: "pointer" }}>↑</button>
            </div>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 8 }}>Responde con contratos publicados en SECOP II · señal, no acusación</div>
          </div>
        </section>
      )}
    </>
  );
}
