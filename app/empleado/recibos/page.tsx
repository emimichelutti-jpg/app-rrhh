'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import FirmaDigital from './FirmaDigital'

// Cliente de Supabase para queries (usando ANON KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MisRecibosPage() {
  const router = useRouter()
  const [recibos, setRecibos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [empleado, setEmpleado] = useState<any>(null)
  const [reciboAFirmar, setReciboAFirmar] = useState<any>(null)
  const [reciboAPreview, setReciboAPreview] = useState<any>(null)
  const [firmando, setFirmando] = useState(false)
  const [mostrandoPreview, setMostrandoPreview] = useState(false)
  const [errorFirma, setErrorFirma] = useState('')
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)
  const [anulandoRecibo, setAnulandoRecibo] = useState<string | null>(null)

  useEffect(() => {
    verificarSesion()
  }, [])

  const verificarSesion = async () => {
    // Verificar token en cookie
    const cookies = document.cookie
    const cookieMatch = cookies.match(/empleado_token=([^;]+)/)
    const token = cookieMatch ? cookieMatch[1] : null

    const empleadoData = localStorage.getItem('empleado_data')

    if (!token || !empleadoData) {
      router.push('/empleado/login')
      return
    }

    try {
      // Verificar que el token no esté expirado
      const payload = JSON.parse(atob(token))
      if (payload.exp < Date.now()) {
        localStorage.clear()
        document.cookie = 'empleado_token=; path=/; max-age=0'
        router.push('/empleado/login?error=sesion-expirada')
        return
      }

      const empData = JSON.parse(empleadoData)
      setEmpleado(empData)

      await cargarRecibos(empData.id)
    } catch (error) {
      console.error('Error verificando sesión:', error)
      localStorage.clear()
      router.push('/empleado/login')
    } finally {
      setLoading(false)
    }
  }

  const cargarRecibos = async (empleadoId: string) => {
    try {
      const { data: recibosData, error } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: true })
        .order('quincena', { ascending: true })

      if (error) throw error

      if (recibosData) {
        const recibosProcesados = calcularBloqueosYAnulables(recibosData)
        setRecibos(recibosProcesados)
      }
    } catch (error) {
      console.error('Error cargando recibos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularBloqueosYAnulables = (listaRecibos: any[]) => {
    let hayPendienteAnterior = false
    const ahora = new Date()

    return listaRecibos.map(recibo => {
      const estaBloqueado = hayPendienteAnterior

      let puedeAnular = false
      let horasRestantes = 0

      if (recibo.estado === 'firmado' && recibo.firma_empleado_fecha) {
        const fechaFirma = new Date(recibo.firma_empleado_fecha)
        const horasTranscurridas = (ahora.getTime() - fechaFirma.getTime()) / (1000 * 60 * 60)
        horasRestantes = Math.max(0, Math.floor(24 - horasTranscurridas))
        puedeAnular = horasTranscurridas < 24
      }

      if (recibo.estado === 'pendiente') {
        hayPendienteAnterior = true
      }

      return {
        ...recibo,
        estaBloqueado,
        puedeAnular,
        horasRestantes
      }
    })
  }

  const cerrarSesion = () => {
    localStorage.clear()
    document.cookie = 'empleado_token=; path=/; max-age=0'
    router.push('/empleado/login')
  }

  const handleFirma = async (firmaBase64: string) => {
    if (!reciboAFirmar || !empleado) return
    setErrorFirma('')

    try {
      const response = await fetch('/api/recibos/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reciboId: reciboAFirmar.id,
          firmaBase64,
          empleadoNombre: empleado.nombre_completo || empleado.nombre,
          ipFirmante: '127.0.0.1'
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Recibo firmado exitosamente')
        setFirmando(false)
        setReciboAFirmar(null)
        cargarRecibos(empleado.id)
      } else {
        setErrorFirma(data.error || 'Error al firmar')
        setFirmando(false)
        setReciboAFirmar(null)
      }
    } catch (error: any) {
      setErrorFirma('Error de conexión: ' + error.message)
      setFirmando(false)
    }
  }

  const descargarPDF = async (reciboId: string) => {
    setGenerandoPDF(reciboId)

    try {
      const response = await fetch('/api/recibos/generar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reciboId })
      })

      const data = await response.json()

      if (data.success) {
        window.open(data.pdfUrl, '_blank')
      } else {
        alert('Error al generar PDF: ' + data.error)
      }
    } catch (error: any) {
      alert('Error de conexión: ' + error.message)
    } finally {
      setGenerandoPDF(null)
    }
  }

  const verPreview = (recibo: any) => {
    if (!recibo.pdf_original_url) {
      alert('No hay PDF disponible para este recibo')
      return
    }
    setReciboAPreview(recibo)
    setMostrandoPreview(true)
  }

  const cerrarPreview = () => {
    setMostrandoPreview(false)
    setReciboAPreview(null)
  }

  const firmarDesdePreview = () => {
    if (!reciboAPreview) return
    
    if (reciboAPreview.estaBloqueado) {
      alert('No podés firmar este recibo porque tenés recibos anteriores pendientes.')
      cerrarPreview()
      return
    }

    setReciboAFirmar(reciboAPreview)
    setFirmando(true)
    cerrarPreview()
  }

  if (loading) {
    return <div className="p-8 text-center">Cargando recibos...</div>
  }

  if (!empleado) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">No se encontró el empleado</h1>
        <button
          onClick={() => router.push('/empleado/login')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Volver al Login
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mis Recibos de Sueldo</h1>
          <p className="text-gray-600">{empleado.nombre_completo || empleado.nombre}</p>
        </div>
        <button
          onClick={cerrarSesion}
          className="text-sm text-red-600 hover:text-red-800 underline"
        >
          Cerrar Sesión
        </button>
      </div>

      {errorFirma && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {errorFirma}
        </div>
      )}

      <div className="space-y-4">
        {recibos.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            <p className="text-lg">No hay recibos disponibles</p>
          </div>
        )}

        {recibos.map((recibo) => (
          <div
            key={recibo.id}
            className={`bg-white rounded-lg shadow p-6 border-l-4 transition-all ${
              recibo.estaBloqueado
                ? 'border-gray-300 opacity-60'
                : recibo.estado === 'firmado'
                ? 'border-green-500'
                : 'border-yellow-500'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">
                  {recibo.periodo} - {recibo.quincena} Quincena
                </h3>
                <p className="text-sm text-gray-600">
                  Neto a Cobrar: <span className="font-bold text-green-700">
                    ${recibo.neto_a_cobrar?.toLocaleString('es-AR') || 0}
                  </span>
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                recibo.estado === 'firmado'
                  ? 'bg-green-100 text-green-800'
                  : recibo.estaBloqueado
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {recibo.estado === 'firmado'
                  ? 'Firmado'
                  : recibo.estaBloqueado
                  ? 'Bloqueado'
                  : 'Pendiente'}
              </span>
            </div>

            <div className="flex gap-2 mt-4">
              {recibo.estado === 'pendiente' && (
                <>
                  <button
                    onClick={() => verPreview(recibo)}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700"
                  >
                    👁 Ver Recibo
                  </button>
                  <button
                    onClick={() => {
                      if (recibo.estaBloqueado) {
                        alert('No podés firmar este recibo porque tenés recibos anteriores pendientes.')
                        return
                      }
                      setReciboAFirmar(recibo)
                      setFirmando(true)
                    }}
                    disabled={recibo.estaBloqueado}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                      recibo.estaBloqueado
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {recibo.estaBloqueado ? 'Bloqueado' : 'Firmar Recibo'}
                  </button>
                </>
              )}

              {recibo.estado === 'firmado' && (
                <>
                  <button
                    onClick={() => verPreview(recibo)}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700"
                  >
                    👁 Ver Recibo
                  </button>
                  <button
                    onClick={() => descargarPDF(recibo.id)}
                    disabled={generandoPDF === recibo.id}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {generandoPDF === recibo.id ? 'Generando...' : 'Descargar PDF'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Vista Previa del PDF */}
      {mostrandoPreview && reciboAPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Vista Previa del Recibo</h2>
                <p className="text-sm text-purple-100">
                  {reciboAPreview.periodo} - {reciboAPreview.quincena} Quincena
                </p>
              </div>
              <button
                onClick={cerrarPreview}
                className="text-white hover:text-gray-200 text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Información del Recibo */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Empleado:</span>
                  <p className="font-medium">{empleado.nombre_completo || empleado.nombre}</p>
                </div>
                <div>
                  <span className="text-gray-600">CUIL:</span>
                  <p className="font-medium">{empleado.cuil}</p>
                </div>
                <div>
                  <span className="text-gray-600">Período:</span>
                  <p className="font-medium">{reciboAPreview.periodo} - {reciboAPreview.quincena}</p>
                </div>
                <div>
                  <span className="text-gray-600">Neto a Cobrar:</span>
                  <p className="font-bold text-green-700">
                    ${reciboAPreview.neto_a_cobrar?.toLocaleString('es-AR') || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Visor de PDF */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={reciboAPreview.pdf_original_url}
                className="w-full h-full border-0"
                title="Vista previa del recibo"
              />
            </div>

            {/* Footer con Acciones */}
            <div className="bg-white px-6 py-4 border-t border-gray-200 rounded-b-lg">
              <div className="flex gap-3">
                <button
                  onClick={cerrarPreview}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Cerrar
                </button>
                {reciboAPreview.estado === 'pendiente' && !reciboAPreview.estaBloqueado && (
                  <button
                    onClick={firmarDesdePreview}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    ✍️ Firmar este Recibo
                  </button>
                )}
                {reciboAPreview.estado === 'firmado' && (
                  <button
                    onClick={() => {
                      descargarPDF(reciboAPreview.id)
                      cerrarPreview()
                    }}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    ⬇️ Descargar PDF Firmado
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {firmando && reciboAFirmar && (
        <FirmaDigital
          onFirmaCompleta={handleFirma}
          onCancel={() => { setFirmando(false); setReciboAFirmar(null); }}
          empleadoNombre={empleado.nombre_completo || empleado.nombre || ''}
          reciboNumero={reciboAFirmar.numero_recibo || ''}
          periodo={`${reciboAFirmar.periodo} - ${reciboAFirmar.quincena}`}
          neto={reciboAFirmar.neto_a_cobrar}
        />
      )}
    </div>
  )
}