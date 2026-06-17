import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./components/Login";
import InventarioAlarmas from "./components/InventarioAlarmas";

export default function App() {
  const [sesion, setSesion] = useState(undefined); // undefined = cargando, null = sin sesión, objeto = logueado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (sesion === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9BA0A8", fontSize: 13.5 }}>
        Cargando...
      </div>
    );
  }

  if (!sesion) {
    return <Login />;
  }

  return <InventarioAlarmas sesion={sesion} />;
}
