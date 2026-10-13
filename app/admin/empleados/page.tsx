'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Empleado {
  id: string
  cuil: string
  nombre_completo: string
  email: string
  localidad: string
  zona_id: string
  rol: string
  activo: boolean
  fecha_ingreso: string
  legajo?: string
  categoria?: string
  obra_social?: string
  created_at: string
}

interface Zona {
  id: string
  nombre: string
}

interface Recibo {
  id: string
  periodo: string
  quincena: string
  tipo_recibo: string
  neto_a_cobrar: number
  sueldo_bruto: number
  costo_total_empleador: number
  estado_firma: string
  created_at: string
}

interface Incentivo {
  id: string
  periodo: string
  monto_bruto: number
  created_at: string
}

interface Adelanto {
  id: string
  tipo: string
  monto_solicitado: number
  estado: string
  fecha_solicitud: string
  periodo: string
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [empleadoEditando, setEmpleadoEditando] = useState<Empleado | null>(null)
  const [empleadoViendo, setEmpleadoViendo] = useState<Empleado | null>(null)
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false)
  const [mostrarModalVer, setMostrarModalVer] = useState(false)
  
  // Datos de la ficha completa
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [incentivos, setIncentivos] = useState<Incentivo[]>([])
  const [adelantos, setAdelantos] = useState<Adelanto[]>([])
  const [ultimoRecibo, setUltimoRecibo] = useState<Recibo | null>(null)
  const [cargandoFicha, setCargandoFicha] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre_completo')

      const { data: zonasData } = await supabase
        .from('zonas')
        .select('id, nombre')
        .order('nombre')

      setEmpleados(empleadosData || [])
      setZonas(zonasData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarFichaCompleta = async (empleadoId: string) => {
    setCargandoFicha(true)
    try {
      // Recibos del empleado
      const { data: recibosData } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })
        .order('quincena', { ascending: false })

      // Incentivos del empleado
      const { data: incentivosData } = await supabase
        .from('incentivos')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })

      // Adelantos del empleado
      const { data: adelantosData } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('fecha_solicitud', { ascending: false })

      setRecibos(recibosData || [])
      setIncentivos(incentivosData || [])
      setAdelantos(adelantosData || [])
      
      if (recibosData && recibosData.length > 0) {
        setUltimoRecibo(recibosData[0])
      } else {
        setUltimoRecibo(null)
      }
    } catch (error) {
      console.error('Error cargando ficha:', error)
    } finally {
      setCargandoFicha(false)
    }
  }

  const handleVer = async (empleado: Empleado) => {
    setEmpleadoViendo(empleado)
    setMostrarModalVer(true)
    await cargarFichaCompleta(empleado.id)
  }

  const handleEditar = (empleado: Empleado) => {
    setEmpleadoEditando(empleado)
    setMostrarModalEditar(true)
  }

  const handleGuardar = async () => {
    if (!empleadoEditando) return

    try {
      const { error } = await supabase
        .from('empleados')
        .update({
          nombre_completo: empleadoEditando.nombre_completo,
          cuil: empleadoEditando.cuil,
          email: empleadoEditando.email,
          localidad: empleadoEditando.localidad,
          zona_id: empleadoEditando.zona_id,
          rol: empleadoEditando.rol,
          activo: empleadoEditando.activo,
          fecha_ingreso: empleadoEditando.fecha_ingreso,
          legajo: empleadoEditando.legajo,
          categoria: empleadoEditando.categoria,
          obra_social: empleadoEditando.obra_social
        })
        .eq('id', empleadoEditando.id)

      if (error) throw error

      alert('✅ Empleado actualizado correctamente')
      setMostrarModalEditar(false)
      setEmpleadoEditando(null)
      cargarDatos()
    } catch (error: any) {
      console.error('Error actualizando empleado:', error)
      alert(`❌ Error: ${error.message}`)
    }
  }

  const empleadosFiltrados = empleados.filter(emp => {
    const coincideBusqueda = emp.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
                            emp.cuil.includes(busqueda) ||
                            (emp.legajo && emp.legajo.includes(busqueda))
    const coincideActivo = filtroActivo === 'todos' || 
                          (filtroActivo === 'activo' && emp.activo) ||
                          (filtroActivo === 'inactivo' && !emp.activo)
    return coincideBusqueda && coincideActivo
  })

  const getZonaNombre = (zona_id: string) => {
    const zona = zonas.find(z => z.id === zona_id)
    return zona?.nombre || '-'
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-AR')
  }

  const formatMoney = (amount: number) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getNombrePeriodo = (periodo: string) => {
    if (!periodo) return '-'
    const [year, month] = periodo.split('-')
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${meses[parseInt(month) - 1] || month} ${year}`
  }

  const getEstadoFirmaColor = (estado: string) => {
    switch (estado) {
      case 'firmado': return 'bg-green-100 text-green-800'
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'rechazado': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEstadoAdelantoColor = (estado: string) => {
    switch (estado) {
      case 'aprobado': return 'bg-green-100 text-green-800'
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'rechazado': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900"> Gestionar Empleados</h1>
          <p className="text-gray-600 mt-1">Administra la información de todos los empleados</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Buscar</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, CUIL o Legajo..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Estado</label>
              <select
                value={filtroActivo}
                onChange={(e) => setFiltroActivo(e.target.value as any)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">CUIL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Legajo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Localidad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rol</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.nombre_completo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{emp.cuil}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.legajo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.localidad || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.rol || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleVer(emp)}
                          className="text-gray-600 hover:text-gray-800 font-medium text-sm"
                          title="Ver ficha completa"
                        >
                          ️
                        </button>
                        <button
                          onClick={() => handleEditar(emp)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          title="Editar"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Vista - Ficha Completa */}
        {mostrarModalVer && empleadoViendo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold">📋 Ficha Completa del Empleado</h2>
                    <p className="text-blue-100 mt-1 text-lg">{empleadoViendo.nombre_completo}</p>
                    <p className="text-blue-200 text-sm">CUIL: {empleadoViendo.cuil} {empleadoViendo.legajo && `• Legajo: ${empleadoViendo.legajo}`}</p>
                  </div>
                  <button
                    onClick={() => { setMostrarModalVer(false); setEmpleadoViendo(null); }}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {cargandoFicha ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  
                  {/* RESUMEN FINANCIERO ACTUAL */}
                  {ultimoRecibo && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                        💰 Resumen Financiero Actual
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-green-600 uppercase">Sueldo Neto</p>
                          <p className="text-2xl font-bold text-green-700">{formatMoney(ultimoRecibo.neto_a_cobrar)}</p>
                          <p className="text-xs text-green-600 mt-1">{getNombrePeriodo(ultimoRecibo.periodo)} - {ultimoRecibo.quincena}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-blue-600 uppercase">Sueldo Bruto</p>
                          <p className="text-2xl font-bold text-blue-700">{formatMoney(ultimoRecibo.sueldo_bruto)}</p>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-orange-600 uppercase">Costo Empleador</p>
                          <p className="text-2xl font-bold text-orange-700">{formatMoney(ultimoRecibo.costo_total_empleador)}</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-purple-600 uppercase">Aportes + Contrib.</p>
                          <p className="text-2xl font-bold text-purple-700">{formatMoney(ultimoRecibo.costo_total_empleador - ultimoRecibo.neto_a_cobrar)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* INFORMACIÓN PERSONAL */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      📝 Información Personal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nombre Completo</label>
                        <p className="text-sm text-gray-900 font-medium">{empleadoViendo.nombre_completo}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">CUIL</label>
                        <p className="text-sm text-gray-900 font-mono">{empleadoViendo.cuil}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                        <p className="text-sm text-gray-900">{empleadoViendo.email || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Legajo</label>
                        <p className="text-sm text-gray-900">{empleadoViendo.legajo || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* INFORMACIÓN LABORAL */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      💼 Información Laboral
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Localidad</label>
                        <p className="text-sm text-gray-900">{empleadoViendo.localidad || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Zona</label>
                        <p className="text-sm text-gray-900">{getZonaNombre(empleadoViendo.zona_id)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rol</label>
                        <p className="text-sm text-gray-900">{empleadoViendo.rol || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Categoría</label>
                        <p className="text-sm text-gray-900">{empleadoViendo.categoria || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Obra Social</label>
                        <p className="text-sm text-gray-900">{empleadoViendo.obra_social || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Fecha de Ingreso</label>
                        <p className="text-sm text-gray-900">{formatDate(empleadoViendo.fecha_ingreso)}</p>
                      </div>
                    </div>
                  </div>

                  {/* HISTORIAL DE RECIBOS */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      📄 Historial de Recibos ({recibos.length})
                    </h3>
                    {recibos.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay recibos registrados</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Período</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Quincena</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Neto</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Bruto</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Firma</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {recibos.slice(0, 10).map((recibo) => (
                              <tr key={recibo.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{getNombrePeriodo(recibo.periodo)}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{recibo.quincena}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{recibo.tipo_recibo}</td>
                                <td className="px-3 py-2 text-sm text-right font-mono font-medium text-green-700">{formatMoney(recibo.neto_a_cobrar)}</td>
                                <td className="px-3 py-2 text-sm text-right font-mono text-gray-600">{formatMoney(recibo.sueldo_bruto)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEstadoFirmaColor(recibo.estado_firma)}`}>
                                    {recibo.estado_firma}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {recibos.length > 10 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">Mostrando los 10 más recientes de {recibos.length} recibos</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* INCENTIVOS */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      🎯 Incentivos ({incentivos.length})
                    </h3>
                    {incentivos.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay incentivos registrados</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Período</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Monto Bruto</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {incentivos.map((inc) => (
                              <tr key={inc.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{getNombrePeriodo(inc.periodo)}</td>
                                <td className="px-3 py-2 text-sm text-right font-mono font-medium text-purple-700">{formatMoney(inc.monto_bruto)}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{formatDate(inc.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ADELANTOS Y PRÉSTAMOS */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      💸 Adelantos y Préstamos ({adelantos.length})
                    </h3>
                    {adelantos.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay adelantos o préstamos registrados</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Período</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Monto</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Fecha Solicitud</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {adelantos.map((ad) => (
                              <tr key={ad.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{ad.tipo}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{getNombrePeriodo(ad.periodo)}</td>
                                <td className="px-3 py-2 text-sm text-right font-mono font-medium text-orange-700">{formatMoney(ad.monto_solicitado)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEstadoAdelantoColor(ad.estado)}`}>
                                    {ad.estado}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">{formatDate(ad.fecha_solicitud)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ESTADO Y METADATA */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          empleadoViendo.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {empleadoViendo.activo ? '✅ Activo' : '❌ Inactivo'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Registrado el: {formatDate(empleadoViendo.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 p-6 flex gap-3 sticky bottom-0 bg-white">
                <button
                  onClick={() => {
                    setMostrarModalVer(false)
                    setEmpleadoViendo(null)
                    handleEditar(empleadoViendo)
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  ✏️ Editar Empleado
                </button>
                <button
                  onClick={() => { setMostrarModalVer(false); setEmpleadoViendo(null); }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edición */}
        {mostrarModalEditar && empleadoEditando && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                <h2 className="text-2xl font-bold">✏️ Editar Empleado</h2>
                <p className="text-blue-100 mt-1">Modificá la información del empleado</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo *</label>
                  <input
                    type="text"
                    value={empleadoEditando.nombre_completo}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, nombre_completo: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">CUIL *</label>
                  <input
                    type="text"
                    value={empleadoEditando.cuil}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, cuil: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Legajo</label>
                  <input
                    type="text"
                    value={empleadoEditando.legajo || ''}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, legajo: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={empleadoEditando.email}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, email: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Localidad</label>
                  <input
                    type="text"
                    value={empleadoEditando.localidad}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, localidad: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Zona</label>
                  <select
                    value={empleadoEditando.zona_id}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, zona_id: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar zona...</option>
                    {zonas.map(zona => (
                      <option key={zona.id} value={zona.id}>{zona.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                  <select
                    value={empleadoEditando.rol}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, rol: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="empleado">Empleado</option>
                    <option value="admin">Administrador</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>
                  <input
                    type="text"
                    value={empleadoEditando.categoria || ''}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, categoria: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Administrativo Cat A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Obra Social</label>
                  <input
                    type="text"
                    value={empleadoEditando.obra_social || ''}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, obra_social: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: OSECAC"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={empleadoEditando.fecha_ingreso}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, fecha_ingreso: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={empleadoEditando.activo}
                    onChange={(e) => setEmpleadoEditando({...empleadoEditando, activo: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                    Empleado activo
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 p-6 flex gap-3">
                <button
                  onClick={handleGuardar}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  💾 Guardar Cambios
                </button>
                <button
                  onClick={() => { setMostrarModalEditar(false); setEmpleadoEditando(null); }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}