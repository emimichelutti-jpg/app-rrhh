'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginEmpleado() {
  const router = useRouter()
  const [cuil, setCuil] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const formatearCUIL = (valor: string) => {
    const numeros = valor.replace(/\D/g, '')
    if (numeros.length <= 2) return numeros
    if (numeros.length <= 10) return numeros.slice(0, 2) + '-' + numeros.slice(2)
    return numeros.slice(0, 2) + '-' + numeros.slice(2, 10) + '-' + numeros.slice(10, 11)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const cuilLimpio = cuil.replace(/-/g, '')
      if (cuilLimpio.length !== 11) {
        setError('El CUIL debe tener 11 dígitos')
        setLoading(false)
        return
      }

      const response = await fetch('/api/empleado/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuil, password })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'CUIL o contraseña incorrectos')
        setLoading(false)
        return
      }

      localStorage.setItem('empleado_data', JSON.stringify(data.empleado))

      if (data.token) {
        document.cookie = 'empleado_token=' + data.token + '; path=/; max-age=86400; SameSite=Lax'
        console.log('Cookie guardada')
      }

      if (!data.empleado.firmaRegistrada) {
        router.push('/empleado/registro-firma')
      } else {
        router.push('/empleado/recibos')
      }

    } catch (err: any) {
      console.error('Error en login:', err)
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Portal del Empleado</h1>
          <p className="text-gray-500 text-sm mt-1">MOVILSAT COMUNICACIONES SA</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CUIL</label>
            <input
              type="text"
              value={cuil}
              onChange={(e) => setCuil(formatearCUIL(e.target.value))}
              placeholder="20-12345678-9"
              maxLength={13}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}