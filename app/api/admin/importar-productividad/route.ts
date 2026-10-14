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

// Extraer palabras clave de un nombre (ignora palabras cortas como "de", "la", etc.)
function extraerPalabrasClave(nombre: string): Set<string> {
  const palabrasIgnorar = new Set(['de', 'la', 'del', 'los', 'las', 'y', 'e', 'el'])
  return new Set(
    normalizarTexto(nombre)
      .split(' ')
      .filter(p => p.length > 2 && !palabrasIgnorar.has(p))
  )
}

// Calcular similitud entre dos conjuntos de palabras
function calcularSimilitud(palabras1: Set<string>, palabras2: Set<string>): number {
  let coincidencias = 0
  palabras1.forEach(p => {
    if (palabras2.has(p)) coincidencias++
  })
  const total = Math.max(palabras1.size, palabras2.size)
  return total > 0 ? coincidencias / total : 0
}

// Buscar el mejor match para un nombre
function buscarMejorMatch(
  nombreBuscado: string,
  empleadosMap: Map<string, any>,
  empleadosLista: any[]
): any | null {
  const nombreNorm = normalizarTexto(nombreBuscado)
  
  // 1. Intentar match exacto primero
  if (empleadosMap.has(nombreNorm)) {
    return empleadosMap.get(nombreNorm)
  }
  
  // 2. Extraer palabras clave del nombre buscado
  const palabrasBuscadas = extraerPalabrasClave(nombreBuscado)
  
  let mejorMatch: any = null
  let mejorSimilitud = 0
  
  // 3. Comparar con todos los empleados
  for (const emp of empleadosLista) {
    const palabrasEmpleado = extraerPalabrasClave(emp.nombre_completo)
    const similitud = calcularSimilitud(palabrasBuscadas, palabrasEmpleado)
    
    if (similitud > mejorSimilitud && similitud >= 0.5) { // 50% de similitud mínima
      mejorSimilitud = similitud
      mejorMatch = emp
    }
  }
  
  return mejorMatch
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

    // Crear mapa para búsqueda exacta rápida
    const empleadosMap = new Map<string, any>()
    empleados?.forEach(emp => {
      const nombreNormalizado = normalizarTexto(emp.nombre_completo)
      empleadosMap.set(nombreNormalizado, emp)
    })

    const actividadesParaInsertar = []
    const tecnicosProcesados = new Map<string, { encontrado: boolean, nombre: string }>()

    // Procesar cada fila
    for (const row of data) {
      const tecnicoNombre = String(row['Técnico'] || row['Tecnico'] || '').trim()
      if (!tecnicoNombre || tecnicoNombre === 'Técnico') continue

      // Verificar si ya procesamos este técnico
      if (tecnicosProcesados.has(tecnicoNombre)) {
        const info = tecnicosProcesados.get(tecnicoNombre)!
        if (!info.encontrado) continue
        // Si ya lo encontramos antes, usar el mismo empleado
        const empleado = empleados.find(e => e.id === info.nombre)
        if (!empleado) continue
        
        // Procesar la fila con este empleado
        let precioStr = String(row['Precio'] || '0')
        precioStr = precioStr.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
        const precio = parseFloat(precioStr) || 0

        let fechaActividad = null
        const fechaStr = String(row['Fecha Actividad'] || '')
        if (fechaStr.includes('.')) {
          const [dia, mes, anio] = fechaStr.split('.')
          if (dia && mes && anio) {
            fechaActividad = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
          }
        }

        actividadesParaInsertar.push({
          actividad_id: String(row['Actividad'] || ''),
          orden_id: String(row['Orden'] || ''),
          tipo_tramite: String(row['Tipo Trámite'] || row['Tipo Tramite'] || ''),
          denominacion: String(row['Denominación'] || row['Denominacion'] || ''),
          servicio_id: String(row['Servicio'] || ''),
          precio: precio,
          empleado_id: empleado.id,
          tecnico_nombre: tecnicoNombre,
          provincia: String(row['Provincia'] || ''),
          centro: String(row['Centro'] || ''),
          fecha_actividad: fechaActividad
        })
        continue
      }

      // Buscar el mejor match
      const empleado = buscarMejorMatch(tecnicoNombre, empleadosMap, empleados || [])

      if (!empleado) {
        tecnicosProcesados.set(tecnicoNombre, { encontrado: false, nombre: tecnicoNombre })
        continue
      }

      tecnicosProcesados.set(tecnicoNombre, { encontrado: true, nombre: empleado.id })

      // Limpiar precio
      let precioStr = String(row['Precio'] || '0')
      precioStr = precioStr.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
      const precio = parseFloat(precioStr) || 0

      // Formatear fecha
      let fechaActividad = null
      const fechaStr = String(row['Fecha Actividad'] || '')
      if (fechaStr.includes('.')) {
        const [dia, mes, anio] = fechaStr.split('.')
        if (dia && mes && anio) {
          fechaActividad = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
        }
      }

      actividadesParaInsertar.push({
        actividad_id: String(row['Actividad'] || ''),
        orden_id: String(row['Orden'] || ''),
        tipo_tramite: String(row['Tipo Trámite'] || row['Tipo Tramite'] || ''),
        denominacion: String(row['Denominación'] || row['Denominacion'] || ''),
        servicio_id: String(row['Servicio'] || ''),
        precio: precio,
        empleado_id: empleado.id,
        tecnico_nombre: tecnicoNombre,
        provincia: String(row['Provincia'] || ''),
        centro: String(row['Centro'] || ''),
        fecha_actividad: fechaActividad
      })
    }

    // Insertar en lotes
    let insertados = 0
    if (actividadesParaInsertar.length > 0) {
      const { error: errorInsert } = await supabase
        .from('actividades_diarias')
        .insert(actividadesParaInsertar)
      
      if (errorInsert) throw errorInsert
      insertados = actividadesParaInsertar.length
    }

    const noEncontrados = Array.from(tecnicosProcesados.entries())
      .filter(([_, info]) => !info.encontrado)
      .map(([nombre, _]) => nombre)

    return NextResponse.json({
      success: true,
      totalFilas: data.length,
      insertadas: insertados,
      noEncontrados: noEncontrados,
      tecnicosUnicos: tecnicosProcesados.size,
      tecnicosEncontrados: tecnicosProcesados.size - noEncontrados.length
    })

  } catch (error: any) {
    console.error('❌ Error importando productividad:', error)
    return NextResponse.json({ 
      error: error.message || 'Error desconocido al procesar el archivo' 
    }, { status: 500 })
  }
}