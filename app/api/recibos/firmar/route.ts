import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createHash } from 'crypto'

export async function POST(request: Request) {
  try {
    const { reciboId, tipoFirma, empleadoId, ipFirmante } = await request.json()

    if (!reciboId || !empleadoId) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Obtener la firma registrada del empleado
    const { data: empleado, error: errorEmp } = await supabase
      .from('empleados')
      .select('firma_registrada_url, nombre_completo, cuil')
      .eq('id', empleadoId)
      .single()

    if (errorEmp || !empleado || !empleado.firma_registrada_url) {
      return NextResponse.json({ error: 'El empleado no tiene una firma digital registrada' }, { status: 400 })
    }

    // 2. Obtener el recibo
    const { data: recibo, error: errorRecibo } = await supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('id', reciboId)
      .single()

    if (errorRecibo || !recibo) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
    }

    // 3. Validación de firma secuencial
    const { data: recibosEmpleado } = await supabase
      .from('recibos_sueldo')
      .select('id, periodo, quincena, estado_firma')
      .eq('empleado_id', empleadoId)
      .order('periodo', { ascending: true })
      .order('quincena', { ascending: true })

    let hayPendienteAnterior = false
    let periodoBloqueante = ''
    for (const r of (recibosEmpleado || [])) {
      if (r.id === reciboId) break
      if (r.estado_firma === 'pendiente') {
        hayPendienteAnterior = true
        periodoBloqueante = `${r.periodo} ${r.quincena}`
        break
      }
    }

    if (hayPendienteAnterior) {
      return NextResponse.json({ 
        error: `Tenés un recibo pendiente del período ${periodoBloqueante}. Debés firmarlo primero.` 
      }, { status: 403 })
    }

    // 4. Procesar el PDF
    let pdfBytes: Uint8Array
    if (recibo.pdf_original_url) {
      const pdfResponse = await fetch(recibo.pdf_original_url)
      const buffer = await pdfResponse.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buffer)
      const pages = pdfDoc.getPages()
      const primeraPagina = pages[0]

      // Incrustar firma registrada
      const base64Data = empleado.firma_registrada_url.includes(',') 
        ? empleado.firma_registrada_url.split(',')[1] 
        : empleado.firma_registrada_url
      const firmaBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      const firmaImage = await pdfDoc.embedPng(firmaBytes)

      // Coordenadas (Centro-inferior)
      const xFirma = 230
      const yFirma = 25
      const anchoFirma = 150
      const altoFirma = 70

      primeraPagina.drawImage(firmaImage, { 
        x: xFirma, 
        y: yFirma, 
        width: anchoFirma, 
        height: altoFirma 
      })

      // Agregar fecha
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fechaStr = new Date().toLocaleString('es-AR')
      primeraPagina.drawText(`Firmado: ${fechaStr}`, { 
        x: xFirma, 
        y: yFirma - 15, 
        size: 7, 
        font, 
        color: rgb(0.3, 0.3, 0.3) 
      })

      // Si es NO CONFORME, agregar sello rojo
      if (tipoFirma === 'no_conforme') {
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        primeraPagina.drawText('NO CONFORME', {
          x: xFirma + anchoFirma + 10,
          y: yFirma + 20,
          size: 14,
          font: boldFont,
          color: rgb(0.8, 0.1, 0.1)
        })
      }

      pdfBytes = await pdfDoc.save()
    } else {
      return NextResponse.json({ error: 'No hay PDF original para firmar' }, { status: 400 })
    }

    // 5. Generar Hash y guardar en BD
    const firmaHash = createHash('sha256')
      .update(empleado.firma_registrada_url + reciboId + new Date().toISOString())
      .digest('hex')

    const { error: updateError } = await supabase
      .from('recibos_sueldo')
      .update({
        estado: 'firmado',
        estado_firma: tipoFirma === 'no_conforme' ? 'no_conforme' : 'firmado',
        fecha_firma: new Date().toISOString(),
        firma_hash: firmaHash,
        ip_firma: ipFirmante || '127.0.0.1',
        observaciones_firma: tipoFirma === 'no_conforme' ? 'Marcado como NO CONFORME' : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reciboId)

    if (updateError) {
      console.error('❌ Error actualizando BD:', updateError)
      throw updateError
    }

    // 6. Subir PDF firmado a Storage
    const fileName = `${empleado.cuil}_${recibo.periodo}_${recibo.quincena}_firmado.pdf`
    const { error: uploadError } = await supabase.storage
      .from('recibos-firmados')
      .upload(fileName, pdfBytes, { 
        contentType: 'application/pdf', 
        upsert: true 
      })

    if (uploadError) {
      console.error('❌ Error subiendo PDF:', uploadError)
      return NextResponse.json({ 
        error: 'Error al guardar el PDF firmado: ' + uploadError.message 
      }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('recibos-firmados')
      .getPublicUrl(fileName)

    console.log('✅ PDF firmado subido correctamente:', urlData.publicUrl)

    // 7. Actualizar recibo con la URL del PDF firmado
    const { error: updateUrlError } = await supabase
      .from('recibos_sueldo')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', reciboId)

    if (updateUrlError) {
      console.error('❌ Error actualizando pdf_url:', updateUrlError)
    }

    // ✅ RETORNO DE ÉXITO
    return NextResponse.json({ 
      success: true, 
      mensaje: 'Recibo procesado correctamente',
      pdfUrl: urlData.publicUrl
    })

  } catch (error: any) {
    // ✅ BLOQUE CATCH (Esto es lo que faltaba y causaba el error)
    console.error('❌ Error general firmando recibo:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}