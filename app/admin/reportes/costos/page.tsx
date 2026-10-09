'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import ImportarIncentivos from '@/components/ImportarIncentivos'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface EmpleadoCosto {
  legajo: string
  empleado_id: string
  nombre: string
  localidad: string
  quincena_1ra: number
  quincena_2da: number
  mensual: number
  total_sueldo: number
  incentivo: number
  total_final: number
  costo_total_empleador: number
}

type FiltroTipo = 'todos' | 'quincenal' | 'mensual'

export default function ReporteCostosPage() {
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState('2026-09')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [filtroLocalidad, setFiltroLocalidad] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [empleados, setEmpleados] = useState<EmpleadoCosto[]>([])
  const [localidades, setLocalidades] = useState<string[]>([])
  const [mostrarImportar, setMostrarImportar] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [periodo])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: recibos } = await supabase
        .from('recibos_sueldo')
        .select(`
          *,
          empleados (
            id,
            legajo,
            nombre_completo,
            localidad,
            zona_id,
            zonas (nombre)
          )
        `)
        .eq('periodo', periodo)

      const { data: incentivos } = await supabase
        .from('incentivos')
        .select('*')
        .eq('periodo', periodo)

      const empleadosMap = new Map<string, EmpleadoCosto>()
      const localidadesSet = new Set<string>()

      recibos?.forEach(recibo => {
        const emp = recibo.empleados
        if (!emp) return

        const empId = emp.id
        const localidad = emp.localidad || emp.zonas?.nombre || 'Sin localidad'
        localidadesSet.add(localidad)

        if (!empleadosMap.has(empId)) {
          empleadosMap.set(empId, {
            legajo: emp.legajo || '-',
            empleado_id: empId,
            nombre: emp.nombre_completo,
            localidad,
            quincena_1ra: 0,
            quincena_2da: 0,
            mensual: 0,
            total_sueldo: 0,
            incentivo: 0,
            total_final: 0,
            costo_total_empleador: 0
          })
        }

        const empData = empleadosMap.get(empId)!
        const neto = parseFloat(recibo.neto_a_cobrar) || 0
        const costo = parseFloat(recibo.costo_total_empleador) || 0

        if (recibo.quincena === '1ra') empData.quincena_1ra = neto
        else if (recibo.quincena === '2da') empData.quincena_2da = neto
        else if (recibo.quincena === 'Mensual') empData.mensual = neto

        empData.total_sueldo = empData.quincena_1ra + empData.quincena_2da + empData.mensual
        empData.costo_total_empleador += costo
      })

      incentivos?.forEach(inc => {
        const empData = empleadosMap.get(inc.empleado_id)
        if (empData) {
          empData.incentivo = parseFloat(inc.monto_bruto) || 0
          empData.costo_total_empleador += empData.incentivo
        }
      })

      const empleadosArray = Array.from(empleadosMap.values()).map(emp => ({
        ...emp,
        total_final: emp.total_sueldo + emp.incentivo
      }))

      empleadosArray.sort((a, b) => b.total_final - a.total_final)

      setEmpleados(empleadosArray)
      setLocalidades(Array.from(localidadesSet).sort())
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIncentivoChange = async (empleadoId: string, nuevoValor: number) => {
    setGuardando(empleadoId)
    
    try {
      const { data: existente, error: errorBusqueda } = await supabase
        .from('incentivos')
        .select('id')
        .eq('empleado_id', empleadoId)
        .eq('periodo', periodo)
        .maybeSingle()

      if (errorBusqueda) {
        console.error('❌ Error buscando incentivo:', errorBusqueda)
        throw new Error(`Error buscando: ${errorBusqueda.message}`)
      }

      if (existente) {
        const { error } = await supabase
          .from('incentivos')
          .update({ monto_bruto: nuevoValor })
          .eq('id', existente.id)
        
        if (error) {
          console.error('❌ Error actualizando:', error)
          throw new Error(`Error actualizando: ${error.message}`)
        }
      } else {
        const { error } = await supabase
          .from('incentivos')
          .insert({
            empleado_id: empleadoId,
            periodo: periodo,
            monto_bruto: nuevoValor
          })
        
        if (error) {
          console.error('❌ Error insertando:', error)
          throw new Error(`Error insertando: ${error.message}`)
        }
      }

      setEmpleados(prev => prev.map(emp => {
        if (emp.empleado_id === empleadoId) {
          const costoBase = emp.costo_total_empleador - emp.incentivo
          return {
            ...emp,
            incentivo: nuevoValor,
            total_final: emp.total_sueldo + nuevoValor,
            costo_total_empleador: costoBase + nuevoValor
          }
        }
        return emp
      }))

    } catch (error: any) {
      console.error('❌ Error completo:', error)
      alert(`Error al guardar el incentivo: ${error.message || 'Error desconocido'}`)
    } finally {
      setGuardando(null)
    }
  }

  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(emp => {
      if (filtroTipo === 'quincenal' && emp.mensual > 0) return false
      if (filtroTipo === 'mensual' && emp.mensual === 0) return false
      if (filtroLocalidad !== 'todas' && emp.localidad !== filtroLocalidad) return false
      if (busqueda && !emp.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [empleados, filtroTipo, filtroLocalidad, busqueda])

  const totales = useMemo(() => {
    return empleadosFiltrados.reduce((acc, emp) => ({
      quincena_1ra: acc.quincena_1ra + emp.quincena_1ra,
      quincena_2da: acc.quincena_2da + emp.quincena_2da,
      mensual: acc.mensual + emp.mensual,
      total_sueldo: acc.total_sueldo + emp.total_sueldo,
      incentivo: acc.incentivo + emp.incentivo,
      total_final: acc.total_final + emp.total_final,
      costo_total_empleador: acc.costo_total_empleador + emp.costo_total_empleador
    }), { 
      quincena_1ra: 0, quincena_2da: 0, mensual: 0, 
      total_sueldo: 0, incentivo: 0, total_final: 0,
      costo_total_empleador: 0
    })
  }, [empleadosFiltrados])

  const exportarCSV = () => {
    const headers = ['Legajo', 'Técnico', 'Localidad', '1ª Quincena', '2ª Quincena', 'Mensual', 'Total Sueldo', 'Incentivo', 'Total Neto', 'Costo Total Empleador']
    const rows = empleadosFiltrados.map(emp => [
      emp.legajo,
      emp.nombre,
      emp.localidad,
      emp.quincena_1ra,
      emp.quincena_2da,
      emp.mensual,
      emp.total_sueldo,
      emp.incentivo,
      emp.total_final,
      emp.costo_total_empleador
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      ['', '', 'TOTALES', totales.quincena_1ra, totales.quincena_2da, totales.mensual, totales.total_sueldo, totales.incentivo, totales.total_final, totales.costo_total_empleador].join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `reporte_costos_${periodo}.csv`
    link.click()
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount)
  }

  const getNombrePeriodo = (periodo: string) => {
    const [year, month] = periodo.split('-')
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${meses[parseInt(month) - 1]} ${year}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header con botones */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Reporte de Costos</h1>
            <p className="text-gray-600 mt-1">Resumen de sueldos, incentivos y costos empleador - {getNombrePeriodo(periodo)}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setMostrarImportar(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar Incentivos
            </button>
            <button
              onClick={exportarCSV}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Período</label>
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Tipo de Empleado</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                <option value="quincenal">Quincenales</option>
                <option value="mensual">Mensuales</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Localidad</label>
              <select
                value={filtroLocalidad}
                onChange={(e) => setFiltroLocalidad(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todas">Todas las localidades</option>
                {localidades.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Buscar empleado</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre del técnico..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">👥</div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Empleados</p>
                <p className="text-2xl font-bold text-gray-900">{empleadosFiltrados.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl"></div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Total Neto Empleados</p>
                <p className="text-2xl font-bold text-green-700">{formatMoney(totales.total_final)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">🏢</div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Costo Total Empresa</p>
                <p className="text-2xl font-bold text-orange-700">{formatMoney(totales.costo_total_empleador)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl"></div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Aportes + Contribuciones</p>
                <p className="text-2xl font-bold text-purple-700">{formatMoney(totales.costo_total_empleador - totales.total_final)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Legajo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">Técnico</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Localidad</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">1ª Quincena</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2ª Quincena</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Mensual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-blue-50">Total Sueldo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">Incentivo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-green-50">Total Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-orange-50 min-w-[150px]">Costo Empleador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {empleadosFiltrados.map((emp, index) => (
                  <tr key={emp.empleado_id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{emp.legajo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium">
                        {emp.localidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                      {emp.quincena_1ra > 0 ? formatMoney(emp.quincena_1ra) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                      {emp.quincena_2da > 0 ? formatMoney(emp.quincena_2da) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                      {emp.mensual > 0 ? formatMoney(emp.mensual) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 font-mono bg-blue-50/50">
                      {formatMoney(emp.total_sueldo)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {guardando === emp.empleado_id ? (
                        <div className="flex justify-end">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <input
                          type="number"
                          defaultValue={emp.incentivo || ''}
                          onBlur={(e) => handleIncentivoChange(emp.empleado_id, parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur()
                            }
                          }}
                          className="w-28 px-2 py-1.5 text-right text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-700 font-mono bg-green-50/50">
                      {formatMoney(emp.total_final)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-orange-700 font-mono bg-orange-50/50">
                      {formatMoney(emp.costo_total_empleador)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-bold">
                  <td colSpan={3} className="px-4 py-4 text-right text-gray-900 uppercase text-sm">Totales:</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.quincena_1ra)}</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.quincena_2da)}</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.mensual)}</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-mono bg-blue-50">{formatMoney(totales.total_sueldo)}</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.incentivo)}</td>
                  <td className="px-4 py-4 text-right text-green-700 font-mono bg-green-50">{formatMoney(totales.total_final)}</td>
                  <td className="px-4 py-4 text-right text-orange-700 font-mono bg-orange-50">{formatMoney(totales.costo_total_empleador)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Info footer */}
        <div className="mt-4 text-center text-sm text-gray-500">
          Mostrando {empleadosFiltrados.length} de {empleados.length} empleados
          {filtroTipo !== 'todos' && ` • Filtrado: ${filtroTipo}`}
          {filtroLocalidad !== 'todas' && ` • Localidad: ${filtroLocalidad}`}
        </div>
      </div>

      {/* Modal de importar incentivos */}
      {mostrarImportar && (
        <ImportarIncentivos
          periodo={periodo}
          onImportados={(cantidad) => {
            alert(`✅ ${cantidad} incentivos importados correctamente`)
            cargarDatos()
            setMostrarImportar(false)
          }}
          onClose={() => setMostrarImportar(false)}
        />
      )}
    </div>
  )
}