'use client'

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Categorías predefinidas
export const CATEGORIAS_DOCUMENTO = [
  { id: 'dni', label: 'DNI (frente y dorso)', icon: '🪪', color: 'bg-blue-100 text-blue-700' },
  { id: 'alta_arca', label: 'Alta ARCA / CUIL', icon: '📋', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'cbu', label: 'Constancia de CBU/Alias', icon: '🏦', color: 'bg-amber-100 text-amber-700' },
  { id: 'titulo', label: 'Título / Certificado de Estudios', icon: '🎓', color: 'bg-purple-100 text-purple-700' },
  { id: 'contrato', label: 'Contrato de Trabajo', icon: '📄', color: 'bg-slate-100 text-slate-700' },
  { id: 'obra_social', label: 'Obra Social / Plan de Salud', icon: '💊', color: 'bg-teal-100 text-teal-700' },
  { id: 'otro', label: 'Otro documento', icon: '📎', color: 'bg-gray-100 text-gray-700' },
]

interface Props {
  empleadoId: string
  documentos: any[]
  onActualizado: () => void
}

export default function CargadorDocumentos({ empleadoId, documentos, onActualizado }: Props) {
  const [categoria, setCategoria] = useState('dni')
  const [notas, setNotas] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo es muy grande (máx. 10 MB)')
      return
    }

    setSubiendo(true)
    setError('')

    try {
      // 1. Subir archivo al bucket
      const ext = file.name.split('.').pop() || 'pdf'
      const fileName = `${empleadoId}/${categoria}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documentos-legajo')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) throw uploadError

      // 2. Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('documentos-legajo')
        .getPublicUrl(fileName)

      // 3. Guardar registro en la tabla
      const { error: dbError } = await supabase.from('documentos_legajo').insert({
        empleado_id: empleadoId,
        tipo_documento: categoria,
        nombre_archivo: file.name,
        url_archivo: urlData.publicUrl,
        notas: notas || null
      })

      if (dbError) throw dbError

      // 4. Limpiar y notificar
      setNotas('')
      if (inputRef.current) inputRef.current.value = ''
      onActualizado()
    } catch (err: any) {
      setError(err.message || 'Error al subir el documento')
    } finally {
      setSubiendo(false)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const eliminarDocumento = async (doc: any) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"? Esta acción no se puede deshacer.`)) return

    try {
      const urlParts = doc.url_archivo.split('/documentos-legajo/')
      if (urlParts.length < 2) throw new Error('URL inválida')
      const filePath = urlParts[1]

      const { error: storageError } = await supabase.storage
        .from('documentos-legajo')
        .remove([filePath])

      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('documentos_legajo')
        .delete()
        .eq('id', doc.id)

      if (dbError) throw dbError

      onActualizado()
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  const getCatInfo = (tipoId: string) => {
    return CATEGORIAS_DOCUMENTO.find(c => c.id === tipoId) || { label: tipoId, icon: '📎', color: 'bg-gray-100' }
  }

  // Agrupar documentos por categoría
  const docsPorCategoria = documentos.reduce((acc: any, doc: any) => {
    if (!acc[doc.tipo_documento]) acc[doc.tipo_documento] = []
    acc[doc.tipo_documento].push(doc)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* ZONA DE CARGA */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-xl"></span> Cargar Nuevo Documento
        </h3>

        {/* Selector de categoría */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Tipo de documento
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CATEGORIAS_DOCUMENTO.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoria(cat.id)}
                className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                  categoria === cat.id
                    ? 'border-slate-900 bg-slate-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-lg mb-1">{cat.icon}</div>
                <div className="leading-tight">{cat.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: DNI vencido, copia simple, etc."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm"
          />
        </div>

        {/* Zona drag & drop */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive ? 'border-slate-900 bg-slate-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          } ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="text-4xl mb-2">📁</div>
          <p className="font-semibold text-slate-900">
            {subiendo ? 'Subiendo...' : 'Arrastrá un archivo acá, o hacé clic para seleccionar'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            PDF, JPG o PNG · Máximo 10 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onInputChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* DOCUMENTOS CARGADOS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-xl">🗂️</span> Documentación del Legajo
          <span className="text-sm font-normal text-slate-500 ml-2">
            ({documentos.length} {documentos.length === 1 ? 'archivo' : 'archivos'})
          </span>
        </h3>

        {documentos.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <p className="text-4xl mb-2"></p>
            <p className="text-slate-600 font-medium">Aún no hay documentos cargados</p>
            <p className="text-sm text-slate-500 mt-1">
              Usá el formulario de arriba para comenzar
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(docsPorCategoria).map(([tipoId, docs]: [string, any]) => {
              const cat = getCatInfo(tipoId)
              return (
                <div key={tipoId} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className={`${cat.color} px-4 py-2 flex items-center gap-2 font-semibold text-sm`}>
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="ml-auto bg-white/50 px-2 py-0.5 rounded-full text-xs">
                      {docs.length}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {docs.map((doc: any) => (
                      <div key={doc.id} className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                          {doc.nombre_archivo.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {doc.nombre_archivo}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(doc.fecha_carga).toLocaleDateString('es-AR')}
                            {doc.notas && ` · ${doc.notas}`}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <a
                            href={doc.url_archivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            👁️ Ver
                          </a>
                          <button
                            onClick={() => eliminarDocumento(doc)}
                            className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            ️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}