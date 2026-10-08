'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Tag, AlertCircle } from 'lucide-react';
import { createPriceListAction } from '@/actions/price-list.actions';

interface NewPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdId: string) => void;
}

export const NewPriceListModal: React.FC<NewPriceListModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre de la lista de precios es obligatorio.');
      return;
    }

    startTransition(async () => {
      const res = await createPriceListAction({ name: name.trim() });
      if (!res.success || !res.data) {
        setError(res.error || 'Error al crear la lista de precios.');
        return;
      }

      router.refresh();
      if (onSuccess) {
        onSuccess(res.data.id);
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg bg-white border border-[#D9D9D9] rounded-[4px] shadow-2xl p-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9D9D9]">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#0E50A0]" />
            <h2 className="text-lg font-bold tracking-tight text-black uppercase">
              NUEVA LISTA DE PRECIOS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar"
            disabled={isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-[2px] text-xs font-semibold text-[#DD0000] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Nombre de la Lista <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Distribuidor Mayorista, Salón Interior..."
              disabled={isPending}
              autoFocus
              className="w-full h-10 px-3 text-xs border border-[#D9D9D9] rounded-[2px] focus:outline-none focus:border-[#0E50A0] text-black"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-[2px] text-xs text-[#0E50A0] leading-relaxed">
            Las listas adicionales se crean activas y con rol adicional por defecto. Podrá definir los precios de venta por producto una vez creada la lista.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-[38px] px-4 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-white border border-[#D9D9D9] text-black hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-[38px] px-5 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-[#D2AB68] hover:bg-[#c29b58] text-white border border-[#D2AB68] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Creando...' : 'Crear Lista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
