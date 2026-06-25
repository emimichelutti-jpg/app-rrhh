import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { empleadoId, email, password } = await request.json()

    if (!empleadoId || !email || !password) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: { empleado_id: empleadoId }
    })

    if (authError) {
      console.error('Error creando usuario Auth:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // 2. Actualizar empleado con el user_id
    const { error: updateError } = await supabase
      .from('empleados')
      .update({ user_id: authData.user.id })
      .eq('id', empleadoId)

    if (updateError) {
      console.error('Error actualizando empleado:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      mensaje: 'Empleado activado correctamente',
      userId: authData.user.id 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}