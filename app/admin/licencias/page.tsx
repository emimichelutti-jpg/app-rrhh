'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

const TIPOS_LICENCIA = [
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'enfermedad', label: 'Enfermedad' },
  { value: 'estudio', label: 'Estudio' },
  { value: 'matrimonio', label: 'Matrimonio' },
  { value: 'otro', label: 'Otro' }
]

export default function LicenciasPage() {
  const [licencias, setLicencias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas') 

  useEffect(() => {
    cargarLicencias()
  }, [filtro])

  const cargarLicencias = async () => {
    let query = supabase
      .from('licencias')
      .select('*, empleados(nombre_completo)')
      .order('fecha_solicitud', { ascending: false })

    if (filtro !== 'todas') {
      query = query.eq('estado', filtro)
    }

    const { data, error } = await query
    if (error) console.error(error)
    else setLicencias(data || [])
    
    setLoading(false)
  }

  const cambiarEstado = async (id: string, nuevoEstado: 'aprobada' | 'rechazada') => {
    const { error } = await supabase
      .from('licencias')
      .update({ estado: nuevoEstado })
      .eq('id', id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      cargarLicencias() 
    }
  }

  if (loading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Gestión de Licencias</h1>
          
          {/* Filtros */}
          <div className="flex gap-2">
            {['todas', 'pendiente', 'aprobada', 'rechazada'].map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  filtro === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Desde</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hasta</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licencias.map((lic) => {
                const colorEstado = 
                  lic.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                  lic.estado === 'aprobada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

                return (
                  <tr key={lic.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{lic.empleados?.nombre_completo}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {TIPOS_LICENCIA.find(t => t.value === lic.tipo)?.label || lic.tipo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(lic.fecha_inicio).toLocaleDateString('es-AR')}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(lic.fecha_fin).toLocaleDateString('es-AR')}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{lic.motivo || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${colorEstado}`}>
                        {lic.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      {lic.estado === 'pendiente' && (
                        <>
                          <button 
                            onClick={() => cambiarEstado(lic.id, 'aprobada')}
                            className="text-green-600 hover:text-green-900 font-semibold">
                            Aprobar
                          </button>
                          <button 
                            onClick={() => cambiarEstado(lic.id, 'rechazada')}
                            className="text-red-600 hover:text-red-900 font-semibold">
                            Rechazar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {licencias.length === 0 && (
            <div className="text-center py-8 text-gray-500">No hay licencias para mostrar</div>
          )}
        </div>
      </div>
    </div>
  )
}