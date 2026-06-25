import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { cuil, password } = await request.json()

    if (!cuil || !password) {
      return NextResponse.json(
        { error: 'CUIL y contraseña son requeridos' },
        { status: 400 }
      )
    }

    const cuilLimpio = cuil.replace(/-/g, '')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: empleado, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('cuil', cuilLimpio)
      .single()

    if (error || !empleado) {
      console.log('Empleado no encontrado:', cuilLimpio)
      return NextResponse.json(
        { error: 'CUIL o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (empleado.activo === false) {
      return NextResponse.json(
        { error: 'Usuario inactivo. Contactá a RRHH.' },
        { status: 403 }
      )
    }

    if (!empleado.password_hash) {
      console.log('Empleado sin password_hash:', empleado.id)
      return NextResponse.json(
        { error: 'El empleado no tiene contraseña asignada. Contactá a RRHH.' },
        { status: 403 }
      )
    }

    const passwordValida = await bcrypt.compare(password, empleado.password_hash)
    
    if (!passwordValida) {
      console.log('Contraseña incorrecta para:', cuilLimpio)
      return NextResponse.json(
        { error: 'CUIL o contraseña incorrectos' },
        { status: 401 }
      )
    }

    // Crear token simple
    const tokenPayload = {
      empleadoId: empleado.id,
      cuil: empleado.cuil,
      nombre: empleado.nombre_completo,
      rol: empleado.rol || 'empleado',
      exp: Date.now() + (24 * 60 * 60 * 1000)
    }
    
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64')

    console.log('Login exitoso para:', cuilLimpio)

    // ⚡ Crear respuesta con el token en el JSON Y en cookie
    const response = NextResponse.json({
      success: true,
      token, // ⚡ IMPORTANTE: Devolver el token en el JSON
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre_completo,
        cuil: empleado.cuil,
        rol: empleado.rol || 'empleado',
        firmaRegistrada: empleado.firma_registrada || false,
        debeCambiarPassword: false
      }
    })

    // También setear como cookie (doble seguridad)
    response.cookies.set('empleado_token', token, {
      httpOnly: false,
      secure: false, // ⚡ false en desarrollo
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/'
    })

    return response

  } catch (error: any) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}