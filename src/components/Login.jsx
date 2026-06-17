import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ShieldCheck } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) {
      setError("Usuario o contraseña incorrectos. Verificá los datos e intentá de nuevo.");
    }
  }

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.tarjeta}>
        <div style={estilos.marca}>
          <div style={estilos.icono}>
            <ShieldCheck size={22} color="#D97706" strokeWidth={2} />
          </div>
          <div style={estilos.marcaTitulo}>FBI Central de Alarmas</div>
          <div style={estilos.marcaSub}>Sistema de inventario</div>
        </div>

        <form onSubmit={iniciarSesion} style={estilos.form}>
          <div style={estilos.campo}>
            <label style={estilos.label}>Usuario</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={estilos.input}
              placeholder="tu correo"
              required
              autoFocus
            />
          </div>
          <div style={estilos.campo}>
            <label style={estilos.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={estilos.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div style={estilos.error}>{error}</div>}

          <button type="submit" disabled={cargando} style={estilos.boton}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div style={estilos.pie}>¿No tenés cuenta? Pedile al administrador que te cree un usuario.</div>
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
  },
  tarjeta: {
    width: "100%",
    maxWidth: 380,
    background: "#1C1F23",
    border: "1px solid #2D3036",
    borderRadius: 16,
    padding: "32px 28px",
  },
  marca: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 28 },
  icono: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "rgba(217,119,6,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  marcaTitulo: { fontSize: 17, fontWeight: 600, color: "#EDEEF0", textAlign: "center" },
  marcaSub: { fontSize: 12.5, color: "#9BA0A8" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  campo: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12.5, color: "#9BA0A8", fontWeight: 500 },
  input: {
    background: "#23262B",
    border: "1px solid #2D3036",
    borderRadius: 9,
    padding: "11px 13px",
    color: "#EDEEF0",
    fontSize: 14,
    outline: "none",
    width: "100%",
  },
  error: { fontSize: 12.5, color: "#E24B4A", background: "rgba(226,75,74,0.1)", padding: "9px 12px", borderRadius: 8 },
  boton: {
    background: "#D97706",
    color: "#1A1300",
    border: "none",
    borderRadius: 9,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  pie: { fontSize: 12, color: "#6B7077", textAlign: "center", marginTop: 22 },
};
