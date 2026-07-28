'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'

export default function PlanillasPage() {
  const [periodo, setPeriodo] = useState('')
  const [quincena, setQuincena] = useState('todas')
  const [empleados, setEmpleados] = useState<any[]>([])
  const [recibos, setRecibos] = useState<any[]>([])
  const [incentivos, setIncentivos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [vistaPrevia, setVistaPrevia] = useState(false)

  useEffect(() => {
    cargarEmpleados()
    const ahora = new Date()
    setPeriodo(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  useEffect(() => {
    if (periodo) {
      cargarDatos()
    }
  }, [periodo, quincena])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil, cbu, alias_cbu, banco')
      .eq('estado', 'activo')
      .order('nombre_completo')
    if (data) setEmpleados(data)
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Cargar recibos
      let queryRecibos = supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('periodo', periodo)
        .neq('estado', 'anulado')

      if (quincena !== 'todas') {
        queryRecibos = queryRecibos.eq('quincena', quincena)
      }

      const { data: recibosData, error: errorRecibos } = await queryRecibos

      // Cargar incentivos
      const { data: incentivosData, error: errorIncentivos } = await supabase
        .from('incentivos')
        .select('*')
        .eq('periodo', periodo)

      console.log('Recibos cargados:', recibosData?.length || 0)
      console.log('Incentivos cargados:', incentivosData?.length || 0)
      
      if (errorRecibos) console.error('Error en recibos:', errorRecibos)
      if (errorIncentivos) console.error('Error en incentivos:', errorIncentivos)

      // Cargar TODOS los empleados activos
      const { data: todosEmpleados } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cuil, cbu, alias_cbu, banco')
        .eq('estado', 'activo')

      console.log('=== DEBUG CARGA DE DATOS ===')
      console.log('Total empleados cargados:', todosEmpleados?.length)
      console.log('Primer empleado:', todosEmpleados?.[0])
      console.log('Primer recibo antes del mapeo:', recibosData?.[0])
      console.log('CUIL del primer recibo:', recibosData?.[0]?.cuil)

      // Crear mapa por CUIL
      const empleadosPorCuil = new Map()
      todosEmpleados?.forEach(emp => {
        if (emp.cuil) {
          empleadosPorCuil.set(emp.cuil, emp)
        }
      })

      console.log('Tamaño del mapa empleadosPorCuil:', empleadosPorCuil.size)
      console.log('¿Existe el CUIL del primer recibo en el mapa?', empleadosPorCuil.has(recibosData?.[0]?.cuil))
      
      // Listar algunos CUILs del mapa para comparar
      console.log('Primeros 5 CUILs en el mapa:', Array.from(empleadosPorCuil.keys()).slice(0, 5))

      // Agregar empleado a cada recibo buscando por CUIL
      const recibosConEmpleados = recibosData?.map((recibo, index) => {
        const empleado = empleadosPorCuil.get(recibo.cuil)
        if (index === 0) {
          console.log('=== PRIMER RECIBO PROCESADO ===')
          console.log('CUIL buscado:', recibo.cuil)
          console.log('Empleado encontrado:', empleado)
          console.log('Nombre del empleado:', empleado?.nombre_completo)
        }
        return {
          ...recibo,
          empleado: empleado || null
        }
      }) || []

      // Agregar empleado a cada incentivo buscando por CUIL
      const incentivosConEmpleados = incentivosData?.map(inv => {
        const empleado = empleadosPorCuil.get(inv.cuil)
        return {
          ...inv,
          empleado: empleado || null
        }
      }) || []

      console.log('=== FIN DEBUG ===')

      setRecibos(recibosConEmpleados)
      setIncentivos(incentivosConEmpleados)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEmpleado = (empleadoId: string, cuil?: string) => {
    if (cuil) {
      const emp = empleados.find(e => e.cuil === cuil)
      if (emp) return emp
    }
    if (empleadoId) {
      return empleados.find(e => e.id === empleadoId)
    }
    return null
  }

  // Generar planilla completa (Excel con 3 hojas)
  const generarPlanillaCompleta = () => {
    if (recibos.length === 0 && incentivos.length === 0) {
      alert('No hay datos para el período seleccionado')
      return
    }

    // Sheet 1: Sueldos
    const sueldosData = recibos.map(recibo => {
      const emp = recibo.empleado || {}
      return {
        'CUIL': recibo.cuil || emp.cuil || '',
        'Legajo': recibo.legajo || '',
        'Nombre': emp.nombre_completo || recibo.nombre_completo || '',
        'Sección': recibo.seccion || '',
        'Categoría': recibo.categoria || '',
        'Banco': recibo.banco || emp.banco || '',
        'CBU': emp.cbu || recibo.cbu || '',
        'Alias': emp.alias_cbu || recibo.alias_cbu || '',
        'Bruto': recibo.monto_bruto || 0,
        'Descuentos': recibo.total_descuentos || 0,
        'Neto a Cobrar': recibo.neto_a_cobrar || 0,
        'Período': recibo.periodo,
        'Quincena': recibo.quincena,
        'Estado': recibo.estado
      }
    })

    // Sheet 2: Incentivos
    const incentivosData = incentivos.map(inv => {
      const emp = inv.empleado || {}
      return {
        'CUIL': inv.cuil || emp.cuil || '',
        'Nombre': emp.nombre_completo || 'SIN NOMBRE',
        'CBU': emp.cbu || '',
        'Alias': emp.alias_cbu || '',
        'Monto Neto': inv.monto_neto || 0,
        'Período': inv.periodo
      }
    })

    // Sheet 3: Resumen consolidado
    const resumenMap = new Map<string, any>()

    recibos.forEach(recibo => {
      const emp = recibo.empleado || {}
      const key = recibo.cuil || emp.cuil || ''
      if (!resumenMap.has(key)) {
        resumenMap.set(key, {
          'CUIL': key,
          'Nombre': emp.nombre_completo || recibo.nombre_completo || 'SIN NOMBRE',
          'CBU': emp.cbu || recibo.cbu || '',
          'Alias': emp.alias_cbu || recibo.alias_cbu || '',
          'Banco': recibo.banco || emp.banco || '',
          'Total Sueldos': 0,
          'Total Incentivos': 0,
          'Total a Transferir': 0
        })
      }
      const item = resumenMap.get(key)!
      item['Total Sueldos'] += recibo.neto_a_cobrar || 0
    })

    incentivos.forEach(inv => {
      const emp = inv.empleado || {}
      const key = inv.cuil || emp.cuil || ''
      if (resumenMap.has(key)) {
        const item = resumenMap.get(key)!
        item['Total Incentivos'] += inv.monto_neto || 0
      } else {
        resumenMap.set(key, {
          'CUIL': key,
          'Nombre': emp.nombre_completo || 'SIN NOMBRE',
          'CBU': emp.cbu || '',
          'Alias': emp.alias_cbu || '',
          'Banco': emp.banco || '',
          'Total Sueldos': 0,
          'Total Incentivos': inv.monto_neto || 0,
          'Total a Transferir': inv.monto_neto || 0
        })
      }
    })

    resumenMap.forEach(item => {
      item['Total a Transferir'] = item['Total Sueldos'] + item['Total Incentivos']
    })

    const resumenData = Array.from(resumenMap.values())

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sueldosData), 'Sueldos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incentivosData), 'Incentivos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen')

    XLSX.writeFile(wb, `Planilla_Completa_${periodo}_${quincena !== 'todas' ? `Q${quincena}` : 'Completa'}_${new Date().toISOString().split('T')[0]}.xlsx`)
    alert(`✅ Planilla completa generada con ${sueldosData.length} sueldos y ${incentivosData.length} incentivos`)
  }

  // Generar planilla para banco (solo CBU + Monto)
  const generarPlanillaBanco = () => {
    if (recibos.length === 0 && incentivos.length === 0) {
      alert('No hay datos para el período seleccionado')
      return
    }

    const bancoMap = new Map<string, any>()

    recibos.forEach(recibo => {
      const emp = recibo.empleado || {}
      const key = emp.cbu || recibo.cbu || ''
      if (!key) return

      if (!bancoMap.has(key)) {
        bancoMap.set(key, {
          'CBU': key,
          'Alias': emp.alias_cbu || recibo.alias_cbu || '',
          'Nombre': emp.nombre_completo || recibo.nombre_completo || 'SIN NOMBRE',
          'CUIL': recibo.cuil || emp.cuil || '',
          'Monto Sueldo': 0,
          'Monto Incentivo': 0,
          'Total a Transferir': 0
        })
      }
      const item = bancoMap.get(key)!
      item['Monto Sueldo'] += recibo.neto_a_cobrar || 0
    })

    incentivos.forEach(inv => {
      const emp = inv.empleado || {}
      const key = emp.cbu || ''
      if (!key) return

      if (bancoMap.has(key)) {
        const item = bancoMap.get(key)!
        item['Monto Incentivo'] += inv.monto_neto || 0
      }
    })

    bancoMap.forEach(item => {
      item['Total a Transferir'] = item['Monto Sueldo'] + item['Monto Incentivo']
    })

    const bancoData = Array.from(bancoMap.values())

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bancoData), 'Transferencias')

    XLSX.writeFile(wb, `Planilla_Banco_${periodo}_${quincena !== 'todas' ? `Q${quincena}` : 'Completa'}_${new Date().toISOString().split('T')[0]}.xlsx`)
    alert(`✅ Planilla para banco generada con ${bancoData.length} transferencias`)
  }

  // Generar CSV simple
  const generarCSV = () => {
    if (recibos.length === 0 && incentivos.length === 0) {
      alert('No hay datos para el período seleccionado')
      return
    }

    const csvData = recibos.map(recibo => {
      const emp = recibo.empleado || {}
      return {
        CUIL: recibo.cuil || emp.cuil || '',
        Nombre: emp.nombre_completo || recibo.nombre_completo || 'SIN NOMBRE',
        CBU: emp.cbu || recibo.cbu || '',
        Neto: recibo.neto_a_cobrar || 0,
        Período: recibo.periodo,
        Quincena: recibo.quincena
      }
    })

    const ws = XLSX.utils.json_to_sheet(csvData)
    const csv = XLSX.utils.sheet_to_csv(ws)

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Planilla_CSV_${periodo}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()

    alert(`✅ CSV generado con ${csvData.length} registros`)
  }

  const totalSueldos = recibos.reduce((sum, r) => sum + (r.neto_a_cobrar || 0), 0)
  const totalIncentivos = incentivos.reduce((sum, i) => sum + (i.monto_neto || 0), 0)
  const totalGeneral = totalSueldos + totalIncentivos
  const empleadosSinCBU = empleados.filter(e => !e.cbu).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Generación de Planillas</h1>
        <p className="text-gray-600">Exportá planillas para transferencias bancarias</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-2">Período:</label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Quincena:</label>
            <select
              value={quincena}
              onChange={(e) => setQuincena(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="todas">Todas</option>
              <option value="1ra">1ra Quincena</option>
              <option value="2da">2da Quincena</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setVistaPrevia(!vistaPrevia)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              {vistaPrevia ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Sueldos</p>
          <p className="text-2xl font-bold text-blue-900">{recibos.length}</p>
          <p className="text-sm text-blue-600">${totalSueldos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">Incentivos</p>
          <p className="text-2xl font-bold text-green-900">{incentivos.length}</p>
          <p className="text-sm text-green-600">${totalIncentivos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700">Total a Transferir</p>
          <p className="text-2xl font-bold text-purple-900">${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">Empleados sin CBU</p>
          <p className="text-2xl font-bold text-yellow-900">{empleadosSinCBU}</p>
          <p className="text-xs text-yellow-600">Revisar antes de generar</p>
        </div>
      </div>

      {/* Botones de descarga */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Descargar Planilla</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={generarPlanillaCompleta}
            disabled={recibos.length === 0 && incentivos.length === 0}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
             Excel Completo (3 hojas)
          </button>
          <button
            onClick={generarPlanillaBanco}
            disabled={recibos.length === 0 && incentivos.length === 0}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            🏦 Formato Banco
          </button>
          <button
            onClick={generarCSV}
            disabled={recibos.length === 0 && incentivos.length === 0}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            📄 CSV Simple
          </button>
        </div>
      </div>

      {/* Vista Previa */}
      {vistaPrevia && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Vista Previa - Resumen Consolidado</h2>
          {recibos.length === 0 && incentivos.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay datos para mostrar</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">CUIL</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Nombre</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">CBU</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Sueldo</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Incentivo</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    const resumenMap = new Map<string, any>()
                    recibos.forEach(recibo => {
                      const emp = recibo.empleado || {}
                      const key = recibo.cuil || emp.cuil || ''
                      if (!resumenMap.has(key)) {
                        resumenMap.set(key, {
                          cuil: key,
                          nombre: emp.nombre_completo || recibo.nombre_completo || '',
                          cbu: emp.cbu || recibo.cbu || '',
                          sueldo: 0,
                          incentivo: 0,
                          total: 0
                        })
                      }
                      const item = resumenMap.get(key)!
                      item.sueldo += recibo.neto_a_cobrar || 0
                    })
                    incentivos.forEach(inv => {
                      const emp = inv.empleado || {}
                      const key = inv.cuil || emp.cuil || ''
                      if (resumenMap.has(key)) {
                        const item = resumenMap.get(key)!
                        item.incentivo += inv.monto_neto || 0
                      } else {
                        resumenMap.set(key, {
                          cuil: key,
                          nombre: emp.nombre_completo || 'SIN NOMBRE',
                          cbu: emp.cbu || '',
                          sueldo: 0,
                          incentivo: inv.monto_neto || 0,
                          total: inv.monto_neto || 0
                        })
                      }
                    })
                    resumenMap.forEach(item => {
                      item.total = item.sueldo + item.incentivo
                    })
                    return Array.from(resumenMap.values()).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{item.cuil}</td>
                        <td className="px-4 py-3 text-sm font-medium">{item.nombre}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.cbu || '️ Sin CBU'}</td>
                        <td className="px-4 py-3 text-sm text-right">${item.sueldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-sm text-right">${item.incentivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold">${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">${totalSueldos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">${totalIncentivos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-lg">${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Advertencia si faltan CBUs */}
      {empleadosSinCBU > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            <strong>⚠️ Atención:</strong> {empleadosSinCBU} empleado(s) no tienen CBU cargado.
            La planilla se generará pero las transferencias podrían fallar.
          </p>
        </div>
      )}
    </div>
  )
}