'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import ImportarProductividadDiaria from '@/components/ImportarProductividadDiaria'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Actividad {
  id: string
  empleado_id: string
  tecnico_nombre: string
  precio: number
  fecha_actividad: string | null
  provincia: string
  centro: string
}

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function ProductividadPage() {
  const [loading, setLoading] = useState(true)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtroProvincia, setFiltroProvincia] = useState('todas')
  const [filtroCentro, setFiltroCentro] = useState('todos')
  const [filtroTecnico, setFiltroTecnico] = useState('todos')

  useEffect(() => {
    cargarTodo()
  }, [])

  // ✅ TRAE TODAS LAS FILAS: Supabase entrega MÁXIMO 1.000 filas por request,
  // por eso paginamos de a 1.000 hasta que venga un chunk incompleto.
  const cargarTodo = async () => {
    setLoading(true)
    try {
      let todas: Actividad[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('actividades_diarias')
          .select('id, empleado_id, tecnico_nombre, precio, fecha_actividad, provincia, centro')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        todas = todas.concat(data)
        if (data.length < pageSize) break
        from += pageSize
      }
      console.log('📊 Actividades cargadas en total:', todas.length)
      setActividades(todas)
    } catch (error) {
      console.error('Error cargando actividades:', error)
    } finally {
      setLoading(false)
    }
  }

  const provincias = useMemo(
    () => Array.from(new Set(actividades.map(a => a.provincia).filter(Boolean))).sort(),
    [actividades]
  )
  const centros = useMemo(
    () => Array.from(new Set(actividades.map(a => a.centro).filter(Boolean))).sort(),
    [actividades]
  )
  const tecnicos = useMemo(
    () => Array.from(new Set(actividades.map(a => a.tecnico_nombre).filter(Boolean))).sort(),
    [actividades]
  )

  const filtradas = useMemo(() => {
    return actividades.filter(a => {
      const f = a.fecha_actividad || ''
      if (fechaDesde && f < fechaDesde) return false
      if (fechaHasta && f > fechaHasta) return false
      if (filtroProvincia !== 'todas' && a.provincia !== filtroProvincia) return false
      if (filtroCentro !== 'todos' && a.centro !== filtroCentro) return false
      if (filtroTecnico !== 'todos' && a.tecnico_nombre !== filtroTecnico) return false
      return true
    })
  }, [actividades, fechaDesde, fechaHasta, filtroProvincia, filtroCentro, filtroTecnico])

  const totalIngresos = useMemo(
    () => filtradas.reduce((sum, a) => sum + (a.precio || 0), 0),
    [filtradas]
  )
  const tecnicosUnicos = useMemo(
    () => new Set(filtradas.map(a => a.empleado_id)).size,
    [filtradas]
  )
  const diasUnicos = useMemo(
    () => new Set(filtradas.map(a => a.fecha_actividad).filter(Boolean)).size,
    [filtradas]
  )

  const porFecha = useMemo(() => {
    const map: Record<string, { actividades: number; ingresos: number; tecnicos: Set<string> }> = {}
    filtradas.forEach(a => {
      const f = a.fecha_actividad || 'Sin fecha'
      if (!map[f]) map[f] = { actividades: 0, ingresos: 0, tecnicos: new Set() }
      map[f].actividades += 1
      map[f].ingresos += a.precio || 0
      map[f].tecnicos.add(a.empleado_id)
    })
    return Object.entries(map)
      .map(([fecha, d]) => ({ fecha, actividades: d.actividades, ingresos: d.ingresos, tecnicos: d.tecnicos.size }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [filtradas])

  const ranking = useMemo(() => {
    const map: Record<string, { nombre: string; provincia: string; servicios: number; ingresos: number }> = {}
    filtradas.forEach(a => {
      if (!map[a.empleado_id]) {
        map[a.empleado_id] = {
          nombre: a.tecnico_nombre || 'Sin nombre',
          provincia: a.provincia || '-',
          servicios: 0,
          ingresos: 0
        }
      }
      map[a.empleado_id].servicios += 1
      map[a.empleado_id].ingresos += a.precio || 0
    })
    return Object.values(map).sort((x, y) => y.ingresos - x.ingresos)
  }, [filtradas])

  const aplicarPreset = (preset: 'todo' | '7d' | '30d' | 'mes') => {
    const hoy = new Date()
    if (preset === 'todo') {
      setFechaDesde('')
      setFechaHasta('')
      return
    }
    if (preset === 'mes') {
      setFechaDesde(isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
      setFechaHasta(isoLocal(hoy))
      return
    }
    const d = new Date(hoy)
    d.setDate(d.getDate() - (preset === '7d' ? 7 : 30))
    setFechaDesde(isoLocal(d))
    setFechaHasta(isoLocal(hoy))
  }

  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setFiltroProvincia('todas')
    setFiltroCentro('todos')
    setFiltroTecnico('todos')
  }

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)

  const formatDate = (f: string) => {
    if (!f || f === 'Sin fecha') return f
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
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
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">🎛️ Filtros de Análisis</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => aplicarPreset('todo')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Todo el período</button>
              <button onClick={() => aplicarPreset('7d')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Últimos 7 días</button>
              <button onClick={() => aplicarPreset('30d')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Últimos 30 días</button>
              <button onClick={() => aplicarPreset('mes')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Mes en curso</button>
              <button onClick={limpiarFiltros} className="px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 hover:bg-blue-50">Limpiar todo</button>
            </div>
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

          <p className="mt-4 text-sm text-gray-500">
            Mostrando <strong>{filtradas.length.toLocaleString('es-AR')}</strong> de{' '}
            <strong>{actividades.length.toLocaleString('es-AR')}</strong> actividades cargadas en la base.
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Actividades</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{filtradas.length.toLocaleString('es-AR')}</p>
            <p className="text-xs text-gray-500 mt-1">en el período seleccionado</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Ingresos Generados</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{formatMoney(totalIngresos)}</p>
            <p className="text-xs text-gray-500 mt-1">total facturado</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Técnicos Activos</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{tecnicosUnicos}</p>
            <p className="text-xs text-gray-500 mt-1">con actividad registrada</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase">Días con Actividad</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{diasUnicos}</p>
            <p className="text-xs text-gray-500 mt-1">jornadas trabajadas</p>
          </div>
        </div>

        {/* Evolución Diaria */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">📅 Evolución Diaria</h2>
            <p className="text-sm text-gray-500 mt-1">
              Actividades e ingresos por día ({porFecha.length} días) — usá la barra de scroll para recorrer todo
            </p>
          </div>
          {porFecha.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No hay datos para los filtros seleccionados.</p>
            </div>
          ) : (
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
                  {porFecha.map(dia => (
                    <tr key={dia.fecha} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(dia.fecha)}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{dia.actividades}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{dia.tecnicos}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono font-medium text-green-700">{formatMoney(dia.ingresos)}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                        {formatMoney(dia.ingresos / dia.tecnicos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="px-6 py-3 text-sm text-gray-900">TOTAL</td>
                    <td className="px-6 py-3 text-sm text-center text-gray-900">{filtradas.length.toLocaleString('es-AR')}</td>
                    <td className="px-6 py-3 text-sm text-center text-gray-500">—</td>
                    <td className="px-6 py-3 text-sm text-right font-mono text-green-700">{formatMoney(totalIngresos)}</td>
                    <td className="px-6 py-3 text-sm text-right font-mono text-gray-600">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Ranking de Técnicos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">🏆 Ranking de Productividad</h2>
            <p className="text-sm text-gray-500 mt-1">
              Ordenado por ingresos generados en el período ({ranking.length} técnicos)
            </p>
          </div>
          {ranking.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No hay datos para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
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
                  {ranking.map((t, i) => (
                    <tr key={t.nombre + '-' + i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{t.nombre}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{t.provincia}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{t.servicios}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono font-medium text-green-700">{formatMoney(t.ingresos)}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                        {formatMoney(t.ingresos / t.servicios)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Importar */}
        <ImportarProductividadDiaria onImportSuccess={cargarTodo} />
      </div>
    </div>
  )
}