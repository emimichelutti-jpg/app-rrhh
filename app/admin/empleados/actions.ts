'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function crearEmpleado(formData: {
  nombre_completo: string
  email: string
  dni: string
  cargo: string
  departamento_id: number
  fecha_ingreso: string
  dias_vacaciones_disponibles: number
  estado: string
}) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: 'cambiar123',
    email_confirm: true
  })

  if (authError) {
    return { error: authError.message }
  }

  const { error: empError } = await supabaseAdmin
    .from('empleados')
    .insert({
      user_id: authData.user.id,
      nombre_completo: formData.nombre_completo,
      email: formData.email,
      dni: formData.dni,
      cargo: formData.cargo,
      departamento_id: formData.departamento_id,
      fecha_ingreso: formData.fecha_ingreso,
      dias_vacaciones_disponibles: formData.dias_vacaciones_disponibles,
      estado: formData.estado,
      rol: 'empleado'
    })

  if (empError) {
    return { error: empError.message }
  }

  return { success: true }
}