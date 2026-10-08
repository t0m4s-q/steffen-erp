'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Tag, AlertCircle, ShieldAlert } from 'lucide-react';
import { updatePriceListAction } from '@/actions/price-list.actions';
import type { PriceListDTO } from '@/actions/price-list.dto';

interface EditPriceListModalProps {
  isOpen: boolean;
  priceList: PriceListDTO;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditPriceListModal: React.FC<EditPriceListModalProps> = ({
  isOpen,
  priceList,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(priceList.name);
  const [active, setActive] = useState(priceList.active);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre de la lista de precios no puede ser vacío.');
      return;
    }

    startTransition(async () => {
      const res = await updatePriceListAction({
        id: priceList.id,
        name: name.trim() !== priceList.name ? name.trim() : undefined,
        active: !priceList.isSystem && active !== priceList.active ? active : undefined,
      });

      if (!res.success) {
        setError(res.error || 'Error al actualizar la lista de precios.');
        return;
      }

      router.refresh();
      if (onSuccess) {
        onSuccess();
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
              EDITAR LISTA DE PRECIOS
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
              disabled={isPending}
              autoFocus
              className="w-full h-10 px-3 text-xs border border-[#D9D9D9] rounded-[2px] focus:outline-none focus:border-[#0E50A0] text-black"
            />
          </div>

          {priceList.isSystem ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[2px] text-xs text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Lista protegida del sistema ({priceList.systemRoleLabel})</p>
                <p className="mt-0.5 text-amber-800">
                  Puede renombrar esta lista libremente sin perder su rol funcional interno, pero no puede ser desactivada ni eliminada.
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={isPending}
                  className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-4 w-4 cursor-pointer"
                />
                <span>Lista activa</span>
              </label>
              <p className="mt-1 text-[11px] text-gray-500">
                Si desactiva la lista, no estará disponible para nuevas ventas o pedidos hasta que se vuelva a activar.
              </p>
            </div>
          )}

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
              {isPending ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
