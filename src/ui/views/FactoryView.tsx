// Factory View (Mi Fábrica) conforming to DESIGN.md Section 16 & BUSINESS_RULES.md

import React, { useState } from 'react';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { Button, StatusBadge, MoneyDisplay } from '../components/UIComponents';
import { Factory, Package, PlusCircle, CheckCircle2 } from 'lucide-react';

export const FactoryView: React.FC<{
  onOpenModal: (modalName: string, props?: any) => void;
}> = ({ onOpenModal }) => {
  const state = db.getState();

  // Active discount profile for Costo-Ganancia simulation
  const discountProfiles = Object.values(state.discountProfiles).sort((a, b) => a.sort_order - b.sort_order);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(discountProfiles[0]?.id || '');

  // 1. Bulk Lots OPEN
  const openLots = Object.values(state.bulkLots).filter((l) => l.status === 'OPEN');

  // 2. Upcoming fabrications (Próximas Fabricaciones)
  const openOrders = Object.values(state.orders).filter((o) => o.status === 'OPEN');
  const openOrderIds = new Set(openOrders.map((o) => o.id));
  const openOrderItems = Object.values(state.orderItems).filter((oi) => openOrderIds.has(oi.order_id));
  const prosWithOpenOrders = new Set(openOrderItems.map((oi) => oi.product_id));

  const upcomingFabrications = Object.values(state.products).map((pro) => {
    const stockItem = state.stockItems[pro.stock_item_id];
    const bp = state.baseProducts[pro.base_product_id];
    const currentStock = state.stockBalances[pro.stock_item_id]?.quantity || 0;
    const minStock = stockItem?.stock_minimum || 1;

    let status: 'URG' | 'POCO_STOCK' | 'NORMAL' = 'NORMAL';
    if (prosWithOpenOrders.has(pro.stock_item_id)) {
      status = 'URG';
    } else if (currentStock < minStock) {
      status = 'POCO_STOCK';
    }

    return {
      product: pro,
      stockItem,
      baseProduct: bp,
      currentStock,
      minStock,
      status,
    };
  }).filter((x) => x.status !== 'NORMAL');

  // 3. Costo-Ganancia Table (Exclusively Lista Salón)
  const salonList = Object.values(state.priceLists).find((pl) => pl.system_role === 'SALON_DEFAULT');
  const activeProfile = state.discountProfiles[selectedProfileId];
  const profileSteps = activeProfile
    ? Object.values(state.discountProfileSteps)
        .filter((s) => s.discount_profile_id === activeProfile.id)
        .sort((a, b) => a.position - b.position)
    : [];

  const costoGananciaRows = Object.values(state.products).map((pro) => {
    const stockItem = state.stockItems[pro.stock_item_id];
    const cost = domainServices.getCurrentProductCost(pro.stock_item_id);
    const listPrice = salonList ? domainServices.getPriceAtSnapshot(pro.stock_item_id, salonList.id, new Date().toISOString()) : 0;

    // Apply successive discounts
    let finalPrice = listPrice;
    profileSteps.forEach((s) => {
      finalPrice = finalPrice * (1 - s.percent / 100);
    });

    const markup = cost.totalCostArs > 0 ? finalPrice / cost.totalCostArs : 0;
    const gain = finalPrice - cost.totalCostArs;

    return {
      product: pro,
      stockItem,
      totalCostArs: cost.totalCostArs,
      listPrice,
      finalPrice,
      markup,
      gain,
    };
  });

  // 4. Factory Movements (MFA)
  const factoryMovements = Object.values(state.factoryMovements).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-lg border border-[#D9D9D9]">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Mi Fábrica</h1>
          <p className="text-xs text-gray-500">Gestión de lotes de granel, envasado, costos teóricos y rentabilidad.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="principal" onClick={() => onOpenModal('MANUFACTURE')} className="flex items-center gap-2">
            <Factory className="w-4 h-4" /> Registrar Fabricación
          </Button>
          <Button variant="secundario" onClick={() => onOpenModal('PACKAGING')} className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Envasado
          </Button>
        </div>
      </div>

      {/* Grid: Granel Disponible & Próximas Fabricaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Granel disponible */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <h2 className="text-base font-bold text-[#000000] mb-3">Lotes de Granel Disponibles</h2>
          {openLots.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No hay lotes abiertos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D9D9D9] text-gray-500 text-left">
                    <th className="py-2">CÓDIGO</th>
                    <th className="py-2">PRODUCTO BASE</th>
                    <th className="py-2 text-right">DISP. (KG)</th>
                    <th className="py-2 text-right">TOTAL (KG)</th>
                    <th className="py-2 text-right">COSTO SNAPSHOT/KG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {openLots.map((lot) => {
                    const bp = state.baseProducts[lot.base_product_id];
                    return (
                      <tr key={lot.id} className="hover:bg-gray-50">
                        <td className="py-2.5 font-bold text-[#B99D22]">{lot.code}</td>
                        <td className="py-2.5 font-medium">{bp?.name}</td>
                        <td className="py-2.5 text-right font-bold text-[#008102]">{lot.kg_available.toFixed(3)} kg</td>
                        <td className="py-2.5 text-right text-gray-500">{lot.kg_fabricated.toFixed(3)} kg</td>
                        <td className="py-2.5 text-right font-semibold">$ {lot.cost_per_kg_snapshot_ars.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Próximas fabricaciones */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <h2 className="text-base font-bold text-[#000000] mb-3">Próximas Fabricaciones Requeridas</h2>
          {upcomingFabrications.length === 0 ? (
            <div className="text-center py-6 text-[#008102] font-medium text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> No hay urgencias ni quiebres de stock.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingFabrications.map((uf) => (
                <div key={uf.product.stock_item_id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#000]">{uf.stockItem?.name}</span>
                      <StatusBadge type={uf.status as any} />
                    </div>
                    <span className="text-xs text-gray-500">Base: {uf.baseProduct?.name} ({uf.product.presentation})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#DD0000]">{uf.currentStock} un</span>
                    <p className="text-xs text-gray-400">Mínimo: {uf.minStock} un</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Costo-Ganancia por Producto (Nomenclatura oficial que reemplaza "Margen por producto") */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-[#000000] uppercase tracking-wider">Costo-Ganancia por Producto</h2>
            <p className="text-xs text-gray-500">
              Simulación de rentabilidad calculada exclusivamente sobre <strong>Lista Salón</strong> aplicando descuentos sucesivos.
            </p>
          </div>

          {/* Profile Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Simular Descuento:</span>
            <select
              className="h-9 px-3 border border-[#D9D9D9] rounded bg-white text-xs font-bold text-[#B99D22]"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
            >
              {discountProfiles.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-[#D9D9D9] text-[#000000] font-bold text-left">
                <th className="py-2.5 px-3">PRODUCTO FINAL</th>
                <th className="py-2.5 px-3 text-right">COSTO TOTAL TEÓRICO (C/IVA)</th>
                <th className="py-2.5 px-3 text-right">PRECIO LISTA SALÓN</th>
                <th className="py-2.5 px-3 text-right">PRECIO FINAL SIMULADO</th>
                <th className="py-2.5 px-3 text-right">MARKUP</th>
                <th className="py-2.5 px-3 text-right">GANANCIA POR UNIDAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costoGananciaRows.map((row) => (
                <tr key={row.product.stock_item_id} className="hover:bg-gray-50">
                  <td className="py-3 px-3 font-semibold text-[#393939]">
                    {row.stockItem?.name} ({row.stockItem?.code})
                  </td>
                  <td className="py-3 px-3 text-right font-medium">$ {row.totalCostArs.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-gray-600">$ {row.listPrice.toLocaleString('es-AR')}</td>
                  <td className="py-3 px-3 text-right font-bold text-[#000]">$ {Math.round(row.finalPrice).toLocaleString('es-AR')}</td>
                  <td className="py-3 px-3 text-right font-bold text-[#B99D22]">{row.markup.toFixed(2)}x</td>
                  <td className={`py-3 px-3 text-right font-bold ${row.gain > 0 ? 'text-[#008102]' : 'text-[#DD0000]'}`}>
                    $ {Math.round(row.gain).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movimientos de Fábrica (MFA) */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
        <h2 className="text-base font-bold text-[#000000] mb-3">Movimientos de Fábrica (MFA)</h2>
        {factoryMovements.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No hay movimientos productivos registrados.</p>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#D9D9D9] text-gray-500 text-left">
                  <th className="py-2">CÓDIGO</th>
                  <th className="py-2">TIPO</th>
                  <th className="py-2">DESCRIPCIÓN</th>
                  <th className="py-2 text-right">CANTIDAD (KG)</th>
                  <th className="py-2 text-right">FECHA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {factoryMovements.slice(0, 15).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="py-2 font-bold text-gray-700">{m.code}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-800 text-[11px]">
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="py-2 text-gray-700">{m.description}</td>
                    <td className="py-2 text-right font-bold">{m.quantity_kg ? `${m.quantity_kg.toFixed(3)} kg` : '-'}</td>
                    <td className="py-2 text-right text-gray-500">{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
