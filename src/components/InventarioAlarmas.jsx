import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { LOGO_FBI } from "../lib/logo";
import {
  Search,
  Plus,
  Package,
  ArrowUpDown,
  Home,
  X,
  Camera,
  Trash2,
  Edit2,
  AlertTriangle,
  ChevronRight,
  LogOut,
  FileText,
  Download,
  MessageCircle,
  BatteryWarning,
  Minus,
  Wallet,
  FileBarChart,
} from "lucide-react";
import Cobranza from "./Cobranza";

const CATEGORIAS = ["Paneles", "Sensores", "Sirenas", "Cámaras", "Teclados", "Baterías", "Cableado", "Accesorios"];

function formatoMoneda(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
}

function formatoFecha(f) {
  const d = new Date(f);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function normalizarNumeroCliente(valor) {
  const limpio = (valor || "").trim();
  if (!limpio) return null;
  return limpio.padStart(4, "0");
}

function colorEstadoCliente(estado) {
  if (estado === "suspendido") return "var(--ambar)";
  if (estado === "baja") return "var(--rojo)";
  return "var(--verde)";
}

function etiquetaEstadoCliente(estado) {
  if (estado === "suspendido") return "Suspendido temporalmente";
  if (estado === "baja") return "De baja";
  return "Activo";
}

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function periodoActualYYYYMM() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function nombrePeriodoYYYYMM(periodo) {
  const [anio, mes] = periodo.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function generarUltimosMeses(cantidad) {
  const meses = [];
  const hoy = new Date();
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

function fechaEnPeriodo(fechaISO, periodo) {
  if (!fechaISO) return false;
  return fechaISO.slice(0, 7) === periodo;
}

function SelectorReporte({ periodo, setPeriodo, onGenerar, deshabilitado }) {
  const meses = generarUltimosMeses(12);
  return (
    <div style={estilos.selectorReporte}>
      <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={estilos.select}>
        {meses.map((m) => (
          <option key={m} value={m}>
            {nombrePeriodoYYYYMM(m)}
          </option>
        ))}
      </select>
      <button onClick={onGenerar} disabled={deshabilitado} style={estilos.btnSecundario}>
        <FileBarChart size={15} /> Reporte mensual
      </button>
    </div>
  );
}

export default function InventarioAlarmas({ sesion, perfil }) {
  const nombreUsuario = perfil?.nombre || sesion.user.email;
  const [vista, setVista] = useState("inventario");
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [alertaStockVisible, setAlertaStockVisible] = useState(true);

  const [modalProducto, setModalProducto] = useState(null);
  const [modalMovimiento, setModalMovimiento] = useState(null);
  const [modalCliente, setModalCliente] = useState(null);
  const [modalAsignar, setModalAsignar] = useState(null);
  const [modalCotizacion, setModalCotizacion] = useState(null);
  const [verCotizacion, setVerCotizacion] = useState(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const [confirmarBorradoMovimiento, setConfirmarBorradoMovimiento] = useState(null);
  const [confirmarBorradoCotizacion, setConfirmarBorradoCotizacion] = useState(null);

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [
        { data: prod, error: e1 },
        { data: cli, error: e2 },
        { data: eq, error: e3 },
        { data: mov, error: e4 },
        { data: cot, error: e5 },
      ] = await Promise.all([
        supabase.from("productos").select("*").order("creado_en", { ascending: false }),
        supabase.from("clientes").select("*").order("creado_en", { ascending: false }),
        supabase.from("equipos_instalados").select("*"),
        supabase.from("movimientos").select("*").order("creado_en", { ascending: false }).limit(100),
        supabase.from("cotizaciones").select("*").order("creado_en", { ascending: false }),
      ]);
      if (e1 || e2 || e3 || e4 || e5) throw e1 || e2 || e3 || e4 || e5;

      const clientesConEquipos = (cli || []).map((c) => ({
        ...c,
        equipos: (eq || []).filter((e) => e.cliente_id === c.id).map((e) => ({
          productoId: e.producto_id,
          cantidad: e.cantidad,
          fechaInstalacion: e.fecha_instalacion,
        })),
      }));

      setProductos(prod || []);
      setClientes(clientesConEquipos);
      setMovimientos(mov || []);
      setCotizaciones(cot || []);
    } catch (err) {
      setError("No se pudo cargar la información. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideBusqueda =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.marca || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.modelo || "").toLowerCase().includes(busqueda.toLowerCase());
      const coincideCategoria = filtroCategoria === "Todas" || p.categoria === filtroCategoria;
      return coincideBusqueda && coincideCategoria;
    });
  }, [productos, busqueda, filtroCategoria]);

  const productosStockBajo = useMemo(() => productos.filter((p) => p.stock <= p.minimo), [productos]);

  const equiposParaMantenimiento = useMemo(() => {
    const hoy = new Date();
    const resultado = [];
    clientes.forEach((c) => {
      c.equipos.forEach((eq) => {
        if (!eq.fechaInstalacion) return;
        const fecha = new Date(eq.fechaInstalacion);
        const anios = (hoy - fecha) / (1000 * 60 * 60 * 24 * 365.25);
        if (anios >= 3) {
          const producto = productos.find((p) => p.id === eq.productoId);
          resultado.push({ cliente: c, producto, anios: Math.floor(anios) });
        }
      });
    });
    return resultado;
  }, [clientes, productos]);

  async function guardarProducto(producto) {
    const payload = {
      nombre: producto.nombre,
      categoria: producto.categoria,
      marca: producto.marca,
      modelo: producto.modelo,
      precio: Number(producto.precio) || 0,
      stock: Number(producto.stock) || 0,
      minimo: Number(producto.minimo) || 0,
      foto: producto.foto,
    };
    if (producto.id) {
      const { error } = await supabase.from("productos").update(payload).eq("id", producto.id);
      if (error) return setError("No se pudo actualizar el producto.");
    } else {
      const { error } = await supabase.from("productos").insert(payload);
      if (error) return setError("No se pudo crear el producto.");
    }
    setModalProducto(null);
    cargarTodo();
  }

  async function eliminarProducto(id) {
    const { error } = await supabase.from("productos").delete().eq("id", id);
    if (error) setError("No se pudo eliminar el producto.");
    setConfirmarBorrado(null);
    cargarTodo();
  }

  async function registrarMovimiento(mov) {
    const producto = productos.find((p) => p.id === mov.productoId);
    if (!producto) return;
    const delta = mov.tipo === "entrada" ? mov.cantidad : -mov.cantidad;
    const nuevoStock = Math.max(0, producto.stock + delta);

    const { error: e1 } = await supabase.from("productos").update({ stock: nuevoStock }).eq("id", producto.id);
    const { error: e2 } = await supabase.from("movimientos").insert({
      producto_id: mov.productoId,
      tipo: mov.tipo,
      cantidad: mov.cantidad,
      motivo: mov.motivo,
      usuario_email: nombreUsuario,
    });
    if (e1 || e2) setError("No se pudo registrar el movimiento.");
    setModalMovimiento(null);
    cargarTodo();
  }

  async function eliminarMovimiento(mov) {
    const producto = productos.find((p) => p.id === mov.producto_id);
    if (producto) {
      // Revertir el efecto que tuvo este movimiento sobre el stock
      const delta = mov.tipo === "entrada" ? -mov.cantidad : mov.cantidad;
      const nuevoStock = Math.max(0, producto.stock + delta);
      const { error: e1 } = await supabase.from("productos").update({ stock: nuevoStock }).eq("id", producto.id);
      if (e1) setError("No se pudo ajustar el stock al eliminar el movimiento.");
    }
    const { error: e2 } = await supabase.from("movimientos").delete().eq("id", mov.id);
    if (e2) setError("No se pudo eliminar el movimiento.");
    setConfirmarBorradoMovimiento(null);
    cargarTodo();
  }

  async function guardarCliente(cliente) {
    const payload = {
      nombre: cliente.nombre,
      domicilio: cliente.domicilio,
      telefono: cliente.telefono,
      numero_cliente: normalizarNumeroCliente(cliente.numero_cliente),
      cuota_mensual: Number(cliente.cuota_mensual) || 0,
      estado: cliente.estado || "activo",
      frecuencia_pago: cliente.frecuencia_pago || "mensual",
      fecha_alta: cliente.fecha_alta || null,
    };
    if (cliente.id) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", cliente.id);
      if (error) return setError("No se pudo actualizar el cliente.");
    } else {
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) return setError("No se pudo crear el cliente.");
    }
    setModalCliente(null);
    cargarTodo();
  }

  async function asignarEquipo(clienteId, productoId, cantidad, fechaInstalacion, esHistorica) {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) {
      setError("No se encontró el producto.");
      return;
    }
    if (!esHistorica && cantidad > producto.stock) {
      setError("No hay stock suficiente para asignar esa cantidad.");
      return;
    }
    const cliente = clientes.find((c) => c.id === clienteId);

    const { error: e1 } = await supabase.from("equipos_instalados").insert({
      cliente_id: clienteId,
      producto_id: productoId,
      cantidad,
      fecha_instalacion: fechaInstalacion,
    });

    let e2 = null;
    let e3 = null;
    if (!esHistorica) {
      // Solo descuenta stock y registra movimiento si es una instalación nueva (sale del depósito hoy)
      ({ error: e2 } = await supabase.from("productos").update({ stock: producto.stock - cantidad }).eq("id", productoId));
      ({ error: e3 } = await supabase.from("movimientos").insert({
        producto_id: productoId,
        tipo: "salida",
        cantidad,
        motivo: `Instalación: ${cliente?.nombre || ""}`,
        usuario_email: nombreUsuario,
        creado_en: new Date(fechaInstalacion + "T12:00:00").toISOString(),
      }));
    }

    if (e1 || e2 || e3) setError("No se pudo asignar el equipo.");
    setModalAsignar(null);
    cargarTodo();
  }

  async function guardarCotizacion(cotizacion) {
    const total = cotizacion.items.reduce((acc, it) => acc + it.precio * it.cantidad, 0) + Number(cotizacion.manoDeObra || 0);
    const payload = {
      cliente_id: cotizacion.clienteId || null,
      cliente_nombre: cotizacion.clienteNombre,
      cliente_telefono: cotizacion.clienteTelefono,
      items: cotizacion.items,
      mano_de_obra: Number(cotizacion.manoDeObra) || 0,
      total,
      estado: cotizacion.estado || "pendiente",
      notas: cotizacion.notas || "",
      usuario_email: nombreUsuario,
    };
    if (cotizacion.id) {
      const { error } = await supabase.from("cotizaciones").update(payload).eq("id", cotizacion.id);
      if (error) return setError("No se pudo actualizar la cotización.");
    } else {
      const { error } = await supabase.from("cotizaciones").insert(payload);
      if (error) return setError("No se pudo crear la cotización.");
    }
    setModalCotizacion(null);
    cargarTodo();
  }

  async function cambiarEstadoCotizacion(cotizacion, estado) {
    const { error } = await supabase.from("cotizaciones").update({ estado }).eq("id", cotizacion.id);
    if (error) setError("No se pudo actualizar el estado de la cotización.");
    cargarTodo();
  }

  async function eliminarCotizacion(cotizacion) {
    const { error } = await supabase.from("cotizaciones").delete().eq("id", cotizacion.id);
    if (error) setError("No se pudo eliminar la cotización.");
    setConfirmarBorradoCotizacion(null);
    cargarTodo();
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  if (cargando && productos.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--texto-sec)" }}>
        Cargando inventario...
      </div>
    );
  }

  return (
    <div style={estilos.app}>
      <Encabezado vista={vista} setVista={setVista} alertas={productosStockBajo.length} nombreUsuario={nombreUsuario} onCerrarSesion={cerrarSesion} />

      {error && (
        <div style={estilos.bannerError}>
          {error}
          <button onClick={() => setError("")} style={estilos.iconBtn} aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      )}

      <div style={estilos.contenido}>
        {vista === "inventario" && (
          <VistaInventario
            productos={productosFiltrados}
            todos={productos}
            movimientos={movimientos}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            filtroCategoria={filtroCategoria}
            setFiltroCategoria={setFiltroCategoria}
            onNuevo={() => setModalProducto("nuevo")}
            onEditar={(p) => setModalProducto(p)}
            onEliminar={(p) => setConfirmarBorrado(p)}
            onMovimiento={() => setModalMovimiento(true)}
          />
        )}

        {vista === "movimientos" && (
          <VistaMovimientos
            movimientos={movimientos}
            productos={productos}
            onNuevo={() => setModalMovimiento(true)}
            onEliminar={(m) => setConfirmarBorradoMovimiento(m)}
          />
        )}

        {vista === "instalaciones" && (
          <VistaInstalaciones
            clientes={clientes}
            productos={productos}
            equiposParaMantenimiento={equiposParaMantenimiento}
            onNuevoCliente={() => setModalCliente("nuevo")}
            onEditarCliente={(c) => setModalCliente(c)}
            onAsignar={(c) => setModalAsignar(c)}
          />
        )}

        {vista === "cotizaciones" && (
          <VistaCotizaciones
            cotizaciones={cotizaciones}
            onNueva={() => setModalCotizacion("nueva")}
            onVer={(c) => setVerCotizacion(c)}
            onEditar={(c) => setModalCotizacion(c)}
            onEliminar={(c) => setConfirmarBorradoCotizacion(c)}
            onCambiarEstado={cambiarEstadoCotizacion}
          />
        )}

        {vista === "cobranza" && <Cobranza sesion={sesion} clientes={clientes} onClientesActualizados={cargarTodo} />}
      </div>

      {productosStockBajo.length > 0 && vista === "inventario" && alertaStockVisible && (
        <BarraAlertas productos={productosStockBajo} onCerrar={() => setAlertaStockVisible(false)} />
      )}

      {modalProducto && (
        <ModalProducto producto={modalProducto === "nuevo" ? null : modalProducto} onGuardar={guardarProducto} onCerrar={() => setModalProducto(null)} />
      )}

      {modalMovimiento && <ModalMovimiento productos={productos} onGuardar={registrarMovimiento} onCerrar={() => setModalMovimiento(null)} />}

      {modalCliente && (
        <ModalCliente cliente={modalCliente === "nuevo" ? null : modalCliente} onGuardar={guardarCliente} onCerrar={() => setModalCliente(null)} />
      )}

      {modalAsignar && (
        <ModalAsignarEquipo cliente={modalAsignar} productos={productos} onAsignar={asignarEquipo} onCerrar={() => setModalAsignar(null)} />
      )}

      {modalCotizacion && (
        <ModalCotizacion
          cotizacion={modalCotizacion === "nueva" ? null : modalCotizacion}
          productos={productos}
          clientes={clientes}
          onGuardar={guardarCotizacion}
          onCerrar={() => setModalCotizacion(null)}
        />
      )}

      {verCotizacion && <ModalVerCotizacion cotizacion={verCotizacion} onCerrar={() => setVerCotizacion(null)} />}

      {confirmarBorrado && (
        <ModalConfirmar
          titulo="Eliminar producto"
          mensaje={`¿Seguro que quieres eliminar "${confirmarBorrado.nombre}" del inventario? Esta acción no se puede deshacer.`}
          onConfirmar={() => eliminarProducto(confirmarBorrado.id)}
          onCancelar={() => setConfirmarBorrado(null)}
        />
      )}

      {confirmarBorradoMovimiento && (
        <ModalConfirmar
          titulo="Eliminar movimiento"
          mensaje="¿Seguro que quieres eliminar este movimiento? El stock del producto se va a ajustar automáticamente para revertir su efecto. Esta acción no se puede deshacer."
          onConfirmar={() => eliminarMovimiento(confirmarBorradoMovimiento)}
          onCancelar={() => setConfirmarBorradoMovimiento(null)}
        />
      )}

      {confirmarBorradoCotizacion && (
        <ModalConfirmar
          titulo="Eliminar cotización"
          mensaje={`¿Seguro que quieres eliminar la cotización de "${confirmarBorradoCotizacion.cliente_nombre}"? Esta acción no se puede deshacer.`}
          onConfirmar={() => eliminarCotizacion(confirmarBorradoCotizacion)}
          onCancelar={() => setConfirmarBorradoCotizacion(null)}
        />
      )}
    </div>
  );
}

function Encabezado({ vista, setVista, alertas, nombreUsuario, onCerrarSesion }) {
  const tabs = [
    { id: "inventario", label: "Inventario", icon: Package },
    { id: "movimientos", label: "Movimientos", icon: ArrowUpDown },
    { id: "instalaciones", label: "Instalaciones", icon: Home },
    { id: "cotizaciones", label: "Cotizaciones", icon: FileText },
    { id: "cobranza", label: "Cobranza", icon: Wallet },
  ];
  return (
    <div style={estilos.encabezado}>
      <div style={estilos.marca}>
        <div style={estilos.fondoLogo}>
          <img src={LOGO_FBI} alt="FBI Central de Alarmas" style={estilos.logoEncabezado} />
        </div>
        <div>
          <div style={estilos.marcaTitulo}>FBI Central de Alarmas</div>
          <div style={estilos.marcaSub}>Inventario · {nombreUsuario}</div>
        </div>
      </div>
      <div style={estilos.tabs}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const activo = vista === t.id;
          return (
            <button key={t.id} onClick={() => setVista(t.id)} style={{ ...estilos.tabBtn, ...(activo ? estilos.tabBtnActivo : {}) }}>
              <Icon size={15} strokeWidth={2} />
              {t.label}
              {t.id === "inventario" && alertas > 0 && <span style={estilos.badgeAlerta}>{alertas}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={onCerrarSesion} style={estilos.btnSalir} aria-label="Cerrar sesión">
        <LogOut size={15} />
      </button>
    </div>
  );
}

function VistaInventario({ productos, todos, movimientos, busqueda, setBusqueda, filtroCategoria, setFiltroCategoria, onNuevo, onEditar, onEliminar, onMovimiento }) {
  const [periodoReporte, setPeriodoReporte] = useState(periodoActualYYYYMM());
  const valorTotal = todos.reduce((acc, p) => acc + p.precio * p.stock, 0);

  function generarReporte() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    const logoAncho = 40;
    const logoAlto = logoAncho * (254 / 500);
    doc.addImage(LOGO_FBI, "PNG", 14, 10, logoAncho, logoAlto);
    y = 10 + logoAlto + 10;

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(`Reporte de Inventario — ${nombrePeriodoYYYYMM(periodoReporte)}`, 14, y);
    y += 12;

    const movimientosDelMes = movimientos.filter((m) => fechaEnPeriodo(m.creado_en, periodoReporte));
    const entradas = movimientosDelMes.filter((m) => m.tipo === "entrada");
    const salidas = movimientosDelMes.filter((m) => m.tipo === "salida");
    const unidadesEntrada = entradas.reduce((a, m) => a + m.cantidad, 0);
    const unidadesSalida = salidas.reduce((a, m) => a + m.cantidad, 0);
    const stockBajo = todos.filter((p) => p.stock <= p.minimo);

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    const resumen = [
      `Productos distintos en catálogo: ${todos.length}`,
      `Unidades totales en stock (a la fecha): ${todos.reduce((a, p) => a + p.stock, 0)}`,
      `Valor total de stock (a la fecha): ${formatoMoneda(valorTotal)}`,
      `Movimientos de entrada en el mes: ${entradas.length} (${unidadesEntrada} unidades)`,
      `Movimientos de salida en el mes: ${salidas.length} (${unidadesSalida} unidades)`,
      `Productos con stock bajo o crítico (a la fecha): ${stockBajo.length}`,
    ];
    resumen.forEach((linea) => {
      doc.text(linea, 14, y);
      y += 7;
    });

    y += 6;
    if (stockBajo.length > 0) {
      doc.setFont(undefined, "bold");
      doc.text("Productos con stock bajo o crítico:", 14, y);
      y += 7;
      doc.setFont(undefined, "normal");
      stockBajo.forEach((p) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(`• ${p.nombre} (${p.marca} ${p.modelo}) — stock: ${p.stock}, mínimo: ${p.minimo}`, 14, y);
        y += 7;
      });
    }

    doc.save(`reporte-inventario-${periodoReporte}.pdf`);
  }

  return (
    <div>
      <div style={estilos.statsRow}>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Productos distintos</div>
          <div style={estilos.statValor}>{todos.length}</div>
        </div>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Unidades totales</div>
          <div style={estilos.statValor}>{todos.reduce((a, p) => a + p.stock, 0)}</div>
        </div>
        <div style={estilos.statCard}>
          <div style={estilos.statLabel}>Valor de stock</div>
          <div style={estilos.statValor}>{formatoMoneda(valorTotal)}</div>
        </div>
      </div>

      <div style={estilos.toolbar}>
        <div style={estilos.buscador}>
          <Search size={16} color="var(--muted)" />
          <input placeholder="Buscar por nombre, marca o modelo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.inputBuscador} />
        </div>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={estilos.select}>
          <option>Todas</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={onMovimiento} style={estilos.btnSecundario}>
          <ArrowUpDown size={15} /> Movimiento
        </button>
        <button onClick={onNuevo} style={estilos.btnPrimario}>
          <Plus size={15} /> Nuevo producto
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SelectorReporte periodo={periodoReporte} setPeriodo={setPeriodoReporte} onGenerar={generarReporte} />
      </div>

      {productos.length === 0 ? (
        <EstadoVacio mensaje="No se encontró ningún producto con esos filtros." />
      ) : (
        <div style={estilos.grilla}>
          {productos.map((p) => (
            <TarjetaProducto key={p.id} producto={p} onEditar={() => onEditar(p)} onEliminar={() => onEliminar(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaProducto({ producto, onEditar, onEliminar }) {
  const bajo = producto.stock <= producto.minimo;
  const critico = producto.stock === 0;
  return (
    <div style={estilos.tarjeta}>
      <div style={estilos.tarjetaFoto}>
        {producto.foto ? <img src={producto.foto} alt={producto.nombre} style={estilos.imgProducto} /> : <Package size={28} color="var(--muted)" strokeWidth={1.5} />}
        <div
          style={{ ...estilos.puntoEstado, background: critico ? "var(--rojo)" : bajo ? "var(--ambar)" : "var(--verde)" }}
          title={critico ? "Sin stock" : bajo ? "Stock bajo" : "Stock ok"}
        />
      </div>
      <div style={estilos.tarjetaCuerpo}>
        <div style={estilos.tarjetaCategoria}>{producto.categoria}</div>
        <div style={estilos.tarjetaNombre}>{producto.nombre}</div>
        <div style={estilos.tarjetaMarca}>
          {producto.marca} · {producto.modelo}
        </div>
        <div style={estilos.tarjetaFooter}>
          <span style={estilos.tarjetaPrecio}>{formatoMoneda(producto.precio)}</span>
          <span style={{ ...estilos.tarjetaStock, color: critico ? "var(--rojo)" : bajo ? "var(--ambar)" : "var(--texto-sec)" }}>{producto.stock} en stock</span>
        </div>
      </div>
      <div style={estilos.tarjetaAcciones}>
        <button onClick={onEditar} style={estilos.iconBtn} aria-label="Editar">
          <Edit2 size={14} />
        </button>
        <button onClick={onEliminar} style={estilos.iconBtn} aria-label="Eliminar">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function VistaMovimientos({ movimientos, productos, onNuevo, onEliminar }) {
  function nombreProducto(id) {
    return productos.find((p) => p.id === id)?.nombre || "Producto eliminado";
  }
  return (
    <div>
      <div style={estilos.toolbar}>
        <div style={{ flex: 1 }}>
          <div style={estilos.tituloSeccion}>Historial de movimientos</div>
          <div style={estilos.subtituloSeccion}>Entradas y salidas de stock</div>
        </div>
        <button onClick={onNuevo} style={estilos.btnPrimario}>
          <Plus size={15} /> Registrar movimiento
        </button>
      </div>

      {movimientos.length === 0 ? (
        <EstadoVacio mensaje="Todavía no se registró ningún movimiento." />
      ) : (
        <div style={estilos.listaMovimientos}>
          {movimientos.map((m) => (
            <div key={m.id} style={estilos.filaMovimiento}>
              <div
                style={{
                  ...estilos.iconoMovimiento,
                  background: m.tipo === "entrada" ? "rgba(99,153,34,0.15)" : "rgba(226,75,74,0.15)",
                  color: m.tipo === "entrada" ? "var(--verde)" : "var(--rojo)",
                }}
              >
                {m.tipo === "entrada" ? "+" : "−"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={estilos.movProducto}>{nombreProducto(m.producto_id)}</div>
                <div style={estilos.movMotivo}>
                  {m.motivo} {m.usuario_email ? `· ${m.usuario_email}` : ""}
                </div>
              </div>
              <div style={estilos.movCantidad}>
                {m.tipo === "entrada" ? "+" : "−"}
                {m.cantidad}
              </div>
              <div style={estilos.movFecha}>{formatoFecha(m.creado_en)}</div>
              <button onClick={() => onEliminar(m)} style={estilos.iconBtn} aria-label="Eliminar movimiento">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaInstalaciones({ clientes, productos, equiposParaMantenimiento, onNuevoCliente, onEditarCliente, onAsignar }) {
  const [avisoMantenimientoVisible, setAvisoMantenimientoVisible] = useState(true);
  const [periodoReporte, setPeriodoReporte] = useState(periodoActualYYYYMM());

  function nombreProducto(id) {
    return productos.find((p) => p.id === id)?.nombre || "Producto eliminado";
  }

  function generarReporte() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    const logoAncho = 40;
    const logoAlto = logoAncho * (254 / 500);
    doc.addImage(LOGO_FBI, "PNG", 14, 10, logoAncho, logoAlto);
    y = 10 + logoAlto + 10;

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(`Reporte de Instalaciones — ${nombrePeriodoYYYYMM(periodoReporte)}`, 14, y);
    y += 12;

    const clientesNuevos = clientes.filter((c) => fechaEnPeriodo(c.creado_en, periodoReporte));
    let equiposInstaladosDelMes = 0;
    clientes.forEach((c) => {
      c.equipos.forEach((eq) => {
        if (fechaEnPeriodo(eq.fechaInstalacion, periodoReporte)) equiposInstaladosDelMes++;
      });
    });

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    const resumen = [
      `Clientes totales (a la fecha): ${clientes.length}`,
      `Clientes nuevos en el mes: ${clientesNuevos.length}`,
      `Equipos instalados en el mes: ${equiposInstaladosDelMes}`,
      `Equipos con 3+ años instalados (a la fecha, sugieren revisión): ${equiposParaMantenimiento.length}`,
    ];
    resumen.forEach((linea) => {
      doc.text(linea, 14, y);
      y += 7;
    });

    if (clientesNuevos.length > 0) {
      y += 6;
      doc.setFont(undefined, "bold");
      doc.text("Clientes nuevos del mes:", 14, y);
      y += 7;
      doc.setFont(undefined, "normal");
      clientesNuevos.forEach((c) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(`• ${c.numero_cliente ? c.numero_cliente + " — " : ""}${c.nombre} (${c.domicilio})`, 14, y);
        y += 7;
      });
    }

    if (equiposParaMantenimiento.length > 0) {
      y += 6;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont(undefined, "bold");
      doc.text("Equipos que sugieren revisión de mantenimiento:", 14, y);
      y += 7;
      doc.setFont(undefined, "normal");
      equiposParaMantenimiento.forEach((e) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(`• ${e.cliente.nombre} — ${e.producto?.nombre || "equipo"} (${e.anios} años instalado)`, 14, y);
        y += 7;
      });
    }

    doc.save(`reporte-instalaciones-${periodoReporte}.pdf`);
  }

  return (
    <div>
      {equiposParaMantenimiento.length > 0 && avisoMantenimientoVisible && (
        <div style={estilos.avisoMantenimiento}>
          <BatteryWarning size={17} color="var(--ambar)" strokeWidth={2} />
          <div style={{ flex: 1 }}>
            <div style={estilos.avisoMantenimientoTitulo}>
              {equiposParaMantenimiento.length} equipo{equiposParaMantenimiento.length > 1 ? "s" : ""} con 3+ años instalado{equiposParaMantenimiento.length > 1 ? "s" : ""}
            </div>
            <div style={estilos.avisoMantenimientoTexto}>
              Conviene revisar batería o estado general:{" "}
              {equiposParaMantenimiento
                .slice(0, 3)
                .map((e) => `${e.cliente.nombre} (${e.anios} años)`)
                .join(", ")}
              {equiposParaMantenimiento.length > 3 ? "…" : ""}
            </div>
          </div>
          <button onClick={() => setAvisoMantenimientoVisible(false)} style={estilos.cerrarAviso} aria-label="Cerrar aviso">
            <X size={15} />
          </button>
        </div>
      )}

      <div style={estilos.toolbar}>
        <div style={{ flex: 1 }}>
          <div style={estilos.tituloSeccion}>Instalaciones por cliente</div>
          <div style={estilos.subtituloSeccion}>Qué equipo quedó instalado en cada domicilio</div>
        </div>
        <button onClick={onNuevoCliente} style={estilos.btnPrimario}>
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SelectorReporte periodo={periodoReporte} setPeriodo={setPeriodoReporte} onGenerar={generarReporte} />
      </div>

      {clientes.length === 0 ? (
        <EstadoVacio mensaje="Todavía no agregaste ningún cliente." />
      ) : (
        <div style={estilos.listaClientes}>
          {clientes.map((c) => (
            <div key={c.id} style={estilos.tarjetaCliente}>
              <div style={estilos.clienteHeader}>
                <div>
                  <div style={estilos.clienteNombre}>
                    <span
                      style={{ ...estilos.puntoEstadoCliente, background: colorEstadoCliente(c.estado) }}
                      title={etiquetaEstadoCliente(c.estado)}
                    />
                    {c.numero_cliente ? `${c.numero_cliente} — ` : ""}
                    {c.nombre}
                  </div>
                  <div style={estilos.clienteDomicilio}>{c.domicilio}</div>
                  {c.telefono && <div style={estilos.clienteTelefono}>{c.telefono}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onEditarCliente(c)} style={estilos.iconBtn} aria-label="Editar cliente">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onAsignar(c)} style={estilos.btnSecundarioChico}>
                    <Plus size={13} /> Asignar equipo
                  </button>
                </div>
              </div>
              {c.equipos.length > 0 && (
                <div style={estilos.equiposLista}>
                  {c.equipos.map((eq, i) => (
                    <div key={i} style={estilos.equipoItem}>
                      <ChevronRight size={13} color="var(--muted)" />
                      <span>{nombreProducto(eq.productoId)}</span>
                      <span style={estilos.equipoCantidad}>
                        x{eq.cantidad} {eq.fechaInstalacion ? `· instalado ${formatoFecha(eq.fechaInstalacion)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaCotizaciones({ cotizaciones, onNueva, onVer, onEditar, onEliminar, onCambiarEstado }) {
  const colorEstado = { pendiente: "var(--ambar)", aceptada: "var(--verde)", rechazada: "var(--rojo)" };
  const etiquetaEstado = { pendiente: "Pendiente", aceptada: "Aceptada", rechazada: "Rechazada" };

  return (
    <div>
      <div style={estilos.toolbar}>
        <div style={{ flex: 1 }}>
          <div style={estilos.tituloSeccion}>Cotizaciones</div>
          <div style={estilos.subtituloSeccion}>Presupuestos armados para clientes</div>
        </div>
        <button onClick={onNueva} style={estilos.btnPrimario}>
          <Plus size={15} /> Nueva cotización
        </button>
      </div>

      {cotizaciones.length === 0 ? (
        <EstadoVacio mensaje="Todavía no armaste ninguna cotización." />
      ) : (
        <div style={estilos.listaClientes}>
          {cotizaciones.map((c) => (
            <div key={c.id} style={estilos.tarjetaCliente}>
              <div style={estilos.clienteHeader}>
                <div>
                  <div style={estilos.clienteNombre}>{c.cliente_nombre}</div>
                  <div style={estilos.clienteDomicilio}>
                    {c.items.length} producto{c.items.length !== 1 ? "s" : ""} · {formatoFecha(c.creado_en)}
                  </div>
                  <div style={{ ...estilos.tarjetaPrecio, marginTop: 6 }}>{formatoMoneda(c.total)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={{ ...estilos.badgeEstado, color: colorEstado[c.estado], borderColor: colorEstado[c.estado] }}>
                    {etiquetaEstado[c.estado]}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onVer(c)} style={estilos.btnSecundarioChico}>
                      <FileText size={13} /> Ver / PDF
                    </button>
                    <button onClick={() => onEditar(c)} style={estilos.iconBtn} aria-label="Editar cotización">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => onEliminar(c)} style={estilos.iconBtn} aria-label="Eliminar cotización">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
              {c.estado === "pendiente" && (
                <div style={estilos.equiposLista}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => onCambiarEstado(c, "aceptada")} style={{ ...estilos.btnSecundarioChico, color: "var(--verde)" }}>
                      Marcar como aceptada
                    </button>
                    <button onClick={() => onCambiarEstado(c, "rechazada")} style={{ ...estilos.btnSecundarioChico, color: "var(--rojo)" }}>
                      Marcar como rechazada
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function BarraAlertas({ productos, onCerrar }) {
  return (
    <div style={estilos.barraAlertas}>
      <AlertTriangle size={16} color="var(--ambar)" strokeWidth={2} />
      <span style={estilos.alertaTexto}>
        Stock bajo en {productos.length} producto{productos.length > 1 ? "s" : ""}: {productos.slice(0, 3).map((p) => p.nombre).join(", ")}
        {productos.length > 3 ? "…" : ""}
      </span>
      <button onClick={onCerrar} style={estilos.cerrarAvisoFlotante} aria-label="Cerrar aviso">
        <X size={14} />
      </button>
    </div>
  );
}

function EstadoVacio({ mensaje }) {
  return (
    <div style={estilos.estadoVacio}>
      <Package size={32} color="var(--muted)" strokeWidth={1.5} />
      <div style={estilos.estadoVacioTexto}>{mensaje}</div>
    </div>
  );
}

function ModalBase({ titulo, onCerrar, children, ancho }) {
  return (
    <div style={estilos.overlay} onClick={onCerrar}>
      <div style={{ ...estilos.modal, maxWidth: ancho || 480 }} onClick={(e) => e.stopPropagation()}>
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

function ModalProducto({ producto, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    producto || { nombre: "", categoria: CATEGORIAS[0], marca: "", modelo: "", precio: "", stock: "", minimo: "", foto: null }
  );
  const fileRef = useRef(null);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function manejarFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => actualizar("foto", reader.result);
    reader.readAsDataURL(file);
  }

  function enviar() {
    if (!form.nombre.trim()) return;
    onGuardar(form);
  }

  return (
    <ModalBase titulo={producto ? "Editar producto" : "Nuevo producto"} onCerrar={onCerrar}>
      <div style={estilos.formGrid}>
        <div style={{ ...estilos.campoFull, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={estilos.fotoPreview} onClick={() => fileRef.current?.click()}>
            {form.foto ? <img src={form.foto} alt="" style={estilos.imgProducto} /> : <Camera size={20} color="var(--muted)" />}
          </div>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()} style={estilos.btnSecundarioChico}>
              {form.foto ? "Cambiar foto" : "Subir foto"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={manejarFoto} style={{ display: "none" }} />
          </div>
        </div>

        <Campo label="Nombre del producto" full>
          <input value={form.nombre} onChange={(e) => actualizar("nombre", e.target.value)} style={estilos.input} placeholder="Ej: Sensor de movimiento PIR" />
        </Campo>

        <Campo label="Categoría">
          <select value={form.categoria} onChange={(e) => actualizar("categoria", e.target.value)} style={estilos.select}>
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Marca">
          <input value={form.marca} onChange={(e) => actualizar("marca", e.target.value)} style={estilos.input} placeholder="Ej: DSC" />
        </Campo>

        <Campo label="Modelo">
          <input value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)} style={estilos.input} placeholder="Ej: PC1864" />
        </Campo>

        <Campo label="Precio (MXN)">
          <input type="number" value={form.precio} onChange={(e) => actualizar("precio", e.target.value)} style={estilos.input} placeholder="0" />
        </Campo>

        <Campo label="Stock actual">
          <input type="number" value={form.stock} onChange={(e) => actualizar("stock", e.target.value)} style={estilos.input} placeholder="0" />
        </Campo>

        <Campo label="Stock mínimo (alerta)">
          <input type="number" value={form.minimo} onChange={(e) => actualizar("minimo", e.target.value)} style={estilos.input} placeholder="0" />
        </Campo>
      </div>

      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={enviar} style={estilos.btnPrimario}>
          Guardar producto
        </button>
      </div>
    </ModalBase>
  );
}

function ModalMovimiento({ productos, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ productoId: productos[0]?.id || "", tipo: "entrada", cantidad: "", motivo: "" });

  function enviar() {
    if (!form.productoId || !form.cantidad) return;
    onGuardar({ ...form, cantidad: Number(form.cantidad) });
  }

  return (
    <ModalBase titulo="Registrar movimiento" onCerrar={onCerrar}>
      <div style={estilos.formGrid}>
        <Campo label="Producto" full>
          <select value={form.productoId} onChange={(e) => setForm((f) => ({ ...f, productoId: e.target.value }))} style={estilos.select}>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} (stock: {p.stock})
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Tipo de movimiento">
          <div style={estilos.segmentado}>
            <button type="button" onClick={() => setForm((f) => ({ ...f, tipo: "entrada" }))} style={{ ...estilos.segmentoBtn, ...(form.tipo === "entrada" ? estilos.segmentoBtnActivo : {}) }}>
              Entrada
            </button>
            <button type="button" onClick={() => setForm((f) => ({ ...f, tipo: "salida" }))} style={{ ...estilos.segmentoBtn, ...(form.tipo === "salida" ? estilos.segmentoBtnActivoSalida : {}) }}>
              Salida
            </button>
          </div>
        </Campo>

        <Campo label="Cantidad">
          <input type="number" value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} style={estilos.input} placeholder="0" />
        </Campo>

        <Campo label="Motivo" full>
          <input value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} style={estilos.input} placeholder="Ej: Compra a proveedor, instalación cliente X" />
        </Campo>
      </div>

      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={enviar} style={estilos.btnPrimario}>
          Registrar
        </button>
      </div>
    </ModalBase>
  );
}

function ModalCliente({ cliente, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    cliente || {
      nombre: "",
      domicilio: "",
      telefono: "",
      numero_cliente: "",
      cuota_mensual: "",
      estado: "activo",
      frecuencia_pago: "mensual",
      fecha_alta: "",
    }
  );

  function enviar() {
    if (!form.nombre.trim() || !form.domicilio.trim()) return;
    onGuardar(form);
  }

  return (
    <ModalBase titulo={cliente ? "Editar cliente" : "Nuevo cliente"} onCerrar={onCerrar}>
      <div style={estilos.formGrid}>
        <Campo label="Nombre / razón social" full>
          <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} style={estilos.input} placeholder="Ej: Farmacia Don Bosco" />
        </Campo>
        <Campo label="Domicilio" full>
          <input value={form.domicilio} onChange={(e) => setForm((f) => ({ ...f, domicilio: e.target.value }))} style={estilos.input} placeholder="Ej: Av. Reforma 452" />
        </Campo>
        <Campo label="Teléfono">
          <input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} style={estilos.input} placeholder="Ej: 461 123 4567" />
        </Campo>
        <Campo label="Número de cliente (4 dígitos)">
          <input
            value={form.numero_cliente || ""}
            onChange={(e) => setForm((f) => ({ ...f, numero_cliente: e.target.value }))}
            style={estilos.input}
            placeholder="Ej: 1024"
            maxLength={4}
          />
        </Campo>
        <Campo label="Cuota de monitoreo (MXN)">
          <input
            type="number"
            value={form.cuota_mensual || ""}
            onChange={(e) => setForm((f) => ({ ...f, cuota_mensual: e.target.value }))}
            style={estilos.input}
            placeholder="0"
          />
        </Campo>
        <Campo label="Frecuencia de pago">
          <select
            value={form.frecuencia_pago || "mensual"}
            onChange={(e) => setForm((f) => ({ ...f, frecuencia_pago: e.target.value }))}
            style={estilos.select}
          >
            <option value="mensual">Mensual</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </Campo>
        {form.frecuencia_pago !== "mensual" && (
          <Campo label="Fecha de alta (define el mes de cobro)">
            <input
              type="date"
              value={form.fecha_alta || ""}
              onChange={(e) => setForm((f) => ({ ...f, fecha_alta: e.target.value }))}
              style={estilos.input}
            />
          </Campo>
        )}
        <Campo label="Estado">
          <select value={form.estado || "activo"} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} style={estilos.select}>
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
          Guardar cliente
        </button>
      </div>
    </ModalBase>
  );
}

function ModalAsignarEquipo({ cliente, productos, onAsignar, onCerrar }) {
  const [productoId, setProductoId] = useState(productos[0]?.id || "");
  const [cantidad, setCantidad] = useState(1);
  const [esHistorica, setEsHistorica] = useState(false);
  const [fechaInstalacion, setFechaInstalacion] = useState(new Date().toISOString().slice(0, 10));
  const productoSeleccionado = productos.find((p) => p.id === productoId);

  function enviar() {
    if (!productoId || cantidad <= 0) return;
    onAsignar(cliente.id, productoId, Number(cantidad), fechaInstalacion, esHistorica);
  }

  return (
    <ModalBase titulo={`Asignar equipo a ${cliente.nombre}`} onCerrar={onCerrar}>
      <div style={estilos.formGrid}>
        <Campo label="Producto" full>
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)} style={estilos.select}>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} (stock: {p.stock})
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Cantidad a instalar">
          <input
            type="number"
            min="1"
            max={esHistorica ? undefined : productoSeleccionado?.stock || 1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            style={estilos.input}
          />
        </Campo>

        <Campo label="Fecha de instalación" full>
          <input type="date" value={fechaInstalacion} onChange={(e) => setFechaInstalacion(e.target.value)} style={estilos.input} max={new Date().toISOString().slice(0, 10)} />
        </Campo>

        <div style={estilos.campoFull}>
          <label style={estilos.opcionHistorica}>
            <input type="checkbox" checked={esHistorica} onChange={(e) => setEsHistorica(e.target.checked)} />
            <span>
              Es un cliente con equipo ya instalado antes (no descuenta stock ni registra movimiento, solo guarda el registro y la fecha para las alertas
              de mantenimiento)
            </span>
          </label>
        </div>
      </div>
      {!esHistorica && productoSeleccionado && Number(cantidad) > productoSeleccionado.stock && (
        <div style={estilos.avisoError}>No hay stock suficiente. Disponible: {productoSeleccionado.stock}</div>
      )}
      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button
          onClick={enviar}
          style={estilos.btnPrimario}
          disabled={!esHistorica && productoSeleccionado && Number(cantidad) > productoSeleccionado.stock}
        >
          {esHistorica ? "Guardar instalación existente" : "Asignar e instalar"}
        </button>
      </div>
    </ModalBase>
  );
}

function ModalCotizacion({ cotizacion, productos, clientes, onGuardar, onCerrar }) {
  const [clienteNombre, setClienteNombre] = useState(cotizacion?.cliente_nombre || "");
  const [clienteTelefono, setClienteTelefono] = useState(cotizacion?.cliente_telefono || "");
  const [clienteId, setClienteId] = useState(cotizacion?.cliente_id || "");
  const [items, setItems] = useState(
    cotizacion?.items?.length
      ? cotizacion.items
      : []
  );
  const [manoDeObra, setManoDeObra] = useState(cotizacion?.mano_de_obra ?? "");
  const [notas, setNotas] = useState(cotizacion?.notas || "");
  const [productoNuevo, setProductoNuevo] = useState(productos[0]?.id || "");
  const [cantidadNueva, setCantidadNueva] = useState(1);

  function elegirCliente(id) {
    setClienteId(id);
    const c = clientes.find((cl) => cl.id === id);
    if (c) {
      setClienteNombre(c.nombre);
      setClienteTelefono(c.telefono || "");
    }
  }

  function agregarItem() {
    const producto = productos.find((p) => p.id === productoNuevo);
    if (!producto) return;
    const existente = items.find((it) => it.productoId === producto.id);
    if (existente) {
      setItems(items.map((it) => (it.productoId === producto.id ? { ...it, cantidad: it.cantidad + Number(cantidadNueva) } : it)));
    } else {
      setItems([
        ...items,
        { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: Number(cantidadNueva) },
      ]);
    }
    setCantidadNueva(1);
  }

  function quitarItem(productoId) {
    setItems(items.filter((it) => it.productoId !== productoId));
  }

  function cambiarCantidadItem(productoId, delta) {
    setItems(
      items
        .map((it) => (it.productoId === productoId ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it))
        .filter((it) => it.cantidad > 0)
    );
  }

  const totalProductos = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const total = totalProductos + (Number(manoDeObra) || 0);

  function enviar() {
    if (!clienteNombre.trim() || items.length === 0) return;
    onGuardar({
      id: cotizacion?.id,
      clienteId: clienteId || null,
      clienteNombre,
      clienteTelefono,
      items,
      manoDeObra: Number(manoDeObra) || 0,
      estado: cotizacion?.estado,
      notas,
    });
  }

  return (
    <ModalBase titulo={cotizacion ? "Editar cotización" : "Nueva cotización"} onCerrar={onCerrar} ancho={560}>
      <div style={estilos.formGrid}>
        {clientes.length > 0 && (
          <Campo label="Cliente existente (opcional)" full>
            <select
              value={clienteId}
              onChange={(e) => elegirCliente(e.target.value)}
              style={estilos.select}
            >
              <option value="">— Escribir datos manualmente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Campo label="Nombre del cliente">
          <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} style={estilos.input} placeholder="Ej: Farmacia Don Bosco" />
        </Campo>

        <Campo label="Teléfono / WhatsApp">
          <input value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} style={estilos.input} placeholder="Ej: 4621234567" />
        </Campo>
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={estilos.label}>Productos de la cotización</label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <select value={productoNuevo} onChange={(e) => setProductoNuevo(e.target.value)} style={{ ...estilos.select, flex: 1 }}>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({formatoMoneda(p.precio)})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={cantidadNueva}
            onChange={(e) => setCantidadNueva(e.target.value)}
            style={{ ...estilos.input, width: 70 }}
          />
          <button type="button" onClick={agregarItem} style={estilos.btnSecundarioChico}>
            <Plus size={14} /> Agregar
          </button>
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => (
              <div key={it.productoId} style={estilos.filaItemCotizacion}>
                <span style={{ flex: 1, fontSize: 13 }}>{it.nombre}</span>
                <button type="button" onClick={() => cambiarCantidadItem(it.productoId, -1)} style={estilos.iconBtn}>
                  <Minus size={12} />
                </button>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, minWidth: 24, textAlign: "center" }}>{it.cantidad}</span>
                <button type="button" onClick={() => cambiarCantidadItem(it.productoId, 1)} style={estilos.iconBtn}>
                  <Plus size={12} />
                </button>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, minWidth: 90, textAlign: "right" }}>
                  {formatoMoneda(it.precio * it.cantidad)}
                </span>
                <button type="button" onClick={() => quitarItem(it.productoId)} style={estilos.iconBtn}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={estilos.formGrid}>
        <Campo label="Mano de obra / instalación (MXN)" full>
          <input type="number" value={manoDeObra} onChange={(e) => setManoDeObra(e.target.value)} style={estilos.input} placeholder="0" />
        </Campo>
        <Campo label="Notas (opcional)" full>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} style={estilos.input} placeholder="Ej: válida por 15 días, incluye garantía de 1 año" />
        </Campo>
      </div>

      <div style={estilos.resumenTotal}>
        <span>Total cotización</span>
        <span style={estilos.resumenTotalValor}>{formatoMoneda(total)}</span>
      </div>

      <div style={estilos.modalFooter}>
        <button onClick={onCerrar} style={estilos.btnSecundario}>
          Cancelar
        </button>
        <button onClick={enviar} style={estilos.btnPrimario} disabled={!clienteNombre.trim() || items.length === 0}>
          Guardar cotización
        </button>
      </div>
    </ModalBase>
  );
}

function ModalVerCotizacion({ cotizacion, onCerrar }) {
  function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    // Logo (proporción real ~500x254)
    const logoAncho = 45;
    const logoAlto = logoAncho * (254 / 500);
    doc.addImage(LOGO_FBI, "PNG", 14, 10, logoAncho, logoAlto);
    y = 10 + logoAlto + 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text("Cotización de equipo de seguridad", 14, y);
    y += 12;

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(`Cliente: ${cotizacion.cliente_nombre}`, 14, y);
    y += 6;
    doc.setFont(undefined, "normal");
    if (cotizacion.cliente_telefono) {
      doc.text(`Teléfono: ${cotizacion.cliente_telefono}`, 14, y);
      y += 6;
    }
    doc.text(`Fecha: ${formatoFecha(cotizacion.creado_en)}`, 14, y);
    y += 12;

    doc.setFont(undefined, "bold");
    doc.text("Producto", 14, y);
    doc.text("Cant.", 120, y);
    doc.text("Precio unit.", 145, y);
    doc.text("Subtotal", 178, y);
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont(undefined, "normal");

    cotizacion.items.forEach((it) => {
      doc.text(it.nombre.slice(0, 45), 14, y);
      doc.text(String(it.cantidad), 122, y);
      doc.text(formatoMoneda(it.precio), 145, y);
      doc.text(formatoMoneda(it.precio * it.cantidad), 178, y);
      y += 7;
    });

    y += 2;
    doc.line(14, y, 196, y);
    y += 8;

    if (cotizacion.mano_de_obra > 0) {
      doc.text("Mano de obra / instalación", 130, y);
      doc.text(formatoMoneda(cotizacion.mano_de_obra), 178, y);
      y += 8;
    }

    doc.setFont(undefined, "bold");
    doc.setFontSize(13);
    doc.text("Total", 130, y);
    doc.text(formatoMoneda(cotizacion.total), 178, y);
    y += 14;

    if (cotizacion.notas) {
      doc.setFontSize(10);
      doc.setFont(undefined, "italic");
      doc.text(`Notas: ${cotizacion.notas}`, 14, y, { maxWidth: 182 });
    }

    doc.save(`cotizacion-${cotizacion.cliente_nombre.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  }

  function enviarWhatsApp() {
    const telefono = (cotizacion.cliente_telefono || "").replace(/\D/g, "");
    const lista = cotizacion.items.map((it) => `• ${it.nombre} x${it.cantidad} — ${formatoMoneda(it.precio * it.cantidad)}`).join("\n");
    const mensaje =
      `Hola ${cotizacion.cliente_nombre}, te comparto la cotización de FBI Central de Alarmas:\n\n` +
      lista +
      (cotizacion.mano_de_obra > 0 ? `\n\nMano de obra / instalación: ${formatoMoneda(cotizacion.mano_de_obra)}` : "") +
      `\n\nTotal: ${formatoMoneda(cotizacion.total)}` +
      (cotizacion.notas ? `\n\n${cotizacion.notas}` : "");
    const url = telefono
      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  }

  return (
    <ModalBase titulo={`Cotización · ${cotizacion.cliente_nombre}`} onCerrar={onCerrar} ancho={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {cotizacion.items.map((it, i) => (
          <div key={i} style={estilos.filaItemCotizacion}>
            <span style={{ flex: 1, fontSize: 13 }}>{it.nombre}</span>
            <span style={{ fontSize: 12.5, color: "var(--texto-sec)" }}>x{it.cantidad}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, minWidth: 90, textAlign: "right" }}>
              {formatoMoneda(it.precio * it.cantidad)}
            </span>
          </div>
        ))}
        {cotizacion.mano_de_obra > 0 && (
          <div style={estilos.filaItemCotizacion}>
            <span style={{ flex: 1, fontSize: 13, color: "var(--texto-sec)" }}>Mano de obra / instalación</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, minWidth: 90, textAlign: "right" }}>
              {formatoMoneda(cotizacion.mano_de_obra)}
            </span>
          </div>
        )}
      </div>

      <div style={estilos.resumenTotal}>
        <span>Total cotización</span>
        <span style={estilos.resumenTotalValor}>{formatoMoneda(cotizacion.total)}</span>
      </div>

      {cotizacion.notas && <div style={estilos.notasCotizacion}>{cotizacion.notas}</div>}

      <div style={estilos.modalFooter}>
        <button onClick={enviarWhatsApp} style={estilos.btnSecundario}>
          <MessageCircle size={15} /> Enviar por WhatsApp
        </button>
        <button onClick={generarPDF} style={estilos.btnPrimario}>
          <Download size={15} /> Descargar PDF
        </button>
      </div>
    </ModalBase>
  );
}

function ModalConfirmar({ titulo, mensaje, onConfirmar, onCancelar }) {
  return (
    <ModalBase titulo={titulo} onCerrar={onCancelar} ancho={400}>
      <p style={estilos.mensajeConfirmar}>{mensaje}</p>
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
  app: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "var(--bg)",
    color: "var(--texto)",
    minHeight: "100vh",
    "--bg": "#15171A",
    "--superficie": "#1C1F23",
    "--superficie-alta": "#23262B",
    "--borde": "#2D3036",
    "--texto": "#EDEEF0",
    "--texto-sec": "#9BA0A8",
    "--muted": "#6B7077",
    "--ambar": "#D97706",
    "--verde": "#639922",
    "--rojo": "#E24B4A",
    paddingBottom: 40,
  },
  encabezado: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 32px",
    borderBottom: "1px solid var(--borde)",
    flexWrap: "wrap",
    gap: 16,
  },
  marca: { display: "flex", alignItems: "center", gap: 12 },
  logoEncabezado: { height: 30, width: "auto", objectFit: "contain", display: "block" },
  fondoLogo: {
    background: "#FAFAF8",
    borderRadius: 9,
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
  },
  iconoMarca: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: "rgba(217,119,6,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  marcaTitulo: { fontSize: 15, fontWeight: 600, letterSpacing: 0.2 },
  marcaSub: { fontSize: 12, color: "var(--texto-sec)", marginTop: 2 },
  tabs: { display: "flex", gap: 4, background: "var(--superficie)", padding: 4, borderRadius: 10 },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--texto-sec)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  tabBtnActivo: { background: "var(--superficie-alta)", color: "var(--texto)" },
  badgeAlerta: { background: "var(--ambar)", color: "#1A1300", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 6px", marginLeft: 2 },
  btnSalir: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 9,
    border: "1px solid var(--borde)",
    background: "var(--superficie)",
    color: "var(--texto-sec)",
    cursor: "pointer",
  },
  bannerError: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(226,75,74,0.1)",
    color: "var(--rojo)",
    padding: "10px 32px",
    fontSize: 13,
  },
  contenido: { padding: "28px 32px", maxWidth: 1200, margin: "0 auto" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 },
  statCard: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 12, padding: "16px 18px" },
  statLabel: { fontSize: 12, color: "var(--texto-sec)", marginBottom: 6 },
  statValor: { fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
  toolbar: { display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" },
  buscador: { display: "flex", alignItems: "center", gap: 8, background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 9, padding: "9px 12px", flex: 1, minWidth: 220 },
  inputBuscador: { background: "transparent", border: "none", outline: "none", color: "var(--texto)", fontSize: 13.5, width: "100%" },
  select: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 9, padding: "9px 12px", color: "var(--texto)", fontSize: 13.5, outline: "none" },
  btnPrimario: { display: "flex", alignItems: "center", gap: 6, background: "var(--ambar)", color: "#1A1300", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  btnSecundario: { display: "flex", alignItems: "center", gap: 6, background: "var(--superficie)", color: "var(--texto)", border: "1px solid var(--borde)", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 500, cursor: "pointer" },
  btnSecundarioChico: { display: "flex", alignItems: "center", gap: 5, background: "var(--superficie-alta)", color: "var(--texto)", border: "1px solid var(--borde)", borderRadius: 7, padding: "6px 11px", fontSize: 12.5, fontWeight: 500, cursor: "pointer" },
  btnPeligro: { background: "var(--rojo)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  grilla: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 },
  tarjeta: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 12, padding: 14, position: "relative" },
  tarjetaFoto: { width: "100%", height: 110, background: "var(--superficie-alta)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, position: "relative", overflow: "hidden" },
  imgProducto: { width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 },
  puntoEstado: { position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: "50%", border: "2px solid var(--superficie)" },
  tarjetaCuerpo: { marginBottom: 10 },
  tarjetaCategoria: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  tarjetaNombre: { fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 },
  tarjetaMarca: { fontSize: 12.5, color: "var(--texto-sec)", marginBottom: 10 },
  tarjetaFooter: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  tarjetaPrecio: { fontSize: 13.5, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
  tarjetaStock: { fontSize: 12, fontFamily: "'JetBrains Mono', monospace" },
  tarjetaAcciones: { display: "flex", gap: 6, justifyContent: "flex-end", borderTop: "1px solid var(--borde)", paddingTop: 10 },
  iconBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid var(--borde)", background: "var(--superficie-alta)", color: "var(--texto-sec)", cursor: "pointer" },
  estadoVacio: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 0", color: "var(--texto-sec)" },
  estadoVacioTexto: { fontSize: 13.5 },
  tituloSeccion: { fontSize: 16, fontWeight: 600 },
  subtituloSeccion: { fontSize: 13, color: "var(--texto-sec)", marginTop: 3 },
  listaMovimientos: { display: "flex", flexDirection: "column", gap: 8 },
  filaMovimiento: { display: "flex", alignItems: "center", gap: 14, background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 16px" },
  iconoMovimiento: { width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 },
  movProducto: { fontSize: 13.5, fontWeight: 500 },
  movMotivo: { fontSize: 12, color: "var(--texto-sec)", marginTop: 2 },
  movCantidad: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, minWidth: 40, textAlign: "right" },
  movFecha: { fontSize: 12, color: "var(--muted)", minWidth: 80, textAlign: "right" },
  listaClientes: { display: "flex", flexDirection: "column", gap: 12 },
  tarjetaCliente: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 12, padding: 16 },
  clienteHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  clienteNombre: { fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 },
  puntoEstadoCliente: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block" },
  clienteDomicilio: { fontSize: 12.5, color: "var(--texto-sec)", marginTop: 3 },
  clienteTelefono: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  equiposLista: { display: "flex", flexDirection: "column", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--borde)" },
  equipoItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  equipoCantidad: { fontFamily: "'JetBrains Mono', monospace", color: "var(--texto-sec)", marginLeft: "auto" },
  barraAlertas: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--superficie-alta)", border: "1px solid var(--ambar)", borderRadius: 10, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, maxWidth: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  alertaTexto: { fontSize: 12.5, color: "var(--texto)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  modal: { background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 14, width: "100%", maxHeight: "85vh", overflow: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--borde)" },
  modalTitulo: { fontSize: 15, fontWeight: 600 },
  modalCuerpo: { padding: 20 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  campo: { display: "flex", flexDirection: "column", gap: 6 },
  campoFull: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" },
  label: { fontSize: 12, color: "var(--texto-sec)", fontWeight: 500 },
  input: { background: "var(--superficie-alta)", border: "1px solid var(--borde)", borderRadius: 8, padding: "9px 12px", color: "var(--texto)", fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box" },
  fotoPreview: { width: 64, height: 64, borderRadius: 10, background: "var(--superficie-alta)", border: "1px solid var(--borde)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 },
  segmentado: { display: "flex", background: "var(--superficie-alta)", borderRadius: 8, padding: 3, border: "1px solid var(--borde)" },
  segmentoBtn: { flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: "transparent", color: "var(--texto-sec)", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  segmentoBtnActivo: { background: "var(--verde)", color: "#0F1B03" },
  segmentoBtnActivoSalida: { background: "var(--rojo)", color: "#3A0A0A" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--borde)" },
  mensajeConfirmar: { fontSize: 13.5, color: "var(--texto-sec)", lineHeight: 1.6 },
  avisoError: { fontSize: 12.5, color: "var(--rojo)", marginTop: 10 },
  opcionHistorica: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    fontSize: 12.5,
    color: "var(--texto-sec)",
    lineHeight: 1.5,
    cursor: "pointer",
  },
  badgeEstado: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 20,
    border: "1px solid",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  filaItemCotizacion: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--superficie-alta)",
    border: "1px solid var(--borde)",
    borderRadius: 8,
    padding: "8px 10px",
  },
  resumenTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--superficie-alta)",
    border: "1px solid var(--ambar)",
    borderRadius: 10,
    padding: "12px 16px",
    marginTop: 16,
    fontSize: 13.5,
    fontWeight: 600,
  },
  resumenTotalValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 17, color: "var(--ambar)" },
  notasCotizacion: { fontSize: 12.5, color: "var(--texto-sec)", marginTop: 14, fontStyle: "italic" },
  avisoMantenimiento: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "rgba(217,119,6,0.08)",
    border: "1px solid var(--ambar)",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 20,
  },
  avisoMantenimientoTitulo: { fontSize: 13, fontWeight: 600, color: "var(--texto)" },
  avisoMantenimientoTexto: { fontSize: 12.5, color: "var(--texto-sec)", marginTop: 3 },
  cerrarAviso: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--texto-sec)",
    cursor: "pointer",
    flexShrink: 0,
  },
  cerrarAvisoFlotante: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--texto-sec)",
    cursor: "pointer",
    flexShrink: 0,
    marginLeft: 4,
  },
  selectorReporte: { display: "flex", gap: 10, alignItems: "center" },
};
