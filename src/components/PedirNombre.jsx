import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LOGO_FBI } from "../lib/logo";

export default function PedirNombre({ sesion, onListo }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCargando(true);
    setError("");
    const { error } = await supabase.from("perfiles").insert({ id: sesion.user.id, nombre: nombre.trim() });
    setCargando(false);
    if (error) {
      setError("No se pudo guardar tu nombre. Intenta de nuevo.");
    } else {
      onListo(nombre.trim());
    }
  }

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.tarjeta}>
        <div style={estilos.fondoLogo}>
          <img src={LOGO_FBI} alt="FBI Central de Alarmas" style={estilos.logo} />
        </div>

        <div style={estilos.titulo}>¿Cómo te llamas?</div>
        <div style={estilos.subtitulo}>Así aparecerá tu nombre en los movimientos e instalaciones que registres.</div>

        <form onSubmit={guardar} style={estilos.form}>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={estilos.input}
            placeholder="Ej: Juan Pérez"
            autoFocus
            required
          />
          {error && <div style={estilos.error}>{error}</div>}
          <button type="submit" disabled={cargando} style={estilos.boton}>
            {cargando ? "Guardando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const estilos = {
  contenedor: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "#F4F5F6",
  },
  tarjeta: {
    width: "100%",
    maxWidth: 380,
    background: "#FFFFFF",
    border: "1px solid #D9DCE1",
    borderRadius: 16,
    padding: "32px 28px",
    boxShadow: "0 12px 32px rgba(20,24,28,0.08)",
  },
  fondoLogo: {
    background: "#14181C",
    borderRadius: 12,
    padding: "16px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logo: { width: 160, height: "auto", objectFit: "contain", display: "block" },
  titulo: { fontSize: 15, fontWeight: 700, color: "#14181C", textAlign: "center", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  subtitulo: { fontSize: 12.5, color: "#6B7280", textAlign: "center", marginBottom: 24, lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  input: {
    background: "#F4F5F6",
    border: "1px solid #D9DCE1",
    borderRadius: 9,
    padding: "11px 13px",
    color: "#14181C",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: { fontSize: 12.5, color: "#C0392B", background: "rgba(192,57,43,0.08)", padding: "9px 12px", borderRadius: 8 },
  boton: {
    background: "#C8902F",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 9,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};
