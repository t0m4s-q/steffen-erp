'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../components/UIComponents';
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
          discount1Pct: discount1Pct.trim() || '0',
          discount2Pct: discount2Pct.trim() || '0',
          discount3Pct: discount3Pct.trim() || '0',
        });

        if (!res.success || !res.data) {
          setError(res.error || 'Error al actualizar el cliente');
        } else {
          onSuccess?.(res.data);
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
          discount1Pct: discount1Pct.trim() || '0',
          discount2Pct: discount2Pct.trim() || '0',
          discount3Pct: discount3Pct.trim() || '0',
        });

        if (!res.success || !res.data) {
          setError(res.error || 'Error al registrar el cliente');
        } else {
          onSuccess?.(res.data);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de comunicación con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `EDITAR CLIENTE — ${customer?.code}` : 'NUEVO CLIENTE'}
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

        {/* Formulario en 2 Columnas idéntico a NUEVO-CLIENTE.png de Figma */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 text-xs">
          
          {/* Columna Izquierda */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Codigo</label>
              <div className="flex-1 h-9 px-3 flex items-center border border-dashed border-gray-300 rounded-md text-gray-500 bg-gray-50 font-mono">
                {isEdit ? customer?.code : 'Automatico'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Fecha Creacion</label>
              <div className="flex-1 h-9 px-3 flex items-center border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                {isEdit && customer?.createdAt
                  ? new Date(customer.createdAt).toLocaleDateString('es-AR')
                  : new Date().toLocaleDateString('es-AR')}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Nombre</label>
              <input
                type="text"
                required
                placeholder="Nombre o Razón Social"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Domicilio</label>
              <input
                type="text"
                placeholder="Dirección comercial"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Localidad</label>
              <input
                type="text"
                placeholder="Ciudad / Localidad"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Provincia</label>
              <input
                type="text"
                placeholder="Provincia"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Telefono</label>
              <input
                type="text"
                placeholder="Teléfono o WhatsApp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Dni / CUIT</label>
              <input
                type="text"
                placeholder="Documento o CUIT"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Transporte</label>
              <input
                type="text"
                placeholder="Empresa de transporte"
                value={transportName}
                onChange={(e) => setTransportName(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Dir. Transporte</label>
              <input
                type="text"
                placeholder="Dirección del depósito o expreso"
                value={transportAddress}
                onChange={(e) => setTransportAddress(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Categoria</label>
              <input
                type="text"
                placeholder="Distribuidor, Salón, etc."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Descuento 1</label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discount1Pct}
                  onChange={(e) => setDiscount1Pct(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
                />
                <span className="text-gray-500 font-bold">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Descuento 2</label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discount2Pct}
                  onChange={(e) => setDiscount2Pct(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
                />
                <span className="text-gray-500 font-bold">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="font-semibold text-black w-28">Descuento 3</label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discount3Pct}
                  onChange={(e) => setDiscount3Pct(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#0E50A0]"
                />
                <span className="text-gray-500 font-bold">%</span>
              </div>
            </div>
          </div>

        </div>

        {/* Botones de Acción de Figma: Cancelar (Rojo) y Registrar Cliente (Azul) */}
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
            className="w-40"
          >
            {isSubmitting
              ? 'Guardando...'
              : isEdit
              ? 'Guardar cliente'
              : 'Registrar cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
