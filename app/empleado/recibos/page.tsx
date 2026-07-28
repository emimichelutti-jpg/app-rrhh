'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import RegistrarFirma from './RegistrarFirma'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MisRecibosPage() {
  const [recibos, setRecibos] = useState<any[]>([])
  const [adelantos, setAdelantos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [empleado, setEmpleado] = useState<any>(null)
  
  const [mostrarRegistroFirma, setMostrarRegistroFirma] = useState(false)
  const [reciboAPreview, setReciboAPreview] = useState<any>(null)
  const [mostrandoPreview, setMostrandoPreview] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarDatos(emp.id)
    }
  }, [])

  const cargarDatos = async (empleadoId: string) => {
    try {
      const { data: empData } = await supabase.from('empleados').select('id, nombre_completo, cuil, firma_registrada_url').eq('id', empleadoId).single()
      if (empData) setEmpleado(empData)

      const { data: recibosData } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: true })
        .order('quincena', { ascending: true })

      const { data: adelantosData } = await supabase
        .from('solicitudes_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .in('estado', ['aprobado', 'en_curso'])
        .order('fecha_solicitud', { ascending: false })

      if (recibosData) {
        const recibosProcesados = calcularBloqueosYAnulables(recibosData, adelantosData || [])
        setRecibos(recibosProcesados)
      }
      setAdelantos(adelantosData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularBloqueosYAnulables = (listaRecibos: any[], listaAdelantos: any[]) => {
    let hayPendienteAnterior = false
    const ahora = new Date()
    return listaRecibos.map(recibo => {
      const estaBloqueado = hayPendienteAnterior
      let puedeAnular = false
      let horasRestantes = 0
      if (recibo.estado === 'firmado' && recibo.fecha_firma) {
        const fechaFirma = new Date(recibo.fecha_firma)
        const horasTranscurridas = (ahora.getTime() - fechaFirma.getTime()) / (1000 * 60 * 60)
        horasRestantes = Math.max(0, Math.floor(24 - horasTranscurridas))
        puedeAnular = horasTranscurridas < 24
      }
      if (recibo.estado === 'pendiente') hayPendienteAnterior = true

      const adelantosDelPeriodo = listaAdelantos.filter((a: any) => a.periodo_inicio === recibo.periodo)
      const totalAdelantos = adelantosDelPeriodo.reduce((sum: number, a: any) => sum + (a.monto_cuota || 0), 0)
      const totalACobrar = (recibo.neto_a_cobrar || 0) - totalAdelantos

      return { ...recibo, estaBloqueado, puedeAnular, horasRestantes, totalAdelantos, totalACobrar }
    })
  }

  const verPreview = (recibo: any) => {
    if (!empleado?.firma_registrada_url) {
      alert('Primero debés registrar tu firma digital en el sistema.')
      setMostrarRegistroFirma(true)
      return
    }
    if (!recibo.pdf_original_url) {
      alert('No hay PDF disponible para este recibo')
      return
    }
    setReciboAPreview(recibo)
    setMostrandoPreview(true)
  }

  const firmarRecibo = async (tipo: 'conforme' | 'no_conforme') => {
    if (!reciboAPreview || !empleado) return
    
    if (reciboAPreview.estaBloqueado) {
      alert('No podés firmar este recibo porque tenés recibos anteriores pendientes.')
      setMostrandoPreview(false)
      return
    }

    const confirmacion = tipo === 'no_conforme' 
      ? '⚠️ ¿Estás seguro de marcar este recibo como NO CONFORME? Se agregará un sello visible y RRHH será notificado.'
      : '✅ ¿Confirmás que el recibo es CONFORME y deseás firmarlo digitalmente?'

    if (!confirm(confirmacion)) return

    try {
      const response = await fetch('/api/recibos/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reciboId: reciboAPreview.id,
          tipoFirma: tipo,
          empleadoId: empleado.id,
          ipFirmante: '127.0.0.1'
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(tipo === 'conforme' ? '✅ Recibo firmado exitosamente' : '⚠️ Recibo marcado como NO CONFORME. RRHH ha sido notificado.')
        setMostrandoPreview(false)
        setReciboAPreview(null)
        cargarDatos(empleado.id)
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error: any) {
      alert('Error de conexión: ' + error.message)
    }
  }

  const descargarPDF = async (reciboId: string) => {
    const recibo = recibos.find(r => r.id === reciboId)
    
    if (recibo?.estado === 'firmado' && recibo?.pdf_url) {
      window.open(recibo.pdf_url, '_blank')
      return
    }
    
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

  const construirUrlPreview = (recibo: any) => {
    if (!recibo?.pdf_original_url) return null
    const baseUrl = recibo.pdf_original_url
    const urlConContentType = baseUrl.includes('?') 
      ? `${baseUrl}&response-content-type=application/pdf`
      : `${baseUrl}?response-content-type=application/pdf`
    if (recibo.pagina_recibo && recibo.pagina_recibo > 0) {
      return `${urlConContentType}#page=${recibo.pagina_recibo}`
    }
    return urlConContentType
  }

  if (loading) return <div className="text-center py-12">Cargando recibos...</div>
  if (!empleado) return <div className="text-center py-12 text-rose-600">No se encontró el empleado</div>

  return (
    <div>
      {/* AVISO SI NO TIENE FIRMA REGISTRADA */}
      {!empleado.firma_registrada_url && (
        <div className="bg-slate-50 border border-slate-200 text-slate-800 px-4 py-4 rounded-lg mb-6 flex justify-between items-center">
          <div>
            <p className="font-bold">⚠️ Aún no registraste tu firma digital</p>
            <p className="text-sm">Necesitás registrar tu firma una sola vez para poder firmar tus recibos.</p>
          </div>
          <button 
            onClick={() => setMostrarRegistroFirma(true)}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-medium transition-colors"
          >
            ✍️ Registrar Ahora
          </button>
        </div>
      )}

      {/* SECCIÓN DE ADELANTOS */}
      {adelantos.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-900"> Adelantos y Préstamos Aprobados</h2>
          <div className="space-y-4">
            {adelantos.map((adelanto: any) => (
              <div key={adelanto.id} className="bg-gradient-to-r from-slate-50 to-slate-100 border-l-4 border-slate-500 rounded-lg shadow p-6">
                <h3 className="font-semibold text-lg text-slate-900">{adelanto.tipo === 'adelanto' ? 'Adelanto de Sueldo' : 'Préstamo'}</h3>
                <p className="text-xl font-bold text-slate-900 mt-2">${adelanto.monto_total.toLocaleString('es-AR')}</p>
                <p className="text-sm text-slate-600 mt-1">{adelanto.motivo}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN DE RECIBOS */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-slate-900">📄 Mis Recibos de Sueldo</h2>
        <div className="space-y-4">
          {recibos.length === 0 && <div className="text-center py-12 text-slate-500 bg-white rounded-lg shadow"><p>No hay recibos disponibles</p></div>}
          
          {recibos.map((recibo: any) => (
            <div key={recibo.id} className={`bg-white rounded-lg shadow p-6 border-l-4 transition-all ${recibo.estaBloqueado ? 'border-slate-300 opacity-60' : recibo.estado === 'firmado' ? 'border-emerald-500' : 'border-amber-500'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">{recibo.periodo} - {recibo.quincena} Quincena</h3>
                  <p className="text-sm text-slate-600">Neto: <span className="font-bold">${recibo.neto_a_cobrar?.toLocaleString('es-AR') || 0}</span></p>
                  {recibo.totalAdelantos > 0 && (
                    <p className="text-lg font-bold text-emerald-700 mt-2 border-t pt-2">TOTAL A COBRAR: ${recibo.totalACobrar.toLocaleString('es-AR')}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${recibo.estado === 'firmado' ? 'bg-emerald-100 text-emerald-800' : recibo.estaBloqueado ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                  {recibo.estado === 'firmado' ? 'Firmado' : recibo.estaBloqueado ? 'Bloqueado' : 'Pendiente'}
                </span>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => verPreview(recibo)} className="flex-1 bg-slate-700 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                  👁️ Ver Recibo
                </button>
                {recibo.estado === 'firmado' && (
                  <button onClick={() => descargarPDF(recibo.id)} disabled={generandoPDF === recibo.id} className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 disabled:bg-slate-400 transition-colors">
                    {generandoPDF === recibo.id ? 'Generando...' : '⬇️ Descargar PDF'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE REGISTRO DE FIRMA */}
      {mostrarRegistroFirma && empleado && (
        <RegistrarFirma 
          empleadoId={empleado.id} 
          onSuccess={() => {
            setMostrarRegistroFirma(false)
            cargarDatos(empleado.id)
          }} 
        />
      )}

      {/* MODAL DE PREVIEW CON 2 BOTONES */}
      {mostrandoPreview && reciboAPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Vista Previa del Recibo</h2>
                <p className="text-sm text-slate-300">{reciboAPreview.periodo} - {reciboAPreview.quincena} Quincena</p>
              </div>
              <button onClick={() => { setMostrandoPreview(false); setReciboAPreview(null); }} className="text-white hover:text-slate-200 text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">×</button>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-100 relative">
              <iframe src={construirUrlPreview(reciboAPreview) || ''} className="w-full h-full border-0" title="Vista previa" type="application/pdf" />
            </div>

            <div className="bg-white px-6 py-4 border-t border-slate-200 rounded-b-lg">
              <p className="text-sm text-slate-600 mb-3 text-center font-medium">Seleccioná una opción para finalizar:</p>
              <div className="flex gap-4">
                <button onClick={() => firmarRecibo('no_conforme')} className="flex-1 bg-rose-100 text-rose-700 border-2 border-rose-300 py-3 rounded-lg font-bold hover:bg-rose-200 transition-colors">
                  ❌ FIRMAR NO CONFORME
                </button>
                <button onClick={() => firmarRecibo('conforme')} className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg">
                  ✅ FIRMAR CONFORME
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}