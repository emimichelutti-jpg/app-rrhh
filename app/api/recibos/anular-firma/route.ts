import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { reciboId, motivo, anuladoPor } = await request.json()

    if (!reciboId || !motivo) {
      return NextResponse.json({ error: 'Faltan datos requeridos (reciboId o motivo)' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Verificar que el recibo exista
    const { data: recibo, error: errorRecibo } = await supabase
      .from('recibos_sueldo')
      .select('id, estado_firma, estado')
      .eq('id', reciboId)
      .single()

    if (errorRecibo || !recibo) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
    }

    // 2. Resetear COMPLETAMENTE el recibo para que el empleado pueda volver a firmar
    const { error: updateError } = await supabase
      .from('recibos_sueldo')
      .update({
        estado: 'pendiente',          // 🔑 CRUCIAL: Esto hace que reaparezca el botón en el portal del empleado
        estado_firma: 'pendiente',    // Resetea el estado de firma
        firma_imagen_url: null,       // Borra la firma anterior
        firma_hash: null,             // Borra el hash
        fecha_firma: null,            // Borra la fecha
        ip_firma: null,
        pdf_url: null,                // Borra la URL del PDF firmado para que se genere uno nuevo
        motivo_anulacion: motivo,     // Guarda el motivo (si la columna existe en tu BD)
        fecha_anulacion: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reciboId)

    if (updateError) {
      console.error('Error al anular firma:', updateError)
      return NextResponse.json({ error: 'Error al anular la firma en la base de datos' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Firma anulada correctamente. El empleado podrá volver a firmar el recibo.'
    })

  } catch (error: any) {
    console.error('Error general al anular firma:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}