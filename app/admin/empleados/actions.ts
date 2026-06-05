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
  cuil?: string
  fecha_nacimiento?: string
  estado_civil?: string
  genero?: string
  nacionalidad?: string
  domicilio?: string
  localidad?: string
  provincia?: string
  codigo_postal?: string
  telefono?: string
  email_personal?: string
  obra_social?: string
  numero_afiliado?: string
  nombre_conyuge?: string
  hijos_a_cargo?: number
  cuenta_banco?: string
  cbu?: string
  alias_cbu?: string
  contacto_emergencia_nombre?: string
  contacto_emergencia_telefono?: string
  contacto_emergencia_relacion?: string
  tipo_contrato?: string
  periodo_prueba_hasta?: string
  convenio_colectivo?: string
  categoria_sindical?: string
  jornada_laboral?: string
  jornada_horas?: number
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
      rol: 'empleado',
      cuil: formData.cuil || null,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      estado_civil: formData.estado_civil || null,
      genero: formData.genero || null,
      nacionalidad: formData.nacionalidad || 'Argentina',
      domicilio: formData.domicilio || null,
      localidad: formData.localidad || null,
      provincia: formData.provincia || null,
      codigo_postal: formData.codigo_postal || null,
      telefono: formData.telefono || null,
      email_personal: formData.email_personal || null,
      obra_social: formData.obra_social || null,
      numero_afiliado: formData.numero_afiliado || null,
      nombre_conyuge: formData.nombre_conyuge || null,
      hijos_a_cargo: formData.hijos_a_cargo || 0,
      cuenta_banco: formData.cuenta_banco || null,
      cbu: formData.cbu || null,
      alias_cbu: formData.alias_cbu || null,
      contacto_emergencia_nombre: formData.contacto_emergencia_nombre || null,
      contacto_emergencia_telefono: formData.contacto_emergencia_telefono || null,
      contacto_emergencia_relacion: formData.contacto_emergencia_relacion || null,
      tipo_contrato: formData.tipo_contrato || 'permanente',
      periodo_prueba_hasta: formData.periodo_prueba_hasta || null,
      convenio_colectivo: formData.convenio_colectivo || null,
      categoria_sindical: formData.categoria_sindical || null,
      jornada_laboral: formData.jornada_laboral || null,
      jornada_horas: formData.jornada_horas || 8
    })

  if (empError) {
    return { error: empError.message }
  }

  return { success: true }
}