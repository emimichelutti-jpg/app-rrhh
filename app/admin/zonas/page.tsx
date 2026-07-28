'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Zona {
  id: string
  nombre: string
  descripcion: string | null
  creada_en: string
}

interface Empleado {
  id: string
  nombre_completo: string
  cuil: string
  legajo: string | null
  zona_id: string | null
  zona_nombre?: string
  activo: boolean
  motivo_baja?: string
  fecha_baja?: string
}

type MotivoBaja = 'renuncia' | 'despido' | 'mutuo_acuerdo' | 'jubilacion' | 'otros'

export default function AdminZonasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [zonaSeleccionada, setZonaSeleccionada] = useState<string | null>(null)
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [filtroMostrar, setFiltroMostrar] = useState<'todos' | 'activos' | 'desvinculados' | 'sin_zona' | 'en_zona'>('activos')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  
  // Modal de desvinculación
  const [mostrarModalBaja, setMostrarModalBaja] = useState(false)
  const [empleadoABaja, setEmpleadoABaja] = useState<string | null>(null)
  const [motivoBaja, setMotivoBaja] = useState<MotivoBaja>('renuncia')
  const [observacionesBaja, setObservacionesBaja] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)

      const { data: zonasData } = await supabase
        .from('zonas')
        .select('*')
        .order('nombre', { ascending: true })

      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cuil, legajo, zona_id, activo, motivo_baja, fecha_baja, zonas!left(nombre)')
        .order('nombre_completo', { ascending: true })

      const empleadosConZona = (empleadosData || []).map((e: any) => ({
        ...e,
        zona_nombre: e.zonas?.nombre || null
      }))

      setZonas(zonasData || [])
      setEmpleados(empleadosConZona)
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

  const seleccionarTodosFiltrados = () => {
    const empleadosVisibles = getEmpleadosVisibles()
    if (empleadosSeleccionados.size === empleadosVisibles.length) {
      setEmpleadosSeleccionados(new Set())
    } else {
      setEmpleadosSeleccionados(new Set(empleadosVisibles.map(e => e.id)))
    }
  }

  const getEmpleadosVisibles = (): Empleado[] => {
    let filtrados = empleados

    // Filtro de búsqueda
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase()
      filtrados = filtrados.filter(e => 
        e.nombre_completo.toLowerCase().includes(busquedaLower) ||
        e.cuil.includes(busqueda) ||
        (e.legajo && e.legajo.includes(busqueda))
      )
    }

    // Filtro de estado
    if (filtroMostrar === 'activos') {
      filtrados = filtrados.filter(e => e.activo !== false)
    } else if (filtroMostrar === 'desvinculados') {
      filtrados = filtrados.filter(e => e.activo === false)
    } else if (filtroMostrar === 'sin_zona') {
      filtrados = filtrados.filter(e => !e.zona_id && e.activo !== false)
    } else if (filtroMostrar === 'en_zona' && zonaSeleccionada) {
      filtrados = filtrados.filter(e => e.zona_id === zonaSeleccionada && e.activo !== false)
    }

    return filtrados
  }

  const guardarAsignaciones = async () => {
    if (!zonaSeleccionada) {
      setMensaje('️ Seleccioná una zona primero')
      return
    }
    if (empleadosSeleccionados.size === 0) {
      setMensaje('⚠️ Seleccioná al menos un empleado')
      return
    }

    const zonaNombre = zonas.find(z => z.id === zonaSeleccionada)?.nombre
    if (!confirm(`¿Asignar ${empleadosSeleccionados.size} empleado(s) a la zona "${zonaNombre}"?`)) {
      return
    }

    try {
      setGuardando(true)
      setMensaje('')
      console.log('🔄 Asignando empleados a zona:', zonaSeleccionada)

      const { error } = await supabase
        .from('empleados')
        .update({ zona_id: zonaSeleccionada })
        .in('id', Array.from(empleadosSeleccionados))

      if (error) {
        console.error('❌ Error de Supabase:', error)
        setMensaje(`❌ Error: ${error.message}`)
        return
      }

      console.log('✅ Empleados actualizados:', empleadosSeleccionados.size)
      setMensaje(`✅ ${empleadosSeleccionados.size} empleado(s) asignado(s) a ${zonaNombre}`)
      setEmpleadosSeleccionados(new Set())
      await cargarDatos()
      
      setTimeout(() => setMensaje(''), 5000)
    } catch (error: any) {
      console.error('❌ Error general:', error)
      setMensaje(`❌ Error: ${error.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const abrirModalBaja = (empleadoId: string) => {
    setEmpleadoABaja(empleadoId)
    setMotivoBaja('renuncia')
    setObservacionesBaja('')
    setMostrarModalBaja(true)
  }

  const confirmarBaja = async () => {
    if (!empleadoABaja) return

    const empleado = empleados.find(e => e.id === empleadoABaja)
    if (!empleado) return

    // Forzar siempre la zona DESVINCULADOS
    const zonaDesvinculadosId = zonas.find(z => z.nombre === 'DESVINCULADOS')?.id
    if (!zonaDesvinculadosId) {
      alert('Error: No se encontró la zona DESVINCULADOS en la base de datos')
      return
    }

    if (!confirm(`⚠️ ¿Confirmar desvinculación de ${empleado.nombre_completo}?\n\nEsta acción marcará al empleado como inactivo y lo moverá a la zona DESVINCULADOS.`)) {
      setMostrarModalBaja(false)
      return
    }

    try {
      setGuardando(true)
      
      const { error } = await supabase
        .from('empleados')
        .update({
          zona_id: zonaDesvinculadosId,
          activo: false,
          motivo_baja: motivoBaja,
          fecha_baja: new Date().toISOString(),
        })
        .eq('id', empleadoABaja)

      if (error) throw error

      setMensaje(`✅ ${empleado.nombre_completo} fue desvinculado correctamente`)
      setMostrarModalBaja(false)
      setEmpleadoABaja(null)
      await cargarDatos()
      
      setTimeout(() => setMensaje(''), 5000)
    } catch (error: any) {
      console.error('❌ Error al desvincular:', error)
      setMensaje(`❌ Error al desvincular: ${error.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const desvincularMultiple = async () => {
    if (empleadosSeleccionados.size === 0) return

    // Forzar siempre la zona DESVINCULADOS
    const zonaDesvinculadosId = zonas.find(z => z.nombre === 'DESVINCULADOS')?.id
    if (!zonaDesvinculadosId) {
      alert('Error: No se encontró la zona DESVINCULADOS en la base de datos')
      return
    }

    try {
      setGuardando(true)
      setMensaje('')

      const { error } = await supabase
        .from('empleados')
        .update({
          zona_id: zonaDesvinculadosId,
          activo: false,
          motivo_baja: 'otros',
          fecha_baja: new Date().toISOString()
        })
        .in('id', Array.from(empleadosSeleccionados))

      if (error) throw error

      setMensaje(`✅ ${empleadosSeleccionados.size} empleado(s) desvinculado(s) correctamente`)
      setEmpleadosSeleccionados(new Set())
      await cargarDatos()
      
      setTimeout(() => setMensaje(''), 5000)
    } catch (error: any) {
      console.error('❌ Error al desvincular:', error)
      setMensaje(`❌ Error: ${error.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const reactivarEmpleado = async (empleadoId: string) => {
    const empleado = empleados.find(e => e.id === empleadoId)
    if (!confirm(`¿Reactivar a ${empleado?.nombre_completo}?\n\nVolverá a estar activo pero sin zona asignada.`)) return

    try {
      const { error } = await supabase
        .from('empleados')
        .update({
          activo: true,
          zona_id: null,
          motivo_baja: null,
          fecha_baja: null
        })
        .eq('id', empleadoId)

      if (error) throw error

      setMensaje(`✅ ${empleado?.nombre_completo} fue reactivado`)
      await cargarDatos()
      setTimeout(() => setMensaje(''), 3000)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const quitarDeZona = async (empleadoId: string) => {
    const empleado = empleados.find(e => e.id === empleadoId)
    if (!confirm(`¿Quitar a ${empleado?.nombre_completo} de la zona "${zonaActual?.nombre}"?\n\nEl empleado quedará sin zona asignada.`)) return

    try {
      console.log('🔄 Quitando empleado de zona:', empleadoId)
      
      const { data, error } = await supabase
        .from('empleados')
        .update({ zona_id: null })
        .eq('id', empleadoId)
        .select()

      if (error) {
        console.error(' Error de Supabase:', error)
        setMensaje(`❌ Error al quitar de zona: ${error.message}`)
        setTimeout(() => setMensaje(''), 5000)
        return
      }

      console.log('✅ Empleado actualizado:', data)
      await cargarDatos()
      setMensaje(`✅ ${empleado?.nombre_completo} fue quitado de la zona`)
      setTimeout(() => setMensaje(''), 3000)
    } catch (error: any) {
      console.error('❌ Error general:', error)
      setMensaje(`❌ Error: ${error.message}`)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-600">Cargando...</div>
  }

  const zonaActual = zonas.find(z => z.id === zonaSeleccionada)
  const esZonaDesvinculados = zonaActual?.nombre === 'DESVINCULADOS'
  const empleadosVisibles = getEmpleadosVisibles()
  const empleadosEnZonaActual = zonaSeleccionada 
    ? esZonaDesvinculados
      ? empleados.filter(e => e.zona_id === zonaSeleccionada && e.activo === false)
      : empleados.filter(e => e.zona_id === zonaSeleccionada && (filtroMostrar === 'todos' || e.activo !== false))
    : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Zonas</h1>
          <p className="text-slate-600">Asigná empleados a cada zona operativa</p>
        </div>
        <button
          onClick={() => router.push('/admin/empleados')}
          className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          ← Volver a Empleados
        </button>
      </div>

      {/* Mensaje de estado */}
      {mensaje && (
        <div className={`mb-4 p-4 rounded-lg ${
          mensaje.startsWith('✅') ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
          mensaje.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' :
          'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {mensaje}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* COLUMNA IZQUIERDA: Lista de Zonas */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-slate-900 mb-3"> Zonas ({zonas.length})</h2>
            <div className="space-y-2">
              {zonas.map(zona => {
                const esDesvinculados = zona.nombre === 'DESVINCULADOS'
                const cantidadEmpleados = esDesvinculados 
                  ? empleados.filter(e => e.zona_id === zona.id && e.activo === false).length
                  : empleados.filter(e => e.zona_id === zona.id && e.activo !== false).length
                return (
                  <button
                    key={zona.id}
                    onClick={() => {
                      setZonaSeleccionada(zona.id)
                      setEmpleadosSeleccionados(new Set())
                      setBusqueda('')
                      setFiltroMostrar('activos')
                      setMensaje('')
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${
                      zonaSeleccionada === zona.id
                        ? esDesvinculados
                          ? 'bg-rose-900 text-white border-rose-900'
                          : 'bg-slate-800 text-white border-slate-800'
                        : esDesvinculados
                        ? 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{zona.nombre}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        zonaSeleccionada === zona.id
                          ? 'bg-white text-slate-800'
                          : esDesvinculados
                          ? 'bg-rose-200 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {cantidadEmpleados}
                      </span>
                    </div>
                    {zona.descripcion && (
                      <p className={`text-xs mt-1 ${
                        zonaSeleccionada === zona.id ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        {zona.descripcion}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Resumen */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                <p><strong>Total empleados:</strong> {empleados.filter(e => e.activo !== false).length}</p>
                <p><strong>Sin zona:</strong> {empleados.filter(e => !e.zona_id && e.activo !== false).length}</p>
                <p><strong>Desvinculados:</strong> {empleados.filter(e => e.activo === false).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Empleados */}
        <div className="lg:col-span-3">
          {!zonaSeleccionada ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <span className="text-6xl mb-4 block"></span>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Seleccioná una zona</h3>
              <p className="text-slate-600">Hacé clic en una zona de la izquierda para gestionar empleados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              {/* Header de la zona */}
              <div className={`p-4 border-b border-slate-200 rounded-t-lg ${
                esZonaDesvinculados ? 'bg-rose-50' : 'bg-slate-50'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h2 className={`text-xl font-bold ${
                      esZonaDesvinculados ? 'text-rose-900' : 'text-slate-900'
                    }`}>{zonaActual?.nombre}</h2>
                    <p className="text-sm text-slate-600">
                      {empleadosEnZonaActual.length} empleado(s) {
                        esZonaDesvinculados ? 'desvinculado(s)' : 'asignado(s) a esta zona'
                      }
                    </p>
                  </div>
                  <button
                    onClick={seleccionarTodosFiltrados}
                    className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 text-sm font-medium"
                  >
                    {empleadosSeleccionados.size === empleadosVisibles.length 
                      ? 'Deseleccionar todos' 
                      : 'Seleccionar visibles'}
                  </button>
                </div>

                {/* Filtros */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button
                    onClick={() => setFiltroMostrar('activos')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      filtroMostrar === 'activos' 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                  >
                    Activos ({empleados.filter(e => e.activo !== false).length})
                  </button>
                  {!esZonaDesvinculados && (
                    <>
                      <button
                        onClick={() => setFiltroMostrar('sin_zona')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          filtroMostrar === 'sin_zona' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        Sin zona ({empleados.filter(e => !e.zona_id && e.activo !== false).length})
                      </button>
                      <button
                        onClick={() => setFiltroMostrar('en_zona')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          filtroMostrar === 'en_zona' 
                            ? 'bg-slate-800 text-white' 
                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                        }`}
                      >
                        En esta zona ({empleadosEnZonaActual.length})
                      </button>
                    </>
                  )}
                  {esZonaDesvinculados && (
  <>
    <button
      onClick={() => setFiltroMostrar('activos')}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        filtroMostrar === 'activos' 
          ? 'bg-emerald-600 text-white' 
          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
      }`}
    >
      Activos ({empleados.filter(e => e.activo !== false).length})
    </button>
    <button
      onClick={() => setFiltroMostrar('desvinculados')}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        filtroMostrar === 'desvinculados' 
          ? 'bg-rose-600 text-white' 
          : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
      }`}
    >
      Desvinculados ({empleados.filter(e => e.activo === false).length})
    </button>
    <button
      onClick={() => setFiltroMostrar('todos')}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        filtroMostrar === 'todos' 
          ? 'bg-slate-800 text-white' 
          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
      }`}
    >
      Todos ({empleados.length})
    </button>
  </>
)}
                </div>

                {/* Buscador */}
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder=" Buscar por nombre, CUIL o legajo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* Lista de empleados */}
              <div className="max-h-96 overflow-y-auto">
                {empleadosVisibles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    {busqueda ? 'No hay empleados que coincidan con la búsqueda' : 'No hay empleados para mostrar'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {empleadosVisibles.map(empleado => {
                      const seleccionado = empleadosSeleccionados.has(empleado.id)
                      const yaEstaEnZona = empleado.zona_id === zonaSeleccionada
                      const esDesvinculado = empleado.activo === false
                      
                      return (
                        <div 
                          key={empleado.id}
                          className={`flex items-center justify-between p-3 hover:bg-slate-50 transition-colors ${
                            seleccionado ? 'bg-slate-100' : ''
                          } ${yaEstaEnZona && !esDesvinculado ? 'border-l-4 border-emerald-500' : ''} ${
                            esDesvinculado ? 'bg-rose-50 border-l-4 border-rose-400' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {!esDesvinculado && (
                              <input
                                type="checkbox"
                                checked={seleccionado}
                                onChange={() => toggleEmpleado(empleado.id)}
                                disabled={yaEstaEnZona}
                                className="w-4 h-4 text-slate-800 rounded focus:ring-slate-500 cursor-pointer disabled:opacity-50"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${
                                esDesvinculado ? 'text-rose-900' : 'text-slate-900'
                              }`}>
                                {empleado.nombre_completo}
                                {esDesvinculado && <span className="ml-2 text-xs text-rose-600">⚠️ Desvinculado</span>}
                                {yaEstaEnZona && !esDesvinculado && <span className="ml-2 text-xs text-emerald-600">✓ Ya asignado</span>}
                              </p>
                              <p className="text-xs text-slate-500">
                                CUIL: {empleado.cuil}
                                {empleado.legajo && ` | Legajo: ${empleado.legajo}`}
                                {empleado.motivo_baja && esDesvinculado && (
                                  <span className="ml-2 text-rose-600">
                                    Motivo: {empleado.motivo_baja.replace('_', ' ')}
                                  </span>
                                )}
                              </p>
                              {empleado.fecha_baja && esDesvinculado && (
                                <p className="text-xs text-rose-500">
                                  Fecha baja: {new Date(empleado.fecha_baja).toLocaleDateString('es-AR')}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            {esZonaDesvinculados && esDesvinculado ? (
                              <button
                                onClick={() => reactivarEmpleado(empleado.id)}
                                className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 transition-colors"
                                title="Reactivar empleado"
                              >
                                🔄 Reactivar
                              </button>
                            ) : !esZonaDesvinculados && !esDesvinculado ? (
                              <button
                                onClick={() => abrirModalBaja(empleado.id)}
                                className="text-xs bg-rose-600 text-white px-3 py-1 rounded hover:bg-rose-700 transition-colors"
                                title="Desvincular empleado"
                              >
                                🚫 Desvincular
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer con botón de acción */}
              {empleadosSeleccionados.size > 0 && (
                <div className={`p-4 border-t rounded-b-lg flex justify-between items-center ${
                  esZonaDesvinculados 
                    ? 'bg-rose-50 border-rose-200' 
                    : 'bg-amber-50 border-slate-200'
                }`}>
                  <p className={`text-sm ${
                    esZonaDesvinculados ? 'text-rose-900' : 'text-amber-900'
                  }`}>
                    <strong>{empleadosSeleccionados.size}</strong> empleado(s) seleccionado(s) para {
                      esZonaDesvinculados 
                        ? 'desvincular' 
                        : <>asignar a <strong>{zonaActual?.nombre}</strong></>
                    }
                  </p>
                  <button
                    onClick={() => {
                      if (esZonaDesvinculados) {
                        if (empleadosSeleccionados.size === 1) {
                          abrirModalBaja(Array.from(empleadosSeleccionados)[0])
                        } else {
                          if (confirm(`¿Desvincular ${empleadosSeleccionados.size} empleado(s)?\n\nSe marcarán como inactivos con motivo "Otros".`)) {
                            desvincularMultiple()
                          }
                        }
                      } else {
                        guardarAsignaciones()
                      }
                    }}
                    disabled={guardando}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      esZonaDesvinculados
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {guardando ? 'Procesando...' : esZonaDesvinculados ? '🚫 Desvincular' : '💾 Guardar Asignación'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Desvinculación */}
      {mostrarModalBaja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-rose-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-bold">🚫 Desvincular Empleado</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                <p className="text-sm text-rose-800">
                  <strong>⚠️ Atención:</strong> Esta acción marcará al empleado como inactivo y lo moverá a la zona DESVINCULADOS.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo de desvinculación *
                </label>
                <select
                  value={motivoBaja}
                  onChange={(e) => setMotivoBaja(e.target.value as MotivoBaja)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="renuncia">Renuncia voluntaria</option>
                  <option value="despido">Despido</option>
                  <option value="mutuo_acuerdo">Mutuo acuerdo</option>
                  <option value="jubilacion">Jubilación</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={observacionesBaja}
                  onChange={(e) => setObservacionesBaja(e.target.value)}
                  placeholder="Detalles adicionales sobre la desvinculación..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMostrarModalBaja(false)
                    setEmpleadoABaja(null)
                  }}
                  disabled={guardando}
                  className="flex-1 bg-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-400 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarBaja}
                  disabled={guardando}
                  className="flex-1 bg-rose-600 text-white py-3 rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {guardando ? 'Procesando...' : '🚫 Confirmar Desvinculación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}