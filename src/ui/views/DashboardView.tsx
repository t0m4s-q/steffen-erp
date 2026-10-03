// Dashboard View conforming to DESIGN.md Section 15 & BUSINESS_RULES.md Section 35

import React from 'react';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { Button, StatusBadge, MoneyDisplay } from '../components/UIComponents';
import { ShoppingCart, Package, Factory, Wallet, AlertTriangle, ArrowRight } from 'lucide-react';

export const DashboardView: React.FC<{
  onNavigate: (module: string) => void;
  onOpenModal: (modalName: string, props?: any) => void;
}> = ({ onNavigate, onOpenModal }) => {
  const state = db.getState();
  const reportsData = domainServices.getReportsData();
  const planningData = domainServices.calculateOrderPlanning();

  // Financial calculations
  const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN')?.current_balance || 0;
  const cashML = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_MERCADO_LIBRE')?.current_balance || 0;

  const totalCustomerDebt = Object.values(state.financialAccounts)
    .filter((a) => a.account_type === 'CUSTOMER_RECEIVABLE')
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalSupplierDebt = Object.values(state.financialAccounts)
    .filter((a) => a.account_type === 'SUPPLIER_PAYABLE')
    .reduce((sum, a) => sum + a.current_balance, 0);

  const netBalance = cashSteffen + cashML + totalCustomerDebt - totalSupplierDebt;

  // Open Bulk lots
  const openLots = Object.values(state.bulkLots).filter((l) => l.status === 'OPEN' && l.kg_available > 0);

  // Critical stock items (ratio < 1)
  const criticalStock = Object.values(state.stockItems)
    .filter((it) => it.active)
    .map((it) => {
      const current = state.stockBalances[it.id]?.quantity || 0;
      const min = it.stock_minimum || 1;
      const ratio = current / min;
      return { item: it, current, min, ratio };
    })
    .sort((a, b) => a.ratio - b.ratio)
    .filter((x) => x.ratio < 1);

  // Pending RTM alert
  const pendingRtm = Object.values(state.remittances).find((r) => r.status === 'RTM_PENDING');

  return (
    <div className="space-y-6">
      {/* Alert for Pending RTM */}
      {pendingRtm && (
        <div className="p-4 bg-amber-100 border-2 border-amber-500 rounded-lg flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
            <div>
              <p className="font-bold text-amber-900 text-sm">
                ACCIÓN OBLIGATORIA PENDIENTE: Remito {pendingRtm.code} confirmado requiere completar su RTM
              </p>
              <p className="text-xs text-amber-800">
                No se pueden confirmar otros pedidos hasta ingresar flete/transporte y congelar la ganancia.
              </p>
            </div>
          </div>
          <Button variant="principal" onClick={() => onOpenModal('COMPLETE_RTM', { remittanceId: pendingRtm.id })}>
            Completar RTM Ahora
          </Button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#D9D9D9] shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ventas del Mes</span>
          <p className="text-2xl font-bold text-[#000000] mt-1">{reportsData.salesCurrentMonth}</p>
          <span className="text-xs text-gray-400">RTOs completados</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#D9D9D9] shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Facturado</span>
          <p className="text-2xl font-bold text-[#000000] mt-1">
            <MoneyDisplay amount={reportsData.billedCurrentMonthArs} />
          </p>
          <span className="text-xs text-gray-400">Mes calendario actual</span>
        </div>

        <div className="bg-[#008102] text-white p-4 rounded-lg shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-green-100">Ganancia Neta</span>
          <p className="text-2xl font-bold mt-1">$ {Math.round(reportsData.gainCurrentMonthArs).toLocaleString('es-AR')}</p>
          <span className="text-xs text-green-200">Margen real de ventas cerradas</span>
        </div>

        <div className="bg-[#000000] text-white p-4 rounded-lg shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">Pedidos Abiertos</span>
          <p className="text-2xl font-bold text-[#B99D22] mt-1">{reportsData.openOrdersCount}</p>
          <span className="text-xs text-gray-400">Pendientes de preparación</span>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#393939] mb-3">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <Button variant="secundario" onClick={() => onOpenModal('NEW_ORDER')} className="flex flex-col gap-1 py-3 h-auto">
            <ShoppingCart className="w-5 h-5 text-[#B99D22]" />
            <span className="text-xs">Nuevo Pedido</span>
          </Button>

          <Button variant="secundario" onClick={() => onOpenModal('MANUFACTURE')} className="flex flex-col gap-1 py-3 h-auto">
            <Factory className="w-5 h-5 text-[#B99D22]" />
            <span className="text-xs">Fabricar Granel</span>
          </Button>

          <Button variant="secundario" onClick={() => onOpenModal('PACKAGING')} className="flex flex-col gap-1 py-3 h-auto">
            <Package className="w-5 h-5 text-[#B99D22]" />
            <span className="text-xs">Envasar PRO</span>
          </Button>

          <Button variant="secundario" onClick={() => onOpenModal('PURCHASE')} className="flex flex-col gap-1 py-3 h-auto">
            <ShoppingCart className="w-5 h-5 text-gray-700" />
            <span className="text-xs">Registrar Compra</span>
          </Button>

          <Button variant="secundario" onClick={() => onOpenModal('PAYMENT_CUSTOMER')} className="flex flex-col gap-1 py-3 h-auto">
            <Wallet className="w-5 h-5 text-[#008102]" />
            <span className="text-xs">Cobro Cliente</span>
          </Button>

          <Button variant="secundario" onClick={() => onOpenModal('PAYMENT_SUPPLIER')} className="flex flex-col gap-1 py-3 h-auto">
            <Wallet className="w-5 h-5 text-[#DD0000]" />
            <span className="text-xs">Pago Proveedor</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Planning preview & Accounts summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Planning Matrix Preview */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-base font-bold text-[#000000]">Resumen de Pedidos (Planificación)</h2>
                <span className="text-xs text-gray-500">
                  Simulación de cobertura en tiempo real con stock existente y granel disponible.
                </span>
              </div>
              <Button variant="secundario" onClick={() => onNavigate('pedidos')} className="text-xs flex items-center gap-1">
                Ver Completo <ArrowRight className="w-3 h-3" />
              </Button>
            </div>

            {planningData.products.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No hay pedidos abiertos para planificar.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#D9D9D9] text-gray-500 font-semibold text-left">
                      <th className="py-2">PRODUCTO</th>
                      <th className="py-2 text-right">SOLICITADO</th>
                      <th className="py-2 text-right">STOCK DISP.</th>
                      <th className="py-2 text-right">A ENVASAR (GRA)</th>
                      <th className="py-2 text-right">FALTANTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {planningData.products.slice(0, 5).map((p) => (
                      <tr key={p.productId} className="hover:bg-gray-50">
                        <td className="py-2.5 font-medium text-[#393939]">{p.productName}</td>
                        <td className="py-2.5 text-right font-bold">{p.totalRequested} un</td>
                        <td className="py-2.5 text-right text-gray-600">{p.coverageFromStock} un</td>
                        <td className="py-2.5 text-right text-blue-600">{p.coveredFromBulk} un</td>
                        <td className={`py-2.5 text-right font-bold ${p.finalShortage > 0 ? 'text-[#DD0000]' : 'text-[#008102]'}`}>
                          {p.finalShortage > 0 ? `${p.finalShortage} un` : 'Cubierto'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Financial Overview Card */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-[#000000]">Estado Patrimonial</h2>
            <Button variant="secundario" onClick={() => onNavigate('administracion')} className="text-xs">
              Administrar
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-2 rounded bg-gray-50">
              <span className="text-gray-600">Caja Steffen (Efectivo/Banco):</span>
              <MoneyDisplay amount={cashSteffen} className="text-base" />
            </div>

            <div className="flex justify-between items-center p-2 rounded bg-gray-50">
              <span className="text-gray-600">Caja Mercado Libre:</span>
              <MoneyDisplay amount={cashML} className="text-base" />
            </div>

            <div className="flex justify-between items-center p-2 rounded bg-gray-50">
              <span className="text-gray-600">Cuentas por Cobrar (Clientes):</span>
              <span className="font-bold text-[#008102]">$ {Math.round(totalCustomerDebt).toLocaleString('es-AR')}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded bg-gray-50">
              <span className="text-gray-600">Deudas a Proveedores:</span>
              <span className="font-bold text-[#DD0000]">$ {Math.round(totalSupplierDebt).toLocaleString('es-AR')}</span>
            </div>

            <div className="p-3 bg-[#FBFBFB] border-t-2 border-[#B99D22] rounded flex justify-between items-center mt-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#393939]">PATRIMONIO NETO:</span>
              <span className="text-xl font-bold text-[#B99D22]">$ {Math.round(netBalance).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Granel disponible & Alertas de Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Granel disponible */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-[#000000]">Granel Disponible en Fábrica</h2>
            <Button variant="secundario" onClick={() => onNavigate('fabrica')} className="text-xs">
              Ver Fábrica
            </Button>
          </div>

          {openLots.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No hay lotes de granel abiertos.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {openLots.map((lot) => {
                const bp = state.baseProducts[lot.base_product_id];
                return (
                  <div key={lot.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-[#000000]">
                        {lot.code} — {bp?.name}
                      </p>
                      <p className="text-xs text-gray-500">Fabricado: {new Date(lot.created_at).toLocaleDateString('es-AR')}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-[#008102]">{lot.kg_available.toFixed(3)} kg</span>
                      <p className="text-xs text-gray-400">de {lot.kg_fabricated.toFixed(3)} kg</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertas de Stock */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-[#000000]">Alertas de Stock Crítico</h2>
            <Button variant="secundario" onClick={() => onNavigate('stock')} className="text-xs">
              Ver Stock
            </Button>
          </div>

          {criticalStock.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#008102] font-semibold">
              ✓ Todos los ítems se encuentran por encima de su stock mínimo.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {criticalStock.slice(0, 5).map(({ item, current, min }) => (
                <div key={item.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#DD0000]">{item.name}</span>
                      <StatusBadge type="POCO_STOCK" />
                    </div>
                    <p className="text-xs text-gray-500">
                      Código: {item.code} | Tipo: {item.item_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#DD0000]">
                      {current.toFixed(item.unit_type === 'KG' ? 3 : 0)} {item.unit_type}
                    </span>
                    <p className="text-xs text-gray-400">
                      Mínimo: {min.toFixed(item.unit_type === 'KG' ? 3 : 0)} {item.unit_type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
