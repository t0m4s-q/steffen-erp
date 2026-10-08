'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, DollarSign, AlertCircle, Clock } from 'lucide-react';
import { setProductPriceAction } from '@/actions/price-list.actions';
import {
  type PriceListDTO,
  type ProductPriceRowDTO,
  formatExactIntegerArs,
} from '@/actions/price-list.dto';
import { Decimal } from '@/domain/decimal';

interface EditProductPriceModalProps {
  isOpen: boolean;
  priceList: PriceListDTO;
  product: ProductPriceRowDTO;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditProductPriceModal: React.FC<EditProductPriceModalProps> = ({
  isOpen,
  priceList,
  product,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [priceArs, setPriceArs] = useState<string>(product.currentPriceArs || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = priceArs.trim();
    if (!trimmed) {
      setError('Debe ingresar un precio de venta.');
      return;
    }

    let dec: Decimal;
    try {
      dec = new Decimal(trimmed);
    } catch {
      setError('El precio ingresado no es un número válido.');
      return;
    }

    if (dec.lte(0) || !dec.isInteger()) {
      setError('El precio de venta debe ser un número entero mayor a 0 en pesos (sin centavos).');
      return;
    }

    startTransition(async () => {
      const res = await setProductPriceAction({
        priceListId: priceList.id,
        productId: product.productId,
        priceArs: dec.toString(),
      });

      if (!res.success) {
        setError(res.error || 'Error al actualizar el precio.');
        return;
      }

      router.refresh();
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg bg-white border border-[#D9D9D9] rounded-[4px] shadow-2xl p-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9D9D9]">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#0E50A0]" />
            <h2 className="text-lg font-bold tracking-tight text-black uppercase">
              ACTUALIZAR PRECIO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar"
            disabled={isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-[2px] text-xs font-semibold text-[#DD0000] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 border border-[#D9D9D9] rounded-[2px] text-xs">
            <div>
              <span className="block text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                Lista de Precios
              </span>
              <span className="font-bold text-black text-xs">{priceList.name}</span>
            </div>
            <div>
              <span className="block text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                Producto Final
              </span>
              <span className="font-bold text-black text-xs">{product.productCode}</span>
              <span className="block text-gray-600 truncate">{product.productName} ({product.presentation})</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-gray-200 flex justify-between items-center">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                Precio Actual Vigente
              </span>
              <span className="text-xs font-bold text-[#0E50A0]">
                {product.hasPrice ? formatExactIntegerArs(product.currentPriceArs) : 'Sin precio asignado'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Nuevo Precio en Pesos (ARS) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">
                $
              </span>
              <input
                type="number"
                step="1"
                min="1"
                value={priceArs}
                onChange={(e) => setPriceArs(e.target.value)}
                placeholder="Ej. 18500"
                disabled={isPending}
                autoFocus
                className="w-full h-11 pl-8 pr-3 text-sm font-semibold border border-[#D9D9D9] rounded-[2px] focus:outline-none focus:border-[#0E50A0] text-black"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Ingrese un monto entero en pesos, sin decimales ni centavos.
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-[2px] text-xs text-amber-900 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Versionado y Trazabilidad</p>
              <p className="mt-0.5 text-amber-800">
                La versión de precio anterior se cerrará automáticamente y la nueva entrará en vigencia inmediata. Los pedidos de venta ya generados conservan su precio histórico de snapshot.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-[38px] px-4 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-white border border-[#D9D9D9] text-black hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-[38px] px-5 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-[#D2AB68] hover:bg-[#c29b58] text-white border border-[#D2AB68] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Confirmar Precio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
