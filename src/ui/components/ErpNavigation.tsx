'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  enabled: boolean;
}

const navItems: NavItem[] = [
  { name: 'DASHBOARD', href: '/', enabled: true },
  { name: 'MI FABRICA', href: '/fabrica', enabled: true },
  { name: 'PEDIDOS', href: '/pedidos', enabled: false },
  { name: 'STOCK', href: '/stock', enabled: true },
  { name: 'ADMINISTRACION', href: '/administracion', enabled: true },
];

export const ErpNavDesktop: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex items-center gap-2 xl:gap-[11px]">
      {navItems.map((item) => {
        const isDashboard = item.href === '/' && pathname === '/';
        const isFabrica =
          item.href === '/fabrica' &&
          (pathname.startsWith('/fabrica') ||
            pathname.startsWith('/formulas') ||
            pathname.startsWith('/costo-ganancia'));
        const isStock =
          item.href === '/stock' &&
          (pathname.startsWith('/stock') ||
            pathname.startsWith('/materias-primas') ||
            pathname.startsWith('/componentes') ||
            pathname.startsWith('/productos'));
        const isAdmin =
          item.name === 'ADMINISTRACION' &&
          (pathname.startsWith('/administracion') ||
            pathname.startsWith('/clientes') ||
            pathname.startsWith('/proveedores') ||
            pathname.startsWith('/precios') ||
            pathname.startsWith('/system-status'));

        const isActive = isDashboard || isFabrica || isStock || isAdmin;
        const slotWidthClass = 'w-[140px] xl:w-[185px]';

        if (!item.enabled) {
          return (
            <div
              key={item.name}
              className={`${slotWidthClass} h-14 flex flex-col justify-end items-center cursor-not-allowed opacity-70 group`}
              title="Módulo próximo en Fase 4"
            >
              <div className="flex-1 flex items-center justify-center w-full px-1 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-black">
                  {item.name}
                </span>
              </div>
              <div className="w-full h-[6px] flex items-end">
                <div className="w-full h-[2px] bg-black" />
              </div>
            </div>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`${slotWidthClass} h-14 flex flex-col justify-end items-center group`}
          >
            <div className="flex-1 flex items-center justify-center w-full px-1 text-center">
              <span
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'text-[#D2AB68]'
                    : 'text-black group-hover:text-[#D2AB68]'
                }`}
              >
                {item.name}
              </span>
            </div>

            {/* Zona de subrayado uniforme en ancho */}
            <div className="w-full h-[6px] flex items-end">
              {isActive ? (
                <div className="w-full h-[6px] bg-[#D2AB68]" />
              ) : (
                <div className="w-full h-[2px] bg-black group-hover:bg-[#D2AB68] transition-colors" />
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
};

export const ErpNavMobile: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="lg:hidden flex space-x-3 py-2 border-t border-gray-200 overflow-x-auto text-xs scrollbar-none">
      {navItems.map((item) => {
        const isDashboard = item.href === '/' && pathname === '/';
        const isFabrica =
          item.href === '/fabrica' &&
          (pathname.startsWith('/fabrica') ||
            pathname.startsWith('/formulas') ||
            pathname.startsWith('/costo-ganancia'));
        const isStock =
          item.href === '/stock' &&
          (pathname.startsWith('/stock') ||
            pathname.startsWith('/materias-primas') ||
            pathname.startsWith('/componentes') ||
            pathname.startsWith('/productos'));
        const isAdmin =
          item.name === 'ADMINISTRACION' &&
          (pathname.startsWith('/administracion') ||
            pathname.startsWith('/clientes') ||
            pathname.startsWith('/proveedores') ||
            pathname.startsWith('/precios') ||
            pathname.startsWith('/system-status'));

        const isActive = isDashboard || isFabrica || isStock || isAdmin;

        if (!item.enabled) {
          return (
            <span
              key={item.name}
              className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap opacity-50"
            >
              {item.name}
            </span>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              isActive
                ? 'text-[#D2AB68] border-b-2 border-[#D2AB68]'
                : 'text-black hover:text-[#D2AB68]'
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </div>
  );
};
