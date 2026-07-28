'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegistroFirmaPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [firmando, setFirmando] = useState(false)
  const [firmaCompleta, setFirmaCompleta] = useState(false)
  const [empleado, setEmpleado] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const empleadoData = localStorage.getItem('empleado_data')
    if (!empleadoData) {
      router.push('/empleado/login')
      return
    }
    setEmpleado(JSON.parse(empleadoData))
  }, [router])

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const iniciarFirma = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCoords(e)
    if (!coords) return

    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    setFirmando(true)
    setFirmaCompleta(false)
  }

  const moverFirma = (e: React.MouseEvent | React.TouchEvent) => {
    if (!firmando) return
    e.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCoords(e)
    if (!coords) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setFirmaCompleta(true)
  }

  const finalizarFirma = () => {
    setFirmando(false)
  }

  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFirmaCompleta(false)
  }

  const guardarFirma = async () => {
    if (!empleado || !firmaCompleta) return

    setGuardando(true)
    setError('')

    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas no disponible')

      const firmaBase64 = canvas.toDataURL('image/jpeg', 0.8)

      // Llamar al endpoint de API (con service_role)
      const response = await fetch('/api/empleado/registro-firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmaBase64 })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar firma')
      }

      // Actualizar localStorage
      const empleadoActualizado = { ...empleado, firma_registrada: true }
      localStorage.setItem('empleado_data', JSON.stringify(empleadoActualizado))

      // Redirigir a recibos
      router.push('/empleado/recibos')
    } catch (error: any) {
      console.error('Error guardando firma:', error)
      setError('Error al guardar la firma: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!empleado) {
    return <div className="p-8 text-center">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Registro de Firma Digital
          </h1>
          <p className="text-gray-600">
            Bienvenido/a, <strong>{empleado.nombre_completo || empleado.nombre}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Por seguridad, debés registrar tu firma antes de acceder a tus recibos.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Instrucciones:</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1">
            <li>Firmá en el recuadro usando el mouse o tu dedo</li>
            <li>Tu firma quedará guardada de forma segura</li>
            <li>Solo podrás registrarla una vez</li>
            <li>Esta firma tiene validez legal según Ley 25506</li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Firmá en el recuadro siguiente:
          </label>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={250}
              className="w-full bg-white cursor-crosshair touch-none"
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={limpiarFirma}
            className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400"
          >
            Limpiar Firma
          </button>
          <button
            onClick={guardarFirma}
            disabled={!firmaCompleta || guardando}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
          >
            {guardando ? 'Guardando...' : 'Confirmar y Guardar Firma'}
          </button>
        </div>
      </div>
    </div>
  )
}