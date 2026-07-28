'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'

const SECCIONES = [
  { id: 'personal', label: '👤 Datos Personales', icon: '👤', category: 'Información' },
  { id: 'contacto', label: '📞 Contacto', icon: '📞', category: 'Información' },
  { id: 'laboral', label: '💼 Datos Laborales', icon: '💼', category: 'Trabajo' },
  { id: 'familia', label: 'Familia', icon: '👨‍👩‍👧', category: 'Información' },
  { id: 'bancario', label: '🏦 Datos Bancarios', icon: '🏦', category: 'Finanzas' },
  { id: 'emergencia', label: '🚨 Emergencia', icon: '🚨', category: 'Información' },
  { id: 'salud', label: '🏥 Salud', icon: '🏥', category: 'Información' },
  { id: 'ingresos', label: '💰 Ingresos', icon: '💰', category: 'Finanzas' },
  { id: 'incentivos', label: '🎯 Incentivos', icon: '🎯', category: 'Finanzas' },
  { id: 'descuentos', label: '💸 Descuentos', icon: '💸', category: 'Finanzas' },
  { id: 'ausencias', label: '🏖️ Ausencias', icon: '🏖️', category: 'Tiempo' },
  { id: 'asistencia', label: '🕒 Asistencia', icon: '🕒', category: 'Tiempo' },
  { id: 'performance', label: '📊 Performance', icon: '📊', category: 'Evaluación' },
]

export default function FichaEmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params)
  const router = useRouter()
  const [empleado, setEmpleado] = useState<any>(null)
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [seccionActiva, setSeccionActiva] = useState('personal')
  
  const [recibos, setRecibos] = useState<any[]>([])
  const [incentivos, setIncentivos] = useState<any[]>([])
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [vacaciones, setVacaciones] = useState<any[]>([])
  const [asistencia, setAsistencia] = useState<any[]>([])
  const [cargandoContenido, setCargandoContenido] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (empleado) {
      cargarContenido()
    }
  }, [seccionActiva, empleado])

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

  const cargarContenido = async () => {
    setCargandoContenido(true)

    try {
      if (seccionActiva === 'ingresos') {
        // Buscar recibos por CUIL del empleado en la tabla correcta
        const { data } = await supabase
          .from('recibos_sueldo')
          .select('*')
          .eq('cuil', empleado.cuil)
          .neq('estado', 'anulado')
          .order('periodo', { ascending: false })
        setRecibos(data || [])
      }

      if (seccionActiva === 'incentivos') {
        const { data } = await supabase
          .from('incentivos')
          .select('*')
          .eq('empleado_id', unwrappedParams.id)
          .order('mes', { ascending: false })
        setIncentivos(data || [])
      }

      if (seccionActiva === 'descuentos') {
        const { data } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('empleado_id', unwrappedParams.id)
          .in('tipo', ['adelanto', 'prestamo'])
          .order('created_at', { ascending: false })
        setSolicitudes(data || [])
      }

      if (seccionActiva === 'ausencias') {
        const { data } = await supabase
          .from('solicitudes_vacaciones')
          .select('*')
          .eq('empleado_id', unwrappedParams.id)
          .order('fecha_inicio', { ascending: false })
        setVacaciones(data || [])
      }

      if (seccionActiva === 'asistencia') {
        const { data } = await supabase
          .from('registros_asistencia')
          .select('*')
          .eq('empleado_id', unwrappedParams.id)
          .order('fecha', { ascending: false })
          .limit(100)
        setAsistencia(data || [])
      }
    } catch (error) {
      console.error('Error cargando contenido:', error)
    }

    setCargandoContenido(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando información...</p>
        </div>
      </div>
    )
  }
  
  if (!empleado) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Empleado no encontrado</h2>
          <button
            onClick={() => router.push('/admin/empleados')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Volver a la lista
          </button>
        </div>
      </div>
    )
  }

  const actualizarCampo = (campo: string, valor: any) => {
    setEmpleado({ ...empleado, [campo]: valor })
  }

  // Calcular estadísticas
  const totalIngresos = recibos.reduce((sum, r) => sum + (parseFloat(r.neto_a_cobrar) || 0), 0)
  const totalIncentivos = incentivos.reduce((sum, i) => sum + (parseFloat(i.neto) || 0), 0)
  const totalDescuentos = solicitudes.reduce((sum, s) => sum + (parseFloat(s.monto) || 0), 0)
  const diasAusencias = vacaciones.reduce((sum, v) => sum + (parseInt(v.dias) || 0), 0)
  const asistenciaPorcentaje = asistencia.length > 0 
    ? ((asistencia.filter(r => r.estado === 'presente').length / asistencia.length) * 100).toFixed(1)
    : 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Menú Lateral */}
      <aside className="w-72 bg-white shadow-xl min-h-screen p-6 overflow-y-auto border-r border-gray-200">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/empleados')}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium"
          >
            <span>←</span>
            <span>Volver a la lista</span>
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Navegación</h3>
          <nav className="space-y-1">
            {SECCIONES.map((seccion) => (
              <button
                key={seccion.id}
                onClick={() => setSeccionActiva(seccion.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 group ${
                  seccionActiva === seccion.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg transform scale-105'
                    : 'text-gray-700 hover:bg-gray-100 hover:scale-102'
                }`}
              >
                <span className="text-xl">{seccion.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{seccion.label}</div>
                  <div className={`text-xs ${seccionActiva === seccion.id ? 'text-blue-100' : 'text-gray-400'}`}>
                    {seccion.category}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header del Empleado */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{empleado.nombre_completo}</h1>
              <div className="flex items-center gap-4 text-blue-100">
                <span className="flex items-center gap-2">
                  <span>💼</span>
                  {empleado.cargo}
                </span>
                <span>•</span>
                <span className="flex items-center gap-2">
                  <span>🏢</span>
                  {empleado.departamentos?.nombre}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              {editando ? (
                <>
                  <button
                    onClick={handleGuardar}
                    disabled={guardando}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    <span>💾</span>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { cargarDatos(); setEditando(false) }}
                    className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditando(true)}
                  className="bg-white hover:bg-gray-100 text-blue-600 px-6 py-3 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2"
                >
                  <span>✏️</span>
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Contenido de la sección */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {cargandoContenido && seccionActiva !== 'personal' && seccionActiva !== 'contacto' && seccionActiva !== 'laboral' && seccionActiva !== 'familia' && seccionActiva !== 'bancario' && seccionActiva !== 'emergencia' && seccionActiva !== 'salud' ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* DATOS PERSONALES */}
              {seccionActiva === 'personal' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">👤</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Datos Personales</h2>
                      <p className="text-gray-500 text-sm">Información personal del empleado</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InfoField label="Nombre Completo" value={empleado.nombre_completo} editando={editando} onChange={(v: any) => actualizarCampo('nombre_completo', v)} />
                    <InfoField label="DNI" value={empleado.dni} editando={editando} onChange={(v: any) => actualizarCampo('dni', v)} />
                    <InfoField label="CUIL" value={empleado.cuil} editando={editando} onChange={(v: any) => actualizarCampo('cuil', v)} />
                    <InfoField label="Fecha de Nacimiento" value={empleado.fecha_nacimiento} tipo="date" editando={editando} onChange={(v: any) => actualizarCampo('fecha_nacimiento', v)} />
                    <InfoField label="Género" value={empleado.genero} tipo="select" opciones={['masculino', 'femenino', 'otro', 'no_binario']} editando={editando} onChange={(v: any) => actualizarCampo('genero', v)} />
                    <InfoField label="Estado Civil" value={empleado.estado_civil} tipo="select" opciones={['soltero', 'casado', 'divorciado', 'viudo', 'union_libre']} editando={editando} onChange={(v: any) => actualizarCampo('estado_civil', v)} />
                    <InfoField label="Nacionalidad" value={empleado.nacionalidad} editando={editando} onChange={(v: any) => actualizarCampo('nacionalidad', v)} full />
                  </div>
                </div>
              )}

              {/* CONTACTO */}
              {seccionActiva === 'contacto' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">📞</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Información de Contacto</h2>
                      <p className="text-gray-500 text-sm">Datos de contacto y ubicación</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InfoField label="Domicilio" value={empleado.domicilio} editando={editando} onChange={(v: any) => actualizarCampo('domicilio', v)} full />
                    <InfoField label="Localidad" value={empleado.localidad} editando={editando} onChange={(v: any) => actualizarCampo('localidad', v)} />
                    <InfoField label="Provincia" value={empleado.provincia} editando={editando} onChange={(v: any) => actualizarCampo('provincia', v)} />
                    <InfoField label="Código Postal" value={empleado.codigo_postal} editando={editando} onChange={(v: any) => actualizarCampo('codigo_postal', v)} />
                    <InfoField label="Teléfono" value={empleado.telefono} editando={editando} onChange={(v: any) => actualizarCampo('telefono', v)} />
                    <InfoField label="Email Empresa" value={empleado.email} tipo="email" editando={editando} onChange={(v: any) => actualizarCampo('email', v)} full />
                    <InfoField label="Email Personal" value={empleado.email_personal} tipo="email" editando={editando} onChange={(v: any) => actualizarCampo('email_personal', v)} full />
                  </div>
                </div>
              )}

              {/* DATOS LABORALES */}
              {seccionActiva === 'laboral' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">💼</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Datos Laborales</h2>
                      <p className="text-gray-500 text-sm">Información del puesto y contrato</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InfoField label="Cargo" value={empleado.cargo} editando={editando} onChange={(v: any) => actualizarCampo('cargo', v)} />
                    <InfoField label="Departamento" value={empleado.departamento_id} tipo="select-depto" deptos={departamentos} editando={editando} onChange={(v: any) => actualizarCampo('departamento_id', v)} />
                    <InfoField label="Fecha de Ingreso" value={empleado.fecha_ingreso} tipo="date" editando={editando} onChange={(v: any) => actualizarCampo('fecha_ingreso', v)} />
                    <InfoField label="Tipo de Contrato" value={empleado.tipo_contrato} tipo="select" opciones={['permanente', 'temporario', 'pasantia', 'contrato_riesgo']} editando={editando} onChange={(v: any) => actualizarCampo('tipo_contrato', v)} />
                    <InfoField label="Período de Prueba hasta" value={empleado.periodo_prueba_hasta} tipo="date" editando={editando} onChange={(v: any) => actualizarCampo('periodo_prueba_hasta', v)} />
                    <InfoField label="Días de Vacaciones" value={empleado.dias_vacaciones_disponibles} tipo="number" editando={editando} onChange={(v: any) => actualizarCampo('dias_vacaciones_disponibles', parseInt(v))} />
                    <InfoField label="Horas Diarias" value={empleado.jornada_horas} tipo="number" step="0.5" editando={editando} onChange={(v: any) => actualizarCampo('jornada_horas', parseFloat(v))} />
                    <InfoField label="Convenio Colectivo" value={empleado.convenio_colectivo} editando={editando} onChange={(v: any) => actualizarCampo('convenio_colectivo', v)} />
                    <InfoField label="Estado" value={empleado.estado} tipo="select" opciones={['activo', 'inactivo']} editando={editando} onChange={(v: any) => actualizarCampo('estado', v)} />
                  </div>
                </div>
              )}

              {/* FAMILIA */}
              {seccionActiva === 'familia' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-2xl">👨‍👩‍</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Información Familiar</h2>
                      <p className="text-gray-500 text-sm">Datos del grupo familiar</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoField label="Nombre del Cónyuge" value={empleado.nombre_conyuge} editando={editando} onChange={(v: any) => actualizarCampo('nombre_conyuge', v)} />
                    <InfoField label="Hijos a Cargo" value={empleado.hijos_a_cargo} tipo="number" editando={editando} onChange={(v: any) => actualizarCampo('hijos_a_cargo', parseInt(v))} />
                  </div>
                </div>
              )}

              {/* DATOS BANCARIOS */}
              {seccionActiva === 'bancario' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-2xl">🏦</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Datos Bancarios</h2>
                      <p className="text-gray-500 text-sm">Información de cuenta para pagos</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <InfoField label="Banco" value={empleado.cuenta_banco} editando={editando} onChange={(v: any) => actualizarCampo('cuenta_banco', v)} full />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InfoField label="CBU" value={empleado.cbu} editando={editando} onChange={(v: any) => actualizarCampo('cbu', v)} full />
                      <InfoField label="Alias CBU" value={empleado.alias_cbu} editando={editando} onChange={(v: any) => actualizarCampo('alias_cbu', v)} full />
                    </div>
                  </div>
                </div>
              )}

              {/* EMERGENCIA */}
              {seccionActiva === 'emergencia' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">🚨</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Contacto de Emergencia</h2>
                      <p className="text-gray-500 text-sm">Persona a contactar en caso de emergencia</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InfoField label="Nombre del Contacto" value={empleado.contacto_emergencia_nombre} editando={editando} onChange={(v: any) => actualizarCampo('contacto_emergencia_nombre', v)} />
                    <InfoField label="Teléfono" value={empleado.contacto_emergencia_telefono} editando={editando} onChange={(v: any) => actualizarCampo('contacto_emergencia_telefono', v)} />
                    <InfoField label="Relación" value={empleado.contacto_emergencia_relacion} editando={editando} onChange={(v: any) => actualizarCampo('contacto_emergencia_relacion', v)} />
                  </div>
                </div>
              )}

              {/* SALUD */}
              {seccionActiva === 'salud' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-2xl">🏥</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Información de Salud</h2>
                      <p className="text-gray-500 text-sm">Obra social y datos médicos</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoField label="Obra Social" value={empleado.obra_social} editando={editando} onChange={(v: any) => actualizarCampo('obra_social', v)} />
                    <InfoField label="N° de Afiliado" value={empleado.numero_afiliado} editando={editando} onChange={(v: any) => actualizarCampo('numero_afiliado', v)} />
                  </div>
                </div>
              )}

              {/* INGRESOS */}
              {seccionActiva === 'ingresos' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">💰</div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Historial de Ingresos</h2>
                        <p className="text-gray-500 text-sm">Recibos de sueldo percibidos</p>
                      </div>
                    </div>
                    {recibos.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3">
                        <div className="text-sm text-green-600 font-medium">Total percibido</div>
                        <div className="text-2xl font-bold text-green-700">${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    )}
                  </div>

                  {recibos.length === 0 ? (
                    <EmptyState
                      icon="💰"
                      title="Sin recibos registrados"
                      message="No hay recibos de sueldo cargados para este empleado"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Período</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Quincena</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Sección</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Bruto</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Descuentos</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Neto</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {recibos.map((recibo: any) => (
                            <tr key={recibo.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm">{recibo.periodo}</td>
                              <td className="px-6 py-4 text-sm">{recibo.quincena || '-'}</td>
                              <td className="px-6 py-4 text-sm">{recibo.seccion || '-'}</td>
                              <td className="px-6 py-4 text-sm text-right">${recibo.monto_bruto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                              <td className="px-6 py-4 text-sm text-right text-red-600">${recibo.total_descuentos?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                              <td className="px-6 py-4 text-sm text-right font-semibold">${recibo.neto_a_cobrar?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  recibo.estado === 'firmado' ? 'bg-green-100 text-green-800' :
                                  recibo.estado === 'anulado' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {recibo.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* INCENTIVOS */}
              {seccionActiva === 'incentivos' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🎯</div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Historial de Incentivos</h2>
                        <p className="text-gray-500 text-sm">Incentivos y bonificaciones percibidas</p>
                      </div>
                    </div>
                    {incentivos.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-3">
                        <div className="text-sm text-blue-600 font-medium">Total en incentivos</div>
                        <div className="text-2xl font-bold text-blue-700">${totalIncentivos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    )}
                  </div>

                  {incentivos.length === 0 ? (
                    <EmptyState
                      icon="🎯"
                      title="Sin incentivos registrados"
                      message="No hay incentivos cargados para este empleado"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Mes</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Monto Bruto</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Descuentos</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Neto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {incentivos.map((inc: any) => (
                            <tr key={inc.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm capitalize">{inc.mes}</td>
                              <td className="px-6 py-4 text-sm text-right">${inc.monto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                              <td className="px-6 py-4 text-sm text-right text-red-600">${inc.descuentos?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                              <td className="px-6 py-4 text-sm text-right font-bold text-blue-600">${inc.neto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* DESCUENTOS */}
              {seccionActiva === 'descuentos' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">💸</div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Descuentos y Préstamos</h2>
                        <p className="text-gray-500 text-sm">Adelantos, préstamos y otros descuentos</p>
                      </div>
                    </div>
                    {solicitudes.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-3">
                        <div className="text-sm text-orange-600 font-medium">Total descontado</div>
                        <div className="text-2xl font-bold text-orange-700">${totalDescuentos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    )}
                  </div>

                  {solicitudes.length === 0 ? (
                    <EmptyState
                      icon="💸"
                      title="Sin descuentos registrados"
                      message="No hay adelantos o préstamos registrados"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Fecha</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Tipo</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Monto</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Cuotas</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {solicitudes.map((sol: any) => (
                            <tr key={sol.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm">{new Date(sol.created_at).toLocaleDateString('es-AR')}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className="inline-flex px-3 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium capitalize">
                                  {sol.tipo}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">${sol.monto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</td>
                              <td className="px-6 py-4 text-sm text-center text-gray-600">{sol.cuotas || '-'}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                  sol.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                                  sol.estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {sol.estado === 'aprobado' ? '✓ Aprobado' : sol.estado === 'rechazado' ? '✗ Rechazado' : '⏳ Pendiente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* AUSENCIAS */}
              {seccionActiva === 'ausencias' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">🏖️</div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Ausencias y Licencias</h2>
                        <p className="text-gray-500 text-sm">Vacaciones, licencias y permisos</p>
                      </div>
                    </div>
                    {vacaciones.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl px-6 py-3">
                        <div className="text-sm text-purple-600 font-medium">Total días ausente</div>
                        <div className="text-2xl font-bold text-purple-700">{diasAusencias} días</div>
                      </div>
                    )}
                  </div>

                  {vacaciones.length === 0 ? (
                    <EmptyState
                      icon="🏖️"
                      title="Sin ausencias registradas"
                      message="No hay solicitudes de vacaciones o licencias"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Tipo</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Desde</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Hasta</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Días</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vacaciones.map((vac: any) => (
                            <tr key={vac.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm">
                                <span className="inline-flex px-3 py-1 rounded-lg bg-purple-100 text-purple-700 font-medium capitalize">
                                  {vac.tipo || 'vacaciones'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm">{new Date(vac.fecha_inicio).toLocaleDateString('es-AR')}</td>
                              <td className="px-6 py-4 text-sm">{new Date(vac.fecha_fin).toLocaleDateString('es-AR')}</td>
                              <td className="px-6 py-4 text-sm text-center font-medium text-gray-900">{vac.dias || '-'}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                  vac.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                                  vac.estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {vac.estado === 'aprobado' ? '✓ Aprobado' : vac.estado === 'rechazado' ? '✗ Rechazado' : '⏳ Pendiente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ASISTENCIA */}
              {seccionActiva === 'asistencia' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">🕒</div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Historial de Asistencia</h2>
                        <p className="text-gray-500 text-sm">Registro de entrada, salida y horas trabajadas</p>
                      </div>
                    </div>
                    {asistencia.length > 0 && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-6 py-3">
                        <div className="text-sm text-indigo-600 font-medium">Porcentaje de asistencia</div>
                        <div className="text-2xl font-bold text-indigo-700">{asistenciaPorcentaje}%</div>
                      </div>
                    )}
                  </div>

                  {asistencia.length === 0 ? (
                    <EmptyState
                      icon="🕒"
                      title="Sin registros de asistencia"
                      message="No hay registros de asistencia cargados"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Fecha</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Entrada</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Almuerzo</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Salida</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Horas</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {asistencia.map((reg: any) => (
                            <tr key={reg.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm">{new Date(reg.fecha).toLocaleDateString('es-AR')}</td>
                              <td className="px-6 py-4 text-sm text-center font-mono">{reg.hora_entrada || '-'}</td>
                              <td className="px-6 py-4 text-sm text-center font-mono">
                                {reg.hora_almuerzo_inicio && reg.hora_almuerzo_fin 
                                  ? `${reg.hora_almuerzo_inicio}-${reg.hora_almuerzo_fin}` 
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-center font-mono">{reg.hora_salida || '-'}</td>
                              <td className="px-6 py-4 text-sm text-center">{reg.horas_trabajadas ? `${parseFloat(reg.horas_trabajadas).toFixed(1)}h` : '-'}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                  reg.estado === 'presente' ? 'bg-green-100 text-green-700' :
                                  reg.estado === 'tarde' ? 'bg-orange-100 text-orange-700' :
                                  reg.estado === 'ilt' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {reg.estado === 'presente' ? '✓ Presente' : 
                                   reg.estado === 'tarde' ? '⏰ Tarde' : 
                                   reg.estado === 'ilt' ? '🚑 ILT' : 
                                   reg.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* PERFORMANCE */}
              {seccionActiva === 'performance' && (
                <div className="text-center py-16">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-xl">
                    📊
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-3">Módulo en Desarrollo</h3>
                  <p className="text-gray-600 mb-8 text-lg">
                    Próximamente: Facturación, % de Incidencia, ICN/IRC, Categorías
                  </p>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-8 max-w-2xl mx-auto text-left shadow-lg">
                    <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <span>🚀</span>
                      Funcionalidades planificadas:
                    </h4>
                    <ul className="space-y-3">
                      {[
                        'Ranking de facturación por empleado',
                        '% de incidencia en facturación total',
                        'ICN (Índice de Calidad Numérico) semanal',
                        'IRC (Índice de Rendimiento/Cantidad) semanal',
                        'Categorías A/B/C según performance',
                        'Historial de evaluaciones'
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-center gap-3 text-blue-800">
                          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                          <span className="font-medium">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Componente InfoField mejorado
function InfoField({ label, valor, onChange, editando, tipo = 'text', opciones, deptos, full, step }: any) {
  if (!editando) {
    return (
      <div className={`${full ? 'md:col-span-2 lg:col-span-3' : ''}`}>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</label>
        <div className="text-gray-900 font-medium text-lg py-2 border-b border-gray-200">
          {valor ? (tipo === 'select' ? valor : valor) : <span className="text-gray-400 italic">No especificado</span>}
        </div>
      </div>
    )
  }

  if (tipo === 'select') {
    return (
      <div className={`${full ? 'md:col-span-2 lg:col-span-3' : ''}`}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
        <select 
          value={valor || ''} 
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} 
          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        >
          <option value="">Seleccionar...</option>
          {opciones.map((op: string) => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
    )
  }

  if (tipo === 'select-depto') {
    return (
      <div className={`${full ? 'md:col-span-2 lg:col-span-3' : ''}`}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
        <select 
          value={valor || ''} 
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} 
          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        >
          <option value="">Seleccionar...</option>
          {deptos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className={`${full ? 'md:col-span-2 lg:col-span-3' : ''}`}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <input 
        type={tipo} 
        step={step}
        value={valor || ''} 
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} 
        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
      />
    </div>
  )
}

// Componente EmptyState
function EmptyState({ icon, title, message }: { icon: string, title: string, message: string }) {
  return (
    <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{message}</p>
    </div>
  )
}