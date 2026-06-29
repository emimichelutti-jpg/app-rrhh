'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import NotificacionesPush from '@/components/NotificacionesPush'

export default function EmpleadoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [empleado, setEmpleado] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0)

  useEffect(() => {
    if (pathname === '/empleado/login') {
      setLoading(false)
      return
    }

    const empleadoData = localStorage.getItem('empleado_data')
    const cookies = document.cookie
    const cookieMatch = cookies.match(/empleado_token=([^;]+)/)
    const token = cookieMatch ? cookieMatch[1] : null

    if (!token || !empleadoData) {
      router.push('/empleado/login')
      return
    }

    try {
      const payload = JSON.parse(atob(token))
      if (payload.exp < Date.now()) {
        localStorage.clear()
        document.cookie = 'empleado_token=; path=/; max-age=0'
        router.push('/empleado/login?error=sesion-expirada')
        return
      }

      setEmpleado(JSON.parse(empleadoData))
    } catch (error) {
      console.error('Error verificando sesión:', error)
      localStorage.clear()
      router.push('/empleado/login')
    } finally {
      setLoading(false)
    }
  }, [router, pathname])

  // Cargar badge de notificaciones
  useEffect(() => {
    if (empleado) {
      cargarBadge()

      const subscription = supabase
        .channel('notificaciones-badge')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notificaciones',
          },
          () => {
            cargarBadge()
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [empleado])

  const cargarBadge = async () => {
    const { count } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('empleado_id', empleado?.id)
      .eq('leido', false)

    setNotificacionesNoLeidas(count || 0)
  }

  const cerrarSesion = () => {
    localStorage.clear()
    document.cookie = 'empleado_token=; path=/; max-age=0'
    router.push('/empleado/login')
  }

  if (pathname === '/empleado/login') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!empleado) {
    return null
  }

  const menuItems = [
    { href: '/empleado/recibos', label: 'Mis Recibos', icon: '📄' },
    { href: '/empleado/incentivos', label: 'Mis Incentivos', icon: '🎯' },
    { href: '/empleado/dashboard', label: 'Mi Dashboard', icon: '📊' },
    { href: '/empleado/notificaciones', label: 'Notificaciones', icon: '🔔' },
    { href: '/empleado/solicitudes', label: 'Solicitudes', icon: '💰' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-blue-600">Portal RRHH</h1>
              </div>
              <nav className="ml-10 flex space-x-4">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}

                      {item.href === '/empleado/notificaciones' && notificacionesNoLeidas > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {notificacionesNoLeidas > 9 ? '9+' : notificacionesNoLeidas}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {empleado.nombre_completo || empleado.nombre}
                </p>
                <p className="text-xs text-gray-500">CUIL: {empleado.cuil}</p>
              </div>
              <button
                onClick={cerrarSesion}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <NotificacionesPush />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}