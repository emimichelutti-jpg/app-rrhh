'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RegistrarFirma({ 
  empleadoId, 
  onSuccess 
}: { 
  empleadoId: string; 
  onSuccess: () => void 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [firmando, setFirmando] = useState(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)
  const [guardando, setGuardando] = useState(false)

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
  }, [])

  const getCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * dpr, y: (clientY - rect.top) * dpr }
  }, [])

  const iniciar = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return
    const coords = getCoords(e)
    if (!coords) return
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    setFirmando(true)
  }, [getCoords])

  const mover = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!firmando) return
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return
    const coords = getCoords(e)
    if (!coords) return
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setTieneTrazo(true)
  }, [firmando, getCoords])

  const finalizar = useCallback(() => setFirmando(false), [])

  const limpiar = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setTieneTrazo(false)
    }
  }, [])

  const guardar = async () => {
    const canvas = canvasRef.current
    if (!canvas || !tieneTrazo) {
      alert('Por favor, firmá en el recuadro antes de guardar')
      return
    }
    setGuardando(true)
    try {
      const firmaBase64 = canvas.toDataURL('image/png')
      const { error } = await supabase
        .from('empleados')
        .update({ firma_registrada_url: firmaBase64 })
        .eq('id', empleadoId)
      
      if (error) throw error
      alert('✅ Firma registrada correctamente')
      onSuccess()
    } catch (error: any) {
      alert('Error al guardar: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="bg-slate-800 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">✍️ Registrar Mi Firma Digital</h2>
          <p className="text-sm text-blue-100">Esta firma se usará para todos tus recibos futuros</p>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Firmá en el recuadro:</label>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white" style={{ height: '250px' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair touch-none"
                onMouseDown={iniciar} onMouseMove={mover} onMouseUp={finalizar} onMouseLeave={finalizar}
                onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={finalizar}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={limpiar} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">🔄 Limpiar</button>
            <button onClick={onSuccess} className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">❌ Cancelar</button>
            <button onClick={guardar} disabled={!tieneTrazo || guardando} className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition-colors disabled:bg-gray-400">
              {guardando ? 'Guardando...' : '✅ Guardar Firma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}