import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [modoRegistro, setModoRegistro] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('pedidos');
  
  // Estados de datos
  const [pedidos, setPedidos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [postventa, setPostventa] = useState([]);

  // Formulario de Pedidos
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevoServicio, setNuevoServicio] = useState('Cámaras de videovigilancia');
  const [nuevaZona, setNuevaZona] = useState('Norte');
  const [tieneDeudas, setTieneDeudas] = useState(false);
  
  const tecnicos = ['Carlos Ruiz', 'Ana Torres', 'Luis Mendoza'];
  const [notificacionesProveedor, setNotificacionesProveedor] = useState([]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchDatos();
    }
  }, [isLoggedIn]);

  const fetchDatos = async () => {
    const { data: dataPedidos } = await supabase.from('pedidos').select('*');
    if (dataPedidos) setPedidos(dataPedidos);

    const { data: dataOrdenes } = await supabase.from('ordenes_instalacion').select('*');
    if (dataOrdenes) setOrdenes(dataOrdenes);

    const { data: dataInventario } = await supabase.from('inventario').select('*');
    if (dataInventario) setInventario(dataInventario);

    const { data: dataFacturas } = await supabase.from('facturas').select('*');
    if (dataFacturas) setFacturas(dataFacturas);

    const { data: dataPostventa } = await supabase.from('postventa').select('*');
    if (dataPostventa) setPostventa(dataPostventa);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      setErrorMsg('Correo o contraseña incorrectos.');
    } else {
      setIsLoggedIn(true);
      setUsuarioActual(data);
      // Si es admin, puede ir directo al dashboard si lo desea
      setActiveTab(data.rol === 'admin' ? 'dashboard' : 'pedidos');
    }
    setLoading(false);
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase
      .from('usuarios')
      .insert([{ email, password, nombre, rol: 'cliente' }]);

    if (error) {
      setErrorMsg('El correo ya está registrado o hubo un error.');
    } else {
      setSuccessMsg('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
      setModoRegistro(false);
      setPassword('');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsuarioActual(null);
    setEmail('');
    setPassword('');
    setNombre('');
  };

  const handleCrearPedido = async (e) => {
    e.preventDefault();
    const clienteNombre = usuarioActual.rol === 'admin' ? nuevoCliente : usuarioActual.nombre;
    if (!clienteNombre) return;

    const { error } = await supabase.from('pedidos').insert([
      { cliente: clienteNombre, servicio: nuevoServicio, zona: nuevaZona, deudas: tieneDeudas, estado: 'Pendiente' }
    ]);

    if (!error) {
      setNuevoCliente('');
      fetchDatos();
      alert('Pedido enviado correctamente.');
    } else {
      alert('Error al crear pedido: ' + error.message);
    }
  };

  const evaluarPedido = async (id, aprobar, pedido) => {
    if (usuarioActual.rol !== 'admin') return;
    const nuevoEstado = aprobar && !pedido.deudas ? 'Aprobado' : 'Rechazado';
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id);

    if (nuevoEstado === 'Aprobado') {
      await supabase.from('ordenes_instalacion').insert([
        { pedido_id: id, cliente: pedido.cliente, servicio: pedido.servicio, zona: pedido.zona, estado_progreso: 'Programado' }
      ]);
    }
    fetchDatos();
  };

  const asignarTecnicoOrden = async (idOrden, tecnico) => {
    if (usuarioActual.rol !== 'admin') return;
    await supabase.from('ordenes_instalacion').update({ tecnico: tecnico }).eq('id', idOrden);
    fetchDatos();
  };

  const finalizarInstalacion = async (orden) => {
    if (usuarioActual.rol !== 'admin') return;
    await supabase.from('ordenes_instalacion').update({ estado_progreso: 'Instalado y Facturado' }).eq('id', orden.id);
    
    await supabase.from('facturas').insert([
      { orden_id: orden.id, cliente: orden.cliente, servicio: orden.servicio, monto: 150 }
    ]);

    await supabase.from('postventa').insert([
      { orden_id: orden.id, cliente: orden.cliente, servicio: orden.servicio, estado: 'Pendiente de Contacto' }
    ]);

    fetchDatos();
  };

  const verificarYReponer = async (idProd, prodNombre, stockActual) => {
    if (usuarioActual.rol !== 'admin') return;
    const nuevoStock = stockActual + 10;
    await supabase.from('inventario').update({ stock: nuevoStock }).eq('id', idProd);
    setNotificacionesProveedor(prev => [...prev, `Reposición solicitada para: ${prodNombre}`]);
    fetchDatos();
  };

  const registrarEncuesta = async (idPost, cal) => {
    await supabase.from('postventa').update({ estado: `Completado - Satisfacción: ${cal}/5` }).eq('id', idPost);
    fetchDatos();
  };

  const inputClass = "w-full mt-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all";

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
              <span className="w-4 h-4 bg-white rounded-full"></span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">TecnoInnova S.A.</h1>
            <p className="text-slate-400 text-sm mt-1">{modoRegistro ? 'Crea tu cuenta básica de cliente' : 'Inicia sesión en tu cuenta'}</p>
          </div>

          {errorMsg && <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-medium text-center">{errorMsg}</div>}
          {successMsg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-medium text-center">{successMsg}</div>}

          {!modoRegistro ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Correo Electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 font-semibold text-sm shadow-md transition-all mt-2">
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => { setModoRegistro(true); setErrorMsg(''); setSuccessMsg(''); }} className="text-xs font-semibold text-blue-600 hover:underline">
                  ¿No tienes cuenta? Regístrate aquí
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegistro} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre Completo / Empresa</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required className={inputClass} placeholder="Ej. Carlos Silva" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Correo Electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 font-semibold text-sm shadow-md transition-all mt-2">
                {loading ? 'Registrando...' : 'Crear Cuenta Básica'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => { setModoRegistro(false); setErrorMsg(''); setSuccessMsg(''); }} className="text-xs font-semibold text-slate-500 hover:underline">
                  ← Volver al Iniciar Sesión
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isAdmin = usuarioActual?.rol === 'admin';
  const pedidosVisibles = isAdmin ? pedidos : pedidos.filter(p => p.cliente === usuarioActual.nombre);
  const ordenesVisibles = isAdmin ? ordenes : ordenes.filter(o => o.cliente === usuarioActual.nombre);
  const facturasVisibles = isAdmin ? facturas : facturas.filter(f => f.cliente === usuarioActual.nombre);
  const postventaVisibles = isAdmin ? postventa : postventa.filter(p => p.cliente === usuarioActual.nombre);

  // CÁLCULOS ESTADÍSTICOS PARA EL DASHBOARD DEL ADMIN
  const totalPedidos = pedidos.length;
  const pedidosAprobados = pedidos.filter(p => p.estado === 'Aprobado').length;
  const pedidosRechazados = pedidos.filter(p => p.estado === 'Rechazado').length;
  const pedidosPendientes = pedidos.filter(p => p.estado === 'Pendiente').length;
  
  const totalFacturado = facturas.reduce((acc, f) => acc + Number(f.monto || 0), 0);
  const totalInstalaciones = ordenes.length;
  const instalacionesCompletadas = ordenes.filter(o => o.estado_progreso === 'Instalado y Facturado').length;

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 md:p-8 font-sans text-slate-700">
      <div className="max-w-7xl mx-auto bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden border border-slate-100">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-100 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">TecnoInnova S.A.</h1>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              Sesión: <span className="font-semibold text-slate-700">{usuarioActual?.nombre || usuarioActual?.email}</span> 
              <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {isAdmin ? 'Administrador' : 'Cliente'}
              </span>
            </p>
          </div>
          <button onClick={handleLogout} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-rose-50 hover:text-rose-600 transition-colors border">
            Cerrar Sesión
          </button>
        </header>

        {/* NAVEGACIÓN */}
        <nav className="flex flex-wrap gap-2 px-8 py-4 bg-slate-50/50 border-b border-slate-100">
          {isAdmin && (
            <button onClick={() => setActiveTab('dashboard')} className={`py-2 px-5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}>
              📊 Dashboard Estadístico
            </button>
          )}
          <button onClick={() => setActiveTab('pedidos')} className={`py-2 px-5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'pedidos' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}>
            1. Pedidos
          </button>
          <button onClick={() => setActiveTab('instalaciones')} className={`py-2 px-5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'instalaciones' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}>
            2. Instalaciones
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('inventario')} className={`py-2 px-5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'inventario' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}>
              3. Inventario (Admin)
            </button>
          )}
          <button onClick={() => setActiveTab('facturacion')} className={`py-2 px-5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'facturacion' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}>
            4. Facturación
          </button>
          <button onClick={() => setActiveTab('postventa')} className={`py-2 px-5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'postventa' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}>
            5. Postventa
          </button>
        </nav>

        {/* CONTENIDO PRINCIPAL */}
        <main className="p-8">
          
          {/* MÓDULO NUEVO: DASHBOARD ESTADÍSTICO (EXCLUSIVO ADMIN) */}
          {activeTab === 'dashboard' && isAdmin && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Dashboard y Métricas del Sistema</h2>
                <p className="text-slate-400 text-sm">Resumen analítico de desempeño operativo, financiero y comercial de TecnoInnova S.A.</p>
              </div>

              {/* Tarjetas KPI Superiores */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-3xl shadow-lg shadow-blue-200">
                  <p className="text-xs uppercase font-bold tracking-wider opacity-80">Total Pedidos</p>
                  <h3 className="text-3xl font-extrabold mt-2">{totalPedidos}</h3>
                  <p className="text-xs mt-2 opacity-95">Solicitudes ingresadas en plataforma</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 rounded-3xl shadow-lg shadow-emerald-200">
                  <p className="text-xs uppercase font-bold tracking-wider opacity-80">Ingresos Facturados</p>
                  <h3 className="text-3xl font-extrabold mt-2">${totalFacturado} USD</h3>
                  <p className="text-xs mt-2 opacity-95">Monto total de instalaciones cobradas</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-3xl shadow-lg shadow-purple-200">
                  <p className="text-xs uppercase font-bold tracking-wider opacity-80">Instalaciones Exitosas</p>
                  <h3 className="text-3xl font-extrabold mt-2">{instalacionesCompletadas} / {totalInstalaciones}</h3>
                  <p className="text-xs mt-2 opacity-95">Órdenes cerradas satisfactoriamente</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-3xl shadow-lg shadow-amber-200">
                  <p className="text-xs uppercase font-bold tracking-wider opacity-80">Evaluaciones Postventa</p>
                  <h3 className="text-3xl font-extrabold mt-2">{postventa.length}</h3>
                  <p className="text-xs mt-2 opacity-95">Seguimientos de satisfacción activos</p>
                </div>
              </div>

              {/* Gráficos Estadísticos Visuales */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Gráfico 1: Estado de Pedidos */}
                <div className="bg-slate-50/70 border border-slate-200/80 p-6 rounded-3xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Distribución de Pedidos por Estado</h3>
                  <p className="text-xs text-slate-400 mb-6">Proporción analítica de aprobaciones, rechazos y pendientes.</p>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-emerald-700">Aprobados ({pedidosAprobados})</span>
                        <span>{totalPedidos ? Math.round((pedidosAprobados / totalPedidos) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalPedidos ? (pedidosAprobados / totalPedidos) * 100 : 0}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-amber-700">Pendientes de Evaluación ({pedidosPendientes})</span>
                        <span>{totalPedidos ? Math.round((pedidosPendientes / totalPedidos) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalPedidos ? (pedidosPendientes / totalPedidos) * 100 : 0}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-rose-700">Rechazados ({pedidosRechazados})</span>
                        <span>{totalPedidos ? Math.round((pedidosRechazados / totalPedidos) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalPedidos ? (pedidosRechazados / totalPedidos) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gráfico 2: Stock Crítico de Inventario */}
                <div className="bg-slate-50/70 border border-slate-200/80 p-6 rounded-3xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Monitoreo de Stock en Inventario</h3>
                  <p className="text-xs text-slate-400 mb-6">Niveles actuales frente al stock mínimo requerido.</p>
                  
                  <div className="space-y-4">
                    {inventario.map(item => {
                      const porcentaje = Math.min(Math.round((item.stock / (item.minimo * 2)) * 100), 100);
                      const esBajo = item.stock < item.minimo;
                      return (
                        <div key={item.id}>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-700">{item.producto}</span>
                            <span className={esBajo ? 'text-rose-600 font-extrabold' : 'text-emerald-600'}>
                              {item.stock} u. {esBajo ? '(Stock Bajo)' : ''}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${esBajo ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${porcentaje}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* MÓDULO 1: PEDIDOS */}
          {activeTab === 'pedidos' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Gestión de Pedidos</h2>
                <p className="text-slate-400 text-sm">{isAdmin ? 'Panel de administración general de pedidos.' : 'Envía tus solicitudes y consulta su estado actual.'}</p>
              </div>
              
              <form onSubmit={handleCrearPedido} className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-end">
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</label>
                    <input type="text" value={nuevoCliente} onChange={e => setNuevoCliente(e.target.value)} required className={inputClass} placeholder="Nombre cliente" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Servicio</label>
                  <select value={nuevoServicio} onChange={e => setNuevoServicio(e.target.value)} className={inputClass}>
                    <option value="Cámaras de videovigilancia">Cámaras de videovigilancia</option>
                    <option value="Sensores de movimiento">Sensores de movimiento</option>
                    <option value="Sistema de Alarmas">Sistema de Alarmas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Zona</label>
                  <select value={nuevaZona} onChange={e => setNuevaZona(e.target.value)} className={inputClass}>
                    <option value="Norte">Norte</option>
                    <option value="Sur">Sur</option>
                    <option value="Centro">Centro</option>
                  </select>
                </div>
                {isAdmin && (
                  <div className="flex h-full items-center">
                    <label className="flex items-center space-x-2.5 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-slate-200 w-full">
                      <input type="checkbox" checked={tieneDeudas} onChange={e => setTieneDeudas(e.target.checked)} className="h-4 w-4 rounded text-blue-600 border-slate-300" />
                      <span className="text-sm font-medium text-slate-700">Tiene Deudas</span>
                    </label>
                  </div>
                )}
                <div>
                  <button type="submit" className="w-full bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 font-semibold text-sm shadow-md transition-all">
                    Enviar Solicitud
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Servicio</th>
                        <th className="p-4">Zona</th>
                        <th className="p-4">Estado</th>
                        {isAdmin && <th className="p-4 text-right">Acciones Admin</th>}
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {pedidosVisibles.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-semibold text-slate-800">{p.cliente}</td>
                          <td className="p-4 text-slate-600">{p.servicio}</td>
                          <td className="p-4 text-slate-600"><span className="bg-slate-100 px-2.5 py-1 rounded-lg text-xs">{p.zona}</span></td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${p.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-800' : p.estado === 'Rechazado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                              {p.estado}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-right space-x-2">
                              {p.estado === 'Pendiente' && (
                                <>
                                  <button onClick={() => evaluarPedido(p.id, true, p)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Aprobar</button>
                                  <button onClick={() => evaluarPedido(p.id, false, p)} className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Rechazar</button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO 2: INSTALACIONES */}
          {activeTab === 'instalaciones' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Visitas e Instalaciones Técnicas</h2>
                <p className="text-slate-400 text-sm">Consulta la programación y el técnico asignado a tu domicilio.</p>
              </div>

              <div className="grid gap-4">
                {ordenesVisibles.map(o => (
                  <div key={o.id} className="bg-slate-50/60 border border-slate-200/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-base text-slate-800">{o.servicio}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">Cliente: <span className="font-semibold text-slate-700">{o.cliente}</span></p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-600">Zona: <b>{o.zona}</b></span>
                        <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-600">Técnico: <b className="text-blue-600">{o.tecnico || 'Pendiente de asignar'}</b></span>
                        <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-600">Progreso: <b className="text-amber-600">{o.estado_progreso}</b></span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <select value={o.tecnico || ''} onChange={e => asignarTecnicoOrden(o.id, e.target.value)} className="px-3 py-2 bg-white border rounded-xl text-sm">
                          <option value="">Seleccionar Técnico...</option>
                          {tecnicos.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                        </select>
                        {o.estado_progreso !== 'Instalado y Facturado' && (
                          <button onClick={() => finalizarInstalacion(o)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Completar</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MÓDULO 3: INVENTARIO (ADMIN) */}
          {activeTab === 'inventario' && isAdmin && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Control de Inventario (Exclusivo Administrador)</h2>
                <p className="text-slate-400 text-sm">Monitoreo interno de equipos y proveedores.</p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b text-slate-400 text-xs font-bold uppercase">
                      <th className="p-4">Producto</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Mínimo</th>
                      <th className="p-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y">
                    {inventario.map(item => (
                      <tr key={item.id}>
                        <td className="p-4 font-semibold">{item.producto}</td>
                        <td className="p-4">{item.stock} unidades</td>
                        <td className="p-4">{item.minimo} unidades</td>
                        <td className="p-4 text-right">
                          {item.stock < item.minimo && (
                            <button onClick={() => verificarYReponer(item.id, item.producto, item.stock)} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Reponer</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MÓDULO 4: FACTURACIÓN */}
          {activeTab === 'facturacion' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Facturación y Descarga de Documentos</h2>
                <p className="text-slate-400 text-sm">Accede a tus comprobantes de pago emitidos.</p>
              </div>

              <div className="grid gap-4">
                {facturasVisibles.map(f => (
                  <div key={f.id} className="bg-slate-50/60 border p-5 rounded-2xl flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800">Factura #{f.id} - {f.cliente}</h3>
                      <p className="text-sm text-slate-500">Servicio: {f.servicio} | Monto: <b>${f.monto} USD</b></p>
                    </div>
                    <button onClick={() => alert('Simulando descarga de PDF de factura...')} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold">Descargar Factura PDF</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MÓDULO 5: POSTVENTA */}
          {activeTab === 'postventa' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Sección Postventa y Satisfacción</h2>
                <p className="text-slate-400 text-sm">Responde encuestas o deja sugerencias sobre tu servicio.</p>
              </div>

              <div className="grid gap-4">
                {postventaVisibles.map(p => (
                  <div key={p.id} className="bg-slate-50/60 border p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800">Servicio: {p.servicio}</h3>
                      <p className="text-xs font-semibold text-blue-600 mt-1">{p.estado}</p>
                    </div>
                    <select onChange={e => registrarEncuesta(p.id, e.target.value)} className="px-3.5 py-2 bg-white border rounded-xl text-sm" defaultValue="">
                      <option value="" disabled>Calificar Servicio...</option>
                      <option value="1">1 - Deficiente</option>
                      <option value="3">3 - Bueno</option>
                      <option value="5">5 - Excelente</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;