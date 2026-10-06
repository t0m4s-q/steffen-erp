'use client';

import React, { useState, useEffect } from 'react';
import { Modal, FormField, Button } from '../components/UIComponents';
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
        // En edición, currencyCode es estrictamente omitido por inmutabilidad
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
      title={isEdit ? `Editar Proveedor: ${supplier?.code || ''}` : 'Nuevo Proveedor'}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-[#DD0000] rounded text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Nombre / Razón Social */}
          <FormField label="Nombre / Razón Social *">
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Químicos & Esencias S.A."
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          {/* Moneda: Editable solo en creación, Bloqueada en edición */}
          <FormField label="Moneda de Facturación y Cta. Cte. *">
            {isEdit ? (
              <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded border border-slate-200 text-xs">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                  {currencyCode}
                </span>
                <span className="text-slate-500">
                  La moneda es inmutable y no puede modificarse tras el alta del proveedor.
                </span>
              </div>
            ) : (
              <div>
                <select
                  value={currencyCode}
                  disabled={isSubmitting}
                  onChange={(e) => setCurrencyCode(e.target.value as 'ARS' | 'USD')}
                  className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full bg-white font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
                >
                  <option value="ARS">ARS — Pesos Argentinos ($)</option>
                  <option value="USD">USD — Dólares Estadounidenses (US$)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Atención: La moneda seleccionada será inmutable una vez registrado el proveedor.
                </p>
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendedor / Contacto Comercial */}
            <FormField label="Vendedor / Contacto">
              <input
                type="text"
                disabled={isSubmitting}
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                placeholder="Ej: Lic. Esteban Rossi"
                className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
              />
            </FormField>

            {/* Teléfono */}
            <FormField label="Teléfono / WhatsApp">
              <input
                type="text"
                disabled={isSubmitting}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: +54 11 4455-6677"
                className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
              />
            </FormField>
          </div>

          {/* Estado activo / inactivo en modo edición */}
          {isEdit && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Estado operativo</span>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  disabled={isSubmitting}
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#B99D22] focus:ring-[#B99D22] h-4 w-4"
                />
                <span className={active ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium'}>
                  {active ? 'Proveedor Activo' : 'Proveedor Inactivo'}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <Button
            variant="secundario"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="principal"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Proveedor'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
