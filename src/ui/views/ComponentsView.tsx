'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '../components/UIComponents';
import { EditComponentModal } from '../modals/EditComponentModal';
import { toggleComponentActiveAction } from '@/actions/master-item.actions';
import type { ComponentDTO, SupplierOptionDTO } from '@/actions/master-item.dto';
import { Search, Edit3, Power, AlertTriangle } from 'lucide-react';

interface ComponentsViewProps {
  components: ComponentDTO[];
  activeSuppliers: SupplierOptionDTO[];
}

export const ComponentsView: React.FC<ComponentsViewProps> = ({
  components,
  activeSuppliers,
}) => {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);

  // Modales
  const [selectedComponent, setSelectedComponent] = useState<ComponentDTO | null>(null);
  const [confirmDialogComp, setConfirmDialogComp] = useState<ComponentDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtrado en cliente sobre DTOs ya ordenados por ratio en servidor
  const filteredComponents = components.filter((c) => {
    if (!showInactive && !c.active) return false;
    if (onlyCritical && !c.isBelowMinimum) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      c.code.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      (c.supplierName && c.supplierName.toLowerCase().includes(term)) ||
      (c.supplierCode && c.supplierCode.toLowerCase().includes(term))
    );
  });

  const criticalCount = components.filter((c) => c.active && c.isBelowMinimum).length;

  const handleToggleActiveClick = (comp: ComponentDTO) => {
    if (comp.active) {
      setConfirmDialogComp(comp);
    } else {
      handleExecuteToggle(comp, true);
    }
  };

  const handleExecuteToggle = async (comp: ComponentDTO, targetActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const res = await toggleComponentActiveAction(comp.id, targetActive);
      if (!res.success) {
        setActionError(res.error || 'Error al cambiar estado del componente');
      } else {
        router.refresh();
      }
      setConfirmDialogComp(null);
    });
  };

  // Precios para columnas de Figma: P.U. USD, P.U $, P.U+ IVA (resuelto por backend)
  const getPriceDisplays = (c: ComponentDTO) => {
    if (!c.quotedPriceNet || !c.supplierCurrency) {
      return { usd: '-', ars: '-', grossArs: '-' };
    }
    const num = parseFloat(c.quotedPriceNet) || 0;
    if (c.supplierCurrency === 'USD') {
      const usdStr = `usd ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      return {
        usd: usdStr,
        ars: '-',
        grossArs: c.theoreticalCostGrossArs
          ? `$ ${Math.round(parseFloat(c.theoreticalCostGrossArs)).toLocaleString('es-AR')}`
          : '-',
      };
    }

    const netArs = `$ ${Math.round(num).toLocaleString('es-AR')}`;
    const grossArs = c.theoreticalCostGrossArs
      ? `$ ${Math.round(parseFloat(c.theoreticalCostGrossArs)).toLocaleString('es-AR')}`
      : `$ ${Math.round(num * 1.21).toLocaleString('es-AR')}`;
    return {
      usd: '-',
      ars: netArs,
      grossArs,
    };
  };

  return (
    <>
      {actionError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#DD0000] flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-gray-400 hover:text-black font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Contenedor Interior de Tabla idéntico a Figma */}
      <div className="rounded-[5px] border border-[#D9D9D9] p-5 mt-5">
        
        {/* Encabezado: Título a la izquierda, Buscador y Filtros a la derecha */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-black pb-2 mb-4">
          <h2 className="text-xl font-bold text-black tracking-tight">
            Listado de componentes
          </h2>

          <div className="flex items-center gap-4">
            {/* Filtro rápido bajo mínimo */}
            <button
              type="button"
              onClick={() => setOnlyCritical(!onlyCritical)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                onlyCritical
                  ? 'bg-red-100 text-red-800 border border-red-300 font-bold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>Bajo mínimo ({criticalCount})</span>
            </button>

            {/* Toggle inactivos */}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-3.5 w-3.5"
              />
              <span>Inactivos</span>
            </label>

            {/* Input Buscar como en Figma */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-3 pr-8 text-xs border border-[#D9D9D9] rounded-lg w-52 sm:w-64 focus:outline-none focus:border-[#0E50A0] placeholder-gray-400 text-black"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tabla de Componentes con columnas de Figma SOLAPA-MATERIA-Y-COMPONENTES.png */}
        {filteredComponents.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs font-medium">
            No hay componentes registrados para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px]">
                  <th className="py-2.5 px-3 text-left">CODIGO</th>
                  <th className="py-2.5 px-3 text-left">PROVEEDOR</th>
                  <th className="py-2.5 px-3 text-left">COMPONENTE</th>
                  <th className="py-2.5 px-3 text-left">ULTIMA COMPRA</th>
                  <th className="py-2.5 px-3 text-left">ULTIMA ACT PRECIO</th>
                  <th className="py-2.5 px-3 text-right">P.U. USD</th>
                  <th className="py-2.5 px-3 text-right">P.U $</th>
                  <th className="py-2.5 px-3 text-right">P.U+ IVA</th>
                  <th className="py-2.5 px-3 text-right">STOCK ACTUAL</th>
                  <th className="py-2.5 px-3 text-right">STOCK MINIMO</th>
                  <th className="py-2.5 px-3 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredComponents.map((c) => {
                  const prices = getPriceDisplays(c);
                  // Regla Figma: Si está bajo mínimo, fila completa en color salmón/rojo claro (#FFA8A8)
                  const isRowCritical = c.isBelowMinimum;

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isRowCritical
                          ? 'bg-[#FFA8A8] text-black font-medium'
                          : !c.active
                          ? 'opacity-60 bg-gray-50 text-gray-600'
                          : 'hover:bg-gray-50 text-black'
                      }`}
                    >
                      {/* Código */}
                      <td className="py-3 px-3 font-bold font-mono">
                        {c.code}
                      </td>

                      {/* Proveedor */}
                      <td className="py-3 px-3 font-semibold">
                        {c.supplierName || '-'}
                      </td>

                      {/* Nombre Componente */}
                      <td className="py-3 px-3 font-medium">
                        {c.name}
                      </td>

                      {/* Última Compra */}
                      <td className="py-3 px-3 text-gray-700">
                        -
                      </td>

                      {/* Última Act Precio */}
                      <td className="py-3 px-3 text-gray-700">
                        {c.priceUpdatedAt
                          ? new Date(c.priceUpdatedAt).toLocaleDateString('es-AR')
                          : '-'}
                      </td>

                      {/* P.U. USD */}
                      <td className="py-3 px-3 text-right font-mono">
                        {prices.usd}
                      </td>

                      {/* P.U $ (Neto) */}
                      <td className="py-3 px-3 text-right font-mono">
                        {prices.ars}
                      </td>

                      {/* P.U+ IVA */}
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        {prices.grossArs}
                      </td>

                      {/* Stock Actual en Unidades Enteras */}
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {c.stockCurrentUnits} u
                      </td>

                      {/* Stock Mínimo en Unidades Enteras */}
                      <td className="py-3 px-3 text-right font-mono text-gray-700">
                        {c.stockMinimumUnits} u
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center whitespace-nowrap space-x-1">
                        <button
                          onClick={() => setSelectedComponent(c)}
                          title="Editar Ficha / Cotización"
                          className="p-1 rounded hover:bg-black/10 text-[#0E50A0] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActiveClick(c)}
                          title={c.active ? 'Desactivar insumo' : 'Activar insumo'}
                          className={`p-1 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                            c.active ? 'text-gray-500 hover:text-red-700' : 'text-[#008102]'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal de Edición de Componente */}
      <EditComponentModal
        isOpen={Boolean(selectedComponent)}
        component={selectedComponent}
        activeSuppliers={activeSuppliers}
        onClose={() => setSelectedComponent(null)}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* ConfirmDialog para Desactivación */}
      {confirmDialogComp && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Componente"
          message={`¿Estás seguro de que deseas desactivar el componente "${confirmDialogComp.name}" (${confirmDialogComp.code})? Ya no estará disponible para nuevos productos ni órdenes.`}
          onConfirm={() => handleExecuteToggle(confirmDialogComp, false)}
          onCancel={() => setConfirmDialogComp(null)}
        />
      )}
    </>
  );
};
