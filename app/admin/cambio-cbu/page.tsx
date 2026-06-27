'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CambioCBUPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<any>(null)
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    cargarSolicitudes()
  }, [filtroEstado])

  const cargarSolicitudes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('solicitudes_cambio_cbu')
        .select('*, empleados(nombre_completo, cuil, cbu)')
        .order('created_at', { ascending: false })

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

  const aprobarSolicitud = async (solicitud: any) => {
    if (!confirm(`¿Aprobar cambio de CBU para ${solicitud.empleados.nombre_completo}?`)) return
    
    setProcesando(true)
    try {
      // 1. Actualizar solicitud
      const { error: errorSolicitud } = await supabase
  .from('solicitudes_cambio_cbu')
  .update({
    estado: 'aprobado',
    aprobado_por: null,  // ← null por ahora (sin auth de admin)
    fecha_aprobacion: new Date().toISOString()
  })
  .eq('id', solicitud.id)

      if (errorSolicitud) throw errorSolicitud

      // 2. Actualizar CBU del empleado
      const { error: errorEmpleado } = await supabase
        .from('empleados')
        .update({
          cbu: solicitud.cbu_nuevo,
          alias_cbu: solicitud.alias_nuevo,
          cuenta_banco: solicitud.banco_nuevo,
          updated_at: new Date().toISOString()
        })
        .eq('id', solicitud.empleado_id)

      if (errorEmpleado) throw errorEmpleado

      // 3. Crear notificación para el empleado
      await supabase.from('notificaciones').insert({
        empleado_id: solicitud.empleado_id,
        tipo: 'cbu_actualizado',
        titulo: 'CBU Actualizado',
        mensaje: `Tu solicitud de cambio de CBU fue aprobada. Tu nuevo CBU es ${solicitud.cbu_nuevo}`,
        leido: false
      })

      alert('✅ CBU actualizado correctamente')
      cargarSolicitudes()
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
        .from('solicitudes_cambio_cbu')
        .update({
          estado: 'rechazado',
          motivo_rechazo: motivoRechazo
        })
        .eq('id', solicitudSeleccionada.id)

      if (error) throw error

      // Notificar al empleado
      await supabase.from('notificaciones').insert({
        empleado_id: solicitudSeleccionada.empleado_id,
        tipo: 'cbu_rechazado',
        titulo: 'Solicitud de CBU Rechazada',
        mensaje: `Tu solicitud de cambio de CBU fue rechazada. Motivo: ${motivoRechazo}`,
        leido: false
      })

      alert('Solicitud rechazada')
      setMostrarRechazo(false)
      setSolicitudSeleccionada(null)
      setMotivoRechazo('')
      cargarSolicitudes()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setProcesando(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'aprobado': return 'bg-green-100 text-green-800'
      case 'rechazado': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Solicitudes de Cambio de CBU</h1>
        <p className="text-gray-600">Gestioná las solicitudes de cambio de cuenta bancaria</p>
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
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      {/* Lista de solicitudes */}
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
                  <p className="font-semibold">{solicitud.empleados.nombre_completo}</p>
                  <p className="text-xs text-gray-500">CUIL: {solicitud.empleados.cuil}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">CBU Anterior</p>
                  <p className="font-mono text-sm">{solicitud.cbu_anterior || 'Sin CBU'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">CBU Nuevo</p>
                  <p className="font-mono text-sm font-bold">{solicitud.cbu_nuevo}</p>
                  <p className="text-xs text-gray-500">{solicitud.banco_nuevo}</p>
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
                  Solicitado el {new Date(solicitud.created_at).toLocaleString('es-AR')}
                </p>
              </div>

              {solicitud.estado === 'pendiente' && (
                <div className="flex gap-3">
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

      {/* Modal de Rechazo */}
      {mostrarRechazo && solicitudSeleccionada && (
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