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
  const [actividades, setActividades] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalActividades: 0,
    totalIngresos: 0,
    tecnicosActivos: 0
  })
  const [ranking, setRanking] = useState<any[]>([])
  const [porFecha, setPorFecha] = useState<any[]>([])
  
  // Filtros
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtroProvincia, setFiltroProvincia] = useState('todas')
  const [filtroCentro, setFiltroCentro] = useState('todos')
  const [filtroTecnico, setFiltroTecnico] = useState('todos')
  
  // Opciones de filtros
  const [provincias, setProvincias] = useState<string[]>([])
  const [centros, setCentros] = useState<string[]>([])
  const [tecnicos, setTecnicos] = useState<string[]>([])

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    setLoading(true)
    try {
      // ✅ CORRECCIÓN: Traer TODAS las actividades (sin límite de 1000)
      const { data: actividadesData, error } = await supabase
        .from('actividades_diarias')
        .select('*')
        .range(0, 100000) // Traer hasta 100,000 registros
        .order('fecha_actividad', { ascending: false })

      if (error) throw error

      setActividades(actividadesData || [])

      // Extraer valores únicos para filtros
      if (actividadesData && actividadesData.length > 0) {
        const provinciasUnicas = [...new Set(actividadesData.map(a => a.provincia).filter(p => p))]
        const centrosUnicos = [...new Set(actividadesData.map(a => a.centro).filter(c => c))]
        const tecnicosUnicos = [...new Set(actividadesData.map(a => a.tecnico_nombre).filter(t => t))]

        setProvincias(provinciasUnicas.sort())
        setCentros(centrosUnicos.sort())
        setTecnicos(tecnicosUnicos.sort())

        // Establecer fechas por defecto (último mes)
        const hoy = new Date()
        const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate())
        setFechaDesde(haceUnMes.toISOString().split('T')[0])
        setFechaHasta(hoy.toISOString().split('T')[0])
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ CORRECCIÓN: Recalcular todo cuando cambian los filtros
  useEffect(() => {
    if (actividades.length > 0) {
      aplicarFiltros()
    }
  }, [actividades, fechaDesde, fechaHasta, filtroProvincia, filtroCentro, filtroTecnico])

  const aplicarFiltros = () => {
    const actividadesFiltradas = actividades.filter(act => {
      if (fechaDesde && act.fecha_actividad < fechaDesde) return false
      if (fechaHasta && act.fecha_actividad > fechaHasta) return false
      if (filtroProvincia !== 'todas' && act.provincia !== filtroProvincia) return false
      if (filtroCentro !== 'todos' && act.centro !== filtroCentro) return false
      if (filtroTecnico !== 'todos' && act.tecnico_nombre !== filtroTecnico) return false
      return true
    })

    // Calcular estadísticas
    const totalActividades = actividadesFiltradas.length
    const totalIngresos = actividadesFiltradas.reduce((sum, act) => sum + (act.precio || 0), 0)
    const tecnicosUnicos = new Set(actividadesFiltradas.map(a => a.empleado_id)).size

    setStats({
      totalActividades,
      totalIngresos,
      tecnicosActivos: tecnicosUnicos
    })

    // Agrupar por técnico para el ranking
    const groupedByTecnico: Record<string, any> = {}
    actividadesFiltradas.forEach(act => {
      if (!groupedByTecnico[act.empleado_id]) {
        groupedByTecnico[act.empleado_id] = {
          id: act.empleado_id,
          nombre: act.tecnico_nombre,
          provincia: act.provincia,
          servicios: 0,
          ingresos: 0
        }
      }
      groupedByTecnico[act.empleado_id].servicios += 1
      groupedByTecnico[act.empleado_id].ingresos += act.precio
    })

    const rankingData = Object.values(groupedByTecnico)
      .sort((a, b) => b.ingresos - a.ingresos)

    setRanking(rankingData)

    // Agrupar por fecha para la evolución diaria
    const groupedByFecha: Record<string, any> = {}
    actividadesFiltradas.forEach(act => {
      if (!act.fecha_actividad) return
      
      if (!groupedByFecha[act.fecha_actividad]) {
        groupedByFecha[act.fecha_actividad] = {
          fecha: act.fecha_actividad,
          actividades: 0,
          ingresos: 0,
          tecnicos: new Set()
        }
      }
      groupedByFecha[act.fecha_actividad].actividades += 1
      groupedByFecha[act.fecha_actividad].ingresos += act.precio
      groupedByFecha[act.fecha_actividad].tecnicos.add(act.empleado_id)
    })

    const porFechaData = Object.values(groupedByFecha)
      .map(item => ({ ...item, tecnicos: item.tecnicos.size }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    setPorFecha(porFechaData)
  }

  const handleLimpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setFiltroProvincia('todas')
    setFiltroCentro('todos')
    setFiltroTecnico('todos')
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
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

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900"> Filtros de Análisis</h2>
            <button
              onClick={handleLimpiarFiltros}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Provincia</label>
              <select
                value={filtroProvincia}
                onChange={(e) => setFiltroProvincia(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todas">Todas</option>
                {provincias.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Centro</label>
              <select
                value={filtroCentro}
                onChange={(e) => setFiltroCentro(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                {centros.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Técnico</label>
              <select
                value={filtroTecnico}
                onChange={(e) => setFiltroTecnico(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                {tecnicos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {(fechaDesde || fechaHasta || filtroProvincia !== 'todas' || filtroCentro !== 'todos' || filtroTecnico !== 'todos') && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Filtros activos:</strong>{' '}
                {fechaDesde && `Desde ${formatDate(fechaDesde)}`}
                {fechaHasta && ` hasta ${formatDate(fechaHasta)}`}
                {filtroProvincia !== 'todas' && ` • Provincia: ${filtroProvincia}`}
                {filtroCentro !== 'todos' && ` • Centro: ${filtroCentro}`}
                {filtroTecnico !== 'todos' && ` • Técnico: ${filtroTecnico}`}
              </p>
            </div>
          )}
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Actividades</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalActividades.toLocaleString('es-AR')}</p>
            <p className="text-xs text-gray-500 mt-1">en el período seleccionado</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Ingresos Generados</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{formatMoney(stats.totalIngresos)}</p>
            <p className="text-xs text-gray-500 mt-1">total facturado</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Técnicos Activos</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{stats.tecnicosActivos}</p>
            <p className="text-xs text-gray-500 mt-1">con actividad registrada</p>
          </div>
        </div>

        {/* Evolución Diaria - AHORA CON SCROLL */}
        {porFecha.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">📅 Evolución Diaria</h2>
              <p className="text-sm text-gray-500 mt-1">Actividades e ingresos por día ({porFecha.length} días)</p>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actividades</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Técnicos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Promedio por Técnico</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {porFecha.map((dia) => (
                    <tr key={dia.fecha} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(dia.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {dia.actividades}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {dia.tecnicos}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium text-green-700">
                        {formatMoney(dia.ingresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                        {formatMoney(dia.ingresos / dia.tecnicos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ranking de Técnicos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">🏆 Ranking de Productividad</h2>
            <p className="text-sm text-gray-500 mt-1">Ordenado por ingresos generados en el período</p>
          </div>

          {ranking.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No hay datos para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Técnico</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provincia</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Servicios</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Promedio/Servicio</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tecnico.provincia}
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

        {/* Importar */}
        <ImportarProductividadDiaria onImportSuccess={cargarDatosIniciales} />
      </div>
    </div>
  )
}