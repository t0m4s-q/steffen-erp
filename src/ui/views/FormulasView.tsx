'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Plus, Edit3, History, Power } from 'lucide-react';
import type { BaseProductDTO, ActiveRawMaterialDTO } from '@/actions/formula.dto';
import { toggleBaseProductActiveAction } from '@/actions/formula.actions';
import { NewFormulaModal } from '../modals/NewFormulaModal';
import { NewFormulaVersionModal } from '../modals/NewFormulaVersionModal';
import { FormulaHistoryModal } from '../modals/FormulaHistoryModal';
import { ConfirmDialog } from '../components/UIComponents';

interface FormulasViewProps {
  initialBaseProducts?: BaseProductDTO[];
  activeRawMaterials?: ActiveRawMaterialDTO[];
  defaultAction?: string;
}

export const FormulasView: React.FC<FormulasViewProps> = ({
  initialBaseProducts = [],
  activeRawMaterials = [],
  defaultAction,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedPbaId, setSelectedPbaId] = useState<string>(
    initialBaseProducts[0]?.id || ''
  );

  // Modales
  const [isNewFormulaModalOpen, setIsNewFormulaModalOpen] = useState(defaultAction === 'new');
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [editingBaseProduct, setEditingBaseProduct] = useState<BaseProductDTO | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const handleOpenEditVersion = (pba: BaseProductDTO) => {
    setEditingBaseProduct(pba);
    setIsNewVersionModalOpen(true);
  };

  const handleCloseEditVersion = () => {
    setIsNewVersionModalOpen(false);
    setEditingBaseProduct(null);
  };

  // Diálogo para cambiar estado activo
  const [confirmTogglePba, setConfirmTogglePba] = useState<BaseProductDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtrado de PBAs en memoria (lado cliente)
  const filteredBaseProducts = initialBaseProducts.filter((bp) => {
    if (!showInactive && !bp.active) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return bp.name.toLowerCase().includes(term) || bp.code.toLowerCase().includes(term);
  });

  // PBA actualmente seleccionado
  const selectedPba =
    initialBaseProducts.find((bp) => bp.id === selectedPbaId) ||
    filteredBaseProducts[0] ||
    null;

  const formatArs = (str: string | null | undefined) => {
    if (!str) return '$ 0';
    const num = parseFloat(str);
    if (isNaN(num)) return '$ 0';
    return `$ ${Math.round(num).toLocaleString('es-AR')}`;
  };

  const formatKg = (str: string | null | undefined) => {
    if (!str) return '0 kg';
    const num = parseFloat(str);
    if (isNaN(num)) return '0 kg';
    return `${num.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg`;
  };

  const handleToggleActiveClick = (pba: BaseProductDTO) => {
    if (pba.active) {
      setConfirmTogglePba(pba);
    } else {
      executeToggleActive(pba, true);
    }
  };

  const executeToggleActive = async (pba: BaseProductDTO, targetActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const res = await toggleBaseProductActiveAction(pba.id, targetActive);
      if (!res.success) {
        setActionError(res.error || 'Error al cambiar estado del Producto Base.');
      } else {
        router.refresh();
      }
      setConfirmTogglePba(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra Superior según Figma: FORMULAS.png */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/stock"
            className="inline-flex items-center gap-1 text-xs font-bold text-black hover:text-[#D2AB68] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-black uppercase">
            FORMULAS
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewFormulaModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E50A0] text-white hover:bg-blue-800 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            NUEVA FORMULA
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-[2px]">
          {actionError}
        </div>
      )}

      {/* Contenedor Principal según Figma: FORMULAS.png */}
      <div className="bg-white rounded-[5px] border border-[#D9D9D9] p-6 min-h-[560px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Panel Izquierdo: Lista de Productos Base (Columna 1 a 4) */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#D9D9D9] pb-6 lg:pb-0 lg:pr-6 flex flex-col">
            {/* Buscador de Productos Base */}
            <div className="mb-4 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar Producto Base o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-[#D9D9D9] text-xs rounded-[2px] focus:outline-none focus:border-[#0E50A0]"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                <span>{filteredBaseProducts.length} productos base</span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-[#D9D9D9] text-[#0E50A0] focus:ring-0"
                  />
                  <span>Mostrar inactivos</span>
                </label>
              </div>
            </div>

            {/* Listado de PBAs */}
            <div className="space-y-1 overflow-y-auto max-h-[500px] pr-1 flex-1">
              {filteredBaseProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 font-medium">
                  No se encontraron productos base.
                </div>
              ) : (
                filteredBaseProducts.map((bp) => {
                  const isSelected = selectedPba?.id === bp.id;
                  return (
                    <button
                      key={bp.id}
                      onClick={() => setSelectedPbaId(bp.id)}
                      className={`w-full text-left py-2.5 px-3 flex items-center justify-between transition-colors cursor-pointer rounded-[4px] group ${
                        isSelected
                          ? 'border-2 border-[#0E50A0] text-[#0E50A0] bg-[#0E50A0]/5 font-bold'
                          : 'border border-transparent text-[#1B1B1B] hover:bg-gray-100 font-medium'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs tracking-tight">{bp.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {bp.code} {bp.currentVersion ? `• v${bp.currentVersion}` : ''}
                          {!bp.active ? ' (Inactivo)' : ''}
                        </span>
                      </div>
                      <span
                        className={`text-xs ml-2 ${
                          isSelected ? 'text-[#0E50A0]' : 'text-[#0E50A0] opacity-80 group-hover:opacity-100'
                        }`}
                      >
                        ▶
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel Derecho: Ficha y Composición de Fórmula Vigente (Columna 5 a 12) */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            {selectedPba ? (
              <div className="space-y-6">
                {/* Cabecera del Producto Base según Figma: FORMULAS.png */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#D9D9D9]">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-xs uppercase text-black tracking-wider">
                      PRODUCTO BASE
                    </span>
                    <span className="font-bold text-base text-black">
                      {selectedPba.name}
                    </span>
                    {selectedPba.currentVersion && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-50 text-[#0E50A0] border border-blue-200 text-[10px] font-bold uppercase rounded-[2px]">
                        v{selectedPba.currentVersion} Vigente
                      </span>
                    )}
                    {!selectedPba.active && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded-[2px]">
                        Inactivo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-xs uppercase text-black tracking-wider">
                        CODIGO
                      </span>
                      <span className="font-mono font-bold text-xs text-black">
                        {selectedPba.code}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleActiveClick(selectedPba)}
                      title={selectedPba.active ? 'Desactivar Producto Base' : 'Activar Producto Base'}
                      className={`p-1.5 rounded hover:bg-black/5 transition-colors cursor-pointer ${
                        selectedPba.active ? 'text-gray-400 hover:text-red-600' : 'text-[#008102]'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase text-[#0E50A0] border border-[#0E50A0] hover:bg-blue-50 rounded-[2px] transition-colors cursor-pointer"
                      title="Ver versiones anteriores de esta fórmula"
                    >
                      <History className="w-3.5 h-3.5" />
                      Historial
                    </button>
                  </div>
                </div>

                {/* Tabla de Componentes de la Fórmula según Figma: FORMULAS.png */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px] text-left">
                        <th className="py-2.5 px-3 w-28">CODIGO</th>
                        <th className="py-2.5 px-3">MATERIA PRIMA</th>
                        <th className="py-2.5 px-3 text-right w-36">CANTIDAD (KG)</th>
                        <th className="py-2.5 px-3 text-right w-36">COSTO POR KILO</th>
                        <th className="py-2.5 px-3 text-right w-36">COSTO FINAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedPba.currentFormulaBreakdown?.lines &&
                      selectedPba.currentFormulaBreakdown.lines.length > 0 ? (
                        selectedPba.currentFormulaBreakdown.lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-mono font-bold text-black">
                              {line.rawMaterialCode}
                            </td>
                            <td className="py-3 px-3 font-semibold text-black">
                              {line.rawMaterialName}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-black">
                              {formatKg(line.quantityKg)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-gray-700">
                              {formatArs(line.currentUnitCost)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-black">
                              {formatArs(line.partialCost)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-gray-400 font-medium">
                            No se registran renglones en la fórmula vigente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Fila de Totales según Figma: FORMULAS.png */}
                {selectedPba.currentFormulaBreakdown && (
                  <div className="pt-4 border-t border-[#D9D9D9] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-black font-medium">Total Kg Granel:</span>
                      <span className="font-mono font-bold text-black">
                        {formatKg(selectedPba.currentFormulaBreakdown.totalKgBulk)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-black font-medium">Costo Granel:</span>
                      <span className="font-mono font-bold text-black">
                        {formatArs(selectedPba.currentFormulaBreakdown.totalCostBulkArs)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-black font-medium">Costo producto por kg:</span>
                      <span className="font-mono font-bold text-[#0E50A0]">
                        {formatArs(selectedPba.currentFormulaBreakdown.costPerKgPbaArs)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Botón inferior derecho: Editar Formula según Figma: FORMULAS.png */}
                <div className="pt-6 flex justify-end">
                  <button
                    onClick={() => handleOpenEditVersion(selectedPba)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0E50A0] text-white hover:bg-blue-800 text-xs font-bold uppercase rounded-[2px] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar Formula
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-gray-400 text-xs">
                Seleccione un Producto Base de la lista para consultar su fórmula.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nueva Formula (Alta PBA + v1) */}
      <NewFormulaModal
        isOpen={isNewFormulaModalOpen}
        activeRawMaterials={activeRawMaterials}
        onClose={() => setIsNewFormulaModalOpen(false)}
        onSuccess={(created) => {
          setSelectedPbaId(created.id);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Modal Editar Formula (Nueva Versión) */}
      {isNewVersionModalOpen && editingBaseProduct && (
        <NewFormulaVersionModal
          key={editingBaseProduct.id}
          isOpen={isNewVersionModalOpen}
          baseProduct={editingBaseProduct}
          activeRawMaterials={activeRawMaterials}
          onClose={handleCloseEditVersion}
          onSuccess={() => {
            handleCloseEditVersion();
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Modal Historial de Versiones */}
      {isHistoryModalOpen && selectedPba && (
        <FormulaHistoryModal
          key={selectedPba.id}
          isOpen={isHistoryModalOpen}
          baseProduct={selectedPba}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}

      {/* ConfirmDialog Desactivación PBA */}
      {confirmTogglePba && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Producto Base"
          message={`¿Estás seguro de que deseas desactivar el Producto Base "${confirmTogglePba.name}" (${confirmTogglePba.code})? Ya no se podrán crear nuevas versiones de fórmula ni asignarlo a nuevos productos.`}
          onConfirm={() => executeToggleActive(confirmTogglePba, false)}
          onCancel={() => setConfirmTogglePba(null)}
        />
      )}
    </div>
  );
};
