"""LupIA — UI (Streamlit). Esqueleto inicial para Persona 2.

Correr:  streamlit run ui/app.py
La UI habla con la API (api/main.py) via HTTP. URL configurable con API_URL.
"""
import os

import requests
import streamlit as st

API_URL = os.getenv("API_URL", "http://localhost:8010")

st.set_page_config(page_title="LupIA — Monitor de la reconstrucción", page_icon="🔍",
                   layout="wide")

st.title("🔍 LupIA — Monitor de la reconstrucción")
st.caption(
    "LupIA no acusa. Señala lo que merece una mirada, con datos oficiales de datos.gov.co. "
    "Verifica siempre en la fuente (SECOP)."
)


def api_get(ruta: str, **params):
    try:
        r = requests.get(f"{API_URL}{ruta}", params=params, timeout=60)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        st.error(f"No pude hablar con la API ({API_URL}): {e}")
        return None


# --- resumen por departamento ---
resumen = api_get("/resumen") or []
if resumen:
    cols = st.columns(len(resumen))
    for col, fila in zip(cols, resumen):
        with col:
            st.metric(
                fila["departamento"],
                f"${(fila['total'] or 0)/1e9:,.1f} mil M",
                f"{fila['contratos']} contratos · {fila['alertas']} señales",
            )

st.divider()

# --- feed de alertas ---
departamentos = [f["departamento"] for f in resumen]
filtro = st.selectbox("Departamento", ["Todos"] + departamentos)
alertas = api_get("/alertas", **({"departamento": filtro} if filtro != "Todos" else {})) or []

st.subheader(f"Señales que ameritan revisión ({len(alertas)})")
for a in alertas:
    with st.container(border=True):
        c1, c2 = st.columns([5, 1])
        with c1:
            st.markdown(f"**{a['nombre_entidad']}** · {a['departamento']} · {a['ciudad'] or ''}")
            st.write((a["descripcion_del_proceso"] or "")[:300])
            st.markdown(f"🔎 **Señal: {a['senal']}** — {a['detalle']}")
            if a.get("urlproceso"):
                st.markdown(f"[Ver contrato original en SECOP]({a['urlproceso']})")
        with c2:
            st.metric("Score", a["score"])
            st.caption(f"${(a['valor_del_contrato'] or 0):,.0f}")
