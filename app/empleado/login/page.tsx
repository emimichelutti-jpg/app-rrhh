'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EmpleadoLoginPage() {
  const router = useRouter()
  const [cuil, setCuil] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [debug, setDebug] = useState<string[]>([])
  const [reactActivo, setReactActivo] = useState(false)

  // Si este efecto corre, React está vivo en el dispositivo
  useEffect(() => {
    setReactActivo(true)
  }, [])

  const log = (msg: string) => {
    setDebug(prev => [...prev, `• ${msg}`])
    console.log('[LOGIN]', msg)
  }

  const formatearCUIL = (valor: string) => {
    const limpio = valor.replace(/\D/g, '').slice(0, 11)
    if (limpio.length <= 2) return limpio
    if (limpio.length <= 10) return `${limpio.slice(0, 2)}-${limpio.slice(2)}`
    return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setDebug([])

    try {
      const cuilLimpio = cuil.replace(/[-\s]/g, '')
      log(`CUIL: ${cuilLimpio} (${cuilLimpio.length} dígitos)`)

      if (cuilLimpio.length !== 11) {
        setError('El CUIL debe tener 11 dígitos')
        setLoading(false)
        return
      }

      log('Consultando base de datos...')

      const { data: empleado, error: errorEmpleado } = await supabase
        .from('empleados')
        .select('*')
        .eq('cuil', cuilLimpio)
        .eq('activo', true)
        .single()

      if (errorEmpleado) {
        log(`ERROR Supabase: ${errorEmpleado.message} (código: ${errorEmpleado.code})`)
      } else {
        log(`Empleado encontrado: ${empleado?.nombre_completo}`)
      }

      if (errorEmpleado || !empleado) {
        setError('CUIL no encontrado o empleado inactivo')
        setLoading(false)
        return
      }

      log('Creando sesión...')

      const token = btoa(JSON.stringify({
        empleado_id: empleado.id,
        exp: Date.now() + (24 * 60 * 60 * 1000)
      }))

      localStorage.setItem('empleado_data', JSON.stringify(empleado))
      document.cookie = `empleado_token=${token}; path=/; max-age=86400`

      log('✅ Login OK, redirigiendo...')
      router.push('/empleado/dashboard')
    } catch (error: any) {
      log(`EXCEPCIÓN: ${error.message}`)
      setError('Error al iniciar sesión: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    // colorScheme light = evita que el modo oscuro del celu rompa los colores
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4"
      style={{ colorScheme: 'light' }}
    >
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-4">
            <span className="text-4xl">👤</span>
          </div>
          <h1 className="text-3xl font-bold text-white">App RRHH</h1>
          <p className="text-slate-400 mt-1">Portal del Empleado</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
              <p className="text-slate-600 mt-1 text-sm">Ingresá con tu CUIL para continuar</p>
            </div>
            {/* 🩺 Indicador de vida de React */}
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
              reactActivo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {reactActivo ? '● React activo' : '● Sin JS'}
            </span>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-4">
              <p className="text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="cuil" className="block text-sm font-semibold text-slate-700 mb-2">
                CUIL
              </label>
              <input
                id="cuil"
                type="text"
                required
                value={cuil}
                onChange={(e) => setCuil(formatearCUIL(e.target.value))}
                placeholder="20-28729145-1"
                className="block w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-base text-slate-900 placeholder:text-slate-400 bg-white"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Contraseña <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dejá en blanco si no tenés"
                className="block w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-base text-slate-900 placeholder:text-slate-400 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white font-semibold rounded-xl shadow-lg disabled:bg-slate-400 text-base"
            >
              {loading ? 'Entrando...' : 'Ingresar →'}
            </button>
          </form>
        </div>

        {/* 🔍 PANEL DE DIAGNÓSTICO */}
        {debug.length > 0 && (
          <div className="mt-4 bg-slate-950/80 border border-slate-700 rounded-xl p-4 text-left">
            <p className="text-slate-400 text-xs font-bold mb-2">🔍 DIAGNÓSTICO:</p>
            {debug.map((linea, i) => (
              <p key={i} className="text-emerald-400 text-xs font-mono mb-1 break-all">{linea}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}