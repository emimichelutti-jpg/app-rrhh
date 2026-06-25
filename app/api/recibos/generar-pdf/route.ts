import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { reciboId } = await request.json()

    if (!reciboId) {
      return NextResponse.json({ error: 'Falta reciboId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Obtener datos del recibo
    const { data: recibo, error: errorRecibo } = await supabase
      .from('recibos_sueldo')
      .select(`
        id, periodo, quincena, neto_a_cobrar, estado_firma, estado,
        fecha_firma, firma_imagen_url, firma_hash, ip_firmante,
        pdf_original_url,
        empleados (nombre_completo, cuil)
      `)
      .eq('id', reciboId)
      .single()

    if (errorRecibo || !recibo) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
    }

    // 2. Si NO hay PDF original, generar uno nuevo (fallback)
    if (!recibo.pdf_original_url) {
      console.log('⚠️ No hay PDF original, generando PDF nuevo')
      return await generarPDFNuevo(supabase, recibo)
    }

    // 3. Descargar PDF original
    console.log('📥 Descargando PDF original:', recibo.pdf_original_url)
    const pdfResponse = await fetch(recibo.pdf_original_url)
    if (!pdfResponse.ok) {
      console.error('❌ Error descargando PDF original')
      return await generarPDFNuevo(supabase, recibo)
    }

    const pdfOriginalBytes = await pdfResponse.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfOriginalBytes)
    const pages = pdfDoc.getPages()

    console.log(`📄 PDF tiene ${pages.length} página(s)`)

    // 4. Si está firmado, incrustar la firma
    if (recibo.firma_imagen_url && (recibo.estado_firma === 'firmado' || recibo.estado === 'firmado')) {
      console.log('✍️ Incrustando firma en PDF...')

      try {
        // Extraer base64
        const base64Data = recibo.firma_imagen_url.includes(',')
          ? recibo.firma_imagen_url.split(',')[1]
          : recibo.firma_imagen_url

        const firmaBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

        // 🔍 DETECTAR FORMATO
        const esPNG = firmaBytes[0] === 0x89 && firmaBytes[1] === 0x50 && firmaBytes[2] === 0x4E && firmaBytes[3] === 0x47
        const esJPEG = firmaBytes[0] === 0xFF && firmaBytes[1] === 0xD8 && firmaBytes[2] === 0xFF

        console.log(`🔍 Formato detectado: ${esPNG ? 'PNG' : esJPEG ? 'JPEG' : 'Desconocido'}`)

        let firmaImage
        if (esPNG) {
          firmaImage = await pdfDoc.embedPng(firmaBytes)
          console.log('✅ Firma cargada como PNG')
        } else if (esJPEG) {
          // ⚠️ PROBLEMA CON JPEG: pdf-lib no maneja bien JPEGs
          // Intentamos cargar como JPEG, pero si falla o se ve negro,
          // necesitamos que el frontend guarde la firma como PNG
          console.warn('⚠️ La firma es JPEG, puede haber problemas de visualización')
          console.log('💡 Recomendación: Configurar el canvas para guardar como PNG')
          firmaImage = await pdfDoc.embedJpg(firmaBytes)
          console.log('✅ Firma cargada como JPEG')
        } else {
          console.warn('⚠️ Formato no detectado, intentando como PNG...')
          firmaImage = await pdfDoc.embedPng(firmaBytes)
        }

        // Posicionar la firma
        const primeraPagina = pages[0]
        const { width: pageWidth, height: pageHeight } = primeraPagina.getSize()

        //  Coordenadas del área de firma (sobre "FIRMA DEL EMPLEADO")
        const anchoFirma = 130
        const altoFirma = 60
        const xFirma = 710  // Más a la derecha
        const yFirma = 10   // Un poco más arriba

        primeraPagina.drawImage(firmaImage, {
          x: xFirma,
          y: yFirma,
          width: anchoFirma,
          height: altoFirma
        })

        console.log(`✅ Firma incrustada en posición: x=${xFirma}, y=${yFirma}, tamaño: ${anchoFirma}x${altoFirma}`)

        // Agregar texto de fecha de firma
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        if (recibo.fecha_firma) {
          primeraPagina.drawText(
            `Firmado: ${new Date(recibo.fecha_firma).toLocaleString('es-AR')}`,
            {
              x: xFirma,
              y: yFirma - 15,
              size: 7,
              font,
              color: rgb(0.3, 0.3, 0.3)
            }
          )
        }

      } catch (error) {
        console.error('⚠️ Error incrustando firma:', error)
      }
    }

    // 5. Guardar el PDF modificado
    const pdfBytes = await pdfDoc.save()

    // 6. Subir al bucket de recibos firmados
    const fileName = `${recibo.empleados.cuil}_${recibo.periodo}_${recibo.quincena}_firmado.pdf`

    const { error: uploadError } = await supabase.storage
      .from('recibos-firmados')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) throw uploadError

    // 7. Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('recibos-firmados')
      .getPublicUrl(fileName)

    // 8. Actualizar recibo con la URL del PDF firmado
    await supabase
      .from('recibos_sueldo')
      .update({ pdf_url: publicUrl })
      .eq('id', reciboId)

    return NextResponse.json({
      success: true,
      pdfUrl: publicUrl,
      mensaje: 'PDF generado con firma incrustada'
    })

  } catch (error: any) {
    console.error('❌ Error generando PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Función fallback para generar PDF nuevo (si no hay PDF original)
async function generarPDFNuevo(supabase: any, recibo: any) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { height } = page.getSize()
  let y = height - 40

  page.drawText('MOVILSAT COMUNICACIONES SA', { x: 50, y, size: 14, font: boldFont })
  y -= 18
  page.drawText('Recibo de Sueldo', { x: 50, y, size: 12, font: boldFont })
  y -= 30

  page.drawText('DATOS DEL EMPLEADO:', { x: 50, y, size: 11, font: boldFont })
  y -= 20

  page.drawText('APELLIDO Y NOMBRE:', { x: 50, y, size: 9, font: boldFont })
  page.drawText(recibo.empleados.nombre_completo, { x: 200, y, size: 9, font })
  y -= 16

  page.drawText('CUIL:', { x: 50, y, size: 9, font: boldFont })
  page.drawText(recibo.empleados.cuil, { x: 200, y, size: 9, font })
  y -= 16

  y -= 10
  page.drawText(`PERIODO: ${recibo.periodo} - ${recibo.quincena}`, { x: 50, y, size: 11, font: boldFont })
  y -= 25

  page.drawText('NETO A COBRAR:', { x: 50, y, size: 13, font: boldFont })
  page.drawText(`$${recibo.neto_a_cobrar.toLocaleString('es-AR')}`, { x: 400, y, size: 14, font: boldFont })
  y -= 40

  // Incrustar firma si existe
  if (recibo.firma_imagen_url && (recibo.estado_firma === 'firmado' || recibo.estado === 'firmado')) {
    try {
      const base64Data = recibo.firma_imagen_url.includes(',')
        ? recibo.firma_imagen_url.split(',')[1]
        : recibo.firma_imagen_url

      const firmaBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      
      const esPNG = firmaBytes[0] === 0x89 && firmaBytes[1] === 0x50
      const esJPEG = firmaBytes[0] === 0xFF && firmaBytes[1] === 0xD8
      
      let firmaImage
      if (esPNG) {
        firmaImage = await pdfDoc.embedPng(firmaBytes)
      } else {
        firmaImage = await pdfDoc.embedJpg(firmaBytes)
      }

      page.drawImage(firmaImage, {
        x: 400,
        y: y - 80,
        width: firmaImage.width * 0.4,
        height: firmaImage.height * 0.4
      })
      y -= 100
    } catch (error) {
      console.error('Error incrustando firma:', error)
    }
  }

  y -= 20
  page.drawText('DOCUMENTO FIRMADO DIGITALMENTE', { x: 50, y, size: 9, font: boldFont, color: rgb(0, 0.4, 0) })
  y -= 15

  if (recibo.fecha_firma) {
    page.drawText(`Fecha: ${new Date(recibo.fecha_firma).toLocaleString('es-AR')}`, { x: 50, y, size: 8, font })
    y -= 12
  }

  if (recibo.firma_hash) {
    page.drawText(`Hash: ${recibo.firma_hash.substring(0, 32)}...`, { x: 50, y, size: 7, font })
  }

  const pdfBytes = await pdfDoc.save()

  const fileName = `${recibo.empleados.cuil}_${recibo.periodo}_${recibo.quincena}_firmado.pdf`

  const { error: uploadError } = await supabase.storage
    .from('recibos-firmados')
    .upload(fileName, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('recibos-firmados')
    .getPublicUrl(fileName)

  await supabase
    .from('recibos_sueldo')
    .update({ pdf_url: publicUrl })
    .eq('id', recibo.id)

  return NextResponse.json({
    success: true,
    pdfUrl: publicUrl,
    mensaje: 'PDF generado (sin original)'
  })
}