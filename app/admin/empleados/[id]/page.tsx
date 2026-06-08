'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'

const PESTAÑAS = [
  { id: 'personal', label: 'Datos Personales' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'laboral', label: 'Datos Laborales' },
  { id: 'familia', label: 'Familia' },
  { id: 'bancario', label: 'Datos Bancarios' },
  { id: 'emergencia', label: 'Emergencia' },
  { id: 'salud', label: 'Salud' }
]

export default function FichaEmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params)
  const router = useRouter()
  const [empleado, setEmpleado] = useState<any>(null)
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pestañaActiva, setPestañaActiva] = useState('personal')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    const { data: empData } = await supabase
      .from('empleados')
      .select('*, departamentos(nombre)')
      .eq('id', unwrappedParams.id)
      .single()

    if (empData) setEmpleado(empData)

    const { data: deptosData } = await supabase
      .from('departamentos')
      .select('*')
      .order('nombre')
    if (deptosData) setDepartamentos(deptosData)

    setLoading(false)
  }

  const handleGuardar = async () => {
    setGuardando(true)

    const { error } = await supabase
      .from('empleados')
      .update({
        nombre_completo: empleado.nombre_completo,
        dni: empleado.dni,
        cuil: empleado.cuil,
        fecha_nacimiento: empleado.fecha_nacimiento,
        estado_civil: empleado.estado_civil,
        genero: empleado.genero,
        nacionalidad: empleado.nacionalidad,
        domicilio: empleado.domicilio,
        localidad: empleado.localidad,
        provincia: empleado.provincia,
        codigo_postal: empleado.codigo_postal,
        telefono: empleado.telefono,
        email: empleado.email,
        email_personal: empleado.email_personal,
        cargo: empleado.cargo,
        departamento_id: empleado.departamento_id,
        fecha_ingreso: empleado.fecha_ingreso,
        tipo_contrato: empleado.tipo_contrato,
        periodo_prueba_hasta: empleado.periodo_prueba_hasta,
        dias_vacaciones_disponibles: empleado.dias_vacaciones_disponibles,
        convenio_colectivo: empleado.convenio_colectivo,
        categoria_sindical: empleado.categoria_sindical,
        estado: empleado.estado,
        nombre_conyuge: empleado.nombre_conyuge,
        hijos_a_cargo: empleado.hijos_a_cargo,
        cuenta_banco: empleado.cuenta_banco,
        cbu: empleado.cbu,
        alias_cbu: empleado.alias_cbu,
        contacto_emergencia_nombre: empleado.contacto_emergencia_nombre,
        contacto_emergencia_telefono: empleado.contacto_emergencia_telefono,
        contacto_emergencia_relacion: empleado.contacto_emergencia_relacion,
        obra_social: empleado.obra_social,
        numero_afiliado: empleado.numero_afiliado,
        jornada_laboral: empleado.jornada_laboral,
        jornada_horas: empleado.jornada_horas
      })
      .eq('id', unwrappedParams.id)

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      alert('Datos actualizados correctamente')
      setEditando(false)
    }

    setGuardando(false)
  }

  if (loading) return <div className="p-8">Cargando...</div>
  if (!empleado) return <div className="p-8">Empleado no encontrado</div>

  const actualizarCampo = (campo: string, valor: any) => {
    setEmpleado({ ...empleado, [campo]: valor })
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-800 text-sm mb-2"
            >
              ← Volver a la lista
            </button>
            <h1 className="text-2xl font-bold">{empleado.nombre_completo}</h1>
            <p className="text-sm text-gray-600">
              {empleado.cargo} - {empleado.departamentos?.nombre}
            </p>
          </div>
          <div className="flex gap-2">
            {editando ? (
              <>
                <button
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  onClick={() => { cargarDatos(); setEditando(false) }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditando(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Editar
              </button>
            )}
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto">
          {PESTAÑAS.map((p: any) => (
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

        {/* Contenido */}
        <div className="bg-white p-6 rounded-lg shadow">
          {/* DATOS PERSONALES */}
          {pestañaActiva === 'personal' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Nombre Completo" valor={empleado.nombre_completo} onChange={(v: any) => actualizarCampo('nombre_completo', v)} editando={editando} />
              <Campo label="DNI" valor={empleado.dni} onChange={(v: any) => actualizarCampo('dni', v)} editando={editando} />
              <Campo label="CUIL" valor={empleado.cuil} onChange={(v: any) => actualizarCampo('cuil', v)} editando={editando} />
              <Campo label="Fecha de Nacimiento" valor={empleado.fecha_nacimiento} tipo="date" onChange={(v: any) => actualizarCampo('fecha_nacimiento', v)} editando={editando} />
              <Campo label="Género" valor={empleado.genero} tipo="select" opciones={['masculino', 'femenino', 'otro', 'no_binario']} onChange={(v: any) => actualizarCampo('genero', v)} editando={editando} />
              <Campo label="Estado Civil" valor={empleado.estado_civil} tipo="select" opciones={['soltero', 'casado', 'divorciado', 'viudo', 'union_libre']} onChange={(v: any) => actualizarCampo('estado_civil', v)} editando={editando} />
              <Campo label="Nacionalidad" valor={empleado.nacionalidad} onChange={(v: any) => actualizarCampo('nacionalidad', v)} editando={editando} />
            </div>
          )}

          {/* CONTACTO */}
          {pestañaActiva === 'contacto' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Domicilio" valor={empleado.domicilio} onChange={(v: any) => actualizarCampo('domicilio', v)} editando={editando} full />
              <Campo label="Localidad" valor={empleado.localidad} onChange={(v: any) => actualizarCampo('localidad', v)} editando={editando} />
              <Campo label="Provincia" valor={empleado.provincia} onChange={(v: any) => actualizarCampo('provincia', v)} editando={editando} />
              <Campo label="Código Postal" valor={empleado.codigo_postal} onChange={(v: any) => actualizarCampo('codigo_postal', v)} editando={editando} />
              <Campo label="Teléfono" valor={empleado.telefono} onChange={(v: any) => actualizarCampo('telefono', v)} editando={editando} />
              <Campo label="Email Empresa" valor={empleado.email} onChange={(v: any) => actualizarCampo('email', v)} editando={editando} full />
              <Campo label="Email Personal" valor={empleado.email_personal} onChange={(v: any) => actualizarCampo('email_personal', v)} editando={editando} full />
            </div>
          )}

          {/* DATOS LABORALES */}
          {pestañaActiva === 'laboral' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Cargo" valor={empleado.cargo} onChange={(v: any) => actualizarCampo('cargo', v)} editando={editando} />
              <Campo label="Departamento" valor={empleado.departamento_id} tipo="select-depto" deptos={departamentos} onChange={(v: any) => actualizarCampo('departamento_id', v)} editando={editando} />
              <Campo label="Fecha de Ingreso" valor={empleado.fecha_ingreso} tipo="date" onChange={(v: any) => actualizarCampo('fecha_ingreso', v)} editando={editando} />
              <Campo label="Tipo de Contrato" valor={empleado.tipo_contrato} tipo="select" opciones={['permanente', 'temporario', 'pasantia', 'contrato_riesgo']} onChange={(v: any) => actualizarCampo('tipo_contrato', v)} editando={editando} />
              <Campo label="Período de Prueba hasta" valor={empleado.periodo_prueba_hasta} tipo="date" onChange={(v: any) => actualizarCampo('periodo_prueba_hasta', v)} editando={editando} />
              <Campo label="Días de Vacaciones" valor={empleado.dias_vacaciones_disponibles} tipo="number" onChange={(v: any) => actualizarCampo('dias_vacaciones_disponibles', parseInt(v))} editando={editando} />
              <Campo label="Horario de Trabajo" valor={empleado.jornada_laboral} onChange={(v: any) => actualizarCampo('jornada_laboral', v)} editando={editando} />
              <Campo label="Horas Diarias" valor={empleado.jornada_horas} tipo="number" onChange={(v: any) => actualizarCampo('jornada_horas', parseFloat(v))} editando={editando} />
              <Campo label="Convenio Colectivo" valor={empleado.convenio_colectivo} onChange={(v: any) => actualizarCampo('convenio_colectivo', v)} editando={editando} />
              <Campo label="Categoría Sindical" valor={empleado.categoria_sindical} onChange={(v: any) => actualizarCampo('categoria_sindical', v)} editando={editando} />
              <Campo label="Estado" valor={empleado.estado} tipo="select" opciones={['activo', 'inactivo']} onChange={(v: any) => actualizarCampo('estado', v)} editando={editando} />
            </div>
          )}

          {/* FAMILIA */}
          {pestañaActiva === 'familia' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Nombre del Cónyuge" valor={empleado.nombre_conyuge} onChange={(v: any) => actualizarCampo('nombre_conyuge', v)} editando={editando} />
              <Campo label="Hijos a Cargo" valor={empleado.hijos_a_cargo} tipo="number" onChange={(v: any) => actualizarCampo('hijos_a_cargo', parseInt(v))} editando={editando} />
            </div>
          )}

          {/* DATOS BANCARIOS */}
          {pestañaActiva === 'bancario' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Banco" valor={empleado.cuenta_banco} onChange={(v: any) => actualizarCampo('cuenta_banco', v)} editando={editando} full />
              <Campo label="CBU" valor={empleado.cbu} onChange={(v: any) => actualizarCampo('cbu', v)} editando={editando} />
              <Campo label="Alias CBU" valor={empleado.alias_cbu} onChange={(v: any) => actualizarCampo('alias_cbu', v)} editando={editando} />
            </div>
          )}

          {/* CONTACTO DE EMERGENCIA */}
          {pestañaActiva === 'emergencia' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Nombre del Contacto" valor={empleado.contacto_emergencia_nombre} onChange={(v: any) => actualizarCampo('contacto_emergencia_nombre', v)} editando={editando} />
              <Campo label="Teléfono" valor={empleado.contacto_emergencia_telefono} onChange={(v: any) => actualizarCampo('contacto_emergencia_telefono', v)} editando={editando} />
              <Campo label="Relación" valor={empleado.contacto_emergencia_relacion} onChange={(v: any) => actualizarCampo('contacto_emergencia_relacion', v)} editando={editando} />
            </div>
          )}

          {/* SALUD */}
          {pestañaActiva === 'salud' && (
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Obra Social" valor={empleado.obra_social} onChange={(v: any) => actualizarCampo('obra_social', v)} editando={editando} />
              <Campo label="N° de Afiliado" valor={empleado.numero_afiliado} onChange={(v: any) => actualizarCampo('numero_afiliado', v)} editando={editando} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente auxiliar para mostrar/editar campos
function Campo({ label, valor, onChange, editando, tipo = 'text', opciones, deptos, full }: any) {
  if (!editando) {
    return (
      <div className={full ? 'col-span-2' : ''}>
        <label className="block text-xs font-medium text-gray-500 uppercase">{label}</label>
        <div className="text-gray-900 mt-1">
          {valor ? (tipo === 'select' ? valor : valor) : <span className="text-gray-400">-</span>}
        </div>
      </div>
    )
  }

  if (tipo === 'select') {
    return (
      <div className={full ? 'col-span-2' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select value={valor || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} className="w-full p-2 border border-gray-300 rounded">
          <option value="">Seleccionar...</option>
          {opciones.map((op: string) => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
    )
  }

  if (tipo === 'select-depto') {
    return (
      <div className={full ? 'col-span-2' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select value={valor || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} className="w-full p-2 border border-gray-300 rounded">
          <option value="">Seleccionar...</option>
          {deptos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={tipo} value={valor || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} className="w-full p-2 border border-gray-300 rounded" />
    </div>
  )
}