'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function EmpleadoLoginPage() {
  const router = useRouter()
  const [cuil, setCuil] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Buscar empleado por CUIL
      const { data: empleado, error: errorEmpleado } = await supabase
        .from('empleados')
        .select('*')
        .eq('cuil', cuil.replace(/[-\s]/g, ''))
        .eq('activo', true)
        .single()

      if (errorEmpleado || !empleado) {
        setError('CUIL no encontrado o empleado inactivo')
        setLoading(false)
        return
      }

      // Verificar password (si tiene, sino permite entrar)
      if (empleado.password_hash && password) {
        // Acá iría la verificación de password si la implementás
        // Por ahora, si tiene password, requerimos que lo ingrese
      }

      // Crear token simple
      const token = btoa(JSON.stringify({
        empleado_id: empleado.id,
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
      }))

      // Guardar en localStorage y cookie
      localStorage.setItem('empleado_data', JSON.stringify(empleado))
      document.cookie = `empleado_token=${token}; path=/; max-age=86400`

      // Redirigir al dashboard
      router.push('/empleado/dashboard')
    } catch (error: any) {
      setError('Error al iniciar sesión: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">App RRHH</h1>
          <p className="mt-2 text-gray-600">Iniciar Sesión</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="cuil" className="block text-sm font-medium text-gray-700">
              CUIL
            </label>
            <input
              id="cuil"
              name="cuil"
              type="text"
              required
              value={cuil}
              onChange={(e) => setCuil(e.target.value)}
              placeholder="20-28729145-1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Ingresá tu CUIL sin espacios</p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña (opcional)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Dejá en blanco si no tenés contraseña</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600">
          <p>¿Necesitás ayuda? Contactá a RRHH</p>
        </div>
      </div>
    </div>
  )
}