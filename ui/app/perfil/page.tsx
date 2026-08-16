"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { PerfilPersona, lupia } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const VACIO: PerfilPersona = { nombre: "", telefono: "", ciudad: "", profesion: "", sobre_mi: "" };

export default function Page() {
  const { auth, usuario, pedir, toast } = useAuth();
  const [p, setP] = useState<PerfilPersona>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!auth) { setCargando(false); return; }
    lupia.miPerfil()
      .then((r) => setP({ nombre: r.nombre ?? "", telefono: r.telefono ?? "", ciudad: r.ciudad ?? "", profesion: r.profesion ?? "", sobre_mi: r.sobre_mi ?? "" }))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [auth]);

  const guardar = async () => {
    setGuardando(true);
    try { await lupia.guardarPerfil(p); toast("Perfil guardado"); }
    catch { toast("No pude guardar el perfil, intenta de nuevo"); }
    setGuardando(false);
  };

  const set = (k: keyof PerfilPersona) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setP((s) => ({ ...s, [k]: e.target.value }));

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12 };
  const input: React.CSSProperties = { width: "100%", border: "1px solid #d8d3c7", background: "#f9f8f4", borderRadius: 9, padding: "11px 14px", fontSize: 14, color: T.ink2, outline: "none" };
  const label: React.CSSProperties = { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.05em", color: T.muted, marginBottom: 6, textTransform: "uppercase" };

  if (!auth) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.025em", margin: "0 0 10px", fontWeight: 700 }}>Tu perfil</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14.5, color: T.muted, lineHeight: 1.6 }}>Entra para ver y completar tus datos. Todo es opcional; los usamos para personalizar tus alertas y oportunidades.</p>
        <button onClick={() => pedir(null)} style={{ border: "none", background: T.ink, color: T.surface, fontSize: 14.5, fontWeight: 600, padding: "13px 26px", borderRadius: 9, cursor: "pointer" }}>Entrar o crear cuenta</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 80px" }}>
      <h1 style={{ fontSize: 28, letterSpacing: "-0.025em", margin: "0 0 6px", fontWeight: 700 }}>Mi perfil</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14.5, color: T.muted, lineHeight: 1.55 }}>
        Datos básicos, todos opcionales. Complétalos cuando quieras — nos ayudan a personalizar tus alertas y las oportunidades que te mostramos.
      </p>

      <div style={{ ...card, padding: "22px 24px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, marginBottom: 20, borderBottom: `1px solid ${T.lineSoft}` }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.surfaceAlt, border: "1px solid #d8d3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: T.ink2 }}>
            {(usuario?.correo ?? "").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.nombre || "Sin nombre aún"}</div>
            <div style={{ fontSize: 13, color: T.muted }}>{usuario?.correo}</div>
          </div>
        </div>

        {cargando ? (
          <div style={{ fontSize: 13.5, color: T.muted }}>Cargando…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="perfil-grid">
            <div><div style={label}>Nombre</div><input value={p.nombre ?? ""} onChange={set("nombre")} placeholder="Tu nombre" style={input} /></div>
            <div><div style={label}>Teléfono</div><input value={p.telefono ?? ""} onChange={set("telefono")} placeholder="3001234567" inputMode="tel" style={input} /></div>
            <div><div style={label}>Ciudad</div><input value={p.ciudad ?? ""} onChange={set("ciudad")} placeholder="Ciudad" style={input} /></div>
            <div><div style={label}>Profesión / rol</div><input value={p.profesion ?? ""} onChange={set("profesion")} placeholder="Ej: Ingeniero civil, veedor ciudadano" style={input} /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={label}>Sobre mí</div>
              <textarea value={p.sobre_mi ?? ""} onChange={set("sobre_mi")} placeholder="Cuéntanos en qué te interesa vigilar o contratar (opcional)" rows={3} style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={guardar} disabled={guardando} style={{ border: "none", background: T.ink, color: T.surface, fontSize: 14, fontWeight: 600, padding: "12px 22px", borderRadius: 9, cursor: "pointer", opacity: guardando ? 0.7 : 1 }}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <span style={{ fontSize: 12.5, color: T.faint }}>Puedes dejar campos vacíos; nada es obligatorio.</span>
      </div>
    </main>
  );
}
