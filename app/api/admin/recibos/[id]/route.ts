import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { motivo } = await request.json()

    if (!motivo || motivo.trim().length === 0) {
      return NextResponse.json(
        { error: 'El motivo es obligatorio' },
        { status: 400 }
      )
    }

    // 1. Obtener el recibo para verificar que existe
    const { data: recibo, error: fetchError } = await supabase
      .from('recibos_sueldo')
      .select('id, periodo, quincena, cuil, empleados(nombre_completo)')
      .eq('id', id)
      .single()

    if (fetchError || !recibo) {
      return NextResponse.json(
        { error: 'Recibo no encontrado' },
        { status: 404 }
      )
    }

    // 2. Eliminar el recibo
    const { error: deleteError } = await supabase
      .from('recibos_sueldo')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    console.log(`🗑️ Recibo eliminado: ${recibo.empleados.nombre_completo} - ${recibo.periodo} ${recibo.quincena}`)
    console.log(`📝 Motivo: ${motivo}`)

    return NextResponse.json({
      success: true,
      mensaje: 'Recibo eliminado correctamente'
    })

  } catch (error: any) {
    console.error('❌ Error eliminando recibo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}