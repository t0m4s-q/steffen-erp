'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Edit3, Power, AlertTriangle } from 'lucide-react';
import { toggleFinalProductActiveAction } from '@/actions/product.actions';
import type {
  FinalProductDTO,
  BaseProductOptionDTO,
  ComponentOptionDTO,
} from '@/actions/product.dto';
import { EditProductModal } from '../modals/EditProductModal';
import { ConfirmDialog } from '../components/UIComponents';

interface ProductsViewProps {
  products: FinalProductDTO[];
  baseProducts: BaseProductOptionDTO[];
  components: ComponentOptionDTO[];
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
}) => {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);

  // Modales
  const [selectedProduct, setSelectedProduct] = useState<FinalProductDTO | null>(null);
  const [confirmDialogProduct, setConfirmDialogProduct] = useState<FinalProductDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtrado en cliente sobre DTOs ya ordenados por ratio en servidor
  const filteredProducts = products.filter((p) => {
    if (!showInactive && !p.active) return false;
    if (onlyCritical && !p.isBelowMinimum) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      p.code.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.presentation.toLowerCase().includes(term) ||
      p.baseProductName.toLowerCase().includes(term) ||
      p.baseProductCode.toLowerCase().includes(term)
    );
  });

  const criticalCount = products.filter((p) => p.active && p.isBelowMinimum).length;

  const handleToggleActiveClick = (prod: FinalProductDTO) => {
    if (prod.active) {
      setConfirmDialogProduct(prod);
    } else {
      handleExecuteToggle(prod, true);
    }
  };

  const handleExecuteToggle = async (prod: FinalProductDTO, targetActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const res = await toggleFinalProductActiveAction(prod.id, targetActive);
      if (!res.success) {
        setActionError(res.error || 'Error al cambiar estado del Producto Final');
      } else {
        router.refresh();
      }
      setConfirmDialogProduct(null);
    });
  };

  const formatArs = (str: string | null | undefined) => {
    if (!str) return '$ 0';
    const num = parseFloat(str);
    if (isNaN(num)) return '$ 0';
    return `$ ${Math.round(num).toLocaleString('es-AR')}`;
  };

  return (
    <>
      {actionError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-[2px] text-xs font-semibold text-[#DD0000] flex justify-between items-center">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-gray-400 hover:text-black font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Contenedor Interior de Tabla idéntico a Figma STOCK.png */}
      <div className="rounded-xl border border-[#D9D9D9] p-5 mt-5">
        {/* Encabezado: Título a la izquierda, Buscador y Filtros a la derecha */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-black pb-2 mb-4">
          <h2 className="text-xl font-bold text-black tracking-tight">
            Listado de productos
          </h2>

          <div className="flex items-center gap-4">
            {/* Filtro rápido bajo mínimo */}
            <button
              type="button"
              onClick={() => setOnlyCritical(!onlyCritical)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
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

        {/* Tabla de Productos con columnas según Figma STOCK.png y Section 23 */}
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs font-medium">
            No hay productos registrados para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black text-black font-bold text-left uppercase">
                  <th className="py-2.5 px-3">CODIGO</th>
                  <th className="py-2.5 px-3">PRODUCTO FINAL</th>
                  <th className="py-2.5 px-3">PRESENTACION</th>
                  <th className="py-2.5 px-3">PRODUCTO BASE (PBA)</th>
                  <th className="py-2.5 px-3 text-right">STOCK ACTUAL</th>
                  <th className="py-2.5 px-3 text-right">STOCK MINIMO</th>
                  <th className="py-2.5 px-3 text-right">COSTO TOTAL</th>
                  <th className="py-2.5 px-3 text-center">ESTADO</th>
                  <th className="py-2.5 px-3 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredProducts.map((p) => {
                  // Regla Figma STOCK.png: Si actual < mínimo, fila completa en salmón (#FFA8A8)
                  const isRowCritical = p.isBelowMinimum;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isRowCritical
                          ? 'bg-[#FFA8A8] text-black font-medium'
                          : !p.active
                          ? 'opacity-60 bg-gray-50 text-gray-600'
                          : 'hover:bg-gray-50 text-black'
                      }`}
                    >
                      {/* Código */}
                      <td className="py-3 px-3 font-bold font-mono">
                        {p.code}
                      </td>

                      {/* Producto Final */}
                      <td className="py-3 px-3 font-semibold">
                        {p.name}
                      </td>

                      {/* Presentación */}
                      <td className="py-3 px-3 font-medium text-gray-800">
                        {p.presentation}
                      </td>

                      {/* PBA */}
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-700">
                        {p.baseProductCode} • {p.baseProductName}
                      </td>

                      {/* Stock Actual */}
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {p.stockCurrent} un
                      </td>

                      {/* Stock Mínimo */}
                      <td className="py-3 px-3 text-right font-mono text-gray-700">
                        {p.stockMinimum} un
                      </td>

                      {/* Costo Teórico Total */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#0E50A0]">
                        {formatArs(p.cost.totalCostArs)}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-[2px] ${
                            p.active
                              ? 'bg-green-100 text-[#008102]'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {p.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(p)}
                            title="Ver ficha y editar producto"
                            className="p-1 text-gray-500 hover:text-[#0E50A0] rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActiveClick(p)}
                            title={p.active ? 'Desactivar producto' : 'Activar producto'}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              p.active
                                ? 'text-gray-400 hover:text-red-600'
                                : 'text-[#008102] hover:text-green-700'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
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

      {/* Modal Ficha y Edición */}
      {selectedProduct && (
        <EditProductModal
          key={selectedProduct.id}
          isOpen={true}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSuccess={() => {
            setSelectedProduct(null);
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Confirmación para Desactivación */}
      {confirmDialogProduct && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Producto Final"
          message={`¿Estás seguro de que deseas desactivar "${confirmDialogProduct.name}" (${confirmDialogProduct.code})? Ya no se podrá seleccionar para nuevos pedidos.`}
          onConfirm={() => handleExecuteToggle(confirmDialogProduct, false)}
          onCancel={() => setConfirmDialogProduct(null)}
        />
      )}
    </>
  );
};
