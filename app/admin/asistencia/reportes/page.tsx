'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line
} from 'recharts'
import * as XLSX from 'xlsx'

const ESTADOS_ASISTENCIA = [
  { value: 'presente', label: 'Presente', color: '#10b981' },
  { value: 'ausente_injustificado', label: 'Ausente Injust.', color: '#ef4444' },
  { value: 'ausente_justificado', label: 'Ausente Just.', color: '#eab308' },
  { value: 'tarde', label: 'Tarde', color: '#f97316' },
  { value: 'permiso', label: 'Permiso', color: '#3b82f6' },
  { value: 'vacaciones', label: 'Vacaciones', color: '#06b6d4' },
  { value: 'licencia_medica', label: 'Lic. Médica', color: '#a855f7' },
  { value: 'ilt', label: 'ILT (ART)', color: '#dc2626' },
  { value: 'licencia_familiar', label: 'Lic. Familiar', color: '#9333ea' },
  { value: 'feriado', label: 'Feriado', color: '#6b7280' },
]

const COLORES = ['#10b981', '#ef4444', '#eab308', '#f97316', '#3b82f6', '#06b6d4', '#a855f7', '#dc2626', '#9333ea', '#6b7280']

export default function ReportesAsistenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fechaDesde, setFechaDesde] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
  const [filtroZona, setFiltroZona] = useState('todas')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [vistaActiva, setVistaActiva] = useState<'resumen' | 'empleados' | 'zonas'>('resumen')

  useEffect(() => {
    cargarEmpleados()
  }, [])

  useEffect(() => {
    if (empleados.length > 0) {
      cargarReportes()
    }
  }, [fechaDesde, fechaHasta, filtroZona, filtroEstado])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil, seccion, zona')
      .eq('activo', true)
      .order('nombre_completo')

    setEmpleados(data || [])
  }

  const cargarReportes = async () => {
    setLoading(true)
    
    let query = supabase
      .from('registros_asistencia')
      .select('*, empleados(id, nombre_completo, cuil, seccion, zona)')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: false })

    if (filtroZona !== 'todas') {
      query = query.eq('empleados.zona', filtroZona)
    }

    if (filtroEstado !== 'todos') {
      query = query.eq('estado', filtroEstado)
    }

    const { data } = await query

    setRegistros(data || [])
    setLoading(false)
  }

  // Zonas únicas
  const zonas = [...new Set(empleados.map(e => e.zona).filter(Boolean))]

  // Estadísticas generales
  const estadisticas = {
    totalRegistros: registros.length,
    presentes: registros.filter(r => r.estado === 'presente').length,
    ausentes: registros.filter(r => r.estado?.startsWith('ausente')).length,
    tardes: registros.filter(r => r.estado === 'tarde').length,
    permisos: registros.filter(r => r.estado === 'permiso').length,
    vacaciones: registros.filter(r => r.estado === 'vacaciones').length,
    licencias: registros.filter(r => r.estado === 'licencia_medica').length,
    ilt_art: registros.filter(r => r.estado === 'ilt').length,
    licencias_familiar: registros.filter(r => r.estado === 'licencia_familiar').length,
    feriados: registros.filter(r => r.estado === 'feriado').length,
    horasTotales: registros.reduce((acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0),
  }

  // Datos para gráfico de torta (distribución de estados)
  const datosTorta = ESTADOS_ASISTENCIA.map(e => ({
    name: e.label,
    value: registros.filter(r => r.estado === e.value).length,
    color: e.color,
  })).filter(d => d.value > 0)

  // Datos para gráfico de barras (por día)
  const registrosPorDia = registros.reduce((acc: any, r) => {
    const fecha = r.fecha
    if (!acc[fecha]) {
      acc[fecha] = { fecha, presentes: 0, ausentes: 0, tardes: 0, otros: 0 }
    }
    if (r.estado === 'presente') acc[fecha].presentes++
    else if (r.estado?.startsWith('ausente')) acc[fecha].ausentes++
    else if (r.estado === 'tarde') acc[fecha].tardes++
    else acc[fecha].otros++
    return acc
  }, {})

  const datosBarras = Object.values(registrosPorDia)
    .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
    .slice(-30) // Últimos 30 días

  // Ranking de empleados con más ausencias
  const ausenciasPorEmpleado = registros
    .filter(r => r.estado?.startsWith('ausente') || r.estado === 'tarde' || r.estado === 'ilt')
    .reduce((acc: any, r) => {
      const empId = r.empleado_id
      if (!acc[empId]) {
        acc[empId] = {
          nombre: r.empleados?.nombre_completo || 'Desconocido',
          zona: r.empleados?.zona || 'Sin zona',
          ausencias: 0,
          tardes: 0,
          ilt: 0,
          total: 0,
        }
      }
      if (r.estado?.startsWith('ausente')) acc[empId].ausencias++
      if (r.estado === 'tarde') acc[empId].tardes++
      if (r.estado === 'ilt') acc[empId].ilt++
      acc[empId].total++
      return acc
    }, {})

  const rankingEmpleados = Object.values(ausenciasPorEmpleado)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 20)

  // Estadísticas por zona
  const estadisticasPorZona = registros.reduce((acc: any, r) => {
    const zona = r.empleados?.zona || 'Sin zona'
    if (!acc[zona]) {
      acc[zona] = {
        zona,
        total: 0,
        presentes: 0,
        ausentes: 0,
        tardes: 0,
        ilt: 0,
        horas: 0,
      }
    }
    acc[zona].total++
    if (r.estado === 'presente') acc[zona].presentes++
    if (r.estado?.startsWith('ausente')) acc[zona].ausentes++
    if (r.estado === 'tarde') acc[zona].tardes++
    if (r.estado === 'ilt') acc[zona].ilt++
    acc[zona].horas += parseFloat(r.horas_trabajadas) || 0
    return acc
  }, {})

  const datosZonas = Object.values(estadisticasPorZona)
    .sort((a: any, b: any) => b.total - a.total)

  // Exportar a Excel
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen
    const resumenData = [
      ['REPORTE DE ASISTENCIA'],
      [`Período: ${fechaDesde} al ${fechaHasta}`],
      [`Zona: ${filtroZona === 'todas' ? 'Todas' : filtroZona}`],
      [],
      ['ESTADÍSTICAS GENERALES'],
      ['Total Registros', estadisticas.totalRegistros],
      ['Presentes', estadisticas.presentes],
      ['Ausentes', estadisticas.ausentes],
      ['Tardes', estadisticas.tardes],
      ['Permisos', estadisticas.permisos],
      ['Vacaciones', estadisticas.vacaciones],
      ['Licencias Médicas', estadisticas.licencias],
      ['ILT/ART', estadisticas.ilt_art],
      ['Licencias Familiares', estadisticas.licencias_familiar],
      ['Feriados', estadisticas.feriados],
      ['Horas Totales', estadisticas.horasTotales.toFixed(2)],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    // Hoja 2: Detalle por empleado
    const detalleData = [['Empleado', 'Zona', 'Ausencias', 'Tardes', 'ILT', 'Total Incidencias']]
    rankingEmpleados.forEach((e: any) => {
      detalleData.push([e.nombre, e.zona, e.ausencias, e.tardes, e.ilt, e.total])
    })
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData)
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Ranking Empleados')

    // Hoja 3: Por zona
    const zonaData = [['Zona', 'Total', 'Presentes', 'Ausentes', 'Tardes', 'ILT', 'Horas']]
    datosZonas.forEach((z: any) => {
      zonaData.push([z.zona, z.total, z.presentes, z.ausentes, z.tardes, z.ilt, z.horas.toFixed(2)])
    })
    const wsZona = XLSX.utils.aoa_to_sheet(zonaData)
    XLSX.utils.book_append_sheet(wb, wsZona, 'Por Zona')

    XLSX.writeFile(wb, `reporte_asistencia_${fechaDesde}_${fechaHasta}.xlsx`)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes de Ausentismo</h1>
          <p className="text-gray-600">Análisis completo de asistencia del personal</p>
        </div>
        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          📥 Exportar a Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Zona:</label>
            <select
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="todas">Todas las zonas</option>
              {zonas.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estado:</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="todos">Todos los estados</option>
              {ESTADOS_ASISTENCIA.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs de vistas */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setVistaActiva('resumen')}
          className={`px-4 py-2 ${vistaActiva === 'resumen' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          📊 Resumen General
        </button>
        <button
          onClick={() => setVistaActiva('empleados')}
          className={`px-4 py-2 ${vistaActiva === 'empleados' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
           Ranking Empleados
        </button>
        <button
          onClick={() => setVistaActiva('zonas')}
          className={`px-4 py-2 ${vistaActiva === 'zonas' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          ️ Por Zona
        </button>
      </div>

      {/* Vista: Resumen General */}
      {vistaActiva === 'resumen' && (
        <div className="space-y-6">
          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <p className="text-xs text-gray-600">Total Registros</p>
              <p className="text-2xl font-bold text-blue-900">{estadisticas.totalRegistros}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <p className="text-xs text-gray-600">Presentes</p>
              <p className="text-2xl font-bold text-green-900">{estadisticas.presentes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <p className="text-xs text-gray-600">Ausentes</p>
              <p className="text-2xl font-bold text-red-900">{estadisticas.ausentes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <p className="text-xs text-gray-600">Tardes</p>
              <p className="text-2xl font-bold text-orange-900">{estadisticas.tardes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
              <p className="text-xs text-gray-600">ILT/ART</p>
              <p className="text-2xl font-bold text-red-700">{estadisticas.ilt_art}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de torta */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Distribución de Estados</h3>
              {datosTorta.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={datosTorta}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {datosTorta.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 py-12">No hay datos para mostrar</p>
              )}
            </div>

            {/* Gráfico de barras */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Evolución Diaria (últimos 30 días)</h3>
              {datosBarras.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={datosBarras}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="presentes" fill="#10b981" name="Presentes" />
                    <Bar dataKey="ausentes" fill="#ef4444" name="Ausentes" />
                    <Bar dataKey="tardes" fill="#f97316" name="Tardes" />
                    <Bar dataKey="otros" fill="#6b7280" name="Otros" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 py-12">No hay datos para mostrar</p>
              )}
            </div>
          </div>

          {/* Resumen de ILT/ART */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">🚑 Resumen ILT/ART</h3>
            <p className="text-red-700">
              Total de registros de ILT en el período: <strong>{estadisticas.ilt_art}</strong>
            </p>
            <p className="text-sm text-red-600 mt-2">
              Representa el {estadisticas.totalRegistros > 0 ? ((estadisticas.ilt_art / estadisticas.totalRegistros) * 100).toFixed(2) : 0}% del total de registros
            </p>
          </div>
        </div>
      )}

      {/* Vista: Ranking de Empleados */}
      {vistaActiva === 'empleados' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Top 20 Empleados con Más Incidencias</h3>
            <p className="text-sm text-gray-600">Ausencias + Tardes + ILT</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Empleado</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Zona</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Ausencias</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Tardes</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">ILT</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rankingEmpleados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No hay incidencias en este período
                    </td>
                  </tr>
                ) : (
                  rankingEmpleados.map((emp: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-700">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{emp.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.zona}</td>
                      <td className="px-4 py-3 text-center text-sm text-red-600 font-semibold">{emp.ausencias}</td>
                      <td className="px-4 py-3 text-center text-sm text-orange-600 font-semibold">{emp.tardes}</td>
                      <td className="px-4 py-3 text-center text-sm text-red-700 font-semibold">{emp.ilt}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold">{emp.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista: Por Zona */}
      {vistaActiva === 'zonas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Estadísticas por Zona</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Zona</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Presentes</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Ausentes</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Tardes</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">ILT</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {datosZonas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No hay datos por zona
                      </td>
                    </tr>
                  ) : (
                    datosZonas.map((z: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{z.zona}</td>
                        <td className="px-4 py-3 text-center text-sm">{z.total}</td>
                        <td className="px-4 py-3 text-center text-sm text-green-600 font-semibold">{z.presentes}</td>
                        <td className="px-4 py-3 text-center text-sm text-red-600 font-semibold">{z.ausentes}</td>
                        <td className="px-4 py-3 text-center text-sm text-orange-600 font-semibold">{z.tardes}</td>
                        <td className="px-4 py-3 text-center text-sm text-red-700 font-semibold">{z.ilt}</td>
                        <td className="px-4 py-3 text-center text-sm font-semibold">{z.horas.toFixed(1)}h</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico de barras por zona */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Comparativa por Zona</h3>
            {datosZonas.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosZonas}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="zona" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="presentes" fill="#10b981" name="Presentes" />
                  <Bar dataKey="ausentes" fill="#ef4444" name="Ausentes" />
                  <Bar dataKey="tardes" fill="#f97316" name="Tardes" />
                  <Bar dataKey="ilt" fill="#dc2626" name="ILT/ART" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-12">No hay datos para mostrar</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}