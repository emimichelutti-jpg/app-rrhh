import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { empleado_id, sueldo_real_mensual, notas_sueldo } = body

    if (!empleado_id) {
      return NextResponse.json({ error: 'empleado_id es requerido' }, { status: 400 })
    }

    const updateData: any = {}
    if (sueldo_real_mensual !== undefined) updateData.sueldo_real_mensual = sueldo_real_mensual
    if (notas_sueldo !== undefined) updateData.notas_sueldo = notas_sueldo

    const { error } = await supabase
      .from('empleados')
      .update(updateData)
      .eq('id', empleado_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Error actualizando sueldo real:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}