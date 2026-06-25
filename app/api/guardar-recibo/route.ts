import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // Recibir FormData (archivo + datos)
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

    // 3. SUBIR PDF ORIGINAL A STORAGE (NUEVO)
    let pdfOriginalUrl = null
    
    if (archivo && archivo.size > 0) {
      try {
        // Convertir File a ArrayBuffer
        const arrayBuffer = await archivo.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Nombre único: cuil_periodo_quincena_original.pdf
        const fileName = `${cuil}_${periodo}_${quincena}_original.pdf`
        
        // Subir a bucket 'recibos-originales'
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('recibos-originales')
          .upload(fileName, buffer, {
            contentType: 'application/pdf',
            upsert: true // Sobrescribir si ya existe
          })

        if (uploadError) {
          console.error('⚠️ Error subiendo PDF original:', uploadError)
          // No fallamos el proceso, solo logueamos
        } else {
          // Obtener URL pública
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

    // 4. Guardar/actualizar el recibo con URL del PDF original
    const reciboData = {
      empleado_id: empleado_id,
      cuil: cuil,
      periodo: periodo || '2026-05',
      quincena: quincena || '1ra',
      neto_a_cobrar: Number(neto) || 0,
      legajo: legajo || null,
      pdf_original_url: pdfOriginalUrl, // ← NUEVO CAMPO
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