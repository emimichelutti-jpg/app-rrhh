'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'

// Función para normalizar períodos (2026-MAY → 2026-05)
const normalizarPeriodo = (periodo: string): string => {
  const meses: Record<string, string> = {
    'ENE': '01', 'ENERO': '01',
    'FEB': '02', 'FEBRERO': '02',
    'MAR': '03', 'MARZO': '03',
    'ABR': '04', 'ABRIL': '04',
    'MAY': '05', 'MAYO': '05',
    'JUN': '06', 'JUNIO': '06',
    'JUL': '07', 'JULIO': '07',
    'AGO': '08', 'AGOSTO': '08',
    'SEP': '09', 'SEPTIEMBRE': '09',
    'OCT': '10', 'OCTUBRE': '10',
    'NOV': '11', 'NOVIEMBRE': '11',
    'DIC': '12', 'DICIEMBRE': '12'
  }
  
  // Si ya está en formato 2026-05, devolverlo
  if (/^\d{4}-\d{2}$/.test(periodo)) return periodo
  
  // Si es 2026-MAY, convertir
  const match = periodo.match(/(\d{4})-(\w+)/)
  if (match) {
    const anio = match[1]
    const mes = meses[match[2].toUpperCase()] || '01'
    return `${anio}-${mes}`
  }
  
  return periodo
}

interface Recibo {
  id: string
  periodo: string
  periodoNormalizado: string
  mes: string
  quincena: string
  neto_a_cobrar: number
  estado_firma: string
  fecha_firma: string | null
  firma_imagen_url: string | null
  firma_hash: string | null
  ip_firmante: string | null
  pdf_url: string | null
  fue_firmado_anteriormente: boolean
  fecha_anulacion: string | null
  motivo_anulacion: string | null
  created_at: string
  empleados: {
    id: string
    nombre_completo: string
    cuil: string
    legajo: string | null
  }
}

export default function AdminRecibosPage() {
  const router = useRouter()
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState<string>('todos')
  const [filtroQuincena, setFiltroQuincena] = useState<string>('todas')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [reciboSeleccionado, setReciboSeleccionado] = useState<Recibo | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  
  // 🆕 Estados para eliminar recibo
  const [eliminandoRecibo, setEliminandoRecibo] = useState<Recibo | null>(null)
  const [motivoEliminacion, setMotivoEliminacion] = useState('')
  const [errorEliminacion, setErrorEliminacion] = useState('')
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    verificarAuth()
    cargarRecibos()
  }, [])

  const verificarAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/admin/login')
    }
  }

  const cargarRecibos = async () => {
    try {
      const { data, error } = await supabase
        .from('recibos_sueldo')
        .select(`
          *,
          empleados (id, nombre_completo, cuil, legajo)
        `)
        .order('periodo', { ascending: false })
        .order('quincena', { ascending: false })

      if (error) throw error
      
      // Normalizar períodos y extraer mes
      const recibosNormalizados = (data || []).map(r => {
        const periodoNorm = normalizarPeriodo(r.periodo)
        const [, mes] = periodoNorm.split('-')
        return { ...r, periodoNormalizado: periodoNorm, mes }
      })
      
      setRecibos(recibosNormalizados)
    } catch (error) {
      console.error('Error cargando recibos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Estadísticas
  const totalRecibos = recibos.length
  const firmados = recibos.filter(r => r.estado_firma === 'firmado').length
  const pendientes = recibos.filter(r => r.estado_firma === 'pendiente').length
  const porcentajeFirmado = totalRecibos > 0 ? ((firmados / totalRecibos) * 100).toFixed(1) : '0'

  // Obtener meses únicos para el filtro
  const mesesUnicos = Array.from(new Set(recibos.map(r => r.mes))).sort().reverse()
  
  // Obtener quincenas únicas
  const quincenasUnicas = Array.from(new Set(recibos.map(r => r.quincena))).sort()

  // Nombres de meses para mostrar
  const nombresMeses: Record<string, string> = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  }

  // Filtrar recibos
  const recibosFiltrados = recibos.filter(recibo => {
    // Filtro por mes
    if (filtroMes !== 'todos' && recibo.mes !== filtroMes) {
      return false
    }
    
    // Filtro por quincena
    if (filtroQuincena !== 'todas' && recibo.quincena !== filtroQuincena) {
      return false
    }
    
    // Filtro por estado
    if (filtroEstado !== 'todos' && recibo.estado_firma !== filtroEstado) {
      return false
    }
    
    // Búsqueda por nombre o CUIL
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase()
      const nombreMatch = recibo.empleados.nombre_completo.toLowerCase().includes(busquedaLower)
      const cuilMatch = recibo.empleados.cuil.includes(busqueda)
      if (!nombreMatch && !cuilMatch) {
        return false
      }
    }
    
    return true
  })

  const verFirma = (recibo: Recibo) => {
    setReciboSeleccionado(recibo)
    setMostrarModal(true)
  }

  const descargarPDF = async (reciboId: string) => {
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
    }
  }

  const anularFirma = async (recibo: Recibo) => {
    const motivo = prompt(
      `¿Por qué querés anular la firma de ${recibo.empleados.nombre_completo}?\n\n` +
      `Recibo: ${recibo.periodo} - ${recibo.quincena}\n\n` +
      `Este campo es obligatorio para auditoría.`
    )
    
    if (!motivo) return
    if (motivo.length < 10) {
      alert('El motivo debe tener al menos 10 caracteres')
      return
    }

    if (!confirm('¿Estás seguro de anular esta firma? El empleado deberá volver a firmarla.')) {
      return
    }

    try {
      const response = await fetch('/api/recibos/anular-firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reciboId: recibo.id,
          motivo,
          anuladoPor: 'admin'
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Firma anulada correctamente')
        cargarRecibos()
      } else {
        alert('❌ Error: ' + data.error)
      }
    } catch (error: any) {
      alert('Error de conexión: ' + error.message)
    }
  }

  // 🆕 Función para eliminar recibo
  const eliminarRecibo = async () => {
    if (!eliminandoRecibo) return
    
    if (!motivoEliminacion.trim()) {
      setErrorEliminacion('El motivo es obligatorio')
      return
    }

    if (motivoEliminacion.trim().length < 10) {
      setErrorEliminacion('El motivo debe tener al menos 10 caracteres')
      return
    }

    try {
      setEliminando(true)
      setErrorEliminacion('')

      const response = await fetch(`/api/admin/recibos/${eliminandoRecibo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoEliminacion.trim() })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Recibo eliminado correctamente')
        setEliminandoRecibo(null)
        setMotivoEliminacion('')
        setErrorEliminacion('')
        cargarRecibos()
      } else {
        setErrorEliminacion(data.error || 'Error eliminando recibo')
      }
    } catch (error: any) {
      setErrorEliminacion('Error de conexión: ' + error.message)
    } finally {
      setEliminando(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Cargando recibos...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestión de Recibos</h1>
          <p className="text-gray-600">Panel de administración - Movilsat RRHH</p>
        </div>
        <button
          onClick={cerrarSesion}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-1">Total Recibos</p>
          <p className="text-3xl font-bold text-gray-800">{totalRecibos}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-1">Firmados</p>
          <p className="text-3xl font-bold text-green-600">{firmados}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600 mb-1">Pendientes</p>
          <p className="text-3xl font-bold text-yellow-600">{pendientes}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 mb-1">% Cumplimiento</p>
          <p className="text-3xl font-bold text-purple-600">{porcentajeFirmado}%</p>
        </div>
      </div>

      {/* Filtros MEJORADOS */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mes
            </label>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los meses</option>
              {mesesUnicos.map(mes => (
                <option key={mes} value={mes}>{nombresMeses[mes] || mes}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quincena
            </label>
            <select
              value={filtroQuincena}
              onChange={(e) => setFiltroQuincena(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todas">Todas las quincenas</option>
              {quincenasUnicas.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="firmado">Firmados</option>
              <option value="pendiente">Pendientes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o CUIL..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Lista de Recibos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Recibos ({recibosFiltrados.length})
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {recibosFiltrados.map((recibo) => (
            <div key={recibo.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {recibo.empleados.nombre_completo}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      recibo.estado_firma === 'firmado' 
                        ? recibo.fue_firmado_anteriormente
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {recibo.estado_firma === 'firmado' 
                        ? recibo.fue_firmado_anteriormente
                          ? '⚠️ Firmado (anulado previamente)'
                          : '✅ Firmado'
                        : '⏳ Pendiente'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">CUIL:</span>
                      <p className="font-medium">{recibo.empleados.cuil}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Legajo:</span>
                      <p className="font-medium">{recibo.empleados.legajo || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Período:</span>
                      <p className="font-medium">{recibo.periodo} - {recibo.quincena}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Neto:</span>
                      <p className="font-bold text-green-700">
                        ${recibo.neto_a_cobrar.toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>

                  {recibo.estado_firma === 'firmado' && recibo.fecha_firma && (
                    <div className="mt-3 text-xs text-gray-500">
                      <span>Firmado: {new Date(recibo.fecha_firma).toLocaleString('es-AR')}</span>
                      {recibo.ip_firmante && <span className="ml-4">IP: {recibo.ip_firmante}</span>}
                    </div>
                  )}

                  {recibo.estado_firma === 'pendiente' && (
                    <div className="mt-3 text-xs text-gray-500">
                      Cargado: {new Date(recibo.created_at).toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {recibo.estado_firma === 'firmado' && (
                  <>
                    <button
                      onClick={() => descargarPDF(recibo.id)}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      📄 Descargar PDF
                    </button>
                    
                    {recibo.firma_imagen_url && (
                      <button
                        onClick={() => verFirma(recibo)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        👁 Ver Firma
                      </button>
                    )}
                    
                    <button
                      onClick={() => anularFirma(recibo)}
                      className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                    >
                      ↩️ Anular Firma
                    </button>
                  </>
                )}

                {recibo.estado_firma === 'pendiente' && (
                  <button
                    onClick={() => alert('🔔 Funcionalidad de recordatorio próximamente')}
                    className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium"
                  >
                     Enviar Recordatorio
                  </button>
                )}

                {/* 🆕 Botón de eliminar recibo - disponible para TODOS los estados */}
                <button
                  onClick={() => setEliminandoRecibo(recibo)}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  🗑️ Eliminar Recibo
                </button>
              </div>
            </div>
          ))}

          {recibosFiltrados.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No se encontraron recibos con los filtros aplicados
            </div>
          )}
        </div>
      </div>

      {/* Modal de Firma */}
      {mostrarModal && reciboSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center sticky top-0">
              <h2 className="text-xl font-bold">Firma Digital</h2>
              <button
                onClick={() => {
                  setMostrarModal(false)
                  setReciboSeleccionado(null)
                }}
                className="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-700"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Empleado:</p>
                <p className="font-semibold text-lg">{reciboSeleccionado.empleados.nombre_completo}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Recibo:</p>
                <p className="font-medium">{reciboSeleccionado.periodo} - {reciboSeleccionado.quincena}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Fecha de firma:</p>
                <p className="font-medium">
                  {reciboSeleccionado.fecha_firma && new Date(reciboSeleccionado.fecha_firma).toLocaleString('es-AR')}
                </p>
              </div>

              {reciboSeleccionado.firma_imagen_url && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Firma:</p>
                  <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                    <img 
                      src={reciboSeleccionado.firma_imagen_url} 
                      alt="Firma digital" 
                      className="max-h-48 mx-auto"
                    />
                  </div>
                </div>
              )}

              {reciboSeleccionado.firma_hash && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Hash SHA-256:</p>
                  <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                    {reciboSeleccionado.firma_hash}
                  </p>
                </div>
              )}

              {reciboSeleccionado.ip_firmante && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">IP del firmante:</p>
                  <p className="font-medium">{reciboSeleccionado.ip_firmante}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setMostrarModal(false)
                  setReciboSeleccionado(null)
                }}
                className="w-full bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors mt-4"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Modal de Eliminación */}
      {eliminandoRecibo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-bold">🗑️ Eliminar Recibo</h2>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Atención:</strong> Esta acción eliminará permanentemente el recibo. 
                  El empleado deberá recibir un nuevo recibo si es necesario.
                </p>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Empleado:</p>
                <p className="font-semibold">{eliminandoRecibo.empleados.nombre_completo}</p>
                <p className="text-sm text-gray-600 mt-2 mb-1">Recibo:</p>
                <p className="font-medium">{eliminandoRecibo.periodo} - {eliminandoRecibo.quincena}</p>
                <p className="text-sm text-gray-600 mt-2 mb-1">Neto a cobrar:</p>
                <p className="font-bold text-green-700">
                  ${eliminandoRecibo.neto_a_cobrar.toLocaleString('es-AR')}
                </p>
                <p className="text-sm text-gray-600 mt-2 mb-1">Estado actual:</p>
                <p className="font-medium">
                  {eliminandoRecibo.estado_firma === 'firmado' ? '✅ Firmado' : '⏳ Pendiente'}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de eliminación <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoEliminacion}
                  onChange={(e) => {
                    setMotivoEliminacion(e.target.value)
                    setErrorEliminacion('')
                  }}
                  placeholder="Ej: Error en horas extras - se reliquidará y cargará nuevamente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={4}
                  disabled={eliminando}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo 10 caracteres. Este motivo quedará registrado para auditoría.
                </p>
              </div>

              {errorEliminacion && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{errorEliminacion}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEliminandoRecibo(null)
                    setMotivoEliminacion('')
                    setErrorEliminacion('')
                  }}
                  disabled={eliminando}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={eliminarRecibo}
                  disabled={eliminando}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {eliminando ? 'Eliminando...' : '🗑️ Eliminar Recibo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}