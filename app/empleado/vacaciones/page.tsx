'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const TIPOS_LICENCIA = [
  { value: 'vacaciones', label: 'Vacaciones', icon: '🏖️', color: 'blue' },
  { value: 'licencia_medica', label: 'Licencia Médica', icon: '🏥', color: 'red' },
  { value: 'licencia_familiar', label: 'Licencia Familiar', icon: '👨‍👩‍', color: 'purple' },
  { value: 'dia_libre', label: 'Día Libre', icon: '📅', color: 'green' },
  { value: 'duelo', label: 'Licencia por Duelo', icon: '🕊️', color: 'gray' },
  { value: 'matrimonio', label: 'Licencia por Matrimonio', icon: '💍', color: 'pink' },
  { value: 'nacimiento', label: 'Licencia por Nacimiento', icon: '👶', color: 'yellow' },
]

export default function VacacionesPage() {
  const [empleado, setEmpleado] = useState<any>(null)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [diasDisponibles, setDiasDisponibles] = useState(0)
  const [diasUsados, setDiasUsados] = useState(0)
  
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    tipo: 'vacaciones',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: ''
  })

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarDatos(emp)
    }
  }, [])

  const cargarDatos = async (emp: any) => {
    try {
      // Cargar solicitudes
      const { data: solicitudesData } = await supabase
        .from('solicitudes_vacaciones')
        .select('*')
        .eq('empleado_id', emp.id)
        .order('fecha_inicio', { ascending: false })

      setSolicitudes(solicitudesData || [])

      // Calcular días disponibles según antigüedad
      let dias = 14 // default por ley
      const hoy = new Date()

      if (emp.fecha_ingreso) {
        const fechaIngreso = new Date(emp.fecha_ingreso)
        const añosAntiguedad = hoy.getFullYear() - fechaIngreso.getFullYear()

        if (añosAntiguedad >= 20) dias = 35
        else if (añosAntiguedad >= 10) dias = 28
        else if (añosAntiguedad >= 5) dias = 21
      }
      // Si no tiene fecha_ingreso, usa 14 días (mínimo por ley)

      // Contar días usados (solo vacaciones aprobadas del año actual)
      const añoActual = hoy.getFullYear()
      const vacacionesAprobadas = (solicitudesData || []).filter(s => 
        s.tipo === 'vacaciones' && 
        s.estado === 'aprobado' &&
        new Date(s.fecha_inicio).getFullYear() === añoActual
      )
      
      const diasUsadosTotal = vacacionesAprobadas.reduce((sum, s) => sum + s.cantidad_dias, 0)

      setDiasDisponibles(dias)
      setDiasUsados(diasUsadosTotal)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularDiasEntreFechas = (inicio: string, fin: string) => {
    if (!inicio || !fin) return 0
    const date1 = new Date(inicio)
    const date2 = new Date(fin)
    const diffTime = Math.abs(date2.getTime() - date1.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)

    try {
      const cantidadDias = calcularDiasEntreFechas(nuevaSolicitud.fecha_inicio, nuevaSolicitud.fecha_fin)

      if (cantidadDias <= 0) {
        alert('La fecha fin debe ser posterior a la fecha inicio')
        setEnviando(false)
        return
      }

      if (nuevaSolicitud.tipo === 'vacaciones' && cantidadDias > (diasDisponibles - diasUsados)) {
        alert(`No tenés suficientes días disponibles. Te quedan ${diasDisponibles - diasUsados} días.`)
        setEnviando(false)
        return
      }

      const { error } = await supabase
        .from('solicitudes_vacaciones')
        .insert({
          empleado_id: empleado.id,
          tipo: nuevaSolicitud.tipo,
          fecha_inicio: nuevaSolicitud.fecha_inicio,
          fecha_fin: nuevaSolicitud.fecha_fin,
          cantidad_dias: cantidadDias,
          motivo: nuevaSolicitud.motivo,
          estado: 'pendiente'
        })

      if (error) throw error

      // Notificar al admin
      const tipoLabel = TIPOS_LICENCIA.find(t => t.value === nuevaSolicitud.tipo)?.label || nuevaSolicitud.tipo
      await supabase.from('notificaciones').insert({
        empleado_id: empleado.id,
        tipo: 'solicitud_vacaciones',
        titulo: `Solicitud de ${tipoLabel}`,
        mensaje: `${empleado.nombre_completo} solicitó ${tipoLabel} del ${nuevaSolicitud.fecha_inicio} al ${nuevaSolicitud.fecha_fin} (${cantidadDias} días)`,
        leido: false
      })

      alert(`✅ Solicitud enviada correctamente (${cantidadDias} días)`)
      setMostrarFormulario(false)
      setNuevaSolicitud({ tipo: 'vacaciones', fecha_inicio: '', fecha_fin: '', motivo: '' })
      cargarDatos(empleado)
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setEnviando(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'aprobado': return 'bg-green-100 text-green-800'
      case 'rechazado': return 'bg-red-100 text-red-800'
      case 'cancelado': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTipoInfo = (tipo: string) => {
    return TIPOS_LICENCIA.find(t => t.value === tipo) || { icon: '', label: tipo, color: 'gray' }
  }

  const diasRestantes = diasDisponibles - diasUsados

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vacaciones y Licencias</h1>
          <p className="text-gray-600">Gestión de tus días libres</p>
        </div>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nueva Solicitud
        </button>
      </div>

      {/* Tarjetas de días disponibles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Días Disponibles (año)</p>
          <p className="text-3xl font-bold text-blue-900">{diasDisponibles}</p>
          <p className="text-xs text-gray-500 mt-1">Según antigüedad</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Días Usados</p>
          <p className="text-3xl font-bold text-green-900">{diasUsados}</p>
          <p className="text-xs text-gray-500 mt-1">Este año</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Días Restantes</p>
          <p className="text-3xl font-bold text-orange-900">{diasRestantes}</p>
          <p className="text-xs text-gray-500 mt-1">Para usar</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Uso de Vacaciones</h2>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all"
            style={{ width: `${(diasUsados / diasDisponibles) * 100}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {diasUsados} de {diasDisponibles} días utilizados ({Math.round((diasUsados / diasDisponibles) * 100)}%)
        </p>
      </div>

      {/* Formulario Modal */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Nueva Solicitud</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Licencia:</label>
                <select
                  value={nuevaSolicitud.tipo}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, tipo: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {TIPOS_LICENCIA.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.icon} {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fecha Inicio:</label>
                <input
                  type="date"
                  value={nuevaSolicitud.fecha_inicio}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, fecha_inicio: e.target.value})}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fecha Fin:</label>
                <input
                  type="date"
                  value={nuevaSolicitud.fecha_fin}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, fecha_fin: e.target.value})}
                  required
                  min={nuevaSolicitud.fecha_inicio}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {nuevaSolicitud.fecha_inicio && nuevaSolicitud.fecha_fin && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-800">
                    📅 Total: <strong>{calcularDiasEntreFechas(nuevaSolicitud.fecha_inicio, nuevaSolicitud.fecha_fin)} días</strong>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Motivo (opcional):</label>
                <textarea
                  value={nuevaSolicitud.motivo}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, motivo: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {enviando ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historial de Solicitudes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Historial de Solicitudes</h2>
        
        {solicitudes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No tenés solicitudes registradas</p>
        ) : (
          <div className="space-y-3">
            {solicitudes.map((solicitud) => {
              const tipoInfo = getTipoInfo(solicitud.tipo)
              return (
                <div key={solicitud.id} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{tipoInfo.icon}</span>
                      <div>
                        <p className="font-semibold">{tipoInfo.label}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(solicitud.fecha_inicio).toLocaleDateString('es-AR')} - {new Date(solicitud.fecha_fin).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(solicitud.estado)}`}>
                      {solicitud.estado.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <strong>{solicitud.cantidad_dias} días</strong>
                    {solicitud.motivo && ` - ${solicitud.motivo}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Solicitado el {new Date(solicitud.created_at).toLocaleString('es-AR')}
                  </p>
                  {solicitud.motivo_rechazo && (
                    <p className="text-sm text-red-600 mt-2">
                      <strong>Motivo del rechazo:</strong> {solicitud.motivo_rechazo}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}