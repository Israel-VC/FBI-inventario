import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./components/Login";
import PedirNombre from "./components/PedirNombre";
import InventarioAlarmas from "./components/InventarioAlarmas";

export default function App() {
  const [sesion, setSesion] = useState(undefined); // undefined = cargando, null = sin sesión, objeto = logueado
  const [perfil, setPerfil] = useState(undefined); // undefined = sin revisar, null = no tiene nombre, objeto = tiene nombre

  const revisarPerfil = useCallback(async (sesionActual) => {
    if (!sesionActual) {
      setPerfil(null);
      return;
    }
    const { data } = await supabase.from("perfiles").select("*").eq("id", sesionActual.user.id).maybeSingle();
    setPerfil(data || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      revisarPerfil(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      revisarPerfil(session);
    });

    return () => listener.subscription.unsubscribe();
  }, [revisarPerfil]);

  if (sesion === undefined || (sesion && perfil === undefined)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9BA0A8", fontSize: 13.5 }}>
        Cargando...
      </div>
    );
  }

  if (!sesion) {
    return <Login />;
  }

  if (!perfil) {
    return <PedirNombre sesion={sesion} onListo={(nombre) => setPerfil({ nombre })} />;
  }

  return <InventarioAlarmas sesion={sesion} perfil={perfil} />;
}
