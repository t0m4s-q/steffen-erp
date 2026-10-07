'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../components/UIComponents';
import {
  updateComponentMetadataAction,
  updateComponentSupplierQuoteAction,
} from '@/actions/master-item.actions';
import type { ComponentDTO, SupplierOptionDTO } from '@/actions/master-item.dto';

interface EditComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: ComponentDTO | null;
  activeSuppliers: SupplierOptionDTO[];
  onSuccess?: () => void;
}

export const EditComponentModal: React.FC<EditComponentModalProps> = ({
  isOpen,
  onClose,
  component,
  activeSuppliers,
  onSuccess,
}) => {
  // Sección 1: Ficha Técnica
  const [name, setName] = useState('');
  const [stockMinimumUnits, setStockMinimumUnits] = useState('');
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
    if (component) {
      setName(component.name || '');
      setStockMinimumUnits(component.stockMinimumUnits !== undefined ? String(component.stockMinimumUnits) : '');
      setQuoteSupplierId(component.supplierId || activeSuppliers[0]?.id || '');
      setQuotePriceNet(component.quotedPriceNet || '');
      setMetaError(null);
      setMetaSuccess(false);
      setQuoteError(null);
      setQuoteSuccess(false);
    }
  }, [component, isOpen, activeSuppliers]);

  const selectedQuoteSupplier = activeSuppliers.find((s) => s.id === quoteSupplierId);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!component) return;
    setMetaError(null);
    setMetaSuccess(false);

    if (!name.trim()) {
      setMetaError('El nombre del Componente es obligatorio.');
      return;
    }

    const minNum = parseFloat(stockMinimumUnits);
    if (!stockMinimumUnits || isNaN(minNum) || minNum <= 0) {
      setMetaError('El stock mínimo debe ser estrictamente mayor a 0 unidades.');
      return;
    }

    if (!Number.isInteger(minNum)) {
      setMetaError('El stock mínimo de un Componente (UNIT) debe ser un número entero sin decimales.');
      return;
    }

    setIsSubmittingMeta(true);
    try {
      const res = await updateComponentMetadataAction(component.id, {
        name: name.trim(),
        stockMinimumUnits: Math.trunc(minNum),
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
    if (!component) return;
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
      const res = await updateComponentSupplierQuoteAction(component.id, {
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

  if (!component) return null;

  return (
    <Modal
      title={`EDITAR COMPONENTE — ${component.code}`}
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
              <label className="font-semibold text-black block mb-1">Stock Mínimo (unidades)</label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={stockMinimumUnits}
                onChange={(e) => setStockMinimumUnits(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div>
              <label className="font-semibold text-black block mb-1">Código</label>
              <div className="h-9 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-mono font-bold">
                {component.code}
              </div>
            </div>

            <div>
              <label className="font-semibold text-black block mb-1">Stock Actual (unidades)</label>
              <div className="h-9 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-bold">
                {component.stockCurrentUnits} u (inmutable por edición)
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
