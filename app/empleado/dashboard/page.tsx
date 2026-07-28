'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link' // ✅ Agregamos el componente Link de Next.js

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardEmpleadoPage() {
  const [empleado, setEmpleado] = useState<any>(null)
  const [resumen, setResumen] = useState<any>({
    sueldoActual: 0,
    incentivoActual: 0,
    totalAdelantos: 0,
    proximoPagoSueldo: '',
    proximoPagoIncentivo: '',
    periodoIncentivo: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarResumen(emp.id)
    }
  }, [])

  const cargarResumen = async (empleadoId: string) => {
    try {
      // Último recibo
      const { data: recibos } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })
        .limit(1)

      // Incentivo actual
      const { data: incentivos } = await supabase
        .from('incentivos')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })
        .limit(1)

      // Adelantos activos
      const { data: adelantos } = await supabase
        .from('solicitudes_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .in('estado', ['aprobado', 'en_curso'])

      const sueldoActual = recibos?.[0]?.neto_a_cobrar || 0
      const incentivoActual = incentivos?.[0]?.monto_neto || 0
      const incentivoPeriodo = incentivos?.[0]?.periodo || ''
      const totalAdelantos = adelantos?.reduce((sum: number, a: any) => sum + (a.monto_cuota || 0), 0) || 0

      // Calcular fechas de pago
      const ahora = new Date()
      const proximoPagoSueldo = calcularProximoPagoSueldo(ahora)
      const proximoPagoIncentivo = calcularProximoPagoIncentivo(ahora)

      setResumen({
        sueldoActual,
        incentivoActual,
        totalAdelantos,
        proximoPagoSueldo,
        proximoPagoIncentivo,
        periodoIncentivo: incentivoPeriodo
      })
    } catch (error) {
      console.error('Error cargando resumen:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularProximoPagoSueldo = (fecha: Date) => {
    const dia = fecha.getDate()
    if (dia <= 15) {
      return `4to día hábil de ${fecha.toLocaleString('es-AR', { month: 'long' })}`
    }
    return `4to día hábil del próximo mes`
  }

  const calcularProximoPagoIncentivo = (fecha: Date) => {
    const mesActual = fecha.toLocaleString('es-AR', { month: 'long' })
    return `25-30 de ${mesActual} (incentivo mes anterior)`
  }

  const getNombreMes = (periodo: string) => {
    if (!periodo) return ''
    const [year, month] = periodo.split('-')
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${meses[parseInt(month) - 1]} ${year}`
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">Cargando dashboard...</p>
      </div>
    )
  }

  return (
    <div>
      {/* ✅ HEADER CON BOTÓN DE HISTORIAL AGREGADO */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Dashboard</h1>
          <p className="text-slate-600">Resumen financiero completo</p>
        </div>
        <Link 
          href="/empleado/timeline" 
          className="bg-slate-700 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm w-fit"
        >
          📅 Mi Historial
        </Link>
      </div>

      {/* Tarjetas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Sueldo */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-slate-600">
          <div className="flex items-center mb-3">
            <span className="text-3xl mr-3">💰</span>
            <div>
              <p className="text-slate-600 text-sm">Sueldo Quincenal</p>
              <p className="text-3xl font-bold text-slate-900">${resumen.sueldoActual.toLocaleString('es-AR')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            📅 {resumen.proximoPagoSueldo}
          </p>
        </div>

        {/* Incentivo */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-emerald-500">
          <div className="flex items-center mb-3">
            <span className="text-3xl mr-3">🎯</span>
            <div>
              <p className="text-slate-600 text-sm">Incentivo {resumen.periodoIncentivo ? `(${getNombreMes(resumen.periodoIncentivo)})` : ''}</p>
              <p className="text-3xl font-bold text-slate-900">${resumen.incentivoActual.toLocaleString('es-AR')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            📅 {resumen.proximoPagoIncentivo}
          </p>
        </div>
      </div>

      {/* Adelantos Activos */}
      {resumen.totalAdelantos > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Adelantos Activos</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-amber-900">Cuotas Pendientes</p>
                <p className="text-sm text-amber-700">Se descontará automáticamente del sueldo</p>
              </div>
              <p className="text-2xl font-bold text-amber-900">
                ${resumen.totalAdelantos.toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Próximos Pagos */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Próximos Pagos</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center">
              <span className="text-2xl mr-3">💵</span>
              <div>
                <p className="font-semibold text-slate-900">Sueldo Quincenal</p>
                <p className="text-sm text-slate-600">{resumen.proximoPagoSueldo}</p>
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900">${resumen.sueldoActual.toLocaleString('es-AR')}</p>
          </div>

          <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎯</span>
              <div>
                <p className="font-semibold text-slate-900">Incentivo Mensual {resumen.periodoIncentivo && `(de ${getNombreMes(resumen.periodoIncentivo)})`}</p>
                <p className="text-sm text-slate-600">{resumen.proximoPagoIncentivo}</p>
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-700">${resumen.incentivoActual.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Nota explicativa */}
      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-700">
          <strong>💡 Importante:</strong> Los incentivos se pagan a mes vencido. 
          Por ejemplo, en junio cobrás el incentivo correspondiente a mayo.
        </p>
      </div>
    </div>
  )
}