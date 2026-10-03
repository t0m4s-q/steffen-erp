// Reports View conforming to DESIGN.md Section 35 & BUSINESS_RULES.md Section 36

import React from 'react';
import { domainServices } from '../../services/domainServices';
import { MoneyDisplay } from '../components/UIComponents';

export const ReportsView: React.FC = () => {
  // Real-time derived queries conforming to Section 36 of BUSINESS_RULES.md
  const data = domainServices.getReportsData();

  return (
    <div className="space-y-6">
      {/* Title with Primary horizontal accent line conforming to DESIGN.md Section 35.1 */}
      <div>
        <h1 className="text-2xl font-bold text-[#000000] uppercase tracking-wider">REPORTES</h1>
        <div className="w-full h-1 bg-[#B99D22] mt-2 rounded-full"></div>
      </div>

      {/* Exactly Four Cards in 2x2 Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Card 1: Ventas del Mes */}
        <div className="bg-[#FBFBFB] border-2 border-[#B99D22] rounded-lg p-8 shadow-xs flex flex-col justify-between min-h-[180px]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#393939]">
            VENTAS DEL MES
          </span>
          <div className="my-auto">
            <span className="text-5xl font-black text-[#000000] tracking-tight">{data.salesCurrentMonth}</span>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Remitos (RTO) completados del mes calendario corriente
          </span>
        </div>

        {/* Card 2: Total Facturado */}
        <div className="bg-[#FBFBFB] border-2 border-[#B99D22] rounded-lg p-8 shadow-xs flex flex-col justify-between min-h-[180px]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#393939]">
            TOTAL FACTURADO
          </span>
          <div className="my-auto">
            <span className="text-4xl md:text-5xl font-black text-[#000000] tracking-tight">
              $ {Math.round(data.billedCurrentMonthArs).toLocaleString('es-AR')}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Suma de importes netos de venta (Total Pedido) sin saldo anterior
          </span>
        </div>

        {/* Card 3: Ganancia */}
        <div className="bg-[#008102] text-white rounded-lg p-8 shadow-xs flex flex-col justify-between min-h-[180px]">
          <span className="text-xs font-bold uppercase tracking-wider text-green-100">
            GANANCIA
          </span>
          <div className="my-auto">
            <span className="text-4xl md:text-5xl font-black text-white tracking-tight">
              $ {Math.round(data.gainCurrentMonthArs).toLocaleString('es-AR')}
            </span>
          </div>
          <span className="text-xs text-green-100 font-medium">
            Suma de ganancia real de los RTM completados del mes (descontando flete)
          </span>
        </div>

        {/* Card 4: Pedidos Abiertos */}
        <div className="bg-[#000000] text-white rounded-lg p-8 shadow-xs flex flex-col justify-between min-h-[180px]">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
            PEDIDOS ABIERTOS
          </span>
          <div className="my-auto">
            <span className="text-5xl font-black text-[#B99D22] tracking-tight">{data.openOrdersCount}</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Cantidad total de pedidos en estado ABIERTO (sin filtro mensual)
          </span>
        </div>
      </div>
    </div>
  );
};
