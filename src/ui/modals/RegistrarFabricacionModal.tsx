'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import {
  getManufacturingPreviewAction,
  manufactureBulkLotAction,
} from '@/actions/factory.actions';
import type { BulkManufacturingPreviewDTO } from '@/actions/factory.dto';

export interface BaseProductOption {
  id: string;
  name: string;
  code: string;
}

interface RegistrarFabricacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  baseProducts: BaseProductOption[];
}

export const RegistrarFabricacionModal: React.FC<RegistrarFabricacionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  baseProducts,
}) => {
  const [baseProductId, setBaseProductId] = useState<string>(baseProducts[0]?.id || '');
  const [businessDate, setBusinessDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [kgFabricated, setKgFabricated] = useState<string>('100');
  const [observations, setObservations] = useState<string>('');

  const [preview, setPreview] = useState<BulkManufacturingPreviewDTO | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cargar previsualización de requerimientos de MPR cada vez que cambia PBA o kg
  useEffect(() => {
    if (!isOpen || !baseProductId) {
      setPreview(null);
      return;
    }

    const trimmedKg = kgFabricated.trim();
    const num = parseFloat(trimmedKg);
    if (!trimmedKg || isNaN(num) || num <= 0) {
      setPreview(null);
      return;
    }

    let isMounted = true;
    setPreviewLoading(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      const res = await getManufacturingPreviewAction(baseProductId, trimmedKg);
      if (!isMounted) return;

      setPreviewLoading(false);
      if (res.success && res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setPreviewError(res.error || 'Error calculando requerimientos');
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, baseProductId, kgFabricated]);

  if (!isOpen) return null;

  const canSubmit =
    !isPending &&
    !previewLoading &&
    preview !== null &&
    preview.isAllSufficient &&
    parseFloat(kgFabricated) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !preview) return;

    setSubmitError(null);
    startTransition(async () => {
      const res = await manufactureBulkLotAction({
        baseProductId,
        formulaVersionId: preview.formulaVersionId,
        kgFabricated: kgFabricated.trim(),
        businessDate: businessDate.trim() || undefined,
        observations: observations.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(res.error || 'Error al registrar fabricación.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white border border-[#D9D9D9] rounded-[5px] w-full max-w-xl max-h-[90vh] flex flex-col justify-between overflow-hidden shadow-none animate-in fade-in zoom-in-95 duration-100">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[#D9D9D9] flex justify-between items-center bg-white">
          <h2 className="text-lg font-bold text-black uppercase tracking-wider">
            Fabricacion
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
          {submitError && (
            <div className="p-3 bg-red-50 border border-[#DD0000] text-[#DD0000] rounded-[3px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Campo Código */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-bold text-gray-800 text-right">Codigo</label>
            <div className="col-span-2 text-gray-500 font-mono text-xs">
              Automatico (GRAxxxx)
            </div>
          </div>

          {/* Fecha Lote */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-bold text-gray-800 text-right">Fecha Lote</label>
            <div className="col-span-2">
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                required
                className="w-full h-8 px-2.5 border border-[#D9D9D9] rounded-[5px] text-xs focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

          {/* Producto Granel (PBA) */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-bold text-gray-800 text-right">Producto Granel</label>
            <div className="col-span-2">
              <select
                value={baseProductId}
                onChange={(e) => setBaseProductId(e.target.value)}
                required
                className="w-full h-8 px-2.5 border border-[#D9D9D9] rounded-[5px] text-xs bg-white focus:outline-none focus:border-[#0E50A0]"
              >
                {baseProducts.length === 0 && (
                  <option value="">No hay productos base con fórmula</option>
                )}
                {baseProducts.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name} ({bp.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kg Fabricados */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-bold text-gray-800 text-right">Kg Fabricados</label>
            <div className="col-span-2">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={kgFabricated}
                onChange={(e) => setKgFabricated(e.target.value)}
                placeholder="ej. 100"
                required
                className="w-full h-8 px-2.5 border border-[#D9D9D9] rounded-[5px] text-xs focus:outline-none focus:border-[#0E50A0] font-mono"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-bold text-gray-800 text-right">Observaciones</label>
            <div className="col-span-2">
              <input
                type="text"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observaciones de la fabricación (opcional)"
                className="w-full h-8 px-2.5 border border-[#D9D9D9] rounded-[5px] text-xs focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

          {/* Tabla de Requerimientos vs Disponibilidad de MPR */}
          <div className="pt-3 border-t border-[#D9D9D9] space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-black uppercase tracking-wider text-[11px]">
                Requerimiento de Materias Primas
              </h3>
              {preview && (
                <span className="text-[11px] text-gray-500 font-mono">
                  Fórmula v{preview.formulaVersionNumber} (Base: {preview.baseFormulaKg} kg)
                </span>
              )}
            </div>

            {previewLoading ? (
              <div className="py-6 flex justify-center items-center gap-2 text-gray-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Calculando proporciones y stock...</span>
              </div>
            ) : previewError ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-[3px]">
                {previewError}
              </div>
            ) : preview ? (
              <div className="border border-[#D9D9D9] rounded-[3px] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[10px]">
                      <th className="py-2 px-2.5 text-left">MATERIA PRIMA</th>
                      <th className="py-2 px-2 text-right">REQUERIDO</th>
                      <th className="py-2 px-2 text-right">DISPONIBLE</th>
                      <th className="py-2 px-2 text-center">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {preview.items.map((it) => (
                      <tr key={it.rawMaterialId} className={!it.isSufficient ? 'bg-[#FFA8A8]/30' : ''}>
                        <td className="py-1.5 px-2.5 font-medium text-gray-800">
                          {it.rawMaterialName} <span className="text-gray-400 font-mono">({it.rawMaterialCode})</span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold">
                          {it.requiredKg} kg
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-gray-600">
                          {it.availableKg} kg
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {it.isSufficient ? (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold text-green-800 bg-green-100 rounded">
                              OK
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold text-white bg-[#DD0000] rounded">
                              INSUFICIENTE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {preview && !preview.isAllSufficient && (
              <div className="text-[11px] font-semibold text-[#DD0000] flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Stock insuficiente. La fabricación no puede registrarse.</span>
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 border-t border-[#D9D9D9] grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 bg-[#DD0000] hover:bg-[#c40000] text-white rounded-[2px] font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 bg-[#0E50A0] hover:bg-[#0c4386] text-white rounded-[2px] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{preview && !preview.isAllSufficient ? 'STOCK INSUFICIENTE' : 'Registrar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
