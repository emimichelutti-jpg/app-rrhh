'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import CargadorDocumentos from '@/components/CargadorDocumentos'

const SECCIONES = [
  { id: 'personal', label: '👤 Datos Personales', icon: '👤', category: 'Información' },
  { id: 'contacto', label: '📞 Contacto', icon: '📞', category: 'Información' },
  { id: 'laboral', label: '💼 Datos Laborales', icon: '💼', category: 'Trabajo' },
  { id: 'familia', label: '👨‍👩‍👧 Familia', icon: '👨‍👩‍👧', category: 'Información' },
  { id: 'bancario', label: '🏦 Datos Bancarios', icon: '🏦', category: 'Finanzas' },
  { id: 'emergencia', label: '🚨 Emergencia', icon: '🚨', category: 'Información' },
  { id: 'salud', label: '🏥 Salud', icon: '🏥', category: 'Información' },
  { id: 'ingresos', label: '💰 Ingresos', icon: '💰', category: 'Finanzas' },
  { id: 'incentivos', label: '🎯 Incentivos', icon: '🎯', category: 'Finanzas' },
  { id: 'descuentos', label: '💸 Descuentos', icon: '💸', category: 'Finanzas' },
  { id: 'ausencias', label: '🏖️ Ausencias', icon: '🏖️', category: 'Tiempo' },
  { id: 'asistencia', label: '🕒 Asistencia', icon: '🕒', category: 'Tiempo' },
  { id: 'performance', label: '📊 Performance', icon: '📊', category: 'Evaluación' },
  { id: 'documentos', label: '🗂️ Documentación', icon: '🗂️', category: 'Legajo' }, // 🆕 NUEVA SECCIÓN
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
  const [documentos, setDocumentos] = useState<any[]>([]) // 🆕 Estado para documentos
  const [cargandoContenido, setCargandoContenido] = useState(false)

  // 🆕 Definición de documentos obligatorios para el checklist
  const docsRequeridos = [
    { id: 'dni', label: 'DNI (Frente y Dorso)', icon: '🪪' },
    { id: 'alta_arca', label: 'Alta ARCA / CUIL', icon: '📋' },
    { id: 'cbu', label: 'Constancia de CBU', icon: '🏦' },
    { id: 'titulo', label: 'Nivel de Estudios', icon: '🎓' },
    { id: 'contrato', label: 'Contrato / DDJJ', icon: '📄' },
    { id: 'obra_social', label: 'Obra Social', icon: '💊' }
  ]

  // 🆕 Calcular estado del legajo
  const docsCargados = new Set(documentos.map((d: any) => d.tipo_documento))
  const docsFaltantes = docsRequeridos.filter(d => !docsCargados.has(d.id))
  const porcentaje = Math.round(((docsRequeridos.length - docsFaltantes.length) / docsRequeridos.length) * 100)

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

      // 🆕 Cargar documentos del legajo
      if (seccionActiva === 'documentos') {
        const { data } = await supabase
          .from('documentos_legajo')
          .select('*')
          .eq('empleado_id', unwrappedParams.id)
          .order('fecha_carga', { ascending: false })
        setDocumentos(data || [])
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
          {cargandoContenido && seccionActiva !== 'personal' && seccionActiva !== 'contacto' && seccionActiva !== 'laboral' && seccionActiva !== 'familia' && seccionActiva !== 'bancario' && seccionActiva !== 'emergencia' && seccionActiva !== 'salud' && seccionActiva !== 'documentos' ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* ... (Mantené todas las secciones anteriores: personal, contacto, laboral, familia, bancario, emergencia, salud, ingresos, incentivos, descuentos, ausencias, asistencia, performance) ... */}
              
              {/* Para no hacer el código infinito, te muestro SOLO la nueva sección de DOCUMENTOS que debés agregar justo antes del cierre del `<>` */}

              {/* 🆕 DOCUMENTACIÓN */}
              {seccionActiva === 'documentos' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">🗂️</div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Documentación del Legajo</h2>
                      <p className="text-gray-500 text-sm">Gestión de documentos y estado del legajo</p>
                    </div>
                  </div>

                  {/* CHECKLIST DE ESTADO DEL LEGAJO */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-xl">📋</span> Estado del Legajo
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        porcentaje === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {porcentaje}% Completo
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          porcentaje === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${porcentaje}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {docsRequeridos.map((doc) => {
                        const estaCargado = docsCargados.has(doc.id);
                        return (
                          <div 
                            key={doc.id} 
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              estaCargado 
                                ? 'bg-emerald-50 border-emerald-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                              estaCargado ? 'bg-emerald-200' : 'bg-gray-200'
                            }`}>
                              {estaCargado ? '✅' : doc.icon}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-semibold ${
                                estaCargado ? 'text-emerald-900' : 'text-gray-700'
                              }`}>
                                {doc.label}
                              </p>
                              <p className="text-xs text-gray-500">
                                {estaCargado ? 'Documentación presente' : 'Falta presentar'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {docsFaltantes.length > 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                        <p className="text-sm text-rose-800 font-medium">
                          ⚠️ Documentos pendientes para completar el legajo:
                        </p>
                        <p className="text-sm text-rose-700 mt-1">
                          {docsFaltantes.map(d => d.label).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Componente de carga de documentos */}
                  <CargadorDocumentos
                    empleadoId={unwrappedParams.id}
                    documentos={documentos}
                    onActualizado={() => {
                      supabase
                        .from('documentos_legajo')
                        .select('*')
                        .eq('empleado_id', unwrappedParams.id)
                        .order('fecha_carga', { ascending: false })
                        .then(({ data }) => setDocumentos(data || []))
                    }}
                  />
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