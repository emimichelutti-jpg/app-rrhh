import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Función para normalizar texto (quitar acentos, minúsculas, espacios extra)
function normalizarTexto(texto: string): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
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
    
    // Buscamos la hoja "Detalle" o la primera hoja disponible
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('detalle')) || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

    if (data.length === 0) {
      return NextResponse.json({ error: 'La hoja de cálculo está vacía' }, { status: 400 })
    }

    // 1. Obtener todos los empleados para hacer el matching
    const { data: empleados, error: errorEmpleados } = await supabase
      .from('empleados')
      .select('id, nombre_completo')

    if (errorEmpleados) throw errorEmpleados

    // Crear un mapa de nombre normalizado -> empleado
    const empleadosMap = new Map<string, any>()
    empleados?.forEach(emp => {
      const nombreNormalizado = normalizarTexto(emp.nombre_completo)
      empleadosMap.set(nombreNormalizado, emp)
    })

    const actividadesParaInsertar = []
    const erroresMatching = new Set<string>()

    // 2. Procesar cada fila del Excel
    for (const row of data) {
      const tecnicoNombre = String(row['Técnico'] || row['Tecnico'] || '').trim()
      if (!tecnicoNombre || tecnicoNombre === 'Técnico') continue // Saltar headers o vacíos

      const nombreNormalizado = normalizarTexto(tecnicoNombre)
      const empleado = empleadosMap.get(nombreNormalizado)

      if (!empleado) {
        erroresMatching.add(tecnicoNombre)
        continue // Si no encontramos al empleado, lo registramos pero no insertamos la actividad
      }

      // Limpiar el precio (puede venir como "$ 38.278,03" o "38278.03")
      let precioStr = String(row['Precio'] || '0')
      precioStr = precioStr.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
      const precio = parseFloat(precioStr) || 0

      // Formatear fecha (viene como "12.10.2026" -> "2026-10-12")
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

    // 3. Insertar en Supabase en lotes de 1000
    let insertados = 0
    if (actividadesParaInsertar.length > 0) {
      const { error: errorInsert } = await supabase
        .from('actividades_diarias')
        .insert(actividadesParaInsertar)
      
      if (errorInsert) throw errorInsert
      insertados = actividadesParaInsertar.length
    }

    return NextResponse.json({
      success: true,
      totalFilas: data.length,
      insertadas: insertados,
      noEncontrados: Array.from(erroresMatching)
    })

  } catch (error: any) {
    console.error('❌ Error importando productividad:', error)
    return NextResponse.json({ 
      error: error.message || 'Error desconocido al procesar el archivo' 
    }, { status: 500 })
  }
}