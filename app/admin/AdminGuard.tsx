'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdmin = async () => {
      // 1. Verificar si hay sesión activa
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/') // Si no hay sesión, al Login
        return
      }

      // 2. Verificar si el usuario es admin
      const { data: empleado } = await supabase
        .from('empleados')
        .select('rol')
        .eq('user_id', session.user.id)
        .single()

      if (!empleado || empleado.rol !== 'admin') {
        router.replace('/dashboard') // Si no es admin, al Dashboard
        return
      }

      setIsChecking(false) // Si todo está OK, mostrar la página
    }
    
    checkAdmin()
  }, [router])

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl text-gray-500">Verificando permisos...</div>
      </div>
    )
  }

  return <>{children}</>
}