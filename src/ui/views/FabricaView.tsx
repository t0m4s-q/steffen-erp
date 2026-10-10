'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Package,
  Plus,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';
import { type CostGainAnalysisDTO } from '@/actions/cost-gain.dto';
import { CostGainView } from './CostGainView';
import { RegistrarFabricacionModal, type BaseProductOption } from '@/ui/modals/RegistrarFabricacionModal';
import type { BulkLotDTO, FactoryMovementDTO } from '@/actions/factory.dto';

export interface FabricaFormulaOptionDTO {
  id: string;
  name: string;
  code: string;
  items: Array<{
    rawMaterialName: string;
    quantityKg: string;
  }>;
}

export interface FabricaLowStockProductDTO {
  id: string;
  name: string;
  stockMinimum: string;
  stockActual: string;
  isCritical: boolean;
}

interface FabricaViewProps {
  costGainAnalysis: CostGainAnalysisDTO;
  formulaOptions?: FabricaFormulaOptionDTO[];
  lowStockProducts?: FabricaLowStockProductDTO[];
  bulkLots?: BulkLotDTO[];
  factoryMovements?: FactoryMovementDTO[];
  baseProductsForFabrication?: BaseProductOption[];
}

export const FabricaView: React.FC<FabricaViewProps> = ({
  costGainAnalysis,
  formulaOptions = [],
  lowStockProducts = [],
  bulkLots = [],
  factoryMovements = [],
  baseProductsForFabrication = [],
}) => {
  const router = useRouter();
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>(
    formulaOptions[0]?.id || ''
  );
  const [isFabricacionModalOpen, setIsFabricacionModalOpen] = useState<boolean>(false);

  const activeFormula = formulaOptions.find((f) => f.id === selectedFormulaId) || formulaOptions[0] || null;

  return (
    <div className="max-w-[1600px] mx-auto pb-16 space-y-5">
      {/* 1. Fila Superior: Disponible en granel + Registrar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Disponible en granel (2 columnas en desktop, altura fija con scroll interno) */}
        <div className="lg:col-span-2 bg-white border border-[#D9D9D9] rounded-[5px] p-5 h-[240px] flex flex-col justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3 pb-1 border-b border-black">
              <h2 className="text-base font-bold text-black uppercase tracking-wider">
                Disponible en granel
              </h2>
              <span className="text-xs text-neutral-400">Lotes abiertos de fabricación</span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px] sticky top-0 z-10">
                    <th className="py-2.5 px-3 text-left w-[20%]">CODIGO</th>
                    <th className="py-2.5 px-3 text-left w-[25%]">FECHA</th>
                    <th className="py-2.5 px-3 text-left w-[35%]">PRODUCTO BASE</th>
                    <th className="py-2.5 px-3 text-right w-[20%]">GRANEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {bulkLots.length > 0 ? (
                    bulkLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-black">{lot.code}</td>
                        <td className="py-2.5 px-3 text-gray-700">{lot.businessDate}</td>
                        <td className="py-2.5 px-3 font-semibold text-black truncate max-w-0">
                          {lot.baseProductName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-black">
                          {lot.kgAvailable} Kg
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-xs text-neutral-400">
                        Sin lotes a granel disponibles
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Registrar (Acciones directas, altura proporcional) */}
        <div className="bg-white border border-[#D9D9D9] rounded-[5px] p-5 h-[240px] flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-black uppercase tracking-wider mb-3 pb-1 border-b border-black">
              Registrar
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <button
                type="button"
                onClick={() => setIsFabricacionModalOpen(true)}
                className="h-12 bg-[#0E50A0] hover:bg-[#0c4386] cursor-pointer text-white rounded-[5px] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                title="Registrar nueva fabricación de granel"
              >
                <Factory className="w-4 h-4" />
                <span>Fabricación</span>
              </button>
              <button
                type="button"
                className="h-12 bg-[#0E50A0] opacity-80 cursor-not-allowed text-white rounded-[5px] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                title="Módulo de Envasado próximo en Fase 4"
                disabled
              >
                <Package className="w-4 h-4" />
                <span>Envasado</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E5E5E5]">
            <Link
              href="/stock?tab=productos&action=new"
              className="h-8 px-3.5 bg-[#D2AB68] hover:bg-[#c29b58] text-white rounded-[5px] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Producto</span>
            </Link>
            <Link
              href="/stock?tab=productos"
              className="text-xs font-bold text-[#0E50A0] hover:underline inline-flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Fila Media: Próximas fabricaciones + Fórmulas Granel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Próximas fabricaciones (bajo stock, 2 columnas, altura fija con scroll interno) */}
        <div className="lg:col-span-2 bg-white border border-[#D9D9D9] rounded-[5px] p-5 h-[320px] flex flex-col justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3 pb-1 border-b border-black">
              <h2 className="text-base font-bold text-black uppercase tracking-wider">
                Próximas fabricaciones (bajo stock)
              </h2>
              <span className="text-xs text-neutral-400">Alertas de producción</span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px] sticky top-0 z-10">
                    <th className="py-2.5 px-3 text-left w-[40%]">PRODUCTO FINAL</th>
                    <th className="py-2.5 px-3 text-center w-[15%]">STOCK MINIMO</th>
                    <th className="py-2.5 px-3 text-center w-[15%]">STOCK ACTUAL</th>
                    <th className="py-2.5 px-3 text-center w-[20%]">ESTADO</th>
                    <th className="py-2.5 px-3 text-center w-[10%]">SIMULAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {lowStockProducts.length > 0 ? (
                    lowStockProducts.map((p) => (
                      <tr
                        key={p.id}
                        className={
                          p.isCritical
                            ? 'bg-[#FFA8A8] text-black font-medium transition-colors'
                            : 'hover:bg-gray-50/80 transition-colors'
                        }
                      >
                        <td className="py-2.5 px-3 font-semibold text-black truncate max-w-0">{p.name}</td>
                        <td className="py-2.5 px-3 text-center text-gray-700">{p.stockMinimum}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#DD0000]">
                          {p.stockActual}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {p.isCritical ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#DD0000] text-white">
                              URG PARA PEDIDOS
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              POCO STOCK
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <FlaskConical className="w-4 h-4 text-gray-600 inline-block hover:text-black cursor-pointer" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-neutral-400">
                        Sin alertas de producción bajo stock
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fórmulas Granel (Altura fija 320px) */}
        <div className="bg-white border border-[#D9D9D9] rounded-[5px] p-5 h-[320px] flex flex-col justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-black">
              <h2 className="text-base font-bold text-black uppercase tracking-wider">
                FORMULAS GRANEL
              </h2>
            </div>

            <div className="mb-2">
              <select
                value={selectedFormulaId}
                onChange={(e) => setSelectedFormulaId(e.target.value)}
                className="w-full h-8 px-2.5 text-xs border border-[#D9D9D9] rounded-[5px] bg-white text-gray-700 focus:outline-none focus:border-[#0E50A0] cursor-pointer"
              >
                {formulaOptions.length === 0 && (
                  <option value="">No hay fórmulas cargadas</option>
                )}
                {formulaOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 mb-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px] sticky top-0 z-10">
                    <th className="py-2 px-2 text-left w-[65%]">MATERIA PRIMA</th>
                    <th className="py-2 px-2 text-right w-[35%]">CANTIDAD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {activeFormula && activeFormula.items.length > 0 ? (
                    activeFormula.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-2 text-gray-800 truncate max-w-0">{it.rawMaterialName}</td>
                        <td className="py-2 px-2 text-right font-mono font-medium whitespace-nowrap">
                          {it.quantityKg} kg
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-xs text-neutral-400">
                        Seleccione un producto base para ver su fórmula
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5]">
            <Link
              href="/formulas?action=new"
              className="h-8 px-3 bg-[#0E50A0] hover:bg-[#0c4386] text-white rounded-[5px] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Nueva fórmula</span>
            </Link>
            <Link
              href="/formulas"
              className="text-xs font-bold text-[#0E50A0] hover:underline inline-flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Sección Canónica de Costo-Ganancia (Real Backend Data) */}
      <CostGainView analysis={costGainAnalysis} basePath="/fabrica" />

      {/* 4. Fila Inferior: Movimientos de fábrica (Altura fija con scroll interno) */}
      <div className="bg-white border border-[#D9D9D9] rounded-[5px] p-5 h-[300px] flex flex-col justify-between">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3 pb-1 border-b border-black">
            <h2 className="text-base font-bold text-black uppercase tracking-wider">
              Movimientos de fábrica
            </h2>
            <span className="text-xs text-neutral-400">Historial reciente de producción</span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D9D9D9] text-black font-bold uppercase text-[11px] sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-left w-[15%]">CODIGO</th>
                  <th className="py-2.5 px-3 text-left w-[15%]">FECHA</th>
                  <th className="py-2.5 px-3 text-left w-[15%]">TIPO</th>
                  <th className="py-2.5 px-3 text-left w-[35%]">DESCRIPCION</th>
                  <th className="py-2.5 px-3 text-right w-[20%]">REGISTRO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {factoryMovements.length > 0 ? (
                  factoryMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold text-black">{mov.code}</td>
                      <td className="py-2.5 px-3 text-gray-700">{mov.businessDate}</td>
                      <td className="py-2.5 px-3 text-gray-900 font-medium">{mov.movementType}</td>
                      <td className="py-2.5 px-3 text-gray-700 truncate max-w-0">{mov.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-600 text-[11px]">
                        {mov.movementType === 'FABRICACIÓN' || mov.movementType === 'FABRICACION'
                          ? '- MATERIA PRIMA + GRANEL'
                          : mov.movementType === 'ENVASADO'
                          ? '- GRANEL - COMPONENTES + PRODUCTOS'
                          : mov.movementType === 'MERMA'
                          ? '- GRANEL'
                          : mov.movementType === 'SOBRANTE'
                          ? '+ PRODUCTOS'
                          : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-neutral-400">
                      Sin movimientos de fábrica registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Registro de Fabricación */}
      <RegistrarFabricacionModal
        isOpen={isFabricacionModalOpen}
        onClose={() => setIsFabricacionModalOpen(false)}
        onSuccess={() => router.refresh()}
        baseProducts={baseProductsForFabrication}
      />
    </div>
  );
};
