'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COLORES = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function ReportesPage() {
  const [loading, setLoading] = useState(true)
  const [tabActiva, setTabActiva] = useState<'resumen' | 'incentivos' | 'solicitudes' | 'empleados'>('resumen')
  
  // Métricas
  const [metricas, setMetricas] = useState({
    totalEmpleados: 0,
    totalIncentivosPagados: 0,
    totalAdelantosAprobados: 0,
    totalAdelantosRechazados: 0,
    totalAdelantosPendientes: 0,
    masaSalarial: 0
  })

  // Datos para gráficos
  const [evolucionMensual, setEvolucionMensual] = useState<any[]>([])
  const [distribucionSolicitudes, setDistribucionSolicitudes] = useState<any[]>([])
  const [rankingEmpleados, setRankingEmpleados] = useState<any[]>([])
  const [datosExportar, setDatosExportar] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // 1. Total empleados activos
      const { count: totalEmpleados } = await supabase
        .from('empleados')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      // 2. Total incentivos pagados (todos los períodos)
      const { data: incentivosData } = await supabase
        .from('incentivos')
        .select('monto_neto, periodo, empleado_id, empleados(nombre_completo)')

      const totalIncentivosPagados = incentivosData?.reduce((sum, i) => sum + (i.monto_neto || 0), 0) || 0

      // 3. Solicitudes por estado
      const { data: solicitudesData } = await supabase
        .from('solicitudes_sueldo')
        .select('estado, monto_total')

      const totalAprobados = solicitudesData?.filter(s => s.estado === 'aprobado' || s.estado === 'en_curso').reduce((sum, s) => sum + s.monto_total, 0) || 0
      const totalRechazados = solicitudesData?.filter(s => s.estado === 'rechazado').reduce((sum, s) => sum + s.monto_total, 0) || 0
      const totalPendientes = solicitudesData?.filter(s => s.estado === 'pendiente').reduce((sum, s) => sum + s.monto_total, 0) || 0

      // 4. Masa salarial (últimos recibos firmados)
      const { data: recibosData } = await supabase
        .from('recibos_sueldo')
        .select('neto_a_cobrar')
        .eq('estado', 'firmado')
      
      const masaSalarial = recibosData?.reduce((sum, r) => sum + (r.neto_a_cobrar || 0), 0) || 0

      setMetricas({
        totalEmpleados: totalEmpleados || 0,
        totalIncentivosPagados,
        totalAdelantosAprobados: totalAprobados,
        totalAdelantosRechazados: totalRechazados,
        totalAdelantosPendientes: totalPendientes,
        masaSalarial
      })

      // 5. Evolución mensual de incentivos
      const evolucionMap = new Map<string, number>()
      incentivosData?.forEach(inv => {
        const periodo = inv.periodo
        const actual = evolucionMap.get(periodo) || 0
        evolucionMap.set(periodo, actual + (inv.monto_neto || 0))
      })
      
      const evolucionArray = Array.from(evolucionMap.entries())
        .map(([periodo, total]) => {
          const [year, month] = periodo.split('-')
          const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
          return {
            periodo: `${meses[parseInt(month) - 1]} ${year}`,
            total: Math.round(total)
          }
        })
        .sort((a, b) => {
          const [mA, yA] = a.periodo.split(' ')
          const [mB, yB] = b.periodo.split(' ')
          return yA.localeCompare(yB) || mA.localeCompare(mB)
        })
      
      setEvolucionMensual(evolucionArray)

      // 6. Distribución de solicitudes
      const aprobadas = solicitudesData?.filter(s => s.estado === 'aprobado' || s.estado === 'en_curso').length || 0
      const rechazadas = solicitudesData?.filter(s => s.estado === 'rechazado').length || 0
      const pendientes = solicitudesData?.filter(s => s.estado === 'pendiente').length || 0

      setDistribucionSolicitudes([
        { name: 'Aprobadas', value: aprobadas, color: '#10B981' },
        { name: 'Rechazadas', value: rechazadas, color: '#EF4444' },
        { name: 'Pendientes', value: pendientes, color: '#F59E0B' }
      ])

      // 7. Ranking de empleados por incentivos
      const rankingMap = new Map<string, { nombre: string, total: number, cantidad: number }>()
      incentivosData?.forEach(inv => {
        const empId = inv.empleado_id
        const nombre = inv.empleados?.nombre_completo || 'Desconocido'
        const actual = rankingMap.get(empId) || { nombre, total: 0, cantidad: 0 }
        rankingMap.set(empId, {
          nombre,
          total: actual.total + (inv.monto_neto || 0),
          cantidad: actual.cantidad + 1
        })
      })

      const rankingArray = Array.from(rankingMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total)

      setRankingEmpleados(rankingArray)

      // 8. Datos para exportar
      setDatosExportar(incentivosData || [])

    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Resumen
    const resumenData = [
      { 'Métrica': 'Total Empleados Activos', 'Valor': metricas.totalEmpleados },
      { 'Métrica': 'Total Incentivos Pagados', 'Valor': metricas.totalIncentivosPagados },
      { 'Métrica': 'Adelantos Aprobados', 'Valor': metricas.totalAdelantosAprobados },
      { 'Métrica': 'Adelantos Rechazados', 'Valor': metricas.totalAdelantosRechazados },
      { 'Métrica': 'Masa Salarial', 'Valor': metricas.masaSalarial }
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen')

    // Sheet 2: Evolución Mensual
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evolucionMensual), 'Evolución Mensual')

    // Sheet 3: Ranking Empleados
    const rankingData = rankingEmpleados.map((r, idx) => ({
      'Posición': idx + 1,
      'Empleado': r.nombre,
      'Total Incentivos': r.total,
      'Cantidad de Períodos': r.cantidad
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankingData), 'Ranking Empleados')

    // Sheet 4: Detalle Incentivos
    const detalleData = datosExportar.map(d => ({
      'Empleado': d.empleados?.nombre_completo,
      'Período': d.periodo,
      'Bruto': d.monto_bruto,
      'Neto': d.monto_neto
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleData), 'Detalle Incentivos')

    XLSX.writeFile(wb, `Reporte_RRHH_${new Date().toISOString().split('T')[0]}.xlsx`)
    alert('✅ Reporte exportado correctamente')
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando reportes...</p>
      </div>
    )
  }

  const tasaAprobacion = metricas.totalAdelantosAprobados + metricas.totalAdelantosRechazados > 0
    ? Math.round((metricas.totalAdelantosAprobados / (metricas.totalAdelantosAprobados + metricas.totalAdelantosRechazados)) * 100)
    : 0

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reportes y Métricas</h1>
          <p className="text-gray-600">Análisis completo de la gestión de RRHH</p>
        </div>
        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
           Exportar Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'resumen', label: '📊 Resumen', },
          { id: 'incentivos', label: '🎯 Incentivos' },
          { id: 'solicitudes', label: '💰 Solicitudes' },
          { id: 'empleados', label: ' Empleados' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id as any)}
            className={`px-4 py-2 font-medium transition-colors ${
              tabActiva === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB RESUMEN */}
      {tabActiva === 'resumen' && (
        <div className="space-y-6">
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Empleados Activos</p>
              <p className="text-3xl font-bold text-blue-900">{metricas.totalEmpleados}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Incentivos Pagados</p>
              <p className="text-2xl font-bold text-green-900">${metricas.totalIncentivosPagados.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <p className="text-sm text-gray-600">Masa Salarial</p>
              <p className="text-2xl font-bold text-purple-900">${metricas.masaSalarial.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
              <p className="text-sm text-gray-600">Tasa Aprobación</p>
              <p className="text-3xl font-bold text-orange-900">{tasaAprobacion}%</p>
            </div>
          </div>

          {/* Gráfico de evolución */}
          {evolucionMensual.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Evolución Mensual de Incentivos</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucionMensual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR')}`} />
                  <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} name="Total Incentivos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico de torta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Distribución de Solicitudes</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribucionSolicitudes}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {distribucionSolicitudes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Resumen de Adelantos</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                  <span className="text-green-900 font-medium">Aprobados</span>
                  <span className="text-2xl font-bold text-green-900">${metricas.totalAdelantosAprobados.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                  <span className="text-red-900 font-medium">Rechazados</span>
                  <span className="text-2xl font-bold text-red-900">${metricas.totalAdelantosRechazados.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                  <span className="text-yellow-900 font-medium">Pendientes</span>
                  <span className="text-2xl font-bold text-yellow-900">${metricas.totalAdelantosPendientes.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB INCENTIVOS */}
      {tabActiva === 'incentivos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Evolución de Incentivos por Período</h2>
            {evolucionMensual.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay datos de incentivos</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={evolucionMensual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR')}`} />
                  <Legend />
                  <Bar dataKey="total" fill="#10B981" name="Total Incentivos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Detalle de Incentivos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Período</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {evolucionMensual.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{item.periodo}</td>
                      <td className="px-3 py-2 text-right font-bold">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB SOLICITUDES */}
      {tabActiva === 'solicitudes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <p className="text-sm text-green-700">Aprobadas</p>
              <p className="text-3xl font-bold text-green-900">
                {distribucionSolicitudes.find(s => s.name === 'Aprobadas')?.value || 0}
              </p>
              <p className="text-sm text-green-600 mt-2">
                ${metricas.totalAdelantosAprobados.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-sm text-red-700">Rechazadas</p>
              <p className="text-3xl font-bold text-red-900">
                {distribucionSolicitudes.find(s => s.name === 'Rechazadas')?.value || 0}
              </p>
              <p className="text-sm text-red-600 mt-2">
                ${metricas.totalAdelantosRechazados.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-sm text-yellow-700">Pendientes</p>
              <p className="text-3xl font-bold text-yellow-900">
                {distribucionSolicitudes.find(s => s.name === 'Pendientes')?.value || 0}
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                ${metricas.totalAdelantosPendientes.toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Distribución Visual</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribucionSolicitudes}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                >
                  {distribucionSolicitudes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB EMPLEADOS */}
      {tabActiva === 'empleados' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">🏆 Ranking de Empleados por Incentivos</h2>
            {rankingEmpleados.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay datos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Empleado</th>
                      <th className="px-3 py-2 text-right">Total Incentivos</th>
                      <th className="px-3 py-2 text-right">Períodos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingEmpleados.map((emp, idx) => (
                      <tr key={emp.id} className={`border-t ${idx < 3 ? 'bg-yellow-50' : ''}`}>
                        <td className="px-3 py-2 font-bold">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </td>
                        <td className="px-3 py-2 font-medium">{emp.nombre}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">
                          ${emp.total.toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2 text-right">{emp.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Top 5 Empleados - Gráfico</h2>
            {rankingEmpleados.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankingEmpleados.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nombre" width={150} />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR')}`} />
                  <Bar dataKey="total" fill="#8B5CF6" name="Total Incentivos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}