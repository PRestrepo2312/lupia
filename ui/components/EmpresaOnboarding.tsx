"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { lupia } from "@/lib/api";

interface Props { onClose: () => void; onToast: (t: string) => void }

const INTERESES = [
  { id: "ejecutados", label: "Ver procesos que mi empresa ya ejecutó" },
  { id: "en_ejecucion", label: "Seguir los contratos que estoy ejecutando" },
  { id: "convocatorias", label: "Recibir convocatorias que calcen con mi perfil" },
];

export function EmpresaOnboarding({ onClose, onToast }: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState<"pregunta" | "datos" | "sinEmpresa">("pregunta");
  const [nit, setNit] = useState("");
  const [intereses, setIntereses] = useState<string[]>(["ejecutados", "convocatorias"]);
  const [cargando, setCargando] = useState(false);

  const alternar = (id: string) =>
    setIntereses((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const responderNo = async () => {
    try { await lupia.guardarPerfilEmpresa({ tiene_empresa: false, nit: null, intereses: [] }); } catch {}
    setPaso("sinEmpresa");
  };

  const guardar = async () => {
    setCargando(true);
    try {
      await lupia.guardarPerfilEmpresa({ tiene_empresa: true, nit: nit || null, intereses });
      onToast("Perfil de empresa guardado");
      onClose();
      router.push("/empresa");
    } catch {
      onToast("No pude guardar el perfil, intenta desde la pestaña Empresa");
      onClose();
    }
    setCargando(false);
  };

  const primario: React.CSSProperties = { border: "none", background: T.ink, color: T.surface, fontSize: 14, fontWeight: 600, padding: 13, borderRadius: 9, cursor: "pointer", width: "100%" };
  const secundario: React.CSSProperties = { border: "1px solid #d8d3c7", background: T.surface, color: T.ink, fontSize: 14, fontWeight: 600, padding: 13, borderRadius: 9, cursor: "pointer", width: "100%" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.5)", zIndex: 75, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
      <div style={{ background: T.bg, borderRadius: 16, maxWidth: 520, width: "100%", margin: "auto", overflow: "hidden", animation: "lupFade .2s ease both" }}>
        <div style={{ padding: "20px 26px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Bienvenida/o a LupIA</div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 18, color: T.muted, cursor: "pointer" }}>✕</button>
        </div>

        {paso === "pregunta" && (
          <div style={{ padding: "22px 26px" }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, marginBottom: 8 }}>¿Tienes una empresa que contrata (o quiere contratar) con el Estado?</div>
            <p style={{ margin: "0 0 18px", fontSize: 13.5, color: T.muted, lineHeight: 1.55 }}>Si es así, LupIA puede mapear los procesos que ya ejecutaste, los que estás ejecutando, y avisarte de convocatorias que calcen con tu perfil.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => setPaso("datos")} style={primario}>Sí, mapear mi empresa</button>
              <button onClick={responderNo} style={secundario}>No por ahora — soy ciudadana/o</button>
            </div>
          </div>
        )}

        {paso === "datos" && (
          <div style={{ padding: "22px 26px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>NIT DE TU EMPRESA (OPCIONAL)</div>
            <input value={nit} onChange={(e) => setNit(e.target.value.replace(/\D/g, ""))} placeholder="Solo números, sin dígito de verificación" inputMode="numeric"
              style={{ width: "100%", border: "1px solid #d8d3c7", background: T.surface, borderRadius: 9, padding: "12px 14px", fontSize: 14.5, fontFamily: T.mono, marginBottom: 6 }} />
            <div style={{ fontSize: 12, color: T.faint, lineHeight: 1.5, marginBottom: 16 }}>Con el NIT armamos tu perfil real desde SECOP II. Si no lo tienes a mano, lo agregas después.</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>¿QUÉ TE INTERESA?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {INTERESES.map((i) => (
                <label key={i.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, color: T.ink2, cursor: "pointer" }}>
                  <input type="checkbox" checked={intereses.includes(i.id)} onChange={() => alternar(i.id)} />
                  {i.label}
                </label>
              ))}
            </div>
            <button onClick={guardar} disabled={cargando} style={{ ...primario, opacity: cargando ? 0.7 : 1 }}>
              {cargando ? "Guardando…" : "Guardar e ir a Modo Empresa"}
            </button>
          </div>
        )}

        {paso === "sinEmpresa" && (
          <div style={{ padding: "22px 26px" }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 8 }}>Perfecto, el monitor es todo tuyo</div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
              Cuando quieras, puedes entrar a la pestaña <strong>Empresa</strong> para mapear una empresa
              o simplemente <strong>validar cualquier NIT</strong> y ver su historial de contratos en SECOP II.
            </p>
            <button onClick={onClose} style={primario}>Ir al monitor</button>
          </div>
        )}
      </div>
    </div>
  );
}
