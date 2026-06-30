import { ReactNode } from 'react'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">RRHH Panel</h1>
              <p className="text-sm text-gray-600">Administración</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white shadow-md min-h-screen p-4">
          <nav className="space-y-2">
            <Link
              href="/admin/empleados"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              👥 Gestionar Empleados
            </Link>

            <div>
              <div className="px-4 py-2 text-sm font-semibold text-gray-700">
                🕒 Asistencia
              </div>
              <div className="pl-4 space-y-1">
                <Link
                  href="/admin/asistencia/registro"
                  className="block px-4 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors text-sm"
                >
                  📝 Registro Diario
                </Link>
                <Link
                  href="/admin/asistencia/historial"
                  className="block px-4 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors text-sm"
                >
                  📊 Historial
                </Link>
                <Link
                  href="/admin/asistencia/reportes"
                  className="block px-4 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors text-sm"
                >
                  📊 Reportes de Ausentismo
                </Link>
                <Link
                  href="/admin/asistencia"
                  className="block px-4 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors text-sm"
                >
                  📥 Importar Excel (Fichaje)
                </Link>
              </div>
            </div>

            <Link
              href="/admin/recibos"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              💰 Recibos de Sueldo
            </Link>

            <Link
              href="/admin/solicitudes"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              📝 Solicitudes
            </Link>

            <Link
              href="/admin/incentivos"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              🎯 Incentivos
            </Link>

            <Link
              href="/admin/planillas"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              📥 Planillas
            </Link>

            <Link
              href="/admin/cambio-cbu"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              🏦 Cambio CBU
            </Link>

            <Link
              href="/admin/vacaciones"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              🏖️ Vacaciones
            </Link>

            <Link
              href="/admin/dashboard"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              📊 Dashboard
            </Link>

            <div className="border-t my-4"></div>

            <Link
              href="/admin/documentos"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              📄 Documentos
            </Link>

            <Link
              href="/admin/licencias"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              🏥 Licencias
            </Link>

            <Link
              href="/admin/reportes"
              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
            >
              📈 Reportes Generales
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