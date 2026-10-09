'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  periodo: string
  onImportados: (cantidad: number) => void
  onClose: () => void
}

interface FilaParseada {
  legajo: string
  nombre: string
  incentivo: number
  encontrado: boolean
  empleado_id?: string
  error?: string
}

export default function ImportarIncentivos({ periodo, onImportados, onClose }: Props) {
  const [filas, setFilas] = useState<FilaParseada[]>([])
  const [procesando, setProcesando] = useState(false)
  const [importados, setImportados] = useState(0)
  const [errores, setErrores] = useState(0)

  const parsearNumero = (valor: any): number => {
    if (!valor) return 0
    if (typeof valor === 'number') return valor
    const str = String(valor)
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/\s/g, '')
    const num = parseFloat(str)
    return isNaN(num) ? 0 : num
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const datos: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Buscar empleados para cruzar por legajo o nombre
    const { data: empleados } = await supabase
      .from('empleados')
      .select('id, legajo, nombre_completo')

    const empleadosMap = new Map<string, any>()
    empleados?.forEach(emp => {
      if (emp.legajo) empleadosMap.set(String(emp.legajo).trim(), emp)
      const nombreNormalizado = emp.nombre_completo.toLowerCase().trim()
      empleadosMap.set(nombreNormalizado, emp)
    })

    const filasParseadas: FilaParseada[] = []

    // Empezar desde la fila 1 (saltar header)
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i]
      if (!fila || fila.length < 2) continue

      const legajo = String(fila[0] || '').trim()
      const nombre = String(fila[1] || '').trim()
      const incentivoRaw = fila[6] // Columna G (índice 6) = Incentivo
      const incentivo = parsearNumero(incentivoRaw)

      // Buscar empleado por legajo primero, luego por nombre
      let empleado = empleadosMap.get(legajo)
      if (!empleado && nombre) {
        const nombreNorm = nombre.toLowerCase()
        empleado = empleadosMap.get(nombreNorm)
      }

      if (!empleado) {
        filasParseadas.push({
          legajo,
          nombre,
          incentivo,
          encontrado: false,
          error: 'Empleado no encontrado'
        })
      } else {
        filasParseadas.push({
          legajo,
          nombre,
          incentivo,
          encontrado: true,
          empleado_id: empleado.id
        })
      }
    }

    setFilas(filasParseadas)
  }

  const confirmarImportacion = async () => {
    setProcesando(true)
    let exitosos = 0
    let erroresCount = 0

    for (const fila of filas) {
      if (!fila.encontrado || !fila.empleado_id) {
        erroresCount++
        continue
      }

      try {
        const { data: existente } = await supabase
          .from('incentivos')
          .select('id')
          .eq('empleado_id', fila.empleado_id)
          .eq('periodo', periodo)
          .maybeSingle()

        if (existente) {
          const { error } = await supabase
            .from('incentivos')
            .update({ monto_bruto: fila.incentivo })
            .eq('id', existente.id)
          if (error) erroresCount++
          else exitosos++
        } else {
          const { error } = await supabase
            .from('incentivos')
            .insert({
              empleado_id: fila.empleado_id,
              periodo: periodo,
              monto_bruto: fila.incentivo
            })
          if (error) erroresCount++
          else exitosos++
        }
      } catch (err) {
        erroresCount++
      }
    }

    setImportados(exitosos)
    setErrores(erroresCount)
    setProcesando(false)
    onImportados(exitosos)
  }

  const totalIncentivos = filas.reduce((sum, f) => sum + f.incentivo, 0)
  const encontrados = filas.filter(f => f.encontrado).length

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">📥 Importar Incentivos desde Excel</h2>
              <p className="text-blue-100 mt-1">Período: {periodo}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {filas.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Subí tu archivo Excel</h3>
              <p className="text-gray-600 mb-6">
                El archivo debe tener las columnas: <strong>Legajo</strong>, <strong>Técnico</strong>, ..., <strong>Incentivo</strong> (columna G)
              </p>
              <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 cursor-pointer font-medium transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Seleccionar archivo Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase">Filas leídas</p>
                  <p className="text-2xl font-bold text-blue-700">{filas.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-green-600 uppercase">Empleados encontrados</p>
                  <p className="text-2xl font-bold text-green-700">{encontrados}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-red-600 uppercase">No encontrados</p>
                  <p className="text-2xl font-bold text-red-700">{filas.length - encontrados}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-purple-600 uppercase">Total incentivos</p>
                  <p className="text-2xl font-bold text-purple-700">{formatMoney(totalIncentivos)}</p>
                </div>
              </div>

              {/* Preview de datos */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Vista previa de datos</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Legajo</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Técnico</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Incentivo</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filas.map((fila, idx) => (
                        <tr key={idx} className={fila.encontrado ? 'bg-white' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-sm font-mono text-gray-600">{fila.legajo || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{fila.nombre}</td>
                          <td className="px-3 py-2 text-sm text-right font-mono font-semibold text-gray-900">
                            {formatMoney(fila.incentivo)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {fila.encontrado ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                ✓ Encontrado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                ✗ {fila.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3">
                <button
                  onClick={confirmarImportacion}
                  disabled={procesando || encontrados === 0}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                >
                  {procesando ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Importar {encontrados} incentivos
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setFilas([]); setImportados(0); setErrores(0); }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cargar otro archivo
                </button>
              </div>

              {importados > 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">
                    ✅ Importación completada: <strong>{importados} incentivos</strong> guardados correctamente
                    {errores > 0 && `, ${errores} con errores`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}