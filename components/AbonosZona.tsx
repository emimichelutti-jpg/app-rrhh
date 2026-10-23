'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Zona { id: string; nombre: string }
interface Abono { id: string; zona_id: string; periodo: string; monto: number; nota: string | null }

export default function AbonosZona({
  periodoInicial,
  onCambios,
  onClose
}: {
  periodoInicial?: string
  onCambios?: () => void
  onClose: () => void
}) {
  const [periodo, setPeriodo] = useState(periodoInicial || new Date().toISOString().slice(0, 7))
  const [zonas, setZonas] = useState<Zona[]>([])
  const [abonos, setAbonos] = useState<Abono[]>([])
  const [nuevaZona, setNuevaZona] = useState('')
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [nuevaNota, setNuevaNota] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargar = async () => {
    const [{ data: z }, { data: a }] = await Promise.all([
      supabase.from('zonas').select('id, nombre').order('nombre'),
      supabase.from('abonos_fijos').select('*').eq('periodo', periodo).order('created_at')
    ])
    setZonas(z || [])
    setAbonos(a || [])
  }

  useEffect(() => { cargar() }, [periodo])

  const agregar = async () => {
    const monto = parseFloat(nuevoMonto)
    if (!nuevaZona || !monto || monto <= 0) {
      setMensaje('Elegí una zona y un monto mayor a 0')
      return
    }
    const { error } = await supabase
      .from('abonos_fijos')
      .insert({ zona_id: nuevaZona, periodo, monto, nota: nuevaNota || null })
    if (error) setMensaje(`❌ ${error.message}`)
    else {
      setMensaje(null)
      setNuevaZona(''); setNuevoMonto(''); setNuevaNota('')
      await cargar(); onCambios?.()
    }
  }

  const guardarMonto = async (abono: Abono, monto: number) => {
    const { error } = await supabase.from('abonos_fijos').update({ monto }).eq('id', abono.id)
    if (!error) { await cargar(); onCambios?.() }
  }

  const guardarNota = async (abono: Abono, nota: string) => {
    const { error } = await supabase.from('abonos_fijos').update({ nota: nota || null }).eq('id', abono.id)
    if (!error) { await cargar(); onCambios?.() }
  }

  const eliminar = async (id: string) => {
    const { error } = await supabase.from('abonos_fijos').delete().eq('id', id)
    if (!error) { await cargar(); onCambios?.() }
  }

  const copiarMesAnterior = async () => {
    const [y, m] = periodo.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const { data } = await supabase.from('abonos_fijos').select('zona_id, monto, nota').eq('periodo', prev)
    if (!data?.length) { setMensaje(`El mes ${prev} no tiene facturas cargadas para copiar`); return }
    const { error } = await supabase
      .from('abonos_fijos')
      .insert(data.map(d => ({ zona_id: d.zona_id, periodo, monto: d.monto, nota: d.nota })))
    if (error) setMensaje(`❌ ${error.message}`)
    else { setMensaje(null); await cargar(); onCambios?.() }
  }

  const nombreZona = (id: string) => zonas.find(z => z.id === id)?.nombre || '—'
  const total = abonos.reduce((a, b) => a + (Number(b.monto) || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-900">💰 Facturas de Red (abono + adicionales)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Cargá el <strong>neto sin IVA</strong> de cada factura de red del mes (el abono fijo y, si aparecen,
          la 2ª/3ª/4ª factura por trabajos fuera de abono). El Reporte de Costos lo suma como ingreso de la zona:
          así el <strong>ROI de la plaza</strong> (filtrando por localidad) y el <strong>ROI de la empresa</strong> (total) quedan reales.
        </p>

        <div className="flex gap-3 items-end mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Período</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={copiarMesAnterior}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            📋 Copiar mes anterior
          </button>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500 uppercase font-semibold">Total del período</p>
            <p className="text-lg font-bold text-amber-700">${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {abonos.length > 0 && (
          <table className="min-w-full text-sm mb-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Zona / Plaza</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Neto facturado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Factura / Nota</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {abonos.map(a => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{nombreZona(a.zona_id)}</td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" defaultValue={a.monto}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== a.monto) guardarMonto(a, v) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      className="w-36 px-2 py-1 text-right border border-gray-300 rounded-md font-mono focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" defaultValue={a.nota || ''} placeholder="Nº factura / concepto"
                      onBlur={e => { if ((e.target.value || null) !== a.nota) guardarNota(a, e.target.value) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => eliminar(a.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Agregar factura a {periodo}</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Zona / Plaza</label>
              <select value={nuevaZona} onChange={e => setNuevaZona(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg min-w-[160px]">
                <option value="">Elegir…</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Neto sin IVA</label>
              <input type="number" value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)} placeholder="0"
                className="w-40 px-3 py-2 border border-gray-300 rounded-lg font-mono" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Factura / Nota</label>
              <input type="text" value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
                placeholder="Ej: FCE 00002-00000530 - ABONO MANT SEPT2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button onClick={agregar} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              + Agregar
            </button>
          </div>
        </div>

        {mensaje && <p className="mt-3 text-sm text-red-700">{mensaje}</p>}
      </div>
    </div>
  )
}