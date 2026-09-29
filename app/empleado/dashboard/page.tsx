'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardEmpleadoPage() {
  const router = useRouter()
  const [empleado, setEmpleado] = useState<any>(null)
  const [resumen, setResumen] = useState<any>({
    sueldoActual: 0,
    incentivoActual: 0,
    totalAdelantos: 0,
    proximoPagoSueldo: '',
    proximoPagoIncentivo: '',
    periodoIncentivo: ''
  })
  const [ultimosRecibos, setUltimosRecibos] = useState<any[]>([])
  const [recibosPendientes, setRecibosPendientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (!empleadoData) {
      router.push('/empleado/login')
      return
    }
    const emp = JSON.parse(empleadoData)
    setEmpleado(emp)
    cargarDatos(emp.id)
  }, [])

  const cargarDatos = async (empleadoId: string) => {
    try {
      const { data: recibos } = await supabase
        .from('recibos_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })
        .limit(3)

      setUltimosRecibos(recibos || [])
      const pendientes = (recibos || []).filter((r) => !r.fecha_firma)
      setRecibosPendientes(pendientes)

      const { data: incentivos } = await supabase
        .from('incentivos')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })
        .limit(1)

      const { data: adelantos } = await supabase
        .from('solicitudes_sueldo')
        .select('*')
        .eq('empleado_id', empleadoId)
        .in('estado', ['aprobado', 'en_curso'])

      const sueldoActual = recibos?.[0]?.neto_a_cobrar || 0
      const incentivoActual = incentivos?.[0]?.monto_neto || 0
      const incentivoPeriodo = incentivos?.[0]?.periodo || ''
      const totalAdelantos = adelantos?.reduce((sum: number, a: any) => sum + (a.monto_cuota || 0), 0) || 0

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
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularProximoPagoSueldo = (fecha: Date) => {
    const dia = fecha.getDate()
    if (dia <= 15) {
      return '4to dia habil de ' + fecha.toLocaleString('es-AR', { month: 'long' })
    }
    return '4to dia habil del proximo mes'
  }

  const calcularProximoPagoIncentivo = (fecha: Date) => {
    const mesActual = fecha.toLocaleString('es-AR', { month: 'long' })
    return '25-30 de ' + mesActual + ' (incentivo mes anterior)'
  }

  const getNombreMes = (periodo: string) => {
    if (!periodo) return ''
    const parts = periodo.split('-')
    const year = parts[0]
    const month = parts[1]
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return meses[parseInt(month) - 1] + ' ' + year
  }

  const getNombreCorto = (periodo: string, quincena: string) => {
    if (!periodo) return ''
    const parts = periodo.split('-')
    const year = parts[0]
    const month = parts[1]
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return meses[parseInt(month) - 1] + ' ' + year + ' - ' + quincena
  }

  const getNombreEmpleado = () => {
    if (!empleado?.nombre_completo) return 'Empleado'
    const partes = empleado.nombre_completo.split(',')
    if (partes.length > 1) {
      return partes[1].trim().split(' ')[0]
    }
    return partes[0].split(' ')[0]
  }

  const cerrarSesion = () => {
    localStorage.removeItem('empleado_data')
    document.cookie = 'empleado_token=; path=/; max-age=0'
    router.push('/empleado/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando tu informacion...</p>
        </div>
      </div>
    )
  }

  const cobroEstimado = resumen.sueldoActual - resumen.totalAdelantos
  const cobroEnCero = cobroEstimado <= 0

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white px-5 pt-8 pb-20 rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-slate-300 text-sm">Bienvenido,</p>
            <h1 className="text-2xl font-bold mt-1">
              {getNombreEmpleado()} &#128075;
            </h1>
          </div>
          <button
            onClick={cerrarSesion}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
            title="Cerrar sesion"
          >
            <span className="text-lg">&#128682;</span>
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-300 text-xs uppercase tracking-wider font-semibold">
              Proximo cobro estimado
            </p>
            <span className="text-xl">&#128176;</span>
          </div>

          {cobroEnCero ? (
            <>
              <p className="text-3xl font-bold mt-1">$0</p>
              <p className="text-amber-200 text-sm mt-2">
                Tu sueldo de esta quincena se destina integro al pago de tu adelanto de ${resumen.totalAdelantos.toLocaleString('es-AR')}.
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold mt-1">
                ${cobroEstimado.toLocaleString('es-AR')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-slate-300 text-sm">&#128197;</span>
                <p className="text-slate-200 text-sm">{resumen.proximoPagoSueldo}</p>
              </div>
              {resumen.totalAdelantos > 0 && (
                <p className="text-amber-200 text-xs mt-2">
                  Con descuento de tu adelanto: ${resumen.totalAdelantos.toLocaleString('es-AR')}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="px-5 -mt-12 space-y-5">
        {recibosPendientes.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">&#128221;</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base">
                  Tenes {recibosPendientes.length} {recibosPendientes.length === 1 ? 'recibo pendiente' : 'recibos pendientes'}
                </h3>
                <p className="text-amber-50 text-sm mt-1">
                  Revisa y firma {recibosPendientes.length === 1 ? 'tu recibo' : 'tus recibos'} para completar el proceso
                </p>
                <Link
                  href="/empleado/recibos"
                  className="inline-block mt-3 bg-white text-amber-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 transition-transform"
                >
                  Firmar ahora &#8594;
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/empleado/recibos"
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform min-h-[100px]"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">&#128196;</div>
            <span className="font-semibold text-slate-800 text-sm text-center">Mis Recibos</span>
          </Link>

          <Link
            href="/empleado/vacaciones"
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform min-h-[100px]"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-2xl">&#127958;</div>
            <span className="font-semibold text-slate-800 text-sm text-center">Vacaciones</span>
          </Link>

          <Link
            href="/empleado/incentivos"
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform min-h-[100px]"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-2xl">&#127919;</div>
            <span className="font-semibold text-slate-800 text-sm text-center">Incentivos</span>
          </Link>

          <Link
            href="/empleado/timeline"
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform min-h-[100px]"
          >
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-2xl">&#128197;</div>
            <span className="font-semibold text-slate-800 text-sm text-center">Mi Historial</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span>&#128188;</span> Resumen Financiero
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <div>
                <p className="font-medium text-slate-900 text-sm">Sueldo Neto (ultimo)</p>
                <p className="text-xs text-slate-500">Quincena mas reciente</p>
              </div>
              <p className="font-bold text-slate-900">${resumen.sueldoActual.toLocaleString('es-AR')}</p>
            </div>

            {resumen.incentivoActual > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <div>
                  <p className="font-medium text-slate-900 text-sm">
                    Incentivo {resumen.periodoIncentivo ? '(' + getNombreMes(resumen.periodoIncentivo) + ')' : ''}
                  </p>
                  <p className="text-xs text-slate-500">{resumen.proximoPagoIncentivo}</p>
                </div>
                <p className="font-bold text-emerald-600">+${resumen.incentivoActual.toLocaleString('es-AR')}</p>
              </div>
            )}

            {resumen.totalAdelantos > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Adelantos activos</p>
                  <p className="text-xs text-slate-500">Cuota mensual</p>
                </div>
                <p className="font-bold text-amber-600">-${resumen.totalAdelantos.toLocaleString('es-AR')}</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <span>&#128196;</span> Ultimos Recibos
            </h2>
            <Link href="/empleado/recibos" className="text-slate-900 text-sm font-semibold">
              Ver todos &#8594;
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {ultimosRecibos.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-4xl mb-2">&#128237;</p>
                <p className="text-sm">No hay recibos cargados aun</p>
              </div>
            ) : (
              ultimosRecibos.map((recibo, index) => (
                <Link
                  key={recibo.id}
                  href={'/empleado/recibos/' + recibo.id}
                  className={'block p-4 hover:bg-slate-50 transition-colors active:bg-slate-100 ' + (index !== ultimosRecibos.length - 1 ? 'border-b border-slate-100' : '')}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={'w-10 h-10 rounded-full flex items-center justify-center text-lg ' + (recibo.fecha_firma ? 'bg-emerald-100' : 'bg-amber-100')}>
                        {recibo.fecha_firma ? '&#9989;' : '&#9203;'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {getNombreCorto(recibo.periodo, recibo.quincena)}
                        </p>
                        <p className={'text-xs mt-0.5 ' + (recibo.fecha_firma ? 'text-emerald-600' : 'text-amber-600 font-semibold')}>
                          {recibo.fecha_firma ? 'Firmado' : 'Pendiente de firma'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        ${recibo.neto_a_cobrar?.toLocaleString('es-AR')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Ver detalle &#8594;</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">&#128172;</span>
            </div>
            <div>
              <h3 className="font-bold text-base">Tenes dudas?</h3>
              <p className="text-slate-300 text-sm mt-1">
                Contacta a RRHH para cualquier consulta sobre tu sueldo, recibos o beneficios.
              </p>
              <a
                href="mailto:rrhh@empresa.com"
                className="inline-block mt-3 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 transition-transform"
              >
                Contactar RRHH
              </a>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm text-blue-900 flex items-start gap-2">
            <span className="text-base">&#128161;</span>
            <span>
              <strong>Importante:</strong> Los incentivos se pagan a mes vencido. Por ejemplo, en agosto cobras el incentivo correspondiente a julio.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}