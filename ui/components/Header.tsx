"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { T } from "@/lib/theme";
import { useAuth } from "./AuthProvider";
import { lupia } from "@/lib/api";

const LINKS = [["/", "Monitor"], ["/mapa", "Mapa"], ["/empresa", "Empresa"], ["/metodologia", "Metodología"]];

export function Header() {
  const path = usePathname();
  const { auth, usuario, pedir, salir } = useAuth();
  const [estado, setEstado] = useState<{ contratos: number; base: string } | null | undefined>(undefined);

  useEffect(() => {
    lupia.salud().then((s) => setEstado({ contratos: s.contratos, base: s.base })).catch(() => setEstado(null));
  }, []);

  const iniciales = usuario ? usuario.correo.slice(0, 2).toUpperCase() : "";

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: T.surface, borderBottom: `1px solid ${T.line}` }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${T.ink}`, position: "relative" }}>
            <div style={{ position: "absolute", width: 2.5, height: 11, background: T.ink, bottom: -9, right: 0, transform: "rotate(-40deg)", transformOrigin: "top" }} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>LupIA</div>
          {estado === undefined ? null : estado ? (
            <div title={`Base: ${estado.base}`} style={{ fontFamily: T.mono, fontSize: 10, color: T.bajo, border: "1px solid #cfdcd4", background: "#f2f6f3", borderRadius: 99, padding: "3px 8px", marginLeft: 4, whiteSpace: "nowrap" }}>
              ● DATOS REALES · SECOP II · {estado.contratos.toLocaleString("es-CO")} CONTRATOS
            </div>
          ) : (
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 99, padding: "3px 8px", marginLeft: 4, whiteSpace: "nowrap" }}>
              MODO DEMO · SIN BACKEND
            </div>
          )}
        </div>
        <nav style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          {LINKS.map(([href, label]) => {
            const on = path === href;
            return (
              <Link key={href} href={href} style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, padding: "8px 14px", borderRadius: 8, color: on ? T.ink : T.muted, background: on ? "#f0ece2" : "transparent" }}>{label}</Link>
            );
          })}
        </nav>
        <button onClick={() => pedir("alertas")} style={{ border: `1px solid ${T.ink}`, background: T.ink, color: T.surface, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}>Recibir alertas</button>
        {auth && usuario ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 14, borderLeft: `1px solid ${T.line}` }}>
            <div title={usuario.correo} style={{ width: 29, height: 29, borderRadius: "50%", background: T.surfaceAlt, border: "1px solid #d8d3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: T.ink2 }}>{iniciales}</div>
            <button onClick={salir} style={{ border: "none", background: "none", color: T.muted, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Salir</button>
          </div>
        ) : (
          <button onClick={() => pedir(null)} style={{ border: "none", background: "none", color: T.muted, fontSize: 13, fontWeight: 500, padding: "9px 4px 9px 14px", borderLeft: `1px solid ${T.line}`, cursor: "pointer" }}>Entrar</button>
        )}
      </div>
    </header>
  );
}
