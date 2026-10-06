'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../components/UIComponents';
import { createRawMaterialAction } from '@/actions/master-item.actions';
import type { SupplierOptionDTO } from '@/actions/master-item.dto';

interface NewRawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSuppliers: SupplierOptionDTO[];
  onSuccess?: () => void;
}

export const NewRawMaterialModal: React.FC<NewRawMaterialModalProps> = ({
  isOpen,
  onClose,
  activeSuppliers,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [inci, setInci] = useState('');
  const [stockMinimumKg, setStockMinimumKg] = useState('');
  const [initialStockKg, setInitialStockKg] = useState('0');
  const [initialSupplierId, setInitialSupplierId] = useState('');
  const [initialQuotedPriceNet, setInitialQuotedPriceNet] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setInci('');
      setStockMinimumKg('');
      setInitialStockKg('0');
      setInitialSupplierId(activeSuppliers[0]?.id || '');
      setInitialQuotedPriceNet('');
      setError(null);
    }
  }, [isOpen, activeSuppliers]);

  const selectedSupplier = activeSuppliers.find((s) => s.id === initialSupplierId);

  const validateMaxDecimals = (val: string, max = 3): boolean => {
    if (!val.includes('.')) return true;
    const dec = val.split('.')[1];
    return dec.length <= max;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre de la Materia Prima es obligatorio.');
      return;
    }

    const minNum = parseFloat(stockMinimumKg);
    if (!stockMinimumKg || isNaN(minNum) || minNum <= 0) {
      setError('El stock mínimo debe ser estrictamente mayor a 0 kg.');
      return;
    }

    if (!validateMaxDecimals(stockMinimumKg, 3)) {
      setError('El stock mínimo en kg admite como máximo 3 decimales (ej: 0.350).');
      return;
    }

    const initNum = parseFloat(initialStockKg);
    if (initialStockKg && (isNaN(initNum) || initNum < 0)) {
      setError('El stock inicial no puede ser negativo.');
      return;
    }

    if (initialStockKg && !validateMaxDecimals(initialStockKg, 3)) {
      setError('El stock inicial en kg admite como máximo 3 decimales (ej: 12.125).');
      return;
    }

    if (!initialSupplierId) {
      setError('Debe seleccionar un proveedor inicial activo.');
      return;
    }

    const priceNum = parseFloat(initialQuotedPriceNet);
    if (!initialQuotedPriceNet || isNaN(priceNum) || priceNum <= 0) {
      setError('El precio cotizado neto inicial debe ser mayor a cero.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createRawMaterialAction({
        name: name.trim(),
        inci: inci.trim() || null,
        stockMinimumKg: stockMinimumKg.trim(),
        initialStockKg: initialStockKg.trim() || '0',
        initialSupplierId,
        initialQuotedPriceNet: initialQuotedPriceNet.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Error al crear la materia prima');
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error de comunicación con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedGrossPrice = () => {
    const price = parseFloat(initialQuotedPriceNet);
    if (isNaN(price) || price <= 0) return 'Cálculo Automático';
    const gross = price * 1.21;
    const curr = selectedSupplier?.currencyCode === 'USD' ? 'USD' : '$';
    return `${curr} ${gross.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (con IVA 21%)`;
  };

  return (
    <Modal
      title="NUEVA MATERIA PRIMA / COMPONENTE"
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs font-semibold text-[#DD0000]">
            {error}
          </div>
        )}

        {/* Formulario en 2 Columnas idéntico a Figma NUEVA-MATERIA-COMPONENTE.png */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
          
          {/* Columna Izquierda */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Tipo</label>
              <select
                disabled
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
              >
                <option>Materia Prima (MPR)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Nombre</label>
              <input
                type="text"
                required
                placeholder="Nombre del insumo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">INCI</label>
              <input
                type="text"
                placeholder="Nomenclatura INCI opcional"
                value={inci}
                onChange={(e) => setInci(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Precio xKg sin iva</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                placeholder="0.00"
                value={initialQuotedPriceNet}
                onChange={(e) => setInitialQuotedPriceNet(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Stock minimo</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="Ej: 10.000"
                value={stockMinimumKg}
                onChange={(e) => setStockMinimumKg(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Codigo</label>
              <div className="flex-1 h-9 px-3 flex items-center border border-dashed border-gray-300 rounded-md text-gray-500 bg-gray-50 font-mono">
                Automático (MPRxxxx)
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Proveedor</label>
              <select
                required
                value={initialSupplierId}
                onChange={(e) => setInitialSupplierId(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0] bg-white"
              >
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currencyCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Moneda</label>
              <div className="flex-1 h-9 px-3 flex items-center border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-bold">
                {selectedSupplier ? selectedSupplier.currencyCode : 'ARS'} (heredada)
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Stock Inicial</label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={initialStockKg}
                onChange={(e) => setInitialStockKg(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

        </div>

        {/* Cálculo automático de precio según Figma */}
        <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-700">
          <span>Precio unitario con IVA (estimado):</span>
          <span className="font-bold text-black">{calculatedGrossPrice()}</span>
        </div>

        {/* Botones de Acción de Figma: Cancelar (Rojo) y Registrar (Azul) */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="rojo"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-32"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="azul"
            disabled={isSubmitting}
            className="w-36"
          >
            {isSubmitting ? 'Registrando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
