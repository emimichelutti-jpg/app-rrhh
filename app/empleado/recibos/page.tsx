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

  // 🆕 Reemplazan alert() y confirm()
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error' | 'aviso'; mensaje: string } | null>(null)
  const [confirmacionFirma, setConfirmacionFirma] = useState<'conforme' | 'no_conforme' | null>(null)
const [esMovil, setEsMovil] = useState(false)

useEffect(() => {
  const mq = window.matchMedia('(max-width: 768px)')
  setEsMovil(mq.matches)
  const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])


  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarDatos(emp.id)
    }
  }, [])

  // 🆕 Toast con auto-cierre
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const mostrarToast = (tipo: 'ok' | 'error' | 'aviso', mensaje: string) => {
    setToast({ tipo, mensaje })
  }

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
        setRecibos(calcularBloqueosYAnulables(recibosData, adelantosData || []))
      }
      setAdelantos(adelantosData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Lógica de negocio SIN CAMBIOS (bloqueos secuenciales + adelantos)
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

  // 🆕 Separar pendientes y firmados para mostrar
  const pendientes = recibos
    .filter(r => r.estado !== 'firmado')
    .reverse() // Más recientes primero

  const firmados = recibos
    .filter(r => r.estado === 'firmado')
    .reverse() // Más recientes primero

  const verPreview = (recibo: any) => {
    if (!empleado?.firma_registrada_url) {
      mostrarToast('aviso', 'Primero debés registrar tu firma digital para poder firmar recibos.')
      setMostrarRegistroFirma(true)
      return
    }
    if (!recibo.pdf_original_url) {
      mostrarToast('error', 'No hay PDF disponible para este recibo.')
      return
    }
    setReciboAPreview(recibo)
    setMostrandoPreview(true)
  }

  const pedirConfirmacion = (tipo: 'conforme' | 'no_conforme') => {
    setConfirmacionFirma(tipo)
  }

  const firmarRecibo = async (tipo: 'conforme' | 'no_conforme') => {
    if (!reciboAPreview || !empleado) return
    setConfirmacionFirma(null)

    if (reciboAPreview.estaBloqueado) {
      mostrarToast('aviso', 'Tenés recibos anteriores pendientes de firma. Firmalos primero.')
      setMostrandoPreview(false)
      return
    }

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
        mostrarToast(
          tipo === 'conforme' ? 'ok' : 'aviso',
          tipo === 'conforme'
            ? '✅ Recibo firmado correctamente. ¡Gracias!'
            : 'Recibo marcado como NO CONFORME. RRHH fue notificado y se pondrá en contacto.'
        )
        setMostrandoPreview(false)
        setReciboAPreview(null)
        cargarDatos(empleado.id)
      } else {
        mostrarToast('error', 'Error al firmar: ' + data.error)
      }
    } catch (error: any) {
      mostrarToast('error', 'Error de conexión: ' + error.message)
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
        mostrarToast('error', 'Error al generar PDF: ' + data.error)
      }
    } catch (error: any) {
      mostrarToast('error', 'Error de conexión: ' + error.message)
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

  const getNombrePeriodo = (periodo: string, quincena: string) => {
    if (!periodo) return ''
    const [year, month] = periodo.split('-')
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${meses[parseInt(month) - 1]} ${year} · ${quincena} Quincena`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando tus recibos...</p>
        </div>
      </div>
    )
  }

  if (!empleado) {
    return <div className="text-center py-12 text-rose-600">No se encontró el empleado</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 🆕 TOAST DE NOTIFICACIONES */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-2xl max-w-md w-[90%] text-sm font-medium ${
          toast.tipo === 'ok' ? 'bg-emerald-600 text-white' :
          toast.tipo === 'error' ? 'bg-rose-600 text-white' :
          'bg-amber-500 text-white'
        }`}>
          {toast.mensaje}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white px-5 pt-8 pb-16 rounded-b-[2.5rem] shadow-lg">
        <h1 className="text-2xl font-bold">📄 Mis Recibos</h1>
        <p className="text-slate-300 text-sm mt-1">
          {pendientes.length > 0
            ? `Tenés ${pendientes.length} ${pendientes.length === 1 ? 'recibo pendiente' : 'recibos pendientes'} de firma`
            : 'Estás al día con tus firmas ✅'}
        </p>
      </div>

      <div className="px-5 -mt-10 space-y-6">

        {/* AVISO SI NO TIENE FIRMA REGISTRADA */}
        {!empleado.firma_registrada_url && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-dashed border-slate-300 p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">✍️</div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">Registrá tu firma digital</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Es un paso único: dibujás tu firma una sola vez y después firmás todos tus recibos con un toque.
                </p>
                <button
                  onClick={() => setMostrarRegistroFirma(true)}
                  className="mt-3 w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  ✍️ Registrar mi firma ahora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADELANTOS ACTIVOS */}
        {adelantos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span>💸</span> Adelantos activos
            </h2>
            <div className="space-y-2">
              {adelantos.map((adelanto: any) => (
                <div key={adelanto.id} className="flex justify-between items-center bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium text-amber-900 text-sm">
                      {adelanto.tipo === 'adelanto' ? 'Adelanto de sueldo' : 'Préstamo'}
                    </p>
                    <p className="text-xs text-amber-700">Cuota: ${adelanto.monto_cuota?.toLocaleString('es-AR')}</p>
                  </div>
                  <p className="font-bold text-amber-900">${adelanto.monto_total?.toLocaleString('es-AR')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⏳ SECCIÓN: PARA FIRMAR */}
        {pendientes.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-900 mb-3 px-1 flex items-center gap-2">
              <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {pendientes.length}
              </span>
              Para firmar
            </h2>
            <div className="space-y-3">
              {pendientes.map((recibo: any) => (
                <div
                  key={recibo.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 p-5 ${
                    recibo.estaBloqueado ? 'border-slate-200 opacity-70' : 'border-amber-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {getNombrePeriodo(recibo.periodo, recibo.quincena)}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Neto: <span className="font-bold text-slate-900">${recibo.neto_a_cobrar?.toLocaleString('es-AR') || 0}</span>
                      </p>
                      {recibo.totalAdelantos > 0 && (
                        <p className="text-sm text-amber-700 font-semibold mt-1">
                          Total a cobrar: ${recibo.totalACobrar.toLocaleString('es-AR')}
                          <span className="font-normal text-xs"> (con descuento de adelanto)</span>
                        </p>
                      )}
                    </div>
                    <span className="text-2xl">{recibo.estaBloqueado ? '🔒' : '⏳'}</span>
                  </div>

                  {recibo.estaBloqueado ? (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      🔒 Firmá primero tus recibos anteriores para desbloquear este.
                    </p>
                  ) : (
                    <button
                      onClick={() => verPreview(recibo)}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold active:scale-[0.98] transition-all shadow-sm"
                    >
                      👁️ Ver y firmar →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ SECCIÓN: FIRMADOS (HISTORIAL) */}
        <div>
          <h2 className="font-bold text-slate-900 mb-3 px-1 flex items-center gap-2">
            <span>✅</span> Firmados
          </h2>
          {firmados.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-sm">Todavía no firmaste ningún recibo</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {firmados.map((recibo: any, index: number) => (
                <div
                  key={recibo.id}
                  className={`p-4 flex justify-between items-center ${index !== firmados.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-lg">✅</div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">
                        {getNombrePeriodo(recibo.periodo, recibo.quincena)}
                      </p>
                      <p className="text-xs text-slate-500">
                        ${recibo.neto_a_cobrar?.toLocaleString('es-AR') || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => verPreview(recibo)}
                      className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                      title="Ver"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => descargarPDF(recibo.id)}
                      disabled={generandoPDF === recibo.id}
                      className="px-3 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {generandoPDF === recibo.id ? '...' : '⬇️ PDF'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE REGISTRO DE FIRMA (sin cambios) */}
      {mostrarRegistroFirma && empleado && (
        <RegistrarFirma
          empleadoId={empleado.id}
          onSuccess={() => {
            setMostrarRegistroFirma(false)
            mostrarToast('ok', '✅ Firma registrada correctamente. Ya podés firmar tus recibos.')
            cargarDatos(empleado.id)
          }}
        />
      )}

      {/* MODAL DE PREVIEW + FIRMA */}
      {mostrandoPreview && reciboAPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] sm:h-[90vh] flex flex-col overflow-hidden">
            {/* Header del modal */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h2 className="font-bold">Vista previa del recibo</h2>
                <p className="text-sm text-slate-300">
                  {getNombrePeriodo(reciboAPreview.periodo, reciboAPreview.quincena)}
                </p>
              </div>
              <button
                onClick={() => { setMostrandoPreview(false); setReciboAPreview(null) }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 text-2xl"
              >
                ×
              </button>
            </div>

            {/* PDF */}
            {esMovil ? (
  /* 📱 MÓVIL: botón grande en lugar de iframe vacío */
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
    <span className="text-6xl mb-4">📄</span>
    <p className="font-bold text-slate-800 text-lg mb-1">Tu recibo está listo</p>
    <p className="text-sm text-slate-500 mb-6">
      Revisá los montos antes de firmar
    </p>
    <a
      href={construirUrlPreview(reciboAPreview) || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-base shadow-lg active:scale-95 transition-transform"
    >
      🔗 Ver recibo completo
    </a>
    <p className="text-xs text-slate-400 mt-4">Se abre en una pestaña nueva</p>
  </div>
) : (
  /* 💻 ESCRITORIO: iframe con el PDF */
  <div className="flex-1 overflow-hidden bg-slate-100 relative">
    <iframe
      src={construirUrlPreview(reciboAPreview) || ''}
      className="w-full h-full border-0"
      title="Vista previa del recibo"
      type="application/pdf"
    />
    <a
      href={construirUrlPreview(reciboAPreview) || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-2 rounded-lg text-xs font-semibold text-slate-800 shadow-lg"
    >
      🔗 Abrir en pestaña nueva
    </a>
  </div>
)}

            {/* Resumen + botones de firma */}
            <div className="bg-white px-5 py-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-3 bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-slate-500">Total a cobrar</p>
                  <p className="font-bold text-slate-900 text-lg">
                    ${reciboAPreview.totalACobrar?.toLocaleString('es-AR')}
                  </p>
                </div>
                {reciboAPreview.totalAdelantos > 0 && (
                  <p className="text-xs text-amber-700 text-right">
                    Incluye descuento<br />de ${reciboAPreview.totalAdelantos.toLocaleString('es-AR')}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => pedirConfirmacion('no_conforme')}
                  className="flex-1 bg-white text-rose-700 border-2 border-rose-300 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors"
                >
                  ❌ No conforme
                </button>
                <button
                  onClick={() => pedirConfirmacion('conforme')}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg"
                >
                  ✅ Firmar conforme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 MODAL DE CONFIRMACIÓN (reemplaza confirm()) */}
      {confirmacionFirma && reciboAPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-5">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-3 ${
                confirmacionFirma === 'conforme' ? 'bg-emerald-100' : 'bg-rose-100'
              }`}>
                {confirmacionFirma === 'conforme' ? '✅' : '❌'}
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {confirmacionFirma === 'conforme' ? '¿Firmar conforme?' : '¿Firmar NO conforme?'}
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                {confirmacionFirma === 'conforme'
                  ? 'Confirmás que revisaste el recibo y estás de acuerdo con los montos.'
                  : 'RRHH será notificado y se pondrá en contacto con vos para revisar el recibo.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmacionFirma(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => firmarRecibo(confirmacionFirma)}
                className={`flex-1 py-3 rounded-xl font-bold text-white ${
                  confirmacionFirma === 'conforme' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}