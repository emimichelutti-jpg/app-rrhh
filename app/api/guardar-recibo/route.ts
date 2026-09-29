import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const archivo = formData.get('archivo') as File
    const cuil = formData.get('cuil') as string
    const nombreCompleto = formData.get('nombre_completo') as string
    const periodo = formData.get('periodo') as string
    const quincena = formData.get('quincena') as string
    const neto = formData.get('neto_a_cobrar') as string
    const legajo = formData.get('legajo') as string

    console.log('[API] Recibiendo:', {
      cuil,
      nombre: nombreCompleto,
      neto,
      tieneArchivo: !!archivo
    })

    if (!cuil) {
      return NextResponse.json({ error: 'Falta CUIL' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Buscar empleado por CUIL
    let { data: empData } = await supabase
      .from('empleados')
      .select('*')
      .eq('cuil', cuil)
      .single()

    let empleado_id = empData?.id

    // 2. Si no existe, crearlo
    if (!empData) {
      console.log('⚠️ Creando empleado nuevo...')

      const emailPlaceholder = `empleado_${cuil.replace(/-/g, '')}@movilsat.com.ar`

      const { data: newEmp, error: insertError } = await supabase
        .from('empleados')
        .insert({
          cuil: cuil,
          nombre_completo: nombreCompleto || `EMPLEADO ${cuil}`,
          email: emailPlaceholder,
          legajo: legajo || null,
          rol: 'empleado',
          estado: 'activo'
        })
        .select()
        .single()

      if (insertError || !newEmp) {
        console.error('❌ Error creando empleado:', insertError)
        return NextResponse.json({ error: insertError?.message || 'No se pudo crear' }, { status: 500 })
      }

      empleado_id = newEmp.id
      console.log('✅ Empleado creado:', newEmp.nombre_completo)
    }

    // 🆕 2.5 Detectar si el recibo YA existía (para no duplicar notificaciones)
    const { data: reciboExistente } = await supabase
      .from('recibos_sueldo')
      .select('id, estado_firma')
      .eq('empleado_id', empleado_id)
      .eq('periodo', periodo || '2026-05')
      .eq('quincena', quincena || '1ra')
      .maybeSingle()

    const esReciboNuevo = !reciboExistente
    const necesitaFirma = !reciboExistente || reciboExistente.estado_firma !== 'firmado'

    // 3. Subir PDF original a Storage
    let pdfOriginalUrl = null

    if (archivo && archivo.size > 0) {
      try {
        const arrayBuffer = await archivo.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const fileName = `${cuil}_${periodo}_${quincena}_original.pdf`

        const { error: uploadError } = await supabase.storage
          .from('recibos-originales')
          .upload(fileName, buffer, {
            contentType: 'application/pdf',
            upsert: true
          })

        if (uploadError) {
          console.error('⚠️ Error subiendo PDF original:', uploadError)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('recibos-originales')
            .getPublicUrl(fileName)

          pdfOriginalUrl = publicUrl
          console.log('✅ PDF original subido:', publicUrl)
        }
      } catch (error) {
        console.error('⚠️ Error procesando archivo:', error)
      }
    }

    // 4. Guardar/actualizar el recibo
    const reciboData = {
      empleado_id: empleado_id,
      cuil: cuil,
      periodo: periodo || '2026-05',
      quincena: quincena || '1ra',
      neto_a_cobrar: Number(neto) || 0,
      legajo: legajo || null,
      pdf_original_url: pdfOriginalUrl,
      estado_firma: 'pendiente'
    }

    const { error: upsertError } = await supabase
      .from('recibos_sueldo')
      .upsert(reciboData, {
        onConflict: 'empleado_id,periodo,quincena',
        ignoreDuplicates: false
      })

    if (upsertError) {
      console.error('❌ Error UPSERT:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    console.log('✅ Recibo guardado con PDF original')

    // 🆕 5. Crear notificación SOLO si es un recibo nuevo (o reemplazado y no estaba firmado)
    if (esReciboNuevo && necesitaFirma) {
      const nombreMes = getNombreMes(periodo)

      try {
        const { error: notifError } = await supabase.from('notificaciones').insert({
          empleado_id: empleado_id,
          tipo: 'nuevo_recibo',
          titulo: `📄 Nuevo recibo disponible`,
          mensaje: `Ya podés ver y firmar tu recibo de ${nombreMes} (${quincena || '1ra'} quincena).`,
          link: '/empleado/recibos',
          leido: false
        })

        if (notifError) {
          console.error('⚠️ Error creando notificación:', notifError)
        } else {
          console.log('🔔 Notificación enviada al empleado')
        }
      } catch (notifException) {
        console.error('⚠️ Excepción al crear notificación:', notifException)
      }
    } else {
      console.log('ℹ️ No se crea notificación (recibo ya existía o estaba firmado)')
    }

    return NextResponse.json({
      success: true,
      mensaje: 'OK',
      pdfOriginalUrl
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Helper para traducir período a nombre legible
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