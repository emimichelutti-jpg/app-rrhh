'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'

export default function PlanillasPage() {
  const [periodo, setPeriodo] = useState('')
  const [quincena, setQuincena] = useState('todas')
  const [zona, setZona] = useState('todas')
  const [tipoRecibo, setTipoRecibo] = useState('todas')
  const [tipoPago, setTipoPago] = useState('todas')
  const [empleados, setEmpleados] = useState<any[]>([])
  const [zonas, setZonas] = useState<any[]>([])
  const [recibos, setRecibos] = useState<any[]>([])
  const [incentivos, setIncentivos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [vistaPrevia, setVistaPrevia] = useState(false)

  useEffect(() => {
    cargarEmpleados()
    cargarZonas()
    const ahora = new Date()
    setPeriodo(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  useEffect(() => {
    if (periodo) {
      cargarDatos()
    }
  }, [periodo, quincena, zona, tipoRecibo, tipoPago])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil, cbu, alias_cbu, zona_id, tipo_pago')
    if (data) setEmpleados(data)
  }

  const cargarZonas = async () => {
    const { data } = await supabase
      .from('zonas')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
    if (data) setZonas(data)
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Filtrar empleados según zona y tipo_pago
      let empleadosFiltrados = empleados

      if (zona !== 'todas') {
        empleadosFiltrados = empleadosFiltrados.filter(e => e.zona_id === zona)
      }

      if (tipoPago !== 'todas') {
        empleadosFiltrados = empleadosFiltrados.filter(e => e.tipo_pago === tipoPago)
      }

      const empleadoIds = empleadosFiltrados.map(e => e.id)
      const cuilsEmpleados = empleadosFiltrados.map(e => e.cuil)

      // Cargar recibos
      let queryRecibos = supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('periodo', periodo)
        .neq('estado', 'anulado')
        .in('cuil', cuilsEmpleados)

      if (quincena !== 'todas') {
        queryRecibos = queryRecibos.eq('quincena', quincena)
      }

      if (tipoRecibo !== 'todas') {
        queryRecibos = queryRecibos.eq('tipo_recibo', tipoRecibo)
      }

      const { data: recibosData, error: errorRecibos } = await queryRecibos

      // Cargar incentivos
      const { data: incentivosData, error: errorIncentivos } = await supabase
        .from('incentivos')
        .select('*')
        .eq('periodo', periodo)
        .in('empleado_id', empleadoIds)

      console.log('Recibos cargados:', recibosData?.length || 0)
      console.log('Incentivos cargados:', incentivosData?.length || 0)
      
      if (errorRecibos) console.error('Error en recibos:', errorRecibos)
      if (errorIncentivos) console.error('Error en incentivos:', errorIncentivos)

      // Crear mapa de empleados por CUIL
      const empleadosPorCuil = new Map()
      empleadosFiltrados.forEach(emp => {
        if (emp.cuil) {
          const cuilNormalizado = String(emp.cuil).replace(/[-\s]/g, '')
          empleadosPorCuil.set(cuilNormalizado, emp)
        }
      })

      // Agregar empleado a cada recibo
      const recibosConEmpleados = recibosData?.map(recibo => {
        const cuilRecibo = String(recibo.cuil || '').replace(/[-\s]/g, '')
        const empleado = empleadosPorCuil.get(cuilRecibo)
        return {
          ...recibo,
          empleado: empleado || null
        }
      }) || []

      // Agregar empleado a cada incentivo
      const incentivosConEmpleados = incentivosData?.map(inv => {
        const emp = empleadosFiltrados.find(e => e.id === inv.empleado_id)
        return {
          ...inv,
          empleado: emp || null
        }
      }) || []

      setRecibos(recibosConEmpleados)
      setIncentivos(incentivosConEmpleados)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
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
        'Nombre': emp.nombre_completo || '',
        'Sección': recibo.seccion || '',
        'Categoría': recibo.categoria || '',
        'Banco': recibo.banco || '',
        'CBU': emp.cbu || '',
        'Alias': emp.alias_cbu || '',
        'Tipo Recibo': recibo.tipo_recibo || 'normal',
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
          'Nombre': emp.nombre_completo || 'SIN NOMBRE',
          'CBU': emp.cbu || '',
          'Alias': emp.alias_cbu || '',
          'Banco': recibo.banco || '',
          'Tipo Recibo': recibo.tipo_recibo || 'normal',
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
          'Banco': '',
          'Tipo Recibo': 'normal',
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

    XLSX.writeFile(wb, `Planilla_${zona !== 'todas' ? zonas.find(z => z.id === zona)?.nombre : 'Todas'}_${periodo}_${quincena !== 'todas' ? `Q${quincena}` : 'Completa'}_${new Date().toISOString().split('T')[0]}.xlsx`)
    alert(`✅ Planilla completa generada con ${sueldosData.length} sueldos y ${incentivosData.length} incentivos`)
  }

  // Generar planilla para banco
  const generarPlanillaBanco = () => {
    if (recibos.length === 0 && incentivos.length === 0) {
      alert('No hay datos para el período seleccionado')
      return
    }

    const bancoMap = new Map<string, any>()

    recibos.forEach(recibo => {
      const emp = recibo.empleado || {}
      const key = emp.cbu || ''
      if (!key) return

      if (!bancoMap.has(key)) {
        bancoMap.set(key, {
          'CBU': key,
          'Alias': emp.alias_cbu || '',
          'Nombre': emp.nombre_completo || 'SIN NOMBRE',
          'CUIL': recibo.cuil || emp.cuil || '',
          'Tipo Recibo': recibo.tipo_recibo || 'normal',
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

    XLSX.writeFile(wb, `Planilla_Banco_${zona !== 'todas' ? zonas.find(z => z.id === zona)?.nombre : 'Todas'}_${periodo}_${quincena !== 'todas' ? `Q${quincena}` : 'Completa'}_${new Date().toISOString().split('T')[0]}.xlsx`)
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
        Nombre: emp.nombre_completo || 'SIN NOMBRE',
        CBU: emp.cbu || '',
        Tipo: recibo.tipo_recibo || 'normal',
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Período:</label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Quincena:</label>
            <select
              value={quincena}
              onChange={(e) => setQuincena(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            >
              <option value="todas">Todas</option>
              <option value="1ra">1ra Quincena</option>
              <option value="2da">2da Quincena</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Zona:</label>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            >
              <option value="todas">Todas las zonas</option>
              {zonas.map(z => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Recibo:</label>
            <select
              value={tipoRecibo}
              onChange={(e) => setTipoRecibo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            >
              <option value="todas">Todos</option>
              <option value="normal">Normal</option>
              <option value="sac_1ra">SAC 1ra Cuota</option>
              <option value="sac_2da">SAC 2da Cuota</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="bono">Bono</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Pago:</label>
            <select
              value={tipoPago}
              onChange={(e) => setTipoPago(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            >
              <option value="todas">Todos</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setVistaPrevia(!vistaPrevia)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {vistaPrevia ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
          </button>
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
            📊 Excel Completo (3 hojas)
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
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Tipo</th>
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
                          nombre: emp.nombre_completo || '',
                          cbu: emp.cbu || '',
                          tipo: recibo.tipo_recibo || 'normal',
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
                          tipo: 'normal',
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
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.tipo === 'normal' ? 'bg-blue-100 text-blue-800' :
                            item.tipo === 'sac_1ra' || item.tipo === 'sac_2da' ? 'bg-purple-100 text-purple-800' :
                            item.tipo === 'vacaciones' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {item.tipo === 'normal' ? 'Normal' :
                             item.tipo === 'sac_1ra' ? 'SAC 1ra' :
                             item.tipo === 'sac_2da' ? 'SAC 2da' :
                             item.tipo === 'vacaciones' ? 'Vacaciones' : 'Bono'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">${item.sueldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-sm text-right">${item.incentivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold">${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL</td>
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
            <strong>️ Atención:</strong> {empleadosSinCBU} empleado(s) no tienen CBU cargado.
            La planilla se generará pero las transferencias podrían fallar.
          </p>
        </div>
      )}
    </div>
  )
}