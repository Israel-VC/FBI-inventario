import React, { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { Plus, X, Trash2, Edit2, Search, Wallet, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";

function formatoMoneda(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
}

function formatoFecha(f) {
  const d = new Date(f);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function nombrePeriodo(periodo) {
  // periodo viene como 'YYYY-MM'
  const [anio, mes] = periodo.split("-");
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${meses[Number(mes) - 1]} ${anio}`;
}

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export default function Cobranza({ sesion, clientes, onClientesActualizados }) {
  const [subvista, setSubvista] = useState("monitoreo"); // monitoreo | servicios
  const [cargosMonitoreo, setCargosMonitoreo] = useState([]);
  const [cargosServicio, setCargosServicio] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [generandoCargos, setGenerandoCargos] = useState(false);

  const [modalCliente, setModalCliente] = useState(null);
  const [modalServicio, setModalServicio] = useState(null);
  const [modalPago, setModalPago] = useState(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [{ data: cm, error: e1 }, { data: cs, error: e2 }, { data: pg, error: e3 }] = await Promise.all([
        supabase.from("cargos_monitoreo").select("*").order("periodo", { ascending: false }),
        supabase.from("cargos_servicio").select("*").order("creado_en", { ascending: false }),
        supabase.from("pagos").select("*").order("fecha", { ascending: false }),
      ]);
      if (e1 || e2 || e3) throw e1 || e2 || e3;
      setCargosMonitoreo(cm || []);
      setCargosServicio(cs || []);
      setPagos(pg || []);
    } catch (err) {
      setError("No se pudo cargar la información de cobranza.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const clientesOrdenados = useMemo(() => {
    return [...clientes].sort((a, b) => {
      const na = parseInt(a.numero_cliente, 10);
      const nb = parseInt(b.numero_cliente, 10);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
    });
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return clientesOrdenados.filter((c) => c.nombre.toLowerCase().includes(q) || (c.numero_cliente || "").includes(q));
  }, [clientesOrdenados, busqueda]);

  function nombreCliente(id) {
    const c = clientes.find((cl) => cl.id === id);
    return c ? `${c.numero_cliente ? c.numero_cliente + " — " : ""}${c.nombre}` : "Cliente eliminado";
  }

  function totalPagado(cargo, esMonitoreo) {
    return pagos
      .filter((p) => (esMonitoreo ? p.cargo_monitoreo_id === cargo.id : p.cargo_servicio_id === cargo.id))
      .reduce((acc, p) => acc + Number(p.monto), 0);
  }

  function saldoPendiente(cargo, esMonitoreo) {
    return Math.max(0, Number(cargo.monto) - totalPagado(cargo, esMonitoreo));
  }

  // Resumen de deuda total por cliente (para mostrar en cada tarjeta)
  const deudaPorCliente = useMemo(() => {
    const mapa = {};
    cargosMonitoreo.forEach((c) => {
      if (c.estado === "pagado") return;
      mapa[c.cliente_id] = (mapa[c.cliente_id] || 0) + saldoPendiente(c, true);
    });
    cargosServicio.forEach((c) => {
      if (c.estado === "pagado") return;
      mapa[c.cliente_id] = (mapa[c.cliente_id] || 0) + saldoPendiente(c, false);
    });
    return mapa;
  }, [cargosMonitoreo, cargosServicio, pagos]);

  async function generarCargosDelMes() {
    setGenerandoCargos(true);
    setError("");
    const { error } = await supabase.rpc("generar_cargos_mes_actual");
    setGenerandoCargos(false);
    if (error) {
      setError("No se pudieron generar los cargos del mes.");
    } else {
      cargarDatos();
    }
  }

  async function guardarDatosCliente(clienteId, datos) {
    const { error } = await supabase.from("clientes").update(datos).eq("id", clienteId);
    if (error) {
      setError("No se pudieron guardar los datos de cobranza del cliente.");
    } else {
      setModalCliente(null);
      onClientesActualizados();
    }
  }

  async function guardarCargoServicio(cargo) {
    const payload = {
      cliente_id: cargo.clienteId,
      concepto: cargo.concepto,
      monto: Number(cargo.monto) || 0,
      notas: cargo.notas || "",
      usuario_email: sesion.user.email,
    };
    if (cargo.id) {
      const { error } = await supabase.from("cargos_servicio").update(payload).eq("id", cargo.id);
      if (error) return setError("No se pudo actualizar el cargo.");
    } else {
      const { error } = await supabase.from("cargos_servicio").insert(payload);
      if (error) return setError("No se pudo crear el cargo.");
    }
    setModalServicio(null);
    cargarDatos();
  }

  async function eliminarCargo(cargo, esMonitoreo) {
    const tabla = esMonitoreo ? "cargos_monitoreo" : "cargos_servicio";
    const { error } = await supabase.from(tabla).delete().eq("id", cargo.id);
    if (error) setError("No se pudo eliminar el cargo.");
    setConfirmarBorrado(null);
    cargarDatos();
  }

  async function registrarPago({ cargo, esMonitoreo, monto, fecha }) {
    const payload = {
      monto: Number(monto),
      fecha,
      usuario_email: sesion.user.email,
      ...(esMonitoreo ? { cargo_monitoreo_id: cargo.id } : { cargo_servicio_id: cargo.id }),
    };
    const { error: e1 } = await supabase.from("pagos").insert(payload);
    if (e1) return setError("No se pudo registrar el pago.");

    const pagadoHastaAhora = totalPagado(cargo, esMonitoreo) + Number(monto);
    const nuevoEstado = pagadoHastaAhora >= Number(cargo.monto) ? "pagado" : "parcial";
    const tabla = esMonitoreo ? "cargos_monitoreo" : "cargos_servicio";
    const { error: e2 } = await supabase.from(tabla).update({ estado: nuevoEstado }).eq("id", cargo.id);
    if (e2) setError("No se pudo actualizar el estado del cargo.");

    setModalPago(null);
    cargarDatos();
  }

  if (cargando) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--texto-sec)" }}>Cargando cobranza...</div>;
  }

  return (
    <div>
      {error && (
        <div style={estilos.bannerError}>
          {error}
          <button onClick={() => setError("")} style={estilos.iconBtn}>
            <X size={14} />
          </button>
        </div>
      )}

      <div style={estilos.subtabs}>
        <button onClick={() => setSubvista("monitoreo")} style={{ ...estilos.subtabBtn, ...(subvista === "monitoreo" ? estilos.subtabBtnActivo : {}) }}>
          Monitoreo mensual
        </button>
        <button onClick={() => setSubvista("servicios")} style={{ ...estilos.subtabBtn, ...(subvista === "servicios" ? estilos.subtabBtnActivo : {}) }}>
          Cargos por servicios
        </button>
        <button onClick={() => setSubvista("clientes")} style={{ ...estilos.subtabBtn, ...(subvista === "clientes" ? estilos.subtabBtnActivo : {}) }}>
          Datos de cobranza por cliente
        </button>
      </div>

      {subvista === "monitoreo" && (
        <VistaMonitoreo
          cargos={cargosMonitoreo}
          clientes={clientes}
          nombreCliente={nombreCliente}
          saldoPendiente={saldoPendiente}
          totalPagado={totalPagado}
          onGenerarCargos={generarCargosDelMes}
          generando={generandoCargos}
          onPagar={(cargo) => setModalPago({ cargo, esMonitoreo: true })}
          onEliminar={(cargo) => setConfirmarBorrado({ cargo, esMonitoreo: true })}
        />
      )}

      {subvista === "servicios" && (
        <VistaServicios
          cargos={cargosServicio}
          nombreCliente={nombreCliente}
          saldoPendiente={saldoPendiente}
          onNuevo={() => setModalServicio("nuevo")}
          onEditar={(c) => setModalServicio(c)}
          onPagar={(cargo) => setModalPago({ cargo, esMonitoreo: false })}
          onEliminar={(cargo) => setConfirmarBorrado({ cargo, esMonitoreo: false })}
        />
      )}

      {subvista === "clientes" && (
        <VistaClientesCobranza
          clientes={clientesFiltrados}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          deudaPorCliente={deudaPorCliente}
          onEditar={(c) => setModalCliente(c)}
        />
      )}

      {modalCliente && (
        <ModalDatosCliente cliente={modalCliente} onGuardar={(datos) => guardarDatosCliente(modalCliente.id, datos)} onCerrar={() => setModalCliente(null)} />
      )}

      {modalServicio && (
        <ModalCargoServicio
          cargo={modalServicio === "nuevo" ? null : modalServicio}
          clientes={clientes}
          onGuardar={guardarCargoServicio}
          onCerrar={() => setModalServicio(null)}
        />
      )}

      {modalPago && (
        <ModalPago
          cargo={modalPago.cargo}
          esMonitoreo={modalPago.esMonitoreo}
          saldo={saldoPendiente(modalPago.cargo, modalPago.esMonitoreo)}
          onGuardar={registrarPago}
          onCerrar={() => setModalPago(null)}
        />
      )}

      {confirmarBorrado && (
        <ModalConfirmar
          titulo="Eliminar cargo"
          mensaje="¿Seguro que querés eliminar este cargo? Se va a borrar también el historial de pagos asociado. Esta acción no se puede deshacer."
          onConfirmar={() => eliminarCargo(confirmarBorrado.cargo, confirmarBorrado.esMonitoreo)}
          onCancelar={() => setConfirmarBorrado(null)}
        />
      )}
    </div>
  );
}

// ---------- Vista: Monitoreo mensual ----------
function VistaMonitoreo({ cargos, clientes, nombreCliente, saldoPendiente, totalPagado, onGenerarCargos, generando, onPagar, onEliminar }) {
  const [filtroPeriodo, setFiltroPeriodo] = useState(periodoActual());

  const periodosDisponibles = useMemo(() => {
    const set = new Set(cargos.map((c) => c.periodo));
    set.add(periodoActual());
    return Array.from(set).sort().reverse();
  }, [cargos]);

  const cargosDelPeriodo = cargos.filter((c) => c.periodo === filtroPeriodo);
  const totalPendientePeriodo = cargosDelPeriodo.reduce((acc, c) => acc + saldoPendiente(c, true), 0);

  return (
    <div>
      <div style={estilos.toolbar}>
        <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} style={estilos.select}>
          {periodosDisponibles.map((p) => (
            <option key={p} value={p}>
              {nombrePeriodo(p)}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={onGenerarCargos} disabled={generando} style={estilos.btnPrimario}>
          <RefreshCw size={15} /> {generando ? "Generando..." : "Generar cargos del mes"}
        </button>
      </div>

      <div style={estilos.statsRow}>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Clientes con cargo este período</div>
          <div style={estilos.statValor}>{cargosDelPeriodo.length}</div>
        </div>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Total pendiente del período</div>
          <div style={estilos.statValor}>{formatoMoneda(totalPendientePeriodo)}</div>
        </div>
      </div>

      {cargosDelPeriodo.length === 0 ? (
        <EstadoVacio mensaje={`No hay cargos generados para ${nombrePeriodo(filtroPeriodo)}. Usá el botón "Generar cargos del mes".`} />
      ) : (
        <div style={estilos.lista}>
          {cargosDelPeriodo.map((c) => (
            <FilaCargo
              key={c.id}
              titulo={nombreCliente(c.cliente_id)}
              subtitulo={nombrePeriodo(c.periodo)}
              monto={c.monto}
              pagado={totalPagado(c, true)}
              saldo={saldoPendiente(c, true)}
              estado={c.estado}
              onPagar={() => onPagar(c)}
              onEliminar={() => onEliminar(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Vista: Cargos por servicios ----------
function VistaServicios({ cargos, nombreCliente, saldoPendiente, onNuevo, onEditar, onPagar, onEliminar }) {
  const totalPendiente = cargos.filter((c) => c.estado !== "pagado").reduce((acc, c) => acc + saldoPendiente(c, false), 0);

  return (
    <div>
      <div style={estilos.toolbar}>
        <div style={{ flex: 1 }}>
          <div style={estilos.tituloSeccion}>Cargos por servicios</div>
          <div style={estilos.subtituloSeccion}>Instalaciones iniciales, upgrades, visitas técnicas</div>
        </div>
        <button onClick={onNuevo} style={estilos.btnPrimario}>
          <Plus size={15} /> Nuevo cargo
        </button>
      </div>

      <div style={estilos.statsRow}>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Cargos registrados</div>
          <div style={estilos.statValor}>{cargos.length}</div>
        </div>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Total pendiente de cobro</div>
          <div style={estilos.statValor}>{formatoMoneda(totalPendiente)}</div>
        </div>
      </div>

      {cargos.length === 0 ? (
        <EstadoVacio mensaje="Todavía no registraste ningún cargo por servicio." />
      ) : (
        <div style={estilos.lista}>
          {cargos.map((c) => (
            <FilaCargo
              key={c.id}
              titulo={nombreCliente(c.cliente_id)}
              subtitulo={c.concepto}
              monto={c.monto}
              pagado={c.monto - saldoPendiente(c, false)}
              saldo={saldoPendiente(c, false)}
              estado={c.estado}
              onPagar={() => onPagar(c)}
              onEditar={() => onEditar({ ...c, clienteId: c.cliente_id })}
              onEliminar={() => onEliminar(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Vista: datos de cobranza por cliente ----------
function VistaClientesCobranza({ clientes, busqueda, setBusqueda, deudaPorCliente, onEditar }) {
  const etiquetaEstado = { activo: "Activo", suspendido: "Suspendido", baja: "De baja" };
  const colorEstado = { activo: "var(--verde)", suspendido: "var(--ambar)", baja: "var(--muted)" };

  return (
    <div>
      <div style={estilos.toolbar}>
        <div style={estilos.buscador}>
          <Search size={16} color="var(--muted)" />
          <input placeholder="Buscar por número o nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.inputBuscador} />
        </div>
      </div>

      {clientes.length === 0 ? (
        <EstadoVacio mensaje="No hay clientes que coincidan." />
      ) : (
        <div style={estilos.lista}>
          {clientes.map((c) => (
            <div key={c.id} style={estilos.filaCliente}>
              <div style={{ flex: 1 }}>
                <div style={estilos.filaClienteNombre}>
                  {c.numero_cliente ? `${c.numero_cliente} — ` : "(sin número) "}
                  {c.nombre}
                </div>
                <div style={estilos.filaClienteSub}>
                  Cuota mensual: {formatoMoneda(c.cuota_mensual)} ·{" "}
                  <span style={{ color: colorEstado[c.estado] }}>{etiquetaEstado[c.estado]}</span>
                </div>
              </div>
              {deudaPorCliente[c.id] > 0 && (
                <div style={estilos.deudaBadge}>Debe {formatoMoneda(deudaPorCliente[c.id])}</div>
              )}
              <button onClick={() => onEditar(c)} style={estilos.iconBtn} aria-label="Editar datos de cobranza">
                <Edit2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Fila de cargo (reutilizable para monitoreo y servicios) ----------
function FilaCargo({ titulo, subtitulo, monto, pagado, saldo, estado, onPagar, onEditar, onEliminar }) {
  const iconoEstado = {
    pagado: <CheckCircle2 size={15} color="var(--verde)" />,
    parcial: <Clock size={15} color="var(--ambar)" />,
    pendiente: <AlertCircle size={15} color="var(--rojo)" />,
  };
  return (
    <div style={estilos.filaCargo}>
      {iconoEstado[estado]}
      <div style={{ flex: 1 }}>
        <div style={estilos.filaCargoTitulo}>{titulo}</div>
        <div style={estilos.filaCargoSub}>{subtitulo}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={estilos.filaCargoMonto}>{formatoMoneda(monto)}</div>
        {pagado > 0 && estado !== "pagado" && <div style={estilos.filaCargoPagado}>Pagado: {formatoMoneda(pagado)}</div>}
      </div>
      {estado !== "pagado" && (
        <button onClick={onPagar} style={estilos.btnSecundarioChico}>
          Registrar pago
        </button>
      )}
      {onEditar && (
        <button onClick={onEditar} style={estilos.iconBtn} aria-label="Editar">
          <Edit2 size={14} />
        </button>
      )}
      <button onClick={onEliminar} style={estilos.iconBtn} aria-label="Eliminar">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EstadoVacio({ mensaje }) {
  return (
    <div style={estilos.estadoVacio}>
      <Wallet size={32} color="var(--muted)" strokeWidth={1.5} />
      <div style={estilos.estadoVacioTexto}>{mensaje}</div>
    </div>
  );
}

// ---------- Modal base ----------
function ModalBase({ titulo, onCerrar, children, ancho }) {
  return (
    <div style={estilos.overlay} onClick={onCerrar}>
      <div style={{ ...estilos.modal, maxWidth: ancho || 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.modalHeader}>
          <div style={estilos.modalTitulo}>{titulo}</div>
          <button onClick={onCerrar} style={estilos.iconBtn} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div style={estilos.modalCuerpo}>{children}</div>
      </div>
    </div>
  );
}

// ---------- Modal: datos de cobranza del cliente ----------
function ModalDatosCliente({ cliente, onGuardar, onCerrar }) {
  const [numeroCliente, setNumeroCliente] = useState(cliente.numero_cliente || "");
  const [cuotaMensual, setCuotaMensual] = useState(cliente.cuota_mensual || "");
  const [estado, setEstado] = useState(cliente.estado || "activo");

  function enviar() {
    onGuardar({ numero_cliente: numeroCliente.trim(), cuota_mensual: Number(cuotaMensual) || 0, estado });
  }

  return (
    <ModalBase titulo={`Cobranza · ${cliente.nombre}`} onCerrar={onCerrar}>
      <div style={estilos.formGrid}>
        <Campo label="Número de cliente (4 dígitos)">
          <input value={numeroCliente} onChange={(e) => setNumeroCliente(e.target.value)} style={estilos.input} placeholder="Ej: 1024" maxLength={4} />
        </Campo>
        <Campo label="Cuota mensual (MXN)">
          <input type="number" value={cuotaMensual} onChange={(e) => setCuotaMensual(e.target.value)} style={estilos.input} placeholder="0" />
        </Campo>
        <Campo label="Estado" full>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={estilos.select}>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido temporalmente</option>
            <option value="baja">De baja</option>
          </select>
        </Campo>
      </div>
      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={enviar} style={estilos.btnPrimario}>
          Guardar
        </button>
      </div>
    </ModalBase>
  );
}

// ---------- Modal: cargo por servicio ----------
function ModalCargoServicio({ cargo, clientes, onGuardar, onCerrar }) {
  const [clienteId, setClienteId] = useState(cargo?.clienteId || clientes[0]?.id || "");
  const [concepto, setConcepto] = useState(cargo?.concepto || "");
  const [monto, setMonto] = useState(cargo?.monto || "");
  const [notas, setNotas] = useState(cargo?.notas || "");

  function enviar() {
    if (!clienteId || !concepto.trim() || !monto) return;
    onGuardar({ id: cargo?.id, clienteId, concepto, monto, notas });
  }

  return (
    <ModalBase titulo={cargo ? "Editar cargo" : "Nuevo cargo por servicio"} onCerrar={onCerrar}>
      <div style={estilos.formGrid}>
        <Campo label="Cliente" full>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={estilos.select}>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero_cliente ? `${c.numero_cliente} — ` : ""}
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Concepto" full>
          <input value={concepto} onChange={(e) => setConcepto(e.target.value)} style={estilos.input} placeholder="Ej: Instalación inicial, Upgrade panel, Visita técnica" />
        </Campo>
        <Campo label="Monto (MXN)">
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={estilos.input} placeholder="0" />
        </Campo>
        <Campo label="Notas (opcional)" full>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} style={estilos.input} placeholder="Opcional" />
        </Campo>
      </div>
      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={enviar} style={estilos.btnPrimario} disabled={!clienteId || !concepto.trim() || !monto}>
          Guardar cargo
        </button>
      </div>
    </ModalBase>
  );
}

// ---------- Modal: registrar pago ----------
function ModalPago({ cargo, esMonitoreo, saldo, onGuardar, onCerrar }) {
  const [monto, setMonto] = useState(saldo);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  function enviar() {
    if (!monto || Number(monto) <= 0) return;
    onGuardar({ cargo, esMonitoreo, monto, fecha });
  }

  return (
    <ModalBase titulo="Registrar pago" onCerrar={onCerrar} ancho={380}>
      <div style={estilos.saldoInfo}>
        Saldo pendiente: <strong>{formatoMoneda(saldo)}</strong>
      </div>
      <div style={estilos.formGrid}>
        <Campo label="Monto a registrar (MXN)" full>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={estilos.input} max={saldo} />
        </Campo>
        <Campo label="Fecha de pago" full>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={estilos.input} max={new Date().toISOString().slice(0, 10)} />
        </Campo>
      </div>
      {Number(monto) > saldo && <div style={estilos.avisoError}>El monto es mayor al saldo pendiente.</div>}
      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={enviar} style={estilos.btnPrimario} disabled={!monto || Number(monto) <= 0}>
          Registrar pago
        </button>
      </div>
    </ModalBase>
  );
}

function ModalConfirmar({ titulo, mensaje, onConfirmar, onCancelar }) {
  return (
    <ModalBase titulo={titulo} onCerrar={onCancelar} ancho={400}>
      <p style={{ fontSize: 13.5, color: "var(--texto-sec)", lineHeight: 1.6 }}>{mensaje}</p>
      <div style={estilos.modalFooter}>
        <button onClick={onCancelar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={onConfirmar} style={estilos.btnPeligro}>
          Eliminar
        </button>
      </div>
    </ModalBase>
  );
}

function Campo({ label, children, full }) {
  return (
    <div style={full ? estilos.campoFull : estilos.campo}>
      <label style={estilos.label}>{label}</label>
      {children}
    </div>
  );
}

const estilos = {
  bannerError: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(226,75,74,0.1)",
    color: "var(--rojo)",
    padding: "10px 16px",
    borderRadius: 9,
    fontSize: 13,
    marginBottom: 16,
  },
  subtabs: { display: "flex", gap: 4, background: "var(--superficie)", padding: 4, borderRadius: 10, marginBottom: 20, width: "fit-content", flexWrap: "wrap" },
  subtabBtn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "transparent", color: "var(--texto-sec)", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  subtabBtnActivo: { background: "var(--superficie-alta)", color: "var(--texto)" },
  toolbar: { display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" },
  buscador: { display: "flex", alignItems: "center", gap: 8, background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 9, padding: "9px 12px", flex: 1, minWidth: 220 },
  inputBuscador: { background: "transparent", border: "none", outline: "none", color: "var(--texto)", fontSize: 13.5, width: "100%" },
  select: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 9, padding: "9px 12px", color: "var(--texto)", fontSize: 13.5, outline: "none" },
  btnPrimario: { display: "flex", alignItems: "center", gap: 6, background: "var(--ambar)", color: "#1A1300", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  btnSecundario: { display: "flex", alignItems: "center", gap: 6, background: "var(--superficie)", color: "var(--texto)", border: "1px solid var(--borde)", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 500, cursor: "pointer" },
  btnSecundarioChico: { display: "flex", alignItems: "center", gap: 5, background: "var(--superficie-alta)", color: "var(--texto)", border: "1px solid var(--borde)", borderRadius: 7, padding: "6px 11px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" },
  btnPeligro: { background: "var(--rojo)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  iconBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid var(--borde)", background: "var(--superficie-alta)", color: "var(--texto-sec)", cursor: "pointer", flexShrink: 0 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24, maxWidth: 500 },
  statCard: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 12, padding: "16px 18px" },
  statLabel: { fontSize: 12, color: "var(--texto-sec)", marginBottom: 6 },
  statValor: { fontSize: 20, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
  tituloSeccion: { fontSize: 16, fontWeight: 600 },
  subtituloSeccion: { fontSize: 13, color: "var(--texto-sec)", marginTop: 3 },
  lista: { display: "flex", flexDirection: "column", gap: 8 },
  filaCargo: { display: "flex", alignItems: "center", gap: 12, background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" },
  filaCargoTitulo: { fontSize: 13.5, fontWeight: 500 },
  filaCargoSub: { fontSize: 12, color: "var(--texto-sec)", marginTop: 2 },
  filaCargoMonto: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600 },
  filaCargoPagado: { fontSize: 11, color: "var(--verde)", marginTop: 2 },
  filaCliente: { display: "flex", alignItems: "center", gap: 12, background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 16px" },
  filaClienteNombre: { fontSize: 13.5, fontWeight: 500 },
  filaClienteSub: { fontSize: 12, color: "var(--texto-sec)", marginTop: 3 },
  deudaBadge: { fontSize: 12, fontWeight: 600, color: "var(--rojo)", background: "rgba(226,75,74,0.1)", padding: "5px 10px", borderRadius: 7, whiteSpace: "nowrap" },
  estadoVacio: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 0", color: "var(--texto-sec)" },
  estadoVacioTexto: { fontSize: 13.5, textAlign: "center", maxWidth: 380 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  modal: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 14, width: "100%", maxHeight: "85vh", overflow: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--borde)" },
  modalTitulo: { fontSize: 15, fontWeight: 600 },
  modalCuerpo: { padding: 20 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--borde)" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  campo: { display: "flex", flexDirection: "column", gap: 6 },
  campoFull: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" },
  label: { fontSize: 12, color: "var(--texto-sec)", fontWeight: 500 },
  input: { background: "var(--superficie-alta)", border: "1px solid var(--borde)", borderRadius: 8, padding: "9px 12px", color: "var(--texto)", fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box" },
  avisoError: { fontSize: 12.5, color: "var(--rojo)", marginTop: 10 },
  saldoInfo: { fontSize: 13.5, color: "var(--texto-sec)", marginBottom: 16, background: "var(--superficie-alta)", padding: "10px 14px", borderRadius: 8 },
};
