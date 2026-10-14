import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizarTexto(texto: string): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function extraerPalabras(nombre: string): string[] {
  const palabrasIgnorar = new Set(['de', 'la', 'del', 'los', 'las', 'y', 'e', 'el'])
  return normalizarTexto(nombre)
    .split(/[\s,]+/)
    .filter(p => p.length > 2 && !palabrasIgnorar.has(p))
}

function calcularSimilitudMejorada(nombre1: string, nombre2: string): number {
  const palabras1 = extraerPalabras(nombre1)
  const palabras2 = extraerPalabras(nombre2)
  
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

function buscarMejorMatch(
  nombreBuscado: string,
  empleados: any[]
): { empleado: any; similitud: number } | null {
  const nombreNorm = normalizarTexto(nombreBuscado)
  
  let mejorMatch: any = null
  let mejorSimilitud = 0
  
  for (const emp of empleados) {
    const similitud = calcularSimilitudMejorada(nombreNorm, emp.nombre_completo)
    
    if (similitud > mejorSimilitud && similitud >= 0.3) {
      mejorSimilitud = similitud
      mejorMatch = emp
    }
  }
  
  return mejorMatch ? { empleado: mejorMatch, similitud: mejorSimilitud } : null
}

// ✅ FUNCIÓN MEJORADA: Limpia precios en CUALQUIER formato
function limpiarPrecio(precioInput: any): number {
  if (precioInput === null || precioInput === undefined) return 0
  
  // Si ya es un número, usarlo directamente
  if (typeof precioInput === 'number') {
    return isNaN(precioInput) ? 0 : precioInput
  }
  
  let precioStr = String(precioInput).trim()
  
  // Eliminar símbolo de dólar y TODOS los espacios
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

// ✅ FUNCIÓN NUEVA: Busca el valor de una columna de forma FLEXIBLE
function obtenerValor(row: any, nombresPosibles: string[]): any {
  for (const nombre of nombresPosibles) {
    // Buscar coincidencia exacta
    if (row[nombre] !== undefined && row[nombre] !== null && row[nombre] !== '') {
      return row[nombre]
    }
    
    // Buscar coincidencia parcial (ignorando mayúsculas/minúsculas)
    const nombreNorm = normalizarTexto(nombre)
    for (const key of Object.keys(row)) {
      if (normalizarTexto(key).includes(nombreNorm) || nombreNorm.includes(normalizarTexto(key))) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key]
        }
      }
    }
  }
  return null
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

    if (data.length === 0) {
      return NextResponse.json({ error: 'La hoja de cálculo está vacía' }, { status: 400 })
    }

    // Obtener todos los empleados
    const { data: empleados, error: errorEmpleados } = await supabase
      .from('empleados')
      .select('id, nombre_completo')

    if (errorEmpleados) throw errorEmpleados

    const actividadesParaInsertar = []
    const tecnicosProcesados = new Map<string, { encontrado: boolean; empleadoId?: string }>()
    const detallesMatching: Array<{ tecnico: string; encontrado: boolean; similitud?: number; empleado?: string }> = []
    let preciosDebug: number[] = []

    for (const row of data) {
      // ✅ BÚSQUEDA FLEXIBLE DE NOMBRE DE TÉCNICO (maneja ambos formatos)
      const tecnicoNombre = String(
        obtenerValor(row, ['Técnico', 'Tecnico', 'tecnico', 'TÉCNICO']) || ''
      ).trim()
      
      if (!tecnicoNombre || tecnicoNombre === 'Técnico' || tecnicoNombre === 'Tecnico') continue

      // ✅ BÚSQUEDA FLEXIBLE DE PRECIO (maneja ambos formatos)
      const precioRaw = obtenerValor(row, ['Precio', 'precio', 'Precio ', ' precio', 'PRECIO'])
      const precio = limpiarPrecio(precioRaw)
      preciosDebug.push(precio)

      // ✅ BÚSQUEDA FLEXIBLE DE FECHA
      const fechaRaw = String(
        obtenerValor(row, ['Fecha Actividad', 'FechaActividad', 'fecha_actividad', 'Fecha', 'FECHA ACTIVIDAD']) || ''
      ).trim()

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
          actividad_id: String(obtenerValor(row, ['Actividad', 'actividad', 'ACTIVIDAD']) || ''),
          orden_id: String(obtenerValor(row, ['Orden', 'Orden Trab.  STL/TOA', 'orden', 'ORDEN']) || ''),
          tipo_tramite: String(obtenerValor(row, ['Tipo Trámite', 'Tipo Tramite', 'tipo_tramite', 'TIPO TRÁMITE']) || ''),
          denominacion: String(obtenerValor(row, ['Denominación', 'Denominacion', 'Descrip. Trámite', 'Descrip. Tramite', 'DESCRIPCIÓN SERVICIO']) || ''),
          servicio_id: String(obtenerValor(row, ['Servicio', 'servicio', 'SERVICIO']) || ''),
          precio: precio,
          empleado_id: info.empleadoId,
          tecnico_nombre: tecnicoNombre,
          provincia: String(obtenerValor(row, ['Provincia', 'provincia', 'Tipo de Agrupador', 'PROVINCIA']) || ''),
          centro: String(obtenerValor(row, ['Centro', 'centro', 'Orden de Compra', 'CENTRO']) || ''),
          fecha_actividad: fechaActividad
        })
        continue
      }

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
        actividad_id: String(obtenerValor(row, ['Actividad', 'actividad', 'ACTIVIDAD']) || ''),
        orden_id: String(obtenerValor(row, ['Orden', 'Orden Trab.  STL/TOA', 'orden', 'ORDEN']) || ''),
        tipo_tramite: String(obtenerValor(row, ['Tipo Trámite', 'Tipo Tramite', 'tipo_tramite', 'TIPO TRÁMITE']) || ''),
        denominacion: String(obtenerValor(row, ['Denominación', 'Denominacion', 'Descrip. Trámite', 'Descrip. Tramite', 'DESCRIPCIÓN SERVICIO']) || ''),
        servicio_id: String(obtenerValor(row, ['Servicio', 'servicio', 'SERVICIO']) || ''),
        precio: precio,
        empleado_id: match.empleado.id,
        tecnico_nombre: tecnicoNombre,
        provincia: String(obtenerValor(row, ['Provincia', 'provincia', 'Tipo de Agrupador', 'PROVINCIA']) || ''),
        centro: String(obtenerValor(row, ['Centro', 'centro', 'Orden de Compra', 'CENTRO']) || ''),
        fecha_actividad: fechaActividad
      })
    }

    // Log de debug
    console.log('🔍 DEBUG PRECIOS - Primeros 10:', preciosDebug.slice(0, 10))
    console.log('📊 DEBUG PRECIOS - Total insertados:', actividadesParaInsertar.length)
    console.log('💰 DEBUG PRECIOS - Suma total:', preciosDebug.reduce((a, b) => a + b, 0))

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
    const encontrados = detallesMatching.filter(d => d.encontrado)

    return NextResponse.json({
      success: true,
      totalFilas: data.length,
      insertadas: insertados,
      noEncontrados: noEncontrados,
      tecnicosUnicos: tecnicosProcesados.size,
      tecnicosEncontrados: tecnicosProcesados.size - noEncontrados.length,
      detallesMatching: encontrados,
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