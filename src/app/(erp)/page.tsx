import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { Users, Activity, ArrowRight, ShieldCheck, Sparkles, Building2, Package, FlaskConical, Tag, Calculator } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Panel Operativo • Steffen ERP',
  description: 'Panel operativo principal de Steffen Cosmética Capilar.',
};

export default async function ErpHomePage() {
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      {/* Banner de Bienvenida */}
      <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-2">
        <div className="inline-flex items-center gap-1 text-xs font-bold text-[#B99D22] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Fase 4 — Integración Operativa Real
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Bienvenido al Panel Operativo de Steffen ERP
        </h2>
        <p className="text-sm text-slate-600 max-w-2xl">
          El sistema está conectado directamente al backend transaccional de PostgreSQL en Supabase.
          El primer bloque operativo de Maestros (Clientes) se encuentra 100% activo y sincronizado.
        </p>
      </section>

      {/* Grid de Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Módulo Clientes (Activo) */}
        <Link
          href="/clientes"
          className="group bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-[#B99D22] shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-amber-50 rounded-lg text-[#B99D22]">
                <Users className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                100% Operativo
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-[#B99D22] transition-colors text-lg">
                Maestro de Clientes
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Alta y edición con generación automática de código CLI, ficha de contacto, descuentos comerciales y cuenta corriente atómica.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#B99D22]">
            <span>Ingresar al módulo</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Módulo Estado del Sistema (Técnico) */}
        <Link
          href="/system-status"
          className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-sky-400 shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-sky-50 rounded-lg text-sky-600">
                <Activity className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                Técnico
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors text-lg">
                Estado del Sistema
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Inspección de las 46 tablas RLS, 8 vistas analíticas, registro de migraciones aplicadas y auditoría de infraestructura.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-sky-600">
            <span>Ver auditoría técnica</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Proveedores (Próximo Bloque) */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-slate-200 rounded-lg text-slate-500">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                Bloque UI-2
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-lg">
                Proveedores
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Alta atómica con cuenta corriente, validación de moneda (ARS / USD) y gestión de contactos.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-medium text-slate-400">
            Próximo en migración
          </div>
        </div>

        {/* Insumos MPR / COM (Próximo Bloque) */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-slate-200 rounded-lg text-slate-500">
                <Package className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                Bloque UI-3
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-lg">
                Materias Primas y Componentes
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Catálogo de insumos (MPR y COM) con cotización de proveedor, INCI y stock inicial.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-medium text-slate-400">
            Próximo en migración
          </div>
        </div>

        {/* Fórmulas y PBAs (Próximo Bloque) */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-slate-200 rounded-lg text-slate-500">
                <FlaskConical className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                Bloque UI-4
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-lg">
                Fórmulas / Producto Base
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Versionado inmutable de fórmulas, desglose de materias primas y cálculo de costo teórico por kg.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-medium text-slate-400">
            Próximo en migración
          </div>
        </div>

        {/* Listas de Precios y Costo-Ganancia (Próximos Bloques) */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-slate-200 rounded-lg text-slate-500">
                <Calculator className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                Bloques UI-5 y UI-6
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-lg">
                Precios y Costo-Ganancia
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Administración de listas, aumentos masivos con locks atómicos y simulación con Decimal.js.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-medium text-slate-400">
            Próximo en migración
          </div>
        </div>

      </div>
    </div>
  );
}
