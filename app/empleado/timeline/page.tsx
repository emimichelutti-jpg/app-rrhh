'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Tipos de eventos en el timeline
type EventType = 'recibo' | 'vacaciones' | 'licencia' | 'adelanto' | 'art' | 'capacitacion'

interface TimelineEvent {
  id: string
  tipo: EventType
  fecha: string
  titulo: string
  descripcion: string
  estado: 'completado' | 'pendiente' | 'aprobado' | 'rechazado' | 'en_curso'
  icono: string
  color: string
}

export default function TimelinePage() {
  const router = useRouter()
  const [empleado, setEmpleado] = useState<any>(null)
  const [eventos, setEventos] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarTimeline(emp.id)
    }
  }, [])

  const cargarTimeline = async (empleadoId: string) => {
    try {
      setLoading(true)
      const todosEventos: TimelineEvent[] = []

      // 1. Recibos de sueldo
      const { data: recibos } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })

      if (recibos) {
        recibos.forEach(r => {
          todosEventos.push({
            id: r.id,
            tipo: 'recibo',
            fecha: `${r.periodo}-01`, // Usamos el primer día del período
            titulo: `Recibo de Sueldo - ${r.quincena} Quincena`,
            descripcion: `Período: ${r.periodo} | Neto: $${r.neto_a_cobrar?.toLocaleString('es-AR') || 0}`,
            estado: r.estado === 'firmado' ? 'completado' : 'pendiente',
            icono: '📄',
            color: r.estado === 'firmado' ? 'emerald' : 'amber'
          })
        })
      }

      // 2. Adelantos/Préstamos
      const { data: adelantos } = await supabase
        .from('solicitudes_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('fecha_solicitud', { ascending: false })

      if (adelantos) {
        adelantos.forEach(a => {
          todosEventos.push({
            id: a.id,
            tipo: 'adelanto',
            fecha: a.fecha_solicitud,
            titulo: `${a.tipo === 'adelanto' ? 'Adelanto' : 'Préstamo'} - $${a.monto_total?.toLocaleString('es-AR')}`,
            descripcion: `Estado: ${a.estado} | Cuotas: ${a.cantidad_cuotas || 1}`,
            estado: a.estado === 'aprobado' ? 'aprobado' : a.estado === 'en_curso' ? 'en_curso' : 'pendiente',
            icono: '💰',
            color: a.estado === 'aprobado' ? 'emerald' : a.estado === 'en_curso' ? 'blue' : 'amber'
          })
        })
      }

      // 3. Vacaciones (si existe la tabla)
      const { data: vacaciones } = await supabase
        .from('vacaciones')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('fecha_solicitud', { ascending: false })
        .maybeSingle()

      if (vacaciones) {
        const vacArray = Array.isArray(vacaciones) ? vacaciones : [vacaciones]
        vacArray.forEach(v => {
          todosEventos.push({
            id: v.id,
            tipo: 'vacaciones',
            fecha: v.fecha_solicitud || v.created_at,
            titulo: 'Solicitud de Vacaciones',
            descripcion: `Desde: ${v.fecha_inicio || 'N/A'} | Hasta: ${v.fecha_fin || 'N/A'}`,
            estado: v.estado === 'aprobado' ? 'aprobado' : v.estado || 'pendiente',
            icono: '🏖️',
            color: v.estado === 'aprobado' ? 'emerald' : v.estado === 'rechazado' ? 'rose' : 'amber'
          })
        })
      }

      // Ordenar por fecha (más reciente primero)
      todosEventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

      // Filtrar si es necesario
      const filtrados = filtroTipo === 'todos' 
        ? todosEventos 
        : todosEventos.filter(e => e.tipo === filtroTipo)

      setEventos(filtrados)
    } catch (error) {
      console.error('Error cargando timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!empleado) {
    return <div className="text-center py-12 text-rose-600">No se encontró el empleado</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2"> Mi Historial</h1>
        <p className="text-slate-600">Timeline completo de {empleado.nombre_completo}</p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => { setFiltroTipo('todos'); cargarTimeline(empleado.id) }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filtroTipo === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => { setFiltroTipo('recibo'); cargarTimeline(empleado.id) }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filtroTipo === 'recibo' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          📄 Recibos
        </button>
        <button
          onClick={() => { setFiltroTipo('adelanto'); cargarTimeline(empleado.id) }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filtroTipo === 'adelanto' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          💰 Adelantos
        </button>
        <button
          onClick={() => { setFiltroTipo('vacaciones'); cargarTimeline(empleado.id) }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filtroTipo === 'vacaciones' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          ️ Vacaciones
        </button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando historial...</div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-white rounded-lg shadow">
          <p className="text-lg">No hay eventos registrados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventos.map((evento, index) => (
            <div key={`${evento.tipo}-${evento.id}`} className="flex gap-4">
              {/* Línea vertical */}
              {index !== eventos.length - 1 && (
                <div className="absolute w-0.5 bg-slate-200" style={{ 
                  left: '2rem', 
                  top: '4rem', 
                  height: 'calc(100% - 4rem)' 
                }} />
              )}
              
              {/* Icono */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-${evento.color}-100 border-2 border-${evento.color}-500`}>
                <span className="text-lg">{evento.icono}</span>
              </div>

              {/* Contenido */}
              <div className="flex-1 bg-white rounded-lg shadow p-4 border-l-4 border-slate-800">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-slate-900">{evento.titulo}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    evento.estado === 'completado' || evento.estado === 'aprobado' 
                      ? 'bg-emerald-100 text-emerald-800'
                      : evento.estado === 'pendiente'
                      ? 'bg-amber-100 text-amber-800'
                      : evento.estado === 'rechazado'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {evento.estado.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-600 text-sm mb-2">{evento.descripcion}</p>
                <p className="text-xs text-slate-400">
                  {new Date(evento.fecha).toLocaleDateString('es-AR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón volver */}
      <div className="mt-8">
        <button
          onClick={() => router.push('/empleado/dashboard')}
          className="bg-slate-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors"
        >
          ← Volver al Dashboard
        </button>
      </div>
    </div>
  )
}