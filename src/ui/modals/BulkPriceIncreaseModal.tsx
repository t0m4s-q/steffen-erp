'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, TrendingUp, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { applyBulkPriceIncreaseAction } from '@/actions/price-list.actions';
import {
  type PriceListDTO,
  type ProductPriceRowDTO,
  formatExactIntegerArs,
} from '@/actions/price-list.dto';
import { Decimal, toWholePesos, toNumericString } from '@/domain/decimal';

interface BulkPriceIncreaseModalProps {
  isOpen: boolean;
  priceList: PriceListDTO;
  selectedProducts?: ProductPriceRowDTO[];
  allActiveCountWithPrice: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkPriceIncreaseModal: React.FC<BulkPriceIncreaseModalProps> = ({
  isOpen,
  priceList,
  selectedProducts,
  allActiveCountWithPrice,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isSelective = Boolean(selectedProducts && selectedProducts.length > 0);
  const targetProducts = isSelective ? selectedProducts! : [];
  const countToUpdate = isSelective ? targetProducts.length : allActiveCountWithPrice;

  const [percentage, setPercentage] = useState<string>('');
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  let pctDecimal: Decimal | null = null;
  try {
    const trimmedPct = percentage.trim();
    if (trimmedPct) {
      const d = new Decimal(trimmedPct);
      if (d.gt(0)) {
        pctDecimal = d;
      }
    }
  } catch {
    pctDecimal = null;
  }
  const isPctValid = pctDecimal !== null;

  const calculatePreview = (currentPriceStr: string | null): string | null => {
    if (!currentPriceStr || !pctDecimal) return null;
    try {
      const curr = new Decimal(currentPriceStr);
      const factor = new Decimal(1).plus(pctDecimal.dividedBy(100));
      const raw = curr.times(factor);
      const rounded = toWholePesos(raw);
      return toNumericString(rounded);
    } catch {
      return null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPctValid || !pctDecimal) {
      setError('El porcentaje de aumento debe ser un número estrictamente mayor a 0.');
      return;
    }

    if (!confirmUnderstood) {
      setError('Debe marcar la casilla de confirmación para proceder con el aumento.');
      return;
    }

    if (countToUpdate === 0) {
      setError('No hay productos con precio vigente para aumentar en esta lista.');
      return;
    }

    startTransition(async () => {
      const res = await applyBulkPriceIncreaseAction({
        priceListId: priceList.id,
        percentage: pctDecimal!.toString(),
        productIds: isSelective ? targetProducts.map((p) => p.productId) : undefined,
      });

      if (!res.success) {
        setError(res.error || 'Error al aplicar el aumento masivo.');
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
      <div className="relative w-full max-w-2xl bg-white border border-[#D9D9D9] rounded-[4px] shadow-2xl p-6 max-h-[92vh] flex flex-col">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9D9D9] shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0E50A0]" />
            <h2 className="text-lg font-bold tracking-tight text-black uppercase">
              {isSelective
                ? `AUMENTO SELECTIVO — ${countToUpdate} PRODUCTOS`
                : `AUMENTO GLOBAL — LISTA ${priceList.name}`}
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
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-[2px] text-xs font-semibold text-[#DD0000] flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto pr-1 space-y-4 flex-1">
            {/* Resumen */}
            <div className="p-3 bg-gray-50 border border-[#D9D9D9] rounded-[2px] text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  Lista de Precios
                </span>
                <span className="font-bold text-black">{priceList.name}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  Alcance del Aumento
                </span>
                <span className="font-bold text-[#0E50A0]">
                  {isSelective
                    ? `Selección manual (${countToUpdate} productos)`
                    : `Toda la lista (${countToUpdate} productos con precio activo)`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  Redondeo Aplicado
                </span>
                <span className="font-medium text-gray-700">
                  Al peso entero más cercano (sin centavos)
                </span>
              </div>
            </div>

            {/* Input Porcentaje */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Porcentaje de Aumento (%) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="Ej. 12.5"
                  disabled={isPending}
                  autoFocus
                  className="w-full h-11 pl-4 pr-10 text-base font-bold border border-[#D9D9D9] rounded-[2px] focus:outline-none focus:border-[#0E50A0] text-black"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base pointer-events-none">
                  %
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Se recalcularán los precios vigentes sumando este porcentaje y redondeando simétricamente al peso entero.
              </p>
            </div>

            {/* Previsualización en modo selectivo */}
            {isSelective && targetProducts.length > 0 && (
              <div>
                <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Vista Previa de Productos Afectados ({targetProducts.length})
                </span>
                <div className="max-h-48 overflow-y-auto border border-[#D9D9D9] rounded-[2px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-left border-b border-[#D9D9D9]">
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3 text-right">Precio Actual</th>
                        <th className="py-2 px-3 text-right">Nuevo Precio (Est.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {targetProducts.map((p) => {
                        const preview = calculatePreview(p.currentPriceArs);
                        return (
                          <tr key={p.productId} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-semibold text-black">{p.productCode}</td>
                            <td className="py-2 px-3 text-gray-700 truncate max-w-[200px]">
                              {p.productName} ({p.presentation})
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-gray-600">
                              {formatExactIntegerArs(p.currentPriceArs)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-[#008102]">
                              {preview ? formatExactIntegerArs(preview) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Advertencia Transaccional */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[2px] text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Operación Atómica Masiva</p>
                <p className="mt-0.5 text-amber-800">
                  Esta operación cierra las versiones vigentes actuales e inserta una nueva versión de precio para cada uno de los {countToUpdate} productos en una sola transacción atómica.
                </p>
              </div>
            </div>

            {/* Casilla de confirmación obligatoria */}
            <label className="flex items-start gap-2 pt-1 text-xs font-semibold text-gray-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmUnderstood}
                onChange={(e) => setConfirmUnderstood(e.target.checked)}
                disabled={isPending}
                className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-4 w-4 mt-0.5 cursor-pointer"
              />
              <span>
                Confirmo que deseo aplicar este aumento de {isPctValid && pctDecimal ? `${pctDecimal.toString()}%` : '...%'} a {countToUpdate} productos en la lista {priceList.name}.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D9D9D9] mt-4 shrink-0">
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
              disabled={isPending || !isPctValid || !confirmUnderstood || countToUpdate === 0}
              className="h-[38px] px-5 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-[#0E50A0] hover:bg-[#0c4386] text-white border border-[#0E50A0] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Aplicando aumento...' : 'Aplicar Aumento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
