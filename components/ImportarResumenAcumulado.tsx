'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

interface FilaResumen {
  provincia: string
  tecnico: string
  servicios: number
  total: number
}

interface Preview {
  tecnico: string
  provincia: string
  servicios: number
  total: number
  empleado: string | null
  score: number
  candidato?: string | null
}

const limpiarNumero = (v: any): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[$\s,]/g, '')
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

export default function ImportarResumenAcumulado({ onImportSuccess }: { onImportSuccess: () => void }) {
  const [fechaDesde, setFechaDesde] = useState('2026-10-01')
  const [fechaHasta, setFechaHasta] = useState('2026-10-11')
  const [filas, setFilas] = useState<FilaResumen[]>([])
  const [preview, setPreview] = useState<Preview[] | null>(null)
  const [dias, setDias] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const leerArchivo = async (file: File) => {
    setCargando(true)
    setMensaje(null)
    setPreview(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      let idx = raw.findIndex(r =>
        r.some(c => /t[eé]cnico/i.test(String(c))) &&
        r.some(c => /servicios/i.test(String(c))) &&
        r.some(c => /total/i.test(String(c)))
      )
      if (idx === -1) throw new Error('No se encontró la cabecera (Técnico / Servicios / Total)')

      const header = raw[idx].map(h => String(h).toLowerCase())
      const colProv = header.findIndex(h => /provincia/.test(h))
      const colTec = header.findIndex(h => /t[eé]cnico/.test(h))
      const colServ = header.findIndex(h => /servicios/.test(h))
      const colTot = header.findIndex(h => /total/.test(h))

      const out: FilaResumen[] = []
      for (let i = idx + 1; i < raw.length; i++) {
        const r = raw[i]
        const tecnico = String(r[colTec] ?? '').trim()
        if (!tecnico) continue
        out.push({
          provincia: String(r[colProv] ?? '').trim(),
          tecnico,
          servicios: Math.round(limpiarNumero(r[colServ])),
          total: limpiarNumero(r[colTot])
        })
      }
      if (!out.length) throw new Error('No se encontraron filas de datos')
      setFilas(out)

      const res = await fetch('/api/admin/importar-resumen-acumulado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'preview', filas: out, fechaDesde, fechaHasta })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data.matches)
      setDias(data.dias)
    } catch (e: any) {
      setMensaje(`❌ ${e.message}`)
    } finally {
      setCargando(false)
    }
  }

  const confirmar = async () => {
    setImportando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/admin/importar-resumen-acumulado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'importar', filas, fechaDesde, fechaHasta })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje(
        `✅ ${data.insertadas} actividades sintéticas insertadas, repartidas en ${data.dias} días.` +
        (data.sinMatch?.length ? ` Sin coincidencia: ${data.sinMatch.join(', ')}` : '')
      )
      setPreview(null)
      setFilas([])
      onImportSuccess()
    } catch (e: any) {
      setMensaje(`❌ ${e.message}`)
    } finally {
      setImportando(false)
    }
  }

  const sinMatch = preview?.filter(p => !p.empleado) || []
  const totServ = preview?.reduce((a, p) => a + p.servicios, 0) || 0
  const totMon = preview?.reduce((a, p) => a + p.total, 0) || 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900">📦 Importar Resumen Acumulado</h2>
      <p className="text-sm text-gray-500 mt-1">
        Para franjas sin detalle diario (ej: 01/10–11/10). Reparte los servicios y el total de cada técnico
        en filas diarias parejas, marcadas como <code>origen = 'acumulado'</code> para poder reemplazarlas después.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Archivo Excel</label>
          <input type="file" accept=".xlsx,.xls"
            onChange={e => e.target.files?.[0] && leerArchivo(e.target.files[0])}
            className="w-full text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer" />
        </div>
      </div>

      {cargando && <p className="mt-4 text-sm text-blue-600">Analizando archivo y matching de técnicos…</p>}
      {mensaje && <p className="mt-4 text-sm whitespace-pre-wrap">{mensaje}</p>}

      {preview && (
        <>
          <div className="mt-4 text-sm text-gray-700">
            Período de <strong>{fechaDesde}</strong> a <strong>{fechaHasta}</strong> ({dias} días) •{' '}
            <strong>{preview.length}</strong> técnicos • <strong>{totServ.toLocaleString('es-AR')}</strong> actividades •{' '}
            <strong>${totMon.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto mt-3 rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Técnico (archivo)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Provincia</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Servicios</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Coincidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((p, i) => (
                  <tr key={i} className={p.empleado ? '' : 'bg-red-50'}>
                    <td className="px-3 py-2 font-medium text-gray-900">{p.tecnico}</td>
                    <td className="px-3 py-2 text-gray-600">{p.provincia}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.servicios}</td>
                    <td className="px-3 py-2 text-right font-mono">${p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      {p.empleado
                        ? <span className="text-green-700">{p.empleado} <span className="text-gray-400">({p.score})</span></span>
                        : (
                          <span className="text-red-700 font-semibold">
                            Sin coincidencia ({p.score})
                            {p.candidato && <span className="block text-xs font-normal text-red-600">¿Legajo cercano: {p.candidato}? Renombralo en Gestionar Empleados o continuá sin él.</span>}
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sinMatch.length > 0 && (
            <p className="mt-3 text-sm text-red-700">
              ⚠️ {sinMatch.length} técnico(s) sin coincidencia no se importarán. Asignalos en Gestionar Empleados o continúa sin ellos.
            </p>
          )}

          <button onClick={confirmar} disabled={importando}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-colors">
            {importando ? 'Importando…' : `✅ Confirmar importación (${totServ.toLocaleString('es-AR')} actividades)`}
          </button>
        </>
      )}
    </div>
  )
}