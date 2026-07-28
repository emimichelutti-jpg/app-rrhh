'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Rol {
  id: string
  nombre: string
  descripcion: string | null
  permisos: any
}

interface Empleado {
  id: string
  nombre_completo: string
  cuil: string
  rol_id: string | null
  rol_nombre?: string
}

export default function AdminRolesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Rol[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [rolSeleccionado, setRolSeleccionado] = useState<string | null>(null)
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState<Set<string>>(new Set())
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)

      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('nombre', { ascending: true })

      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cuil, rol_id, roles!left(nombre)')
        .eq('activo', true)
        .order('nombre_completo', { ascending: true })

      const empleadosConRol = (empleadosData || []).map((e: any) => ({
        ...e,
        rol_nombre: e.roles?.nombre || null
      }))

      setRoles(rolesData || [])
      setEmpleados(empleadosConRol)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleEmpleado = (empleadoId: string) => {
    const nuevos = new Set(empleadosSeleccionados)
    if (nuevos.has(empleadoId)) {
      nuevos.delete(empleadoId)
    } else {
      nuevos.add(empleadoId)
    }
    setEmpleadosSeleccionados(nuevos)
  }

  const asignarRol = async () => {
    if (!rolSeleccionado || empleadosSeleccionados.size === 0) return

    const rolNombre = roles.find(r => r.id === rolSeleccionado)?.nombre
    if (!confirm(`¿Asignar rol "${rolNombre}" a ${empleadosSeleccionados.size} empleado(s)?`)) return

    try {
      const { error } = await supabase
        .from('empleados')
        .update({ rol_id: rolSeleccionado })
        .in('id', Array.from(empleadosSeleccionados))

      if (error) throw error

      setMensaje(`✅ Rol asignado correctamente`)
      setEmpleadosSeleccionados(new Set())
      await cargarDatos()
      setTimeout(() => setMensaje(''), 3000)
    } catch (error: any) {
      setMensaje(`❌ Error: ${error.message}`)
    }
  }

  if (loading) return <div className="p-8 text-center">Cargando...</div>

  const rolActual = roles.find(r => r.id === rolSeleccionado)
  const empleadosConRol = rolSeleccionado 
    ? empleados.filter(e => e.rol_id === rolSeleccionado)
    : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Roles</h1>
          <p className="text-slate-600">Asigná permisos y roles a los empleados</p>
        </div>
        <button
          onClick={() => router.push('/admin/empleados')}
          className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800"
        >
          ← Volver
        </button>
      </div>

      {mensaje && (
        <div className={`mb-4 p-4 rounded-lg ${
          mensaje.startsWith('✅') ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
          'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {mensaje}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Roles */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-slate-900 mb-3">🔐 Roles ({roles.length})</h2>
            <div className="space-y-2">
              {roles.map(rol => {
                const cantidad = empleados.filter(e => e.rol_id === rol.id).length
                return (
                  <button
                    key={rol.id}
                    onClick={() => {
                      setRolSeleccionado(rol.id)
                      setEmpleadosSeleccionados(new Set())
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${
                      rolSeleccionado === rol.id
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{rol.nombre.replace('_', ' ').toUpperCase()}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                        {cantidad}
                      </span>
                    </div>
                    {rol.descripcion && (
                      <p className="text-xs mt-1 text-slate-500">{rol.descripcion}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Empleados con el rol seleccionado */}
        <div className="lg:col-span-3">
          {!rolSeleccionado ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <span className="text-6xl mb-4 block">🔐</span>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Seleccioná un rol</h3>
              <p className="text-slate-600">Hacé clic en un rol para ver y gestionar sus empleados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                <h2 className="text-xl font-bold text-slate-900">{rolActual?.nombre.replace('_', ' ').toUpperCase()}</h2>
                <p className="text-sm text-slate-600 mb-3">{empleadosConRol.length} empleado(s) con este rol</p>
                
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Buscar empleado..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {empleadosConRol.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No hay empleados con este rol
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {empleadosConRol.map(empleado => (
                      <div key={empleado.id} className="p-3 hover:bg-slate-50">
                        <p className="font-medium text-slate-900">{empleado.nombre_completo}</p>
                        <p className="text-xs text-slate-500">CUIL: {empleado.cuil}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}