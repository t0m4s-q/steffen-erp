'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { X, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { adjustStockAction } from '@/actions/stock.actions';
import { Decimal } from '@/domain/decimal';

export interface StockAdjustableItem {
  id: string;
  code: string;
  name: string;
  itemType: 'MPR' | 'COM' | 'PRO';
  unitType: 'KG' | 'UNIT';
  currentBalance: string | number;
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  items: StockAdjustableItem[];
  preselectedItemId?: string | null;
  onClose: () => void;
  onSuccess: (result: { movementCode: string; newBalance: string }) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  items,
  preselectedItemId,
  onClose,
  onSuccess,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(
    preselectedItemId || (items.length > 0 ? items[0].id : '')
  );
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset or initialize on open / preselectedItemId change
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedItemId) {
        setSelectedItemId(preselectedItemId);
      } else if (!selectedItemId && items.length > 0) {
        setSelectedItemId(items[0].id);
      }
      setQuantityInput('');
      setReason('');
      setError(null);
    }
  }, [isOpen, preselectedItemId, items]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const currentBalDecimal = useMemo(() => {
    if (!selectedItem) return new Decimal(0);
    try {
      return new Decimal(selectedItem.currentBalance);
    } catch {
      return new Decimal(0);
    }
  }, [selectedItem]);

  const deltaDecimal = useMemo(() => {
    if (!quantityInput.trim()) return null;
    try {
      const val = new Decimal(quantityInput);
      if (val.isZero() || val.isNegative()) return null;
      return direction === 'IN' ? val : val.negated();
    } catch {
      return null;
    }
  }, [quantityInput, direction]);

  const resultingBalDecimal = useMemo(() => {
    if (deltaDecimal === null) return currentBalDecimal;
    return currentBalDecimal.plus(deltaDecimal);
  }, [currentBalDecimal, deltaDecimal]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItem) {
      setError('Debe seleccionar un ítem para ajustar.');
      return;
    }

    if (!quantityInput.trim()) {
      setError('La cantidad a ajustar es obligatoria.');
      return;
    }

    let qtyVal: Decimal;
    try {
      qtyVal = new Decimal(quantityInput);
      if (qtyVal.isZero() || qtyVal.isNegative()) {
        setError('La cantidad debe ser estrictamente mayor a 0.');
        return;
      }
    } catch {
      setError('La cantidad ingresada no es un número válido.');
      return;
    }

    // Validar precisión según unidad
    if (selectedItem.unitType === 'UNIT') {
      if (!qtyVal.isInteger()) {
        setError(`El ítem ${selectedItem.code} se gestiona por unidades y exige cantidades enteras.`);
        return;
      }
    } else if (selectedItem.unitType === 'KG') {
      if (qtyVal.decimalPlaces() > 3) {
        setError('El ítem en kg admite como máximo 3 decimales de precisión (0.001 kg).');
        return;
      }
    }

    if (!reason.trim()) {
      setError('El motivo del ajuste es obligatorio según normativa.');
      return;
    }

    if (direction === 'OUT' && resultingBalDecimal.lt(0)) {
      setError('Stock insuficiente. El saldo resultante no puede ser negativo.');
      return;
    }

    const finalDelta = direction === 'IN' ? qtyVal : qtyVal.negated();

    startTransition(async () => {
      const res = await adjustStockAction({
        stockItemId: selectedItem.id,
        quantityDelta: finalDelta.toString(),
        reason: reason.trim(),
        businessDate: businessDate || undefined,
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Error al registrar el ajuste de stock.');
        return;
      }

      onSuccess({
        movementCode: res.data.movementCode,
        newBalance: res.data.newBalance,
      });
      onClose();
    });
  };

/**
 * Formateador de saldos client-safe basado exclusivamente en Decimal/string.
 * Evita conversiones mediante Number() o punto flotante que introducen imprecisiones.
 */
function formatStockQuantity(value: Decimal | string | number, unitType?: 'KG' | 'UNIT'): string {
  let dec: Decimal;
  try {
    dec = value instanceof Decimal ? value : new Decimal(String(value));
  } catch {
    return '0';
  }

  const isNeg = dec.isNegative();
  const absDec = dec.abs();

  if (unitType === 'UNIT') {
    const intPart = absDec.truncated().toString();
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNeg ? '-' : ''}${formattedInt} un`;
  }

  const str = absDec.toFixed(3);
  const [rawInt, rawDec] = str.split('.');
  const formattedInt = rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmedDec = (rawDec || '').replace(/0+$/, '');

  if (!trimmedDec) {
    return `${isNeg ? '-' : ''}${formattedInt} kg`;
  }
  return `${isNeg ? '-' : ''}${formattedInt},${trimmedDec} kg`;
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg bg-white border border-[#D9D9D9] rounded-[5px] p-6 max-h-[92vh] overflow-y-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D9D9D9]">
          <div>
            <h2 className="text-base font-bold text-black uppercase tracking-tight">
              AJUSTE MANUAL DE STOCK
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Genera movimiento trazable (MST) y actualiza el saldo de inventario.
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

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-[2px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#DD0000] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Selector de Ítem */}
          <div>
            <label className="block text-xs font-bold text-black uppercase mb-1">
              Ítem a ajustar *
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-semibold text-black rounded-[2px] bg-white focus:outline-none focus:border-[#0E50A0]"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.code}] {item.name} ({item.itemType}) — Saldo:{' '}
                  {formatStockQuantity(item.currentBalance, item.unitType)}
                </option>
              ))}
            </select>
          </div>

          {/* Dirección del Ajuste: Entrada o Salida */}
          <div>
            <label className="block text-xs font-bold text-black uppercase mb-1">
              Tipo de Ajuste *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('IN')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-[2px] border transition-colors cursor-pointer ${
                  direction === 'IN'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-white border-[#D9D9D9] text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                ENTRADA (+ sumar)
              </button>
              <button
                type="button"
                onClick={() => setDirection('OUT')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-[2px] border transition-colors cursor-pointer ${
                  direction === 'OUT'
                    ? 'bg-rose-50 border-rose-500 text-rose-800'
                    : 'bg-white border-[#D9D9D9] text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                SALIDA (- restar)
              </button>
            </div>
          </div>

          {/* Cantidad y Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-black uppercase mb-1">
                Cantidad a {direction === 'IN' ? 'sumar' : 'restar'} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  step={selectedItem?.unitType === 'KG' ? '0.001' : '1'}
                  min={selectedItem?.unitType === 'KG' ? '0.001' : '1'}
                  placeholder={selectedItem?.unitType === 'KG' ? 'Ej: 5.250' : 'Ej: 10'}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-bold text-black rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-gray-400 uppercase pointer-events-none">
                  {selectedItem?.unitType === 'KG' ? 'kg' : 'un'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black uppercase mb-1">
                Fecha Operativa
              </label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-semibold text-black rounded-[2px] bg-white focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

          {/* Cuadro Resumen de Impacto en Saldo */}
          {selectedItem && (
            <div className="p-3 bg-gray-50 border border-[#D9D9D9] rounded-[2px] text-xs space-y-1.5">
              <div className="flex justify-between items-center text-gray-600">
                <span>Saldo actual registrado:</span>
                <span className="font-mono font-bold text-black">
                  {formatStockQuantity(currentBalDecimal, selectedItem.unitType)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Ajuste a aplicar:</span>
                <span
                  className={`font-mono font-bold ${
                    direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {deltaDecimal !== null
                    ? `${direction === 'IN' ? '+' : ''}${formatStockQuantity(
                        deltaDecimal,
                        selectedItem.unitType
                      )}`
                    : '—'}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center font-bold">
                <span className="text-black">Nuevo saldo resultante:</span>
                <span
                  className={`font-mono text-sm ${
                    direction === 'OUT' && resultingBalDecimal.lt(0) ? 'text-[#DD0000]' : 'text-black'
                  }`}
                >
                  {formatStockQuantity(resultingBalDecimal, selectedItem.unitType)}
                  {direction === 'OUT' && resultingBalDecimal.lt(0) && (
                    <span className="text-[10px] text-[#DD0000] ml-1.5 uppercase font-bold">
                      (STOCK INSUFICIENTE)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Motivo Obligatorio */}
          <div>
            <label className="block text-xs font-bold text-black uppercase mb-1">
              Motivo / Observación del Ajuste *
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Conteo físico mensual, rotura de envase, calibración de balanza..."
              className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-medium text-black rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-3 border-t border-[#D9D9D9] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 border border-[#D9D9D9] text-xs font-bold text-black rounded-[2px] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || (direction === 'OUT' && resultingBalDecimal.lt(0))}
              className={`px-5 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer disabled:opacity-50 ${
                direction === 'OUT' && resultingBalDecimal.lt(0)
                  ? 'bg-[#DD0000] cursor-not-allowed'
                  : 'bg-black hover:bg-neutral-800'
              }`}
            >
              {isPending
                ? 'Registrando...'
                : direction === 'OUT' && resultingBalDecimal.lt(0)
                ? 'STOCK INSUFICIENTE'
                : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
