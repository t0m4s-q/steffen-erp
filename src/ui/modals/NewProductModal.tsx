'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { createFinalProductAction } from '@/actions/product.actions';
import type {
  BaseProductOptionDTO,
  ComponentOptionDTO,
  FinalProductDTO,
} from '@/actions/product.dto';

interface NewProductModalProps {
  isOpen: boolean;
  baseProducts: BaseProductOptionDTO[];
  components: ComponentOptionDTO[];
  onClose: () => void;
  onSuccess?: (newProduct?: FinalProductDTO) => void;
}

interface ComponentRow {
  componentId: string;
  quantityPerUnit: string;
}

export const NewProductModal: React.FC<NewProductModalProps> = ({
  isOpen,
  baseProducts,
  components,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [baseProductId, setBaseProductId] = useState('');
  const [presentation, setPresentation] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [stockMinimum, setStockMinimum] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [createdDate, setCreatedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [bomRows, setBomRows] = useState<ComponentRow[]>([
    { componentId: '', quantityPerUnit: '1' },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setBomRows([...bomRows, { componentId: '', quantityPerUnit: '1' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (bomRows.length <= 1) return;
    setBomRows(bomRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof ComponentRow, value: string) => {
    const updated = [...bomRows];
    updated[index] = { ...updated[index], [field]: value };
    setBomRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del Producto Final es obligatorio.');
      return;
    }

    if (!baseProductId) {
      setError('Debe seleccionar un Producto Base (PBA) con fórmula vigente.');
      return;
    }

    if (!presentation.trim()) {
      setError('La presentación comercial es obligatoria (ej: Botella 1000cc).');
      return;
    }

    const weightNum = parseFloat(weightKg);
    if (isNaN(weightNum) || weightNum <= 0) {
      setError('El peso/contenido debe ser mayor a 0 kg.');
      return;
    }

    const weightParts = weightKg.trim().split('.');
    if (weightParts.length > 1 && weightParts[1].length > 3) {
      setError('El peso/contenido en kg admite como máximo 3 decimales.');
      return;
    }

    const minStockNum = Number(stockMinimum);
    if (!Number.isInteger(minStockNum) || minStockNum <= 0) {
      setError('El stock mínimo debe ser un número entero mayor a 0.');
      return;
    }

    const initStockNum = Number(initialStock);
    if (!Number.isInteger(initStockNum) || initStockNum < 0) {
      setError('El stock inicial debe ser un número entero mayor o igual a 0.');
      return;
    }

    if (bomRows.length === 0) {
      setError('Debe incluir al menos un componente en el BOM.');
      return;
    }

    const seenComps = new Set<string>();
    for (let i = 0; i < bomRows.length; i++) {
      const row = bomRows[i];
      if (!row.componentId) {
        setError(`Debe seleccionar un Componente en la fila ${i + 1}.`);
        return;
      }
      if (seenComps.has(row.componentId)) {
        const compName = components.find((c) => c.id === row.componentId)?.name || '';
        setError(`El componente "${compName}" está duplicado. Cada insumo solo puede agregarse una vez.`);
        return;
      }
      seenComps.add(row.componentId);

      const qty = Number(row.quantityPerUnit);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError(`La cantidad del componente en la fila ${i + 1} debe ser un entero mayor a 0.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await createFinalProductAction({
        name: name.trim(),
        baseProductId,
        presentation: presentation.trim(),
        weightKg: weightKg.trim(),
        stockMinimum: minStockNum,
        initialStock: initStockNum,
        createdDate,
        components: bomRows.map((r, idx) => ({
          componentId: r.componentId,
          quantityPerUnit: Number(r.quantityPerUnit),
          sortOrder: idx + 1,
        })),
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Error al crear el Producto Final.');
        setIsSubmitting(false);
        return;
      }

      if (onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de comunicación al crear producto.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl bg-white border border-[#D9D9D9] rounded-[4px] shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        {/* Encabezado según Figma NUEVO-PRODUCTO.png */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9D9D9]">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-black uppercase">
              NUEVO PRODUCTO
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Alta integral de Producto Final (PRO) con PBA, presentación y BOM de componentes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-[2px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Nombre principal */}
          <div>
            <label className="block text-xs font-bold text-black uppercase mb-1">
              Nombre del Producto Final *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Shampoo Semi de Lino 1000cc"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
            />
          </div>

          {/* Grilla de Datos según Figma NUEVO-PRODUCTO.png */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Codigo
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-[#D9D9D9] text-xs font-mono font-bold text-gray-500 rounded-[2px]">
                  Automatico (PROxxxx)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Producto Base *
                </label>
                <select
                  required
                  value={baseProductId}
                  onChange={(e) => setBaseProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0] bg-white cursor-pointer"
                >
                  <option value="">Seleccionar Producto Base</option>
                  {baseProducts.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.code} — {bp.name} {bp.currentVersion ? `(v${bp.currentVersion})` : ''}
                    </option>
                  ))}
                </select>
                {baseProducts.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No hay Productos Base con fórmula vigente activa disponibles.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Peso / Contenido en Granel (kg) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.000 (ej: 0.180 para 180g)"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-mono rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Stock minimo (unidades) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="Ej: 50"
                  value={stockMinimum}
                  onChange={(e) => setStockMinimum(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-mono rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
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
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Presentacion comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Botella 1000cc / Pote 180g"
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">
                  Stock Inicial (unidades opcional)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9D9D9] text-xs font-mono rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Si es mayor a 0, se creará un movimiento de ajuste inicial (MST) automáticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de BOM de Componentes según Figma NUEVO-PRODUCTO.png */}
          <div className="border-t border-[#D9D9D9] pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                COMPOSICIÓN DE COMPONENTES (BOM)
              </h3>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-[#D2AB68] hover:bg-neutral-800 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar componente
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D9D9D9] text-black font-bold uppercase text-left">
                    <th className="py-2 px-2 w-36">Cantidad</th>
                    <th className="py-2 px-2">Componentes</th>
                    <th className="py-2 px-2 w-32 text-right">Costo total</th>
                    <th className="py-2 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bomRows.map((row, idx) => {
                    const comp = components.find((c) => c.id === row.componentId);
                    const unitCost = comp?.currentTheoreticalCostGrossArs
                      ? parseFloat(comp.currentTheoreticalCostGrossArs)
                      : 0;
                    const qty = parseInt(row.quantityPerUnit, 10) || 0;
                    const lineCost = qty * unitCost;

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        {/* Cantidad entera */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            placeholder="1"
                            value={row.quantityPerUnit}
                            onChange={(e) => handleRowChange(idx, 'quantityPerUnit', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D9D9D9] text-xs font-mono rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                          />
                        </td>

                        {/* Selector de Componente */}
                        <td className="py-2 px-2">
                          <select
                            value={row.componentId}
                            onChange={(e) => handleRowChange(idx, 'componentId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0] bg-white cursor-pointer"
                          >
                            <option value="">Seleccionar Componente</option>
                            {components.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} — {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Costo de línea estimado */}
                        <td className="py-2 px-2 text-right font-mono text-gray-700">
                          {lineCost > 0
                            ? `$ ${Math.round(lineCost).toLocaleString('es-AR')}`
                            : 'Automatico'}
                        </td>

                        {/* Eliminar fila */}
                        <td className="py-2 px-2 text-center">
                          {bomRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Quitar componente"
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

            {/* Fila de Totales informativos según Figma NUEVO-PRODUCTO.png */}
            <div className="pt-4 mt-2 border-t border-[#D9D9D9] flex flex-wrap items-center justify-between text-xs text-gray-700 font-semibold">
              <div className="flex items-center gap-2">
                <span>Costo extra variable:</span>
                <span className="font-bold text-black">2% fijo</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Costo total:</span>
                <span className="font-mono font-bold text-[#0E50A0]">
                  Automatico por CostEngine
                </span>
              </div>
            </div>
          </div>

          {/* Botones Inferiores según Figma NUEVO-PRODUCTO.png */}
          <div className="pt-4 border-t border-[#D9D9D9] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#DD0000] text-white hover:bg-red-700 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0E50A0] text-white hover:bg-blue-800 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
