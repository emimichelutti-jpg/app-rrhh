'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NotificacionesPage() {
  const router = useRouter()
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

  // 🆕 Al entrar, marcar como leídas todas las no leídas
  useEffect(() => {
    if (empleado && notificaciones.length > 0) {
      const sinLeer = notificaciones.filter(n => !n.leido)
      if (sinLeer.length > 0) {
        marcarTodasLeidas()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado, notificaciones.length > 0])

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

  const handleNotifClick = (notif: any) => {
    if (!notif.leido) {
      marcarComoLeida(notif.id)
    }
    if (notif.link) {
      router.push(notif.link)
    }
  }

  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'nuevo_recibo': return '📄'
      case 'recibo_pendiente': return '📄'
      case 'adelanto_aprobado': return '✅'
      case 'incentivo_cargado': return '🎯'
      case 'cuota_proxima': return '💰'
      case 'cbu_actualizado': return '🏦'
      case 'cbu_rechazado': return '❌'
      case 'solicitud_cbu': return '🏦'
      default: return '🔔'
    }
  }

  // 🆕 Tiempo relativo (ej: "hace 2 horas", "ayer")
  const getTiempoRelativo = (fechaISO: string) => {
    const fecha = new Date(fechaISO)
    const ahora = new Date()
    const diffMs = ahora.getTime() - fecha.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffDias = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'recién'
    if (diffMin < 60) return `hace ${diffMin} min`
    if (diffHrs < 24) return `hace ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`
    if (diffDias === 1) return 'ayer'
    if (diffDias < 7) return `hace ${diffDias} días`
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }

  const noLeidas = notificaciones.filter(n => !n.leido).length

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando notificaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <div className="mb-6 flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🔔 Mis Notificaciones</h1>
          <p className="text-slate-600 text-sm mt-1">
            {noLeidas > 0 ? `${noLeidas} nuevas` : 'Estás al día'}
          </p>
        </div>
      </div>

      {/* Filtros grandes (touch-friendly) */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFiltro('todas')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
            filtro === 'todas'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFiltro('no-leidas')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
            filtro === 'no-leidas'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          No leídas
        </button>
      </div>

      {notificaciones.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-slate-500">
            {filtro === 'no-leidas' ? 'No tenés notificaciones nuevas' : 'No tenés notificaciones'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notificaciones.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`bg-white rounded-2xl p-4 transition-all active:scale-[0.99] ${
                notif.leido
                  ? 'opacity-60 border border-slate-100'
                  : 'border-2 border-blue-200 shadow-sm'
              } ${notif.link ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                  notif.leido ? 'bg-slate-100' : 'bg-blue-50'
                }`}>
                  {getIcono(notif.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className={`font-semibold text-sm ${notif.leido ? 'text-slate-700' : 'text-slate-900'}`}>
                      {notif.titulo}
                    </h3>
                    <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                      {getTiempoRelativo(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{notif.mensaje}</p>
                  {notif.link && !notif.leido && (
                    <p className="text-xs text-blue-600 font-semibold mt-2">
                      Tocar para ir →
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}