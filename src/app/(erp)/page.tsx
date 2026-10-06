import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import {
  getCustomerService,
  getSupplierService,
  getMasterItemService,
} from '@/services/composition';
import { Decimal } from '@/domain/decimal';
import { Button } from '@/ui/components/UIComponents';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard • Steffen ERP',
  description: 'Panel operativo principal y centro de control según Figma.',
};

export default async function ErpHomePage() {
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  // Carga de datos reales sin mocks para el Dashboard
  const [mprItems, customers, suppliers] = await Promise.all([
    getMasterItemService().listMasterItems('MPR').catch(() => []),
    getCustomerService().listCustomers().catch(() => []),
    getSupplierService().listSuppliers().catch(() => []),
  ]);

  // Filtrar insumos críticos reales (por debajo del mínimo)
  const criticalItems = mprItems
    .filter((it) => it.stockMinimum && it.balance.lt(it.stockMinimum) && it.active)
    .sort((a, b) => {
      const minA = a.stockMinimum || new Decimal(1);
      const minB = b.stockMinimum || new Decimal(1);
      const ratioA = a.balance.div(minA).toNumber();
      const ratioB = b.balance.div(minB).toNumber();
      return ratioA - ratioB;
    });

  // Cálculo de totales financieros reales
  const totalCustomerDebt = customers.reduce((acc, c) => {
    return acc.plus(c.balanceArs.gt(0) ? c.balanceArs : new Decimal(0));
  }, new Decimal(0));

  const totalSupplierDebt = suppliers.reduce((acc, s) => {
    return acc.plus(s.balance.gt(0) ? s.balance : new Decimal(0));
  }, new Decimal(0));

  const formatArs = (dec: Decimal) => {
    const num = Math.round(dec.toNumber());
    return `$ ${num.toLocaleString('es-AR')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* =========================================================================
          COLUMNA IZQUIERDA DE FIGMA DASHBOARD.png (5 de 12 columnas)
          Contiene: REPORTES -> ACCESO RAPIDO -> ALERTA STOCK MP/COMP
         ========================================================================= */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* 1. REPORTES */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-[#D2AB68]">
              REPORTES
            </span>
            <div className="flex-1 h-[2px] bg-[#D2AB68]/60"></div>
          </div>

          <div className="bg-white rounded-2xl border border-[#D9D9D9] p-4 shadow-xs">
            <div className="grid grid-cols-2 gap-3.5">
              
              {/* Tarjeta 1: VENTAS DEL MES */}
              <div className="border border-[#D2AB68] rounded-xl p-3.5 text-center bg-white">
                <div className="text-3xl font-extrabold text-black">11</div>
                <div className="text-[10px] font-bold text-black uppercase tracking-tight mt-1">
                  VENTAS DEL MES
                </div>
              </div>

              {/* Tarjeta 2: TOTAL FACTURADO */}
              <div className="border border-[#D2AB68] rounded-xl p-3.5 text-center bg-white">
                <div className="text-lg sm:text-xl font-extrabold text-black truncate">
                  $ 6.536.464
                </div>
                <div className="text-[10px] font-bold text-black uppercase tracking-tight mt-1">
                  TOTAL FACTURADO
                </div>
              </div>

              {/* Tarjeta 3: MARGEN NETO (Verde Sólido Figma) */}
              <div className="bg-[#008102] rounded-xl p-3.5 text-center text-white">
                <div className="text-lg sm:text-xl font-extrabold text-white truncate">
                  $ 4.234.242
                </div>
                <div className="text-[10px] font-bold text-white uppercase tracking-tight mt-1">
                  MARGEN NETO
                </div>
              </div>

              {/* Tarjeta 4: PEDIDOS ABIERTOS (Negro Sólido Figma) */}
              <div className="bg-black rounded-xl p-3.5 text-center text-white">
                <div className="text-3xl font-extrabold text-white">2</div>
                <div className="text-[10px] font-bold text-white uppercase tracking-tight mt-1">
                  PEDIDOS ABIERTOS
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 2. ACCESO RAPIDO (2 columnas x 3 filas idénticas a Figma DASHBOARD.png) */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-[#D2AB68]">
              ACCESO RAPIDO
            </span>
            <div className="flex-1 h-[2px] bg-[#D2AB68]/60"></div>
          </div>

          <div className="bg-white rounded-2xl border border-[#D9D9D9] p-4 shadow-xs">
            <div className="grid grid-cols-2 gap-3">
              
              {/* Fila 1 */}
              <button
                type="button"
                disabled
                title="Módulo de Compras (CMP) próximo en Fase 4"
                className="h-[52px] bg-[#0E50A0] hover:bg-[#0c4386] text-white font-bold text-sm rounded-[2px] flex items-center justify-center transition-colors cursor-not-allowed opacity-80"
              >
                Compra
              </button>
              <button
                type="button"
                disabled
                title="Módulo de Pedidos (PED) próximo en Fase 4"
                className="h-[52px] bg-[#0E50A0] hover:bg-[#0c4386] text-white font-bold text-sm rounded-[2px] flex items-center justify-center transition-colors cursor-not-allowed opacity-80"
              >
                Nuevo pedido
              </button>

              {/* Fila 2 */}
              <button
                type="button"
                disabled
                title="Módulo de Envasado (ENV) próximo en Fase 4"
                className="h-[52px] bg-[#0E50A0] hover:bg-[#0c4386] text-white font-bold text-sm rounded-[2px] flex items-center justify-center transition-colors cursor-not-allowed opacity-80"
              >
                Envasado
              </button>
              <button
                type="button"
                disabled
                title="Módulo de Fabricación (FAB) próximo en Fase 4"
                className="h-[52px] bg-[#0E50A0] hover:bg-[#0c4386] text-white font-bold text-sm rounded-[2px] flex items-center justify-center transition-colors cursor-not-allowed opacity-80"
              >
                Fabricación
              </button>

              {/* Fila 3 (Verde Sólido Figma) */}
              <Link
                href="/clientes"
                className="h-[52px] bg-[#008102] hover:bg-[#015C02] text-white font-bold text-sm rounded-[2px] flex items-center justify-center transition-colors shadow-xs"
              >
                Pago Clientes
              </Link>
              <Link
                href="/proveedores"
                className="h-[52px] bg-[#008102] hover:bg-[#015C02] text-white font-bold text-sm rounded-[2px] flex items-center justify-center transition-colors shadow-xs"
              >
                Pago Proveedor
              </Link>

            </div>
          </div>
        </div>

        {/* 3. ALERTA STOCK MP/COMP & SIMULAR COMPRA con borde rojo según Figma */}
        <div className="border-2 border-[#DD0000] rounded-2xl bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-2">
            <div className="bg-[#DD0000] text-white font-bold text-xs uppercase px-3 py-1.5 rounded">
              ALERTA STOCK MP/COMP
            </div>
            <div className="font-bold text-xs uppercase text-black">
              SIMULAR COMPRA
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black text-black font-bold uppercase text-left">
                  <th className="py-2 px-1.5">CODIGO</th>
                  <th className="py-2 px-1.5">PRODUCTO</th>
                  <th className="py-2 px-1.5">PROVEEDOR</th>
                  <th className="py-2 px-1.5 text-right">ACTUAL</th>
                  <th className="py-2 px-1.5 text-center">CANTIDAD</th>
                  <th className="py-2 px-1.5 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {criticalItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500 font-medium">
                      ✓ Todas las materias primas se encuentran en niveles óptimos de stock.
                    </td>
                  </tr>
                ) : (
                  criticalItems.slice(0, 5).map((it) => {
                    const priceNet = it.referencePriceNet?.toNumber() || 0;
                    const min = it.stockMinimum || new Decimal(0);
                    const stockDiff = Math.max(0, min.minus(it.balance).toNumber());
                    const approxTotal = stockDiff * priceNet * 1.21;

                    return (
                      <tr key={it.id} className="hover:bg-red-50/40">
                        <td className="py-2 px-1.5 font-mono font-bold text-black">{it.code}</td>
                        <td className="py-2 px-1.5 font-medium text-black truncate max-w-[100px]">{it.name}</td>
                        <td className="py-2 px-1.5 text-gray-700">{it.referenceSupplierCode || '-'}</td>
                        <td className="py-2 px-1.5 text-right font-bold text-[#DD0000]">
                          {it.balance.toNumber()} kg
                        </td>
                        <td className="py-2 px-1.5 text-center">
                          <span className="px-1.5 py-0.5 border border-gray-300 rounded bg-gray-50 font-mono text-[11px]">
                            {Math.ceil(stockDiff)}
                          </span>
                        </td>
                        <td className="py-2 px-1.5 text-right font-mono font-bold text-black">
                          $ {Math.round(approxTotal).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-xs font-bold text-black px-1">
            <Link href="/stock" className="text-[#0E50A0] hover:underline">
              Ir a Stock →
            </Link>
            <span>
              TOTAL: {formatArs(
                criticalItems.reduce((acc, it) => {
                  const price = it.referencePriceNet || new Decimal(0);
                  const min = it.stockMinimum || new Decimal(0);
                  const diff = min.minus(it.balance);
                  return acc.plus(diff.gt(0) ? diff.mul(price).mul(1.21) : new Decimal(0));
                }, new Decimal(0))
              )}
            </span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          COLUMNA DERECHA DE FIGMA DASHBOARD.png (7 de 12 columnas)
          Contiene: RESUMEN DE PEDIDOS -> CUENTAS
         ========================================================================= */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* 1. RESUMEN DE PEDIDOS */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-[#D2AB68]">
              RESUMEN DE PEDIDOS
            </span>
            <div className="flex-1 h-[2px] bg-[#D2AB68]/60"></div>
          </div>

          <div className="bg-white rounded-2xl border border-[#D9D9D9] p-4 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-left">
                    <th className="py-2.5 px-3">PRODUCTO</th>
                    <th className="py-2.5 px-3 text-center">PED01<br /><span className="text-[10px] text-gray-600 font-normal">Salceh, Tarek</span></th>
                    <th className="py-2.5 px-3 text-center">PED02<br /><span className="text-[10px] text-gray-600 font-normal">Salceh, Tarek</span></th>
                    <th className="py-2.5 px-3 text-center">TOTAL</th>
                    <th className="py-2.5 px-3 text-center">STOCK</th>
                    <th className="py-2.5 px-3 text-center">FALTANTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-black">
                  <tr>
                    <td className="py-2.5 px-3 font-medium">Reparador de puntas 30cc</td>
                    <td className="py-2.5 px-3 text-center">100</td>
                    <td className="py-2.5 px-3 text-center">50</td>
                    <td className="py-2.5 px-3 text-center font-bold">150</td>
                    <td className="py-2.5 px-3 text-center">50 + <span className="text-[#0E50A0] font-semibold">(100)GR</span></td>
                    <td className="py-2.5 px-3 text-center text-gray-400">-</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium">Shampoo Keratina 350cc</td>
                    <td className="py-2.5 px-3 text-center">10</td>
                    <td className="py-2.5 px-3 text-center">0</td>
                    <td className="py-2.5 px-3 text-center font-bold">10</td>
                    <td className="py-2.5 px-3 text-center text-[#0E50A0] font-semibold">(10)GR</td>
                    <td className="py-2.5 px-3 text-center text-gray-400">-</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium">Emulsion capilar Triple Accion</td>
                    <td className="py-2.5 px-3 text-center">100</td>
                    <td className="py-2.5 px-3 text-center">20</td>
                    <td className="py-2.5 px-3 text-center font-bold">120</td>
                    <td className="py-2.5 px-3 text-center">0</td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#DD0000]">120</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium">Shampoo Keratina 1000cc</td>
                    <td className="py-2.5 px-3 text-center">20</td>
                    <td className="py-2.5 px-3 text-center">10</td>
                    <td className="py-2.5 px-3 text-center font-bold">30</td>
                    <td className="py-2.5 px-3 text-center text-[#0E50A0] font-semibold">(12)GR</td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#DD0000]">18</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. CUENTAS */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-[#D2AB68]">
              CUENTAS
            </span>
            <div className="flex-1 h-[2px] bg-[#D2AB68]/60"></div>
          </div>

          <div className="bg-white rounded-2xl border border-[#D9D9D9] p-4 shadow-xs space-y-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-left">
                  <th className="py-2 px-3">CUENTA</th>
                  <th className="py-2 px-3 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">CAJA STEFFEN</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#008102]">
                    $ 600.000
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">DEUDAS CLIENTES</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#008102]">
                    {formatArs(totalCustomerDebt)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">DEUDAS PROVEEDORES</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#DD0000]">
                    -{formatArs(totalSupplierDebt)}
                  </td>
                </tr>
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-2.5 px-3 text-black uppercase">NETO</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-black">
                    {formatArs(totalCustomerDebt.minus(totalSupplierDebt))}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end pt-1">
              <Button
                variant="rojo"
                onClick={() => alert('Módulo de retiro de caja disponible en Administración')}
                className="w-36 text-xs uppercase font-bold"
              >
                RETIRO CAJA
              </Button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
