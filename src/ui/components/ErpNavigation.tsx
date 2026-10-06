'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  enabled: boolean;
  subItems?: { name: string; href: string }[];
}

const navItems: NavItem[] = [
  { name: 'DASHBOARD', href: '/', enabled: true },
  { name: 'MI FABRICA', href: '/fabrica', enabled: false },
  { name: 'PEDIDOS', href: '/pedidos', enabled: false },
  { name: 'STOCK', href: '/stock', enabled: true },
  { name: 'FORMULAS', href: '/formulas', enabled: false },
  {
    name: 'ADMINISTRACION',
    href: '/clientes',
    enabled: true,
    subItems: [
      { name: 'Cuentas Clientes', href: '/clientes' },
      { name: 'Cuentas Proveedores', href: '/proveedores' },
      { name: 'Estado del Sistema', href: '/system-status' },
    ],
  },
];

export const ErpNavDesktop: React.FC = () => {
  const pathname = usePathname();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  return (
    <nav className="hidden lg:flex items-center gap-2 xl:gap-[11px]">
      {navItems.map((item) => {
        const isDashboard = item.href === '/' && pathname === '/';
        const isStock = item.href === '/stock' && pathname.startsWith('/stock');
        const isAdmin =
          item.name === 'ADMINISTRACION' &&
          (pathname.startsWith('/clientes') ||
            pathname.startsWith('/proveedores') ||
            pathname.startsWith('/system-status'));

        const isActive = isDashboard || isStock || isAdmin;
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

        if (item.subItems) {
          return (
            <div
              key={item.name}
              className={`${slotWidthClass} h-14 flex flex-col justify-end items-center relative group`}
              onMouseEnter={() => setAdminMenuOpen(true)}
              onMouseLeave={() => setAdminMenuOpen(false)}
            >
              <Link
                href={item.href}
                className="flex-1 flex items-center justify-center w-full px-1 text-center"
              >
                <span
                  className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'text-[#D2AB68]'
                      : 'text-black group-hover:text-[#D2AB68]'
                  }`}
                >
                  {item.name}
                </span>
              </Link>

              {/* Zona de subrayado uniforme en ancho */}
              <div className="w-full h-[6px] flex items-end">
                {isActive ? (
                  <div className="w-full h-[6px] bg-[#D2AB68]" />
                ) : (
                  <div className="w-full h-[2px] bg-black group-hover:bg-[#D2AB68] transition-colors" />
                )}
              </div>

              {adminMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 bg-white border border-[#D9D9D9] rounded-md shadow-lg py-1.5 z-50">
                  {item.subItems.map((sub) => {
                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setAdminMenuOpen(false)}
                        className={`block px-3 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors ${
                          isSubActive
                            ? 'bg-[#D2AB68]/15 text-[#D2AB68]'
                            : 'text-black hover:bg-gray-100'
                        }`}
                      >
                        {sub.name}
                      </Link>
                    );
                  })}
                </div>
              )}
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
        const isStock = item.href === '/stock' && pathname.startsWith('/stock');
        const isAdmin =
          item.name === 'ADMINISTRACION' &&
          (pathname.startsWith('/clientes') ||
            pathname.startsWith('/proveedores') ||
            pathname.startsWith('/system-status'));

        const isActive = isDashboard || isStock || isAdmin;

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
