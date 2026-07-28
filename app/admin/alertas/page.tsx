import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// ✅ Al ser Componente de Servidor, puede acceder de forma segura a la SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminAlertasPage() {
  const hoy = new Date()

  // 1. Recibos pendientes de firma (con más de 3 días de creados)
  const { data: recibosPendientes } = await supabase
    .from('recibos_sueldo')
    .select(`
      id, periodo, quincena, neto_a_cobrar, created_at,
      empleados (nombre_completo, cuil)
    `)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })

  const recibosAtrasados = (recibosPendientes || []).filter((r: any) => {
    const diasDesdeCarga = (hoy.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return diasDesdeCarga >= 3
  })

  // 2. Solicitudes pendientes de aprobación (Adelantos)
  const { data: solicitudesPendientes } = await supabase
    .from('solicitudes_sueldo')
    .select(`
      id, tipo, monto_total, fecha_solicitud, motivo,
      empleados (nombre_completo, cuil)
    `)
    .eq('estado', 'pendiente')
    .order('fecha_solicitud', { ascending: true })

  // 3. Empleados activos sin firma digital registrada
  const { data: empleadosSinFirma } = await supabase
    .from('empleados')
    .select('id, nombre_completo, cuil, legajo')
    .eq('activo', true)
    .is('firma_registrada_url', null)

  const totalAlertas = (recibosAtrasados?.length || 0) + (solicitudesPendientes?.length || 0) + (empleadosSinFirma?.length || 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Centro de Alertas</h1>
          <p className="text-slate-600">Atención proactiva para RRHH</p>
        </div>
        <div className="bg-rose-100 text-rose-800 px-4 py-2 rounded-lg font-bold">
          {totalAlertas} Alertas Activas
        </div>
      </div>

      {totalAlertas === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
          <span className="text-4xl mb-4 block">🎉</span>
          <h3 className="text-xl font-semibold text-emerald-900">¡Todo en orden!</h3>
          <p className="text-emerald-700 mt-2">No hay alertas pendientes que requieran atención.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. Recibos Pendientes de Firma */}
          <div className="bg-white rounded-lg shadow border-t-4 border-amber-500">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                📄 Recibos sin Firmar
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                  {recibosAtrasados?.length || 0}
                </span>
              </h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {(!recibosAtrasados || recibosAtrasados.length === 0) ? (
                <p className="text-sm text-slate-500 text-center py-4">Sin alertas</p>
              ) : (
                recibosAtrasados.map((r: any) => (
                  <div key={r.id} className="bg-amber-50 border border-amber-200 rounded p-3">
                    <p className="font-semibold text-slate-900 text-sm">{r.empleados.nombre_completo}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {r.periodo} - {r.quincena} | ${r.neto_a_cobrar?.toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs text-amber-700 mt-2 font-medium">
                      ⚠️ Pendiente desde: {new Date(r.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Solicitudes Pendientes */}
          <div className="bg-white rounded-lg shadow border-t-4 border-blue-500">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                ⏳ Solicitudes por Aprobar
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {solicitudesPendientes?.length || 0}
                </span>
              </h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {(!solicitudesPendientes || solicitudesPendientes.length === 0) ? (
                <p className="text-sm text-slate-500 text-center py-4">Sin alertas</p>
              ) : (
                solicitudesPendientes.map((s: any) => (
                  <div key={s.id} className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="font-semibold text-slate-900 text-sm">{s.empleados.nombre_completo}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {s.tipo === 'adelanto' ? 'Adelanto' : 'Préstamo'}: ${s.monto_total?.toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs text-blue-700 mt-2 italic">"{s.motivo}"</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Solicitado: {new Date(s.fecha_solicitud).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Empleados sin Firma Registrada */}
          <div className="bg-white rounded-lg shadow border-t-4 border-rose-500">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                📝 Sin Firma Digital
                <span className="bg-rose-100 text-rose-800 text-xs px-2 py-1 rounded-full">
                  {empleadosSinFirma?.length || 0}
                </span>
              </h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {(!empleadosSinFirma || empleadosSinFirma.length === 0) ? (
                <p className="text-sm text-slate-500 text-center py-4">Sin alertas</p>
              ) : (
                empleadosSinFirma.map((e: any) => (
                  <div key={e.id} className="bg-rose-50 border border-rose-200 rounded p-3">
                    <p className="font-semibold text-slate-900 text-sm">{e.nombre_completo}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      CUIL: {e.cuil} {e.legajo ? `| Legajo: ${e.legajo}` : ''}
                    </p>
                    <p className="text-xs text-rose-700 mt-2 font-medium">
                      ⚠️ No podrá firmar recibos
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Botones de acción */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/admin/recibos"
          className="bg-slate-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors text-center"
        >
          Ir a Gestión de Recibos
        </Link>
        <Link
          href="/admin/alertas"
          className="bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors text-center"
        >
          🔄 Actualizar Alertas
        </Link>
      </div>
    </div>
  )
}