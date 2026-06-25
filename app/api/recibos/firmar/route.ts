import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export async function POST(request: Request) {
  try {
    const { reciboId, firmaBase64, empleadoNombre, ipFirmante } = await request.json()

    if (!reciboId || !firmaBase64) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Obtener el recibo actual
    const { data: reciboActual, error: errorRecibo } = await supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('id', reciboId)
      .single()

    if (errorRecibo || !reciboActual) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
    }

    // 2. VALIDACIÓN DE FIRMA SECUENCIAL
    const { data: recibosEmpleado, error: errorLista } = await supabase
      .from('recibos_sueldo')
      .select('id, periodo, quincena, estado_firma')
      .eq('empleado_id', reciboActual.empleado_id)
      .order('periodo', { ascending: true })
      .order('quincena', { ascending: true })

    if (errorLista) throw errorLista

    let hayPendienteAnterior = false
    let periodoBloqueante = ''

    for (const r of recibosEmpleado) {
      if (r.id === reciboId) break

      if (r.estado_firma === 'pendiente') {
        hayPendienteAnterior = true
        periodoBloqueante = `${r.periodo} ${r.quincena}`
        break
      }
    }

    if (hayPendienteAnterior) {
      return NextResponse.json({
        error: `No podés firmar este recibo. Tenés un recibo pendiente del período ${periodoBloqueante}. Debés firmarlo primero.`
      }, { status: 403 })
    }

    // 3. Generar Hash de la firma (SHA-256)
    const firmaHash = createHash('sha256')
      .update(firmaBase64 + reciboId + new Date().toISOString())
      .digest('hex')

    // 4. ⚡ ACTUALIZAR AMBAS COLUMNAS: estado_firma Y estado
    const { error: updateError } = await supabase
      .from('recibos_sueldo')
      .update({
        estado_firma: 'firmado',
        estado: 'firmado', // ⚡ AGREGADO: actualizar también esta columna
        fecha_firma: new Date().toISOString(),
        firma_imagen_url: firmaBase64,
        firma_empleado_url: firmaBase64, //  AGREGADO: por si la página usa esta
        firma_empleado_fecha: new Date().toISOString(), // ⚡ AGREGADO
        firma_hash: firmaHash,
        ip_firmante: ipFirmante || '127.0.0.1',
        ip_firma: ipFirmante || '127.0.0.1',
        firmante_nombre: empleadoNombre || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reciboId)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      firmaHash,
      mensaje: 'Recibo firmado exitosamente'
    })

  } catch (error: any) {
    console.error('Error firmando recibo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}