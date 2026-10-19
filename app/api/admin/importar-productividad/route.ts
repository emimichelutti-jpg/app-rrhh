import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Normalizar texto: quitar acentos, minúsculas, espacios extra
function normalizarTexto(texto: string): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Extraer palabras clave de un nombre
function extraerPalabrasClave(nombre: string): string[] {
  const palabrasIgnorar = new Set(['de', 'la', 'del', 'los', 'las', 'y', 'e', 'el', 'por', 'para', 'con', 'sin'])
  return normalizarTexto(nombre)
    .split(/[\s,]+/)
    .filter(p => p.length > 2 && !palabrasIgnorar.has(p))
}

// Calcular similitud entre dos conjuntos de palabras
function calcularSimilitud(palabras1: string[], palabras2: string[]): number {
  if (palabras1.length === 0 || palabras2.length === 0) return 0
  
  let coincidencias = 0
  palabras1.forEach(p1 => {
    if (palabras2.some(p2 => p2.includes(p1) || p1.includes(p2))) {
      coincidencias++
    }
  })
  
  const maxPalabras = Math.max(palabras1.length, palabras2.length)
  return coincidencias / maxPalabras
}

// Buscar el mejor match para un nombre
function buscarMejorMatch(
  nombreBuscado: string,
  empleados: any[]
): { empleado: any; similitud: number } | null {
  const palabrasBuscadas = extraerPalabrasClave(nombreBuscado)
  
  let mejorMatch: any = null
  let mejorSimilitud = 0
  
  for (const emp of empleados) {
    const palabrasEmpleado = extraerPalabrasClave(emp.nombre_completo)
    const similitud = calcularSimilitud(palabrasBuscadas, palabrasEmpleado)
    
    if (similitud > mejorSimilitud && similitud >= 0.4) {
      mejorSimilitud = similitud
      mejorMatch = emp
    }
  }
  
  return mejorMatch ? { empleado: mejorMatch, similitud: mejorSimilitud } : null
}

// Función inteligente para limpiar precios
function limpiarPrecio(precioInput: any): number {
  if (precioInput === null || precioInput === undefined) return 0
  
  // Si ya es un número, usarlo directamente
  if (typeof precioInput === 'number') {
    return isNaN(precioInput) ? 0 : precioInput
  }
  
  let precioStr = String(precioInput).trim()
  
  // Eliminar símbolo de dólar y espacios
  precioStr = precioStr.replace(/[\$\s]/g, '')
  
  if (precioStr === '') return 0
  
  // Detectar formato:
  // Si tiene coma Y punto: formato anglosajón (38,278.03) - coma es miles, punto es decimal
  // Si solo tiene coma: formato argentino (38278,03) - coma es decimal
  // Si solo tiene punto: formato anglosajón simple (38278.03) - punto es decimal
  
  if (precioStr.includes(',') && precioStr.includes('.')) {
    // Formato anglosajón: 38,278.03 → eliminar comas (separador de miles)
    precioStr = precioStr.replace(/,/g, '')
  } else if (precioStr.includes(',') && !precioStr.includes('.')) {
    // Formato argentino: 38278,03 → reemplazar coma por punto (decimal)
    precioStr = precioStr.replace(',', '.')
  }
  // Si solo tiene punto o no tiene nada, ya está en formato correcto
  
  const precio = parseFloat(precioStr)
  return isNaN(precio) ? 0 : precio
}

// Verificar si una fila es un header repetido
function esHeaderRepetido(row: any): boolean {
  const primeraColumna = String(row['Actividad'] || row['actividad'] || '').trim()
  return primeraColumna === 'Actividad' || primeraColumna === ''
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    
    // Buscar la hoja "Detalle" o la primera hoja disponible
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('detalle')) || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

    console.log(`📊 Total de filas leídas de la hoja "${sheetName}": ${data.length}`)

    if (data.length === 0) {
      return NextResponse.json({ error: 'La hoja de cálculo está vacía' }, { status: 400 })
    }

    // Obtener todos los empleados
    const { data: empleados, error: errorEmpleados } = await supabase
      .from('empleados')
      .select('id, nombre_completo')

    if (errorEmpleados) throw errorEmpleados

    console.log(`👥 Total de empleados en la base de datos: ${empleados?.length || 0}`)

    const actividadesParaInsertar = []
    const tecnicosProcesados = new Map<string, { encontrado: boolean; empleadoId?: string }>()
    const detallesMatching: Array<{ tecnico: string; encontrado: boolean; similitud?: number; empleado?: string }> = []
    let preciosDebug: number[] = []
    let filasSaltadas = 0

    for (const row of data) {
      // Saltar filas de headers repetidos
      if (esHeaderRepetido(row)) {
        filasSaltadas++
        continue
      }

      // Buscar el nombre del técnico de forma flexible
      const tecnicoNombre = String(
        row['Técnico'] || row['Tecnico'] || row['tecnico'] || row['TÉCNICO'] || ''
      ).trim()
      
      if (!tecnicoNombre) continue

      // Buscar el precio de forma flexible
      const precioRaw = row['Precio'] || row['precio'] || row['Precio '] || row[' precio'] || row['PRECIO'] || 0
      const precio = limpiarPrecio(precioRaw)
      preciosDebug.push(precio)

      // Buscar la fecha
      const fechaRaw = String(
        row['Fecha Actividad'] || row['FechaActividad'] || row['fecha_actividad'] || row['Fecha'] || row['FECHA ACTIVIDAD'] || ''
      ).trim()

      // Si ya procesamos este técnico, reusar el resultado
      if (tecnicosProcesados.has(tecnicoNombre)) {
        const info = tecnicosProcesados.get(tecnicoNombre)!
        if (!info.encontrado || !info.empleadoId) continue
        
        let fechaActividad = null
        if (fechaRaw.includes('.')) {
          const [dia, mes, anio] = fechaRaw.split('.')
          if (dia && mes && anio) {
            fechaActividad = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
          }
        }

        actividadesParaInsertar.push({
          actividad_id: String(row['Actividad'] || row['actividad'] || ''),
          orden_id: String(row['Orden'] || row['Orden Trab.  STL/TOA'] || row['orden'] || row['ORDEN'] || ''),
          tipo_tramite: String(row['Tipo Trámite'] || row['Tipo Tramite'] || row['tipo_tramite'] || row['TIPO TRÁMITE'] || ''),
          denominacion: String(row['Denominación'] || row['Denominacion'] || row['Descrip. Trámite'] || row['Descrip. Tramite'] || row['DESCRIPCIÓN SERVICIO'] || ''),
          servicio_id: String(row['Servicio'] || row['servicio'] || row['SERVICIO'] || ''),
          precio: precio,
          empleado_id: info.empleadoId,
          tecnico_nombre: tecnicoNombre,
          provincia: String(row['Provincia'] || row['provincia'] || row['Tipo de Agrupador'] || row['PROVINCIA'] || ''),
          centro: String(row['Centro'] || row['centro'] || row['Orden de Compra'] || row['CENTRO'] || ''),
          fecha_actividad: fechaActividad
        })
        continue
      }

      // Buscar el mejor match para este técnico
      const match = buscarMejorMatch(tecnicoNombre, empleados || [])

      if (!match) {
        tecnicosProcesados.set(tecnicoNombre, { encontrado: false })
        detallesMatching.push({ tecnico: tecnicoNombre, encontrado: false })
        continue
      }

      tecnicosProcesados.set(tecnicoNombre, { encontrado: true, empleadoId: match.empleado.id })
      detallesMatching.push({ 
        tecnico: tecnicoNombre, 
        encontrado: true, 
        similitud: match.similitud,
        empleado: match.empleado.nombre_completo 
      })

      let fechaActividad = null
      if (fechaRaw.includes('.')) {
        const [dia, mes, anio] = fechaRaw.split('.')
        if (dia && mes && anio) {
          fechaActividad = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
        }
      }

      actividadesParaInsertar.push({
        actividad_id: String(row['Actividad'] || row['actividad'] || ''),
        orden_id: String(row['Orden'] || row['Orden Trab.  STL/TOA'] || row['orden'] || row['ORDEN'] || ''),
        tipo_tramite: String(row['Tipo Trámite'] || row['Tipo Tramite'] || row['tipo_tramite'] || row['TIPO TRÁMITE'] || ''),
        denominacion: String(row['Denominación'] || row['Denominacion'] || row['Descrip. Trámite'] || row['Descrip. Tramite'] || row['DESCRIPCIÓN SERVICIO'] || ''),
        servicio_id: String(row['Servicio'] || row['servicio'] || row['SERVICIO'] || ''),
        precio: precio,
        empleado_id: match.empleado.id,
        tecnico_nombre: tecnicoNombre,
        provincia: String(row['Provincia'] || row['provincia'] || row['Tipo de Agrupador'] || row['PROVINCIA'] || ''),
        centro: String(row['Centro'] || row['centro'] || row['Orden de Compra'] || row['CENTRO'] || ''),
        fecha_actividad: fechaActividad
      })
    }

    // Log de debug
    console.log(`🔍 Filas saltadas (headers): ${filasSaltadas}`)
    console.log(`📊 Total de actividades para insertar: ${actividadesParaInsertar.length}`)
    console.log(` Primeros 10 precios: ${preciosDebug.slice(0, 10)}`)
    console.log(`💰 Suma total de precios: ${preciosDebug.reduce((a, b) => a + b, 0)}`)
    console.log(`👥 Técnicos únicos: ${tecnicosProcesados.size}`)
    console.log(`✅ Técnicos encontrados: ${detallesMatching.filter(d => d.encontrado).length}`)
    console.log(`❌ Técnicos no encontrados: ${detallesMatching.filter(d => !d.encontrado).map(d => d.tecnico)}`)

    // Insertar en Supabase
    let insertados = 0
    if (actividadesParaInsertar.length > 0) {
      const { error: errorInsert } = await supabase
        .from('actividades_diarias')
        .insert(actividadesParaInsertar)
      
      if (errorInsert) {
        console.error('❌ Error insertando:', errorInsert)
        throw errorInsert
      }
      insertados = actividadesParaInsertar.length
    }

    const noEncontrados = detallesMatching.filter(d => !d.encontrado).map(d => d.tecnico)

    return NextResponse.json({
      success: true,
      totalFilas: data.length,
      filasSaltadas: filasSaltadas,
      insertadas: insertados,
      noEncontrados: noEncontrados,
      tecnicosUnicos: tecnicosProcesados.size,
      tecnicosEncontrados: detallesMatching.filter(d => d.encontrado).length,
      detallesMatching: detallesMatching.filter(d => d.encontrado),
      debugPrecios: {
        primeros10: preciosDebug.slice(0, 10),
        sumaTotal: preciosDebug.reduce((a, b) => a + b, 0)
      }
    })

  } catch (error: any) {
    console.error('❌ Error importando productividad:', error)
    return NextResponse.json({ 
      error: error.message || 'Error desconocido al procesar el archivo' 
    }, { status: 500 })
  }
}