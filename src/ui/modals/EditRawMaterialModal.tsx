'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../components/UIComponents';
import {
  updateRawMaterialMetadataAction,
  updateRawMaterialSupplierQuoteAction,
} from '@/actions/master-item.actions';
import type { RawMaterialDTO, SupplierOptionDTO } from '@/actions/master-item.dto';

interface EditRawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawMaterial: RawMaterialDTO | null;
  activeSuppliers: SupplierOptionDTO[];
  onSuccess?: () => void;
}

export const EditRawMaterialModal: React.FC<EditRawMaterialModalProps> = ({
  isOpen,
  onClose,
  rawMaterial,
  activeSuppliers,
  onSuccess,
}) => {
  // Sección 1: Ficha Técnica
  const [name, setName] = useState('');
  const [inci, setInci] = useState('');
  const [stockMinimumKg, setStockMinimumKg] = useState('');
  const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSuccess, setMetaSuccess] = useState(false);

  // Sección 2: Cotización de Proveedor
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quotePriceNet, setQuotePriceNet] = useState('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  useEffect(() => {
    if (rawMaterial) {
      setName(rawMaterial.name || '');
      setInci(rawMaterial.inci || '');
      setStockMinimumKg(rawMaterial.stockMinimumKg || '');
      setQuoteSupplierId(rawMaterial.supplierId || activeSuppliers[0]?.id || '');
      setQuotePriceNet(rawMaterial.quotedPriceNet || '');
      setMetaError(null);
      setMetaSuccess(false);
      setQuoteError(null);
      setQuoteSuccess(false);
    }
  }, [rawMaterial, isOpen, activeSuppliers]);

  const selectedQuoteSupplier = activeSuppliers.find((s) => s.id === quoteSupplierId);

  const validateMaxDecimals = (val: string, max = 3): boolean => {
    if (!val.includes('.')) return true;
    const dec = val.split('.')[1];
    return dec.length <= max;
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawMaterial) return;
    setMetaError(null);
    setMetaSuccess(false);

    if (!name.trim()) {
      setMetaError('El nombre de la Materia Prima es obligatorio.');
      return;
    }

    const minNum = parseFloat(stockMinimumKg);
    if (!stockMinimumKg || isNaN(minNum) || minNum <= 0) {
      setMetaError('El stock mínimo debe ser estrictamente mayor a 0 kg.');
      return;
    }

    if (!validateMaxDecimals(stockMinimumKg, 3)) {
      setMetaError('El stock mínimo en kg admite como máximo 3 decimales (ej: 0.350).');
      return;
    }

    setIsSubmittingMeta(true);
    try {
      const res = await updateRawMaterialMetadataAction(rawMaterial.id, {
        name: name.trim(),
        inci: inci.trim() || null,
        stockMinimumKg: stockMinimumKg.trim(),
      });

      if (!res.success) {
        setMetaError(res.error || 'Error al actualizar ficha técnica');
      } else {
        setMetaSuccess(true);
        onSuccess?.();
      }
    } catch (err: any) {
      setMetaError(err.message || 'Error de comunicación');
    } finally {
      setIsSubmittingMeta(false);
    }
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawMaterial) return;
    setQuoteError(null);
    setQuoteSuccess(false);

    if (!quoteSupplierId) {
      setQuoteError('Debe seleccionar un proveedor activo.');
      return;
    }

    const priceNum = parseFloat(quotePriceNet);
    if (!quotePriceNet || isNaN(priceNum) || priceNum <= 0) {
      setQuoteError('El precio cotizado neto debe ser mayor a cero.');
      return;
    }

    setIsSubmittingQuote(true);
    try {
      const res = await updateRawMaterialSupplierQuoteAction(rawMaterial.id, {
        supplierId: quoteSupplierId,
        quotedPriceNet: quotePriceNet.trim(),
      });

      if (!res.success) {
        setQuoteError(res.error || 'Error al registrar nueva cotización');
      } else {
        setQuoteSuccess(true);
        onSuccess?.();
      }
    } catch (err: any) {
      setQuoteError(err.message || 'Error de comunicación');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  if (!rawMaterial) return null;

  return (
    <Modal
      title={`EDITAR MATERIA PRIMA — ${rawMaterial.code}`}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-xs">

        {/* Sección 1: Ficha Técnica */}
        <form onSubmit={handleSaveMetadata} className="p-4 border border-gray-200 rounded-lg space-y-4 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h3 className="font-bold text-black uppercase tracking-wide">
              1. Ficha Técnica / Metadatos
            </h3>
            {metaSuccess && (
              <span className="text-[11px] font-bold text-[#008102]">
                ✓ Ficha guardada
              </span>
            )}
          </div>

          {metaError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-[#DD0000] font-semibold">
              {metaError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-black block mb-1">Nombre</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div>
              <label className="font-semibold text-black block mb-1">INCI</label>
              <input
                type="text"
                value={inci}
                onChange={(e) => setInci(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div>
              <label className="font-semibold text-black block mb-1">Stock Mínimo (kg)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={stockMinimumKg}
                onChange={(e) => setStockMinimumKg(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div>
              <label className="font-semibold text-black block mb-1">Stock Actual (kg)</label>
              <div className="h-9 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-bold">
                {rawMaterial.stockCurrentKg} kg (inmutable por edición)
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="azul"
              disabled={isSubmittingMeta}
              className="px-6"
            >
              {isSubmittingMeta ? 'Guardando...' : 'Guardar Ficha Técnica'}
            </Button>
          </div>
        </form>

        {/* Sección 2: Cotización de Proveedor */}
        <form onSubmit={handleSaveQuote} className="p-4 border border-gray-200 rounded-lg space-y-4 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h3 className="font-bold text-black uppercase tracking-wide">
              2. Cotización Vigente del Proveedor
            </h3>
            {quoteSuccess && (
              <span className="text-[11px] font-bold text-[#008102]">
                ✓ Cotización actualizada
              </span>
            )}
          </div>

          {quoteError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-[#DD0000] font-semibold">
              {quoteError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-black block mb-1">Proveedor</label>
              <select
                required
                value={quoteSupplierId}
                onChange={(e) => setQuoteSupplierId(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0] bg-white"
              >
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currencyCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-black block mb-1">
                Precio Unitario Neto ({selectedQuoteSupplier?.currencyCode || 'Moneda'})
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={quotePriceNet}
                onChange={(e) => setQuotePriceNet(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="azul"
              disabled={isSubmittingQuote}
              className="px-6"
            >
              {isSubmittingQuote ? 'Actualizando...' : 'Actualizar Cotización'}
            </Button>
          </div>
        </form>

        {/* Botón Cerrar en pie */}
        <div className="flex justify-end pt-2 border-t border-gray-200">
          <Button
            type="button"
            variant="secundario"
            onClick={onClose}
            className="w-28"
          >
            Cerrar
          </Button>
        </div>

      </div>
    </Modal>
  );
};
