'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1']

export default function RoiDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState({ mes: '07', anio: 2026 })

  useEffect(() => {
    cargarDatos()
  }, [periodo])

  const cargarDatos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('productividad')
      .select('*, empleados(nombre_completo, zona_id), zonas(nombre)')
      .eq('mes', periodo.mes)
      .eq('anio', periodo.anio)
    
    setData(data || [])
    setLoading(false)
  }

  // Cálculos
  const totalIngresos = data.reduce((sum, r) => sum + (r.ingreso_generado || 0), 0)
  const totalCostos = data.reduce((sum, r) => sum + (r.costo_total_empleador || 0), 0)
  const roiPromedio = totalCostos > 0 ? ((totalIngresos - totalCostos) / totalCostos) * 100 : 0

  // Ranking de empleados
  const ranking = [...data]
    .sort((a, b) => (b.roi_porcentaje || 0) - (a.roi_porcentaje || 0))
    .map(r => ({ name: r.empleados?.nombre_completo.split(',')[0] || 'N/A', roi: r.roi_porcentaje || 0 }))

  // Comparativa por zona
  const zonasMap: any = {}
  data.forEach(r => {
    const zona = r.zonas?.nombre || 'Sin Zona'
    if (!zonasMap[zona]) zonasMap[zona] = { ingresos: 0, costos: 0 }
    zonasMap[zona].ingresos += r.ingreso_generado || 0
    zonasMap[zona].costos += r.costo_total_empleador || 0
  })
  const zonasData = Object.entries(zonasMap).map(([name, vals]: [string, any]) => ({
    name,
    roi: vals.costos > 0 ? ((vals.ingresos - vals.costos) / vals.costos) * 100 : 0
  })).sort((a, b) => b.roi - a.roi)

  if (loading) return <div className="p-8 text-center">Cargando métricas...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard de ROI</h1>
          <p className="text-slate-600">Análisis de rentabilidad por empleado y zona</p>
        </div>
        <div className="flex gap-2">
          <input type="text" value={periodo.mes} onChange={(e) => setPeriodo({...periodo, mes: e.target.value})} className="px-3 py-2 border rounded-lg w-20 text-center" />
          <input type="number" value={periodo.anio} onChange={(e) => setPeriodo({...periodo, anio: Number(e.target.value)})} className="px-3 py-2 border rounded-lg w-24 text-center" />
          <button onClick={() => router.push('/admin/productividad')} className="bg-slate-700 text-white px-4 py-2 rounded-lg">← Gestionar Datos</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-slate-500 text-sm">Total Facturado</p>
          <p className="text-2xl font-bold text-slate-900">${totalIngresos.toLocaleString('es-AR', {maximumFractionDigits: 0})}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-rose-500">
          <p className="text-slate-500 text-sm">Total Costos Laborales</p>
          <p className="text-2xl font-bold text-slate-900">${totalCostos.toLocaleString('es-AR', {maximumFractionDigits: 0})}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-500">
          <p className="text-slate-500 text-sm">ROI Promedio Empresa</p>
          <p className={`text-2xl font-bold ${roiPromedio > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{roiPromedio.toFixed(1)}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-slate-500">
          <p className="text-slate-500 text-sm">Empleados Analizados</p>
          <p className="text-2xl font-bold text-slate-900">{data.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Ranking Empleados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">🏆 Ranking de Empleados (ROI %)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '12px' }} />
                <Tooltip />
                <Bar dataKey="roi" fill="#10b981">
                  {ranking.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.roi < 0 ? '#ef4444' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Comparativa Zonas */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">📊 Rentabilidad por Zona</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zonasData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" style={{ fontSize: '12px' }} />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Bar dataKey="roi" fill="#3b82f6">
                  {zonasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.roi < 0 ? '#ef4444' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabla Detallada */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-bold">Detalle Completo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Empleado</th>
                <th className="px-4 py-3 text-left">Zona</th>
                <th className="px-4 py-3 text-right">Costo</th>
                <th className="px-4 py-3 text-right">Ingreso</th>
                <th className="px-4 py-3 text-center">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.sort((a,b) => (b.roi_porcentaje||0) - (a.roi_porcentaje||0)).map((reg: any) => (
                <tr key={reg.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{reg.empleados?.nombre_completo}</td>
                  <td className="px-4 py-3">{reg.zonas?.nombre}</td>
                  <td className="px-4 py-3 text-right">${reg.costo_total_empleador?.toLocaleString('es-AR', {maximumFractionDigits: 0})}</td>
                  <td className="px-4 py-3 text-right">${reg.ingreso_generado?.toLocaleString('es-AR', {maximumFractionDigits: 0})}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${reg.roi_porcentaje > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {reg.roi_porcentaje?.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}