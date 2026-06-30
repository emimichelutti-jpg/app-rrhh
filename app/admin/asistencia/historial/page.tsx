'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ESTADOS_ASISTENCIA = [
  { value: 'presente', label: 'Presente', icon: '✅', color: 'green' },
  { value: 'ausente_injustificado', label: 'Ausente Injust.', icon: '❌', color: 'red' },
  { value: 'ausente_justificado', label: 'Ausente Just.', icon: '⚠️', color: 'yellow' },
  { value: 'tarde', label: 'Tarde', icon: '⏰', color: 'orange' },
  { value: 'permiso', label: 'Permiso', icon: '📝', color: 'blue' },
  { value: 'vacaciones', label: 'Vacaciones', icon: '🏖️', color: 'cyan' },
  { value: 'licencia_medica', label: 'Lic. Médica', icon: '🏥', color: 'purple' },
  { value: 'ilt', label: 'ILT (ART)', icon: '🚑', color: 'red' },
  { value: 'licencia_familiar', label: 'Lic. Familiar', icon: '👨‍👩‍👧', color: 'purple' },
  { value: 'feriado', label: 'Feriado', icon: '🎉', color: 'gray' },
]

export default function HistorialAsistenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([])
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('')
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fechaDesde, setFechaDesde] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0])
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarEmpleados()
  }, [])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil, seccion')
      .eq('activo', true)
      .order('nombre_completo')

    setEmpleados(data || [])
  }

  const cargarHistorial = async () => {
    if (!empleadoSeleccionado) return

    setLoading(true)
    
    let query = supabase
      .from('registros_asistencia')
      .select('*')
      .eq('empleado_id', empleadoSeleccionado)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: false })

    if (filtroEstado !== 'todos') {
      query = query.eq('estado', filtroEstado)
    }

    const { data } = await query

    setRegistros(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (empleadoSeleccionado) {
      cargarHistorial()
    }
  }, [empleadoSeleccionado, fechaDesde, fechaHasta, filtroEstado])

  const empleadoActual = empleados.find(e => e.id === empleadoSeleccionado)

  // Estadísticas del empleado en el período
  const estadisticas = {
    totalDias: registros.length,
    presentes: registros.filter(r => r.estado === 'presente').length,
    ausentes: registros.filter(r => r.estado?.startsWith('ausente')).length,
    tardes: registros.filter(r => r.estado === 'tarde').length,
    permisos: registros.filter(r => 
      ['permiso', 'vacaciones', 'licencia_medica', 'licencia_familiar'].includes(r.estado)
    ).length,
    ilt_art: registros.filter(r => r.estado === 'ilt').length,
    horasTotales: registros.reduce((acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0),
  }

  const empleadosFiltrados = empleados.filter(e => 
    !busqueda || 
    e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.cuil?.includes(busqueda)
  )

  const getEstadoColor = (estado: string) => {
    const info = ESTADOS_ASISTENCIA.find(e => e.value === estado)
    return info?.color || 'gray'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Historial de Asistencia</h1>
        <p className="text-gray-600">Consulta el historial completo de asistencia por empleado</p>
      </div>

      {/* Selector de empleado */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar y seleccionar empleado:
        </label>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o CUIL..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
        />
        <select
          value={empleadoSeleccionado}
          onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="">-- Seleccionar empleado --</option>
          {empleadosFiltrados.map(e => (
            <option key={e.id} value={e.id}>
              {e.nombre_completo} - {e.cuil} {e.seccion ? `(${e.seccion})` : ''}
            </option>
          ))}
        </select>
      </div>

      {empleadoSeleccionado && empleadoActual && (
        <>
          {/* Info del empleado */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-bold text-blue-900">{empleadoActual.nombre_completo}</h2>
            <p className="text-sm text-blue-700">
              CUIL: {empleadoActual.cuil} | Sección: {empleadoActual.seccion || 'Sin sección'}
            </p>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Desde:</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Hasta:</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Estado:</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="todos">Todos los estados</option>
                  {ESTADOS_ASISTENCIA.map(e => (
                    <option key={e.value} value={e.value}>{e.icon} {e.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <p className="text-xs text-gray-600">Total Días</p>
              <p className="text-2xl font-bold text-blue-900">{estadisticas.totalDias}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <p className="text-xs text-gray-600">Presentes</p>
              <p className="text-2xl font-bold text-green-900">{estadisticas.presentes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <p className="text-xs text-gray-600">Ausentes</p>
              <p className="text-2xl font-bold text-red-900">{estadisticas.ausentes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <p className="text-xs text-gray-600">Tardes</p>
              <p className="text-2xl font-bold text-orange-900">{estadisticas.tardes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <p className="text-xs text-gray-600">Permisos/Licencias</p>
              <p className="text-2xl font-bold text-purple-900">{estadisticas.permisos}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
              <p className="text-xs text-gray-600">ILT/ART</p>
              <p className="text-2xl font-bold text-red-700">{estadisticas.ilt_art}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-cyan-500">
              <p className="text-xs text-gray-600">Horas Totales</p>
              <p className="text-2xl font-bold text-cyan-900">{estadisticas.horasTotales.toFixed(1)}h</p>
            </div>
          </div>

          {/* Tabla de historial */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Entrada</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Almuerzo</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Salida</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Horas</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      </td>
                    </tr>
                  ) : registros.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No hay registros en este período
                      </td>
                    </tr>
                  ) : (
                    registros.map((registro) => {
                      const colorEstado = getEstadoColor(registro.estado)
                      return (
                        <tr key={registro.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">
                            {new Date(registro.fecha).toLocaleDateString('es-AR', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-mono">
                            {registro.hora_entrada || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-mono">
                            {registro.hora_almuerzo_inicio && registro.hora_almuerzo_fin 
                              ? `${registro.hora_almuerzo_inicio}-${registro.hora_almuerzo_fin}` 
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-mono">
                            {registro.hora_salida || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold">
                            {registro.horas_trabajadas ? `${parseFloat(registro.horas_trabajadas).toFixed(1)}h` : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-${colorEstado}-100 text-${colorEstado}-800`}>
                              {ESTADOS_ASISTENCIA.find(e => e.value === registro.estado)?.label || registro.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {registro.observaciones || registro.observaciones_admin || '-'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}