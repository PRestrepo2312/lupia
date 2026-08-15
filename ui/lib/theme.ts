export const T = {
  bg: "#f5f4ef",
  surface: "#fffefb",
  surfaceAlt: "#efeee8",
  line: "#e2ded4",
  lineSoft: "#eee9de",
  ink: "#1b1a17",
  ink2: "#413e38",
  muted: "#6b675f",
  faint: "#8a857b",
  ia: "#2f5d78",
  alto: "#b4442f",
  medio: "#a8761f",
  bajo: "#4a7a63",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  sans: "Archivo, Helvetica, Arial, sans-serif",
};

export const riesgo = (n: number) => (n >= 70 ? T.alto : n >= 40 ? T.medio : T.bajo);
export const nivelLabel = (n: number) => (n >= 70 ? "RIESGO ALTO" : n >= 40 ? "REVISAR" : "SIN SEÑALES");
export const fmtM = (v: number) => "$" + Math.round(v).toLocaleString("es-CO") + " M";
