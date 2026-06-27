'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NotificacionesPage() {
  const [empleado, setEmpleado] = useState<any>(null)
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'no-leidas'>('todas')

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarNotificaciones(emp.id)
    }
  }, [filtro])

  const cargarNotificaciones = async (empleadoId: string) => {
    try {
      let query = supabase
        .from('notificaciones')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('created_at', { ascending: false })

      if (filtro === 'no-leidas') {
        query = query.eq('leido', false)
      }

      const { data, error } = await query
      if (error) throw error
      setNotificaciones(data || [])
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const marcarComoLeida = async (id: string) => {
    await supabase.from('notificaciones').update({ leido: true }).eq('id', id)
    if (empleado) cargarNotificaciones(empleado.id)
  }

  const marcarTodasLeidas = async () => {
    await supabase
      .from('notificaciones')
      .update({ leido: true })
      .eq('empleado_id', empleado.id)
      .eq('leido', false)
    cargarNotificaciones(empleado.id)
  }

  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'adelanto_aprobado': return '✅'
      case 'incentivo_cargado': return '🎯'
      case 'recibo_pendiente': return '📄'
      case 'cuota_proxima': return '💰'
      default: return '🔔'
    }
  }

  const noLeidas = notificaciones.filter(n => !n.leido).length

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
          <h1 className="text-2xl font-bold">Mis Notificaciones</h1>
          <p className="text-gray-600">
            {noLeidas > 0 ? `${noLeidas} no leídas` : 'Todas leídas ✓'}
          </p>
        </div>
        {noLeidas > 0 && (
          <button
            onClick={marcarTodasLeidas}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFiltro('todas')}
          className={`px-4 py-2 rounded ${
            filtro === 'todas' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFiltro('no-leidas')}
          className={`px-4 py-2 rounded ${
            filtro === 'no-leidas' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          No leídas
        </button>
      </div>

      {notificaciones.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          <p className="text-lg">No tenés notificaciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notificaciones.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.leido && marcarComoLeida(notif.id)}
              className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                notif.leido ? 'opacity-60' : 'border-l-4 border-blue-500'
              }`}
            >
              <div className="flex items-start">
                <span className="text-2xl mr-3">{getIcono(notif.tipo)}</span>
                <div className="flex-1">
                  <h3 className="font-semibold">{notif.titulo}</h3>
                  <p className="text-sm text-gray-600 mt-1">{notif.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notif.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
                {!notif.leido && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    Nuevo
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}