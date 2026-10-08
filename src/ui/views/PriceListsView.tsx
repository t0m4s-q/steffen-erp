'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Search,
  Plus,
  Edit3,
  History,
  TrendingUp,
  Tag,
  AlertCircle,
  DollarSign,
  CheckSquare,
  Square,
  ShieldCheck,
} from 'lucide-react';
import {
  type PriceListDTO,
  type ProductPriceRowDTO,
  formatExactIntegerArs,
} from '@/actions/price-list.dto';
import { NewPriceListModal } from '../modals/NewPriceListModal';
import { EditPriceListModal } from '../modals/EditPriceListModal';
import { EditProductPriceModal } from '../modals/EditProductPriceModal';
import { BulkPriceIncreaseModal } from '../modals/BulkPriceIncreaseModal';
import { PriceHistoryModal } from '../modals/PriceHistoryModal';

interface PriceListsViewProps {
  priceLists: PriceListDTO[];
  currentListId: string;
  products: ProductPriceRowDTO[];
}

export const PriceListsView: React.FC<PriceListsViewProps> = ({
  priceLists,
  currentListId,
  products,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [onlyWithoutPrice, setOnlyWithoutPrice] = useState(false);

  // Selección de productos para aumento selectivo
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Modales
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isEditListModalOpen, setIsEditListModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'global' | 'selective'>('global');

  const [editingProduct, setEditingProduct] = useState<ProductPriceRowDTO | null>(null);
  const [historyProduct, setHistoryProduct] = useState<ProductPriceRowDTO | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  // Lista actual seleccionada
  const currentList =
    priceLists.find((l) => l.id === currentListId) ||
    priceLists.find((l) => l.systemRole === 'SALON_DEFAULT') ||
    priceLists[0];

  // Cambiar lista activa vía URL
  const handleSelectList = (listId: string) => {
    setSelectedProductIds(new Set());
    startTransition(() => {
      router.push(`/precios?listId=${listId}`);
    });
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!showInactive && !p.productActive) return false;
      if (onlyWithoutPrice && p.hasPrice) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        p.productCode.toLowerCase().includes(term) ||
        p.productName.toLowerCase().includes(term) ||
        p.presentation.toLowerCase().includes(term)
      );
    });
  }, [products, showInactive, onlyWithoutPrice, searchTerm]);

  // Cantidad de productos con precio activo
  const activeProductsWithPrice = useMemo(() => {
    return products.filter((p) => p.productActive && p.hasPrice);
  }, [products]);

  // Selección de checkboxes
  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAllVisibleWithPrice = () => {
    const visibleWithPrice = filteredProducts.filter((p) => p.productActive && p.hasPrice);
    const allSelected = visibleWithPrice.every((p) => selectedProductIds.has(p.productId));

    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleWithPrice.forEach((p) => next.delete(p.productId));
      } else {
        visibleWithPrice.forEach((p) => next.add(p.productId));
      }
      return next;
    });
  };

  const selectedProductsList = useMemo(() => {
    return products.filter((p) => selectedProductIds.has(p.productId));
  }, [products, selectedProductIds]);

  const handleOpenGlobalIncrease = () => {
    setBulkMode('global');
    setIsBulkModalOpen(true);
  };

  const handleOpenSelectiveIncrease = () => {
    if (selectedProductIds.size === 0) return;
    setBulkMode('selective');
    setIsBulkModalOpen(true);
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const visibleWithPrice = filteredProducts.filter((p) => p.productActive && p.hasPrice);
  const isAllVisibleSelected =
    visibleWithPrice.length > 0 && visibleWithPrice.every((p) => selectedProductIds.has(p.productId));

  return (
    <div className="max-w-[1600px] mx-auto pb-16">
      {/* Mensaje de error general si ocurre */}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[2px] text-xs font-semibold text-[#DD0000] flex justify-between items-center">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-gray-400 hover:text-black font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de Encabezado Superior */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-black font-semibold mb-1 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Volver al Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-black uppercase">
              LISTAS DE PRECIOS
            </h1>
            {currentList && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-[#D2AB68]/15 text-[#D2AB68] border border-[#D2AB68]/30">
                {currentList.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewListModalOpen(true)}
            className="h-[38px] px-4 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-[#D2AB68] hover:bg-[#c29b58] text-white border border-[#D2AB68] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Lista</span>
          </button>
        </div>
      </div>

      {/* Selector de Listas de Precios (Tabs / Pills) */}
      <div className="bg-white border border-[#D9D9D9] rounded-[5px] p-4 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Pills de Listas */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">
              Lista:
            </span>
            {priceLists.map((list) => {
              const isSelected = list.id === currentList?.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleSelectList(list.id)}
                  disabled={isPending}
                  className={`h-[36px] px-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'bg-black text-white border-black'
                      : 'bg-gray-50 text-gray-700 border-[#D9D9D9] hover:bg-gray-100 hover:text-black'
                  } ${!list.active ? 'opacity-60 line-through' : ''}`}
                >
                  <Tag className={`w-3.5 h-3.5 ${isSelected ? 'text-[#D2AB68]' : 'text-gray-400'}`} />
                  <span>{list.name}</span>
                  {list.isSystem && (
                    <span
                      title="Lista de sistema protegida"
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {list.systemRole === 'SALON_DEFAULT'
                        ? 'Salón'
                        : list.systemRole === 'PUBLIC_DEFAULT'
                        ? 'Público'
                        : 'Ecommerce'}
                    </span>
                  )}
                  {!list.active && (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-red-100 text-red-700 font-semibold">
                      Inactiva
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Acciones de la Lista Seleccionada */}
          {currentList && (
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsEditListModalOpen(true)}
                className="h-[36px] px-3 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-white border border-[#D9D9D9] text-gray-700 hover:bg-gray-100 hover:text-black inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Renombrar o cambiar estado de la lista"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                <span>Editar Lista</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGlobalIncrease}
                disabled={activeProductsWithPrice.length === 0}
                className="h-[36px] px-3.5 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-[#0E50A0] hover:bg-[#0c4386] text-white border border-[#0E50A0] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Aumentar todos los productos con precio activo en esta lista"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Aumentar Toda la Lista</span>
              </button>

              <button
                type="button"
                onClick={handleOpenSelectiveIncrease}
                disabled={selectedProductIds.size === 0}
                className="h-[36px] px-3.5 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-white border border-[#0E50A0] text-[#0E50A0] hover:bg-blue-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed"
                title="Aumentar solo los productos seleccionados"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Aumentar Seleccionados ({selectedProductIds.size})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenedor Interior de Tabla según DESIGN.md Section 28 */}
      <div className="rounded-[5px] border border-[#D9D9D9] bg-white p-5">
        {/* Encabezado de Tabla: Título, Filtros y Buscador */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-black tracking-tight uppercase">
              PRECIOS POR PRODUCTO FINAL
            </h2>
            <span className="text-xs text-gray-500 font-semibold">
              ({filteredProducts.length} productos)
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtro rápido: Solo sin precio */}
            <button
              type="button"
              onClick={() => setOnlyWithoutPrice(!onlyWithoutPrice)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                onlyWithoutPrice
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>Sin precio ({products.filter((p) => !p.hasPrice).length})</span>
            </button>

            {/* Toggle inactivos */}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-3.5 w-3.5 cursor-pointer"
              />
              <span>Ver inactivos</span>
            </label>

            {/* Input Buscar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-3 pr-8 text-xs border border-[#D9D9D9] rounded-lg w-52 sm:w-64 focus:outline-none focus:border-[#0E50A0] placeholder-gray-400 text-black"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tabla de Productos y Precios */}
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs font-medium">
            No se encontraron productos que coincidan con los filtros de búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px]">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllVisibleWithPrice}
                      title={isAllVisibleSelected ? 'Deseleccionar todos' : 'Seleccionar todos con precio'}
                      className="cursor-pointer text-gray-600 hover:text-black flex items-center justify-center mx-auto"
                    >
                      {isAllVisibleSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#0E50A0]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">CODIGO</th>
                  <th className="py-2.5 px-3">PRODUCTO FINAL</th>
                  <th className="py-2.5 px-3">PRESENTACION</th>
                  <th className="py-2.5 px-3 text-right">PRECIO ACTUAL</th>
                  <th className="py-2.5 px-3 text-center">ULTIMA ACTUALIZACION</th>
                  <th className="py-2.5 px-3 text-center">ESTADO</th>
                  <th className="py-2.5 px-3 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProductIds.has(p.productId);
                  const canSelect = p.productActive && p.hasPrice;

                  return (
                    <tr
                      key={p.productId}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60'
                          : !p.productActive
                          ? 'opacity-60 bg-gray-50 text-gray-600'
                          : 'hover:bg-gray-50 text-black'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => handleToggleSelectProduct(p.productId)}
                          title={!canSelect ? 'Requiere producto activo con precio asignado' : 'Seleccionar para aumento'}
                          className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Código */}
                      <td className="py-2.5 px-3 font-bold text-black whitespace-nowrap">
                        {p.productCode}
                      </td>

                      {/* Nombre */}
                      <td className="py-2.5 px-3 font-semibold text-black">
                        {p.productName}
                      </td>

                      {/* Presentación */}
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                        {p.presentation}
                      </td>

                      {/* Precio Actual */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {p.hasPrice ? (
                          <span className="font-bold text-sm text-black">
                            {formatExactIntegerArs(p.currentPriceArs)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            Sin precio
                          </span>
                        )}
                      </td>

                      {/* Última Actualización */}
                      <td className="py-2.5 px-3 text-center text-gray-600 whitespace-nowrap">
                        {formatDate(p.validFrom)}
                      </td>

                      {/* Estado */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {p.productActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-[#008102] border border-green-300">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="p-1 rounded text-gray-500 hover:text-[#0E50A0] hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Editar Precio"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setHistoryProduct(p)}
                            className="p-1 rounded text-gray-500 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Ver Historial de Versiones"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALES */}
      {/* 1. Nueva Lista */}
      <NewPriceListModal
        isOpen={isNewListModalOpen}
        onClose={() => setIsNewListModalOpen(false)}
        onSuccess={(createdId) => handleSelectList(createdId)}
      />

      {/* 2. Editar Lista Actual */}
      {currentList && (
        <EditPriceListModal
          key={currentList.id}
          isOpen={isEditListModalOpen}
          priceList={currentList}
          onClose={() => setIsEditListModalOpen(false)}
        />
      )}

      {/* 3. Editar Precio Individual de Producto */}
      {currentList && editingProduct && (
        <EditProductPriceModal
          key={`${currentList.id}-${editingProduct.productId}`}
          isOpen={true}
          priceList={currentList}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {/* 4. Aumento Masivo (Global o Selectivo) */}
      {currentList && isBulkModalOpen && (
        <BulkPriceIncreaseModal
          isOpen={isBulkModalOpen}
          priceList={currentList}
          selectedProducts={bulkMode === 'selective' ? selectedProductsList : undefined}
          allActiveCountWithPrice={activeProductsWithPrice.length}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={() => setSelectedProductIds(new Set())}
        />
      )}

      {/* 5. Historial de Precios de Producto */}
      {currentList && historyProduct && (
        <PriceHistoryModal
          key={`${currentList.id}-${historyProduct.productId}`}
          isOpen={true}
          priceList={currentList}
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
};
