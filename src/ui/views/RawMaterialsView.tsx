'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '../components/UIComponents';
import { NewRawMaterialModal } from '../modals/NewRawMaterialModal';
import { EditRawMaterialModal } from '../modals/EditRawMaterialModal';
import { toggleRawMaterialActiveAction } from '@/actions/master-item.actions';
import type { RawMaterialDTO, ComponentDTO, SupplierOptionDTO } from '@/actions/master-item.dto';
import type {
  FinalProductDTO,
  BaseProductOptionDTO,
  ComponentOptionDTO,
} from '@/actions/product.dto';
import { ComponentsView } from './ComponentsView';
import { ProductsView } from './ProductsView';
import { NewProductModal } from '../modals/NewProductModal';
import { StockAdjustmentModal, type StockAdjustableItem } from '../modals/StockAdjustmentModal';
import type { StockMovementDTO } from '@/actions/stock.dto';
import {
  Search,
  Edit3,
  Power,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface RawMaterialsViewProps {
  initialRawMaterials: RawMaterialDTO[];
  initialComponents?: ComponentDTO[];
  initialProducts?: FinalProductDTO[];
  initialMovements?: StockMovementDTO[];
  activeSuppliers: SupplierOptionDTO[];
  activeBaseProducts?: BaseProductOptionDTO[];
  activeComponents?: ComponentOptionDTO[];
  defaultTab?: 'PRO' | 'MPR' | 'COM';
  defaultAction?: string;
}

export const RawMaterialsView: React.FC<RawMaterialsViewProps> = ({
  initialRawMaterials,
  initialComponents = [],
  initialProducts = [],
  initialMovements = [],
  activeSuppliers,
  activeBaseProducts = [],
  activeComponents = [],
  defaultTab = 'PRO',
  defaultAction,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<'PRO' | 'MPR' | 'COM'>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(defaultAction === 'new' && defaultTab === 'PRO');
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<RawMaterialDTO | null>(null);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [preselectedAdjustItemId, setPreselectedAdjustItemId] = useState<string | null>(null);
  const [movementNotice, setMovementNotice] = useState<string | null>(null);

  // Diálogo de confirmación para desactivación
  const [confirmDialogMpr, setConfirmDialogMpr] = useState<RawMaterialDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Lista consolidada de ítems para el modal de ajuste manual de stock (PRO, MPR, COM)
  const adjustableItems: StockAdjustableItem[] = useMemo(() => {
    const list: StockAdjustableItem[] = [];
    for (const p of initialProducts) {
      list.push({
        id: p.id,
        code: p.code,
        name: p.name,
        itemType: 'PRO',
        unitType: 'UNIT',
        currentBalance: p.stockCurrent,
      });
    }
    for (const m of initialRawMaterials) {
      list.push({
        id: m.id,
        code: m.code,
        name: m.name,
        itemType: 'MPR',
        unitType: 'KG',
        currentBalance: m.stockCurrentKg,
      });
    }
    for (const c of initialComponents) {
      list.push({
        id: c.id,
        code: c.code,
        name: c.name,
        itemType: 'COM',
        unitType: 'UNIT',
        currentBalance: c.stockCurrentUnits,
      });
    }
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [initialProducts, initialRawMaterials, initialComponents]);

  // Filtrado en cliente sobre DTOs ya ordenados por ratio en servidor
  const filteredMaterials = initialRawMaterials.filter((m) => {
    if (!showInactive && !m.active) return false;
    if (onlyCritical && !m.isBelowMinimum) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      m.code.toLowerCase().includes(term) ||
      m.name.toLowerCase().includes(term) ||
      (m.inci && m.inci.toLowerCase().includes(term)) ||
      (m.supplierName && m.supplierName.toLowerCase().includes(term)) ||
      (m.supplierCode && m.supplierCode.toLowerCase().includes(term))
    );
  });

  const criticalCount = initialRawMaterials.filter((m) => m.active && m.isBelowMinimum).length;

  const handleToggleActiveClick = (mpr: RawMaterialDTO) => {
    if (mpr.active) {
      setConfirmDialogMpr(mpr);
    } else {
      handleExecuteToggle(mpr, true);
    }
  };

  const handleExecuteToggle = async (mpr: RawMaterialDTO, targetActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const res = await toggleRawMaterialActiveAction(mpr.id, targetActive);
      if (!res.success) {
        setActionError(res.error || 'Error al cambiar estado de la materia prima');
      } else {
        router.refresh();
      }
      setConfirmDialogMpr(null);
    });
  };

  // Precios para columnas de Figma: P.U. USD, P.U $, P.U+ IVA
  const getPriceDisplays = (m: RawMaterialDTO) => {
    if (!m.quotedPriceNet || !m.supplierCurrency) {
      return { usd: '-', ars: '-', grossArs: '-' };
    }
    const num = parseFloat(m.quotedPriceNet) || 0;
    if (m.supplierCurrency === 'USD') {
      const usdStr = `usd ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      return {
        usd: usdStr,
        ars: '-',
        grossArs: '-',
      };
    }

    const netArs = `$ ${Math.round(num).toLocaleString('es-AR')}`;
    const grossArs = `$ ${Math.round(num * 1.21).toLocaleString('es-AR')}`;
    return {
      usd: '-',
      ars: netArs,
      grossArs,
    };
  };

  return (
    <div className="space-y-6">

      {/* Tarjeta Principal de Stock según Figma: SOLAPA-MATERIA-Y-COMPONENTES.png */}
      <div className="bg-white rounded-[5px] border border-[#D9D9D9] p-6">
        
        {/* Barra Superior de Subpestañas y Botón Nuevo */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Subpestañas idénticas a Figma */}
          <div className="flex items-center gap-3">
            {/* Solapa Productos */}
            <button
              type="button"
              onClick={() => setActiveTab('PRO')}
              className={
                activeTab === 'PRO'
                  ? 'border-2 border-[#0E50A0] text-[#0E50A0] bg-white rounded-lg px-4 py-1.5 font-bold text-xs uppercase flex items-center gap-1.5 cursor-default'
                  : 'text-[#0E50A0] font-semibold text-xs uppercase px-3 py-1.5 flex items-center gap-1 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer'
              }
            >
              <span>Productos</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Solapa Materia Prima */}
            <button
              type="button"
              onClick={() => setActiveTab('MPR')}
              className={
                activeTab === 'MPR'
                  ? 'border-2 border-[#0E50A0] text-[#0E50A0] bg-white rounded-lg px-4 py-1.5 font-bold text-xs uppercase flex items-center gap-1.5 cursor-default'
                  : 'text-[#0E50A0] font-semibold text-xs uppercase px-3 py-1.5 flex items-center gap-1 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer'
              }
            >
              <span>Materia Prima</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Solapa Componentes */}
            <button
              type="button"
              onClick={() => setActiveTab('COM')}
              className={
                activeTab === 'COM'
                  ? 'border-2 border-[#0E50A0] text-[#0E50A0] bg-white rounded-lg px-4 py-1.5 font-bold text-xs uppercase flex items-center gap-1.5 cursor-default'
                  : 'text-[#0E50A0] font-semibold text-xs uppercase px-3 py-1.5 flex items-center gap-1 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer'
              }
            >
              <span>Componentes</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botones a la derecha: Refrescar y Nuevo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  router.refresh();
                });
              }}
              disabled={isPending}
              title="Refrescar datos del servidor"
              className="p-2 border border-[#D9D9D9] rounded-[2px] text-gray-600 hover:text-black hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            </button>

            <Button
              variant="secundario"
              onClick={() => {
                setPreselectedAdjustItemId(null);
                setAdjustmentModalOpen(true);
              }}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
            >
              AJUSTE DE STOCK
            </Button>

            {activeTab === 'PRO' ? (
              <Button
                variant="azul"
                onClick={() => setCreateProductOpen(true)}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                NUEVO PRODUCTO
              </Button>
            ) : (
              <Button
                variant="azul"
                onClick={() => setCreateOpen(true)}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                NUEVA MATERIA PRIMA/COMPONENTE
              </Button>
            )}
          </div>

        </div>

        {movementNotice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-[2px] text-xs font-semibold text-emerald-800 flex justify-between items-center">
            <span>{movementNotice}</span>
            <button onClick={() => setMovementNotice(null)} className="text-gray-400 hover:text-black font-bold">
              ✕
            </button>
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-[2px] text-xs font-semibold text-[#DD0000] flex justify-between items-center">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-gray-400 hover:text-black font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Contenido según pestaña activa */}
        {activeTab === 'PRO' ? (
          <ProductsView
            products={initialProducts}
            baseProducts={activeBaseProducts}
            components={activeComponents}
          />
        ) : activeTab === 'COM' ? (
          <ComponentsView
            components={initialComponents}
            activeSuppliers={activeSuppliers}
          />
        ) : (
          /* Contenedor Interior de Tabla idéntico a Figma */
          <div className="rounded-[5px] border border-[#D9D9D9] p-5 mt-5">
            
            {/* Encabezado: Título a la izquierda, Buscador y Filtros a la derecha */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-black pb-2 mb-4">
              <h2 className="text-xl font-bold text-black tracking-tight">
                Listado de materia prima
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

            {/* Tabla de Materia Prima con columnas exactas de Figma SOLAPA-MATERIA-Y-COMPONENTES.png */}
            {filteredMaterials.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs font-medium">
                No hay materias primas registradas para los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-left">CODIGO</th>
                      <th className="py-2.5 px-3 text-left">PROVEEDOR</th>
                      <th className="py-2.5 px-3 text-left">MATERIA PRIMA</th>
                      <th className="py-2.5 px-3 text-left">INCI</th>
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
                    {filteredMaterials.map((m) => {
                      const prices = getPriceDisplays(m);
                      // Regla Figma: Si está bajo mínimo, fila completa en color salmón/rojo claro (#FFA8A8)
                      const isRowCritical = m.isBelowMinimum;

                      return (
                        <tr
                          key={m.id}
                          className={`transition-colors ${
                            isRowCritical
                              ? 'bg-[#FFA8A8] text-black font-medium'
                              : !m.active
                              ? 'opacity-60 bg-gray-50 text-gray-600'
                              : 'hover:bg-gray-50 text-black'
                          }`}
                        >
                          {/* Código */}
                          <td className="py-3 px-3 font-bold font-mono">
                            {m.code}
                          </td>

                          {/* Proveedor */}
                          <td className="py-3 px-3 font-semibold">
                            {m.supplierName || '-'}
                          </td>

                          {/* Nombre Materia Prima */}
                          <td className="py-3 px-3 font-medium">
                            {m.name}
                          </td>

                          {/* INCI */}
                          <td className="py-3 px-3 italic text-gray-700">
                            {m.inci || '-'}
                          </td>

                          {/* Última Compra */}
                          <td className="py-3 px-3 text-gray-700">
                            -
                          </td>

                          {/* Última Act Precio */}
                          <td className="py-3 px-3 text-gray-700">
                            {m.priceUpdatedAt
                              ? new Date(m.priceUpdatedAt).toLocaleDateString('es-AR')
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

                          {/* Stock Actual */}
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            {m.stockCurrentKg} kg
                          </td>

                          {/* Stock Mínimo */}
                          <td className="py-3 px-3 text-right font-mono text-gray-700">
                            {m.stockMinimumKg} kg
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-3 text-center whitespace-nowrap space-x-1">
                            <button
                              onClick={() => setSelectedRawMaterial(m)}
                              title="Editar Ficha / Cotización"
                              className="p-1 rounded hover:bg-black/10 text-[#0E50A0] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActiveClick(m)}
                              title={m.active ? 'Desactivar insumo' : 'Activar insumo'}
                              className={`p-1 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                                m.active ? 'text-gray-500 hover:text-red-700' : 'text-[#008102]'
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
        )}

      </div>

      {/* Tarjeta Inferior de Movimientos de Stock según Figma: STOCK.png */}
      <div className="bg-white rounded-[5px] border border-[#D9D9D9] p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-black tracking-tight">
            Movimientos de stock
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            Últimos {initialMovements.length} movimientos (MST)
          </span>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#D9D9D9] z-10">
              <tr className="text-black font-bold text-left uppercase text-[11px]">
                <th className="py-2.5 px-3">CODIGO</th>
                <th className="py-2.5 px-3">FECHA</th>
                <th className="py-2.5 px-3">TIPO</th>
                <th className="py-2.5 px-3">REGISTRO</th>
                <th className="py-2.5 px-3">DESCRIPCION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {initialMovements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 font-medium text-xs">
                    No hay movimientos de stock registrados en el sistema.
                  </td>
                </tr>
              ) : (
                initialMovements.map((m) => {
                  const isPositive = m.quantityDeltaFormatted.startsWith('+');
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 text-black">
                      <td className="py-2.5 px-3 font-bold font-mono text-[11px]">
                        {m.code}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-700 whitespace-nowrap">
                        {m.businessDate || m.createdAt.slice(0, 10)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-[2px] font-bold text-[10px] uppercase ${
                            m.movementType === 'AJUSTE'
                              ? 'bg-amber-100 text-amber-800'
                              : m.movementType === 'FABRICACIÓN' || m.movementType === 'ENVASADO'
                              ? 'bg-blue-100 text-[#0E50A0]'
                              : m.movementType === 'VENTA'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <span className="font-semibold text-black">
                          [{m.itemCode}] {m.itemName}
                        </span>
                        <span
                          className={`ml-2 font-mono font-bold whitespace-nowrap ${
                            isPositive ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {m.quantityDeltaFormatted}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-600">
                        {m.description}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Alta */}
      <NewRawMaterialModal
        isOpen={createOpen}
        activeSuppliers={activeSuppliers}
        initialType={activeTab === 'COM' ? 'COM' : 'MPR'}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Modal de Edición */}
      <EditRawMaterialModal
        isOpen={Boolean(selectedRawMaterial)}
        rawMaterial={selectedRawMaterial}
        activeSuppliers={activeSuppliers}
        onClose={() => setSelectedRawMaterial(null)}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Modal de Alta de Producto Final */}
      {createProductOpen && (
        <NewProductModal
          isOpen={createProductOpen}
          baseProducts={activeBaseProducts}
          components={activeComponents}
          onClose={() => setCreateProductOpen(false)}
          onSuccess={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Modal de Ajuste Manual de Stock */}
      <StockAdjustmentModal
        isOpen={adjustmentModalOpen}
        items={adjustableItems}
        preselectedItemId={preselectedAdjustItemId}
        onClose={() => setAdjustmentModalOpen(false)}
        onSuccess={(res) => {
          setMovementNotice(`Ajuste ${res.movementCode} registrado con éxito.`);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* ConfirmDialog para Desactivación */}
      {confirmDialogMpr && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Materia Prima"
          message={`¿Estás seguro de que deseas desactivar la materia prima "${confirmDialogMpr.name}" (${confirmDialogMpr.code})? Ya no estará disponible para nuevas formulaciones ni órdenes de producción.`}
          onConfirm={() => handleExecuteToggle(confirmDialogMpr, false)}
          onCancel={() => setConfirmDialogMpr(null)}
        />
      )}

    </div>
  );
};
