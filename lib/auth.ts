import { supabase } from './supabase'

export interface UsuarioConRol {
  id: string
  nombre_completo: string
  email?: string
  rol: string
  rol_id: string | null
  zona_id?: string | null
  permisos: any
}

export async function obtenerUsuarioConRol(userId: string): Promise<UsuarioConRol | null> {
  try {
    const { data: empleado, error } = await supabase
      .from('empleados')
      .select(`
        id, 
        nombre_completo, 
        email, 
        rol_id, 
        zona_id,
        roles (nombre, permisos)
      `)
      .eq('id', userId)
      .single()

    if (error || !empleado) return null

    // Si es referente de zona, obtener la zona
    let zonaId = empleado.zona_id
    if (!zonaId) {
      const { data: referente } = await supabase
        .from('referentes_zona')
        .select('zona_id')
        .eq('empleado_id', userId)
        .eq('activo', true)
        .single()
      
      zonaId = referente?.zona_id
    }

    return {
      id: empleado.id,
      nombre_completo: empleado.nombre_completo,
      email: empleado.email,
      rol: empleado.roles?.nombre || 'empleado',
      rol_id: empleado.rol_id,
      zona_id: zonaId,
      permisos: empleado.roles?.permisos || {}
    }
  } catch (error) {
    console.error('Error obteniendo usuario con rol:', error)
    return null
  }
}

export function puedeVerTodos(permisos: any): boolean {
  return permisos?.ver_todos === true
}

export function puedeEditarTodos(permisos: any): boolean {
  return permisos?.editar_todos === true
}

export function puedeGestionarZonas(permisos: any): boolean {
  return permisos?.gestionar_zonas === true
}