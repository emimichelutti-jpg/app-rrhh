import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizarCUIL(cuil: string): string {
  return String(cuil).replace(/[-\s]/g, '').trim()
}

function determinarQuincena(quincenaExtraida: string | null | undefined, tipoRecibo: string): string {
  const tiposIndependientes = ['sac_1ra', 'sac_2da', 'vacaciones', 'bono']
  if (tiposIndependientes.includes(tipoRecibo)) return 'N/A'
  if (quincenaExtraida && ['1ra', '2da'].includes(quincenaExtraida)) return quincenaExtraida
  return '1ra'
}

function determinarPeriodo(
  periodoExtraido: string | null | undefined, 
  tipoRecibo: string, 
  añoActual: number,
  periodoForzado?: string
): string {
  // 🆕 Si el usuario forzó un período manual, usarlo
  if (periodoForzado) return periodoForzado
  
  if (tipoRecibo === 'sac_1ra') return `${añoActual}-06`
  if (tipoRecibo === 'sac_2da') return `${añoActual}-12`
  return periodoExtraido || new Date().toISOString().slice(0, 7)
}

// ✅ FUNCIÓN: Recortar una página específica de un PDF
async function recortarPaginaPDF(bufferLote: ArrayBuffer, numeroPagina: number): Promise<Uint8Array> {
  try {
    const pdfLote = await PDFDocument.load(bufferLote)
    const pdfIndividual = await PDFDocument.create()
    
    const [paginaCopiada] = await pdfIndividual.copyPages(pdfLote, [numeroPagina - 1])
    pdfIndividual.addPage(paginaCopiada)
    
    return await pdfIndividual.save()
  } catch (error) {
    console.error(`❌ Error al recortar página ${numeroPagina}:`, error)
    throw error
  }
}

// 🆕 FUNCIÓN: Obtener nombre del mes en español
function getNombreMes(periodo: string): string {
  if (!periodo) return ''
  const parts = periodo.split('-')
  if (parts.length < 2) return periodo
  const year = parts[0]
  const month = parts[1]
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${meses[parseInt(month) - 1] || month} ${year}`
}

export async function POST(request: Request) {
  try {
    const { archivos, tipo_recibo = 'normal', periodo_forzado } = await request.json()

    if (!archivos || archivos.length === 0) {
      return NextResponse.json({ error: 'No hay archivos' }, { status: 400 })
    }

    console.log(`📥 Procesando ${archivos.length} archivos | Tipo: ${tipo_recibo} | Período forzado: ${periodo_forzado || 'auto'}`)

    // Descargar los PDFs subidos
    const pdfsSubidos = await Promise.all(
      archivos.map(async ({ pdfUrl, fileName }: { pdfUrl: string; fileName: string }) => {
        const response = await fetch(pdfUrl)
        const buffer = await response.arrayBuffer()
        return { fileName, pdfUrl, buffer }
      })
    )

    // Enviar al backend Python para extracción de datos
    const formData = new FormData()
    pdfsSubidos.forEach(({ fileName, buffer }) => {
      formData.append('files', new Blob([buffer], { type: 'application/pdf' }), fileName)
    })

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    const backendResponse = await fetch(`${backendUrl}/extraer-lote-recibos`, {
      method: 'POST',
      body: formData,
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend respondió ${backendResponse.status}`)
    }

    const recibosExtraidos: any[] = await backendResponse.json()
    console.log(`✅ Backend extrajo ${recibosExtraidos.length} recibos`)

    if (recibosExtraidos.length === 0) {
      return NextResponse.json({ success: true, exitosos: 0, fallidos: 0, recibos: [], errores: ['No se encontraron recibos'] })
    }

    // Buscar o crear empleados
    const cuilsUnicos = [...new Set(recibosExtraidos.map((r) => normalizarCUIL(r.cuil)))]
    const { data: empleadosExistentes } = await supabase.from('empleados').select('id, cuil, nombre_completo').in('cuil', cuilsUnicos)

    const empleadosMap = new Map((empleadosExistentes || []).map((emp) => [emp.cuil, emp]))

    const cuilsFaltantes = cuilsUnicos.filter((cuil) => !empleadosMap.has(cuil))
    if (cuilsFaltantes.length > 0) {
      const nuevos = cuilsFaltantes.map((cuil) => {
        const recibo = recibosExtraidos.find((r) => normalizarCUIL(r.cuil) === cuil)
        return { cuil, nombre_completo: recibo?.nombre_completo || 'Desconocido', email: `emp_${cuil}@movilsat.com.ar`, activo: true, rol: 'empleado' }
      })
      const { data: creados } = await supabase.from('empleados').insert(nuevos).select('id, cuil, nombre_completo')
      creados?.forEach((emp) => empleadosMap.set(emp.cuil, emp))
    }

    const añoActual = new Date().getFullYear()
    const recibosFinales = []

    // ✅ PROCESAR CADA RECIBO Y CREAR PDF INDIVIDUAL
    for (const recibo of recibosExtraidos) {
      const cuil = normalizarCUIL(recibo.cuil)
      const empleado = empleadosMap.get(cuil)
      if (!empleado) continue

      const nombreArchivo = String(recibo.archivo_origen || "").toLowerCase()
      const archivoCorrecto = pdfsSubidos.find((a) => {
        const fileNameLower = String(a.fileName || "").toLowerCase()
        return fileNameLower.includes(nombreArchivo) || nombreArchivo.includes(fileNameLower)
      }) || pdfsSubidos[0]

      let urlFinal = archivoCorrecto.pdfUrl
      const paginaRecibo = recibo.pagina || 1

      try {
        // ✅ RECORTAR SOLO LA PÁGINA CORRESPONDIENTE
        const bufferIndividual = await recortarPaginaPDF(archivoCorrecto.buffer, paginaRecibo)
        
        // Subir el PDF individual a Supabase
        const cleanFileName = `individuales/${cuil}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('recibos-originales')
          .upload(cleanFileName, bufferIndividual, { contentType: 'application/pdf', upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('recibos-originales').getPublicUrl(cleanFileName)
          urlFinal = urlData.publicUrl
          console.log(`✅ PDF individual creado: ${cleanFileName} (Página ${paginaRecibo})`)
        } else {
          console.error(`⚠️ Error subiendo PDF individual:`, uploadError)
        }
      } catch (err) {
        console.error(`⚠️ Excepción al procesar PDF para ${cuil}:`, err)
      }

      recibosFinales.push({
        empleado_id: empleado.id,
        cuil: cuil,
        periodo: determinarPeriodo(recibo.periodo, tipo_recibo, añoActual, periodo_forzado),
        quincena: determinarQuincena(recibo.quincena, tipo_recibo),
        tipo_recibo: tipo_recibo,
        neto_a_cobrar: recibo.neto_a_cobrar || 0,
        total_haberes: recibo.total_haberes || 0,
        sueldo_bruto: recibo.sueldo_bruto || 0,
        costo_total_empleador: recibo.costo_total_empleador || 0,
        aportes_trabajador: recibo.aportes_trabajador || 0,
        contribuciones_empleador: recibo.contribuciones_empleador || 0,
        legajo: recibo.legajo || null,
        pdf_original_url: urlFinal,
        pagina_recibo: paginaRecibo,
        estado: 'pendiente',
        estado_firma: 'pendiente',
      })
    }

    // Eliminar duplicados
    const recibosUnicos = new Map()
    recibosFinales.forEach((r) => {
      const key = `${r.empleado_id}-${r.periodo}-${r.quincena}-${r.tipo_recibo}`
      if (!recibosUnicos.has(key)) recibosUnicos.set(key, r)
    })

    // Guardar en base de datos y crear notificaciones
    let exitosos = 0, fallidos = 0
    const erroresDetalle: string[] = []

    for (const recibo of recibosUnicos.values()) {
      // 🆕 Verificar si el recibo ya existía antes del upsert
      const { data: reciboExistente } = await supabase
        .from('recibos_sueldo')
        .select('id, estado_firma')
        .eq('empleado_id', recibo.empleado_id)
        .eq('periodo', recibo.periodo)
        .eq('quincena', recibo.quincena)
        .eq('tipo_recibo', recibo.tipo_recibo)
        .maybeSingle()

      const esReciboNuevo = !reciboExistente

      // Upsert del recibo
      const { error } = await supabase.from('recibos_sueldo').upsert(recibo, {
        onConflict: 'empleado_id,periodo,quincena,tipo_recibo',
      })
      
      if (error) { 
        fallidos++
        erroresDetalle.push(`CUIL ${recibo.cuil}: ${error.message}`) 
      } else { 
        exitosos++
        
        // 🆕 Crear notificación si es un recibo nuevo
        if (esReciboNuevo) {
          const nombreMes = getNombreMes(recibo.periodo)
          const quincenaTexto = recibo.quincena === 'N/A' ? '' : ` (${recibo.quincena} quincena)`
          
          try {
            const { error: notifError } = await supabase.from('notificaciones').insert({
              empleado_id: recibo.empleado_id,
              tipo: 'nuevo_recibo',
              titulo: `📄 Nuevo recibo disponible`,
              mensaje: `Ya podés ver y firmar tu recibo de ${nombreMes}${quincenaTexto}.`,
              link: '/empleado/recibos',
              leido: false
            })

            if (notifError) {
              console.error(`⚠️ Error creando notificación para ${recibo.cuil}:`, notifError)
            } else {
              console.log(`🔔 Notificación enviada a ${recibo.cuil}`)
            }
          } catch (notifException) {
            console.error(`⚠️ Excepción al crear notificación para ${recibo.cuil}:`, notifException)
          }
        }
      }
    }

    console.log(`✅ Completado! Exitosos: ${exitosos}, Fallidos: ${fallidos}`)

    return NextResponse.json({
      success: true, exitosos, fallidos,
      recibos: Array.from(recibosUnicos.values()).map((r) => ({
        nombre: empleadosMap.get(r.cuil)?.nombre_completo || r.cuil,
        cuil: r.cuil, neto: r.neto_a_cobrar, periodo: r.periodo, quincena: r.quincena, tipo_recibo: r.tipo_recibo
      })),
      errores: erroresDetalle,
    })
  } catch (error: any) {
    console.error('⌛ Error general:', error)
    return NextResponse.json({ success: false, error: error.message, exitosos: 0, fallidos: 1, recibos: [], errores: [error.message] }, { status: 500 })
  }
}