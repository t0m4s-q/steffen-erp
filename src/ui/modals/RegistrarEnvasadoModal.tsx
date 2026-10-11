'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import {
  getPackagingPreviewAction,
  packageProductAction,
} from '@/actions/factory.actions';
import type { BulkLotDTO, PackagingPreviewDTO } from '@/actions/factory.dto';

export interface PackagingProductOption {
  productId: string;
  code: string;
  name: string;
  baseProductId: string;
  presentation: string;
  weightKg: string;
}

interface RegistrarEnvasadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bulkLots: BulkLotDTO[];
  products: PackagingProductOption[];
}

export const RegistrarEnvasadoModal: React.FC<RegistrarEnvasadoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bulkLots,
  products,
}) => {
  // 1. Estados de formulario
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [unitsPackaged, setUnitsPackaged] = useState<string>('10');
  const [observations, setObservations] = useState<string>('');
  const [isLastOfLot, setIsLastOfLot] = useState<boolean>(false);
  const [businessDate, setBusinessDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 2. Estados de previsualización y transición
  const [preview, setPreview] = useState<PackagingPreviewDTO | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Inicializar o resetear selección al abrir el modal
  useEffect(() => {
    if (isOpen) {
      if (bulkLots.length > 0 && !selectedLotId) {
        setSelectedLotId(bulkLots[0].id);
      }
      setSubmitError(null);
    }
  }, [isOpen, bulkLots, selectedLotId]);

  const selectedLot = bulkLots.find((l) => l.id === selectedLotId) || bulkLots[0] || null;

  // Filtrar productos compatibles con el producto base del lote seleccionado
  const compatibleProducts = React.useMemo(() => {
    if (!selectedLot) return [];
    return products.filter((p) => p.baseProductId === selectedLot.baseProductId);
  }, [products, selectedLot]);

  // Actualizar producto seleccionado cuando cambia el lote
  useEffect(() => {
    if (compatibleProducts.length > 0) {
      const isCurrentCompatible = compatibleProducts.some((p) => p.productId === selectedProductId);
      if (!isCurrentCompatible) {
        setSelectedProductId(compatibleProducts[0].productId);
      }
    } else {
      setSelectedProductId('');
    }
  }, [compatibleProducts, selectedProductId]);

  // Efecto debounced para cargar el preview autoritativo
  useEffect(() => {
    if (!isOpen || !selectedLotId || !selectedProductId) {
      setPreview(null);
      return;
    }

    const trimmedUnits = unitsPackaged.trim();
    const num = parseInt(trimmedUnits, 10);
    if (!trimmedUnits || isNaN(num) || num <= 0) {
      setPreview(null);
      return;
    }

    let isMounted = true;
    setPreviewLoading(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      const res = await getPackagingPreviewAction(
        selectedLotId,
        selectedProductId,
        trimmedUnits,
        isLastOfLot
      );
      if (!isMounted) return;

      setPreviewLoading(false);
      if (res.success && res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setPreviewError(res.error || 'Error calculando requerimientos de envasado');
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, selectedLotId, selectedProductId, unitsPackaged, isLastOfLot]);

  if (!isOpen) return null;

  const canSubmit =
    !isPending &&
    !previewLoading &&
    preview !== null &&
    preview.canPackage &&
    parseInt(unitsPackaged, 10) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !preview) return;

    setSubmitError(null);
    startTransition(async () => {
      const res = await packageProductAction({
        bulkLotId: selectedLotId,
        productId: selectedProductId,
        unitsPackaged: unitsPackaged.trim(),
        isLastOfLot,
        businessDate: businessDate.trim() || undefined,
        observations: observations.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(res.error || 'Error al registrar envasado.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white border border-[#D9D9D9] rounded-[5px] w-full max-w-xl max-h-[92vh] flex flex-col justify-between overflow-hidden shadow-none animate-in fade-in zoom-in-95 duration-100">
        {/* Cabecera del modal */}
        <div className="px-6 py-4 border-b border-[#D9D9D9] flex justify-between items-center bg-white">
          <h2 className="text-lg font-bold text-black uppercase tracking-wider">
            Envasado
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {submitError && (
            <div className="p-3 bg-[#FFA8A8] border border-[#DD0000] rounded-[5px] text-[#DD0000] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Fila 1: Selección de Lote */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              Lote
            </label>
            <div className="col-span-2">
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                className="w-full h-8 px-2 border border-[#D9D9D9] rounded-[2px] bg-white text-xs font-medium text-black focus:outline-none focus:border-[#0E50A0]"
                disabled={isPending || bulkLots.length === 0}
              >
                {bulkLots.length === 0 ? (
                  <option value="">Sin lotes a granel abiertos</option>
                ) : (
                  bulkLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.code} — {lot.baseProductName} ({lot.kgAvailable} Kg)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Fila 2: Granel (Auto) */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              Granel
            </label>
            <div className="col-span-2">
              <div className="w-full h-8 px-2 border border-[#D9D9D9] rounded-[2px] bg-gray-50 flex items-center text-xs font-semibold text-black">
                {selectedLot?.baseProductName || '—'}
              </div>
            </div>
          </div>

          {/* Fila 3: Kg Disponibles (Auto) */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              Kg Disponibles
            </label>
            <div className="col-span-2">
              <div className="w-full h-8 px-2 border border-[#D9D9D9] rounded-[2px] bg-gray-50 flex items-center text-xs font-mono font-bold text-black">
                {selectedLot ? `${selectedLot.kgAvailable} Kg` : '—'}
              </div>
            </div>
          </div>

          {/* Fila 4: Producto a envasar */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              Producto a envasar
            </label>
            <div className="col-span-2">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full h-8 px-2 border border-[#D9D9D9] rounded-[2px] bg-white text-xs font-medium text-black focus:outline-none focus:border-[#0E50A0]"
                disabled={isPending || compatibleProducts.length === 0}
              >
                {compatibleProducts.length === 0 ? (
                  <option value="">Sin productos asociados a este Producto Base</option>
                ) : (
                  compatibleProducts.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.code} — {p.name} ({p.presentation} • {p.weightKg} kg)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Fila 5: Cantidad (unidades) */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              Cantidad (unidades)
            </label>
            <div className="col-span-2">
              <input
                type="number"
                min="1"
                step="1"
                value={unitsPackaged}
                onChange={(e) => setUnitsPackaged(e.target.value)}
                placeholder="10"
                className="w-full h-8 px-2 border border-[#D9D9D9] rounded-[2px] bg-white text-xs font-mono font-semibold text-black focus:outline-none focus:border-[#0E50A0]"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Fila 6: Observaciones */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              Observaciones
            </label>
            <div className="col-span-2">
              <input
                type="text"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Opcional..."
                className="w-full h-8 px-2 border border-[#D9D9D9] rounded-[2px] bg-white text-xs text-black focus:outline-none focus:border-[#0E50A0]"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Fila 7: ÚLTIMO DEL LOTE + Indicador MERMA / SOBRANTE */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-right font-bold text-black uppercase text-[11px]">
              ULTIMO DEL LOTE
            </label>
            <div className="col-span-2 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isLastOfLot}
                  onChange={(e) => setIsLastOfLot(e.target.checked)}
                  className="w-4 h-4 text-[#0E50A0] border-[#D9D9D9] rounded-[2px] focus:ring-0 cursor-pointer"
                  disabled={isPending}
                />
                <span className="text-xs font-medium text-black">
                  {isLastOfLot ? 'Sí (cierra lote a 0 kg)' : 'No (continúa abierto)'}
                </span>
              </label>

              {/* Indicador Merma / Sobrante según cálculo */}
              {isLastOfLot && preview && (
                <div className="text-xs font-mono font-bold">
                  {preview.varianceType === 'MERMA' && (
                    <span className="text-[#DD0000]">
                      MERMA: {preview.varianceKg} Kg
                    </span>
                  )}
                  {preview.varianceType === 'SOBRANTE' && (
                    <span className="text-green-700">
                      SOBRANTE: {preview.varianceKg} Kg
                    </span>
                  )}
                  {preview.varianceType === 'NONE' && (
                    <span className="text-gray-600">
                      DIFERENCIA: 0.000 Kg
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sección de previsualización técnica de stock */}
          <div className="mt-4 pt-3 border-t border-[#D9D9D9]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-black uppercase text-[11px]">
                Previsualización de Envasado
              </span>
              {previewLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calculando disponibilidad...
                </span>
              )}
            </div>

            {previewError && (
              <div className="p-2.5 bg-[#FFA8A8] border border-[#DD0000] rounded-[2px] text-[#DD0000] text-xs">
                {previewError}
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                {/* Granel Requerido vs Disponible */}
                <div
                  className={`p-2.5 rounded-[2px] border text-xs flex justify-between items-center ${
                    !preview.isBulkSufficient
                      ? 'bg-[#FFA8A8] border-[#DD0000] text-[#DD0000]'
                      : 'bg-gray-50 border-[#D9D9D9] text-black'
                  }`}
                >
                  <div>
                    <span className="font-bold">Granel Requerido:</span>{' '}
                    <span className="font-mono">{preview.kgConsumed} Kg</span>
                  </div>
                  <div>
                    <span className="font-bold">Disponible:</span>{' '}
                    <span className="font-mono">{preview.kgAvailable} Kg</span>
                  </div>
                  {!preview.isBulkSufficient && (
                    <span className="font-bold uppercase text-[10px] text-[#DD0000]">
                      ¡Granel Insuficiente!
                    </span>
                  )}
                </div>

                {/* Tabla de Componentes */}
                <div className="border border-[#D9D9D9] rounded-[2px] overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#D9D9D9] text-black font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-1.5 px-2">COMPONENTE</th>
                        <th className="py-1.5 px-2 text-right">REQ</th>
                        <th className="py-1.5 px-2 text-right">DISP</th>
                        <th className="py-1.5 px-2 text-center">ESTADO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      {preview.components.map((c) => (
                        <tr
                          key={c.componentId}
                          className={!c.isSufficient ? 'bg-[#FFA8A8]/40' : ''}
                        >
                          <td className="py-1.5 px-2 font-medium text-black">
                            <span className="font-mono font-semibold">{c.componentCode}</span>{' '}
                            {c.componentName}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-black">
                            {c.requiredUnits} u
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-black">
                            {c.availableUnits} u
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {c.isSufficient ? (
                              <span className="text-green-700 font-bold text-[10px]">
                                OK
                              </span>
                            ) : (
                              <span className="text-[#DD0000] font-bold text-[10px] bg-[#FFA8A8] px-1 py-0.5 rounded-[2px]">
                                FALTANTE
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de costos congelados */}
                <div className="bg-gray-50 border border-[#D9D9D9] p-2.5 rounded-[2px] flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-700">
                    Costo unitario estimado:
                  </span>
                  <span className="font-mono font-bold text-black">
                    ${preview.estimatedUnitCostArs} ARS
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Botones de acción inferiores */}
          <div className="pt-4 border-t border-[#D9D9D9] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-8 px-6 bg-[#DD0000] hover:bg-[#b50000] text-white rounded-[2px] font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-8 px-6 bg-[#0E50A0] hover:bg-[#0c4386] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[2px] font-bold uppercase tracking-wider text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Registrar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
