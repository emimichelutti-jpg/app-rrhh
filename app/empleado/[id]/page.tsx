'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LegajoEmpleadoPage() {
  const router = useRouter()
  const params = useParams()
  const empleadoId = params.id as string

  const [empleado, setEmpleado] = useState<any>(null)
  const [zona, setZona] = useState<any>(null)
  const [actividad, setActividad] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (empleadoId) cargarLegajo()
  }, [empleadoId])

  const cargarLegajo = async () => {
    try {
      setLoading(true)

      // 1. Datos del empleado
      const { data: empData, error: empError } = await supabase
        .from('empleados')
        .select('*')
        .eq('id', empleadoId)
        .single()

      if (empError || !empData) {
        console.error('Error cargando empleado:', empError)
        return
      }
      setEmpleado(empData)

      // 2. Datos de la zona (si tiene zona_id)
      if (empData.zona_id) {
        const { data: zonaData } = await supabase
          .from('zonas')
          .select('nombre')
          .eq('id', empData.zona_id)
          .single()
        setZona(zonaData)
      }

      // 3. Actividad reciente (combinada de varias tablas)
      const [recibosRes, cbuRes, adelantosRes] = await Promise.all([
        supabase.from('recibos_sueldo').select('periodo, quincena, estado_firma, created_at').eq('empleado_id', empleadoId).order('created_at', { ascending: false }).limit(3),
        supabase.from('solicitudes_cambio_cbu').select('estado, created_at').eq('empleado_id', empleadoId).order('created_at', { ascending: false }).limit(2),
        supabase.from('solicitudes_sueldo').select('tipo, monto_total, estado, created_at').eq('empleado_id', empleadoId).order('created_at', { ascending: false }).limit(2)
      ])

      const timeline = [
        ...(recibosRes.data || []).map((r: any) => ({ tipo: 'recibo', fecha: r.created_at, detalle: `Recibo ${r.periodo} (${r.quincena}) - ${r.estado_firma}` })),
        ...(cbuRes.data || []).map((c: any) => ({ tipo: 'cbu', fecha: c.created_at, detalle: `Solicitud de cambio de CBU - ${c.estado}` })),
        ...(adelantosRes.data || []).map((a: any) => ({ tipo: 'adelanto', fecha: a.created_at, detalle: `Solicitud de ${a.tipo} por $${Number(a.monto_total).toLocaleString('es-AR')} - ${a.estado}` }))
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

      setActividad(timeline.slice(0, 5))

    } catch (error) {
      console.error('Error cargando legajo:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !empleado) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  const getIniciales = (nombre: string) => {
    return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No especificado'
    return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER DEL LEGAJO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-md">
            {getIniciales(empleado.nombre_completo)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{empleado.nombre_completo}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono font-semibold">Legajo: {empleado.legajo || 'N/A'}</span>
              <span>•</span>
              <span>{zona?.nombre || 'Sin zona asignada'}</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${empleado.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {empleado.activo ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/admin/empleados" 
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
          >
            ← Volver
          </Link>
          <Link 
            href={`/admin/empleados/${empleadoId}/editar`} 
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors flex items-center gap-2"
          >
            ✏️ Editar Legajo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: DATOS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Datos Laborales */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-xl">💼</span> Datos Laborales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo / Puesto</p>
                <p className="text-slate-900 font-medium mt-1">{empleado.cargo || 'No especificado'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha de Ingreso</p>
                <p className="text-slate-900 font-medium mt-1">{formatDate(empleado.fecha_ingreso)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CUIL</p>
                <p className="text-slate-900 font-medium mt-1 font-mono">{empleado.cuil || 'No cargado'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Corporativo</p>
                <p className="text-slate-900 font-medium mt-1">{empleado.email || 'No cargado'}</p>
              </div>
            </div>
          </div>

          {/* Datos Bancarios */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-xl">🏦</span> Datos Bancarios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Banco</p>
                <p className="text-slate-900 font-medium mt-1">{empleado.cuenta_banco || 'No cargado'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CBU</p>
                <p className="text-slate-900 font-medium mt-1 font-mono">{empleado.cbu || 'No cargado'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alias</p>
                <p className="text-slate-900 font-medium mt-1">{empleado.alias_cbu || 'No cargado'}</p>
              </div>
            </div>
            {!empleado.cbu && (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-lg flex items-center gap-2">
                ⚠️ Este empleado no tiene CBU cargado. No podrá recibir transferencias.
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: TIMELINE / ACTIVIDAD */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="text-xl">📜</span> Actividad Reciente
          </h2>
          
          {actividad.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-sm">No hay actividad registrada aún</p>
            </div>
          ) : (
            <div className="space-y-4 relative">
              {/* Línea vertical del timeline */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200"></div>
              
              {actividad.map((item, index) => (
                <div key={index} className="relative pl-10">
                  {/* Punto del timeline */}
                  <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                    item.tipo === 'recibo' ? 'bg-emerald-500' : 
                    item.tipo === 'cbu' ? 'bg-blue-500' : 'bg-amber-500'
                  }`}></div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{item.detalle}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(item.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100">
            <Link 
              href={`/admin/empleados/${empleadoId}/historial`}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1"
            >
              Ver historial completo →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}