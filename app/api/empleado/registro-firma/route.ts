import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // Obtener token del header o cookie
    const authHeader = request.headers.get('authorization')
    const cookies = request.headers.get('cookie') || ''
    
    let token = authHeader?.replace('Bearer ', '')
    if (!token) {
      const cookieMatch = cookies.match(/empleado_token=([^;]+)/)
      token = cookieMatch ? cookieMatch[1] : null
    }

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar token
    let payload
    try {
      payload = JSON.parse(atob(token))
      if (payload.exp < Date.now()) {
        return NextResponse.json({ error: 'Token expirado' }, { status: 401 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { firmaBase64 } = await request.json()

    if (!firmaBase64) {
      return NextResponse.json({ error: 'Firma requerida' }, { status: 400 })
    }

    // Usar cliente admin (saltea RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Actualizar empleado
    const { error: updateError } = await supabase
      .from('empleados')
      .update({
        firma_registrada: true,
        firma_guardada: firmaBase64,
        firma_fecha_registro: new Date().toISOString()
      })
      .eq('id', payload.empleadoId)

    if (updateError) {
      console.error('Error actualizando firma:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error en registro-firma:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}