'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function GestionSolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [solicitudAProbar, setSolicitudAProbar] = useState<any>(null)
  const [mostrarModalCuotas, setMostrarModalCuotas] = useState(false)
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState(1)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    cargarSolicitudes()
    cargarEmpleados()
  }, [])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil')
    if (data) setEmpleados(data)
  }

  const cargarSolicitudes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('solicitudes_sueldo')
        .select('*')
        .order('fecha_solicitud', { ascending: false })

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query

      if (error) throw error
      setSolicitudes(data || [])
    } catch (error) {
      console.error('Error cargando solicitudes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEmpleadoNombre = (empleadoId: string) => {
    const emp = empleados.find(e => e.id === empleadoId)
    return emp ? emp.nombre_completo : 'Cargando...'
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'aprobado': return 'bg-green-100 text-green-800'
      case 'rechazado': return 'bg-red-100 text-red-800'
      case 'en_curso': return 'bg-blue-100 text-blue-800'
      case 'finalizado': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleAprobarClick = (solicitud: any) => {
    setSolicitudAProbar(solicitud)
    
    // Si es préstamo (monto > 500000), mostrar selector de cuotas
    if (solicitud.monto_total > 500000) {
      const maxCuotas = Math.min(4, Math.ceil(solicitud.monto_total / 250000))
      setCuotasSeleccionadas(maxCuotas)
      setMostrarModalCuotas(true)
    } else {
      // Adelanto simple (1 cuota)
      aprobarSolicitud(1)
    }
  }

  const aprobarSolicitud = async (cantidadCuotas: number) => {
  if (!solicitudAProbar) return
  setProcesando(true)

  try {
    const montoCuota = solicitudAProbar.monto_total / cantidadCuotas

    const { error } = await supabase
      .from('solicitudes_sueldo')
      .update({
        estado: cantidadCuotas > 1 ? 'en_curso' : 'aprobado',
        cantidad_cuotas: cantidadCuotas,
        cuotas_restantes: cantidadCuotas,
        monto_cuota: montoCuota,
        updated_at: new Date().toISOString(),
      })
      .eq('id', solicitudAProbar.id)

    if (error) throw error

    // CREAR NOTIFICACIÓN PARA EL EMPLEADO
    await supabase.from('notificaciones').insert({
      empleado_id: solicitudAProbar.empleado_id,
      tipo: 'adelanto_aprobado',
      titulo: '✅ Adelanto Aprobado',
      mensaje: `Tu adelanto de $${solicitudAProbar.monto_total.toLocaleString('es-AR')} fue aprobado. ${cantidadCuotas > 1 ? `Se descontará en ${cantidadCuotas} cuotas de $${Math.round(montoCuota).toLocaleString('es-AR')}.` : 'Se descontará en tu próximo recibo.'}`,
      leido: false
    })

    alert('Solicitud aprobada correctamente')
    setMostrarModalCuotas(false)
    setSolicitudAProbar(null)
    cargarSolicitudes()
  } catch (error: any) {
    alert('Error al aprobar: ' + error.message)
  } finally {
    setProcesando(false)
  }
}

  const handleRechazarClick = (solicitud: any) => {
    setSolicitudAProbar(solicitud)
    setMotivoRechazo('')
    setMostrarRechazo(true)
  }

  const rechazarSolicitud = async () => {
  if (!solicitudAProbar || !motivoRechazo.trim()) {
    alert('Debes ingresar un motivo de rechazo')
    return
  }

  setProcesando(true)

  try {
    const { error } = await supabase
      .from('solicitudes_sueldo')
      .update({
        estado: 'rechazado',
        motivo_rechazo: motivoRechazo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', solicitudAProbar.id)

    if (error) throw error

    // CREAR NOTIFICACIÓN DE RECHAZO
    await supabase.from('notificaciones').insert({
      empleado_id: solicitudAProbar.empleado_id,
      tipo: 'adelanto_rechazado',
      titulo: '❌ Solicitud Rechazada',
      mensaje: `Tu solicitud de adelanto por $${solicitudAProbar.monto_total.toLocaleString('es-AR')} fue rechazada. Motivo: ${motivoRechazo}`,
      leido: false
    })

    alert('Solicitud rechazada')
    setMostrarRechazo(false)
    setSolicitudAProbar(null)
    cargarSolicitudes()
  } catch (error: any) {
    alert('Error al rechazar: ' + error.message)
  } finally {
    setProcesando(false)
  }
}

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gestión de Solicitudes</h1>
        <p className="text-gray-600">Aprobá o rechazá adelantos y préstamos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <label className="text-sm font-medium">Estado:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
            <option value="en_curso">En curso</option>
            <option value="finalizado">Finalizados</option>
          </select>
        </div>
      </div>

      {/* Lista de solicitudes */}
      {loading ? (
        <div className="text-center py-12">Cargando solicitudes...</div>
      ) : (
        <div className="space-y-4">
          {solicitudes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
              <p>No hay solicitudes</p>
            </div>
          ) : (
            solicitudes.map((solicitud) => (
              <div key={solicitud.id} className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Empleado</p>
                    <p className="font-semibold">{getEmpleadoNombre(solicitud.empleado_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tipo</p>
                    <p className="font-semibold">
                      {solicitud.tipo === 'adelanto' ? 'Adelanto' : `Préstamo (${solicitud.cantidad_cuotas} cuotas)`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monto Total</p>
                    <p className="font-bold text-green-700">${solicitud.monto_total.toLocaleString('es-AR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estado</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(solicitud.estado)}`}>
                      {solicitud.estado.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4 mb-4">
                  <p className="text-sm text-gray-600 mb-1">Motivo:</p>
                  <p className="text-sm">{solicitud.motivo}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Solicitado el {new Date(solicitud.fecha_solicitud).toLocaleString('es-AR')}
                  </p>
                </div>

                {solicitud.estado === 'pendiente' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAprobarClick(solicitud)}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      onClick={() => handleRechazarClick(solicitud)}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                )}

                {solicitud.estado === 'en_curso' && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm">
                      <span className="font-semibold">Cuotas:</span> {solicitud.cuotas_restantes} de {solicitud.cantidad_cuotas} restantes
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Monto por cuota:</span> ${solicitud.monto_cuota.toLocaleString('es-AR')}
                    </p>
                  </div>
                )}

                {solicitud.motivo_rechazo && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm font-medium text-red-800">Motivo del rechazo:</p>
                    <p className="text-sm text-red-700">{solicitud.motivo_rechazo}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal para seleccionar cuotas */}
      {mostrarModalCuotas && solicitudAProbar && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Configurar Préstamo</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Monto total: ${solicitudAProbar.monto_total.toLocaleString('es-AR')}</p>
              <label className="block text-sm font-medium mb-2">Cantidad de cuotas:</label>
              <select
                value={cuotasSeleccionadas}
                onChange={(e) => setCuotasSeleccionadas(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                {[1, 2, 3, 4].map(num => (
                  <option key={num} value={num}>
                    {num} cuota{num > 1 ? 's' : ''} - ${Math.round(solicitudAProbar.monto_total / num).toLocaleString('es-AR')} c/u
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => aprobarSolicitud(cuotasSeleccionadas)}
                disabled={procesando}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {procesando ? 'Procesando...' : 'Aprobar Préstamo'}
              </button>
              <button
                onClick={() => {
                  setMostrarModalCuotas(false)
                  setSolicitudAProbar(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para rechazar */}
      {mostrarRechazo && solicitudAProbar && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Rechazar Solicitud</h2>
            
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
                  setSolicitudAProbar(null)
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