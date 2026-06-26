'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function IncentivosPage() {
  const [periodo, setPeriodo] = useState('')
  const [empleados, setEmpleados] = useState<any[]>([])
  const [incentivos, setIncentivos] = useState<any[]>([])
  const [descuentos, setDescuentos] = useState<any[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [mostrarPreview, setMostrarPreview] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [tabActiva, setTabActiva] = useState<'incentivos' | 'descuentos' | 'historial'>('incentivos')
  const [historial, setHistorial] = useState<any[]>([])
  const [filtroPeriodo, setFiltroPeriodo] = useState('')

  useEffect(() => {
    cargarEmpleados()
    cargarHistorial()
    // Setear período actual (YYYY-MM)
    const ahora = new Date()
    setPeriodo(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil')
      .order('nombre_completo')
    if (data) setEmpleados(data)
  }

  const cargarHistorial = async () => {
  try {
    // 1. Obtener todos los incentivos
    const { data: incentivosData, error: errorIncentivos } = await supabase
      .from('incentivos')
      .select('*')
      .order('periodo', { ascending: false })

    if (errorIncentivos) {
      console.error('Error cargando incentivos:', errorIncentivos)
      return
    }

    if (!incentivosData || incentivosData.length === 0) {
      setHistorial([])
      return
    }

    // 2. Obtener todos los empleados
    const { data: empleadosData } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil')

    // 3. Obtener todos los descuentos
    const { data: descuentosData } = await supabase
      .from('descuentos_incentivos')
      .select('*')

    // 4. Combinar todo
    const historialProcesado = incentivosData.map(incentivo => {
      // Buscar nombre del empleado
      const empleado = empleadosData?.find(e => e.id === incentivo.empleado_id)
      
      // Calcular total de descuentos para este empleado en este período
      const descuentosDelEmpleado = descuentosData?.filter(d => 
        d.empleado_id === incentivo.empleado_id && 
        d.periodo === incentivo.periodo
      ) || []
      
      const totalDescuentos = descuentosDelEmpleado.reduce(
        (sum, d) => sum + (d.monto_total || 0), 
        0
      )

      return {
        ...incentivo,
        empleados: { nombre_completo: empleado?.nombre_completo || 'Desconocido' },
        total_descuentos: totalDescuentos
      }
    })

    setHistorial(historialProcesado)
  } catch (error) {
    console.error('Error en cargarHistorial:', error)
  }
}

  // ============================================
  // CARGA DE INCENTIVOS DESDE EXCEL
  // ============================================
  const handleIncentivosExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCargando(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet) as any[]

      // Validar formato
      const processed = data.map((row, idx) => {
        // Buscar CUIL (puede venir con o sin guiones)
        const cuilRaw = row['CUIL'] || row['cuil'] || row['Cuil']
        if (!cuilRaw) throw new Error(`Fila ${idx + 1}: Falta CUIL`)

        // Normalizar CUIL (quitar guiones)
        const cuil = String(cuilRaw).replace(/[-\s]/g, '')

        const nombreRaw = row['Nombre'] || row['nombre'] || row['Nombre Completo'] || ''
        const montoRaw = row['Incentivo'] || row['incentivo'] || row['Monto'] || row['monto'] || row['Incentivo Bruto']

        if (!montoRaw) throw new Error(`Fila ${idx + 1}: Falta monto de incentivo`)

        const monto = parseFloat(String(montoRaw).replace(/[^\d.-]/g, ''))
        if (isNaN(monto) || monto <= 0) {
          throw new Error(`Fila ${idx + 1}: Monto inválido`)
        }

        // Buscar empleado por CUIL
        const empleado = empleados.find(e => e.cuil.replace(/[-\s]/g, '') === cuil)

        return {
          cuil,
          cuilNormalizado: cuil,
          nombreExcel: nombreRaw,
          montoBruto: monto,
          empleadoId: empleado?.id || null,
          empleadoNombre: empleado?.nombre_completo || '⚠️ NO ENCONTRADO',
          encontrado: !!empleado
        }
      })

      setPreviewData(processed)
      setMostrarPreview(true)
    } catch (error: any) {
      alert('Error procesando Excel: ' + error.message)
    } finally {
      setCargando(false)
      e.target.value = ''
    }
  }

  const guardarIncentivos = async () => {
    if (!previewData.length) return

    const validos = previewData.filter(p => p.encontrado)
    if (validos.length === 0) {
      alert('No hay empleados válidos para guardar')
      return
    }

    if (!confirm(`¿Guardar ${validos.length} incentivos para el período ${periodo}?`)) return

    setCargando(true)
    try {
      const inserts = validos.map(p => ({
        empleado_id: p.empleadoId,
        periodo: periodo,
        monto_bruto: p.montoBruto,
        monto_neto: p.montoBruto, // Inicialmente igual, se ajusta al procesar descuentos
      }))

      const { error } = await supabase.from('incentivos').insert(inserts)
      if (error) throw error

      alert(`✅ ${validos.length} incentivos guardados correctamente`)
      setMostrarPreview(false)
      setPreviewData([])
      cargarHistorial()
    } catch (error: any) {
      alert('Error guardando: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  // ============================================
  // CARGA DE DESCUENTOS DESDE EXCEL
  // ============================================
  const handleDescuentosExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCargando(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet) as any[]

      const processed = data.map((row, idx) => {
        const cuilRaw = row['CUIL'] || row['cuil']
        if (!cuilRaw) throw new Error(`Fila ${idx + 1}: Falta CUIL`)

        const cuil = String(cuilRaw).replace(/[-\s]/g, '')
        const concepto = row['Concepto'] || row['concepto'] || ''
        
        const herramientas = parseFloat(String(row['Herramientas'] || row['herramientas'] || 0).replace(/[^\d.-]/g, '')) || 0
        const equipos = parseFloat(String(row['Equipos'] || row['equipos'] || 0).replace(/[^\d.-]/g, '')) || 0
        const multas = parseFloat(String(row['Multas'] || row['multas'] || 0).replace(/[^\d.-]/g, '')) || 0
        const otros = parseFloat(String(row['Otros'] || row['otros'] || 0).replace(/[^\d.-]/g, '')) || 0

        const empleado = empleados.find(e => e.cuil.replace(/[-\s]/g, '') === cuil)

        return {
          cuil,
          nombreExcel: row['Nombre'] || row['nombre'] || '',
          herramientas,
          equipos,
          multas,
          otros,
          concepto,
          empleadoId: empleado?.id || null,
          empleadoNombre: empleado?.nombre_completo || '⚠️ NO ENCONTRADO',
          encontrado: !!empleado
        }
      })

      // Mostrar preview
      setPreviewData(processed)
      setMostrarPreview(true)
    } catch (error: any) {
      alert('Error procesando Excel: ' + error.message)
    } finally {
      setCargando(false)
      e.target.value = ''
    }
  }

  const guardarDescuentos = async () => {
    if (!previewData.length) return

    const validos = previewData.filter(p => p.encontrado)
    if (validos.length === 0) {
      alert('No hay empleados válidos para guardar')
      return
    }

    if (!confirm(`¿Guardar descuentos de ${validos.length} empleados para ${periodo}?`)) return

    setCargando(true)
    try {
      const inserts: any[] = []

      validos.forEach(p => {
        if (p.herramientas > 0) {
          inserts.push({
            empleado_id: p.empleadoId,
            periodo: periodo,
            tipo: 'herramientas',
            concepto: p.concepto || 'Descuento herramientas',
            monto_total: p.herramientas,
            tipo_descuento: 'pago_unico',
            cantidad_cuotas: 1,
            cuotas_restantes: 1,
            monto_cuota: p.herramientas
          })
        }
        if (p.equipos > 0) {
          inserts.push({
            empleado_id: p.empleadoId,
            periodo: periodo,
            tipo: 'equipos',
            concepto: p.concepto || 'Descuento equipos',
            monto_total: p.equipos,
            tipo_descuento: 'pago_unico',
            cantidad_cuotas: 1,
            cuotas_restantes: 1,
            monto_cuota: p.equipos
          })
        }
        if (p.multas > 0) {
          inserts.push({
            empleado_id: p.empleadoId,
            periodo: periodo,
            tipo: 'multas',
            concepto: p.concepto || 'Multa',
            monto_total: p.multas,
            tipo_descuento: 'pago_unico',
            cantidad_cuotas: 1,
            cuotas_restantes: 1,
            monto_cuota: p.multas
          })
        }
        if (p.otros > 0) {
          inserts.push({
            empleado_id: p.empleadoId,
            periodo: periodo,
            tipo: 'otros',
            concepto: p.concepto || 'Otros descuentos',
            monto_total: p.otros,
            tipo_descuento: 'pago_unico',
            cantidad_cuotas: 1,
            cuotas_restantes: 1,
            monto_cuota: p.otros
          })
        }
      })

      if (inserts.length === 0) {
        alert('No hay descuentos para guardar')
        return
      }

      // 1. Guardar descuentos
      const { error } = await supabase.from('descuentos_incentivos').insert(inserts)
      if (error) throw error

      // 2. ACTUALIZAR LOS NETOS DE LOS INCENTIVOS
      // Obtener todos los incentivos del período
      const { data: incentivosData } = await supabase
        .from('incentivos')
        .select('id, empleado_id, monto_bruto')
        .eq('periodo', periodo)

      if (incentivosData) {
        // Por cada incentivo, calcular sus descuentos y actualizar el neto
        for (const incentivo of incentivosData) {
          // Obtener todos los descuentos de este empleado en este período
          const { data: descuentosData } = await supabase
            .from('descuentos_incentivos')
            .select('monto_total')
            .eq('empleado_id', incentivo.empleado_id)
            .eq('periodo', periodo)

          const totalDescuentos = descuentosData?.reduce((sum, d) => sum + d.monto_total, 0) || 0
          
          // Calcular neto (bruto - descuentos)
          const neto = Math.max(0, incentivo.monto_bruto - totalDescuentos)

          // Actualizar el incentivo
          await supabase
            .from('incentivos')
            .update({ monto_neto: neto })
            .eq('id', incentivo.id)
        }
      }

      alert(`✅ ${inserts.length} descuentos guardados correctamente. Netos actualizados.`)
      setMostrarPreview(false)
      setPreviewData([])
      cargarHistorial()
    } catch (error: any) {
      alert('Error guardando: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  const eliminarIncentivo = async (id: string) => {
    if (!confirm('¿Eliminar este incentivo?')) return
    const { error } = await supabase.from('incentivos').delete().eq('id', id)
    if (!error) cargarHistorial()
  }

  const totalBruto = previewData.reduce((sum, p) => sum + (p.montoBruto || 0), 0)
  const totalEncontrados = previewData.filter(p => p.encontrado).length
  const totalNoEncontrados = previewData.filter(p => !p.encontrado).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gestión de Incentivos</h1>
        <p className="text-gray-600">Cargá incentivos y descuentos desde Excel</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => { setTabActiva('incentivos'); setMostrarPreview(false); setPreviewData([]) }}
          className={`px-4 py-2 font-medium transition-colors ${
            tabActiva === 'incentivos'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          💰 Incentivos
        </button>
        <button
          onClick={() => { setTabActiva('descuentos'); setMostrarPreview(false); setPreviewData([]) }}
          className={`px-4 py-2 font-medium transition-colors ${
            tabActiva === 'descuentos'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📉 Descuentos
        </button>
        <button
          onClick={() => { setTabActiva('historial'); setMostrarPreview(false); setPreviewData([]) }}
          className={`px-4 py-2 font-medium transition-colors ${
            tabActiva === 'historial'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 Historial
        </button>
      </div>

      {/* TAB INCENTIVOS */}
      {tabActiva === 'incentivos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Cargar Incentivos desde Excel</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Período:</label>
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <p className="font-medium text-blue-900 mb-2">📋 Formato del Excel:</p>
              <p className="text-sm text-blue-800 mb-2">El archivo debe tener las columnas:</p>
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="border border-blue-300 px-3 py-1">CUIL</th>
                    <th className="border border-blue-300 px-3 py-1">Nombre</th>
                    <th className="border border-blue-300 px-3 py-1">Incentivo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-blue-300 px-3 py-1">20-28729145-1</td>
                    <td className="border border-blue-300 px-3 py-1">DIAZ, DIEGO</td>
                    <td className="border border-blue-300 px-3 py-1">80000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <label className="block">
              <span className="sr-only">Elegir archivo Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleIncentivosExcel}
                disabled={cargando}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </label>
            {cargando && <p className="mt-2 text-blue-600">Procesando archivo...</p>}
          </div>

          {/* Preview */}
          {mostrarPreview && previewData.length > 0 && previewData[0].montoBruto !== undefined && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Vista Previa ({previewData.length} registros)</h2>
                <button
                  onClick={() => { setMostrarPreview(false); setPreviewData([]) }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Cerrar
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-700">Empleados encontrados</p>
                  <p className="text-2xl font-bold text-green-900">{totalEncontrados}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-700">No encontrados</p>
                  <p className="text-2xl font-bold text-red-900">{totalNoEncontrados}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-700">Total Bruto</p>
                  <p className="text-2xl font-bold text-blue-900">${totalBruto.toLocaleString('es-AR')}</p>
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">CUIL</th>
                      <th className="px-3 py-2 text-left">Nombre (Excel)</th>
                      <th className="px-3 py-2 text-left">Nombre (Sistema)</th>
                      <th className="px-3 py-2 text-right">Incentivo</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((p, idx) => (
                      <tr key={idx} className={`border-t ${p.encontrado ? '' : 'bg-red-50'}`}>
                        <td className="px-3 py-2">{p.cuil}</td>
                        <td className="px-3 py-2">{p.nombreExcel}</td>
                        <td className="px-3 py-2">{p.empleadoNombre}</td>
                        <td className="px-3 py-2 text-right">${p.montoBruto.toLocaleString('es-AR')}</td>
                        <td className="px-3 py-2 text-center">
                          {p.encontrado ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={guardarIncentivos}
                  disabled={cargando || totalEncontrados === 0}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {cargando ? 'Guardando...' : `✅ Guardar ${totalEncontrados} incentivos`}
                </button>
                <button
                  onClick={() => { setMostrarPreview(false); setPreviewData([]) }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB DESCUENTOS */}
      {tabActiva === 'descuentos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Cargar Descuentos desde Excel</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Período:</label>
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded p-4 mb-4">
              <p className="font-medium text-orange-900 mb-2">📋 Formato del Excel:</p>
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="bg-orange-100">
                    <th className="border border-orange-300 px-3 py-1">CUIL</th>
                    <th className="border border-orange-300 px-3 py-1">Nombre</th>
                    <th className="border border-orange-300 px-3 py-1">Herramientas</th>
                    <th className="border border-orange-300 px-3 py-1">Equipos</th>
                    <th className="border border-orange-300 px-3 py-1">Multas</th>
                    <th className="border border-orange-300 px-3 py-1">Otros</th>
                    <th className="border border-orange-300 px-3 py-1">Concepto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-orange-300 px-3 py-1">20-28729145-1</td>
                    <td className="border border-orange-300 px-3 py-1">DIAZ, DIEGO</td>
                    <td className="border border-orange-300 px-3 py-1">10000</td>
                    <td className="border border-orange-300 px-3 py-1">5000</td>
                    <td className="border border-orange-300 px-3 py-1">0</td>
                    <td className="border border-orange-300 px-3 py-1">0</td>
                    <td className="border border-orange-300 px-3 py-1">Kit herramientas</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <label className="block">
              <span className="sr-only">Elegir archivo Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleDescuentosExcel}
                disabled={cargando}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
            </label>
            {cargando && <p className="mt-2 text-orange-600">Procesando archivo...</p>}
          </div>

          {/* Preview Descuentos */}
          {mostrarPreview && previewData.length > 0 && previewData[0].herramientas !== undefined && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Vista Previa Descuentos</h2>
                <button
                  onClick={() => { setMostrarPreview(false); setPreviewData([]) }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Cerrar
                </button>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Empleado</th>
                      <th className="px-3 py-2 text-right">Herram.</th>
                      <th className="px-3 py-2 text-right">Equipos</th>
                      <th className="px-3 py-2 text-right">Multas</th>
                      <th className="px-3 py-2 text-right">Otros</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((p, idx) => {
                      const total = p.herramientas + p.equipos + p.multas + p.otros
                      return (
                        <tr key={idx} className={`border-t ${p.encontrado ? '' : 'bg-red-50'}`}>
                          <td className="px-3 py-2">{p.empleadoNombre}</td>
                          <td className="px-3 py-2 text-right">${p.herramientas.toLocaleString('es-AR')}</td>
                          <td className="px-3 py-2 text-right">${p.equipos.toLocaleString('es-AR')}</td>
                          <td className="px-3 py-2 text-right">${p.multas.toLocaleString('es-AR')}</td>
                          <td className="px-3 py-2 text-right">${p.otros.toLocaleString('es-AR')}</td>
                          <td className="px-3 py-2 text-right font-bold">${total.toLocaleString('es-AR')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={guardarDescuentos}
                  disabled={cargando}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {cargando ? 'Guardando...' : '✅ Guardar Descuentos'}
                </button>
                <button
                  onClick={() => { setMostrarPreview(false); setPreviewData([]) }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB HISTORIAL */}
      {tabActiva === 'historial' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Historial de Incentivos</h2>
          
          {historial.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay incentivos cargados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Período</th>
                    <th className="px-3 py-2 text-left">Empleado</th>
                    <th className="px-3 py-2 text-right">Bruto</th>
                    <th className="px-3 py-2 text-right text-red-600">Descuentos</th>
                    <th className="px-3 py-2 text-right">Neto</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-2">{h.periodo}</td>
                      <td className="px-3 py-2">{h.empleados?.nombre_completo}</td>
                      <td className="px-3 py-2 text-right">${h.monto_bruto.toLocaleString('es-AR')}</td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {h.total_descuentos > 0 ? `-$${h.total_descuentos.toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">
                        ${h.monto_neto.toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => eliminarIncentivo(h.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}