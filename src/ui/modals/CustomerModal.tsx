'use client';

import React, { useState, useEffect } from 'react';
import { Modal, FormField, Button } from '../components/UIComponents';
import { createCustomerAction, updateCustomerAction, type CustomerDTO } from '@/actions/customer.actions';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: CustomerDTO | null;
  onSuccess?: (customer: CustomerDTO) => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const isEdit = Boolean(customer);

  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('');
  const [province, setProvince] = useState('');
  const [transportName, setTransportName] = useState('');
  const [transportAddress, setTransportAddress] = useState('');
  const [category, setCategory] = useState('');
  const [discount1Pct, setDiscount1Pct] = useState('0');
  const [discount2Pct, setDiscount2Pct] = useState('0');
  const [discount3Pct, setDiscount3Pct] = useState('0');
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setDni(customer.dni || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setLocality(customer.locality || '');
      setProvince(customer.province || '');
      setTransportName(customer.transportName || '');
      setTransportAddress(customer.transportAddress || '');
      setCategory(customer.category || '');
      setDiscount1Pct(customer.discount1Pct || '0');
      setDiscount2Pct(customer.discount2Pct || '0');
      setDiscount3Pct(customer.discount3Pct || '0');
      setActive(customer.active ?? true);
    } else {
      setName('');
      setDni('');
      setPhone('');
      setAddress('');
      setLocality('');
      setProvince('');
      setTransportName('');
      setTransportAddress('');
      setCategory('');
      setDiscount1Pct('0');
      setDiscount2Pct('0');
      setDiscount3Pct('0');
      setActive(true);
    }
    setError(null);
  }, [customer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre o razón social del cliente es obligatorio.');
      return;
    }

    const d1 = parseFloat(discount1Pct) || 0;
    const d2 = parseFloat(discount2Pct) || 0;
    const d3 = parseFloat(discount3Pct) || 0;

    if (d1 < 0 || d1 > 100 || d2 < 0 || d2 > 100 || d3 < 0 || d3 > 100) {
      setError('Los porcentajes de descuento deben estar entre 0% y 100%.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && customer) {
        const res = await updateCustomerAction(customer.id, {
          name: name.trim(),
          dni: dni.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          locality: locality.trim() || null,
          province: province.trim() || null,
          transportName: transportName.trim() || null,
          transportAddress: transportAddress.trim() || null,
          category: category.trim() || null,
          discount1Pct,
          discount2Pct,
          discount3Pct,
          active,
        });

        if (!res.success) {
          setError(res.error || 'Error al actualizar el cliente');
        } else {
          onSuccess?.(res.data!);
          onClose();
        }
      } else {
        const res = await createCustomerAction({
          name: name.trim(),
          dni: dni.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          locality: locality.trim() || null,
          province: province.trim() || null,
          transportName: transportName.trim() || null,
          transportAddress: transportAddress.trim() || null,
          category: category.trim() || null,
          discount1Pct,
          discount2Pct,
          discount3Pct,
        });

        if (!res.success) {
          setError(res.error || 'Error al crear el cliente');
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
      title={isEdit ? `Editar Cliente: ${customer?.code || ''}` : 'Nuevo Cliente'}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-[#DD0000] rounded text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nombre / Razón Social *" className="sm:col-span-2">
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Distribuidora Bella Cosmética"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="DNI / CUIT">
            <input
              type="text"
              disabled={isSubmitting}
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 30-71234567-9"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Teléfono de Contacto">
            <input
              type="text"
              disabled={isSubmitting}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +54 9 11 4455-6677"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Dirección / Domicilio">
            <input
              type="text"
              disabled={isSubmitting}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. Rivadavia 1234"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Localidad">
            <input
              type="text"
              disabled={isSubmitting}
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="Ej: Morón"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Provincia">
            <input
              type="text"
              disabled={isSubmitting}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Ej: Buenos Aires"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Categoría Comercial">
            <input
              type="text"
              disabled={isSubmitting}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Salón Mayorista, Distribuidor"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Transporte / Expreso">
            <input
              type="text"
              disabled={isSubmitting}
              value={transportName}
              onChange={(e) => setTransportName(e.target.value)}
              placeholder="Ej: Expreso San José"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>

          <FormField label="Dirección de Transporte">
            <input
              type="text"
              disabled={isSubmitting}
              value={transportAddress}
              onChange={(e) => setTransportAddress(e.target.value)}
              placeholder="Ej: Depósito Central Villa Soldati"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-medium focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
            />
          </FormField>
        </div>

        {/* Sección de Descuentos Comerciales Sucesivos */}
        <div className="pt-3 border-t border-gray-200">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
            Descuentos Comerciales del Cliente (%)
          </label>
          <p className="text-[11px] text-gray-500 mb-3">
            Se aplican de forma sucesiva en remitos y facturación (no se suman algebraicamente).
          </p>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Descuento 1 (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={isSubmitting}
                value={discount1Pct}
                onChange={(e) => setDiscount1Pct(e.target.value)}
                className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-bold text-center focus:border-[#B99D22]"
              />
            </FormField>

            <FormField label="Descuento 2 (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={isSubmitting}
                value={discount2Pct}
                onChange={(e) => setDiscount2Pct(e.target.value)}
                className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-bold text-center focus:border-[#B99D22]"
              />
            </FormField>

            <FormField label="Descuento 3 (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={isSubmitting}
                value={discount3Pct}
                onChange={(e) => setDiscount3Pct(e.target.value)}
                className="h-[40px] px-3 border border-[#D9D9D9] rounded text-sm w-full font-bold text-center focus:border-[#B99D22]"
              />
            </FormField>
          </div>
        </div>

        {isEdit && (
          <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Estado de la cuenta:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isSubmitting}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-gray-300 text-[#B99D22] focus:ring-[#B99D22] h-4 w-4"
              />
              <span className={`text-xs font-bold ${active ? 'text-[#008102]' : 'text-gray-500'}`}>
                {active ? 'Cliente Activo' : 'Cliente Inactivo'}
              </span>
            </label>
          </div>
        )}

        {/* Botones de acción */}
        <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
          <Button
            type="button"
            variant="secundario"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="principal"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
