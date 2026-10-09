'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Función para limpiar nombres de archivo (evita errores con Ñ, tildes, etc.)
const sanitizeFilename = (filename: string): string => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .replace(/ñ/gi, "n")             // Ñ → N
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Otros caracteres especiales → _
}

export default function CargarRecibosPage() {
  const router = useRouter()
  const [archivos, setArchivos] = useState<File[]>([])
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultados, setResultados] = useState<any>(null)
  const [error, setError] = useState('')
  const [tipoRecibo, setTipoRecibo] = useState('1ra') // Default a 1ra quincena
  
  // Selector de período manual
  const [periodoForzado, setPeriodoForzado] = useState(new Date().toISOString().slice(0, 7))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArchivos(Array.from(e.target.files))
      setResultados(null)
      setError('')
    }
  }

  const handleUpload = async () => {
    if (archivos.length === 0) {
      setError('Seleccioná al menos un archivo')
      return
    }

    setCargando(true)
    setError('')
    setResultados(null)
    setProgreso(10)

    try {
      console.log(`📤 Subiendo ${archivos.length} archivos...`)

      // 1. Subir archivos a Supabase con nombre sanitizado
      const uploads = await Promise.all(
        archivos.map(async (archivo) => {
          const cleanName = sanitizeFilename(archivo.name)
          const fileName = `temp_${Date.now()}_${cleanName}`
          
          const { error: uploadError } = await supabase.storage
            .from('recibos-originales')
            .upload(fileName, archivo, { contentType: 'application/pdf', upsert: false })

          if (uploadError) throw new Error(`${archivo.name}: ${uploadError.message}`)

          const { data: { publicUrl } } = supabase.storage.from('recibos-originales').getPublicUrl(fileName)
          return { pdfUrl: publicUrl, fileName: archivo.name }
        })
      )

      setProgreso(30)
      console.log('✅ Archivos subidos, procesando...')

      // 2. Extraer solo las URLs para enviar al backend
      const archivosUrls = uploads.map(u => u.pdfUrl)

      // 3. Enviar al backend (Next.js API Route o directo a Python)
      const response = await fetch('/api/admin/procesar-recibo-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivos: uploads,
          tipo_recibo: tipoRecibo, // Envía '1ra', '2da', 'Mensual', etc.
          periodo_forzado: periodoForzado,      // ✅ Usamos la variable de estado existente
          quincena_forzada: tipoRecibo          // ✅ Envía "1ra", "2da", "Mensual", etc.
        })
      })

      setProgreso(90)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error procesando recibos')
      }

      setResultados({
        exitosos: data.exitosos,
        fallidos: data.fallidos,
        recibos: data.recibos,
        errores: data.errores
      })

      setProgreso(100)
      console.log('✅ Completado!')

    } catch (error: any) {
      console.error('⛔ Error:', error)
      setError(error.message)
    } finally {
      setCargando(false)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Cargar Recibos de Sueldo</h1>
          <p className="text-gray-600">Subí los PDFs de los recibos para procesar</p>
        </div>
        <button onClick={cerrarSesion} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
          Cerrar Sesión
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Recibo</label>
            <select
              value={tipoRecibo}
              onChange={(e) => setTipoRecibo(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="1ra">Primera Quincena</option>
              <option value="2da">Segunda Quincena</option>
              <option value="Mensual">Mensual</option>
              <option value="sac_1ra">SAC 1ra Cuota (Junio)</option>
              <option value="sac_2da">SAC 2da Cuota (Diciembre)</option>
              <option value="vacaciones">Pago de Vacaciones</option>
              <option value="bono">Bono Extraordinario</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período (Opcional)
            </label>
            <input
              type="month"
              value={periodoForzado}
              onChange={(e) => setPeriodoForzado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              Si se deja vacío, el sistema intentará detectarlo del PDF
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar PDFs</label>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {archivos.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Archivos seleccionados: {archivos.length}</p>
            <ul className="text-sm text-gray-500 space-y-1 max-h-40 overflow-y-auto">
              {archivos.map((archivo, index) => (
                <li key={index} className="truncate">{archivo.name}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={cargando || archivos.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {cargando ? 'Procesando...' : 'Cargar y Procesar PDFs'}
        </button>

        {cargando && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progreso}%` }}></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">Progreso: {progreso.toFixed(0)}%</p>
          </div>
        )}
      </div>

      {resultados && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Resultados del Procesamiento</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-600">Recibos guardados</p>
              <p className="text-3xl font-bold text-green-700">{resultados.exitosos}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">Errores</p>
              <p className="text-3xl font-bold text-red-700">{resultados.fallidos}</p>
            </div>
          </div>

          {resultados.recibos.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Recibos procesados:</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {resultados.recibos.map((recibo: any, index: number) => (
                  <div key={index} className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{recibo.nombre}</p>
                        <p className="text-xs text-gray-600">CUIL: {recibo.cuil} | {recibo.periodo} - {recibo.quincena}</p>
                        <p className="text-xs text-gray-500 mt-1">Tipo: <span className="font-medium capitalize">{recibo.tipo_recibo || 'normal'}</span></p>
                      </div>
                      <span className="text-green-700 font-bold">${recibo.neto?.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={() => router.push('/admin/recibos')} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700">
              Ver Recibos Cargados
            </button>
            <button
              onClick={() => { setArchivos([]); setResultados(null); setProgreso(0); }}
              className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400"
            >
              Cargar Más PDFs
            </button>
          </div>
        </div>
      )}
    </div>
  )
}