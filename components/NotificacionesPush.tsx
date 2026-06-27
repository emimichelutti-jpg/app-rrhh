'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Notificacion {
  id: string
  empleado_id: string
  tipo: string
  titulo: string
  mensaje: string
  created_at: string
}

export default function NotificacionesPush() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [empleadoId, setEmpleadoId] = useState<string | null>(null)
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(false)
  const notificacionesMostradas = useRef<Set<string>>(new Set())

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleadoId(emp.id)
      cargarNoLeidas(emp.id)
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      setPermisoNotificaciones(true)
    }

    const subscription = supabase
      .channel('notificaciones-push')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
        },
        (payload) => {
          const nueva = payload.new as any
          if (nueva && empleadoId && nueva.empleado_id === empleadoId) {
            if (!notificacionesMostradas.current.has(nueva.id)) {
              mostrarPopUp(nueva)
            }
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [empleadoId])

  const cargarNoLeidas = async (empId: string) => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('empleado_id', empId)
      .eq('leido', false)
      .order('created_at', { ascending: false })
      .limit(3)

    if (data && data.length > 0) {
      data.forEach((notif, index) => {
        if (!notificacionesMostradas.current.has(notif.id)) {
          setTimeout(() => {
            mostrarPopUp(notif, false)
          }, index * 1500)
        }
      })
    }
  }

  const mostrarPopUp = (notif: Notificacion, reproducirSonido: boolean = true) => {
    // Evitar duplicados usando useRef
    if (notificacionesMostradas.current.has(notif.id)) {
      return
    }
    notificacionesMostradas.current.add(notif.id)

    setNotificaciones((prev) => [...prev, notif])

    if (reproducirSonido) {
      reproducirDing()
    }

    if (permisoNotificaciones && 'Notification' in window) {
      new Notification(notif.titulo, {
        body: notif.mensaje,
        icon: '/favicon.ico'
      })
    }

    setTimeout(() => {
      setNotificaciones((prev) => prev.filter((n) => n.id !== notif.id))
      notificacionesMostradas.current.delete(notif.id)
    }, 6000)
  }

  const reproducirDing = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE')
    audio.volume = 0.3
    audio.play().catch(() => {})
  }

  const solicitarPermiso = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          setPermisoNotificaciones(true)
          alert('✅ Notificaciones activadas')
        }
      })
    }
  }

  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'adelanto_aprobado': return '✅'
      case 'incentivo_cargado': return '🎯'
      case 'recibo_pendiente': return '📄'
      case 'cuota_proxima': return '💰'
      case 'cbu_actualizado': return ''
      case 'cbu_rechazado': return '❌'
      case 'solicitud_cbu': return '🏦'
      default: return '🔔'
    }
  }

  const cerrar = (id: string) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id))
  }

  if (notificaciones.length === 0) {
    return (
      !permisoNotificaciones && (
        <button
          onClick={solicitarPermiso}
          className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 z-50 text-sm"
        >
          🔔 Activar notificaciones
        </button>
      )
    )
  }

  return (
    <>
      <div className="fixed top-20 right-4 z-50 space-y-3 max-w-sm">
        {notificaciones.map((notif) => (
          <div
            key={`notif-${notif.id}-${Date.now()}`}
            className="bg-white rounded-lg shadow-2xl p-4 border-l-4 border-blue-500"
            style={{ animation: 'slideIn 0.3s ease-out' }}
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">{getIcono(notif.tipo)}</span>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm">{notif.titulo}</h4>
                <p className="text-xs text-gray-600 mt-1">{notif.mensaje}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(notif.created_at).toLocaleTimeString('es-AR')}
                </p>
              </div>
              <button
                onClick={() => cerrar(notif.id)}
                className="text-gray-400 hover:text-gray-600 ml-2 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}