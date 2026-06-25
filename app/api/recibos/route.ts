import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const empleadoId = searchParams.get('empleadoId')

    if (!empleadoId) {
      return NextResponse.json({ error: 'Falta empleadoId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: recibos, error } = await supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('periodo', { ascending: true })
      .order('quincena', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ recibos: recibos || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}