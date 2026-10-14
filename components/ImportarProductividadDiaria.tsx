'use client'

import { useState, useRef } from 'react'

interface ImportarProductividadDiariaProps {
  onImportSuccess?: () => void
}

export default function ImportarProductividadDiaria({ onImportSuccess }: ImportarProductividadDiariaProps) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportar = async () => {
    if (!archivo) {
      console.error('❌ No hay archivo seleccionado')
      setError('Por favor, seleccioná un archivo primero')
      return
    }

    console.log('🚀 Iniciando importación...')
    console.log(' Archivo:', archivo.name)
    console.log('📦 Tamaño:', archivo.size, 'bytes')
    console.log('📄 Tipo:', archivo.type)

    setCargando(true)
    setResultado(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', archivo, archivo.name)

    try {
      console.log('📤 Enviando request a /api/admin/importar-productividad...')
      
      const response = await fetch('/api/admin/importar-productividad', {
        method: 'POST',
        body: formData,
      })

      console.log('📥 Response status:', response.status)
      console.log(' Response headers:', response.headers)
      
      const responseText = await response.text()
      console.log('📥 Response text:', responseText)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.error('❌ No se pudo parsear la respuesta como JSON')
        throw new Error(`El servidor no devolvió JSON válido: ${responseText.substring(0, 200)}`)
      }

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`)
      }

      console.log('✅ Importación exitosa:', data)
      setResultado(data)
      setArchivo(null)
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      if (onImportSuccess) {
        onImportSuccess()
      }
    } catch (error: any) {
      console.error('❌ Error en importación:', error)
      console.error(' Stack trace:', error.stack)
      setError(error.message || 'Error desconocido al procesar el archivo')
      setResultado(null)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Importar Productividad Diaria</h3>
      <p className="text-sm text-gray-600 mb-4">
        Subí el archivo Excel diario de productividad (ej: <code>financiero_16.xlsx</code>). El sistema asociará automáticamente las actividades a los empleados por nombre.
      </p>

      <div className="flex flex-col gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            console.log('📁 Archivo seleccionado:', file)
            if (file) {
              console.log('   - Nombre:', file.name)
              console.log('   - Tamaño:', file.size, 'bytes')
              console.log('   - Tipo:', file.type)
            }
            setArchivo(file)
            setError(null)
            setResultado(null)
          }}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100 cursor-pointer"
        />

        {archivo && (
          <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium">✅ Archivo seleccionado:</p>
            <p className="mt-1"><strong>{archivo.name}</strong></p>
            <p className="text-xs text-gray-600">{(archivo.size / 1024).toFixed(2)} KB</p>
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
          {cargando ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando...
            </span>
          ) : (
            '🚀 Importar Actividades'
          )}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <p className="font-medium">❌ Error:</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-xs mt-2 text-red-600">Revisá la consola del navegador (F12) para más detalles técnicos.</p>
        </div>
      )}

      {resultado && !error && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <p className="font-medium">✅ ¡Importación exitosa!</p>
          <ul className="mt-2 text-sm space-y-1">
            <li>📄 Total de filas leídas: <strong>{resultado.totalFilas}</strong></li>
            <li>✅ Actividades guardadas: <strong>{resultado.insertadas}</strong></li>
            {resultado.noEncontrados && resultado.noEncontrados.length > 0 && (
              <li className="text-orange-700">
                ⚠️ Técnicos no encontrados: {resultado.noEncontrados.join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}