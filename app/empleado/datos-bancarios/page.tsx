'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DatosBancariosPage() {
  const [empleado, setEmpleado] = useState<any>(null)
  const [datosBancarios, setDatosBancarios] = useState<any>({
    cuenta_banco: '',
    cbu: '',
    alias_cbu: ''
  })
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    cbu_nuevo: '',
    alias_nuevo: '',
    banco_nuevo: '',
    motivo: ''
  })
  const [enviando, setEnviando] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      setDatosBancarios({
        cuenta_banco: emp.cuenta_banco || '',
        cbu: emp.cbu || '',
        alias_cbu: emp.alias_cbu || ''
      })
      cargarSolicitudes(emp.id)
    }
  }, [])

  const cargarSolicitudes = async (empleadoId: string) => {
    const { data } = await supabase
      .from('solicitudes_cambio_cbu')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('created_at', { ascending: false })
    
    setSolicitudes(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)

    try {
      // Validar CBU (22 dígitos)
      if (nuevaSolicitud.cbu_nuevo.replace(/\D/g, '').length !== 22) {
        alert('El CBU debe tener 22 dígitos')
        setEnviando(false)
        return
      }

      const { error } = await supabase
        .from('solicitudes_cambio_cbu')
        .insert({
          empleado_id: empleado.id,
          cbu_anterior: datosBancarios.cbu,
          cbu_nuevo: nuevaSolicitud.cbu_nuevo.replace(/\D/g, ''),
          alias_nuevo: nuevaSolicitud.alias_nuevo,
          banco_nuevo: nuevaSolicitud.banco_nuevo,
          motivo: nuevaSolicitud.motivo,
          estado: 'pendiente'
        })

      if (error) throw error

      // Crear notificación para el admin
      await supabase.from('notificaciones').insert({
        empleado_id: empleado.id,
        tipo: 'solicitud_cbu',
        titulo: 'Solicitud de Cambio de CBU',
        mensaje: `El empleado ${empleado.nombre_completo} solicitó cambiar su CBU`,
        leido: false
      })

      alert('✅ Solicitud enviada correctamente. RRHH revisará tu pedido.')
      setMostrarFormulario(false)
      setNuevaSolicitud({
        cbu_nuevo: '',
        alias_nuevo: '',
        banco_nuevo: '',
        motivo: ''
      })
      cargarSolicitudes(empleado.id)
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setEnviando(false)
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
        <h1 className="text-2xl font-bold">Mis Datos Bancarios</h1>
        <p className="text-gray-600">Gestión de tu cuenta bancaria para cobros</p>
      </div>

      {/* Datos Actuales */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Cuenta Bancaria Actual</h2>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Banco</p>
            <p className="font-semibold text-lg">
              {datosBancarios.cuenta_banco || 'No cargado'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">CBU</p>
            <p className="font-semibold text-lg font-mono">
              {datosBancarios.cbu || 'No cargado'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Alias</p>
            <p className="font-semibold text-lg">
              {datosBancarios.alias_cbu || 'No cargado'}
            </p>
          </div>
        </div>

        {!datosBancarios.cbu && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-yellow-800 text-sm">
              ⚠️ No tenés CBU cargado. Solicitalo a RRHH para poder cobrar.
            </p>
          </div>
        )}

        <button
          onClick={() => setMostrarFormulario(true)}
          className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Solicitar Cambio de CBU
        </button>
      </div>

      {/* Formulario de Solicitud */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Solicitar Cambio de CBU</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nuevo CBU (22 dígitos):</label>
                <input
                  type="text"
                  value={nuevaSolicitud.cbu_nuevo}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, cbu_nuevo: e.target.value})}
                  required
                  maxLength={22}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="0000000000000000000000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {nuevaSolicitud.cbu_nuevo.replace(/\D/g, '').length}/22 dígitos
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Banco:</label>
                <input
                  type="text"
                  value={nuevaSolicitud.banco_nuevo}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, banco_nuevo: e.target.value})}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Banco Galicia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Alias (opcional):</label>
                <input
                  type="text"
                  value={nuevaSolicitud.alias_nuevo}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, alias_nuevo: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="juan.perez.galicia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Motivo:</label>
                <textarea
                  value={nuevaSolicitud.motivo}
                  onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, motivo: e.target.value})}
                  required
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Cambio de banco, actualización de datos, etc."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  ℹ️ RRHH revisará tu solicitud y podrá pedirte un comprobante bancario.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {enviando ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historial de Solicitudes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Historial de Solicitudes</h2>
        
        {solicitudes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No tenés solicitudes de cambio de CBU</p>
        ) : (
          <div className="space-y-3">
            {solicitudes.map((solicitud) => (
              <div key={solicitud.id} className="border border-gray-200 rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">
                      CBU: {solicitud.cbu_nuevo}
                    </p>
                    <p className="text-sm text-gray-600">{solicitud.banco_nuevo}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(solicitud.estado)}`}>
                    {solicitud.estado.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{solicitud.motivo}</p>
                <p className="text-xs text-gray-400">
                  Solicitado el {new Date(solicitud.created_at).toLocaleString('es-AR')}
                </p>
                {solicitud.motivo_rechazo && (
                  <p className="text-sm text-red-600 mt-2">
                    <strong>Motivo del rechazo:</strong> {solicitud.motivo_rechazo}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}