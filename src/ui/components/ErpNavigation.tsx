'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Truck, Activity } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Inicio', href: '/', icon: Home },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Proveedores', href: '/proveedores', icon: Truck },
  { name: 'Estado Sistema', href: '/system-status', icon: Activity },
];

export const ErpNavDesktop: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase rounded-lg transition-colors ${
              isActive
                ? 'bg-amber-50 text-[#8C7414] font-bold border border-amber-200/70 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#B99D22]' : 'text-slate-400'}`} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export const ErpNavMobile: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="md:hidden flex space-x-2 py-2 border-t border-slate-100 overflow-x-auto text-xs">
      {navItems.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded uppercase whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-amber-50 text-[#8C7414] font-bold border border-amber-200/70'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </div>
  );
};
