'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import FirmaDigital from './FirmaDigital'

export default function MisRecibosPage() {
  const [recibos, setRecibos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [empleado, setEmpleado] = useState<any>(null)
  const [reciboAFirmar, setReciboAFirmar] = useState<any>(null)
  const [firmando, setFirmando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      // Obtener empleado logueado
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: empData } = await supabase
        .from('empleados')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (empData) {
        setEmpleado(empData)

        // Obtener recibos
        const { data: recibosData } = await supabase
          .from('recibos_sueldo')
          .select('*')
          .eq('empleado_id', empData.id)
          .order('periodo', { ascending: false })

        if (recibosData) {
          setRecibos(recibosData)
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFirma = async (firmaBase64: string) => {
    if (!reciboAFirmar || !empleado) return

    try {
      const response = await fetch('/api/recibos/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reciboId: reciboAFirmar.id,
          firmaBase64,
          empleadoNombre: empleado.nombre_completo,
          ipFirmante: '127.0.0.1' // En producción, obtener del request
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Recibo firmado exitosamente\nHash: ' + data.firmaHash.substring(0, 16) + '...')
        setFirmando(false)
        setReciboAFirmar(null)
        cargarDatos() // Recargar lista
      } else {
        alert('❌ Error: ' + data.error)
      }
    } catch (error: any) {
      alert('Error firmando recibo: ' + error.message)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Cargando recibos...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis Recibos de Sueldo</h1>
        <p className="text-gray-600">{empleado?.nombre_completo}</p>
      </div>

      {/* Lista de recibos */}
      <div className="space-y-4">
        {recibos.map((recibo) => (
          <div key={recibo.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">
                  Recibo Nº {recibo.numero_recibo} - {recibo.periodo} {recibo.quincena}
                </h3>
                <p className="text-sm text-gray-600">
                  Neto a Cobrar: <span className="font-bold text-green-700">
                    ${recibo.neto_a_cobrar.toLocaleString('es-AR')}
                  </span>
                </p>
              </div>
              
              {/* Badge de estado */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                recibo.estado_firma === 'firmado' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {recibo.estado_firma === 'firmado' ? '✅ Firmado' : '⏳ Pendiente de Firma'}
              </div>
            </div>

            {/* Detalles */}
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-600">Total Haberes:</span>
                <p className="font-medium">${recibo.total_remunerativo_sujeto_retencion.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <span className="text-gray-600">Descuentos:</span>
                <p className="font-medium text-red-600">-${recibo.total_descuentos.toLocaleString('es-AR')}</p>
              </div>
              {recibo.fecha_firma && (
                <div>
                  <span className="text-gray-600">Firmado el:</span>
                  <p className="font-medium">{new Date(recibo.fecha_firma).toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>

            {/* Botón de firma */}
            {recibo.estado_firma === 'pendiente' && (
              <button
                onClick={() => {
                  setReciboAFirmar(recibo)
                  setFirmando(true)
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                📝 Firmar Recibo Digitalmente
              </button>
            )}

            {/* Vista de firma existente */}
            {recibo.estado_firma === 'firmado' && recibo.firma_imagen_url && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-gray-600 mb-2">Firma registrada:</p>
                <img 
                  src={recibo.firma_imagen_url} 
                  alt="Firma" 
                  className="border rounded h-24"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Hash: {recibo.firma_hash?.substring(0, 32)}...
                </p>
              </div>
            )}
          </div>
        ))}

        {recibos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay recibos disponibles
          </div>
        )}
      </div>

      {/* Modal de firma */}
      {firmando && reciboAFirmar && (
        <FirmaDigital
          onFirmaCompleta={handleFirma}
          onCancel={() => {
            setFirmando(false)
            setReciboAFirmar(null)
          }}
          empleadoNombre={empleado?.nombre_completo || ''}
          reciboNumero={reciboAFirmar.numero_recibo || ''}
          periodo={`${reciboAFirmar.periodo} - ${reciboAFirmar.quincena}`}
          neto={reciboAFirmar.neto_a_cobrar}
        />
      )}
    </div>
  )
}