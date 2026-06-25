import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const RUTAS_PUBLICAS = [
  '/',
  '/empleado/login',
  '/admin/login',
  '/api/empleado/login',
  '/api/auth'
]

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dejar pasar rutas públicas y archivos estáticos
  if (
    RUTAS_PUBLICAS.some(ruta => pathname === ruta || pathname.startsWith(ruta + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Verificar rutas de empleado
  const esRutaEmpleado = pathname.startsWith('/empleado')

  if (esRutaEmpleado) {
    const token = request.cookies.get('empleado_token')?.value

    if (!token) {
      const url = request.nextUrl.clone()
      url.pathname = '/empleado/login'
      return NextResponse.redirect(url)
    }

    try {
      const payload = JSON.parse(atob(token))
      if (payload.exp < Date.now()) {
        const url = request.nextUrl.clone()
        url.pathname = '/empleado/login'
        url.searchParams.set('error', 'sesion-expirada')
        return NextResponse.redirect(url)
      }
    } catch (e) {
      const url = request.nextUrl.clone()
      url.pathname = '/empleado/login'
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}