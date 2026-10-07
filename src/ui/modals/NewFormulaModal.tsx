'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { createBaseProductWithFormulaAction } from '@/actions/formula.actions';
import type { ActiveRawMaterialDTO, BaseProductDTO } from '@/actions/formula.dto';

interface NewFormulaModalProps {
  isOpen: boolean;
  activeRawMaterials: ActiveRawMaterialDTO[];
  onClose: () => void;
  onSuccess: (createdPba: BaseProductDTO) => void;
}

interface FormRow {
  rawMaterialId: string;
  quantityKg: string;
}

export const NewFormulaModal: React.FC<NewFormulaModalProps> = ({
  isOpen,
  activeRawMaterials,
  onClose,
  onSuccess,
}) => {
  const [pbaName, setPbaName] = useState('');
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState('');
  const [rows, setRows] = useState<FormRow[]>([
    { rawMaterialId: '', quantityKg: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows([...rows, { rawMaterialId: '', quantityKg: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof FormRow, value: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  // Cálculos reactivos informativos en base a selección y costos reales de backend
  const calculateRowCosts = (row: FormRow) => {
    const mpr = activeRawMaterials.find((m) => m.id === row.rawMaterialId);
    const unitCost = mpr?.currentTheoreticalCostGrossArs
      ? parseFloat(mpr.currentTheoreticalCostGrossArs)
      : 0;
    const qty = parseFloat(row.quantityKg) || 0;
    const lineCost = qty * unitCost;

    return {
      unitCost,
      lineCost,
      unitCostFormatted: unitCost > 0
        ? `$ ${Math.round(unitCost).toLocaleString('es-AR')}`
        : mpr ? 'Sin cotización' : 'Automatico',
      lineCostFormatted: lineCost > 0
        ? `$ ${Math.round(lineCost).toLocaleString('es-AR')}`
        : 'Automatico',
    };
  };

  const totalKg = rows.reduce((acc, r) => acc + (parseFloat(r.quantityKg) || 0), 0);
  const totalCost = rows.reduce((acc, r) => acc + calculateRowCosts(r).lineCost, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pbaName.trim()) {
      setError('El nombre del Producto Base es obligatorio.');
      return;
    }

    if (rows.length === 0) {
      setError('La fórmula debe contener al menos una Materia Prima.');
      return;
    }

    const seenMprs = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.rawMaterialId) {
        setError(`Debe seleccionar una Materia Prima en el renglón ${i + 1}.`);
        return;
      }
      if (seenMprs.has(r.rawMaterialId)) {
        const mprName = activeRawMaterials.find((m) => m.id === r.rawMaterialId)?.name || '';
        setError(`La Materia Prima "${mprName}" está duplicada. Cada insumo solo puede incluirse una vez.`);
        return;
      }
      seenMprs.add(r.rawMaterialId);

      const qty = parseFloat(r.quantityKg);
      if (isNaN(qty) || qty <= 0) {
        setError(`La cantidad en el renglón ${i + 1} debe ser mayor a 0 kg.`);
        return;
      }

      // Validar máximo 3 decimales
      const parts = r.quantityKg.trim().split('.');
      if (parts.length > 1 && parts[1].length > 3) {
        setError(`La cantidad en el renglón ${i + 1} no puede superar 3 decimales.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await createBaseProductWithFormulaAction({
        name: pbaName.trim(),
        items: rows.map((r, idx) => ({
          rawMaterialId: r.rawMaterialId,
          quantityKg: r.quantityKg.trim(),
          sortOrder: idx + 1,
        })),
        observations: observations.trim() || null,
        businessDate,
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Error al crear la fórmula.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al comunicarse con el servidor.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl bg-white border border-[#D9D9D9] rounded-[4px] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9D9D9]">
          <h2 className="text-xl font-bold tracking-tight text-black uppercase">
            NUEVA FORMULA
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-[2px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Fila superior de datos principales según Figma: NUEVA-FORMULA.png */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Codigo
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-[#D9D9D9] text-xs text-gray-500 font-mono rounded-[2px]">
                  Automatico (PBAxxxx)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Producto Base <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Shampoo Semi de Lino"
                  value={pbaName}
                  onChange={(e) => setPbaName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                  required
                />
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Fecha creacion
                </label>
                <input
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Notas de formulación (opcional)"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Renglones de Ingredientes según Figma: NUEVA-FORMULA.png */}
          <div className="border-t border-[#D9D9D9] pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D9D9D9] text-black font-bold uppercase text-left">
                    <th className="py-2 px-2 w-36">Cantidad (kg)</th>
                    <th className="py-2 px-2">Materia prima</th>
                    <th className="py-2 px-2 w-32 text-right">Costo por kilo</th>
                    <th className="py-2 px-2 w-32 text-right">Costo total</th>
                    <th className="py-2 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, idx) => {
                    const rowCosts = calculateRowCosts(row);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        {/* Cantidad */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="0.000"
                            value={row.quantityKg}
                            onChange={(e) => handleRowChange(idx, 'quantityKg', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D9D9D9] text-xs font-mono rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                            required
                          />
                        </td>

                        {/* Selector Materia Prima */}
                        <td className="py-2 px-2">
                          <select
                            value={row.rawMaterialId}
                            onChange={(e) => handleRowChange(idx, 'rawMaterialId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0] bg-white"
                            required
                          >
                            <option value="">Seleccionar Materia Prima...</option>
                            {activeRawMaterials.map((mpr) => (
                              <option key={mpr.id} value={mpr.id}>
                                {mpr.code} — {mpr.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Costo por Kilo Informativo */}
                        <td className="py-2 px-2 text-right font-mono text-gray-700">
                          {rowCosts.unitCostFormatted}
                        </td>

                        {/* Costo Total Renglón */}
                        <td className="py-2 px-2 text-right font-mono font-semibold text-black">
                          {rowCosts.lineCostFormatted}
                        </td>

                        {/* Acción Eliminar */}
                        <td className="py-2 px-2 text-center">
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Botón Agregar materia prima según Figma (Negro con texto dorado) */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-[#D2AB68] hover:bg-neutral-800 text-xs font-bold rounded-[2px] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar materia prima
              </button>
            </div>
          </div>

          {/* Resumen inferior según Figma: KG GRANEL y Costo Granel */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 bg-gray-50 border border-[#D9D9D9] rounded-[2px] text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-black uppercase tracking-wider">KG GRANEL</span>
              <span className="font-mono font-bold text-black">
                {totalKg > 0 ? `${totalKg.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg` : 'Automatico'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-black uppercase tracking-wider">Costo Granel:</span>
              <span className="font-mono font-bold text-black">
                {totalCost > 0 ? `$ ${Math.round(totalCost).toLocaleString('es-AR')}` : 'Automatico'}
              </span>
            </div>
          </div>

          {/* Botones de acción según Figma: Cancelar (Rojo) y Crear formula (Azul) */}
          <div className="flex items-center justify-center gap-3 pt-4 border-t border-[#D9D9D9]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-36 py-2 bg-[#DD0000] text-white hover:bg-red-700 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-44 py-2 bg-[#0E50A0] text-white hover:bg-blue-800 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creando...' : 'Crear formula'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
