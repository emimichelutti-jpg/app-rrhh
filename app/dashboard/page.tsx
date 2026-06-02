'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('cargando...')
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        window.location.href = '/'
        return
      }

      setEmail(session.user.email || '')

      const { data: empleado, error } = await supabase
        .from('empleados')
        .select('nombre_completo, rol')
        .eq('user_id', session.user.id)
        .single()

      if (error) {
        console.error('Error al obtener empleado:', error)
      }

      if (empleado) {
        setNombre(empleado.nombre_completo || 'Usuario')
        setRol(empleado.rol || 'empleado')
      } else {
        setRol('no-encontrado')
      }

      setLoading(false)
    }
    checkSession()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const navegar = (ruta: string) => {
    router.push(ruta)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Aplicación RRHH - Panel de control</h1>
          <p className="text-sm text-gray-600">
            {nombre} ({rol === 'admin' ? 'Administrador' : rol === 'directivo' ? 'Directivo' : 'Empleado'})
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* ADMIN */}
          {rol === 'admin' && (
            <div>
              <h2 className="text-2xl font-semibold mb-6">Panel de Administración</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                  onClick={() => navegar('/admin/empleados')}
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
                >
                  <h3 className="text-lg font-semibold mb-2">Gestionar Empleados</h3>
                  <p className="text-gray-600 text-sm">Dar de alta, editar o consultar legajos</p>
                </div>

                <div 
                  onClick={() => navegar('/admin/documentos')}
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
                >
                  <h3 className="text-lg font-semibold mb-2">Documentos</h3>
                  <p className="text-gray-600 text-sm">Gestionar documentación del personal</p>
                </div>

                <div 
                  onClick={() => navegar('/admin/licencias')}
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
                >
                  <h3 className="text-lg font-semibold mb-2">Licencias y Vacaciones</h3>
                  <p className="text-gray-600 text-sm">Aprobar o rechazar solicitudes</p>
                </div>

                <div 
                  onClick={() => navegar('/admin/asistencia')}
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
                >
                  <h3 className="text-lg font-semibold mb-2">Asistencia</h3>
                  <p className="text-gray-600 text-sm">Control de horarios y horas extras</p>
                </div>

                <div 
                  onClick={() => navegar('/admin/reportes')}
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
                >
                  <h3 className="text-lg font-semibold mb-2">Reportes</h3>
                  <p className="text-gray-600 text-sm">Estadísticas y análisis del personal</p>
                </div>
              </div>
            </div>
          )}

          {/* DIRECTIVO */}
          {rol === 'directivo' && (
            <div>
              <h2 className="text-2xl font-semibold mb-6">Panel Directivo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Reportes</h3>
                  <p className="text-gray-600 text-sm">Visualización de reportes y estadísticas</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Consulta de Legajos</h3>
                  <p className="text-gray-600 text-sm">Información del personal (solo lectura)</p>
                </div>
              </div>
            </div>
          )}

          {/* EMPLEADO */}
          {rol === 'empleado' && (
            <div>
              <h2 className="text-2xl font-semibold mb-6">Mi Legajo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Mi Información</h3>
                  <p className="text-gray-600 text-sm">Ver mis datos personales y documentación</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Solicitar Vacaciones</h3>
                  <p className="text-gray-600 text-sm">Pedir días de vacaciones o licencias</p>
                </div>
              </div>
            </div>
          )}

          {/* NO ENCONTRADO */}
          {rol === 'no-encontrado' && (
            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-yellow-800 mb-2">Usuario no encontrado</h2>
              <p className="text-yellow-700">
                No se encontró tu registro en la tabla empleados. Contactá a RRHH.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}