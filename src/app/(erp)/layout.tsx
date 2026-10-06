import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { logoutAction } from '@/actions/auth.actions';
import { LogOut } from 'lucide-react';
import { SteffenLogoIcon } from '@/ui/components/SteffenLogo';
import { ErpNavDesktop, ErpNavMobile } from '@/ui/components/ErpNavigation';

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
    <div className="min-h-screen bg-white text-black flex flex-col font-sans antialiased">
      {/* Header Superior del ERP idéntico a Figma */}
      <header className="bg-white sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo Steffen en dorado */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center transition-opacity hover:opacity-90" title="Steffen ERP">
                <SteffenLogoIcon className="w-8 h-8 text-[#D2AB68]" />
              </Link>
            </div>

            {/* Navegación Principal Horizontal con barras inferiores exactas a Figma */}
            <div className="flex-1 flex justify-center px-6">
              <ErpNavDesktop />
            </div>

            {/* Acción de Logout según icono Figma */}
            <div className="flex items-center">
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Cerrar sesión"
                  className="p-1.5 text-black hover:text-[#D2AB68] transition-colors cursor-pointer"
                >
                  <LogOut className="w-5 h-5 stroke-[2.2]" />
                </button>
              </form>
            </div>

          </div>

          {/* Menú Móvil */}
          <ErpNavMobile />
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {children}
      </main>

      {/* Footer Mínimo */}
      <footer className="bg-white py-4 text-center text-[11px] text-gray-400 font-medium">
        Steffen ERP • Cosmética Capilar
      </footer>
    </div>
  );
}
