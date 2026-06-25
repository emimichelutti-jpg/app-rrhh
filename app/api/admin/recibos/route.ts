import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo')
    const estado = searchParams.get('estado')
    const empleadoId = searchParams.get('empleado_id')
    const busqueda = searchParams.get('busqueda')

    let query = supabase
      .from('recibos_sueldo')
      .select(`
        id,
        periodo,
        quincena,
        neto_a_cobrar,
        estado,
        estado_firma,
        fecha_firma,
        pdf_original_url,
        pdf_url,
        cuil,
        empleado_id,
        empleados (
          id,
          nombre_completo,
          cuil,
          email
        )
      `)
      .order('periodo', { ascending: false })
      .order('quincena', { ascending: false })

    if (periodo) {
      query = query.eq('periodo', periodo)
    }

    if (estado) {
      query = query.or(`estado.eq.${estado},estado_firma.eq.${estado}`)
    }

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId)
    }

    if (busqueda) {
      query = query.ilike('cuil', `%${busqueda}%`)
    }

    const { data: recibos, error } = await query.limit(100)

    if (error) throw error

    return NextResponse.json({
      success: true,
      recibos: recibos || []
    })

  } catch (error: any) {
    console.error('Error listando recibos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}