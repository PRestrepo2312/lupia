"use client";
import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { auth, ApiError, Usuario } from "@/lib/api";

declare global { interface Window { google?: any } }

const MOTIVOS: Record<string, string> = {
  default: "Consultar el monitor, el mapa y el chat no pide cuenta. El correo es solo para alertas y trazabilidad.",
  alertas: "Para mandarte las alertas necesitamos un correo. Nada más: sin datos personales.",
  traza: "La trazabilidad de un contrato queda ligada a tu cuenta, para poder avisarte cuando cambie.",
};

const GOOGLE_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

interface Props {
  motivo: string | null;
  onClose: () => void;
  onEntrar: (token: string, usuario: Usuario, msg: string) => void;
}

export function LoginModal({ motivo, onClose, onEntrar }: Props) {
  const [paso, setPaso] = useState<"login" | "codigo" | "reset" | "resetCodigo" | "resetOk">("login");
  const [metodo, setMetodo] = useState<"codigo" | "clave">("codigo");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modoDev, setModoDev] = useState(false);
  const [ofrecerRegistro, setOfrecerRegistro] = useState(false);
  const googleRef = useRef<HTMLDivElement | null>(null);

  const input: React.CSSProperties = { border: "1px solid #d8d3c7", background: T.surface, borderRadius: 9, padding: "12px 14px", fontSize: 14.5, color: T.ink2 };
  const primario: React.CSSProperties = { border: "none", background: T.ink, color: T.surface, fontSize: 14.5, fontWeight: 600, padding: 14, borderRadius: 9, cursor: "pointer", width: "100%", opacity: cargando ? 0.7 : 1 };

  const fallo = (e: unknown) => {
    setError(e instanceof ApiError ? e.message : "No pude hablar con el servidor. ¿Está corriendo la API?");
    setCargando(false);
  };
  const correr = async (fn: () => Promise<void>) => {
    setError(null); setCargando(true);
    try { await fn(); } catch (e) { fallo(e); return; }
    setCargando(false);
  };

  // --- Boton oficial de Google (Google Identity Services) ---
  useEffect(() => {
    if (!GOOGLE_ID || paso !== "login") return;
    const montar = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const r = await auth.google(resp.credential);
            onEntrar(r.token, r.usuario, `Entraste con Google como ${r.usuario.correo}`);
          } catch (e) { fallo(e); }
        },
      });
      googleRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleRef.current, { type: "standard", text: "signin_with", locale: "es", width: 336 });
    };
    if (window.google) { montar(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = montar;
    document.head.appendChild(s);
  }, [paso]);

  // --- flujos ---
  const pedirCodigo = () => correr(async () => {
    const r = await auth.solicitarCodigo(correo);
    setModoDev(!!r.modo_dev);
    setCodigo(r.modo_dev ? r.codigo : "");
    setPaso("codigo");
  });

  const verificarCodigo = () => correr(async () => {
    const r = await auth.verificarCodigo(correo, codigo);
    onEntrar(r.token, r.usuario, "Sesión iniciada con código");
  });

  const entrarConClave = () => correr(async () => {
    try {
      const r = await auth.ingreso(correo, clave);
      onEntrar(r.token, r.usuario, "Sesión iniciada");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setOfrecerRegistro(true); throw e; }
      throw e;
    }
  });

  const crearCuenta = () => correr(async () => {
    const r = await auth.registro(correo, clave);
    onEntrar(r.token, r.usuario, "Cuenta creada, bienvenida/o a LupIA");
  });

  const pedirReset = () => correr(async () => {
    const r = await auth.restablecer(correo);
    setModoDev(!!r.modo_dev);
    setCodigo(r.modo_dev ? r.codigo : "");
    setPaso("resetCodigo");
  });

  const confirmarReset = () => correr(async () => {
    await auth.confirmarRestablecer(correo, codigo, nuevaClave);
    setPaso("resetOk");
  });

  const notaDev = modoDev && (
    <div style={{ fontSize: 12, color: T.medio, lineHeight: 1.5, background: "#faf4ea", border: "1px solid #eadfd2", borderRadius: 8, padding: "9px 12px" }}>
      Modo desarrollo: sin BREVO_API_KEY el código llega aquí (ya lo puse en la casilla). Con la llave, viaja solo por correo.
    </div>
  );
  const errorBox = error && (
    <div style={{ fontSize: 12.5, color: T.alto, lineHeight: 1.5, background: "#fbeee9", border: "1px solid #ecd5cc", borderRadius: 8, padding: "9px 12px" }}>{error}</div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(27,26,23,.5)", zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, borderRadius: 16, overflow: "hidden", maxWidth: 840, width: "100%", margin: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", animation: "lupFade .2s ease both" }}>
        <div style={{ background: T.ink, color: T.bg, padding: 32, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${T.bg}`, position: "relative" }}>
              <div style={{ position: "absolute", width: 2.5, height: 12, background: T.bg, bottom: -10, right: 0, transform: "rotate(-40deg)", transformOrigin: "top" }} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>LupIA</div>
          </div>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", color: "#c98a6b", marginBottom: 16 }}>CONTRATACIÓN PÚBLICA · FOCO ACTIVO: SISMO 10 AGO 2026</div>
            <div style={{ fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.03em", fontWeight: 700, marginBottom: 12 }}>El monitor es abierto. La cuenta es para lo tuyo.</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#a8a49a" }}>El correo solo se usa para guardar tus territorios, mandarte alertas y mostrarte la trazabilidad de cada contrato.</div>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: "#77736a", lineHeight: 1.7 }}>DATOS: SECOP II · DATOS.GOV.CO<br />CÓDIGOS DE UN SOLO USO · SESIÓN JWT</div>
        </div>

        <div style={{ padding: 32, display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
            {paso === "login" && (
              <div>
                <h1 style={{ fontSize: 25, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 700 }}>Entrar a LupIA</h1>
                <p style={{ margin: "0 0 18px", fontSize: 14, color: T.muted, lineHeight: 1.55 }}>{MOTIVOS[motivo || "default"]}</p>
                <div style={{ display: "flex", gap: 4, background: "#eae7de", borderRadius: 9, padding: 4, marginBottom: 18 }}>
                  {(["codigo", "clave"] as const).map((m) => (
                    <button key={m} onClick={() => { setMetodo(m); setError(null); setOfrecerRegistro(false); }} style={{ flex: 1, border: "none", background: metodo === m ? T.surface : "transparent", color: metodo === m ? T.ink : T.muted, fontSize: 13, fontWeight: metodo === m ? 600 : 500, padding: 9, borderRadius: 6, cursor: "pointer" }}>
                      {m === "codigo" ? "Código al correo" : "Contraseña"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>CORREO</div>
                    <input value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" type="email" autoFocus style={{ ...input, width: "100%" }} />
                  </div>
                  {metodo === "codigo" ? (
                    <>
                      {errorBox}
                      <button onClick={pedirCodigo} disabled={cargando || !correo.includes("@")} style={primario}>{cargando ? "Enviando…" : "Enviarme un código"}</button>
                      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>Sin contraseña: te llega un código de 6 dígitos y entras. Si es tu primera vez, la cuenta se crea sola.</div>
                    </>
                  ) : (
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>CONTRASEÑA</div>
                        <button onClick={() => { setPaso("reset"); setError(null); }} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 12, color: T.ia, cursor: "pointer", padding: 0 }}>Restablecer</button>
                      </div>
                      <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrarConClave()} placeholder="mínimo 8 caracteres" style={{ ...input, width: "100%", marginBottom: 12 }} />
                      {errorBox}
                      {ofrecerRegistro && (
                        <button onClick={crearCuenta} disabled={cargando || clave.length < 8} style={{ width: "100%", border: `1px solid ${T.ia}`, background: T.surface, color: T.ia, fontSize: 13.5, fontWeight: 600, padding: 12, borderRadius: 9, cursor: "pointer", marginBottom: 10 }}>
                        ¿Primera vez? Crear cuenta con estos datos
                        </button>
                      )}
                      <button onClick={entrarConClave} disabled={cargando || !correo.includes("@") || !clave} style={primario}>{cargando ? "Verificando…" : "Entrar"}</button>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
                    <div style={{ height: 1, background: T.line, flex: 1 }} /><div style={{ fontFamily: T.mono, fontSize: 10, color: T.faint }}>O</div><div style={{ height: 1, background: T.line, flex: 1 }} />
                  </div>
                  {GOOGLE_ID ? (
                    <div ref={googleRef} style={{ display: "flex", justifyContent: "center", minHeight: 40 }} />
                  ) : (
                    <div style={{ border: "1px dashed #d8d3c7", color: T.faint, fontSize: 12.5, padding: 12, borderRadius: 9, textAlign: "center" }}>
                      Google SSO: falta NEXT_PUBLIC_GOOGLE_CLIENT_ID en ui/.env.local
                    </div>
                  )}
                </div>
              </div>
            )}

            {paso === "codigo" && (
              <div style={{ animation: "lupFade .25s ease both" }}>
                <button onClick={() => { setPaso("login"); setError(null); }} style={{ border: "none", background: "none", color: T.muted, fontSize: 13, padding: 0, marginBottom: 18, cursor: "pointer" }}>← Volver</button>
                <h1 style={{ fontSize: 25, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 700 }}>Código de verificación</h1>
                <p style={{ margin: "0 0 18px", fontSize: 14, color: T.muted, lineHeight: 1.55 }}>Enviamos un código de 6 dígitos a <strong>{correo}</strong>. Vence en 10 minutos.</p>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && verificarCodigo()} placeholder="······" inputMode="numeric" autoFocus
                  style={{ ...input, width: "100%", marginBottom: 14, fontFamily: T.mono, fontSize: 26, letterSpacing: "0.55em", textAlign: "center" }} />
                {notaDev}
                {errorBox}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  <button onClick={verificarCodigo} disabled={cargando || codigo.length !== 6} style={primario}>{cargando ? "Verificando…" : "Verificar y entrar"}</button>
                  <button onClick={pedirCodigo} disabled={cargando} style={{ border: "1px solid #d8d3c7", background: T.surface, color: T.ink2, fontSize: 13.5, padding: 12, borderRadius: 9, cursor: "pointer" }}>Reenviar código</button>
                </div>
              </div>
            )}

            {paso === "reset" && (
              <div style={{ animation: "lupFade .25s ease both" }}>
                <button onClick={() => { setPaso("login"); setError(null); }} style={{ border: "none", background: "none", color: T.muted, fontSize: 13, padding: 0, marginBottom: 18, cursor: "pointer" }}>← Volver a entrar</button>
                <h1 style={{ fontSize: 25, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 700 }}>Restablecer contraseña</h1>
                <p style={{ margin: "0 0 22px", fontSize: 14, color: T.muted, lineHeight: 1.55 }}>Te mandamos un código de un solo uso para crear una nueva.</p>
                <input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" placeholder="tucorreo@ejemplo.com" style={{ ...input, width: "100%", marginBottom: 12 }} />
                {errorBox}
                <button onClick={pedirReset} disabled={cargando || !correo.includes("@")} style={primario}>{cargando ? "Enviando…" : "Enviar código"}</button>
              </div>
            )}

            {paso === "resetCodigo" && (
              <div style={{ animation: "lupFade .25s ease both" }}>
                <button onClick={() => { setPaso("reset"); setError(null); }} style={{ border: "none", background: "none", color: T.muted, fontSize: 13, padding: 0, marginBottom: 18, cursor: "pointer" }}>← Volver</button>
                <h1 style={{ fontSize: 25, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 700 }}>Crea tu nueva contraseña</h1>
                <p style={{ margin: "0 0 18px", fontSize: 14, color: T.muted, lineHeight: 1.55 }}>Escribe el código que llegó a <strong>{correo}</strong> y tu nueva contraseña.</p>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" inputMode="numeric"
                  style={{ ...input, width: "100%", marginBottom: 10, fontFamily: T.mono, letterSpacing: "0.35em", textAlign: "center" }} />
                <input type="password" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} placeholder="Nueva contraseña (mínimo 8)" style={{ ...input, width: "100%", marginBottom: 12 }} />
                {notaDev}
                {errorBox}
                <button onClick={confirmarReset} disabled={cargando || codigo.length !== 6 || nuevaClave.length < 8} style={{ ...primario, marginTop: 10 }}>{cargando ? "Guardando…" : "Cambiar contraseña"}</button>
              </div>
            )}

            {paso === "resetOk" && (
              <div style={{ animation: "lupFade .25s ease both" }}>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.bajo, letterSpacing: "0.06em", marginBottom: 12 }}>CONTRASEÑA ACTUALIZADA</div>
                <h1 style={{ fontSize: 25, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 700 }}>Listo</h1>
                <p style={{ margin: "0 0 20px", fontSize: 14, color: T.muted, lineHeight: 1.55 }}>Tu contraseña quedó cambiada. Entra con la nueva.</p>
                <button onClick={() => { setPaso("login"); setMetodo("clave"); setClave(""); setError(null); }} style={primario}>Volver a entrar</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
