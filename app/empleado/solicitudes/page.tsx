'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SolicitudesPage() {
  const router = useRouter()
  const [empleado, setEmpleado] = useState<any>(null)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarSolicitudes(emp.id)
    } else {
      router.push('/empleado/login')
    }
  }, [router])

  const cargarSolicitudes = async (empleadoId: string) => {
    try {
      const { data, error } = await supabase
        .from('solicitudes_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('fecha_solicitud', { ascending: false })

      if (error) throw error
      setSolicitudes(data || [])
    } catch (error) {
      console.error('Error cargando solicitudes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setEnviando(true)

    try {
      const montoNum = parseFloat(monto)
      if (isNaN(montoNum) || montoNum <= 0) {
        throw new Error('El monto debe ser mayor a 0')
      }

      // Determinar si es adelanto o préstamo
      // Por ahora, si es <= 500000 es adelanto, si es mayor es préstamo
      // Esto se puede ajustar según el sueldo del empleado
      const tipo = montoNum <= 500000 ? 'adelanto' : 'prestamo'
      const cantidadCuotas = tipo === 'adelanto' ? 1 : Math.ceil(montoNum / 500000)
      const montoCuota = montoNum / cantidadCuotas

      const { error } = await supabase.from('solicitudes_sueldo').insert({
        empleado_id: empleado.id,
        monto_total: montoNum,
        motivo,
        tipo,
        cantidad_cuotas: cantidadCuotas,
        cuotas_restantes: cantidadCuotas,
        monto_cuota: montoCuota,
        estado: 'pendiente',
        periodo_inicio: new Date().toISOString().slice(0, 7), // YYYY-MM
      })

      if (error) throw error

      setSuccess('Solicitud enviada correctamente. Será revisada por RRHH.')
      setMostrarFormulario(false)
      setMonto('')
      setMotivo('')
      cargarSolicitudes(empleado.id)
    } catch (error: any) {
      setError(error.message || 'Error al enviar la solicitud')
    } finally {
      setEnviando(false)
    }
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

  const getTipoLabel = (tipo: string, cuotas: number) => {
    if (tipo === 'adelanto') return 'Adelanto'
    return `Préstamo (${cuotas} cuotas)`
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando solicitudes...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mis Solicitudes</h1>
          <p className="text-gray-600">Gestioná tus adelantos y préstamos</p>
        </div>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {mostrarFormulario ? '✕ Cancelar' : '+ Nueva Solicitud'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Formulario de nueva solicitud */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Solicitar Adelanto de Sueldo</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto solicitado ($)
              </label>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                min="1"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: 100000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si el monto supera tu sueldo quincenal, se convertirá automáticamente en un préstamo con cuotas.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Explicá brevemente el motivo de la solicitud..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {enviando ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de solicitudes */}
      <div className="space-y-4">
        {solicitudes.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            <p className="text-lg">No tenés solicitudes registradas</p>
            <p className="text-sm mt-2">Hacé clic en "Nueva Solicitud" para comenzar</p>
          </div>
        ) : (
          solicitudes.map((solicitud) => (
            <div key={solicitud.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {getTipoLabel(solicitud.tipo, solicitud.cantidad_cuotas)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(solicitud.estado)}`}>
                  {solicitud.estado.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Monto total</p>
                  <p className="text-xl font-bold">${solicitud.monto_total.toLocaleString('es-AR')}</p>
                </div>
                {solicitud.cantidad_cuotas > 1 && (
                  <div>
                    <p className="text-sm text-gray-600">Cuotas</p>
                    <p className="text-xl font-bold">
                      {solicitud.cuotas_restantes} de {solicitud.cantidad_cuotas}
                    </p>
                    <p className="text-sm text-gray-500">
                      ${solicitud.monto_cuota.toLocaleString('es-AR')} c/u
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-1">Motivo:</p>
                <p className="text-sm">{solicitud.motivo}</p>
              </div>

              {solicitud.motivo_rechazo && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm font-medium text-red-800">Motivo del rechazo:</p>
                  <p className="text-sm text-red-700">{solicitud.motivo_rechazo}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}