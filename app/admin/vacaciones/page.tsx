'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

const TIPOS_LICENCIA = [
  { value: 'vacaciones', label: 'Vacaciones', icon: '🏖️', color: 'blue' },
  { value: 'licencia_medica', label: 'Licencia Médica', icon: '🏥', color: 'red' },
  { value: 'licencia_familiar', label: 'Licencia Familiar', icon: '👨‍‍', color: 'purple' },
  { value: 'dia_libre', label: 'Día Libre', icon: '📅', color: 'green' },
  { value: 'duelo', label: 'Licencia por Duelo', icon: '🕊️', color: 'gray' },
  { value: 'matrimonio', label: 'Licencia por Matrimonio', icon: '💍', color: 'pink' },
  { value: 'nacimiento', label: 'Licencia por Nacimiento', icon: '👶', color: 'yellow' },
]

export default function AdminVacacionesPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [vistaActual, setVistaActual] = useState<'lista' | 'calendario'>('lista')
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<any>(null)
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  // Función para formatear fecha sin problemas de zona horaria
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: solicitudesData, error: errorSol } = await supabase
        .from('solicitudes_vacaciones')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: empleadosData, error: errorEmp } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cuil, seccion, fecha_ingreso')
        .order('nombre_completo')

      if (errorEmp) {
        console.error('❌ Error empleados:', errorEmp)
      }

      const empleadosMap = new Map()
      empleadosData?.forEach(emp => {
        empleadosMap.set(emp.id, emp)
      })

      const solicitudesConEmpleado = (solicitudesData || []).map(s => {
        const empleadoEncontrado = empleadosMap.get(s.empleado_id)
        return {
          ...s,
          empleados: empleadoEncontrado || null
        }
      })

      setSolicitudes(solicitudesConEmpleado)
      setEmpleados(empleadosData || [])
    } catch (error) {
      console.error('❌ Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const aprobarSolicitud = async (solicitud: any) => {
    if (!confirm(`¿Aprobar ${solicitud.tipo} para ${solicitud.empleados?.nombre_completo || 'empleado'}? (${solicitud.cantidad_dias} días)`)) return

    setProcesando(true)
    try {
      const { error } = await supabase
        .from('solicitudes_vacaciones')
        .update({
          estado: 'aprobado',
          aprobado_por: 'admin',
          fecha_aprobacion: new Date().toISOString()
        })
        .eq('id', solicitud.id)

      if (error) throw error

      await supabase.from('notificaciones').insert({
        empleado_id: solicitud.empleado_id,
        tipo: 'vacaciones_aprobadas',
        titulo: 'Vacaciones/Licencia Aprobada',
        mensaje: `Tu solicitud de ${solicitud.tipo} del ${formatDate(solicitud.fecha_inicio)} al ${formatDate(solicitud.fecha_fin)} fue aprobada. ¡Disfrutá!`,
        leido: false
      })

      alert('✅ Solicitud aprobada correctamente')
      cargarDatos()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setProcesando(false)
    }
  }

  const rechazarSolicitud = async () => {
    if (!motivoRechazo.trim()) {
      alert('Debes ingresar un motivo de rechazo')
      return
    }

    setProcesando(true)
    try {
      const { error } = await supabase
        .from('solicitudes_vacaciones')
        .update({
          estado: 'rechazado',
          motivo_rechazo: motivoRechazo
        })
        .eq('id', solicitudSeleccionada.id)

      if (error) throw error

      await supabase.from('notificaciones').insert({
        empleado_id: solicitudSeleccionada.empleado_id,
        tipo: 'vacaciones_rechazadas',
        titulo: 'Solicitud Rechazada',
        mensaje: `Tu solicitud de ${solicitudSeleccionada.tipo} fue rechazada. Motivo: ${motivoRechazo}`,
        leido: false
      })

      alert('Solicitud rechazada')
      setMostrarRechazo(false)
      setSolicitudSeleccionada(null)
      setMotivoRechazo('')
      cargarDatos()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setProcesando(false)
    }
  }

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()

    let dataFiltrada = solicitudes
    if (filtroEstado !== 'todos') {
      dataFiltrada = dataFiltrada.filter(s => s.estado === filtroEstado)
    }
    if (filtroTipo !== 'todos') {
      dataFiltrada = dataFiltrada.filter(s => s.tipo === filtroTipo)
    }

    const resumenData = dataFiltrada.map(s => ({
      'Empleado': s.empleados?.nombre_completo || 'Desconocido',
      'CUIL': s.empleados?.cuil || '',
      'Sección': s.empleados?.seccion || '',
      'Tipo': TIPOS_LICENCIA.find(t => t.value === s.tipo)?.label || s.tipo,
      'Fecha Inicio': formatDate(s.fecha_inicio),
      'Fecha Fin': formatDate(s.fecha_fin),
      'Días': s.cantidad_dias,
      'Estado': s.estado.toUpperCase(),
      'Solicitado': formatDate(s.created_at?.split('T')[0]),
      'Motivo': s.motivo || ''
    }))

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Solicitudes')

    const stats = {
      'Total Solicitudes': dataFiltrada.length,
      'Aprobadas': dataFiltrada.filter(s => s.estado === 'aprobado').length,
      'Rechazadas': dataFiltrada.filter(s => s.estado === 'rechazado').length,
      'Pendientes': dataFiltrada.filter(s => s.estado === 'pendiente').length,
      'Total Días Aprobados': dataFiltrada.filter(s => s.estado === 'aprobado').reduce((sum, s) => sum + s.cantidad_dias, 0)
    }

    const statsData = Object.entries(stats).map(([key, value]) => ({
      'Métrica': key,
      'Valor': value
    }))

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statsData), 'Estadísticas')

    XLSX.writeFile(wb, `Vacaciones_${new Date().toISOString().split('T')[0]}.xlsx`)
    alert('✅ Reporte exportado correctamente')
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'aprobado': return 'bg-green-100 text-green-800 border-green-300'
      case 'rechazado': return 'bg-red-100 text-red-800 border-red-300'
      case 'cancelado': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getTipoInfo = (tipo: string) => {
    return TIPOS_LICENCIA.find(t => t.value === tipo) || { icon: '', label: tipo, color: 'gray' }
  }

  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente').length
  const solicitudesAprobadas = solicitudes.filter(s => s.estado === 'aprobado').length
  const totalDiasAprobados = solicitudes.filter(s => s.estado === 'aprobado').reduce((sum, s) => sum + s.cantidad_dias, 0)

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando solicitudes...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Vacaciones y Licencias</h1>
          <p className="text-gray-600">Administración de solicitudes del personal</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={cargarDatos}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            🔄 Recargar
          </button>
          <button
            onClick={exportarExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
             Exportar Excel
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Pendientes</p>
          <p className="text-3xl font-bold text-yellow-900">{solicitudesPendientes}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Aprobadas</p>
          <p className="text-3xl font-bold text-green-900">{solicitudesAprobadas}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Total Días Aprobados</p>
          <p className="text-3xl font-bold text-blue-900">{totalDiasAprobados}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Total Empleados</p>
          <p className="text-3xl font-bold text-purple-900">{empleados.length}</p>
        </div>
      </div>

      {/* Tabs y Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActual('lista')}
              className={`px-4 py-2 rounded ${
                vistaActual === 'lista' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setVistaActual('calendario')}
              className={`px-4 py-2 rounded ${
                vistaActual === 'calendario' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
               Calendario
            </button>
          </div>

          <div className="flex gap-3">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobados</option>
              <option value="rechazado">Rechazados</option>
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="todos">Todos los tipos</option>
              {TIPOS_LICENCIA.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.icon} {tipo.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* VISTA DE LISTA */}
      {vistaActual === 'lista' && (
        <div className="space-y-4">
          {solicitudes
            .filter(s => filtroEstado === 'todos' || s.estado === filtroEstado)
            .filter(s => filtroTipo === 'todos' || s.tipo === filtroTipo)
            .map((solicitud) => {
              const tipoInfo = getTipoInfo(solicitud.tipo)
              return (
                <div key={solicitud.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{tipoInfo.icon}</span>
                        <div>
                          <h3 className="font-bold text-lg">{solicitud.empleados?.nombre_completo || 'Empleado'}</h3>
                          <p className="text-sm text-gray-600">CUIL: {solicitud.empleados?.cuil || 'N/A'} • Sección: {solicitud.empleados?.seccion || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-600">Tipo</p>
                          <p className="font-semibold">{tipoInfo.label}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Período</p>
                          <p className="font-semibold">
                            {formatDate(solicitud.fecha_inicio)} - {formatDate(solicitud.fecha_fin)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Días</p>
                          <p className="font-semibold">{solicitud.cantidad_dias} días</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Solicitado</p>
                          <p className="font-semibold">
                            {formatDate(solicitud.created_at?.split('T')[0])}
                          </p>
                        </div>
                      </div>

                      {solicitud.motivo && (
                        <div className="mt-3 bg-gray-50 rounded p-3">
                          <p className="text-sm text-gray-700"><strong>Motivo:</strong> {solicitud.motivo}</p>
                        </div>
                      )}

                      {solicitud.motivo_rechazo && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
                          <p className="text-sm text-red-800"><strong>Motivo del rechazo:</strong> {solicitud.motivo_rechazo}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${getEstadoColor(solicitud.estado)}`}>
                        {solicitud.estado.toUpperCase()}
                      </span>

                      {solicitud.estado === 'pendiente' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => aprobarSolicitud(solicitud)}
                            disabled={procesando}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                          >
                            ✅ Aprobar
                          </button>
                          <button
                            onClick={() => {
                              setSolicitudSeleccionada(solicitud)
                              setMostrarRechazo(true)
                            }}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

          {solicitudes.filter(s => filtroEstado === 'todos' || s.estado === filtroEstado).length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
              <p className="text-lg">No hay solicitudes</p>
            </div>
          )}
        </div>
      )}

      {/* VISTA DE CALENDARIO */}
      {vistaActual === 'calendario' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Calendario de Vacaciones y Licencias</h2>
          <p className="text-gray-600 mb-6">Visualización de empleados ausentes</p>

          <div className="space-y-4">
            {empleados.map(empleado => {
              const solicitudesEmpleado = solicitudes.filter(
                s => s.empleado_id === empleado.id && s.estado === 'aprobado'
              )

              if (solicitudesEmpleado.length === 0) return null

              return (
                <div key={empleado.id} className="border border-gray-200 rounded p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xl"></span>
                    </div>
                    <div>
                      <p className="font-bold">{empleado.nombre_completo}</p>
                      <p className="text-sm text-gray-600">{empleado.seccion || 'Sin sección'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {solicitudesEmpleado.map(solicitud => {
                      const tipoInfo = getTipoInfo(solicitud.tipo)
                      return (
                        <div key={solicitud.id} className="bg-blue-50 border border-blue-200 rounded p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{tipoInfo.icon}</span>
                            <div>
                              <p className="font-semibold">{tipoInfo.label}</p>
                              <p className="text-sm text-gray-600">
                                {formatDate(solicitud.fecha_inicio)} - {formatDate(solicitud.fecha_fin)} ({solicitud.cantidad_dias} días)
                              </p>
                            </div>
                          </div>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Aprobado
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {empleados.every(emp => solicitudes.filter(s => s.empleado_id === emp.id && s.estado === 'aprobado').length === 0) && (
              <p className="text-center text-gray-500 py-8">No hay vacaciones/licencias aprobadas</p>
            )}
          </div>
        </div>
      )}

      {/* Modal de Rechazo */}
      {mostrarRechazo && solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Rechazar Solicitud</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Empleado: <strong>{solicitudSeleccionada.empleados?.nombre_completo || 'N/A'}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Tipo: <strong>{getTipoInfo(solicitudSeleccionada.tipo).label}</strong>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Motivo del rechazo:</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Explicá por qué se rechaza la solicitud..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={rechazarSolicitud}
                disabled={procesando}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {procesando ? 'Procesando...' : 'Rechazar'}
              </button>
              <button
                onClick={() => {
                  setMostrarRechazo(false)
                  setSolicitudSeleccionada(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}