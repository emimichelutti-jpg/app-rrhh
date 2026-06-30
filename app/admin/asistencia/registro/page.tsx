'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ESTADOS_ASISTENCIA = [
  { value: 'presente', label: 'Presente', icon: '✅', color: 'green' },
  { value: 'ausente_injustificado', label: 'Ausente Injust.', icon: '❌', color: 'red' },
  { value: 'ausente_justificado', label: 'Ausente Just.', icon: '⚠️', color: 'yellow' },
  { value: 'tarde', label: 'Tarde', icon: '⏰', color: 'orange' },
  { value: 'permiso', label: 'Permiso', icon: '📝', color: 'blue' },
  { value: 'vacaciones', label: 'Vacaciones', icon: '🏖️', color: 'cyan' },
  { value: 'licencia_medica', label: 'Lic. Médica', icon: '🏥', color: 'purple' },
  { value: 'ilt', label: 'ILT (ART)', icon: '🚑', color: 'red' },
  { value: 'licencia_familiar', label: 'Lic. Familiar', icon: '👨‍👩‍👧', color: 'purple' },
  { value: 'feriado', label: 'Feriado', icon: '🎉', color: 'gray' },
]

const HORA_ENTRADA_DEFAULT = '08:00'
const HORA_SALIDA_DEFAULT = '17:00'

export default function RegistroAsistenciaPage() {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [registros, setRegistros] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [filtroSeccion, setFiltroSeccion] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false)
  const [registroEditar, setRegistroEditar] = useState<any>(null)
  const [horaEntradaEdit, setHoraEntradaEdit] = useState('')
  const [horaSalidaEdit, setHoraSalidaEdit] = useState('')
  const [horaAlmuerzoInicioEdit, setHoraAlmuerzoInicioEdit] = useState('')
  const [horaAlmuerzoFinEdit, setHoraAlmuerzoFinEdit] = useState('')
  const [inicializando, setInicializando] = useState(false)

  useEffect(() => {
    cargarEmpleados()
  }, [])

  useEffect(() => {
    if (empleados.length > 0) {
      cargarRegistros()
    }
  }, [fecha, empleados])

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cuil, seccion')
      .eq('activo', true)
      .order('seccion')
      .order('nombre_completo')

    setEmpleados(data || [])
    setLoading(false)
  }

  const cargarRegistros = async () => {
    const { data } = await supabase
      .from('registros_asistencia')
      .select('*')
      .eq('fecha', fecha)

    const mapa = new Map()
    data?.forEach(r => mapa.set(r.empleado_id, r))
    setRegistros(mapa)
  }

  const calcularHorasTrabajadas = (entrada: string, salida: string, almuerzoInicio: string | null, almuerzoFin: string | null) => {
    if (!entrada || !salida) return 0
    
    const [hEntrada, mEntrada] = entrada.split(':').map(Number)
    const [hSalida, mSalida] = salida.split(':').map(Number)
    
    let minutosTotales = (hSalida * 60 + mSalida) - (hEntrada * 60 + mEntrada)
    
    if (almuerzoInicio && almuerzoFin) {
      const [hAlmuerzoIni, mAlmuerzoIni] = almuerzoInicio.split(':').map(Number)
      const [hAlmuerzoFin, mAlmuerzoFin] = almuerzoFin.split(':').map(Number)
      const minutosAlmuerzo = (hAlmuerzoFin * 60 + mAlmuerzoFin) - (hAlmuerzoIni * 60 + mAlmuerzoIni)
      minutosTotales -= minutosAlmuerzo
    }
    
    return minutosTotales / 60
  }

  const inicializarDia = async () => {
    if (!confirm(`¿Inicializar el día ${new Date(fecha).toLocaleDateString('es-AR')} con todos los empleados como PRESENTES?\n\nEsto creará registros automáticos para los ${empleados.length} empleados.`)) {
      return
    }

    setInicializando(true)
    
    try {
      const registrosACrear = empleados
        .filter(e => !registros.has(e.id))
        .map(e => {
          const horasTrabajadas = calcularHorasTrabajadas(
            HORA_ENTRADA_DEFAULT,
            HORA_SALIDA_DEFAULT,
            null,
            null
          )
          
          return {
            empleado_id: e.id,
            fecha: fecha,
            hora_entrada: HORA_ENTRADA_DEFAULT,
            hora_salida: HORA_SALIDA_DEFAULT,
            hora_almuerzo_inicio: null,
            hora_almuerzo_fin: null,
            horas_trabajadas: horasTrabajadas,
            estado: 'presente',
            registrado_por: 'admin',
            observaciones: 'Registro masivo inicializado'
          }
        })

      if (registrosACrear.length === 0) {
        alert('Ya todos los empleados están registrados para este día')
        return
      }

      for (let i = 0; i < registrosACrear.length; i += 50) {
        const lote = registrosACrear.slice(i, i + 50)
        const { error } = await supabase
          .from('registros_asistencia')
          .insert(lote)

        if (error) {
          console.error('Error al insertar lote:', error)
        }
      }

      await cargarRegistros()
      alert(`✅ Día inicializado: ${registrosACrear.length} empleados marcados como presentes`)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al inicializar el día')
    } finally {
      setInicializando(false)
    }
  }

  const actualizarEstado = async (empleadoId: string, nuevoEstado: string) => {
    setGuardando(true)
    
    try {
      const existente = registros.get(empleadoId)
      
      if (existente) {
        await supabase
          .from('registros_asistencia')
          .update({ 
            estado: nuevoEstado, 
            updated_at: new Date().toISOString()
          })
          .eq('id', existente.id)

        await supabase.from('logs_asistencia').insert({
          registro_id: existente.id,
          accion: 'modificado',
          campo_modificado: 'estado',
          valor_anterior: existente.estado,
          valor_nuevo: nuevoEstado,
          usuario_nombre: 'Admin'
        })
      } else {
        const { data: nuevo } = await supabase
          .from('registros_asistencia')
          .insert({
            empleado_id: empleadoId,
            fecha: fecha,
            estado: nuevoEstado,
            registrado_por: 'admin'
          })
          .select()
          .single()

        if (nuevo) {
          await supabase.from('logs_asistencia').insert({
            registro_id: nuevo.id,
            accion: 'creado',
            campo_modificado: 'estado',
            valor_nuevo: nuevoEstado,
            usuario_nombre: 'Admin'
          })
        }
      }

      await cargarRegistros()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const registrarEntrada = async (empleadoId: string) => {
    const hora = new Date().toTimeString().slice(0, 5)
    const existente = registros.get(empleadoId)
    
    try {
      if (existente) {
        await supabase
          .from('registros_asistencia')
          .update({ hora_entrada: hora, estado: 'presente' })
          .eq('id', existente.id)

        await supabase.from('logs_asistencia').insert({
          registro_id: existente.id,
          accion: 'modificado',
          campo_modificado: 'hora_entrada',
          valor_anterior: existente.hora_entrada,
          valor_nuevo: hora,
          usuario_nombre: 'Admin'
        })
      } else {
        await supabase
          .from('registros_asistencia')
          .insert({
            empleado_id: empleadoId,
            fecha: fecha,
            hora_entrada: hora,
            estado: 'presente',
            registrado_por: 'admin'
          })
      }

      await cargarRegistros()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const registrarSalida = async (empleadoId: string) => {
    const hora = new Date().toTimeString().slice(0, 5)
    const existente = registros.get(empleadoId)
    
    try {
      if (existente) {
        await supabase
          .from('registros_asistencia')
          .update({ hora_salida: hora })
          .eq('id', existente.id)

        await supabase.from('logs_asistencia').insert({
          registro_id: existente.id,
          accion: 'modificado',
          campo_modificado: 'hora_salida',
          valor_anterior: existente.hora_salida,
          valor_nuevo: hora,
          usuario_nombre: 'Admin'
        })

        await cargarRegistros()
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const abrirModalEdicion = (empleadoId: string) => {
    const registro = registros.get(empleadoId)
    const empleado = empleados.find(e => e.id === empleadoId)
    
    setRegistroEditar({
      ...registro,
      empleado: empleado,
      id: empleadoId
    })
    setHoraEntradaEdit(registro?.hora_entrada || HORA_ENTRADA_DEFAULT)
    setHoraSalidaEdit(registro?.hora_salida || HORA_SALIDA_DEFAULT)
    setHoraAlmuerzoInicioEdit(registro?.hora_almuerzo_inicio || '')
    setHoraAlmuerzoFinEdit(registro?.hora_almuerzo_fin || '')
    setMostrarModalEdicion(true)
  }

  const guardarEdicion = async () => {
    if (!registroEditar) return
    
    setGuardando(true)
    
    try {
      const existente = registros.get(registroEditar.id)
      const horasTrabajadas = calcularHorasTrabajadas(
        horaEntradaEdit,
        horaSalidaEdit,
        horaAlmuerzoInicioEdit || null,
        horaAlmuerzoFinEdit || null
      )
      
      if (existente) {
        await supabase
          .from('registros_asistencia')
          .update({
            hora_entrada: horaEntradaEdit || null,
            hora_salida: horaSalidaEdit || null,
            hora_almuerzo_inicio: horaAlmuerzoInicioEdit || null,
            hora_almuerzo_fin: horaAlmuerzoFinEdit || null,
            horas_trabajadas: horasTrabajadas,
            updated_at: new Date().toISOString(),
            observaciones_admin: `Editado por admin: entrada ${horaEntradaEdit}${horaAlmuerzoInicioEdit ? `, almuerzo ${horaAlmuerzoInicioEdit}-${horaAlmuerzoFinEdit}` : ''}, salida ${horaSalidaEdit}`
          })
          .eq('id', existente.id)

        await supabase.from('logs_asistencia').insert({
          registro_id: existente.id,
          accion: 'modificado',
          campo_modificado: 'horarios',
          valor_anterior: `${existente.hora_entrada} - ${existente.hora_salida}`,
          valor_nuevo: `${horaEntradaEdit} - ${horaSalidaEdit}${horaAlmuerzoInicioEdit ? ` (almuerzo: ${horaAlmuerzoInicioEdit}-${horaAlmuerzoFinEdit})` : ''}`,
          usuario_nombre: 'Admin'
        })
      } else {
        await supabase
          .from('registros_asistencia')
          .insert({
            empleado_id: registroEditar.id,
            fecha: fecha,
            hora_entrada: horaEntradaEdit || null,
            hora_salida: horaSalidaEdit || null,
            hora_almuerzo_inicio: horaAlmuerzoInicioEdit || null,
            hora_almuerzo_fin: horaAlmuerzoFinEdit || null,
            horas_trabajadas: horasTrabajadas,
            estado: 'presente',
            registrado_por: 'admin',
            observaciones_admin: 'Registro creado por admin'
          })
      }

      setMostrarModalEdicion(false)
      setRegistroEditar(null)
      await cargarRegistros()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const estadisticas = {
    total: empleados.length,
    registrados: registros.size,
    presentes: Array.from(registros.values()).filter(r => r.estado === 'presente').length,
    ausentes: Array.from(registros.values()).filter(r => r.estado?.startsWith('ausente')).length,
    tardes: Array.from(registros.values()).filter(r => r.estado === 'tarde').length,
    permisos: Array.from(registros.values()).filter(r => 
      ['permiso', 'vacaciones', 'licencia_medica', 'licencia_familiar'].includes(r.estado)
    ).length,
    ilt_art: Array.from(registros.values()).filter(r => r.estado === 'ilt').length,
    sinRegistrar: empleados.length - registros.size,
  }

  const secciones = [...new Set(empleados.map(e => e.seccion).filter(Boolean))]

  const empleadosFiltrados = empleados.filter(e => {
    const matchSeccion = filtroSeccion === 'todos' || e.seccion === filtroSeccion
    const matchBusqueda = !busqueda || 
      e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.cuil?.includes(busqueda)
    return matchSeccion && matchBusqueda
  })

  const getEstadoColor = (estado: string) => {
    const info = ESTADOS_ASISTENCIA.find(e => e.value === estado)
    return info?.color || 'gray'
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Registro de Asistencia</h1>
          <p className="text-gray-600">Control diario de asistencia del personal</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <label className="text-sm font-medium">Fecha:</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
          <button
            onClick={inicializarDia}
            disabled={inicializando || estadisticas.sinRegistrar === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {inicializando ? '⏳ Inicializando...' : '⚡ Inicializar Día (Todos Presente)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <p className="text-xs text-gray-600">Total Empleados</p>
          <p className="text-2xl font-bold text-blue-900">{estadisticas.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
          <p className="text-xs text-gray-600">Registrados</p>
          <p className="text-2xl font-bold text-gray-900">{estadisticas.registrados}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <p className="text-xs text-gray-600">Presentes</p>
          <p className="text-2xl font-bold text-green-900">{estadisticas.presentes}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <p className="text-xs text-gray-600">Ausentes</p>
          <p className="text-2xl font-bold text-red-900">{estadisticas.ausentes}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <p className="text-xs text-gray-600">Tardes</p>
          <p className="text-2xl font-bold text-orange-900">{estadisticas.tardes}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <p className="text-xs text-gray-600">Permisos/Licencias</p>
          <p className="text-2xl font-bold text-purple-900">{estadisticas.permisos}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
          <p className="text-xs text-gray-600">ILT/ART</p>
          <p className="text-2xl font-bold text-red-700">{estadisticas.ilt_art}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <p className="text-xs text-gray-600">Sin Registrar</p>
          <p className="text-2xl font-bold text-yellow-900">{estadisticas.sinRegistrar}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="🔍 Buscar empleado..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2"
          />
          <select
            value={filtroSeccion}
            onChange={(e) => setFiltroSeccion(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="todos">Todas las secciones</option>
            {secciones.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Empleado</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Sección</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Entrada</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Almuerzo</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Salida</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Horas</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {empleadosFiltrados.map((empleado) => {
                const registro = registros.get(empleado.id)
                const estadoActual = registro?.estado || 'sin_registrar'
                const colorEstado = getEstadoColor(estadoActual)
                const horasTrabajadas = registro?.horas_trabajadas || 0

                return (
                  <tr key={empleado.id} className={`hover:bg-gray-50 ${estadoActual === 'sin_registrar' ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{empleado.nombre_completo}</p>
                        <p className="text-xs text-gray-500">{empleado.cuil}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {empleado.seccion || 'Sin sección'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono">
                      {registro?.hora_entrada || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono">
                      {registro?.hora_almuerzo_inicio && registro?.hora_almuerzo_fin 
                        ? `${registro.hora_almuerzo_inicio}-${registro.hora_almuerzo_fin}` 
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono">
                      {registro?.hora_salida || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold">
                      {horasTrabajadas > 0 ? `${horasTrabajadas.toFixed(1)}h` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-${colorEstado}-100 text-${colorEstado}-800`}>
                        {ESTADOS_ASISTENCIA.find(e => e.value === estadoActual)?.label || 'Sin registrar'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <button
                          onClick={() => registrarEntrada(empleado.id)}
                          disabled={guardando || !!registro?.hora_entrada}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-300"
                          title="Registrar entrada"
                        >
                          ▶ Entrada
                        </button>
                        <button
                          onClick={() => registrarSalida(empleado.id)}
                          disabled={guardando || !registro?.hora_entrada || !!registro?.hora_salida}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-gray-300"
                          title="Registrar salida"
                        >
                          ◀ Salida
                        </button>
                        <button
                          onClick={() => abrirModalEdicion(empleado.id)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          title="Editar horarios"
                        >
                          ✏️ Editar
                        </button>
                        <select
                          value={estadoActual}
                          onChange={(e) => actualizarEstado(empleado.id, e.target.value)}
                          disabled={guardando}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="sin_registrar">Sin registrar</option>
                          {ESTADOS_ASISTENCIA.map(e => (
                            <option key={e.value} value={e.value}>
                              {e.icon} {e.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {mostrarModalEdicion && registroEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Editar Horarios</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Empleado: <strong>{registroEditar.empleado?.nombre_completo}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Fecha: <strong>{new Date(fecha).toLocaleDateString('es-AR')}</strong>
              </p>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Hora de Entrada:</label>
                <input
                  type="time"
                  value={horaEntradaEdit}
                  onChange={(e) => setHoraEntradaEdit(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Almuerzo Inicio (opcional):</label>
                  <input
                    type="time"
                    value={horaAlmuerzoInicioEdit}
                    onChange={(e) => setHoraAlmuerzoInicioEdit(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="No almuerza"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Almuerzo Fin (opcional):</label>
                  <input
                    type="time"
                    value={horaAlmuerzoFinEdit}
                    onChange={(e) => setHoraAlmuerzoFinEdit(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="No almuerza"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Hora de Salida:</label>
                <input
                  type="time"
                  value={horaSalidaEdit}
                  onChange={(e) => setHoraSalidaEdit(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-900">
                  <strong>Horas trabajadas calculadas:</strong>{' '}
                  {calcularHorasTrabajadas(
                    horaEntradaEdit,
                    horaSalidaEdit,
                    horaAlmuerzoInicioEdit || null,
                    horaAlmuerzoFinEdit || null
                  ).toFixed(2)} horas
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={guardarEdicion}
                disabled={guardando}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => {
                  setMostrarModalEdicion(false)
                  setRegistroEditar(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}