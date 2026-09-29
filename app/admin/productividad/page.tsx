'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Empleado {
  id: string
  nombre_completo: string
  legajo: string | null
  zona_id: string | null
}

export default function AdminProductividadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [productividad, setProductividad] = useState<any[]>([])
  const [mesSeleccionado, setMesSeleccionado] = useState('07')
  const [anioSeleccionado, setAnioSeleccionado] = useState(2026)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [mensaje, setMensaje] = useState('')
  const [erroresDetallados, setErroresDetallados] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [mesSeleccionado, anioSeleccionado])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('id, nombre_completo, legajo, zona_id')
        .eq('activo', true)

      const { data: prodData } = await supabase
        .from('productividad')
        .select('*, empleados(nombre_completo), zonas(nombre)')
        .eq('mes', mesSeleccionado)
        .eq('anio', anioSeleccionado)

      setEmpleados(empleadosData || [])
      setProductividad(prodData || [])
    } catch (error) {
      console.error('Error cargando:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    setMensaje('')
    setErroresDetallados([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
        setPreviewData(jsonData)
        setMensaje(`✅ Archivo cargado: ${jsonData.length} filas. Listo para importar.`)
      } catch (error) {
        setMensaje('❌ Error al leer el archivo.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Función para normalizar nombres y hacer matching flexible
  const normalizarNombre = (nombre: string) => {
    return nombre
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^A-Z0-9\s]/g, '') // Quitar caracteres especiales
      .trim()
  }

  const buscarEmpleado = (nombreInput: string, legajoInput: string) => {
    // Primero buscar por legajo (más preciso)
    if (legajoInput) {
      const porLegajo = empleados.find(e => e.legajo === legajoInput)
      if (porLegajo) return porLegajo
    }

    // Si no hay legajo o no coincide, buscar por nombre
    if (nombreInput) {
      const nombreNormalizado = normalizarNombre(nombreInput)
      
      // Buscar coincidencia exacta
      const exacto = empleados.find(e => normalizarNombre(e.nombre_completo) === nombreNormalizado)
      if (exacto) return exacto

      // Buscar coincidencia parcial (si el nombre está en cualquier orden)
      const palabras = nombreNormalizado.split(/\s+/).filter(p => p.length > 2)
      const parcial = empleados.find(e => {
        const nombreEmpleado = normalizarNombre(e.nombre_completo)
        return palabras.every(palabra => nombreEmpleado.includes(palabra))
      })
      if (parcial) return parcial
    }

    return null
  }

  const importarDatos = async () => {
    if (previewData.length === 0) return
    if (!confirm(`¿Importar ${previewData.length} registros?`)) return

    try {
      setImportando(true)
      setMensaje('')
      const errores: string[] = []
      const exitos: string[] = []
      const periodo = `${anioSeleccionado}-${mesSeleccionado}`

      for (const row of previewData) {
        const nombreInput = String(row['Apellido y Nombre'] || row['nombre'] || row['Nombre'] || '').trim()
        const legajoInput = String(row['Legajo'] || row['legajo'] || '').trim()
        const ingreso = Number(row['Ingreso Generado'] || row['ingreso'] || 0)
        const instalaciones = Number(row['Instalaciones'] || row['instalaciones'] || 0)
        const asistencias = Number(row['Asistencias'] || row['asistencias'] || 0)

        // Buscar empleado con matcher flexible
        const empleado = buscarEmpleado(nombreInput, legajoInput)

        if (!empleado) {
          errores.push(` "${nombreInput || legajoInput}": No se encontró en la base de datos`)
          continue
        }

        // BUSCAR COSTO EN RECIBOS_SUELDO
        const { data: recibos, error: errorRecibos } = await supabase
          .from('recibos_sueldo')
          .select('costo_total_empleador, periodo, quincena')
          .eq('empleado_id', empleado.id)
          .eq('periodo', periodo)

        if (errorRecibos) {
          errores.push(`❌ ${empleado.nombre_completo}: Error buscando recibos - ${errorRecibos.message}`)
          continue
        }

        if (!recibos || recibos.length === 0) {
          errores.push(`❌ ${empleado.nombre_completo}: No tiene recibos cargados para ${periodo}`)
          continue
        }

        // Verificar si los recibos tienen costo_total_empleador
        const costosValidos = recibos.filter(r => r.costo_total_empleador && Number(r.costo_total_empleador) > 0)
        
        if (costosValidos.length === 0) {
          errores.push(`❌ ${empleado.nombre_completo}: Los recibos existen pero no tienen costo calculado`)
          continue
        }

        // Sumar todas las quincenas del mes
        const costoTotal = costosValidos.reduce((sum, r) => sum + (Number(r.costo_total_empleador) || 0), 0)
        
        if (costoTotal === 0) {
          errores.push(` ${empleado.nombre_completo}: El costo total calculado es $0`)
          continue
        }

        const roi = ((ingreso - costoTotal) / costoTotal) * 100

        // Insertar/Actualizar
        const { error: errorUpsert } = await supabase
          .from('productividad')
          .upsert({
            empleado_id: empleado.id,
            zona_id: empleado.zona_id,
            mes: mesSeleccionado,
            anio: anioSeleccionado,
            instalaciones,
            asistencias,
            total_trabajos: instalaciones + asistencias,
            costo_total_empleador: costoTotal,
            ingreso_generado: ingreso,
            roi_porcentaje: roi
          }, { 
            onConflict: 'empleado_id,mes,anio' 
          })

        if (errorUpsert) {
          errores.push(`❌ ${empleado.nombre_completo}: Error al guardar - ${errorUpsert.message}`)
        } else {
          exitos.push(`✅ ${empleado.nombre_completo}: Importado (Costo: $${costoTotal.toLocaleString()}, ROI: ${roi.toFixed(1)}%)`)
        }
      }

      setErroresDetallados(errores)
      
      if (errores.length > 0 && exitos.length > 0) {
        setMensaje(`⚠️ ${exitos.length} importados, ${errores.length} errores`)
      } else if (errores.length > 0) {
        setMensaje(`❌ ${errores.length} errores`)
      } else {
        setMensaje(`✅ ${exitos.length} registros importados correctamente`)
      }

      setArchivo(null)
      setPreviewData([])
      await cargarDatos()
    } catch (error: any) {
      setMensaje(`❌ Error general: ${error.message}`)
    } finally {
      setImportando(false)
    }
  }

  // Generar plantilla vacía (sin empleados)
  const descargarPlantillaVacia = () => {
    const plantilla = [{
      'Apellido y Nombre': 'BORDON, DAVID JOSUA',
      'Legajo': '264',
      'Mes': '07',
      'Año': 2026,
      'Instalaciones': 45,
      'Asistencias': 12,
      'Ingreso Generado': 1200000
    }]
    const ws = XLSX.utils.json_to_sheet(plantilla)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productividad')
    XLSX.writeFile(wb, 'plantilla_productividad_vacia.xlsx')
  }

  // Generar plantilla pre-cargada con todos los empleados
  const descargarPlantillaPreCargada = () => {
    const plantilla = empleados.map(emp => ({
      'Apellido y Nombre': emp.nombre_completo,
      'Legajo': emp.legajo || '',
      'Mes': mesSeleccionado,
      'Año': anioSeleccionado,
      'Instalaciones': 0,
      'Asistencias': 0,
      'Ingreso Generado': 0
    }))

    const ws = XLSX.utils.json_to_sheet(plantilla)
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 35 }, // Apellido y Nombre
      { wch: 10 }, // Legajo
      { wch: 8 },  // Mes
      { wch: 8 },  // Año
      { wch: 15 }, // Instalaciones
      { wch: 15 }, // Asistencias
      { wch: 20 }  // Ingreso Generado
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productividad')
    XLSX.writeFile(wb, `productividad_${mesSeleccionado}_${anioSeleccionado}.xlsx`)
  }

  if (loading) return <div className="p-8 text-center">Cargando...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Productividad & ROI</h1>
          <p className="text-slate-600">Importación inteligente con costos automáticos</p>
        </div>
        <button onClick={() => router.push('/admin/roi-dashboard')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
           Ver Dashboard Visual →
        </button>
      </div>

      {mensaje && (
        <div className={`mb-4 p-4 rounded-lg ${
          mensaje.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 
          mensaje.startsWith('⚠️') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 
          'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <p className="font-semibold">{mensaje}</p>
        </div>
      )}

      {/* ERRORES DETALLADOS */}
      {erroresDetallados.length > 0 && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-lg p-4">
          <h3 className="font-bold text-rose-900 mb-2">📋 Detalles de errores ({erroresDetallados.length})</h3>
          <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
            {erroresDetallados.map((err, i) => (
              <div key={i} className="text-rose-800 py-1 border-b border-rose-200 last:border-0">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">📥 1. Configurar Período y Descargar Plantilla</h2>
        
        {/* Filtros de período */}
        <div className="flex gap-4 items-end mb-6 flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">Mes</label>
            <input type="text" value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)} className="px-3 py-2 border rounded-lg w-24" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Año</label>
            <input type="number" value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(Number(e.target.value))} className="px-3 py-2 border rounded-lg w-32" />
          </div>
        </div>

        {/* Botones de descarga de plantilla */}
        <div className="border-t pt-4 mb-6">
          <h3 className="font-semibold mb-3">📋 Opciones de plantilla:</h3>
          <div className="flex gap-3 flex-wrap">
            <button 
              onClick={descargarPlantillaPreCargada} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
               Descargar plantilla con {empleados.length} empleados
            </button>
            <button 
              onClick={descargarPlantillaVacia} 
              className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300"
            >
              📄 Plantilla vacía (ejemplo)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 La plantilla pre-cargada ya tiene todos los empleados. Solo completá las columnas de Instalaciones, Asistencias e Ingreso Generado.
          </p>
        </div>

        {/* Upload de archivo */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3"> 2. Subir archivo completado:</h3>
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            onChange={handleFileChange} 
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:bg-slate-100" 
          />
        </div>

        {/* Vista previa y botón de importar */}
        {previewData.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <p className="font-semibold mb-2">Vista previa: {previewData.length} filas</p>
            <button 
              onClick={importarDatos} 
              disabled={importando} 
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400"
            >
              {importando ? '⏳ Procesando...' : '🚀 Importar y Calcular ROI'}
            </button>
          </div>
        )}
      </div>

      {/* Tabla de resultados */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-bold">Registros de {mesSeleccionado}/{anioSeleccionado} ({productividad.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Empleado</th>
                <th className="px-4 py-3 text-left">Zona</th>
                <th className="px-4 py-3 text-center">Trabajos</th>
                <th className="px-4 py-3 text-right">Costo (Auto)</th>
                <th className="px-4 py-3 text-right">Ingreso</th>
                <th className="px-4 py-3 text-center">ROI %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productividad.map((reg: any) => (
                <tr key={reg.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{reg.empleados?.nombre_completo || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{reg.zonas?.nombre || '-'}</td>
                  <td className="px-4 py-3 text-center">{reg.total_trabajos}</td>
                  <td className="px-4 py-3 text-right font-mono">${reg.costo_total_empleador?.toLocaleString('es-AR', {maximumFractionDigits: 0})}</td>
                  <td className="px-4 py-3 text-right font-mono">${reg.ingreso_generado?.toLocaleString('es-AR', {maximumFractionDigits: 0})}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${reg.roi_porcentaje > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {reg.roi_porcentaje?.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {productividad.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Sin registros para este período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}