'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [metricas, setMetricas] = useState<any>(null)
  const [empleadosMorosos, setEmpleadosMorosos] = useState<any[]>([])
  const [firmasPorPeriodo, setFirmasPorPeriodo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      // 1. Métricas generales
      const { data: metricasData } = await supabase
        .from('empleados')
        .select('id, activo')

      const { data: recibosData } = await supabase
        .from('recibos_sueldo')
        .select('id, estado, created_at, periodo, empleado_id')

      const totalEmpleados = metricasData?.length || 0
      const empleadosActivos = metricasData?.filter(e => e.activo).length || 0
      const totalRecibos = recibosData?.length || 0
      const recibosFirmados = recibosData?.filter(r => r.estado === 'firmado').length || 0
      const recibosPendientes = recibosData?.filter(r => r.estado === 'pendiente').length || 0
      
      // Empleados morosos (pendientes > 3 días)
      const ahora = new Date()
      const empleadosMorosos = recibosData?.filter(r => {
        if (r.estado !== 'pendiente') return false
        const fechaCreacion = new Date(r.created_at)
        const diasTranscurridos = (ahora.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)
        return diasTranscurridos > 3
      }).length || 0

      setMetricas({
        totalEmpleados,
        empleadosActivos,
        totalRecibos,
        recibosFirmados,
        recibosPendientes,
        empleadosMorosos,
        porcentajeFirmas: totalRecibos > 0 ? ((recibosFirmados / totalRecibos) * 100).toFixed(1) : 0
      })

      // 2. Firmas por período
      const firmasPorPeriodoMap = new Map()
      recibosData?.forEach(r => {
        const periodo = r.periodo
        if (!firmasPorPeriodoMap.has(periodo)) {
          firmasPorPeriodoMap.set(periodo, { periodo, firmados: 0, pendientes: 0 })
        }
        const item = firmasPorPeriodoMap.get(periodo)
        if (r.estado === 'firmado') {
          item.firmados++
        } else {
          item.pendientes++
        }
      })
      setFirmasPorPeriodo(Array.from(firmasPorPeriodoMap.values()).sort((a, b) => a.periodo.localeCompare(b.periodo)))

      // 3. Lista de empleados morosos
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cuil')

      const empleadosMorososList = recibosData
        ?.filter(r => {
          if (r.estado !== 'pendiente') return false
          const fechaCreacion = new Date(r.created_at)
          const diasTranscurridos = (ahora.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)
          return diasTranscurridos > 3
        })
        .map(r => {
          const empleado = empleadosData?.find(e => e.id === r.empleado_id)
          return {
            id: r.id,
            nombre: empleado?.nombre_completo || 'Desconocido',
            cuil: empleado?.cuil || '',
            periodo: r.periodo
          }
        })
        .slice(0, 10) || []

      setEmpleadosMorosos(empleadosMorososList)

    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  const COLORS = ['#10B981', '#F59E0B', '#EF4444']

  const dataPie = [
    { name: 'Firmados', value: metricas?.recibosFirmados || 0 },
    { name: 'Pendientes', value: metricas?.recibosPendientes || 0 }
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
        <p className="text-gray-600 mt-1">Resumen del estado de firmas y empleados</p>
      </div>

      {/* Alerta crítica */}
      {metricas && metricas.porcentajeFirmas < 50 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Alerta: Bajo porcentaje de firmas</h3>
              <p className="text-sm text-red-700 mt-1">
                Solo el {metricas.porcentajeFirmas}% de los recibos están firmados. 
                {metricas.empleadosMorosos} empleados tienen recibos pendientes de más de 3 días.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Empleados</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metricas?.totalEmpleados}</p>
              <p className="text-xs text-gray-500 mt-1">{metricas?.empleadosActivos} activos</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Recibos Firmados</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metricas?.recibosFirmados}</p>
              <p className="text-xs text-gray-500 mt-1">de {metricas?.totalRecibos} total</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Recibos Pendientes</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metricas?.recibosPendientes}</p>
              <p className="text-xs text-gray-500 mt-1">{metricas?.porcentajeFirmas}% completado</p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Empleados Morosos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metricas?.empleadosMorosos}</p>
              <p className="text-xs text-gray-500 mt-1">más de 3 días</p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico de barras: Firmas por período */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Firmas por Período</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={firmasPorPeriodo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="firmados" fill="#10B981" name="Firmados" />
              <Bar dataKey="pendientes" fill="#F59E0B" name="Pendientes" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de torta: Estado general */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Estado General de Recibos</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dataPie}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {dataPie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de empleados morosos */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Empleados con Recibos Pendientes (más de 3 días)
        </h2>
        {empleadosMorosos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay empleados morosos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empleado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CUIL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {empleadosMorosos.map((empleado) => (
                  <tr key={empleado.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {empleado.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {empleado.cuil}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {empleado.periodo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        Enviar recordatorio
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}