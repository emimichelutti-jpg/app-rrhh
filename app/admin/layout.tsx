import Link from 'next/link'
import AdminGuard from './AdminGuard'

const menuItems = [
  { href: '/admin/empleados', label: 'Gestionar Empleados', icon: '' },
  { href: '/admin/documentos', label: 'Documentos', icon: '' },
  { href: '/admin/licencias', label: 'Licencias', icon: '' },
  { href: '/admin/asistencia', label: 'Asistencia', icon: '⏰' },
  { href: '/admin/reportes', label: 'Reportes', icon: '📊' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md flex flex-col">
          <div className="p-6 border-b">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              RRHH Panel
            </Link>
            <p className="text-xs text-gray-500 mt-1">Administración</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              <span className="text-xl">🏠</span>
              <span className="font-medium">Volver al Dashboard</span>
            </Link>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AdminGuard>
  )
}