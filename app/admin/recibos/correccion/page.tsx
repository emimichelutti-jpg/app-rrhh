'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CorreccionRecibosPage() {
  const router = useRouter()
  const [recibos, setRecibos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('2026-07')
  const [quincena, setQuincena] = useState('')
  const [soloErrores, setSoloErrores] = useState(true)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarRecibos()
  }, [periodo, quincena, soloErrores])

  const cargarRecibos = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('recibos_sueldo')
        .select('id, empleado_id, periodo, quincena, costo_total_empleador, contribuciones_empleador, empleados!inner(nombre_completo, legajo, zona_id)')
        .eq('periodo', periodo)
        .order('empleados(nombre_completo)', { ascending: true })

      if (quincena) query = query.eq('quincena', quincena)

      const { data, error } = await query
      if (error) throw error

      // Cargar zonas
      const zonasIds = [...new Set(data?.map((r: any) => r.empleados?.zona_id).filter(Boolean))]
      let zonasMap: any = {}
      
      if (zonasIds.length > 0) {
        const { data: zonasData } = await supabase
          .from('zonas')
          .select('id, nombre')
          .in('id', zonasIds)
        
        zonasData?.forEach((z: any) => {
          zonasMap[z.id] = z.nombre
        })
      }

      // Agregar nombre de zona a cada recibo
      const recibosConZona = (data || []).map((r: any) => ({
        ...r,
        zona_nombre: zonasMap[r.empleados?.zona_id] || '-'
      }))

      // Filtrar solo errores si está activado
      let recibosFiltrados = recibosConZona
      if (soloErrores) {
        recibosFiltrados = recibosFiltrados.filter((r: any) => {
          const costo = Number(r.costo_total_empleador) || 0
          const contrib = Number(r.contribuciones_empleador) || 0
          return costo === 0 || contrib > 5000000
        })
      }

      setRecibos(recibosFiltrados)
    } catch (error: any) {
      console.error('Error:', error)
      setMensaje(`❌ Error: ${error.message || 'Error desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  const actualizarCosto = async (id: string, nuevoCosto: number) => {
    try {
      const { error } = await supabase
        .from('recibos_sueldo')
        .update({ costo_total_empleador: nuevoCosto })
        .eq('id', id)

      if (error) throw error

      setMensaje('✅ Actualizado')
      setTimeout(() => setMensaje(''), 2000)
      await cargarRecibos()
    } catch (error: any) {
      setMensaje(` Error: ${error.message}`)
    }
  }

  if (loading) return <div className="p-8 text-center">Cargando...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Corrección de Recibos</h1>
          <p className="text-sm text-slate-600">Editá el costo total empleador directamente</p>
        </div>
        <button onClick={() => router.push('/admin/recibos')} className="text-sm text-slate-600 hover:text-slate-900">
          ← Volver
        </button>
      </div>

      {mensaje && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${mensaje.startsWith('✅') ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {mensaje}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 items-center mb-4">
        <input 
          type="text" 
          value={periodo} 
          onChange={(e) => setPeriodo(e.target.value)} 
          className="px-3 py-2 border rounded-lg w-32"
          placeholder="2026-07"
        />
        <select value={quincena} onChange={(e) => setQuincena(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las quincenas</option>
          <option value="1ra">1ra quincena</option>
          <option value="2da">2da quincena</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} className="w-4 h-4" />
          Solo errores
        </label>
        <button onClick={cargarRecibos} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm">
          🔍 Actualizar
        </button>
      </div>

      {/* Tabla tipo planilla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Empleado</th>
              <th className="px-4 py-3 text-left">Zona</th>
              <th className="px-4 py-3 text-center">Quincena</th>
              <th className="px-4 py-3 text-right">Costo Total Empleador</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recibos.map((recibo: any) => {
              const esError = (Number(recibo.costo_total_empleador) || 0) === 0 || (Number(recibo.contribuciones_empleador) || 0) > 5000000
              return (
                <tr key={recibo.id} className={esError ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 font-medium">
                    {recibo.empleados?.nombre_completo || 'Desconocido'}
                    <div className="text-xs text-slate-500">Legajo: {recibo.empleados?.legajo || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{recibo.zona_nombre}</td>
                  <td className="px-4 py-3 text-center">{recibo.quincena}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      defaultValue={recibo.costo_total_empleador || 0}
                      onBlur={(e) => {
                        const nuevoValor = Number(e.target.value)
                        if (nuevoValor !== Number(recibo.costo_total_empleador)) {
                          actualizarCosto(recibo.id, nuevoValor)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur()
                        }
                      }}
                      className={`w-full px-2 py-1 border rounded text-right font-mono ${
                        esError ? 'border-rose-300 bg-rose-100' : 'border-slate-200'
                      }`}
                    />
                  </td>
                </tr>
              )
            })}
            {recibos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  ✅ No hay recibos con errores
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        💡 Tip: Editá el valor y presioná Enter o hacé clic fuera para guardar automáticamente
      </div>
    </div>
  )
}