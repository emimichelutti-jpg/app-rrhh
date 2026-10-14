import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sanitizeFilename(filename: string): string {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
}

function normalizarCUIL(cuil: string): string {
  return String(cuil).replace(/[-\s]/g, '').trim()
}

function determinarQuincena(quincenaExtraida: string | null | undefined, tipoRecibo: string): string {
  if (tipoRecibo === 'Mensual') return 'Mensual'
  const tiposIndependientes = ['sac_1ra', 'sac_2da', 'vacaciones', 'bono']
  if (tiposIndependientes.includes(tipoRecibo)) return 'N/A'
  if (quincenaExtraida && ['1ra', '2da', 'Mensual'].includes(quincenaExtraida)) {
    return quincenaExtraida
  }
  return '1ra'
}

function determinarPeriodo(
  periodoExtraido: string | null | undefined, 
  tipoRecibo: string, 
  añoActual: number,
  periodoForzado?: string
): string {
  if (periodoForzado) return periodoForzado
  if (tipoRecibo === 'sac_1ra') return `${añoActual}-06`
  if (tipoRecibo === 'sac_2da') return `${añoActual}-12`
  return periodoExtraido || new Date().toISOString().slice(0, 7)
}

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

function getNombreMes(periodo: string): string {
  if (!periodo) return ''
  const parts = periodo.split('-')
  if (parts.length < 2) return periodo
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${meses[parseInt(parts[1]) - 1] || parts[1]} ${parts[0]}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { archivos, tipo_recibo = 'normal', periodo_forzado } = body

    console.log(' [ROUTE] Request recibido:', { cantidadArchivos: archivos?.length, tipo_recibo, periodo_forzado })

    if (!archivos || archivos.length === 0) {
      return NextResponse.json({ error: 'No hay archivos' }, { status: 400 })
    }

    console.log('⬇️ [ROUTE] Descargando PDFs de Supabase...')
    const pdfsSubidos = await Promise.all(
      archivos.map(async (item: any) => {
        const pdfUrl = typeof item === 'string' ? item : item.pdfUrl
        const fileName = typeof item === 'string' ? item.split('/').pop() : item.fileName
        
        const response = await fetch(pdfUrl)
        if (!response.ok) throw new Error(`No se pudo descargar: ${pdfUrl}`)
        const buffer = await response.arrayBuffer()
        return { fileName, pdfUrl, buffer }
      })
    )

    const formData = new FormData()
    pdfsSubidos.forEach(({ fileName, buffer }) => {
      const safeFileName = sanitizeFilename(fileName)
      formData.append('files', new Blob([buffer], { type: 'application/pdf' }), safeFileName)
    })

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    console.log(`🔗 [ROUTE] Conectando con backend: ${backendUrl}/extraer-lote-recibos`)

    let backendResponse
    try {
      backendResponse = await fetch(`${backendUrl}/extraer-lote-recibos`, {
        method: 'POST',
        body: formData,
      })
    } catch (fetchError: any) {
      console.error('❌ [ROUTE] Error de RED conectando con backend:', fetchError.message)
      throw new Error(`No se pudo conectar con el backend Python (${backendUrl}). Verificá que la URL en Vercel sea correcta y que Railway esté Online.`)
    }

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('❌ [ROUTE] Backend respondió con error:', backendResponse.status, errorText.substring(0, 200))
      
      let errorMsg = `Backend Python respondió ${backendResponse.status}`
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
        errorMsg += ' (El backend devolvió una página HTML de error. Revisá los logs de Railway).'
      } else {
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg += `: ${errorJson.detail || errorText}`
        } catch {
          errorMsg += `: ${errorText}`
        }
      }
      throw new Error(errorMsg)
    }

    let recibosExtraidos: any[]
    try {
      recibosExtraidos = await backendResponse.json()
    } catch (jsonError) {
      console.error('❌ [ROUTE] Error parseando JSON del backend:', jsonError)
      throw new Error('El backend no devolvió un JSON válido. Revisá los logs de Railway.')
    }

    console.log(`✅ [ROUTE] Backend extrajo ${recibosExtraidos.length} recibos`)

    if (recibosExtraidos.length === 0) {
      return NextResponse.json({ success: true, exitosos: 0, fallidos: 0, recibos: [], errores: ['No se encontraron recibos'] })
    }

    const cuilsUnicos = [...new Set(recibosExtraidos.map((r) => normalizarCUIL(r.cuil)))]
    const { data: empleadosExistentes } = await supabase
      .from('empleados')
      .select('id, cuil, nombre_completo')
      .in('cuil', cuilsUnicos)

    const empleadosMap = new Map((empleadosExistentes || []).map((emp) => [normalizarCUIL(emp.cuil), emp]))

    const cuilsFaltantes = cuilsUnicos.filter((cuil) => !empleadosMap.has(cuil))
    if (cuilsFaltantes.length > 0) {
      const nuevos = cuilsFaltantes.map((cuil) => {
        const recibo = recibosExtraidos.find((r) => normalizarCUIL(r.cuil) === cuil)
        return { cuil, nombre_completo: recibo?.nombre_completo || 'Desconocido', email: `emp_${cuil}@movilsat.com.ar`, activo: true, rol: 'empleado' }
      })
      const { data: creados } = await supabase.from('empleados').insert(nuevos).select('id, cuil, nombre_completo')
      creados?.forEach((emp) => empleadosMap.set(normalizarCUIL(emp.cuil), emp))
    }

    const añoActual = new Date().getFullYear()
    const recibosFinales = []

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
        const bufferIndividual = await recortarPaginaPDF(archivoCorrecto.buffer, paginaRecibo)
        const cleanFileName = `individuales/${cuil}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('recibos-originales')
          .upload(cleanFileName, bufferIndividual, { contentType: 'application/pdf', upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('recibos-originales').getPublicUrl(cleanFileName)
          urlFinal = urlData.publicUrl
        }
      } catch (err) {
        console.error(`⚠️ [ROUTE] Excepción al procesar PDF para ${cuil}:`, err)
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

    const recibosUnicos = new Map()
    recibosFinales.forEach((r) => {
      const key = `${r.empleado_id}-${r.periodo}-${r.quincena}-${r.tipo_recibo}`
      if (!recibosUnicos.has(key)) recibosUnicos.set(key, r)
    })

    let exitosos = 0, fallidos = 0
    const erroresDetalle: string[] = []

    for (const recibo of recibosUnicos.values()) {
      const { error } = await supabase.from('recibos_sueldo').upsert(recibo, {
        onConflict: 'empleado_id,periodo,quincena,tipo_recibo',
      })
      
      if (error) { 
        fallidos++
        erroresDetalle.push(`CUIL ${recibo.cuil}: ${error.message}`) 
      } else { 
        exitosos++
        const { data: reciboExistente } = await supabase.from('recibos_sueldo').select('id').eq('empleado_id', recibo.empleado_id).eq('periodo', recibo.periodo).eq('quincena', recibo.quincena).eq('tipo_recibo', recibo.tipo_recibo).maybeSingle()
        
        if (!reciboExistente) {
          const nombreMes = getNombreMes(recibo.periodo)
          const quincenaTexto = recibo.quincena === 'N/A' || recibo.quincena === 'Mensual' ? '' : ` (${recibo.quincena} quincena)`
          
          const { error: notifError } = await supabase.from('notificaciones').insert({
            empleado_id: recibo.empleado_id,
            tipo: 'nuevo_recibo',
            titulo: `📄 Nuevo recibo disponible`,
            mensaje: `Ya podés ver y firmar tu recibo de ${nombreMes}${quincenaTexto}.`,
            link: '/empleado/recibos',
            leido: false
          })
          if (notifError) console.error(`⚠️ Error creando notificación:`, notifError.message)
        }
      }
    }

    return NextResponse.json({
      success: true, exitosos, fallidos,
      recibos: Array.from(recibosUnicos.values()).map((r) => ({
        nombre: empleadosMap.get(r.cuil)?.nombre_completo || r.cuil,
        cuil: r.cuil, neto: r.neto_a_cobrar, periodo: r.periodo, quincena: r.quincena, tipo_recibo: r.tipo_recibo
      })),
      errores: erroresDetalle,
    })
  } catch (error: any) {
    console.error('❌ [ROUTE] Error general:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error desconocido', 
      exitosos: 0, 
      fallidos: 1, 
      recibos: [], 
      errores: [error.message] 
    }, { status: 500 })
  }
}