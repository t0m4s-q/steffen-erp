'use client';

import React, { useState } from 'react';
import { X, Save, AlertCircle, Lock } from 'lucide-react';
import { updateFinalProductMetadataAction } from '@/actions/product.actions';
import type { FinalProductDTO } from '@/actions/product.dto';

interface EditProductModalProps {
  isOpen: boolean;
  product: FinalProductDTO;
  onClose: () => void;
  onSuccess: (updatedId: string) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState(product.name);
  const [presentation, setPresentation] = useState(product.presentation);
  const [stockMinimum, setStockMinimum] = useState(String(product.stockMinimum));
  const [active, setActive] = useState(product.active);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const formatArs = (str: string | null | undefined) => {
    if (!str) return '$ 0';
    const num = parseFloat(str);
    if (isNaN(num)) return '$ 0';
    return `$ ${Math.round(num).toLocaleString('es-AR')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del producto no puede quedar vacío.');
      return;
    }

    if (!presentation.trim()) {
      setError('La presentación comercial no puede quedar vacía.');
      return;
    }

    const minStockNum = Number(stockMinimum);
    if (!Number.isInteger(minStockNum) || minStockNum <= 0) {
      setError('El stock mínimo debe ser un número entero mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateFinalProductMetadataAction({
        productId: product.id,
        name: name.trim(),
        presentation: presentation.trim(),
        stockMinimum: minStockNum,
        active,
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Error al actualizar el Producto Final.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.data.productId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al comunicarse con el servidor.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl bg-white border border-[#D9D9D9] rounded-[4px] shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        {/* Encabezado según Figma PRODUCTOS-FINALES.png */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9D9D9]">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-black uppercase">
              FICHA DE PRODUCTO FINAL — {product.code}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Edición de metadatos comerciales y consulta de estructura de costos y BOM.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nota informativa de inmutabilidad normativa */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-[2px] flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#0E50A0] shrink-0" />
          <span>
            Regla de Dominio: El Producto Base (PBA), el peso y la composición de componentes (BOM)
            son <strong>inmutables</strong> después del alta. Los campos editables son Nombre,
            Presentación comercial, Stock mínimo y Estado.
          </span>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-[2px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Metadatos en Ficha: Bloques Editables e Inmutables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-semibold text-black rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Codigo (Inmutable)
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-[#D9D9D9] text-xs font-mono font-bold text-gray-700 rounded-[2px]">
                  {product.code}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Producto Base (Inmutable)
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-[#D9D9D9] text-xs font-medium text-gray-700 rounded-[2px]">
                  {product.baseProductCode} — {product.baseProductName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Peso / Contenido en Granel (Inmutable)
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-[#D9D9D9] text-xs font-mono font-bold text-gray-700 rounded-[2px]">
                  {product.weightKg} kg
                </div>
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Presentacion comercial *
                </label>
                <input
                  type="text"
                  required
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-semibold text-black rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Stock minimo (unidades) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={stockMinimum}
                  onChange={(e) => setStockMinimum(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-mono rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Stock Actual en Inventario (Read-only)
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-[#D9D9D9] text-xs font-mono font-bold text-gray-700 rounded-[2px]">
                  {product.stockCurrent} un
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <label className="block text-xs font-bold text-black uppercase">
                    Estado en el sistema
                  </label>
                  <p className="text-[11px] text-gray-500">
                    {active ? 'Producto activo en catálogo' : 'Producto inactivo'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0E50A0]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Tabla de BOM de Componentes según Figma PRODUCTOS-FINALES.png */}
          <div className="border-t border-[#D9D9D9] pt-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider mb-3">
              COMPOSICIÓN Y ESTRUCTURA DE COSTOS
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D9D9D9] text-black font-bold uppercase text-left">
                    <th className="py-2.5 px-3 w-28">CODIGO</th>
                    <th className="py-2.5 px-3 text-right w-32">CANTIDAD</th>
                    <th className="py-2.5 px-3">COMPONENTE / GRANEL</th>
                    <th className="py-2.5 px-3 text-right w-36">COSTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Fila 1: Producto Base (Granel) */}
                  <tr className="hover:bg-gray-50/50 bg-blue-50/20">
                    <td className="py-2.5 px-3 font-mono font-bold text-black">
                      {product.baseProductCode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-black">
                      {product.weightKg} kg
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-black">
                      {product.baseProductName} <span className="text-gray-500 font-normal">(Granel PBA)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-black">
                      {formatArs(product.cost.baseCostArs)}
                    </td>
                  </tr>

                  {/* Filas de Componentes */}
                  {product.components.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-black">
                        {c.componentCode}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-black">
                        {c.quantityPerUnit} un
                      </td>
                      <td className="py-2.5 px-3 font-medium text-black">
                        {c.componentName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-800">
                        {formatArs(c.lineCostArs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fila de Totales según Figma PRODUCTOS-FINALES.png */}
            <div className="pt-4 mt-2 border-t border-[#D9D9D9] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 font-medium">Subtotal Granel + BOM:</span>
                <span className="font-mono font-bold text-black">
                  {formatArs(product.cost.subtotalArs)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-600 font-medium">Costo Extra Variable (2%):</span>
                <span className="font-mono font-bold text-black">
                  {formatArs(product.cost.extraVariableArs)}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-gray-600 font-medium">Costo Total:</span>
                <span className="font-mono font-bold text-base text-[#0E50A0]">
                  {formatArs(product.cost.totalCostArs)}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 border-t border-[#D9D9D9] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 border border-[#D9D9D9] hover:bg-gray-100 text-black text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0E50A0] text-white hover:bg-blue-800 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
