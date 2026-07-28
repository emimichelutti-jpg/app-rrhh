import { ReactNode } from 'react'
import Link from 'next/link'

export default function ReferenteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Portal del Referente</h1>
              <p className="text-sm text-slate-600">Gestión de zona</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/empleado/dashboard"
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Mi Dashboard personal
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white shadow-sm min-h-screen p-4 border-r border-slate-200">
          <nav className="space-y-2">
            <Link
              href="/referente/dashboard"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
               Dashboard de Zona
            </Link>
            <Link
              href="/referente/empleados"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              👥 Empleados de mi Zona
            </Link>
            <Link
              href="/referente/recibos"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              📄 Recibos de mi Zona
            </Link>
            <Link
              href="/referente/asistencia"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              📝 Asistencia de mi Zona
            </Link>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}