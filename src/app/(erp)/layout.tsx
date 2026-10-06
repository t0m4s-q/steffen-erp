import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { logoutAction } from '@/actions/auth.actions';
import { User, LogOut, ShieldCheck, Users, Home, Activity } from 'lucide-react';

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header Principal de Navegación del ERP */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo y Marca */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="h-9 w-9 rounded-lg bg-[#B99D22] text-white flex items-center justify-center font-bold tracking-wider text-base shadow-xs group-hover:bg-[#a68c1c] transition-colors">
                  ST
                </div>
                <div>
                  <h1 className="text-base font-black tracking-wider text-slate-900 leading-tight">
                    STEFFEN ERP
                  </h1>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Cosmética Capilar
                  </p>
                </div>
              </Link>

              {/* Barra de Navegación Principal */}
              <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>Inicio</span>
                </Link>

                <Link
                  href="/clientes"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-[#B99D22]" />
                  <span>Clientes</span>
                </Link>

                <Link
                  href="/system-status"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  title="Panel de verificación técnica y base de datos"
                >
                  <Activity className="w-3.5 h-3.5 text-sky-600" />
                  <span>Estado Sistema</span>
                </Link>
              </nav>
            </div>

            {/* Usuario, Estado y Cerrar Sesión */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Sesión Activa
              </span>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">{user.email || 'Operador'}</span>
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

          {/* Menú Móvil */}
          <div className="md:hidden flex space-x-2 py-2 border-t border-slate-100 overflow-x-auto text-xs">
            <Link
              href="/"
              className="px-3 py-1.5 rounded font-bold uppercase text-slate-700 hover:bg-slate-100"
            >
              Inicio
            </Link>
            <Link
              href="/clientes"
              className="px-3 py-1.5 rounded font-bold uppercase text-slate-700 hover:bg-slate-100"
            >
              Clientes
            </Link>
            <Link
              href="/system-status"
              className="px-3 py-1.5 rounded font-bold uppercase text-slate-500 hover:bg-slate-100"
            >
              Estado Sistema
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer Mínimo */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Steffen ERP • Fase 4 en curso • Cosmética Capilar
      </footer>
    </div>
  );
}
