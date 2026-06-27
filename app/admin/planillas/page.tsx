'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function PlanillasPage() {
  const [periodo, setPeriodo] = useState('')
  const [empleados, setEmpleados] = useState<any[]>([])
  const [recibos, setRecibos] = useState<any[]>([])
  const [incentivos, setIncentivos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    cargarEmpleados()
    // Setear período actual
    const ahora = new Date()
    setPeriodo(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .order('nombre_completo')
    if (data) setEmpleados(data)
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Cargar recibos del período
      const { data: recibosData } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('periodo', periodo)
        .eq('estado', 'firmado')

      // Cargar incentivos del período
      const { data: incentivosData } = await supabase
        .from('incentivos')
        .select('*')
        .eq('periodo', periodo)

      setRecibos(recibosData || [])
      setIncentivos(incentivosData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const generarPlanilla = () => {
    if (recibos.length === 0 && incentivos.length === 0) {
      alert('No hay datos para el período seleccionado')
      return
    }

    // Sheet 1: Sueldos
    const sueldosData = recibos.map(recibo => {
      const empleado = empleados.find(e => e.id === recibo.empleado_id)
      return {
        'CUIL': empleado?.cuil || '',
        'Nombre': empleado?.nombre_completo || '',
        'CBU': empleado?.cbu || '',
        'Alias': empleado?.alias || '',
        'Neto a Cobrar': recibo.neto_a_cobrar || 0,
        'Período': recibo.periodo,
        'Quincena': recibo.quincena
      }
    })

    // Sheet 2: Incentivos
    const incentivosData = incentivos.map(inv => {
      const empleado = empleados.find(e => e.id === inv.empleado_id)
      return {
        'CUIL': empleado?.cuil || '',
        'Nombre': empleado?.nombre_completo || '',
        'CBU': empleado?.cbu || '',
        'Alias': empleado?.alias || '',
        'Incentivo Neto': inv.monto_neto || 0,
        'Período': inv.periodo
      }
    })

    // Sheet 3: Resumen
    const resumenMap = new Map<string, any>()
    
    recibos.forEach(recibo => {
      const empleado = empleados.find(e => e.id === recibo.empleado_id)
      const key = empleado?.cuil || ''
      if (!resumenMap.has(key)) {
        resumenMap.set(key, {
          'CUIL': key,
          'Nombre': empleado?.nombre_completo || '',
          'CBU': empleado?.cbu || '',
          'Alias': empleado?.alias || '',
          'Total Sueldos': 0,
          'Total Incentivos': 0,
          'Total a Transferir': 0
        })
      }
      const item = resumenMap.get(key)!
      item['Total Sueldos'] += recibo.neto_a_cobrar || 0
    })

    incentivos.forEach(inv => {
      const empleado = empleados.find(e => e.id === inv.empleado_id)
      const key = empleado?.cuil || ''
      if (resumenMap.has(key)) {
        const item = resumenMap.get(key)!
        item['Total Incentivos'] += inv.monto_neto || 0
      }
    })

    resumenMap.forEach(item => {
      item['Total a Transferir'] = item['Total Sueldos'] + item['Total Incentivos']
    })

    const resumenData = Array.from(resumenMap.values())

    // Crear workbook
    const wb = XLSX.utils.book_new()
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sueldosData), 'Sueldos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incentivosData), 'Incentivos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen')

    // Descargar
    XLSX.writeFile(wb, `Planilla_${periodo}_${new Date().toISOString().split('T')[0]}.xlsx`)
    
    alert(`✅ Planilla generada con ${sueldosData.length} sueldos y ${incentivosData.length} incentivos`)
  }

  const totalSueldos = recibos.reduce((sum, r) => sum + (r.neto_a_cobrar || 0), 0)
  const totalIncentivos = incentivos.reduce((sum, i) => sum + (i.monto_neto || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Generación de Planillas</h1>
        <p className="text-gray-600">Exportá planillas para transferencias bancarias</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Seleccionar Período</h2>
        
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Período:</label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Cargando...' : 'Cargar Datos'}
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-700">Sueldos</p>
            <p className="text-2xl font-bold text-blue-900">{recibos.length}</p>
            <p className="text-sm text-blue-600">${totalSueldos.toLocaleString('es-AR')}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-green-700">Incentivos</p>
            <p className="text-2xl font-bold text-green-900">{incentivos.length}</p>
            <p className="text-sm text-green-600">${totalIncentivos.toLocaleString('es-AR')}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-4">
            <p className="text-sm text-purple-700">Total a Transferir</p>
            <p className="text-2xl font-bold text-purple-900">${(totalSueldos + totalIncentivos).toLocaleString('es-AR')}</p>
          </div>
        </div>

        <button
          onClick={generarPlanilla}
          disabled={recibos.length === 0 && incentivos.length === 0}
          className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
           Generar Planilla Excel
        </button>
      </div>

      {/* Advertencia si faltan CBU */}
      {empleados.some(e => !e.cbu) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            <strong>️ Atención:</strong> Algunos empleados no tienen CBU cargado. 
            La planilla se generará pero las transferencias podrían fallar.
          </p>
        </div>
      )}
    </div>
  )
}