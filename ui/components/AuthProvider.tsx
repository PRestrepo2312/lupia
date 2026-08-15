"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { LoginModal } from "./LoginModal";
import { AlertasPanel } from "./AlertasPanel";
import { Usuario, guardarSesion, limpiarSesion, sesionGuardada } from "@/lib/api";

type Pendiente = "alertas" | "traza" | null;
interface Ctx {
  auth: boolean;
  usuario: Usuario | null;
  pedir: (p: Pendiente) => void;
  salir: () => void;
  toast: (t: string) => void;
  alertasAbiertas: boolean;
  cerrarAlertas: () => void;
}
const AuthCtx = createContext<Ctx>({} as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [login, setLogin] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente>(null);
  const [alertas, setAlertas] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Restaurar sesion guardada (JWT en localStorage)
  useEffect(() => {
    const s = sesionGuardada();
    if (s) setUsuario(s.usuario);
  }, []);

  const toast = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2600); };
  const correr = (p: Pendiente) => { if (p === "alertas") setAlertas(true); if (p === "traza") toast("Trazabilidad desbloqueada"); };
  const pedir = (p: Pendiente) => { if (usuario) return correr(p); setPendiente(p); setLogin(true); };
  const salir = () => { limpiarSesion(); setUsuario(null); toast("Sesión cerrada. El monitor sigue abierto."); };

  return (
    <AuthCtx.Provider value={{ auth: !!usuario, usuario, pedir, salir, toast, alertasAbiertas: alertas, cerrarAlertas: () => setAlertas(false) }}>
      {children}
      {login && (
        <LoginModal
          motivo={pendiente}
          onClose={() => { setLogin(false); setPendiente(null); }}
          onEntrar={(token, u, m) => {
            guardarSesion(token, u);
            setUsuario(u);
            setLogin(false);
            toast(m);
            const p = pendiente; setPendiente(null); setTimeout(() => correr(p), 250);
          }}
        />
      )}
      {alertas && usuario && <AlertasPanel usuario={usuario} onClose={() => setAlertas(false)} onToast={toast} />}
      {msg && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1b1a17", color: "#fffefb", padding: "13px 20px", borderRadius: 99, fontSize: 13.5, zIndex: 90, animation: "lupFade .2s ease both" }}>{msg}</div>
      )}
    </AuthCtx.Provider>
  );
}
