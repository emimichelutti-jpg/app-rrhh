'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'

export default function AsistenciaPage() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [datosPreview, setDatosPreview] = useState<any[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [calendario, setCalendario] = useState<Map<string, string>>(new Map())
  const [mapeo, setMapeo] = useState({ nombre: '', fecha_hora: '', registro: '' })
  const [columnasExcel, setColumnasExcel] = useState<string[]>([])
  const [importando, setImportando] = useState(false)
  const [vista, setVista] = useState<'importar' | 'analisis'>('importar')
  const [estadisticas, setEstadisticas] = useState<any>(null)
  const [calcularExtras, setCalcularExtras] = useState(true)
  const [horaLimite, setHoraLimite] = useState(9)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    const { data: empData } = await supabase
      .from('empleados')
      .select('*')
      .eq('estado', 'activo')
      .order('nombre_completo')
    if (empData) setEmpleados(empData)

    const { data: calData } = await supabase
      .from('calendario_laboral')
      .select('fecha, tipo')
    if (calData) {
      const map = new Map(calData.map((c: any) => [c.fecha, c.tipo]))
      setCalendario(map)
    }
  }

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArchivo(file)
      leerExcel(file)
    }
  }

  const leerExcel = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length > 0) {
        const headers = jsonData[0].map((h: any) => String(h).trim())
        setColumnasExcel(headers)
        
        const datos = jsonData.slice(1).map((row: any) => {
          const obj: any = {}
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index]
          })
          return obj
        })

        setDatosPreview(datos.slice(0, 5))

        setMapeo({
          nombre: headers.find((h: string) => h.toLowerCase().includes('nombre')) || headers[0] || '',
          fecha_hora: headers.find((h: string) => h.toLowerCase().includes('fecha') || h.toLowerCase().includes('hora')) || headers[1] || '',
          registro: headers.find((h: string) => h.toLowerCase().includes('registro')) || headers[2] || ''
        })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const parsearFechaHora = (valor: any) => {
    if (!valor) return null
    if (typeof valor === 'number') {
      const excelEpoch = new Date(1900, 0, 1)
      return new Date(excelEpoch.getTime() + (valor - 2) * 24 * 60 * 60 * 1000)
    }
    if (typeof valor === 'string') {
      const partes = valor.split(' ')
      if (partes.length === 2) {
        const [fechaStr, horaStr] = partes
        const [dia, mes, anio] = fechaStr.split('/')
        const [hora, minutos] = horaStr.split(':')
        return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia), parseInt(hora), parseInt(minutos))
      }
    }
    return new Date(valor)
  }

  const buscarEmpleadoFlexible = (nombreExcel: string) => {
    const nombreLimpio = nombreExcel.toLowerCase().trim()
    const partesExcel = nombreLimpio.split(' ')
    
    return empleados.find((e: any) => {
      const nombreBD = e.nombre_completo.toLowerCase()
      const partesBD = nombreBD.split(' ')
      
      if (nombreBD.includes(nombreLimpio) || nombreLimpio.includes(nombreBD)) {
        return true
      }
      
      if (partesExcel.length >= 1) {
        const primerParte = partesExcel[0]
        const segundaParte = partesExcel[1] || ''
        
        const primeraCoincide = partesBD.some((parte: string) => 
          parte.startsWith(primerParte) || primerParte.startsWith(parte)
        )
        
        if (segundaParte) {
          const segundaCoincide = partesBD.some((parte: string) => 
            parte.startsWith(segundaParte) || segundaParte.startsWith(parte)
          )
          return primeraCoincide && segundaCoincide
        }
        
        return primeraCoincide
      }
      
      return false
    })
  }

  const importarAsistencia = async () => {
    if (!archivo || !datosPreview.length) {
      alert('Seleccioná un archivo Excel primero')
      return
    }

    setImportando(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      const headers = jsonData[0].map((h: any) => String(h).trim())
      const registros = jsonData.slice(1).map((row: any) => {
        const obj: any = {}
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index]
        })
        return obj
      })

      const asistenciaPorDia = new Map<string, any>()
      const nombresNoEncontrados = new Set<string>()

      for (const row of registros) {
        try {
          const nombreCompleto = row[mapeo.nombre]
          const fechaHora = parsearFechaHora(row[mapeo.fecha_hora])
          const registro = parseInt(row[mapeo.registro])

          if (!nombreCompleto || !fechaHora) continue

          const empleado = buscarEmpleadoFlexible(String(nombreCompleto))

          if (!empleado) {
            nombresNoEncontrados.add(String(nombreCompleto))
            continue
          }

          const fechaStr = fechaHora.toISOString().split('T')[0]
          const horaStr = fechaHora.toTimeString().slice(0, 5)
          const key = `${empleado.id}_${fechaStr}`

          if (!asistenciaPorDia.has(key)) {
            asistenciaPorDia.set(key, {
              empleado_id: empleado.id,
              fecha: fechaStr,
              jornada_horas: empleado.jornada_horas || 8,
              hora_entrada: null,
              hora_salida: null
            })
          }

          const registroActual = asistenciaPorDia.get(key)

          if (registro === 0) {
            if (!registroActual.hora_entrada || horaStr < registroActual.hora_entrada) {
              registroActual.hora_entrada = horaStr
            }
          } else if (registro === 1) {
            if (!registroActual.hora_salida || horaStr > registroActual.hora_salida) {
              registroActual.hora_salida = horaStr
            }
          }
        } catch (err) {
          console.error('Error procesando registro:', err)
        }
      }

      console.log('Nombres no encontrados en BD:', Array.from(nombresNoEncontrados))

      let exitosos = 0
      let errores = 0
      let ausencias = 0
      let mediaJornada = 0
      let llegadasTarde = 0
      const erroresDetallados: string[] = []

      for (const [key, datos] of asistenciaPorDia) {
        try {
          const tipoDia = calendario.get(datos.fecha) || 'laborable'
          let horasTrabajadas = 0
          let horasExtras = 0
          let estado = 'presente'

          if (!datos.empleado_id) {
            erroresDetallados.push(`Fecha ${datos.fecha}: Empleado no encontrado`)
            errores++
            continue
          }

          if (tipoDia === 'feriado' || tipoDia === 'fin_semana') {
            estado = 'descanso'
            horasTrabajadas = 0
          } else {
            if (!datos.hora_entrada && !datos.hora_salida) {
              estado = 'ausente'
              horasTrabajadas = 0
              ausencias++
            } else if (!datos.hora_entrada || !datos.hora_salida) {
              estado = 'media_jornada'
              horasTrabajadas = 4
              mediaJornada++
            } else {
              const entrada = new Date(`2000-01-01 ${datos.hora_entrada}`)
              const salida = new Date(`2000-01-01 ${datos.hora_salida}`)
              const diffMs = salida.getTime() - entrada.getTime()
              horasTrabajadas = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2))
              
              const horaEntradaNum = parseInt(datos.hora_entrada.split(':')[0])
              const minutosEntrada = parseInt(datos.hora_entrada.split(':')[1])
              
              if (horaEntradaNum > horaLimite || (horaEntradaNum === horaLimite && minutosEntrada > 0)) {
                estado = 'tarde'
                llegadasTarde++
              }
              
              if (calcularExtras && horasTrabajadas > datos.jornada_horas) {
                horasExtras = parseFloat((horasTrabajadas - datos.jornada_horas).toFixed(2))
              }
            }
          }

          const { error } = await supabase
            .from('asistencia')
            .upsert({
              empleado_id: datos.empleado_id,
              fecha: datos.fecha,
              hora_entrada: datos.hora_entrada,
              hora_salida: datos.hora_salida,
              horas_trabajadas: horasTrabajadas,
              horas_extras: horasExtras,
              estado,
              observaciones: `Importado. Jornada: ${datos.jornada_horas}hs. Tipo día: ${tipoDia}${estado === 'tarde' ? '. Llegada tarde' : ''}`
            }, {
              onConflict: 'empleado_id,fecha'
            })

          if (error) {
            erroresDetallados.push(`Fecha ${datos.fecha}: ${error.message}`)
            errores++
          } else {
            exitosos++
          }
        } catch (err: any) {
          erroresDetallados.push(`Error: ${err.message}`)
          errores++
        }
      }

      let mensajeAlerta = `✅ Importación completada:\n\n`
      mensajeAlerta += `${exitosos} registros procesados\n`
      mensajeAlerta += `${ausencias} ausencias\n`
      mensajeAlerta += `${mediaJornada} media jornadas (4hs)\n`
      mensajeAlerta += `${llegadasTarde} llegadas tarde (después de las ${horaLimite}:00)\n`
      mensajeAlerta += `❌ ${errores} errores`
      
      if (nombresNoEncontrados.size > 0) {
        mensajeAlerta += `\n\n⚠️ Empleados no encontrados:\n${Array.from(nombresNoEncontrados).slice(0, 5).join('\n')}`
        if (nombresNoEncontrados.size > 5) {
          mensajeAlerta += `\n... y ${nombresNoEncontrados.size - 5} más`
        }
      }
      
      if (erroresDetallados.length > 0) {
        mensajeAlerta += `\n\n Detalles de errores:\n${erroresDetallados.slice(0, 5).join('\n')}`
      }
      
      alert(mensajeAlerta)
      setImportando(false)
      calcularEstadisticas()
      setVista('analisis')
    }
    reader.readAsArrayBuffer(archivo)
  }

  const calcularEstadisticas = async () => {
    const { data } = await supabase
      .from('asistencia')
      .select('*, empleados(nombre_completo, jornada_horas)')
      .order('fecha', { ascending: false })
      .limit(500)

    if (!data) return

    const totalRegistros = data.length
    const horasExtrasTotales = data.reduce((sum: number, r: any) => sum + (r.horas_extras || 0), 0)
    const horasTrabajadasTotales = data.reduce((sum: number, r: any) => sum + (r.horas_trabajadas || 0), 0)
    const ausencias = data.filter((r: any) => r.estado === 'ausente').length
    const mediaJornada = data.filter((r: any) => r.estado === 'media_jornada').length
    const llegadasTarde = data.filter((r: any) => r.estado === 'tarde').length

    const horasPorEmpleado = new Map<string, number>()
    data.forEach((r: any) => {
      const nombre = r.empleados?.nombre_completo || 'Sin nombre'
      horasPorEmpleado.set(nombre, (horasPorEmpleado.get(nombre) || 0) + (r.horas_extras || 0))
    })

    const topHorasExtras = Array.from(horasPorEmpleado.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, horas]) => ({ nombre, horas }))

    setEstadisticas({
      totalRegistros, horasExtrasTotales, horasTrabajadasTotales,
      topHorasExtras, ausencias, mediaJornada, llegadasTarde
    })
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Control de Asistencia Inteligente</h1>
          <p className="text-sm text-gray-600">Importación automática con detección de ausencias, media jornada, tardanzas y horas extras</p>
        </div>

        <div className="flex gap-4 mb-6 border-b">
          <button onClick={() => setVista('importar')} className={`px-4 py-2 ${vista === 'importar' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}>
            📥 Importar Excel
          </button>
          <button onClick={() => calcularEstadisticas()} className={`px-4 py-2 ${vista === 'analisis' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}>
            📊 Análisis y Reportes
          </button>
        </div>

        {vista === 'importar' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">1. Subir Archivo Excel del Fichaje</h2>
              <input type="file" accept=".xlsx,.xls" onChange={handleArchivo} className="w-full p-2 border border-gray-300 rounded" />
              {archivo && <p className="text-sm text-green-600 mt-2">✓ Archivo: {archivo.name}</p>}
            </div>

            <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
              <h2 className="text-lg font-semibold mb-4 text-blue-900">⚙️ Opciones de Cálculo</h2>
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={calcularExtras} 
                    onChange={(e) => setCalcularExtras(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Calcular horas extras automáticamente</span>
                    <p className="text-sm text-gray-600">Si el empleado supera su jornada configurada (ej: 8hs), se computarán las horas extras.</p>
                  </div>
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora límite para considerar "tarde"</label>
                  <input 
                    type="number" 
                    min="6" 
                    max="12" 
                    value={horaLimite} 
                    onChange={(e) => setHoraLimite(parseInt(e.target.value))}
                    className="w-32 p-2 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">Si llega después de esta hora, se marca como tarde (default: 9:00 AM)</p>
                </div>
              </div>
            </div>

            {columnasExcel.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">2. Verificar Columnas</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Columna Nombre</label>
                    <select value={mapeo.nombre} onChange={(e) => setMapeo({...mapeo, nombre: e.target.value})} className="w-full p-2 border border-gray-300 rounded">
                      {columnasExcel.map((col: string) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Columna Fecha/Hora</label>
                    <select value={mapeo.fecha_hora} onChange={(e) => setMapeo({...mapeo, fecha_hora: e.target.value})} className="w-full p-2 border border-gray-300 rounded">
                      {columnasExcel.map((col: string) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Columna Registro (0=Entrada, 1=Salida)</label>
                    <select value={mapeo.registro} onChange={(e) => setMapeo({...mapeo, registro: e.target.value})} className="w-full p-2 border border-gray-300 rounded">
                      {columnasExcel.map((col: string) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                </div>

                {datosPreview.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-2">Vista previa (primeros 5 registros):</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border">
                        <thead className="bg-gray-50">
                          <tr>
                            {columnasExcel.map((col: string) => (
                              <th key={col} className="px-3 py-2 border text-left">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {datosPreview.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              {columnasExcel.map((col: string) => (
                                <td key={col} className="px-3 py-2 border">{row[col]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <button onClick={importarAsistencia} disabled={importando} className="mt-6 w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold text-lg">
                  {importando ? '⏳ Procesando e importando...' : '🚀 Importar y Calcular Asistencia'}
                </button>
              </div>
            )}
          </div>
        )}

        {vista === 'analisis' && estadisticas && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Total Registros</div>
                <div className="text-3xl font-bold text-blue-600">{estadisticas.totalRegistros}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Horas Trabajadas</div>
                <div className="text-3xl font-bold text-green-600">{estadisticas.horasTrabajadasTotales.toFixed(1)} hs</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Horas Extras</div>
                <div className="text-3xl font-bold text-orange-600">{estadisticas.horasExtrasTotales.toFixed(1)} hs</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Ausencias / Media Jornada</div>
                <div className="text-3xl font-bold text-red-600">{estadisticas.ausencias} / {estadisticas.mediaJornada}</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">📊 Resumen del Período</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Llegadas Tarde</div>
                  <div className="text-2xl font-bold text-yellow-600">{estadisticas.llegadasTarde}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Ausencias</div>
                  <div className="text-2xl font-bold text-red-600">{estadisticas.ausencias}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Media Jornada</div>
                  <div className="text-2xl font-bold text-purple-600">{estadisticas.mediaJornada}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">🏆 Top 5 - Empleados con más Horas Extras</h2>
              <div className="space-y-3">
                {estadisticas.topHorasExtras.map((emp: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm font-medium">{idx + 1}. {emp.nombre}</span>
                    <span className="text-sm font-bold text-orange-600">{emp.horas.toFixed(1)} hs extras</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {vista === 'analisis' && !estadisticas && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <p className="text-sm text-gray-700">
              No hay datos importados aún. Subí un archivo Excel en la pestaña "Importar Excel" primero.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}