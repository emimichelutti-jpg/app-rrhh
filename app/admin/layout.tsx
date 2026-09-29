import { ReactNode } from 'react'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">RRHH Panel</h1>
              <p className="text-sm text-slate-600">Administración</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white shadow-sm min-h-screen p-4 border-r border-slate-200">
          <nav className="space-y-2">
            
            {/* 🔔 CENTRO DE ALERTAS - Destacado arriba */}
            <Link
              href="/admin/alertas"
              className="flex items-center justify-between px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg transition-colors border border-rose-200 font-medium"
            >
              <span className="flex items-center gap-2">
                🔔 Centro de Alertas
              </span>
              <span className="bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full">!</span>
            </Link>

            <div className="border-t border-slate-200 my-2"></div>

            {/* EMPLEADOS */}
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Empleados
              </div>
              <Link
                href="/admin/empleados"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
              >
                👥 Gestionar Empleados
              </Link>
              <Link
                href="/admin/zonas"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
              >
                📍 Gestionar Zonas
              </Link>
              <Link
                href="/admin/roles"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
              >
                🔐 Gestionar Roles
              </Link>
            </div>

            {/* SUELDOS Y PAGOS */}
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Sueldos y Pagos
              </div>
              <div className="pl-4 space-y-1">
                <Link
                  href="/admin/cargar-recibos"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📥 Cargar Recibos
                </Link>
                <Link
                  href="/admin/recibos"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📄 Recibos de Sueldo
                </Link>
                <Link
                  href="/admin/recibos/correccion"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  ✏️ Corrección de Costos
                </Link>
                <Link
                  href="/admin/planillas"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📊 Planillas
                </Link>
              </div>
            </div>

            {/* INCENTIVOS Y DESCUENTOS */}
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Incentivos y Descuentos
              </div>
              <div className="pl-4 space-y-1">
                <Link
                  href="/admin/incentivos"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  🎯 Incentivos
                </Link>
                <Link
                  href="/admin/solicitudes"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  💸 Adelantos y Préstamos
                </Link>
              </div>
            </div>

            {/* ASISTENCIA */}
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Asistencia
              </div>
              <div className="pl-4 space-y-1">
                <Link
                  href="/admin/asistencia/registro"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📝 Registro Diario
                </Link>
                <Link
                  href="/admin/asistencia/historial"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                   Historial
                </Link>
                <Link
                  href="/admin/asistencia/reportes"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📈 Reportes de Ausentismo
                </Link>
                <Link
                  href="/admin/asistencia"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📥 Importar Excel (Fichaje)
                </Link>
              </div>
            </div>

            {/* AUSENCIAS */}
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ausencias
              </div>
              <div className="pl-4 space-y-1">
                <Link
                  href="/admin/vacaciones"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  🏖️ Vacaciones
                </Link>
                <Link
                  href="/admin/licencias"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                   Licencias
                </Link>
              </div>
            </div>

            {/* OTROS */}
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Otros
              </div>
              <div className="pl-4 space-y-1">
                <Link
                  href="/admin/cambio-cbu"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  🏦 Cambio CBU
                </Link>
                <Link
                  href="/admin/documentos"
                  className="block px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-sm"
                >
                  📄 Documentos
                </Link>
              </div>
            </div>

            {/* REPORTES Y DASHBOARD */}
            <div className="border-t border-slate-200 my-4"></div>
            
            <Link
              href="/admin/dashboard"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              📊 Dashboard
            </Link>
            
            <Link
              href="/admin/productividad"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              📈 Productividad & ROI
            </Link>
            
            <Link
              href="/admin/roi-dashboard"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              📊 Dashboard ROI Visual
            </Link>
            
            <Link
              href="/admin/reportes"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
               Reportes Generales
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