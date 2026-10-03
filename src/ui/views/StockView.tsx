// Stock View conforming to DESIGN.md Section 17 & BUSINESS_RULES.md Section 8

import React, { useState } from 'react';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { Button, StatusBadge } from '../components/UIComponents';
import { PlusCircle, Sliders, Filter } from 'lucide-react';
import { UUID, ItemType } from '../../types/domain';

export const StockView: React.FC<{
  onOpenModal: (modalName: string, props?: any) => void;
}> = ({ onOpenModal }) => {
  const state = db.getState();
  const [activeTab, setActiveTab] = useState<'PRO' | 'MPR' | 'COM' | 'MST'>('PRO');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');

  // Suppliers for filter
  const suppliers = Object.values(state.suppliers).filter((s) => s.active);

  // Stock items by type
  const items = Object.values(state.stockItems)
    .filter((it) => it.active && it.item_type === (activeTab === 'MST' ? 'PRO' : activeTab))
    .map((it) => {
      const balance = state.stockBalances[it.id]?.quantity || 0;
      const min = it.stock_minimum || 1;
      const ratio = balance / min;
      const costInfo = it.item_type !== 'PRO' ? domainServices.getCurrentStockItemCost(it.id) : null;
      return {
        item: it,
        balance,
        min,
        ratio,
        costInfo,
      };
    })
    // Sort strictly by ratio ASC conforming to Section 8.3 of BUSINESS_RULES.md
    .sort((a, b) => a.ratio - b.ratio)
    .filter((row) => {
      if (supplierFilter === 'ALL' || activeTab === 'PRO' || activeTab === 'MST') return true;
      return row.costInfo?.supplierId === supplierFilter;
    });

  // MST Movements
  const stockMovements = Object.values(state.stockMovements).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg border border-[#D9D9D9]">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Stock de Fábrica</h1>
          <p className="text-xs text-gray-500">
            Control de existencias de Productos Finales, Materias Primas y Componentes ordenados por ratio crítico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secundario" onClick={() => onOpenModal('STOCK_ADJUSTMENT')} className="flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Ajuste Manual (+ / -)
          </Button>
          <Button variant="principal" onClick={() => onOpenModal('NEW_ITEM')} className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" /> Nuevo Insumo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D9D9D9] bg-white px-4 rounded-t-lg">
        {[
          { id: 'PRO', label: 'Productos Finales' },
          { id: 'MPR', label: 'Materias Primas (kg)' },
          { id: 'COM', label: 'Componentes (un)' },
          { id: 'MST', label: 'Movimientos de Stock (MST)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#B99D22] text-[#B99D22]'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Supplier Filter for MPR / COM */}
      {(activeTab === 'MPR' || activeTab === 'COM') && (
        <div className="bg-white p-3 rounded-lg border border-[#D9D9D9] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Filtrar por Proveedor de Referencia:</span>
          </div>
          <select
            className="h-8 px-2 border border-[#D9D9D9] rounded bg-white text-xs"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="ALL">Todos los proveedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.currency_code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
        {activeTab !== 'MST' ? (
          items.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No hay ítems registrados en esta categoría.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D9D9D9] text-gray-500 font-bold text-left bg-gray-50">
                    <th className="py-2.5 px-3">CÓDIGO</th>
                    <th className="py-2.5 px-3">NOMBRE</th>
                    {activeTab !== 'PRO' && <th className="py-2.5 px-3">PROVEEDOR VIGENTE</th>}
                    {activeTab === 'MPR' && <th className="py-2.5 px-3">INCI</th>}
                    {activeTab !== 'PRO' && <th className="py-2.5 px-3 text-right">COSTO BRUTO C/IVA</th>}
                    <th className="py-2.5 px-3 text-right">STOCK ACTUAL</th>
                    <th className="py-2.5 px-3 text-right">STOCK MÍNIMO</th>
                    <th className="py-2.5 px-3 text-center">RATIO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(({ item, balance, min, ratio, costInfo }) => {
                    const isCritical = ratio < 1;
                    const unit = item.unit_type;
                    const decimals = unit === 'KG' ? 3 : 0;
                    const rm = state.rawMaterials[item.id];

                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${isCritical ? 'bg-red-50/50' : ''}`}>
                        <td className={`py-3 px-3 font-bold ${isCritical ? 'text-[#DD0000]' : 'text-[#B99D22]'}`}>
                          {item.code}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#000]">{item.name}</td>
                        {activeTab !== 'PRO' && (
                          <td className="py-3 px-3 text-gray-600">{costInfo?.supplierName || 'Sin asignar'}</td>
                        )}
                        {activeTab === 'MPR' && <td className="py-3 px-3 italic text-gray-500">{rm?.inci || '-'}</td>}
                        {activeTab !== 'PRO' && (
                          <td className="py-3 px-3 text-right font-medium text-gray-700">
                            $ {costInfo?.grossArs.toFixed(2)}
                          </td>
                        )}
                        <td className={`py-3 px-3 text-right font-bold text-sm ${isCritical ? 'text-[#DD0000]' : 'text-[#008102]'}`}>
                          {balance.toFixed(decimals)} {unit}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-500">
                          {min.toFixed(decimals)} {unit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isCritical ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-red-100 text-[#DD0000] border border-red-300">
                              {(ratio * 100).toFixed(0)}% (CRÍTICO)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded font-medium text-[11px] bg-green-100 text-[#008102]">
                              {(ratio * 100).toFixed(0)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* MST Table */
          stockMovements.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No hay movimientos de stock registrados.</p>
          ) : (
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-[#D9D9D9] text-gray-500 font-bold text-left bg-gray-50">
                    <th className="py-2.5 px-3">CÓDIGO MST</th>
                    <th className="py-2.5 px-3">FECHA</th>
                    <th className="py-2.5 px-3">TIPO</th>
                    <th className="py-2.5 px-3">ÍTEM</th>
                    <th className="py-2.5 px-3 text-right">VARIACIÓN</th>
                    <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stockMovements.map((mov) => {
                    const it = state.stockItems[mov.stock_item_id];
                    const decimals = it?.unit_type === 'KG' ? 3 : 0;
                    const isPositive = mov.quantity_delta > 0;

                    return (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-bold text-gray-700">{mov.code}</td>
                        <td className="py-2.5 px-3 text-gray-500">
                          {new Date(mov.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-800 text-[11px]">
                            {mov.movement_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#000]">
                          {it?.name} ({it?.code})
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${
                            isPositive ? 'text-[#008102]' : 'text-[#DD0000]'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {mov.quantity_delta.toFixed(decimals)} {it?.unit_type}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{mov.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};
