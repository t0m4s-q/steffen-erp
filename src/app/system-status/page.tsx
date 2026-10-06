import { 
  Database, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  TableProperties, 
  FileCode2, 
  Sparkles,
  Server,
  FolderTree,
  User,
  LogOut
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { logoutAction } from '@/actions/auth.actions';
import { MIGRATIONS_REGISTRY, SYSTEM_TABLES, SYSTEM_VIEWS } from '@/database/schema-info';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Estado del Sistema • Steffen ERP',
  description: 'Auditoría técnica de base de datos, migraciones y servicios de Steffen ERP.',
};

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  const isSupabaseConfigured = 
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-project-id.supabase.co';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#D2AB68] text-white flex items-center justify-center font-bold tracking-wider text-base shadow-sm">
              ST
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Steffen ERP</h1>
              <p className="text-xs text-slate-500 font-medium">Cosmética Capilar • MVP Base</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] text-xs font-semibold bg-[#D2AB68] text-white hover:bg-[#c29b58] transition-colors"
            >
              ← Ir al ERP Operativo
            </a>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sesión Activa
            </span>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {user.email || 'Operador'}
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Cerrar Sesión"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden md:inline">Salir</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Banner de Estado */}
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Estado de la Inicialización
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Infraestructura, Modelo Remoto, Servicios Base, Hardening y Capa de Autenticación
              </h2>
              <p className="text-sm text-slate-600 max-w-2xl">
                Se han implementado con fidelidad estricta las Fases 0, 1, 2 y 3 según <code className="text-xs font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">IMPLEMENTATION_PLAN.md</code> y <code className="text-xs font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">DATA_MODEL.md</code>. Aritmética decimal exacta (<code className="text-xs font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">Decimal.js</code>), RLS activo en 46 tablas, security_invoker en 8 vistas, guardia de servidor <code className="text-xs font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">requireAuthenticatedUser()</code> con allowlist de usuario único y 57 tests automatizados pasando.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <div className="px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-medium">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Stack</span>
                Next.js App Router (TS)
              </div>
              <div className="px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-medium">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Base de datos</span>
                PostgreSQL (Supabase)
              </div>
              <div className="px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-medium">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tests Dominio</span>
                57 Tests OK (47 subtests)
              </div>
            </div>
          </div>
        </section>

        {/* Fases completadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Fase 0 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Fase 0</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-slate-600" /> Preparación Técnica
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Next.js con TypeScript y App Router</li>
              <li>Tailwind CSS y diseño base</li>
              <li>Configuración Supabase / SSR / Storage</li>
              <li>Separación estricta de capas en <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">src/</code></li>
              <li>Variables en <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">.env.example</code></li>
            </ul>
          </div>

          {/* Fase 1 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Fase 1</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-600" /> Modelo Remoto
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>46 Tablas aplicadas en Supabase remoto</li>
              <li>Función <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">code_sequences</code> (anti MAX+1)</li>
              <li>Índices de performance y parciales únicos</li>
              <li>8 Vistas analíticas y de cálculo activas</li>
              <li>Triggers automáticos para <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">updated_at</code></li>
            </ul>
          </div>

          {/* Fase 2 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Fase 2</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <TableProperties className="w-4 h-4 text-slate-600" /> Seeds y Datos Iniciales
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Cajas fijas: Steffen y Mercado Libre</li>
              <li>Listas del sistema: Salón, Público, Ecommerce</li>
              <li>Perfiles Costo-Ganancia (35%, 30%+10%+5%, etc.)</li>
              <li>15 Prefijos de secuencias inicializados</li>
              <li>Cotización abierta a carga sin mocks</li>
            </ul>
          </div>

          {/* Fase 3 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Fase 3</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-600" /> Servicios Base Dominio
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li><code className="font-mono bg-slate-100 px-1 py-0.5 rounded">generateVisibleCode</code> (atómico)</li>
              <li>Motor de costos (MPR/COM con IVA, PBA y PRO)</li>
              <li>Servicio de Stock (MST, balances, UNIT/KG)</li>
              <li>Servicio Patrimonial (MOV, entries, balances)</li>
              <li>Precio histórico por snapshot temporal</li>
            </ul>
          </div>
        </div>

        {/* Separación de Arquitectura de Capas */}
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">
              Arquitectura de Capas y Desacoplamiento (Clean Architecture)
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> 1. Dominio (<code className="font-mono">src/domain/</code>)
              </div>
              <p className="text-slate-600">Entidades puras, errores de negocio, constantes (IVA 21%, Extra variable 2%, prefijos) sin acoplamiento a React ni base de datos.</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 2. Servicios (<code className="font-mono">src/services/</code>)
              </div>
              <p className="text-slate-600">Contratos e interfaces de negocio preparados para la Fase 3: motor de costos, ledger de stock, movimientos patrimoniales y códigos.</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span> 3. Repositorios (<code className="font-mono">src/repositories/</code>)
              </div>
              <p className="text-slate-600">Abstracción sobre Supabase y PostgreSQL que aísla las consultas y mutaciones fuera de los controladores web.</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> 4. Acceso a Datos (<code className="font-mono">src/database/</code>)
              </div>
              <p className="text-slate-600">Cliente cliente/servidor con tipado estricto Database derivado directamente de DATA_MODEL.md.</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-pink-500"></span> 5. UI (<code className="font-mono">src/ui/</code> y <code className="font-mono">src/app/</code>)
              </div>
              <p className="text-slate-600">Next.js App Router para presentación y navegación responsive, sin reglas de cálculo embebidas.</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> 6. Generación de PDFs (<code className="font-mono">src/pdf/</code>)
              </div>
              <p className="text-slate-600">Módulo desacoplado de renderizado y Supabase Storage para persistir snapshots inmutables de RTO, RTM y estados de cuenta.</p>
            </div>
          </div>
        </section>

        {/* Migraciones SQL versionadas */}
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900">
                Migraciones SQL Versionadas (<code className="font-mono text-xs">supabase/migrations/</code>)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {MIGRATIONS_REGISTRY.length} archivos de migración
            </span>
          </div>

          <div className="space-y-3">
            {MIGRATIONS_REGISTRY.map((mig) => (
              <div key={mig.version} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                      {mig.version}
                    </span>
                    <span className="font-bold text-slate-900">{mig.name}</span>
                  </div>
                  <p className="text-slate-600">{mig.description}</p>
                </div>
                <div className="text-slate-500 font-mono text-[11px] shrink-0">
                  {mig.fileName}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Vistas SQL oficiales implementadas */}
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900">
                Vistas de Cálculo y Analíticas (Sección 60 DATA_MODEL.md)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {SYSTEM_VIEWS.length} vistas SQL
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {SYSTEM_VIEWS.map((viewName) => (
              <div key={viewName} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-700 font-medium">
                {viewName}
              </div>
            ))}
          </div>
        </section>

        {/* Conexión Supabase */}
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 flex items-start gap-3 text-xs text-sky-900">
          <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Persistencia en PostgreSQL mediante Supabase
            </p>
            <p className="text-sky-800">
              No se han sustituido tablas, constraints, transacciones ni ledgers por mocks ni almacenamiento local. Las credenciales de Supabase se configuran vía variables de entorno (<code className="font-mono bg-sky-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="font-mono bg-sky-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code className="font-mono bg-sky-100 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>).
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
