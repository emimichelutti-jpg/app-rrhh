'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MisIncentivosPage() {
  const [empleado, setEmpleado] = useState<any>(null)
  const [incentivos, setIncentivos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (empleadoData) {
      const emp = JSON.parse(empleadoData)
      setEmpleado(emp)
      cargarIncentivos(emp.id)
    }
  }, [])

  const cargarIncentivos = async (empleadoId: string) => {
    try {
      const { data, error } = await supabase
        .from('incentivos')
        .select(`
          *,
          descuentos_incentivos(monto_total, tipo, concepto)
        `)
        .eq('empleado_id', empleadoId)
        .order('periodo', { ascending: false })

      if (error) throw error

      if (data) {
        const procesados = data.map(inv => {
          const descuentos = inv.descuentos_incentivos || []
          const totalDescuentos = descuentos.reduce((sum: number, d: any) => sum + d.monto_total, 0)
          return {
            ...inv,
            totalDescuentos,
            netoCalculado: inv.monto_bruto - totalDescuentos
          }
        })
        setIncentivos(procesados)
      }
    } catch (error) {
      console.error('Error cargando incentivos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPeriodoNombre = (periodo: string) => {
    const [year, month] = periodo.split('-')
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${meses[parseInt(month) - 1]} ${year}`
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando incentivos...</p>
      </div>
    )
  }

  const incentivoActual = incentivos[0]
  const historial = incentivos.slice(1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis Incentivos</h1>
        <p className="text-gray-600">Consultá tus incentivos y descuentos</p>
      </div>

      {/* Incentivo del Mes Actual */}
      {incentivoActual && (
        <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-green-100 text-sm mb-1">Incentivo del Mes</p>
              <h2 className="text-3xl font-bold">{getPeriodoNombre(incentivoActual.periodo)}</h2>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-sm mb-1">Total a Cobrar</p>
              <p className="text-4xl font-bold">${incentivoActual.netoCalculado.toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white border-opacity-20">
            <div>
              <p className="text-green-100 text-xs mb-1">Incentivo Bruto</p>
              <p className="text-xl font-semibold">${incentivoActual.monto_bruto.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-green-100 text-xs mb-1">Descuentos</p>
              <p className="text-xl font-semibold text-red-200">-${incentivoActual.totalDescuentos.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-green-100 text-xs mb-1">Fecha de Pago</p>
              <p className="text-xl font-semibold">25-30 del mes</p>
            </div>
          </div>

          {/* Detalle de Descuentos */}
          {incentivoActual.totalDescuentos > 0 && (
            <div className="mt-6 bg-white bg-opacity-10 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Detalle de Descuentos:</h3>
              <div className="space-y-2">
                {incentivoActual.descuentos_incentivos?.map((descuento: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-white bg-opacity-10 rounded px-3 py-2">
                    <div>
                      <p className="font-medium capitalize">{descuento.tipo}</p>
                      <p className="text-sm text-green-100">{descuento.concepto}</p>
                    </div>
                    <p className="font-bold">-${descuento.monto_total.toLocaleString('es-AR')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!incentivoActual && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <p className="text-yellow-800 text-center">
            <span className="text-2xl mb-2 block">📭</span>
            No tenés incentivos cargados para este período
          </p>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Historial</h2>
          <div className="space-y-4">
            {historial.map((incentivo) => (
              <div key={incentivo.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{getPeriodoNombre(incentivo.periodo)}</h3>
                    <p className="text-sm text-gray-500">
                      Bruto: ${incentivo.monto_bruto.toLocaleString('es-AR')} | 
                      Descuentos: ${incentivo.totalDescuentos.toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Neto Cobrado</p>
                    <p className="text-2xl font-bold text-green-700">
                      ${incentivo.netoCalculado.toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>

                {incentivo.totalDescuentos > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Descuentos aplicados:</p>
                    <div className="flex flex-wrap gap-2">
                      {incentivo.descuentos_incentivos?.map((descuento: any, idx: number) => (
                        <span key={idx} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          {descuento.tipo}: ${descuento.monto_total.toLocaleString('es-AR')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}