// Administration View conforming to DESIGN.md Section 22 & BUSINESS_RULES.md

import React, { useState } from 'react';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { Button, StatusBadge, MoneyDisplay } from '../components/UIComponents';
import { DollarSign, Eye, RefreshCw, Wallet, FileText, ArrowUpRight } from 'lucide-react';
import { UUID } from '../../types/domain';

export const AdminView: React.FC<{
  onOpenModal: (modalName: string, props?: any) => void;
}> = ({ onOpenModal }) => {
  const state = db.getState();

  // Exchange rate state
  const currentFx = domainServices.getCurrentExchangeRate();
  const currentFxObj = Object.values(state.exchangeRates).find((r) => r.is_current && r.currency_code === 'USD');
  const [newFxRate, setNewFxRate] = useState<number>(currentFx);
  const [fxMessage, setFxMessage] = useState<string>('');

  const handleUpdateFx = () => {
    try {
      domainServices.updateExchangeRate(Number(newFxRate), new Date().toISOString().slice(0, 10));
      setFxMessage('Cotización actualizada exitosamente');
      setTimeout(() => setFxMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar cotización');
    }
  };

  // Financial Accounts
  const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN')?.current_balance || 0;
  const cashML = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_MERCADO_LIBRE')?.current_balance || 0;

  const customerAccounts = Object.values(state.financialAccounts)
    .filter((a) => a.account_type === 'CUSTOMER_RECEIVABLE')
    .map((a) => {
      const cust = state.customers[a.customer_id!];
      return { account: a, customer: cust };
    })
    .sort((a, b) => b.account.current_balance - a.account.current_balance);

  const supplierAccounts = Object.values(state.financialAccounts)
    .filter((a) => a.account_type === 'SUPPLIER_PAYABLE' && a.current_balance > 0)
    .map((a) => {
      const supp = state.suppliers[a.supplier_id!];
      return { account: a, supplier: supp };
    })
    .sort((a, b) => b.account.current_balance - a.account.current_balance);

  const totalCustomerDebt = customerAccounts.reduce((sum, c) => sum + c.account.current_balance, 0);
  const totalSupplierDebt = supplierAccounts.reduce((sum, s) => sum + s.account.current_balance, 0);
  const netBalance = cashSteffen + cashML + totalCustomerDebt - totalSupplierDebt;

  // Completed Sales
  const completedSales = Object.values(state.remittances)
    .filter((r) => r.status === 'COMPLETED')
    .map((r) => {
      const rtm = Object.values(state.marginRemittances).find((m) => m.remittance_id === r.id);
      return { remittance: r, rtm };
    })
    .sort((a, b) => new Date(b.remittance.created_at).getTime() - new Date(a.remittance.created_at).getTime());

  // Patrimonial Movements (MOV)
  const patrimonialMovements = Object.values(state.patrimonialMovements).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg border border-[#D9D9D9]">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Administración y Finanzas</h1>
          <p className="text-xs text-gray-500">
            Control patrimonial, cotización del dólar, cuentas corrientes, liquidaciones y ventas históricas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secundario" onClick={() => onOpenModal('EXPENSE')} className="text-xs">
            + Gasto Operativo
          </Button>
          <Button variant="secundario" onClick={() => onOpenModal('WITHDRAWAL')} className="text-xs">
            - Retiro de Caja
          </Button>
          <Button variant="principal" onClick={() => onOpenModal('SETTLEMENT')} className="text-xs">
            Liquidar Mercado Libre
          </Button>
        </div>
      </div>

      {/* Row 1: Cotización Global & Cuentas Patrimoniales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cotización USD */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#B99D22]" />
            <h2 className="text-base font-bold text-[#000000]">Cotización Dólar Oficial / Global</h2>
          </div>
          <p className="text-xs text-gray-500">
            Actualiza inmediatamente el cálculo teórico de costos en pesos de materias primas e insumos cotizados en USD.
          </p>

          <div className="p-3 bg-gray-50 rounded border border-[#D9D9D9] flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-600">Cotización Actual Vigente:</span>
            <span className="text-xl font-bold text-[#B99D22]">$ {currentFx.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="1"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded flex-1 font-bold text-sm"
              value={newFxRate}
              onChange={(e) => setNewFxRate(parseFloat(e.target.value) || 0)}
            />
            <Button variant="principal" onClick={handleUpdateFx} className="flex items-center gap-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </Button>
          </div>

          {fxMessage && <p className="text-xs text-[#008102] font-semibold">{fxMessage}</p>}
          <span className="text-[11px] text-gray-400 block">
            Última actualización: {currentFxObj ? new Date(currentFxObj.created_at).toLocaleString('es-AR') : '-'}
          </span>
        </div>

        {/* Cuentas Patrimoniales */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-[#000000]">Cuentas y Posición Patrimonial</h2>
            <div className="flex gap-2">
              <Button variant="secundario" onClick={() => onOpenModal('PAYMENT_CUSTOMER')} className="h-8 text-xs">
                Cobro Cliente
              </Button>
              <Button variant="secundario" onClick={() => onOpenModal('PAYMENT_SUPPLIER')} className="h-8 text-xs">
                Pago Proveedor
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Caja Steffen</span>
              <p className="text-base font-bold text-[#000] mt-1">$ {Math.round(cashSteffen).toLocaleString('es-AR')}</p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Caja Mercado Libre</span>
              <p className="text-base font-bold text-[#000] mt-1">$ {Math.round(cashML).toLocaleString('es-AR')}</p>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <span className="text-[11px] text-green-700 uppercase font-semibold">Deudas Clientes</span>
              <p className="text-base font-bold text-[#008102] mt-1">$ {Math.round(totalCustomerDebt).toLocaleString('es-AR')}</p>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <span className="text-[11px] text-red-700 uppercase font-semibold">Deudas Proveedores</span>
              <p className="text-base font-bold text-[#DD0000] mt-1">$ {Math.round(totalSupplierDebt).toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="p-3 bg-[#FBFBFB] border-t-2 border-[#B99D22] rounded flex justify-between items-center">
            <span className="text-xs uppercase font-bold text-[#393939]">PATRIMONIO NETO REAL (ACTIVO - PASIVO):</span>
            <span className="text-xl font-bold text-[#B99D22]">$ {Math.round(netBalance).toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Cuentas Clientes y Cuentas Proveedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuentas Clientes */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <h2 className="text-base font-bold text-[#000000] mb-3">Resumen de Cuentas Clientes</h2>
          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#D9D9D9] text-gray-500 text-left">
                  <th className="py-2">CLIENTE</th>
                  <th className="py-2 text-right">SALDO DEUDA</th>
                  <th className="py-2 text-center">ACCIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerAccounts.map(({ account, customer }) => {
                  const hasDebt = account.current_balance > 0;
                  return (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-semibold text-[#000]">
                        {customer?.name} ({customer?.code})
                      </td>
                      <td className={`py-2.5 text-right font-bold ${hasDebt ? 'text-[#DD0000]' : 'text-gray-500'}`}>
                        $ {Math.round(account.current_balance).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2.5 text-center">
                        {hasDebt && (
                          <button
                            onClick={() => onOpenModal('PAYMENT_CUSTOMER')}
                            className="text-[#B99D22] font-bold hover:underline cursor-pointer"
                          >
                            Registrar Cobro
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deudas Proveedores */}
        <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
          <h2 className="text-base font-bold text-[#000000] mb-3">Deudas a Proveedores</h2>
          {supplierAccounts.length === 0 ? (
            <p className="text-sm text-[#008102] py-6 text-center font-medium">✓ No hay deudas pendientes a proveedores.</p>
          ) : (
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-[#D9D9D9] text-gray-500 text-left">
                    <th className="py-2">PROVEEDOR</th>
                    <th className="py-2 text-right">SALDO DEUDA</th>
                    <th className="py-2 text-center">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {supplierAccounts.map(({ account, supplier }) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-semibold text-[#000]">
                        {supplier?.name} ({supplier?.code})
                      </td>
                      <td className="py-2.5 text-right font-bold text-[#DD0000]">
                        $ {Math.round(account.current_balance).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          onClick={() => onOpenModal('PAYMENT_SUPPLIER')}
                          className="text-[#DD0000] font-bold hover:underline cursor-pointer"
                        >
                          Pagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Ventas Cerradas Históricas (con PDFs de RTO y RTM) */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-3">
        <h2 className="text-base font-bold text-[#000000]">Historial de Ventas Confirmadas</h2>
        {completedSales.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No hay ventas finalizadas todavía.</p>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#D9D9D9] text-gray-500 text-left bg-gray-50">
                  <th className="py-2.5 px-3">FECHA</th>
                  <th className="py-2.5 px-3">CLIENTE / DESTINATARIO</th>
                  <th className="py-2.5 px-3 text-right">TOTAL PEDIDO</th>
                  <th className="py-2.5 px-3 text-right">GANANCIA REAL</th>
                  <th className="py-2.5 px-3 text-center">N.º RTO</th>
                  <th className="py-2.5 px-3 text-center">DOCUMENTOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {completedSales.map(({ remittance, rtm }) => (
                  <tr key={remittance.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 text-gray-600">
                      {new Date(remittance.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#000]">
                      {remittance.recipient_name_snapshot || 'Consumidor'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sm">
                      $ {Math.round(remittance.total_order_ars).toLocaleString('es-AR')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sm text-[#008102]">
                      $ {Math.round(rtm?.gain_ars || 0).toLocaleString('es-AR')}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-[#B99D22]">{remittance.code}</td>
                    <td className="py-3 px-3 text-center space-x-2">
                      <Button
                        variant="secundario"
                        onClick={() => onOpenModal('VIEW_PDF', { docType: 'RTO', docId: remittance.id })}
                        className="h-7 px-2 text-[11px]"
                      >
                        Ver RTO
                      </Button>
                      {rtm && (
                        <Button
                          variant="secundario"
                          onClick={() => onOpenModal('VIEW_PDF', { docType: 'RTM', docId: rtm.id })}
                          className="h-7 px-2 text-[11px]"
                        >
                          Ver RTM
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 4: Movimientos Patrimoniales (MOV) */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-3">
        <h2 className="text-base font-bold text-[#000000]">Últimos Movimientos Patrimoniales (MOV)</h2>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#D9D9D9] text-gray-500 text-left bg-gray-50">
                <th className="py-2.5 px-3">CÓDIGO MOV</th>
                <th className="py-2.5 px-3">FECHA</th>
                <th className="py-2.5 px-3">TIPO</th>
                <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                <th className="py-2.5 px-3 text-right">IMPORTE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patrimonialMovements.slice(0, 20).map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-bold text-gray-700">{mov.code}</td>
                  <td className="py-2.5 px-3 text-gray-500">
                    {new Date(mov.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-800 text-[11px]">
                      {mov.movement_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-700">{mov.description}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-sm">
                    $ {Math.round(mov.amount_ars).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
