'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ImportarProductividadDiaria from '@/components/ImportarProductividadDiaria'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TecnicoStats {
  id: string
  nombre: string
  servicios: number
  ingresos: number
}

export default function ProductividadPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalActividades: 0,
    totalIngresos: 0,
    tecnicosActivos: 0
  })
  const [ranking, setRanking] = useState<TecnicoStats[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
      
      // 1. Obtener todas las actividades del mes
      const { data: actividades, error } = await supabase
        .from('actividades_diarias')
        .select('empleado_id, precio, fecha_actividad')
        .gte('fecha_actividad', primerDiaMes)

      if (error) throw error

      // 2. Calcular totales para las tarjetas
      const totalIngresos = actividades.reduce((sum: number, item: any) => sum + (item.precio || 0), 0)
      const tecnicosUnicos = new Set(actividades.map((item: any) => item.empleado_id)).size
      
      setStats({
        totalActividades: actividades.length,
        totalIngresos,
        tecnicosActivos: tecnicosUnicos
      })

      // 3. Agrupar datos por técnico para la tabla
      const grouped: Record<string, { servicios: number; ingresos: number }> = {}
      actividades.forEach((act: any) => {
        if (!grouped[act.empleado_id]) {
          grouped[act.empleado_id] = { servicios: 0, ingresos: 0 }
        }
        grouped[act.empleado_id].servicios += 1
        grouped[act.empleado_id].ingresos += act.precio
      })

      // 4. Obtener nombres de los empleados
      const empleadoIds = Object.keys(grouped)
      if (empleadoIds.length > 0) {
        const { data: empleados } = await supabase
          .from('empleados')
          .select('id, nombre_completo')
          .in('id', empleadoIds)

        const empleadosMap = new Map(empleados?.map(e => [e.id, e.nombre_completo]) || [])

        // 5. Armar el ranking ordenado por ingresos
        const tablaDatos: TecnicoStats[] = Object.entries(grouped)
          .map(([id, data]) => ({
            id,
            nombre: empleadosMap.get(id) || 'Técnico no identificado',
            servicios: data.servicios,
            ingresos: data.ingresos
          }))
          .sort((a, b) => b.ingresos - a.ingresos) // Ordenar de mayor a menor ingreso

        setRanking(tablaDatos)
      } else {
        setRanking([])
      }

    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📈 Productividad & ROI Real</h1>
          <p className="text-gray-600 mt-1">
            Analizá el rendimiento real de los técnicos basado en las actividades diarias importadas.
          </p>
        </div>

        {/* Estadísticas Rápidas del Mes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Actividades este mes</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalActividades}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Ingresos Generados</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{formatMoney(stats.totalIngresos)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Técnicos con Actividad</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{stats.tecnicosActivos}</p>
          </div>
        </div>

        {/* Módulo de Importación */}
        <ImportarProductividadDiaria onImportSuccess={cargarDatos} />

        {/* Tabla de Ranking de Productividad */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">🏆 Ranking de Productividad (Mes Actual)</h2>
              <p className="text-sm text-gray-500 mt-1">Ordenado por ingresos generados</p>
            </div>
          </div>

          {ranking.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No hay datos de productividad para este mes.</p>
              <p className="text-sm mt-2">Importá un archivo Excel diario para comenzar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Técnico</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Servicios</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos Generados</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Promedio por Servicio</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ranking.map((tecnico, index) => (
                    <tr key={tecnico.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tecnico.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {tecnico.servicios}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium text-green-700">
                        {formatMoney(tecnico.ingresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                        {formatMoney(tecnico.ingresos / tecnico.servicios)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}