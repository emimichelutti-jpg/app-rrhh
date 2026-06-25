import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { reciboId, motivo, anuladoPor, userId } = await request.json()

    if (!reciboId || !motivo || !anuladoPor) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: recibo, error: errorRecibo } = await supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('id', reciboId)
      .single()

    if (errorRecibo || !recibo) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
    }

    if (recibo.estado_firma !== 'firmado') {
      return NextResponse.json({ error: 'El recibo no está firmado' }, { status: 400 })
    }

    if (anuladoPor === 'empleado') {
      const fechaFirma = new Date(recibo.fecha_firma)
      const ahora = new Date()
      const horasTranscurridas = (ahora.getTime() - fechaFirma.getTime()) / (1000 * 60 * 60)

      if (horasTranscurridas > 24) {
        return NextResponse.json({ 
          error: 'Solo podés anular tu firma dentro de las 24 horas posteriores. Contactá a RRHH.' 
        }, { status: 403 })
      }
    }

    const { error: updateError } = await supabase
      .from('recibos_sueldo')
      .update({
        estado_firma: 'pendiente',
        fecha_anulacion: new Date().toISOString(),
        motivo_anulacion: motivo,
        anulado_por: anuladoPor,
        fue_firmado_anteriormente: true,
        firma_imagen_url: null,
        firma_hash: null,
        ip_firmante: null,
        fecha_firma: null
      })
      .eq('id', reciboId)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      mensaje: 'Firma anulada correctamente. El recibo volvió a estado pendiente.'
    })

  } catch (error: any) {
    console.error('Error anulando firma:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}