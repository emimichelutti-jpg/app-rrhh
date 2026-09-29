'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Empleado {
  id: string
  nombre_completo: string
  legajo: string | null
  cuil: string | null
  zona_id: string | null
  cargo: string | null
  fecha_ingreso: string | null
  activo: boolean
  email?: string
}

interface Zona {
  id: string
  nombre: string
}

export default function GestionEmpleadosPage() {
  const router = useRouter()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroZona, setFiltroZona] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina] = useState(15)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre_completo', { ascending: true })

      const { data: zonasData } = await supabase
        .from('zonas')
        .select('id, nombre')
        .order('nombre')

      setEmpleados(empleadosData || [])
      setZonas(zonasData || [])
    } catch (error) {
      console.error('Error cargando:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar empleados
  const empleadosFiltrados = empleados.filter(emp => {
    const coincideBusqueda = 
      emp.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      emp.legajo?.includes(busqueda) ||
      emp.cuil?.includes(busqueda)
    
    const coincideZona = !filtroZona || emp.zona_id === filtroZona
    const coincideEstado = 
      !filtroEstado || 
      (filtroEstado === 'activo' && emp.activo) ||
      (filtroEstado === 'inactivo' && !emp.activo)

    return coincideBusqueda && coincideZona && coincideEstado
  })

  // Paginación
  const totalPaginas = Math.ceil(empleadosFiltrados.length / porPagina)
  const empleadosPagina = empleadosFiltrados.slice(
    (pagina - 1) * porPagina,
    pagina * porPagina
  )

  // Stats
  const totalEmpleados = empleados.length
  const activos = empleados.filter(e => e.activo).length
  const inactivos = totalEmpleados - activos

  // Obtener nombre de zona
  const getZonaNombre = (zonaId: string | null) => {
    return zonas.find(z => z.id === zonaId)?.nombre || 'Sin zona'
  }

  // Obtener iniciales para avatar
  const getIniciales = (nombre: string) => {
    return nombre
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  // Color de avatar según zona
  const getAvatarColor = (zonaId: string | null) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 
      'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'
    ]
    const index = zonas.findIndex(z => z.id === zonaId)
    return colors[index % colors.length] || 'bg-slate-500'
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
        <p className="mt-4 text-slate-600">Cargando empleados...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Empleados</h1>
          <p className="text-slate-600 mt-1">
            {activos} activos · {inactivos} inactivos · {totalEmpleados} total
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/empleados/nuevo')}
          className="bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 flex items-center gap-2 font-medium"
        >
          <span className="text-xl">+</span>
          Nuevo Empleado
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Empleados</p>
              <p className="text-2xl font-bold text-slate-900">{totalEmpleados}</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Activos</p>
              <p className="text-2xl font-bold text-emerald-600">{activos}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Inactivos</p>
              <p className="text-2xl font-bold text-slate-400">{inactivos}</p>
            </div>
            <div className="text-3xl">⏸️</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Zonas</p>
              <p className="text-2xl font-bold text-slate-900">{zonas.length}</p>
            </div>
            <div className="text-3xl">📍</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <input
              type="text"
              placeholder=" Buscar por nombre, legajo o CUIL..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filtroZona}
            onChange={(e) => { setFiltroZona(e.target.value); setPagina(1) }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          >
            <option value="">Todas las zonas</option>
            {zonas.map(zona => (
              <option key={zona.id} value={zona.id}>{zona.nombre}</option>
            ))}
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1) }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>

          {(busqueda || filtroZona || filtroEstado) && (
            <button
              onClick={() => { setBusqueda(''); setFiltroZona(''); setFiltroEstado('') }}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Empleado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Legajo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Zona
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Ingreso
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empleadosPagina.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${getAvatarColor(emp.zona_id)} flex items-center justify-center text-white font-semibold text-sm`}>
                        {getIniciales(emp.nombre_completo)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{emp.nombre_completo}</div>
                        <div className="text-xs text-slate-500">CUIL: {emp.cuil || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-slate-700">
                      {emp.legajo || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {getZonaNombre(emp.zona_id)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {emp.cargo || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {emp.fecha_ingreso 
                      ? new Date(emp.fecha_ingreso).toLocaleDateString('es-AR')
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.activo 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/admin/empleados/${emp.id}`)}
                        className="text-slate-600 hover:text-slate-900 p-1"
                        title="Ver detalles"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => router.push(`/admin/empleados/${emp.id}/editar`)}
                        className="text-slate-600 hover:text-blue-600 p-1"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => router.push(`/admin/recibos?empleado=${emp.id}`)}
                        className="text-slate-600 hover:text-emerald-600 p-1"
                        title="Ver recibos"
                      >
                        📄
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {empleadosPagina.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron empleados con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Mostrando {(pagina - 1) * porPagina + 1} a {Math.min(pagina * porPagina, empleadosFiltrados.length)} de {empleadosFiltrados.length} empleados
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}