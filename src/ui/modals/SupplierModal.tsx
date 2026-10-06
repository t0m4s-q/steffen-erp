'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../components/UIComponents';
import { createSupplierAction, updateSupplierAction, type SupplierDTO } from '@/actions/supplier.actions';
import { Lock } from 'lucide-react';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: SupplierDTO | null;
  onSuccess?: (supplier: SupplierDTO) => void;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}) => {
  const isEdit = Boolean(supplier);

  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>('ARS');
  const [salesperson, setSalesperson] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name || '');
      setCurrencyCode(supplier.currencyCode || 'ARS');
      setSalesperson(supplier.salesperson || '');
      setPhone(supplier.phone || '');
      setActive(supplier.active ?? true);
    } else {
      setName('');
      setCurrencyCode('ARS');
      setSalesperson('');
      setPhone('');
      setActive(true);
    }
    setError(null);
  }, [supplier, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre o razón social del proveedor es obligatorio.');
      return;
    }

    if (!isEdit && !['ARS', 'USD'].includes(currencyCode)) {
      setError('La moneda del proveedor es obligatoria y debe ser ARS o USD.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && supplier) {
        const res = await updateSupplierAction(supplier.id, {
          name: name.trim(),
          salesperson: salesperson.trim() || null,
          phone: phone.trim() || null,
          active,
        });

        if (!res.success) {
          setError(res.error || 'Error al actualizar el proveedor');
        } else {
          onSuccess?.(res.data!);
          onClose();
        }
      } else {
        const res = await createSupplierAction({
          name: name.trim(),
          currencyCode,
          salesperson: salesperson.trim() || null,
          phone: phone.trim() || null,
        });

        if (!res.success) {
          setError(res.error || 'Error al crear el proveedor');
        } else {
          onSuccess?.(res.data!);
          onClose();
        }
      }
    } catch {
      setError('Error inesperado de comunicación con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `EDITAR PROVEEDOR — ${supplier?.code}` : 'NUEVO PROVEEDOR'}
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

        {/* Formulario en 2 Columnas estilo Figma */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
          
          {/* Columna Izquierda */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Codigo</label>
              <div className="flex-1 h-9 px-3 flex items-center border border-dashed border-gray-300 rounded-md text-gray-500 bg-gray-50 font-mono">
                {isEdit ? supplier?.code : 'Automatico'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Nombre / Razón Social</label>
              <input
                type="text"
                required
                placeholder="Nombre o empresa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Moneda</label>
              {isEdit ? (
                <div className="flex-1 h-9 px-3 flex items-center justify-between border border-gray-300 rounded-md bg-gray-100 text-gray-700">
                  <span className="font-bold">{currencyCode}</span>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Lock className="w-3 h-3" />
                    <span>Inmutable</span>
                  </div>
                </div>
              ) : (
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value as 'ARS' | 'USD')}
                  className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0] bg-white font-semibold"
                >
                  <option value="ARS">ARS — Pesos Argentinos</option>
                  <option value="USD">USD — Dólares Estadounidenses</option>
                </select>
              )}
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Vendedor / Contacto</label>
              <input
                type="text"
                placeholder="Nombre del ejecutivo comercial"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-32">Teléfono</label>
              <input
                type="text"
                placeholder="Teléfono o WhatsApp comercial"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            {isEdit && (
              <div className="flex items-center justify-between">
                <label className="font-semibold text-black w-32">Estado Operativo</label>
                <select
                  value={active ? 'active' : 'inactive'}
                  onChange={(e) => setActive(e.target.value === 'active')}
                  className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0] bg-white"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            )}
          </div>

        </div>

        {/* Botones de Acción de Figma: Cancelar (Rojo) y Registrar Proveedor (Azul) */}
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
            className="w-44"
          >
            {isSubmitting
              ? 'Guardando...'
              : isEdit
              ? 'Guardar proveedor'
              : 'Registrar proveedor'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
