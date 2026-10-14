'use client'

import { useState } from 'react'

interface ImportarProductividadDiariaProps {
  onImportSuccess?: () => void
}

export default function ImportarProductividadDiaria({ onImportSuccess }: ImportarProductividadDiariaProps) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImportar = async () => {
    if (!archivo) {
      console.error(' No hay archivo seleccionado')
      return
    }

    console.log('🚀 Iniciando importación...', archivo.name, archivo.size, 'bytes')
    setCargando(true)
    setResultado(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', archivo)

    try {
      console.log('📤 Enviando request a /api/admin/importar-productividad...')
      
      const response = await fetch('/api/admin/importar-productividad', {
        method: 'POST',
        body: formData,
      })

      console.log('📥 Response status:', response.status)
      
      const data = await response.json()
      console.log('📦 Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`)
      }

      console.log('✅ Importación exitosa:', data)
      setResultado(data)
      setArchivo(null)
      
      if (onImportSuccess) {
        onImportSuccess()
      }
    } catch (error: any) {
      console.error('❌ Error en importación:', error)
      setError(error.message || 'Error desconocido')
      setResultado(null)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4"> Importar Productividad Diaria</h3>
      <p className="text-sm text-gray-600 mb-4">
        Subí el archivo Excel diario de productividad (ej: <code>financiero_16.xlsx</code>). El sistema asociará automáticamente las actividades a los empleados por nombre.
      </p>

      <div className="flex flex-col gap-4">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            console.log('📁 Archivo seleccionado:', file?.name, file?.size)
            setArchivo(file)
            setError(null)
          }}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100 cursor-pointer"
        />

        {archivo && (
          <div className="text-sm text-gray-700">
            ✅ Archivo: <strong>{archivo.name}</strong> ({(archivo.size / 1024).toFixed(2)} KB)
          </div>
        )}

        <button
          onClick={handleImportar}
          disabled={!archivo || cargando}
          className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
            !archivo || cargando
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {cargando ? '⏳ Procesando...' : '🚀 Importar Actividades'}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-lg bg-red-50 text-red-800">
          <p className="font-medium">❌ Error: {error}</p>
          <p className="text-sm mt-2">Revisá la consola del navegador (F12) para más detalles.</p>
        </div>
      )}

      {resultado && !error && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 text-green-800">
          <p className="font-medium">✅ ¡Importación exitosa!</p>
          <ul className="mt-2 text-sm space-y-1">
            <li>📄 Total de filas leídas: <strong>{resultado.totalFilas}</strong></li>
            <li>✅ Actividades guardadas: <strong>{resultado.insertadas}</strong></li>
            {resultado.noEncontrados && resultado.noEncontrados.length > 0 && (
              <li className="text-orange-700">
                ️ Técnicos no encontrados: {resultado.noEncontrados.join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}