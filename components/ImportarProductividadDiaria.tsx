'use client'

import { useState } from 'react'

export default function ImportarProductividadDiaria() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const handleImportar = async () => {
    if (!archivo) return

    setCargando(true)
    setResultado(null)

    const formData = new FormData()
    formData.append('file', archivo)

    try {
      const response = await fetch('/api/admin/importar-productividad', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al importar')
      }

      setResultado(data)
      setArchivo(null) // Limpiar después del éxito
    } catch (error: any) {
      setResultado({ error: error.message })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Importar Productividad Diaria</h3>
      <p className="text-sm text-gray-600 mb-4">
        Subí el archivo Excel diario de productividad. El sistema asociará automáticamente las actividades a los empleados por nombre.
      </p>

      <div className="flex flex-col gap-4">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100 cursor-pointer"
        />

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

      {resultado && (
        <div className={`mt-6 p-4 rounded-lg ${resultado.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          {resultado.error ? (
            <p className="font-medium">❌ Error: {resultado.error}</p>
          ) : (
            <div>
              <p className="font-medium">✅ ¡Importación exitosa!</p>
              <ul className="mt-2 text-sm space-y-1">
                <li>📄 Total de filas leídas: <strong>{resultado.totalFilas}</strong></li>
                <li>✅ Actividades guardadas: <strong>{resultado.insertadas}</strong></li>
                {resultado.noEncontrados.length > 0 && (
                  <li className="text-orange-700">
                    ⚠️ Técnicos no encontrados en la base de datos: {resultado.noEncontrados.join(', ')}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}