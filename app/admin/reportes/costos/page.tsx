'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
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
  total_sueldo_recibo: number
  sueldo_real: number
  incentivo: number
  total_final: number
  costo_base_empleador: number
  costo_total_empleador: number
  ingresos_productividad: number
  roi: number
}

type FiltroTipo = 'todos' | 'quincenal' | 'mensual'

export default function ReporteCostosPage() {
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [guardandoSueldo, setGuardandoSueldo] = useState<string | null>(null)
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
      // Cargar recibos
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
            sueldo_real_mensual,
            notas_sueldo,
            zonas (nombre)
          )
        `)
        .eq('periodo', periodo)

      // Cargar incentivos
      const { data: incentivos } = await supabase
        .from('incentivos')
        .select('*')
        .eq('periodo', periodo)

      // Cargar actividades de productividad del período
      const [year, month] = periodo.split('-')
      const primerDia = `${periodo}-01`
      const ultimoDiaMes = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

      const { data: actividades } = await supabase
        .from('actividades_diarias')
        .select('empleado_id, precio')
        .gte('fecha_actividad', primerDia)
        .lte('fecha_actividad', ultimoDiaMes)

      const empleadosMap = new Map<string, EmpleadoCosto>()
      const localidadesSet = new Set<string>()

      // Agrupar ingresos por empleado
      const ingresosPorEmpleado = new Map<string, number>()
      actividades?.forEach(act => {
        const actual = ingresosPorEmpleado.get(act.empleado_id) || 0
        ingresosPorEmpleado.set(act.empleado_id, actual + (act.precio || 0))
      })

      recibos?.forEach(recibo => {
        const emp = recibo.empleados
        if (!emp) return

        const empId = emp.id
        // La zona se toma de Gestión de Zonas (zonas.nombre).
        // Si el empleado aún no tiene zona asignada, cae a la localidad manual.
        const localidad = emp.zonas?.nombre || emp.localidad || 'Sin localidad'
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
            total_sueldo_recibo: 0,
            sueldo_real: emp.sueldo_real_mensual || 0,
            incentivo: 0,
            total_final: 0,
            costo_base_empleador: 0,
            costo_total_empleador: 0,
            ingresos_productividad: ingresosPorEmpleado.get(empId) || 0,
            roi: 0
          })
        }

        const empData = empleadosMap.get(empId)!
        const neto = parseFloat(recibo.neto_a_cobrar) || 0
        const costo = parseFloat(recibo.costo_total_empleador) || 0

        if (recibo.quincena === '1ra') empData.quincena_1ra = neto
        else if (recibo.quincena === '2da') empData.quincena_2da = neto
        else if (recibo.quincena === 'Mensual') empData.mensual = neto

        empData.total_sueldo_recibo = empData.quincena_1ra + empData.quincena_2da + empData.mensual

        // Base inmutable: costo empleador oficial MENOS el neto (aportes/cargas)
        empData.costo_base_empleador += costo - neto
      })

      incentivos?.forEach(inc => {
        const empData = empleadosMap.get(inc.empleado_id)
        if (empData) {
          empData.incentivo = parseFloat(inc.monto_bruto) || 0
        }
      })

      // REGLA ÚNICA (idéntica a la de edición):
      // costo = base + sueldo aplicado (real o recibo) + incentivo
      const empleadosArray = Array.from(empleadosMap.values()).map(emp => {
        const sueldoUsar = emp.sueldo_real > 0 ? emp.sueldo_real : emp.total_sueldo_recibo
        emp.total_final = sueldoUsar + emp.incentivo
        emp.costo_total_empleador = emp.costo_base_empleador + sueldoUsar + emp.incentivo
        emp.roi = emp.costo_total_empleador > 0
          ? ((emp.ingresos_productividad - emp.costo_total_empleador) / emp.costo_total_empleador) * 100
          : 0
        return emp
      })

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
      const { data: existente } = await supabase
        .from('incentivos')
        .select('id')
        .eq('empleado_id', empleadoId)
        .eq('periodo', periodo)
        .maybeSingle()

      if (existente) {
        const { error } = await supabase
          .from('incentivos')
          .update({ monto_bruto: nuevoValor })
          .eq('id', existente.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('incentivos')
          .insert({
            empleado_id: empleadoId,
            periodo: periodo,
            monto_bruto: nuevoValor
          })

        if (error) throw error
      }

      setEmpleados(prev => prev.map(emp => {
        if (emp.empleado_id === empleadoId) {
          const sueldoUsar = emp.sueldo_real > 0 ? emp.sueldo_real : emp.total_sueldo_recibo
          return {
            ...emp,
            incentivo: nuevoValor,
            total_final: sueldoUsar + nuevoValor,
            costo_total_empleador: emp.costo_base_empleador + sueldoUsar + nuevoValor
          }
        }
        return emp
      }))
    } catch (error: any) {
      alert(`Error al guardar el incentivo: ${error.message}`)
    } finally {
      setGuardando(null)
    }
  }

  const handleSueldoRealChange = async (empleadoId: string, nuevoValor: number) => {
    setGuardandoSueldo(empleadoId)

    try {
      const response = await fetch('/api/admin/actualizar-sueldo-real', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoId,
          sueldo_real_mensual: nuevoValor > 0 ? nuevoValor : null
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setEmpleados(prev => prev.map(emp => {
        if (emp.empleado_id === empleadoId) {
          const sueldoUsar = nuevoValor > 0 ? nuevoValor : emp.total_sueldo_recibo
          return {
            ...emp,
            sueldo_real: nuevoValor,
            total_final: sueldoUsar + emp.incentivo,
            costo_total_empleador: emp.costo_base_empleador + sueldoUsar + emp.incentivo
          }
        }
        return emp
      }))
    } catch (error: any) {
      alert(`Error al guardar el sueldo real: ${error.message}`)
    } finally {
      setGuardandoSueldo(null)
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
      total_sueldo_recibo: acc.total_sueldo_recibo + emp.total_sueldo_recibo,
      sueldo_real: acc.sueldo_real + emp.sueldo_real,
      incentivo: acc.incentivo + emp.incentivo,
      total_final: acc.total_final + emp.total_final,
      costo_total_empleador: acc.costo_total_empleador + emp.costo_total_empleador,
      ingresos_productividad: acc.ingresos_productividad + emp.ingresos_productividad
    }), {
      quincena_1ra: 0, quincena_2da: 0, mensual: 0,
      total_sueldo_recibo: 0, sueldo_real: 0, incentivo: 0, total_final: 0,
      costo_total_empleador: 0, ingresos_productividad: 0
    })
  }, [empleadosFiltrados])

  // Escapa comillas y comas para que el CSV no se desalinee
  const escapeCSV = (val: any) => {
    const str = String(val ?? '')
    return `"${str.replace(/"/g, '""')}"`
  }

  const exportarCSV = () => {
    const headers = ['Legajo', 'Técnico', 'Localidad', '1ª Quincena', '2ª Quincena', 'Mensual', 'Total Recibo', 'Sueldo Real', 'Incentivo', 'Total Neto', 'Costo Empleador', 'Ingresos Productividad', 'ROI %'].map(escapeCSV)
    const rows = empleadosFiltrados.map(emp => [
      emp.legajo,
      emp.nombre,
      emp.localidad,
      emp.quincena_1ra,
      emp.quincena_2da,
      emp.mensual,
      emp.total_sueldo_recibo,
      emp.sueldo_real || emp.total_sueldo_recibo,
      emp.incentivo,
      emp.total_final,
      emp.costo_total_empleador,
      emp.ingresos_productividad,
      emp.roi.toFixed(2)
    ].map(escapeCSV))

    const totalesRow = [
      '', '', 'TOTALES',
      totales.quincena_1ra, totales.quincena_2da, totales.mensual,
      totales.total_sueldo_recibo, totales.sueldo_real || totales.total_sueldo_recibo,
      totales.incentivo, totales.total_final, totales.costo_total_empleador,
      totales.ingresos_productividad, ''
    ].map(escapeCSV)

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      totalesRow.join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `reporte_costos_${periodo}.csv`
    link.click()
  }

  // 💳 PLANILLA DE PAGO DE SUELDOS (quincena):
  // - Solo pagos de la quincena según recibo (1ª, 2ª o mensual).
  // - SIN incentivos (se pagan por separado antes de fin de mes).
  // - El "Sueldo Real" aparece SOLO en los casos excepcionales cargados.
  // - Respeta los filtros activos (podés exportar una sola zona = un depósito).
  const exportarPlanillaPago = () => {
    const filas = empleadosFiltrados
      .slice()
      .sort((a, b) => (parseInt(a.legajo) || 0) - (parseInt(b.legajo) || 0) || a.nombre.localeCompare(b.nombre))
      .map(emp => [
        emp.legajo,
        emp.nombre,
        emp.localidad,
        emp.quincena_1ra,
        emp.quincena_2da,
        emp.mensual,
        emp.total_sueldo_recibo,
        emp.sueldo_real > 0 ? emp.sueldo_real : ''
      ])

    const header = [
      'Legajo', 'Técnico', 'Zona',
      '1ª Quincena', '2ª Quincena', 'Mensual',
      'Total Recibo', 'Sueldo Real (excepción)'
    ]
    const totalesRow = [
      '', '', 'TOTALES',
      totales.quincena_1ra, totales.quincena_2da, totales.mensual,
      totales.total_sueldo_recibo, ''
    ]

    const ws = XLSX.utils.aoa_to_sheet([header, ...filas, totalesRow])
    ws['!cols'] = [
      { wch: 8 }, { wch: 32 }, { wch: 16 },
      { wch: 13 }, { wch: 13 }, { wch: 13 },
      { wch: 14 }, { wch: 22 }
    ]

    // Resumen por zona: un pago/depósito por sucursal, también sin incentivos
    const porZona = new Map<string, { emp: number; q1: number; q2: number; men: number; total: number; real: number }>()
    empleadosFiltrados.forEach(e => {
      const z = porZona.get(e.localidad) || { emp: 0, q1: 0, q2: 0, men: 0, total: 0, real: 0 }
      z.emp += 1
      z.q1 += e.quincena_1ra
      z.q2 += e.quincena_2da
      z.men += e.mensual
      z.total += e.total_sueldo_recibo
      z.real += e.sueldo_real > 0 ? e.sueldo_real : 0
      porZona.set(e.localidad, z)
    })
    const resumen = Array.from(porZona.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([zona, z]) => [zona, z.emp, z.q1, z.q2, z.men, z.total, z.real > 0 ? z.real : ''])

    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Zona', 'Empleados', '1ª Quincena', '2ª Quincena', 'Mensual', 'Total Recibo', 'Sueldo Real (excepción)'],
      ...resumen
    ])
    ws2['!cols'] = [
      { wch: 16 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 22 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pago Sueldos')
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Zona')
    XLSX.writeFile(wb, `planilla_pago_sueldos_${periodo}.xlsx`)
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

  const getROIColor = (roi: number) => {
    if (roi >= 100) return 'text-green-700 bg-green-50'
    if (roi >= 0) return 'text-yellow-700 bg-yellow-50'
    return 'text-red-700 bg-red-50'
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
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Reporte de Costos & ROI</h1>
            <p className="text-gray-600 mt-1">Resumen de sueldos, incentivos, productividad y ROI - {getNombrePeriodo(periodo)}</p>
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
              onClick={exportarPlanillaPago}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm font-medium transition-colors"
              title="Excel con los pagos de la quincena según recibo (sin incentivos) y sueldo real en casos excepcionales"
            >
              💳 Planilla de Pago
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">💵</div>
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
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">📈</div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Ingresos Productividad</p>
                <p className="text-2xl font-bold text-purple-700">{formatMoney(totales.ingresos_productividad)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl">🎯</div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">ROI Promedio</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {totales.costo_total_empleador > 0
                    ? (((totales.ingresos_productividad - totales.costo_total_empleador) / totales.costo_total_empleador) * 100).toFixed(1)
                    : 0}%
                </p>
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
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Legajo</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[180px]">Técnico</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Localidad</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">1ª Quinc.</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">2ª Quinc.</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Mensual</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-blue-50">Total Recibo</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-yellow-50 min-w-[110px]">Sueldo Real</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase min-w-[110px]">Incentivo</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-green-50">Total Neto</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-orange-50">Costo Empleador</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-purple-50">Ingresos Prod.</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-indigo-50">ROI %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {empleadosFiltrados.map((emp, index) => {
                  return (
                    <tr key={emp.empleado_id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-3 text-sm text-gray-600 font-mono">{emp.legajo}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900">{emp.nombre}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium">
                          {emp.localidad}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900 font-mono">
                        {emp.quincena_1ra > 0 ? formatMoney(emp.quincena_1ra) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900 font-mono">
                        {emp.quincena_2da > 0 ? formatMoney(emp.quincena_2da) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900 font-mono">
                        {emp.mensual > 0 ? formatMoney(emp.mensual) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-semibold text-gray-900 font-mono bg-blue-50/50">
                        {formatMoney(emp.total_sueldo_recibo)}
                      </td>
                      <td className="px-3 py-3 text-sm text-right">
                        {guardandoSueldo === emp.empleado_id ? (
                          <div className="flex justify-end">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            defaultValue={emp.sueldo_real || ''}
                            onBlur={(e) => handleSueldoRealChange(emp.empleado_id, parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                            className="w-24 px-2 py-1.5 text-right text-sm border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono bg-yellow-50"
                            placeholder={emp.total_sueldo_recibo.toString()}
                            title={`Si está vacío, se usa el sueldo del recibo: ${formatMoney(emp.total_sueldo_recibo)}`}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-right">
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
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                            className="w-24 px-2 py-1.5 text-right text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-bold text-green-700 font-mono bg-green-50/50">
                        {formatMoney(emp.total_final)}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-bold text-orange-700 font-mono bg-orange-50/50">
                        {formatMoney(emp.costo_total_empleador)}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-bold text-purple-700 font-mono bg-purple-50/50">
                        {formatMoney(emp.ingresos_productividad)}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-bold font-mono">
                        <span className={`px-2 py-1 rounded-md text-xs ${getROIColor(emp.roi)}`}>
                          {emp.roi.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-bold">
                  <td colSpan={3} className="px-3 py-4 text-right text-gray-900 uppercase text-sm">Totales:</td>
                  <td className="px-3 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.quincena_1ra)}</td>
                  <td className="px-3 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.quincena_2da)}</td>
                  <td className="px-3 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.mensual)}</td>
                  <td className="px-3 py-4 text-right text-gray-900 font-mono bg-blue-50">{formatMoney(totales.total_sueldo_recibo)}</td>
                  <td className="px-3 py-4 text-right text-gray-900 font-mono bg-yellow-50">{formatMoney(totales.sueldo_real || totales.total_sueldo_recibo)}</td>
                  <td className="px-3 py-4 text-right text-gray-900 font-mono">{formatMoney(totales.incentivo)}</td>
                  <td className="px-3 py-4 text-right text-green-700 font-mono bg-green-50">{formatMoney(totales.total_final)}</td>
                  <td className="px-3 py-4 text-right text-orange-700 font-mono bg-orange-50">{formatMoney(totales.costo_total_empleador)}</td>
                  <td className="px-3 py-4 text-right text-purple-700 font-mono bg-purple-50">{formatMoney(totales.ingresos_productividad)}</td>
                  <td className="px-3 py-4 text-right text-indigo-700 font-mono bg-indigo-50">
                    {totales.costo_total_empleador > 0
                      ? (((totales.ingresos_productividad - totales.costo_total_empleador) / totales.costo_total_empleador) * 100).toFixed(1)
                      : 0}%
                  </td>
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
          <p className="mt-1 text-xs text-gray-400">
            💡 "Planilla de Pago" exporta solo los pagos de la quincena según recibo (sin incentivos) y el sueldo real en casos excepcionales.
            La zona se toma de Gestión de Zonas cuando el empleado tiene zona asignada.
          </p>
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