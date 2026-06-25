'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface FirmaDigitalProps {
  onFirmaCompleta: (firmaBase64: string) => void
  onCancel: () => void
  empleadoNombre: string
  reciboNumero: string
  periodo: string
  neto: number
}

export default function FirmaDigital({
  onFirmaCompleta,
  onCancel,
  empleadoNombre,
  reciboNumero,
  periodo,
  neto
}: FirmaDigitalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [firmando, setFirmando] = useState(false)
  const [firmaCompleta, setFirmaCompleta] = useState(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)

  // Inicializar canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctxRef.current = ctx

    return () => {
      ctxRef.current = null
    }
  }, [])

  const getCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr
    }
  }, [])

  const iniciarFirma = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return

    const coords = getCoords(e)
    if (!coords) return

    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    setFirmando(true)
  }, [getCoords])

  const moverFirma = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!firmando) return
    e.preventDefault()

    const ctx = ctxRef.current
    if (!ctx) return

    const coords = getCoords(e)
    if (!coords) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setFirmaCompleta(true)
    setTieneTrazo(true)
  }, [firmando, getCoords])

  const finalizarFirma = useCallback(() => {
    setFirmando(false)
  }, [])

  const limpiarFirma = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setFirmaCompleta(false)
      setTieneTrazo(false)
    }
  }, [])

  const confirmarFirma = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (!tieneTrazo) {
      alert('Por favor, firmá en el recuadro antes de confirmar')
      return
    }

    const firmaBase64 = canvas.toDataURL('image/png')
    onFirmaCompleta(firmaBase64)
  }, [tieneTrazo, onFirmaCompleta])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">✍️ Firma Digital de Recibo</h2>
          <p className="text-sm text-blue-100">Ley 17250 - Art. 12</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Datos del Recibo</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Empleado:</span>
                <p className="font-medium">{empleadoNombre}</p>
              </div>
              <div>
                <span className="text-gray-600">Recibo Nº:</span>
                <p className="font-medium">{reciboNumero}</p>
              </div>
              <div>
                <span className="text-gray-600">Período:</span>
                <p className="font-medium">{periodo}</p>
              </div>
              <div>
                <span className="text-gray-600">Neto a Cobrar:</span>
                <p className="font-bold text-green-700">${neto.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Declaración Jurada:</strong>
            </p>
            <p className="text-xs text-gray-600 mt-2">
              "Recibí el importe neto de esta liquidación en pago de mi remuneración correspondiente
              al período indicado y duplicado de la misma conforme a la Ley Vigente.
              La presente firma digital tiene el mismo valor legal que la firma manuscrita
              según Ley 17250 y modificatorias."
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Firmá en el recuadro siguiente:
            </label>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white" style={{ height: '250px' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair touch-none"
                style={{ display: 'block' }}
                onMouseDown={iniciarFirma}
                onMouseMove={moverFirma}
                onMouseUp={finalizarFirma}
                onMouseLeave={finalizarFirma}
                onTouchStart={iniciarFirma}
                onTouchMove={moverFirma}
                onTouchEnd={finalizarFirma}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={limpiarFirma}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              🔄 Limpiar Firma
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              ❌ Cancelar
            </button>
            <button
              onClick={confirmarFirma}
              disabled={!firmaCompleta || !tieneTrazo}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ✅ Confirmar Firma
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}