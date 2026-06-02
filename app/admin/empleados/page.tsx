'use client'

import { supabase } from '@/lib/supabaseClient'
import { crearEmpleado } from './actions'
import { useEffect, useState } from 'react'

export default function GestionarEmpleadosPage() {
  const [empleados, setEmpleados] = useState<any[]>([])
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    dni: '',
    cargo: '',
    departamento_id: '',
    fecha_ingreso: '',
    dias_vacaciones_disponibles: 15,
    estado: 'activo'
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    const { data: empleadosData } = await supabase
      .from('empleados')
      .select('*, departamentos (nombre)')
      .order('nombre_completo')
    if (empleadosData) setEmpleados(empleadosData)

    const { data: deptosData } = await supabase
      .from('departamentos')
      .select('*')
      .order('nombre')
    if (deptosData) setDepartamentos(deptosData)

    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const resultado = await crearEmpleado({
      nombre_completo: formData.nombre_completo,
      email: formData.email,
      dni: formData.dni,
      cargo: formData.cargo,
      departamento_id: parseInt(formData.departamento_id),
      fecha_ingreso: formData.fecha_ingreso,
      dias_vacaciones_disponibles: parseInt(formData.dias_vacaciones_disponibles.toString()),
      estado: formData.estado
    })

    if (resultado.error) {
      alert('Error: ' + resultado.error)
      return
    }

    alert('Empleado creado exitosamente. Contraseña temporal: cambiar123')
    setMostrarFormulario(false)
    setFormData({
      nombre_completo: '',
      email: '',
      dni: '',
      cargo: '',
      departamento_id: '',
      fecha_ingreso: '',
      dias_vacaciones_disponibles: 15,
      estado: 'activo'
    })
    cargarDatos()
  }

  if (loading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Título + botón */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Empleados</h1>
            <p className="text-sm text-gray-600">Administrar legajos del personal</p>
          </div>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {mostrarFormulario ? 'Cancelar' : '+ Nuevo Empleado'}
          </button>
        </div>

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Nuevo Empleado</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                  <input type="text" required value={formData.nombre_completo}
                    onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" required value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input type="text" value={formData.dni}
                    onChange={(e) => setFormData({...formData, dni: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                  <input type="text" required value={formData.cargo}
                    onChange={(e) => setFormData({...formData, cargo: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento *</label>
                  <select required value={formData.departamento_id}
                    onChange={(e) => setFormData({...formData, departamento_id: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded">
                    <option value="">Seleccionar...</option>
                    {departamentos.map((depto) => (
                      <option key={depto.id} value={depto.id}>{depto.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso *</label>
                  <input type="date" required value={formData.fecha_ingreso}
                    onChange={(e) => setFormData({...formData, fecha_ingreso: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de Vacaciones</label>
                  <input type="number" value={formData.dias_vacaciones_disponibles}
                    onChange={(e) => setFormData({...formData, dias_vacaciones_disponibles: parseInt(e.target.value)})}
                    className="w-full p-2 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  Guardar Empleado
                </button>
                <button type="button" onClick={() => setMostrarFormulario(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                  Cancelar
                </button>
              </div>
              <p className="text-sm text-gray-500">
                * Se creará una cuenta con contraseña temporal: <strong>cambiar123</strong>
              </p>
            </form>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {empleados.map((empleado) => (
                <tr key={empleado.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{empleado.nombre_completo}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{empleado.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{empleado.cargo}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{empleado.departamentos?.nombre || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${
                      empleado.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {empleado.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {empleados.length === 0 && (
            <div className="text-center py-8 text-gray-500">No hay empleados registrados</div>
          )}
        </div>
      </div>
    </div>
  )
}