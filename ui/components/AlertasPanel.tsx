"use client";
import { useState } from "react";
import { T } from "@/lib/theme";
import { DEPARTAMENTOS } from "@/lib/data";
import { Usuario, lupia } from "@/lib/api";

const FOCO = ["Chocó", "Risaralda", "Quindío", "Caldas", "Valle del Cauca"];

interface Props { usuario: Usuario; onClose: () => void; onToast: (t: string) => void }

export function AlertasPanel({ usuario, onClose, onToast }: Props) {
  const [sel, setSel] = useState<string[]>([]);
  const [todoElPais, setTodoElPais] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternar = (d: string) => {
    setTodoElPais(false);
    setSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : s.length >= 3 ? s : [...s, d]));
  };

  const guardar = async () => {
    setCargando(true); setError(null);
    try {
      if (todoElPais) {
        await lupia.suscribir(usuario.correo, null);
      } else {
        for (const d of sel) await lupia.suscribir(usuario.correo, d);
      }
      onToast(todoElPais
        ? "Listo: te avisamos de señales nuevas en todo el país"
        : `Listo: te avisamos de señales nuevas en ${sel.join(", ")}`);
      onClose();
    } catch {
      setError("No pude guardar la suscripción. ¿Está corriendo la API?");
    }
    setCargando(false);
  };

  const chip = (d: string, on: boolean, destacado = false) => (
    <button key={d} onClick={() => alternar(d)}
      style={{ border: `1px solid ${on ? T.ink : destacado ? "#c98a6b" : "#d8d3c7"}`, background: on ? T.ink : T.surface, color: on ? T.surface : T.ink2, fontSize: 13, fontWeight: 500, padding: "7px 13px", borderRadius: 99, cursor: "pointer" }}>
      {d}{destacado && !on ? " ·" : ""}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.5)", zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, borderRadius: 16, maxWidth: 620, width: "100%", margin: "auto", overflow: "hidden", animation: "lupFade .2s ease both" }}>
        <div style={{ padding: "20px 26px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Recibir alertas por correo</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>A <strong>{usuario.correo}</strong> · hasta 3 territorios gratis, o todo el país</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 18, color: T.muted, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "20px 26px" }}>
          <button onClick={() => { setTodoElPais(!todoElPais); setSel([]); }}
            style={{ border: `1px solid ${todoElPais ? T.ink : "#d8d3c7"}`, background: todoElPais ? T.ink : T.surface, color: todoElPais ? T.surface : T.ink, fontSize: 13.5, fontWeight: 600, padding: "9px 16px", borderRadius: 99, cursor: "pointer", marginBottom: 16 }}>
            ◉ Todo el país
          </button>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>FOCO DE LA EMERGENCIA · SISMO 10 AGO</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
            {FOCO.map((d) => chip(d, sel.includes(d), true))}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>TODOS LOS DEPARTAMENTOS</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxHeight: 160, overflowY: "auto" }} className="lup-scroll">
            {DEPARTAMENTOS.filter((d) => !FOCO.includes(d)).map((d) => chip(d, sel.includes(d)))}
          </div>
          {error && <div style={{ fontSize: 12.5, color: T.alto, background: "#fbeee9", border: "1px solid #ecd5cc", borderRadius: 8, padding: "9px 12px", marginTop: 14 }}>{error}</div>}
        </div>
        <div style={{ padding: "16px 26px", borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={guardar} disabled={cargando || (!todoElPais && sel.length === 0)}
            style={{ border: "none", background: T.ink, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: "12px 20px", borderRadius: 9, cursor: "pointer", opacity: cargando || (!todoElPais && sel.length === 0) ? 0.6 : 1 }}>
            {cargando ? "Guardando…" : "Activar alertas"}
          </button>
          <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>Cuando el motor detecte una señal nueva en tus territorios, te llega el porqué y el link a SECOP.</div>
        </div>
      </div>
    </div>
  );
}
