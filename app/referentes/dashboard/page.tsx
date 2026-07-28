'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ReferenteDashboardPage() {
  const [referente, setReferente] = useState<any>(null)
  const [zona, setZona] = useState<any>(null)
  const [empleados, setEmpleados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, conRecibos: 0, pendientes: 0 })

  useEffect(() => {
    cargarDatosReferente()
  }, [])

  const cargarDatosReferente = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const empleadoData = localStorage.getItem('empleado_data')
      if (!empleadoData) {
        setError('No hay sesión activa. Por favor, iniciá sesión nuevamente.')
        setLoading(false)
        return
      }
      
      const empleado = JSON.parse(empleadoData)
      setReferente(empleado)

      // PASO 1: Obtener solo el zona_id del referente
      const { data: refData, error: errorRef } = await supabase
        .from('referentes_zona')
        .select('zona_id')
        .eq('empleado_id', empleado.id)
        .eq('activo', true)
        .single()

      if (errorRef || !refData) {
        console.error('Error buscando zona:', errorRef)
        setError('No tenés una zona asignada como referente. Contactá a RRHH.')
        setLoading(false)
        return
      }

      const zonaId = refData.zona_id

      // PASO 2: Obtener los datos de la zona
      const { data: zonaData } = await supabase
        .from('zonas')
        .select('id, nombre, descripcion')
        .eq('id', zonaId)
        .single()

      setZona(zonaData)

      // PASO 3: Obtener empleados activos de esa zona
      const { data: empleadosData, error: errorEmpleados } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cuil, legajo, zona_id')
        .eq('zona_id', zonaId)
        .eq('activo', true)
        .order('nombre_completo', { ascending: true })

      if (errorEmpleados) {
        console.error('Error buscando empleados:', errorEmpleados)
      }

      setEmpleados(empleadosData || [])

      // PASO 4: Estadísticas de recibos
      const empleadoIds = (empleadosData || []).map((e: any) => e.id)
      if (empleadoIds.length > 0) {
        const { data: recibosData } = await supabase
          .from('recibos_sueldo')
          .select('estado')
          .in('empleado_id', empleadoIds)

        const conRecibos = recibosData?.filter((r: any) => r.estado === 'firmado').length || 0
        const pendientes = recibosData?.filter((r: any) => r.estado === 'pendiente').length || 0

        setStats({
          total: empleadosData?.length || 0,
          conRecibos,
          pendientes
        })
      }
    } catch (error: any) {
      console.error('❌ Error general:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-600">Cargando datos de tu zona...</div>
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <h3 className="font-bold text-rose-900 mb-2">⚠️ Error</h3>
          <p className="text-rose-800">{error}</p>
          <button 
            onClick={cargarDatosReferente}
            className="mt-3 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard de Zona</h1>
        <p className="text-slate-600">
          Bienvenido <span className="font-semibold text-slate-900">{referente?.nombre_completo}</span>
        </p>
        <p className="text-slate-600">
          Zona a cargo: <span className="font-bold text-slate-900">{zona?.nombre || 'Cargando...'}</span>
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-slate-600">
          <div className="flex items-center">
            <span className="text-3xl mr-3">👥</span>
            <div>
              <p className="text-slate-600 text-sm">Total Empleados</p>
              <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
          <div className="flex items-center">
            <span className="text-3xl mr-3">✅</span>
            <div>
              <p className="text-slate-600 text-sm">Recibos Firmados</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.conRecibos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
          <div className="flex items-center">
            <span className="text-3xl mr-3">⏳</span>
            <div>
              <p className="text-slate-600 text-sm">Pendientes de Firma</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pendientes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de empleados */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">
            Empleados de {zona?.nombre || 'tu zona'}
          </h2>
          <p className="text-sm text-slate-600">
            {empleados.length} empleado(s) activo(s) en tu zona
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">CUIL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Legajo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empleados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No hay empleados activos en esta zona
                  </td>
                </tr>
              ) : (
                empleados.map(empleado => (
                  <tr key={empleado.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{empleado.nombre_completo}</td>
                    <td className="px-4 py-3 text-slate-600">{empleado.cuil}</td>
                    <td className="px-4 py-3 text-slate-600">{empleado.legajo || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800">
                        Activo
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}