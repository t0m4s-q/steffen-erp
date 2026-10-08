'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  type CostGainAnalysisDTO,
  formatArsDecimals,
  formatArsInteger,
  formatCostFactor,
} from '@/actions/cost-gain.dto';

interface CostGainViewProps {
  analysis: CostGainAnalysisDTO;
  basePath?: string;
}

export const CostGainView: React.FC<CostGainViewProps> = ({
  analysis,
  basePath = '/fabrica',
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'missing_price' | 'missing_cost'>('all');

  const { selectedProfile, availableProfiles, products } = analysis;

  // Cambiar perfil de descuento vía selector desplegable
  const handleSelectProfile = (profileId: string) => {
    if (profileId === selectedProfile.id) return;
    startTransition(() => {
      router.push(`${basePath}?profileId=${profileId}`);
    });
  };

  // Filtrado de productos en memoria
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Filtro de inactivos
      if (!showInactive && !p.productActive) return false;

      // Filtro de estado
      if (statusFilter === 'ready' && (!p.hasSalonPrice || !p.hasCost)) return false;
      if (statusFilter === 'missing_price' && p.hasSalonPrice) return false;
      if (statusFilter === 'missing_cost' && p.hasCost) return false;

      // Búsqueda por texto
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.productCode.toLowerCase().includes(term) ||
        p.productName.toLowerCase().includes(term) ||
        p.presentation.toLowerCase().includes(term)
      );
    });
  }, [products, showInactive, statusFilter, searchTerm]);

  // Contadores analíticos
  const counts = useMemo(() => {
    let withPrice = 0;
    let withCost = 0;
    let complete = 0;

    for (const p of products) {
      if (p.hasSalonPrice) withPrice++;
      if (p.hasCost) withCost++;
      if (p.hasSalonPrice && p.hasCost) complete++;
    }

    return { withPrice, withCost, complete };
  }, [products]);

  return (
    <div className="bg-white border border-[#D9D9D9] rounded-[5px] p-5" id="costo-ganancia">
      {/* Encabezado compacto y selector desplegable según Figma */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-[#E5E5E5]">
        <div>
          <h2 className="text-base font-bold text-black uppercase tracking-wider">
            Costo-Ganancia
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Simulación de rentabilidad por producto sobre Lista Salón • No modifica datos persistidos
          </p>
        </div>

        {/* Selector Desplegable de Descuento (select) */}
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="discount-profile-select" className="text-xs font-semibold text-gray-600">
            Simular Descuento:
          </label>
          <select
            id="discount-profile-select"
            value={selectedProfile.id}
            onChange={(e) => handleSelectProfile(e.target.value)}
            disabled={isPending}
            className="h-8 px-2.5 text-xs font-bold text-black bg-white border border-[#D9D9D9] rounded-[5px] focus:outline-none focus:border-[#0E50A0] cursor-pointer"
          >
            {availableProfiles.map((prof) => (
              <option key={prof.id} value={prof.id}>
                {prof.stepsSummary} {prof.name !== prof.stepsSummary ? `(${prof.name})` : ''}
              </option>
            ))}
          </select>
          {isPending && (
            <span className="text-[11px] text-[#0E50A0] font-semibold animate-pulse">
              Recalculando...
            </span>
          )}
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda Compacta */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ready')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'ready'
                ? 'bg-[#008102] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Con Precio y Costo ({counts.complete})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('missing_price')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'missing_price'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sin Precio ({products.length - counts.withPrice})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('missing_cost')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'missing_cost'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sin Costo ({products.length - counts.withCost})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-3.5 w-3.5 cursor-pointer"
            />
            <span>Ver inactivos</span>
          </label>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 pl-2.5 pr-7 text-xs border border-[#D9D9D9] rounded-[5px] w-36 sm:w-44 focus:outline-none focus:border-[#0E50A0] placeholder-gray-400 text-black"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tabla según formato de Figma MI-FABRICA */}
      {filteredProducts.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-xs font-medium">
          No se encontraron productos que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="max-h-[380px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px] sticky top-0 z-10">
                <th className="py-2.5 px-3 text-left w-[32%]">PRODUCTO FINAL</th>
                <th className="py-2.5 px-3 text-right w-[15%]">COSTO TOTAL</th>
                <th className="py-2.5 px-3 text-right w-[15%]">PRECIO LISTA</th>
                <th className="py-2.5 px-3 text-right w-[15%]">PRECIO FINAL</th>
                <th className="py-2.5 px-3 text-center w-[11%]">FACTOR</th>
                <th className="py-2.5 px-3 text-right w-[12%]">GANANCIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {filteredProducts.map((p) => {
                const isLoss = p.gainArs !== null && p.gainArs.startsWith('-');
                const isZeroGain = p.gainArs !== null && (p.gainArs === '0' || p.gainArs === '0.00');

                return (
                  <tr
                    key={p.productId}
                    className={`hover:bg-gray-50/80 transition-colors ${
                      !p.productActive ? 'opacity-60 bg-gray-50/40' : ''
                    }`}
                  >
                    {/* Producto Final */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-black">{p.productName}</span>
                        <span className="text-gray-400 font-mono text-[11px]">({p.productCode})</span>
                        {!p.productActive && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 text-gray-700">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {p.presentation} • {p.weightKg} kg
                      </div>
                    </td>

                    {/* Costo Total */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {p.hasCost ? (
                        <span className="font-mono text-gray-800 font-medium">
                          {formatArsDecimals(p.theoreticalCostArs)}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200"
                          title={p.costError || 'Sin fórmula vigente o insumos'}
                        >
                          Sin costo
                        </span>
                      )}
                    </td>

                    {/* Precio Lista Salón */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {p.hasSalonPrice ? (
                        <span className="font-mono text-black font-semibold">
                          {formatArsInteger(p.salonPriceArs)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Sin precio
                        </span>
                      )}
                    </td>

                    {/* Precio Final (Neto) */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {p.netPriceArs !== null ? (
                        <span className="font-mono text-black font-semibold">
                          {formatArsDecimals(p.netPriceArs)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Factor (x Costo) */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {p.markup !== null ? (
                        <span
                          className="font-mono font-bold text-gray-900"
                          title={`Multiplicador de costo: ${formatCostFactor(p.markup)}`}
                        >
                          {formatCostFactor(p.markup)}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Ganancia */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {p.gainArs !== null ? (
                        <span
                          className={`font-mono font-bold ${
                            isLoss
                              ? 'text-[#DD0000]'
                              : isZeroGain
                              ? 'text-gray-700'
                              : 'text-[#008102]'
                          }`}
                        >
                          {formatArsDecimals(p.gainArs)}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota al pie compacta */}
      <div className="mt-3 pt-2.5 border-t border-[#E5E5E5] flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] text-gray-500 gap-2">
        <div>
          Fórmulas: <code>Factor = Precio final / Costo total</code> • <code>Ganancia = Precio final - Costo total</code>
        </div>
        <div>
          Mostrando {filteredProducts.length} de {products.length} productos
        </div>
      </div>
    </div>
  );
};
