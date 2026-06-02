'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

const CATEGORIAS = [
  { value: 'dni', label: 'DNI' },
  { value: 'alta_arca', label: 'Alta ARCA' },
  { value: 'certificado_medico', label: 'Certificado Médico' },
  { value: 'apercibimiento', label: 'Apercibimiento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'titulo', label: 'Título' },
  { value: 'constancia_cuil', label: 'Constancia CUIL' },
  { value: 'otro', label: 'Otro' }
]

export default function DocumentosPage() {
  const [empleados, setEmpleados] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  
  const [formData, setFormData] = useState({
    empleado_id: '',
    categoria: 'dni',
    descripcion: '',
    fecha_vencimiento: ''
  })
  const [archivo, setArchivo] = useState<File | null>(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    const { data: empleadosData } = await supabase
      .from('empleados')
      .select('id, nombre_completo, email')
      .eq('estado', 'activo')
      .order('nombre_completo')
    if (empleadosData) setEmpleados(empleadosData)

    const { data: docsData } = await supabase
      .from('documentos_legajo')
      .select('*, empleados(nombre_completo)')
      .order('created_at', { ascending: false })
    if (docsData) setDocumentos(docsData)

    setLoading(false)
  }

  const handleSubirDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivo || !formData.empleado_id) {
      alert('Seleccioná un empleado y un archivo')
      return
    }

    setSubiendo(true)

    // 1. Subir archivo a Storage
    const nombreArchivo = `${formData.empleado_id}/${Date.now()}_${archivo.name}`
    const { error: uploadError } = await supabase.storage
      .from('documentos-legajo')
      .upload(nombreArchivo, archivo)

    if (uploadError) {
      alert('Error al subir archivo: ' + uploadError.message)
      setSubiendo(false)
      return
    }

    // 2. Obtener URL pública (aunque el bucket es privado, necesitamos la URL)
    const { data: urlData } = supabase.storage
      .from('documentos-legajo')
      .getPublicUrl(nombreArchivo)

    // 3. Guardar registro en la tabla documentos_legajo
    const { error: dbError } = await supabase
      .from('documentos_legajo')
      .insert({
        empleado_id: formData.empleado_id,
        categoria: formData.categoria,
        descripcion: formData.descripcion,
        archivo_url: urlData.publicUrl,
        fecha_vencimiento: formData.fecha_vencimiento || null
      })

    if (dbError) {
      alert('Error al guardar: ' + dbError.message)
      setSubiendo(false)
      return
    }

    alert('Documento subido exitosamente')
    setFormData({
      empleado_id: '',
      categoria: 'dni',
      descripcion: '',
      fecha_vencimiento: ''
    })
    setArchivo(null)
    cargarDatos()
    setSubiendo(false)
  }

  if (loading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Gestión de Documentos</h1>

        {/* Formulario de Subida */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Subir Nuevo Documento</h2>
          <form onSubmit={handleSubirDocumento} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Empleado *
                </label>
                <select
                  required
                  value={formData.empleado_id}
                  onChange={(e) => setFormData({...formData, empleado_id: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="">Seleccionar empleado...</option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría *
                </label>
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Ej: DNI frente y dorso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  value={formData.fecha_vencimiento}
                  onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo *
                </label>
                <input
                  type="file"
                  onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                  className="w-full p-2 border border-gray-300 rounded"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={subiendo}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {subiendo ? 'Subiendo...' : 'Subir Documento'}
            </button>
          </form>
        </div>

        {/* Lista de Documentos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Documentos Cargados</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Carga</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documentos.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{doc.empleados?.nombre_completo}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {CATEGORIAS.find(c => c.value === doc.categoria)?.label || doc.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{doc.descripcion || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(doc.fecha_carga).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <a
                      href={doc.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documentos.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay documentos cargados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}