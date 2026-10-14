'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ImportarProductividadDiaria from '@/components/ImportarProductividadDiaria'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProductividadPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalActividades: 0,
    totalIngresos: 0,
    tecnicosActivos: 0
  })

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  const cargarEstadisticas = async () => {
    setLoading(true)
    try {
      // Obtener total de actividades e ingresos del mes actual
      const hoy = new Date()
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('actividades_diarias')
        .select('precio, empleado_id')
        .gte('fecha_actividad', primerDiaMes)

      if (!error && data) {
        const totalIngresos = data.reduce((sum: number, item: any) => sum + (item.precio || 0), 0)
        const tecnicosUnicos = new Set(data.map((item: any) => item.empleado_id)).size
        
        setStats({
          totalActividades: data.length,
          totalIngresos,
          tecnicosActivos: tecnicosUnicos
        })
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
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
        <ImportarProductividadDiaria onImportSuccess={cargarEstadisticas} />

        {/* Placeholder para el Dashboard de ROI (Fase 4) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Dashboard de ROI por Técnico</h2>
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-lg font-medium">Próximamente: Gráficos y tablas comparativas</p>
            <p className="text-sm mt-2">Una vez que importes las actividades, aquí verás el ROI, margen y productividad de cada técnico.</p>
          </div>
        </div>
      </div>
    </div>
  )
}