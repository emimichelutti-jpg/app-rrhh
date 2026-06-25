import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Función para normalizar CUIL (quitar guiones)
function normalizarCUIL(cuil: string): string {
  return cuil.replace(/-/g, '').trim()
}

export async function POST(request: Request) {
  try {
    const { archivos } = await request.json()

    if (!archivos || archivos.length === 0) {
      return NextResponse.json({ error: 'No hay archivos' }, { status: 400 })
    }

    console.log(`📥 Procesando ${archivos.length} archivos en lote...`)

    // 1. Descargar TODOS los PDFs en paralelo
    const pdfBuffers = await Promise.all(
      archivos.map(async ({ pdfUrl, fileName }) => {
        try {
          const response = await fetch(pdfUrl)
          if (!response.ok) throw new Error(`Error descargando ${fileName}`)
          const buffer = await response.arrayBuffer()
          return { fileName, pdfUrl, buffer, success: true }
        } catch (error: any) {
          console.error(`❌ Error descargando ${fileName}:`, error.message)
          return { fileName, pdfUrl, buffer: null, success: false, error: error.message }
        }
      })
    )

    const pdfsExitosos = pdfBuffers.filter(p => p.success && p.buffer)
    console.log(`✅ PDFs descargados: ${pdfsExitosos.length}/${pdfBuffers.length}`)

    if (pdfsExitosos.length === 0) {
      return NextResponse.json({ error: 'No se pudieron descargar los PDFs' }, { status: 500 })
    }

    // 2. Enviar TODOS al backend Python de una vez
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    const formData = new FormData()
    
    pdfsExitosos.forEach(({ fileName, buffer }) => {
      const blob = new Blob([buffer as ArrayBuffer], { type: 'application/pdf' })
      formData.append('files', blob, fileName)
    })

    console.log('📤 Enviando al backend Python...')
    const backendResponse = await fetch(`${backendUrl}/extraer-lote-recibos`, {
      method: 'POST',
      body: formData
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend respondió ${backendResponse.status}`)
    }

    const recibosExtraidos = await backendResponse.json()
    console.log(`✅ Backend extrajo ${recibosExtraidos.length} recibos`)

    if (recibosExtraidos.length === 0) {
      return NextResponse.json({
        success: true,
        exitosos: 0,
        fallidos: 0,
        recibos: [],
        errores: ['No se encontraron recibos']
      })
    }

    // 🔑 3. NORMALIZAR CUILs del backend Python (quitar guiones)
    const recibosNormalizados = recibosExtraidos.map(r => ({
      ...r,
      cuil: normalizarCUIL(r.cuil)
    }))

    // 4. Buscar TODOS los empleados existentes
    const cuilsUnicos = [...new Set(recibosNormalizados.map(r => r.cuil))]
    
    console.log(`🔍 Buscando ${cuilsUnicos.length} empleados...`)
    const { data: empleadosExistentes, error: fetchError } = await supabase
      .from('empleados')
      .select('id, cuil, nombre_completo')
      .in('cuil', cuilsUnicos)

    if (fetchError) throw fetchError

    const empleadosMap = new Map(
      (empleadosExistentes || []).map(emp => [emp.cuil, emp.id])
    )

    console.log(`✅ Encontrados: ${empleadosMap.size}, Faltantes: ${cuilsUnicos.length - empleadosMap.size}`)

    // 5. Crear empleados faltantes
    const cuilsFaltantes = cuilsUnicos.filter(cuil => !empleadosMap.has(cuil))

    if (cuilsFaltantes.length > 0) {
      console.log(`🆕 Creando ${cuilsFaltantes.length} empleados nuevos...`)

      const nuevosEmpleados = cuilsFaltantes.map(cuil => {
        const recibo = recibosNormalizados.find(r => r.cuil === cuil)
        return {
          cuil: cuil,
          nombre_completo: recibo?.nombre_completo || 'Desconocido',
          email: `empleado_${cuil}@movilsat.com.ar`,
          activo: true,
          rol: 'empleado'
        }
      })

      const { data: empleadosCreados, error: insertError } = await supabase
        .from('empleados')
        .insert(nuevosEmpleados)
        .select('id, cuil')

      if (insertError) {
        console.error('⚠️ Error creando empleados:', insertError.message)
        
        if (insertError.code === '23505') {
          console.log('🔄 Buscando empleados por email...')
          for (const emp of nuevosEmpleados) {
            const { data: existente } = await supabase
              .from('empleados')
              .select('id, cuil')
              .eq('email', emp.email)
              .single()

            if (existente) {
              empleadosMap.set(emp.cuil, existente.id)
              console.log(`✅ Vinculado: ${emp.cuil}`)
            }
          }
        }
      } else {
        empleadosCreados?.forEach(emp => empleadosMap.set(emp.cuil, emp.id))
        console.log(`✅ Creados: ${empleadosCreados?.length || 0}`)
      }
    }

    // 🔑 6. Preparar recibos para upsert (ASUMIENDO QUE EL ORDEN COINCIDE)
    // Cada PDF individual tiene UN solo recibo, el orden de extracción
    // coincide con el orden de los archivos subidos
    const recibosParaUpsert = recibosNormalizados.map((recibo, index) => {
      // Usar el PDF correspondiente por índice
      const archivo = pdfsExitosos[index]
      const pdfUrl = archivo?.pdfUrl || null

      return {
        empleado_id: empleadosMap.get(recibo.cuil),
        cuil: recibo.cuil,
        periodo: recibo.periodo || '2026-06',
        quincena: recibo.quincena || '1ra',
        neto_a_cobrar: recibo.neto_a_cobrar || 0,
        total_haberes: recibo.total_haberes || 0,
        pdf_original_url: pdfUrl,
        pagina_recibo: 1,
        estado: 'pendiente',
        estado_firma: 'pendiente'
      }
    })

    // Filtrar solo los que tienen empleado_id válido
    const recibosValidos = recibosParaUpsert.filter(r => {
      if (!r.empleado_id) {
        console.warn(`⚠️ Recibo sin empleado: CUIL ${r.cuil}`)
        return false
      }
      return true
    })

    console.log(`💾 Guardando ${recibosValidos.length} recibos...`)
    console.log(`📊 Recibos con PDF URL: ${recibosValidos.filter(r => r.pdf_original_url).length}`)

    if (recibosValidos.length === 0) {
      console.error('❌ No hay recibos válidos para guardar')
      console.log('📋 Empleados en mapa:', Array.from(empleadosMap.keys()))
      console.log('📋 CUILs de recibos:', recibosNormalizados.map(r => r.cuil))
      return NextResponse.json({
        success: false,
        error: 'No se pudieron vincular los recibos con empleados',
        exitosos: 0,
        fallidos: recibosNormalizados.length,
        recibos: [],
        errores: ['No se encontraron empleados para los CUILs extraídos']
      }, { status: 500 })
    }

    // 7. Upsert masivo
    const { error: upsertError } = await supabase
      .from('recibos_sueldo')
      .upsert(recibosValidos, {
        onConflict: 'empleado_id,periodo,quincena'
      })

    if (upsertError) throw upsertError

    console.log('✅ Completado!')

    return NextResponse.json({
      success: true,
      exitosos: recibosValidos.length,
      fallidos: recibosNormalizados.length - recibosValidos.length,
      recibos: recibosValidos.map(r => ({
        nombre: recibosNormalizados.find(re => re.cuil === r.cuil)?.nombre_completo || r.cuil,
        cuil: r.cuil,
        neto: r.neto_a_cobrar,
        periodo: r.periodo,
        quincena: r.quincena
      })),
      errores: []
    })

  } catch (error: any) {
    console.error('❌ Error general:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      exitosos: 0,
      fallidos: 1,
      recibos: [],
      errores: [error.message]
    }, { status: 500 })
  }
}