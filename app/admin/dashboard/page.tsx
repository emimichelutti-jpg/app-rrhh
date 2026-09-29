'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    empleadosActivos: 0,
    recibosPendientes: 0,
    cbuPendientes: 0,
    adelantosPendientes: 0
  })
  const [actividadReciente, setActividadReciente] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDashboard()
  }, [])

  const cargarDashboard = async () => {
    try {
      setLoading(true)

      // 1. Conteo de Empleados Activos
      const { count: empleadosActivos } = await supabase
        .from('empleados')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      // 2. Conteo de Recibos Pendientes de Firma
      const { count: recibosPendientes } = await supabase
        .from('recibos_sueldo')
        .select('*', { count: 'exact', head: true })
        .eq('estado_firma', 'pendiente')

      // 3. Conteo de Solicitudes de CBU Pendientes
      const { count: cbuPendientes } = await supabase
        .from('solicitudes_cambio_cbu')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente')

      // 4. Conteo de Adelantos/Préstamos Pendientes
      const { count: adelantosPendientes } = await supabase
        .from('solicitudes_sueldo')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente')

      setMetrics({
        empleadosActivos: empleadosActivos || 0,
        recibosPendientes: recibosPendientes || 0,
        cbuPendientes: cbuPendientes || 0,
        adelantosPendientes: adelantosPendientes || 0
      })

      // 5. Actividad Reciente (Últimas 5 solicitudes de CBU o Adelantos pendientes)
      const { data: cbuRecientes } = await supabase
        .from('solicitudes_cambio_cbu')
        .select('id, empleado_id, cbu_nuevo, banco_nuevo, created_at, empleados(nombre_completo)')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: adelantosRecientes } = await supabase
        .from('solicitudes_sueldo')
        .select('id, empleado_id, monto_total, motivo, created_at, empleados(nombre_completo)')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(5)

      // Combinar y ordenar por fecha
      const combinado = [
        ...(cbuRecientes || []).map((item: any) => ({ ...item, tipo: 'cbu' })),
        ...(adelantosRecientes || []).map((item: any) => ({ ...item, tipo: 'adelanto' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setActividadReciente(combinado.slice(0, 5))

    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel de Control RRHH</h1>
          <p className="text-slate-600 mt-1">
            Resumen de actividad y tareas pendientes · {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/empleados/nuevo" className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium">
            <span>+</span> Nuevo Empleado
          </Link>
          <Link href="/admin/cargar-recibos" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium shadow-sm">
            <span>📄</span> Cargar Recibos
          </Link>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Empleados */}
        <Link href="/admin/empleados" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Empleados Activos</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metrics.empleadosActivos}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl group-hover:bg-slate-200 transition-colors">
              👥
            </div>
          </div>
        </Link>

        {/* Recibos Pendientes */}
        <Link href="/admin/recibos" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative overflow-hidden">
          {metrics.recibosPendientes > 0 && (
            <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
              ACCIÓN REQUERIDA
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Recibos por Firmar</p>
              <p className={`text-3xl font-bold mt-1 ${metrics.recibosPendientes > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {metrics.recibosPendientes}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-2xl group-hover:bg-amber-100 transition-colors">
              📝
            </div>
          </div>
        </Link>

        {/* CBU Pendientes */}
        <Link href="/admin/cbu" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative overflow-hidden">
          {metrics.cbuPendientes > 0 && (
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
              NUEVO
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Cambios de CBU</p>
              <p className={`text-3xl font-bold mt-1 ${metrics.cbuPendientes > 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                {metrics.cbuPendientes}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl group-hover:bg-blue-100 transition-colors">
              🏦
            </div>
          </div>
        </Link>

        {/* Adelantos Pendientes */}
        <Link href="/admin/adelantos" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative overflow-hidden">
          {metrics.adelantosPendientes > 0 && (
            <div className="absolute top-0 right-0 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
              REVISAR
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Solicitudes de Adelanto</p>
              <p className={`text-3xl font-bold mt-1 ${metrics.adelantosPendientes > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {metrics.adelantosPendientes}
              </p>
            </div>
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-2xl group-hover:bg-rose-100 transition-colors">
              💰
            </div>
          </div>
        </Link>
      </div>

      {/* SECCIÓN INFERIOR: ACCESO RÁPIDO Y ACTIVIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Accesos Directos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Accesos Rápidos</h2>
          <div className="space-y-3">
            <Link href="/admin/cargar-recibos" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
              <span className="text-2xl">📤</span>
              <div>
                <p className="font-semibold text-slate-900">Cargar Lote de Recibos</p>
                <p className="text-xs text-slate-500">Procesar PDFs y generar notificaciones</p>
              </div>
            </Link>
            <Link href="/admin/empleados" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
              <span className="text-2xl">👤</span>
              <div>
                <p className="font-semibold text-slate-900">Gestión de Empleados</p>
                <p className="text-xs text-slate-500">Altas, bajas y modificaciones de datos</p>
              </div>
            </Link>
            <Link href="/admin/reportes" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-semibold text-slate-900">Reportes y Estadísticas</p>
                <p className="text-xs text-slate-500">Exportar datos de nómina</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Actividad Reciente Pendiente */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Tareas Pendientes Recientes</h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Últimas 5</span>
          </div>

          {actividadReciente.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <span className="text-4xl mb-2 block">🎉</span>
              <p className="text-slate-600 font-medium">¡Todo al día!</p>
              <p className="text-sm text-slate-500">No hay solicitudes pendientes de aprobación.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actividadReciente.map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                    item.tipo === 'cbu' ? 'bg-blue-100' : 'bg-rose-100'
                  }`}>
                    {item.tipo === 'cbu' ? '🏦' : '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {item.empleados?.nombre_completo || 'Empleado desconocido'}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {item.tipo === 'cbu' 
                        ? `Solicitó cambiar CBU a ${item.banco_nuevo}` 
                        : `Solicitó adelanto de $${Number(item.monto_total).toLocaleString('es-AR')}`
                      }
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(item.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Link 
                    href={item.tipo === 'cbu' ? '/admin/cbu' : '/admin/adelantos'}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap self-center"
                  >
                    Revisar →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}