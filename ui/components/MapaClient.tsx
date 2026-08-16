"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { Contrato } from "@/lib/types";
import { getContratos } from "@/lib/api";
import { T, fmtM, riesgo, nivelLabel } from "@/lib/theme";

const W = 860, H = 640;
const ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface Props {
  // Modo embebido (dentro del Monitor): los filtros vienen de afuera y se abre el analisis
  cat?: string;
  dep?: string;
  onVerAnalisis?: (id: string) => void;
}

export function MapaClient({ cat: catProp, dep: depProp, onVerAnalisis }: Props) {
  const embebido = catProp !== undefined;
  const [data, setData] = useState<Contrato[]>([]);
  const [catLocal, setCatLocal] = useState("Todas");
  const [depLocal, setDepLocal] = useState("Todos");
  const cat = catProp ?? catLocal;
  const dep = depProp ?? depLocal;
  const categorias = useMemo(() => Array.from(new Set(data.map((c) => c.cat).filter(Boolean))).sort(), [data]);
  const [orden, setOrden] = useState<"riesgo" | "valor" | "fecha">("riesgo");
  const [sel, setSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { getContratos().then(setData); }, []);

  const depOk = (d: string) => dep === "Todos" || !dep || d === dep || norm(d).includes(norm(dep));
  const pasa = (c: Contrato) => (cat === "Todas" || c.cat === cat) && depOk(c.dept);

  const projection = useMemo(() => d3.geoMercator().fitSize([W, H], { type: "MultiPoint", coordinates: [[-80.5, -4.6], [-66.2, 13.2]] } as any), []);
  const rS = useMemo(() => d3.scaleSqrt().domain([0, 12500]).range([9, 22]), []);

  // base map (una vez)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#dde3e5");
    const scene = svg.append("g").attr("class", "scene");
    const path = d3.geoPath(projection);
    const gLand = scene.append("g"), gGrat = scene.append("g"), gCtx = scene.append("g");
    scene.append("g").attr("class", "pts");
    gGrat.append("path").datum(d3.geoGraticule().step([2, 2])() as any)
      .attr("d", path as any).attr("fill", "none").attr("stroke", "#c6ccce").attr("stroke-width", .5);

    d3.json<any>(ATLAS).then((topo) => {
      if (!topo) return;
      const feats = (topojson.feature(topo, topo.objects.countries) as any).features;
      gLand.selectAll("path.c").data(feats).join("path").attr("class", "c").attr("d", path as any)
        .attr("fill", (f: any) => (f.properties.name === "Colombia" ? "#f2f0e8" : "#e8e5dc"))
        .attr("stroke", "#c2bcae").attr("stroke-width", .8);
      gLand.selectAll("path.hi").data(feats.filter((f: any) => f.properties.name === "Colombia"))
        .join("path").attr("class", "hi").attr("d", path as any)
        .attr("fill", "none").attr("stroke", T.ink).attr("stroke-width", 1.4).attr("stroke-opacity", .5);
      gCtx.selectAll("text").data([
        { t: "PANAMÁ", lon: -80.3, lat: 8.6 }, { t: "VENEZUELA", lon: -68.5, lat: 8.2 },
        { t: "BRASIL", lon: -68.5, lat: -1.6 }, { t: "PERÚ", lon: -74.5, lat: -3.6 },
        { t: "ECUADOR", lon: -78.6, lat: -1.2 }, { t: "MAR CARIBE", lon: -75.5, lat: 12.4 },
        { t: "OCÉANO PACÍFICO", lon: -79.6, lat: 3.4 },
      ]).join("text")
        .attr("transform", (c: any) => { const p = projection([c.lon, c.lat])!; return `translate(${p[0]},${p[1]})`; })
        .text((c: any) => c.t).attr("text-anchor", "middle")
        .attr("font-family", T.mono).attr("font-size", 9).attr("letter-spacing", 1.3).attr("fill", T.faint);
      scene.select("g.pts").raise();
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 10]).on("zoom", (e) => {
      scene.attr("transform", e.transform.toString());
      const k = e.transform.k;
      gGrat.select("path").attr("stroke-width", .5 / k);
      gCtx.selectAll("text").attr("font-size", 9 / k);
      scene.selectAll<SVGGElement, Contrato>("g.pt").attr("transform", (c) => {
        const p = projection([c.lon, c.lat])!;
        return `translate(${p[0]},${p[1]}) scale(${1 / k})`;
      });
    });
    svg.call(zoom);
    (svgRef.current as any).__zoom__ = zoom;
  }, [projection]);

  // acercarse suavemente a un contrato (click en punto o en la lista)
  const irA = (c: Contrato, k = 4.5) => {
    const zoom = (svgRef.current as any)?.__zoom__;
    if (!zoom || !svgRef.current) return;
    const p = projection([c.lon, c.lat])!;
    const actual = d3.zoomTransform(svgRef.current).k;
    const escala = Math.max(actual, k);
    d3.select(svgRef.current).transition().duration(650).ease(d3.easeCubicOut)
      .call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(escala).translate(-p[0], -p[1]));
  };

  const elegir = (c: Contrato) => { setSel(c.id); irA(c); };

  // puntos
  useEffect(() => {
    if (!svgRef.current) return;
    const pts = d3.select(svgRef.current).select("g.pts");
    const vis = data.filter(pasa);
    const k = d3.zoomTransform(svgRef.current).k || 1;
    const g = pts.selectAll<SVGGElement, Contrato>("g.pt").data(vis, (c: any) => c.id)
      .join((enter) => {
        const gg = enter.append("g").attr("class", "pt").style("cursor", "pointer");
        gg.append("circle").attr("class", "body").attr("stroke", "#f2f0e8").attr("stroke-width", 1.6);
        gg.append("text").attr("class", "sc").attr("text-anchor", "middle").attr("y", 4)
          .attr("font-family", T.mono).attr("font-size", 11).attr("fill", T.surface).style("pointer-events", "none");
        return gg;
      });
    g.attr("transform", (c) => { const p = projection([c.lon, c.lat])!; return `translate(${p[0]},${p[1]}) scale(${1 / k})`; })
      .on("click", (_e, c) => elegir(c))
      .on("mousemove", (e: MouseEvent, c) => {
        const tip = tipRef.current, wrap = wrapRef.current;
        if (!tip || !wrap) return;
        const b = wrap.getBoundingClientRect();
        tip.style.opacity = "1";
        tip.innerHTML = `<b>${c.objeto}</b><br>${c.entidad} · ${c.ciudad}<br>${fmtM(c.valor)} · riesgo ${c.score}<br><span style="opacity:.75">clic para acercar y ver el análisis</span>`;
        tip.style.left = Math.min(e.clientX - b.left + 14, b.width - 262) + "px";
        tip.style.top = (e.clientY - b.top - 12) + "px";
      })
      .on("mouseleave", () => { if (tipRef.current) tipRef.current.style.opacity = "0"; });
    g.select("circle.body").attr("r", (c: any) => rS(c.valor)).attr("fill", (c: any) => riesgo(c.score))
      .attr("fill-opacity", .92).attr("stroke-width", (c: any) => (sel === c.id ? 2.6 : 1.6))
      .attr("stroke", (c: any) => (sel === c.id ? T.ink : "#f2f0e8"));
    g.select("text.sc").text((c: any) => c.score);
  }, [data, cat, dep, sel, projection, rS]);

  const zoomBy = (k: number) => {
    const svg = d3.select(svgRef.current!);
    const zoom = (svgRef.current as any).__zoom__;
    if (zoom) svg.transition().duration(280).call(zoom.scaleBy, k);
  };
  const reset = () => {
    const svg = d3.select(svgRef.current!);
    const zoom = (svgRef.current as any).__zoom__;
    if (zoom) svg.transition().duration(360).call(zoom.transform, d3.zoomIdentity);
    setSel(null);
  };

  const vis = data.filter(pasa);
  const ord = [...vis].sort((a, b) => orden === "valor" ? b.valor - a.valor : orden === "fecha" ? b.fecha.localeCompare(a.fecha) : b.score - a.score);
  const elegido = data.find((c) => c.id === sel);
  const btn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: "1px solid #d8d3c7", background: T.surface, color: T.ink2, fontSize: 15, cursor: "pointer" };

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: embebido ? "6px 28px 20px" : "30px 28px 60px" }}>
      {!embebido && (
        <>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", color: T.alto, marginBottom: 10 }}>MAPA NACIONAL · 33 DEPARTAMENTOS</div>
          <h1 style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.025em", margin: "0 0 10px", fontWeight: 700 }}>Cada punto es un contrato público georreferenciado</h1>
          <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.55, color: T.muted, maxWidth: 660 }}>Filtra por tipo de contrato de SECOP. El color es el nivel de riesgo del modelo; el tamaño, la cuantía.</p>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
            {["Todas", ...categorias].map((c) => {
              const on = cat === c;
              return <button key={c} onClick={() => setCatLocal(c)} style={{ border: `1px solid ${on ? T.ink : "#d8d3c7"}`, background: on ? T.ink : T.surface, color: on ? T.surface : T.ink2, fontSize: 12.5, fontWeight: 500, padding: "7px 13px", borderRadius: 99, cursor: "pointer" }}>{c === "Todas" ? "Todos los tipos" : c}</button>;
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        {!embebido && (
          <select value={dep} onChange={(e) => setDepLocal(e.target.value)} style={{ fontSize: 12.5, color: T.ink2, border: "1px solid #d8d3c7", background: T.surface, borderRadius: 99, padding: "7px 12px", cursor: "pointer" }}>
            {["Todos"].concat(Array.from(new Set(data.map((c) => c.dept))).sort()).map((d) => <option key={d} value={d}>{d === "Todos" ? "Todos los departamentos" : d}</option>)}
          </select>
        )}
        <select value={orden} onChange={(e) => setOrden(e.target.value as any)} style={{ fontSize: 12.5, color: T.ink2, border: "1px solid #d8d3c7", background: T.surface, borderRadius: 99, padding: "7px 12px", cursor: "pointer" }}>
          <option value="riesgo">Mayor riesgo</option><option value="valor">Mayor cuantía</option><option value="fecha">Más reciente</option>
        </select>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginLeft: 6 }}>
          {[["Alto (70+)", T.alto], ["Medio (40–69)", T.medio], ["Bajo (<40)", T.bajo]].map(([l, c]) => (
            <span key={l as string} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: c as string }} />{l}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", background: T.surface }}>
          <div ref={wrapRef} style={{ position: "relative", height: 640, overflow: "hidden" }}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <div ref={tipRef} style={{ position: "absolute", pointerEvents: "none", opacity: 0, transition: "opacity .12s", background: T.ink, color: T.bg, padding: "9px 12px", borderRadius: 9, fontSize: 12, lineHeight: 1.45, zIndex: 6, maxWidth: 250 }} />
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 4, background: "rgba(255,254,251,.94)", border: "1px solid #d8d3c7", borderRadius: 11, padding: "12px 15px", display: "flex", gap: 24, whiteSpace: "nowrap" }}>
              <div><div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>EN VISTA</div><div style={{ fontSize: 20, fontWeight: 700 }}>{vis.length}</div></div>
              <div><div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>VALOR</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmtM(vis.reduce((a, c) => a + c.valor, 0))}</div></div>
              <div><div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>RIESGO ALTO</div><div style={{ fontSize: 20, fontWeight: 700, color: T.alto }}>{vis.filter((c) => c.score >= 70).length}</div></div>
            </div>
            <div style={{ position: "absolute", top: 16, right: 16, zIndex: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              <button style={btn} onClick={() => zoomBy(1.7)} title="Acercar">+</button>
              <button style={btn} onClick={() => zoomBy(1 / 1.7)} title="Alejar">−</button>
              <button style={{ ...btn, fontSize: 12 }} onClick={reset} title="Ver todo el país">⤾</button>
            </div>
            <div style={{ position: "absolute", bottom: 14, left: 16, zIndex: 4, background: "rgba(255,254,251,.94)", border: "1px solid #d8d3c7", borderRadius: 11, padding: "8px 11px", fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>GEOMETRÍA: NATURAL EARTH · DATOS: SECOP II (DATOS.GOV.CO)</div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginBottom: 10 }}>{vis.length} CONTRATOS EN VISTA · DE {data.length}</div>
          <div className="lup-scroll" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: elegido ? 420 : 604, overflowY: "auto", paddingRight: 4 }}>
            {ord.map((c) => (
              <div key={c.id} onClick={() => elegir(c)} className="lup-card" style={{ background: T.surface, border: `1px solid ${sel === c.id ? T.ink : T.line}`, borderRadius: 11, padding: "12px 13px", cursor: "pointer", display: "grid", gridTemplateColumns: "34px 1fr", gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: riesgo(c.score), color: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 12.5 }}>{c.score}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{c.objeto}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{c.entidad} · {c.ciudad}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5 }}>{fmtM(c.valor)}</div>
                </div>
              </div>
            ))}
          </div>
          {elegido && (
            <div style={{ marginTop: 12, background: T.surface, border: `1px solid ${T.ink}`, borderRadius: 11, padding: "15px 16px", animation: "lupFade .25s ease both" }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>{elegido.cat.toUpperCase()} · {elegido.dept.toUpperCase()} · {nivelLabel(elegido.score)}</div>
              <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>{elegido.objeto}</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>{fmtM(elegido.valor)} · riesgo {elegido.score}{elegido.evento ? ` · ${elegido.evento}` : ""}</div>
              {onVerAnalisis ? (
                <button onClick={() => onVerAnalisis(elegido.id)}
                  style={{ width: "100%", border: "none", background: T.ia, color: T.surface, fontSize: 13.5, fontWeight: 600, padding: "11px 0", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Analizar con IA
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              ) : (
                <a href="/" style={{ fontSize: 13, fontWeight: 600 }}>Analizar con IA →</a>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
