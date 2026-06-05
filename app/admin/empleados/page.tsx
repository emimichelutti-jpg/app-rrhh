'use client'

import { supabase } from '@/lib/supabaseClient'
import { crearEmpleado } from './actions'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const PESTAÑAS = [
  { id: 'personal', label: 'Datos Personales' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'laboral', label: 'Datos Laborales' },
  { id: 'familia', label: 'Familia' },
  { id: 'bancario', label: 'Datos Bancarios' },
  { id: 'emergencia', label: 'Emergencia' },
  { id: 'salud', label: 'Salud' }
]

export default function GestionarEmpleadosPage() {
  const router = useRouter()
  const [empleados, setEmpleados] = useState<any[]>([])
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pestañaActiva, setPestañaActiva] = useState('personal')
  const [busqueda, setBusqueda] = useState('')
  
  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    dni: '',
    cargo: '',
    departamento_id: '',
    fecha_ingreso: '',
    dias_vacaciones_disponibles: 15,
    estado: 'activo',
    cuil: '',
    fecha_nacimiento: '',
    estado_civil: '',
    genero: '',
    nacionalidad: 'Argentina',
    domicilio: '',
    localidad: '',
    provincia: '',
    codigo_postal: '',
    telefono: '',
    email_personal: '',
    obra_social: '',
    numero_afiliado: '',
    nombre_conyuge: '',
    hijos_a_cargo: 0,
    cuenta_banco: '',
    cbu: '',
    alias_cbu: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    contacto_emergencia_relacion: '',
    tipo_contrato: 'permanente',
    periodo_prueba_hasta: '',
    convenio_colectivo: '',
    categoria_sindical: '',
    jornada_laboral: '08:00-17:00',
    jornada_horas: 8
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
      estado: formData.estado,
      cuil: formData.cuil || undefined,
      fecha_nacimiento: formData.fecha_nacimiento || undefined,
      estado_civil: formData.estado_civil || undefined,
      genero: formData.genero || undefined,
      nacionalidad: formData.nacionalidad || undefined,
      domicilio: formData.domicilio || undefined,
      localidad: formData.localidad || undefined,
      provincia: formData.provincia || undefined,
      codigo_postal: formData.codigo_postal || undefined,
      telefono: formData.telefono || undefined,
      email_personal: formData.email_personal || undefined,
      obra_social: formData.obra_social || undefined,
      numero_afiliado: formData.numero_afiliado || undefined,
      nombre_conyuge: formData.nombre_conyuge || undefined,
      hijos_a_cargo: formData.hijos_a_cargo || 0,
      cuenta_banco: formData.cuenta_banco || undefined,
      cbu: formData.cbu || undefined,
      alias_cbu: formData.alias_cbu || undefined,
      contacto_emergencia_nombre: formData.contacto_emergencia_nombre || undefined,
      contacto_emergencia_telefono: formData.contacto_emergencia_telefono || undefined,
      contacto_emergencia_relacion: formData.contacto_emergencia_relacion || undefined,
      tipo_contrato: formData.tipo_contrato || undefined,
      periodo_prueba_hasta: formData.periodo_prueba_hasta || undefined,
      convenio_colectivo: formData.convenio_colectivo || undefined,
      categoria_sindical: formData.categoria_sindical || undefined
    })

    if (resultado.error) {
      alert('Error: ' + resultado.error)
      return
    }

    alert('Empleado creado exitosamente. Contraseña temporal: cambiar123')
    setMostrarFormulario(false)
    setPestañaActiva('personal')
    setFormData({
      nombre_completo: '', email: '', dni: '', cargo: '', departamento_id: '',
      fecha_ingreso: '', dias_vacaciones_disponibles: 15, estado: 'activo',
      cuil: '', fecha_nacimiento: '', estado_civil: '', genero: '',
      nacionalidad: 'Argentina', domicilio: '', localidad: '', provincia: '',
      codigo_postal: '', telefono: '', email_personal: '', obra_social: '',
      numero_afiliado: '', nombre_conyuge: '', hijos_a_cargo: 0,
      cuenta_banco: '', cbu: '', alias_cbu: '',
      contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
      contacto_emergencia_relacion: '', tipo_contrato: 'permanente',
      periodo_prueba_hasta: '', convenio_colectivo: '', categoria_sindical: '',
      jornada_laboral: '08:00-17:00',
      jornada_horas: 8
    })
    cargarDatos()
  }

  const empleadosFiltrados = empleados.filter(emp =>
    emp.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    emp.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    emp.cargo.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
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

        {mostrarFormulario && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Nuevo Empleado</h2>
            
            {/* Pestañas */}
            <div className="flex gap-2 mb-6 border-b overflow-x-auto">
              {PESTAÑAS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPestañaActiva(p.id)}
                  className={`px-4 py-2 whitespace-nowrap ${
                    pestañaActiva === p.id 
                      ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' 
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {/* DATOS PERSONALES */}
              {pestañaActiva === 'personal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                    <input type="text" required value={formData.nombre_completo}
                      onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DNI *</label>
                    <input type="text" required value={formData.dni}
                      onChange={(e) => setFormData({...formData, dni: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CUIL</label>
                    <input type="text" value={formData.cuil} placeholder="20-12345678-9"
                      onChange={(e) => setFormData({...formData, cuil: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
                    <input type="date" value={formData.fecha_nacimiento}
                      onChange={(e) => setFormData({...formData, fecha_nacimiento: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                    <select value={formData.genero}
                      onChange={(e) => setFormData({...formData, genero: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded">
                      <option value="">Seleccionar...</option>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="otro">Otro</option>
                      <option value="no_binario">No binario</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
                    <select value={formData.estado_civil}
                      onChange={(e) => setFormData({...formData, estado_civil: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded">
                      <option value="">Seleccionar...</option>
                      <option value="soltero">Soltero/a</option>
                      <option value="casado">Casado/a</option>
                      <option value="divorciado">Divorciado/a</option>
                      <option value="viudo">Viudo/a</option>
                      <option value="union_libre">Unión libre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidad</label>
                    <input type="text" value={formData.nacionalidad}
                      onChange={(e) => setFormData({...formData, nacionalidad: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {/* CONTACTO */}
              {pestañaActiva === 'contacto' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Domicilio</label>
                    <input type="text" value={formData.domicilio} placeholder="Calle, número, piso, depto"
                      onChange={(e) => setFormData({...formData, domicilio: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localidad</label>
                    <input type="text" value={formData.localidad}
                      onChange={(e) => setFormData({...formData, localidad: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                    <input type="text" value={formData.provincia}
                      onChange={(e) => setFormData({...formData, provincia: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                    <input type="text" value={formData.codigo_postal}
                      onChange={(e) => setFormData({...formData, codigo_postal: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input type="tel" value={formData.telefono}
                      onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de la empresa *</label>
                    <input type="email" required value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email personal</label>
                    <input type="email" value={formData.email_personal}
                      onChange={(e) => setFormData({...formData, email_personal: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {/* DATOS LABORALES */}
              {pestañaActiva === 'laboral' && (
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato</label>
                    <select value={formData.tipo_contrato}
                      onChange={(e) => setFormData({...formData, tipo_contrato: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded">
                      <option value="permanente">Permanente</option>
                      <option value="temporario">Temporario</option>
                      <option value="pasantia">Pasantía</option>
                      <option value="contrato_riesgo">Contrato de Riesgo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Período de Prueba hasta</label>
                    <input type="date" value={formData.periodo_prueba_hasta}
                      onChange={(e) => setFormData({...formData, periodo_prueba_hasta: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Días de Vacaciones</label>
                    <input type="number" value={formData.dias_vacaciones_disponibles}
                      onChange={(e) => setFormData({...formData, dias_vacaciones_disponibles: parseInt(e.target.value)})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horario de Trabajo</label>
                    <input type="text" value={formData.jornada_laboral} placeholder="08:00-17:00"
                      onChange={(e) => setFormData({...formData, jornada_laboral: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                    <p className="text-xs text-gray-500 mt-1">Formato: HH:MM-HH:MM (ej: 08:00-17:00)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horas Diarias</label>
                    <input type="number" step="0.5" value={formData.jornada_horas}
                      onChange={(e) => setFormData({...formData, jornada_horas: parseFloat(e.target.value)})}
                      className="w-full p-2 border border-gray-300 rounded" />
                    <p className="text-xs text-gray-500 mt-1">Cantidad de horas de la jornada (ej: 8)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Convenio Colectivo</label>
                    <input type="text" value={formData.convenio_colectivo} placeholder="Ej: CCT 130/75"
                      onChange={(e) => setFormData({...formData, convenio_colectivo: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Sindical</label>
                    <input type="text" value={formData.categoria_sindical}
                      onChange={(e) => setFormData({...formData, categoria_sindical: e.target.value})}
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
              )}

              {/* FAMILIA */}
              {pestañaActiva === 'familia' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cónyuge</label>
                    <input type="text" value={formData.nombre_conyuge}
                      onChange={(e) => setFormData({...formData, nombre_conyuge: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hijos a Cargo</label>
                    <input type="number" min="0" value={formData.hijos_a_cargo}
                      onChange={(e) => setFormData({...formData, hijos_a_cargo: parseInt(e.target.value)})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {/* DATOS BANCARIOS */}
              {pestañaActiva === 'bancario' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                    <input type="text" value={formData.cuenta_banco} placeholder="Ej: Banco Galicia"
                      onChange={(e) => setFormData({...formData, cuenta_banco: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CBU</label>
                    <input type="text" value={formData.cbu} placeholder="22 dígitos"
                      onChange={(e) => setFormData({...formData, cbu: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alias CBU</label>
                    <input type="text" value={formData.alias_cbu} placeholder="mi.cuenta.galicia"
                      onChange={(e) => setFormData({...formData, alias_cbu: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {/* CONTACTO DE EMERGENCIA */}
              {pestañaActiva === 'emergencia' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Contacto</label>
                    <input type="text" value={formData.contacto_emergencia_nombre}
                      onChange={(e) => setFormData({...formData, contacto_emergencia_nombre: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input type="tel" value={formData.contacto_emergencia_telefono}
                      onChange={(e) => setFormData({...formData, contacto_emergencia_telefono: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relación</label>
                    <input type="text" value={formData.contacto_emergencia_relacion} placeholder="Ej: Esposa, Madre"
                      onChange={(e) => setFormData({...formData, contacto_emergencia_relacion: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {/* SALUD */}
              {pestañaActiva === 'salud' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Obra Social</label>
                    <input type="text" value={formData.obra_social} placeholder="Ej: OSDE, Swiss Medical"
                      onChange={(e) => setFormData({...formData, obra_social: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° de Afiliado</label>
                    <input type="text" value={formData.numero_afiliado}
                      onChange={(e) => setFormData({...formData, numero_afiliado: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {/* Botones de navegación */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <div className="flex gap-2">
                  {pestañaActiva !== 'personal' && (
                    <button type="button"
                      onClick={() => {
                        const idx = PESTAÑAS.findIndex(p => p.id === pestañaActiva)
                        setPestañaActiva(PESTAÑAS[idx - 1].id)
                      }}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                      ← Anterior
                    </button>
                  )}
                  {pestañaActiva !== 'salud' && (
                    <button type="button"
                      onClick={() => {
                        const idx = PESTAÑAS.findIndex(p => p.id === pestañaActiva)
                        setPestañaActiva(PESTAÑAS[idx + 1].id)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                      Siguiente →
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setMostrarFormulario(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    Guardar Empleado
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                * Se creará una cuenta con contraseña temporal: <strong>cambiar123</strong>
              </p>
            </form>
          </div>
        )}

        {/* Buscador */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, email o cargo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        {/* Tabla de empleados */}
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
              {empleadosFiltrados.map((empleado) => (
                <tr key={empleado.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => router.push(`/admin/empleados/${empleado.id}`)}>
                    {empleado.nombre_completo}
                  </td>
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
          {empleadosFiltrados.length === 0 && (
            <div className="text-center py-8 text-gray-500">No hay empleados registrados</div>
          )}
        </div>
      </div>
    </div>
  )
}