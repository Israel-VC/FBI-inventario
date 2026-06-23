import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LOGO_FBI } from "../lib/logo";

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
          <div style={estilos.fondoLogo}>
            <img src={LOGO_FBI} alt="FBI Central de Alarmas" style={estilos.logo} />
          </div>
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

        <div style={estilos.pie}>¿No tienes cuenta? Pídele al administrador que te cree un usuario.</div>
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
    background: "#F4F5F6",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
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
  marca: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 28 },
  fondoLogo: {
    background: "#14181C",
    borderRadius: 12,
    padding: "16px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 180, height: "auto", objectFit: "contain", display: "block" },
  marcaTitulo: { fontSize: 14, fontWeight: 700, color: "#14181C", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.3 },
  marcaSub: { fontSize: 12.5, color: "#6B7280" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  campo: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12.5, color: "#6B7280", fontWeight: 500 },
  input: {
    background: "#F4F5F6",
    border: "1px solid #D9DCE1",
    borderRadius: 9,
    padding: "11px 13px",
    color: "#14181C",
    fontSize: 14,
    outline: "none",
    width: "100%",
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
    marginTop: 4,
  },
  pie: { fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 22 },
};
