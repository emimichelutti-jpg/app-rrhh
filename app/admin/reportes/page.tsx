'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function ReportesPage() {
  const [stats, setStats] = useState<any>({
    totalEmpleados: 0,
    activos: 0,
    inactivos: 0,
    antiguedadPromedio: 0,
    edadPromedio: 0
  })
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [generoStats, setGeneroStats] = useState<any[]>([])
  const [licenciasPendientes, setLicenciasPendientes] = useState<any[]>([])
  const [empleadosVacaciones, setEmpleadosVacaciones] = useState<any[]>([])
  const [documentosVenciendo, setDocumentosVenciendo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarReportes()
  }, [])

  const cargarReportes = async () => {
    const hoy = new Date()

    // 1. Total de empleados
    const { data: empleados } = await supabase
      .from('empleados')
      .select('*')
    
    if (empleados) {
      const activos = empleados.filter(e => e.estado === 'activo')
      const inactivos = empleados.filter(e => e.estado === 'inactivo')
      
      // Calcular antigüedad promedio
      const antiguedades = activos.map(e => {
        const ingreso = new Date(e.fecha_ingreso)
        const diffTime = Math.abs(hoy.getTime() - ingreso.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
      })
      const antiguedadPromedio = antiguedades.length > 0 
        ? Math.round(antiguedades.reduce((a, b) => a + b, 0) / antiguedades.length / 365 * 10) / 10
        : 0

      // Calcular edad promedio
      const edades = activos.filter(e => e.fecha_nacimiento).map(e => {
        const nacimiento = new Date(e.fecha_nacimiento)
        const diffTime = Math.abs(hoy.getTime() - nacimiento.getTime())
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365.25))
      })
      const edadPromedio = edades.length > 0 
        ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length)
        : 0

      setStats({
        totalEmpleados: empleados.length,
        activos: activos.length,
        inactivos: inactivos.length,
        antiguedadPromedio,
        edadPromedio
      })

      // 2. Empleados por departamento
      const deptosMap = new Map<string, number>()
      activos.forEach(e => {
        const depto = e.departamentos?.nombre || 'Sin Departamento'
        deptosMap.set(depto, (deptosMap.get(depto) || 0) + 1)
      })
      setDepartamentos(Array.from(deptosMap.entries()).map(([name, count]) => ({ name, count })))

      // 3. Empleados por género
      const generoMap = new Map<string, number>()
      activos.forEach(e => {
        const genero = e.genero || 'No especificado'
        generoMap.set(genero, (generoMap.get(genero) || 0) + 1)
      })
      setGeneroStats(Array.from(generoMap.entries()).map(([name, count]) => ({ name, count })))
    }

    // 4. Licencias pendientes
    const { data: licencias } = await supabase
      .from('licencias')
      .select('*, empleados(nombre_completo, cargo)')
      .eq('estado', 'pendiente')
      .order('fecha_solicitud', { ascending: false })
      .limit(10)
    if (licencias) setLicenciasPendientes(licencias)

    // 5. Empleados de vacaciones esta semana
    const hoyStr = hoy.toISOString().split('T')[0]
    const { data: vacaciones } = await supabase
      .from('licencias')
      .select('*, empleados(nombre_completo, cargo)')
      .eq('estado', 'aprobada')
      .eq('tipo', 'vacaciones')
      .lte('fecha_inicio', hoyStr)
      .gte('fecha_fin', hoyStr)
    if (vacaciones) setEmpleadosVacaciones(vacaciones)

    // 6. Documentos próximos a vencer (30 días)
    const dentro30Dias = new Date()
    dentro30Dias.setDate(dentro30Dias.getDate() + 30)
    const dentro30DiasStr = dentro30Dias.toISOString().split('T')[0]

    const { data: documentos } = await supabase
      .from('documentos_legajo')
      .select('*, empleados(nombre_completo)')
      .not('fecha_vencimiento', 'is', null)
      .lte('fecha_vencimiento', dentro30DiasStr)
      .gte('fecha_vencimiento', hoyStr)
      .order('fecha_vencimiento')
      .limit(10)
    if (documentos) setDocumentosVenciendo(documentos)

    setLoading(false)
  }

  const exportarAExcel = (tipo: string) => {
    alert(`Exportando ${tipo} a Excel... (Funcionalidad a implementar)`);
    // Acá iría la lógica de exportación
  }

  if (loading) return <div className="p-8">Cargando reportes...</div>

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard Ejecutivo</h1>
          <p className="text-sm text-gray-600">Reportes y estadísticas de RRHH</p>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">Total Empleados</div>
            <div className="text-3xl font-bold text-blue-600">{stats.totalEmpleados}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">Activos</div>
            <div className="text-3xl font-bold text-green-600">{stats.activos}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">Inactivos</div>
            <div className="text-3xl font-bold text-red-600">{stats.inactivos}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">Antigüedad Prom.</div>
            <div className="text-3xl font-bold text-purple-600">{stats.antiguedadPromedio} años</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">Edad Promedio</div>
            <div className="text-3xl font-bold text-orange-600">{stats.edadPromedio} años</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Empleados por Departamento */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Empleados por Departamento</h2>
            <div className="space-y-3">
              {departamentos.map((depto) => (
                <div key={depto.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{depto.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(depto.count / stats.activos) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold w-8">{depto.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Empleados por Género */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Distribución por Género</h2>
            <div className="space-y-3">
              {generoStats.map((gen) => (
                <div key={gen.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">{gen.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${(gen.count / stats.activos) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold w-8">{gen.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Licencias Pendientes */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4 text-yellow-700">Licencias Pendientes</h2>
            <div className="space-y-3 max-h-64 overflow-auto">
              {licenciasPendientes.length === 0 ? (
                <p className="text-sm text-gray-500">No hay solicitudes pendientes</p>
              ) : (
                licenciasPendientes.map((lic) => (
                  <div key={lic.id} className="border-b pb-2 last:border-0">
                    <div className="font-medium text-sm">{lic.empleados?.nombre_completo}</div>
                    <div className="text-xs text-gray-600">{lic.tipo} - {new Date(lic.fecha_inicio).toLocaleDateString('es-AR')} al {new Date(lic.fecha_fin).toLocaleDateString('es-AR')}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* De Vacaciones */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4 text-green-700">De Vacaciones Hoy</h2>
            <div className="space-y-3 max-h-64 overflow-auto">
              {empleadosVacaciones.length === 0 ? (
                <p className="text-sm text-gray-500">Nadie de vacaciones hoy</p>
              ) : (
                empleadosVacaciones.map((lic) => (
                  <div key={lic.id} className="border-b pb-2 last:border-0">
                    <div className="font-medium text-sm">{lic.empleados?.nombre_completo}</div>
                    <div className="text-xs text-gray-600">{lic.empleados?.cargo}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Documentos por Vencer */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4 text-red-700">Documentos por Vencer</h2>
            <div className="space-y-3 max-h-64 overflow-auto">
              {documentosVenciendo.length === 0 ? (
                <p className="text-sm text-gray-500">No hay documentos próximos a vencer</p>
              ) : (
                documentosVenciendo.map((doc) => (
                  <div key={doc.id} className="border-b pb-2 last:border-0">
                    <div className="font-medium text-sm">{doc.empleados?.nombre_completo}</div>
                    <div className="text-xs text-gray-600">{doc.categoria} - Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString('es-AR')}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Reportes Exportables */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Reportes Exportables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button 
              onClick={() => exportarAExcel('Nómina Completa')}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              📄 Nómina Completa
            </button>
            <button 
              onClick={() => exportarAExcel('Licencias')}
              className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition"
            >
              🏖️ Reporte de Licencias
            </button>
            <button 
              onClick={() => exportarAExcel('Documentos')}
              className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition"
            >
              📋 Documentos por Empleado
            </button>
            <button 
              onClick={() => exportarAExcel('Asistencia')}
              className="bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition"
            >
              ⏰ Control de Asistencia
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}