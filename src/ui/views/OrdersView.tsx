// Orders View (Pedidos y Planificación) conforming to DESIGN.md Section 18 & BUSINESS_RULES.md Section 13-18

import React, { useState } from 'react';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { Button, StatusBadge, MoneyDisplay, ConfirmDialog } from '../components/UIComponents';
import { ShoppingCart, Eye, ArrowUp, ArrowDown, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import { UUID, Order } from '../../types/domain';

export const OrdersView: React.FC<{
  onOpenModal: (modalName: string, props?: any) => void;
}> = ({ onOpenModal }) => {
  const state = db.getState();
  const openOrders = Object.values(state.orders)
    .filter((o) => o.status === 'OPEN')
    .sort((a, b) => a.planning_sort_key - b.planning_sort_key);

  const pendingRtm = Object.values(state.remittances).find((r) => r.status === 'RTM_PENDING');
  const planningData = domainServices.calculateOrderPlanning();

  // Selected Order for detail / RTO confirmation
  const [selectedOrderId, setSelectedOrderId] = useState<UUID | null>(null);
  const selectedOrder = selectedOrderId ? state.orders[selectedOrderId] : null;

  // AG quantities map for selected order
  const [agMap, setAgMap] = useState<Record<UUID, number>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // When opening an order, initialize AG map
  const openOrderDetail = (orderId: UUID) => {
    setSelectedOrderId(orderId);
    setErrorMsg('');
    const items = Object.values(state.orderItems).filter((oi) => oi.order_id === orderId);
    const initialAg: Record<UUID, number> = {};
    items.forEach((i) => {
      initialAg[i.id] = i.ag_quantity !== undefined ? i.ag_quantity : i.requested_quantity;
    });
    setAgMap(initialAg);
  };

  // Reorder product rows
  const moveProductPriority = (productId: UUID, direction: 'UP' | 'DOWN') => {
    const list = [...planningData.products];
    const index = list.findIndex((p) => p.productId === productId);
    if (index === -1) return;
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === list.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    db.transaction((st) => {
      list.forEach((p, idx) => {
        st.planningProductPriorities[p.productId] = {
          product_id: p.productId,
          sort_key: idx + 1,
          updated_at: new Date().toISOString(),
        };
      });
    });
  };

  // Reorder order columns
  const moveOrderPriority = (orderId: UUID, direction: 'LEFT' | 'RIGHT') => {
    const list = [...openOrders];
    const index = list.findIndex((o) => o.id === orderId);
    if (index === -1) return;
    if (direction === 'LEFT' && index === 0) return;
    if (direction === 'RIGHT' && index === list.length - 1) return;

    const targetIndex = direction === 'LEFT' ? index - 1 : index + 1;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    db.transaction((st) => {
      list.forEach((o, idx) => {
        st.orders[o.id].planning_sort_key = idx + 1;
      });
    });
  };

  // Confirm RTO
  const handleConfirmRto = () => {
    if (!selectedOrderId) return;
    setErrorMsg('');
    try {
      const rto = domainServices.confirmRto({
        orderId: selectedOrderId,
        agQuantities: agMap,
        businessDate: new Date().toISOString().slice(0, 10),
      });
      setSelectedOrderId(null);
      // Immediately offer or prompt complete RTM
      onOpenModal('COMPLETE_RTM', { remittanceId: rto.id });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al confirmar RTO');
    }
  };

  // Delete Open Order
  const handleDeleteOrder = () => {
    if (!selectedOrderId) return;
    db.transaction((st) => {
      st.orders[selectedOrderId].status = 'CANCELLED';
    });
    setDeleteConfirmOpen(false);
    setSelectedOrderId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg border border-[#D9D9D9]">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Pedidos</h1>
          <p className="text-xs text-gray-500">
            Gestión de pedidos comerciales abiertos, matriz de planificación virtual y confirmación de Remito (RTO).
          </p>
        </div>
        <Button variant="principal" onClick={() => onOpenModal('NEW_ORDER')} className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Nuevo Pedido
        </Button>
      </div>

      {/* Mandatory Pending RTM Banner */}
      {pendingRtm && (
        <div className="p-4 bg-amber-100 border-2 border-amber-500 rounded-lg flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
            <div>
              <p className="font-bold text-amber-900 text-sm">
                ACCIÓN OBLIGATORIA: El Remito {pendingRtm.code} requiere completar su RTM
              </p>
              <p className="text-xs text-amber-800">
                El sistema bloquea la confirmación de nuevos remitos hasta cerrar el costo de flete y ganancia pendiente.
              </p>
            </div>
          </div>
          <Button variant="principal" onClick={() => onOpenModal('COMPLETE_RTM', { remittanceId: pendingRtm.id })}>
            Completar RTM Obligatorio
          </Button>
        </div>
      )}

      {/* Table of Open Orders */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
        <h2 className="text-base font-bold text-[#000000] mb-3">Pedidos Abiertos</h2>
        {openOrders.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No hay pedidos abiertos actualmente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#D9D9D9] text-gray-500 font-semibold text-left">
                  <th className="py-2.5">CÓDIGO</th>
                  <th className="py-2.5">FECHA</th>
                  <th className="py-2.5">CLIENTE / CANAL</th>
                  <th className="py-2.5">LISTA</th>
                  <th className="py-2.5 text-right">TOTAL ESTIMADO</th>
                  <th className="py-2.5 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {openOrders.map((o) => {
                  let custName = o.recipient_name || 'Sin nombre';
                  if (o.customer_source === 'REGISTERED_CUSTOMER' && o.customer_id) {
                    custName = state.customers[o.customer_id]?.name || custName;
                  } else if (o.customer_source === 'MERCADO_LIBRE') {
                    custName = 'Mercado Libre';
                  } else if (o.customer_source === 'CONSUMER_FINAL') {
                    custName = `CF - ${o.recipient_name || 'Público'}`;
                  }

                  const oItems = Object.values(state.orderItems).filter((oi) => oi.order_id === o.id);
                  let subtotal = 0;
                  oItems.forEach((i) => {
                    subtotal += i.requested_quantity * i.unit_price_ars_snapshot;
                  });

                  // Discounts
                  const discounts = Object.values(state.orderDiscountSteps)
                    .filter((d) => d.order_id === o.id)
                    .sort((a, b) => a.position - b.position);

                  let totalEst = subtotal;
                  discounts.forEach((d) => {
                    totalEst = totalEst * (1 - d.percent / 100);
                  });

                  const priceList = state.priceLists[o.price_list_id];

                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="py-3 font-bold text-[#B99D22]">{o.code}</td>
                      <td className="py-3 text-gray-600">{new Date(o.business_date || o.created_at).toLocaleDateString('es-AR')}</td>
                      <td className="py-3 font-semibold text-[#000]">{custName}</td>
                      <td className="py-3 text-gray-500">{priceList?.name}</td>
                      <td className="py-3 text-right font-bold text-base text-[#393939]">
                        $ {Math.round(totalEst).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 text-center">
                        <Button variant="secundario" onClick={() => openOrderDetail(o.id)} className="h-8 px-3 text-xs gap-1">
                          <Eye className="w-3.5 h-3.5" /> Preparar / Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Planning Matrix (Matriz de Planificación de Pedidos) */}
      <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <h2 className="text-base font-bold text-[#000000] uppercase tracking-wider">
              Resumen de Pedidos (Matriz de Planificación)
            </h2>
            <p className="text-xs text-gray-500">
              Simulación de cobertura en tiempo real. <strong>No modifica stock ni persiste reservas.</strong>
            </p>
          </div>
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded">
            <strong>Prioridad:</strong> Filas (arriba reserva primero) • Columnas (izquierda se cubre primero)
          </div>
        </div>

        {planningData.products.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No hay productos en pedidos abiertos para simular.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-[#D9D9D9] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-[#000] border-b border-[#D9D9D9]">
                  <th className="py-2.5 px-3 text-left sticky left-0 bg-gray-100 border-r border-[#D9D9D9] z-10 w-64">
                    PRODUCTO / PRIORIDAD
                  </th>
                  {planningData.openOrders.map((o) => (
                    <th key={o.orderId} className="py-2 px-3 text-center border-r border-[#D9D9D9] min-w-[120px]">
                      <div className="font-bold text-[#B99D22]">{o.code}</div>
                      <div className="truncate max-w-[110px] text-gray-600 font-normal">{o.customerName}</div>
                      <div className="flex justify-center gap-1 mt-1">
                        <button
                          onClick={() => moveOrderPriority(o.orderId, 'LEFT')}
                          className="p-0.5 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                          title="Mover prioridad izquierda"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveOrderPriority(o.orderId, 'RIGHT')}
                          className="p-0.5 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                          title="Mover prioridad derecha"
                        >
                          →
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right bg-gray-200 font-bold">TOTAL</th>
                  <th className="py-2 px-3 text-right bg-gray-50 text-gray-700">STOCK PRO</th>
                  <th className="py-2 px-3 text-right bg-blue-50 text-blue-700">DESDE GRANEL</th>
                  <th className="py-2 px-3 text-right bg-gray-200 font-bold">FALTANTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9D9D9]">
                {planningData.products.map((p) => (
                  <tr key={p.productId} className="hover:bg-gray-50">
                    {/* Sticky Product Column with up/down priority arrows */}
                    <td className="py-2.5 px-3 sticky left-0 bg-white border-r border-[#D9D9D9] z-10 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#393939]">{p.productName}</span>
                        <span className="block text-[11px] text-gray-400">{p.productCode}</span>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => moveProductPriority(p.productId, 'UP')}
                          className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                          title="Mover prioridad arriba"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveProductPriority(p.productId, 'DOWN')}
                          className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                          title="Mover prioridad abajo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Order cells: red if shortage in that order */}
                    {planningData.openOrders.map((o) => {
                      const cov = p.ordersCoverage[o.orderId];
                      if (!cov || cov.requested === 0) {
                        return <td key={o.orderId} className="py-2 px-3 text-center border-r border-[#D9D9D9] text-gray-300">-</td>;
                      }

                      return (
                        <td
                          key={o.orderId}
                          className={`py-2 px-3 text-center border-r border-[#D9D9D9] font-bold ${
                            cov.hasShortage
                              ? 'bg-red-100 text-[#DD0000] border-red-300'
                              : 'text-gray-800'
                          }`}
                          title={`Solicitado: ${cov.requested} un | Cubierto: ${cov.covered} un`}
                        >
                          {cov.requested} un
                          {cov.hasShortage && <span className="block text-[10px] font-normal text-red-600">Falta {cov.requested - cov.covered}</span>}
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-3 text-right font-bold text-sm">{p.totalRequested} un</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{p.coverageFromStock} un</td>
                    <td className="py-2.5 px-3 text-right text-blue-700 font-semibold">{p.coveredFromBulk} un</td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold text-sm ${
                        p.finalShortage > 0 ? 'text-[#DD0000] bg-red-50' : 'text-[#008102]'
                      }`}
                    >
                      {p.finalShortage > 0 ? `${p.finalShortage} un` : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Order Detail Panel / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl border border-[#D9D9D9] max-w-4xl w-full my-6 max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#D9D9D9] bg-[#FBFBFB]">
              <div>
                <h2 className="text-xl font-bold text-[#000]">Preparación y Confirmación — {selectedOrder.code}</h2>
                <span className="text-xs text-gray-500">
                  {selectedOrder.customer_source === 'REGISTERED_CUSTOMER'
                    ? state.customers[selectedOrder.customer_id!]?.name
                    : selectedOrder.recipient_name || 'Consumidor'}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-1 rounded text-gray-500 hover:text-black text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{errorMsg}</div>}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                <strong>Regla de negocio (AG):</strong> Ingrese en la columna <strong>AG (Cantidad Enviada)</strong> las
                unidades reales embaladas. Confirmar RTO descontará el stock físico del Producto Final y convertirá este
                pedido en una venta inmutable.
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-[#D9D9D9] text-left">
                      <th className="py-2 px-3">PRODUCTO</th>
                      <th className="py-2 px-3 text-right">SOLICITADO</th>
                      <th className="py-2 px-3 text-right">STOCK FÍSICO ACTUAL</th>
                      <th className="py-2 px-3 text-center w-32 bg-amber-100 text-amber-900 font-bold">
                        AG (ENVIADO)
                      </th>
                      <th className="py-2 px-3 text-right">PRECIO UNIT.</th>
                      <th className="py-2 px-3 text-right">TOTAL LÍNEA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.values(state.orderItems)
                      .filter((oi) => oi.order_id === selectedOrder.id)
                      .map((item) => {
                        const product = state.products[item.product_id];
                        const stockItem = state.stockItems[item.product_id];
                        const currentStock = state.stockBalances[item.product_id]?.quantity || 0;
                        const currentAg = agMap[item.id] !== undefined ? agMap[item.id] : item.requested_quantity;
                        const lineTotal = currentAg * item.unit_price_ars_snapshot;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-3 px-3 font-semibold">
                              {stockItem?.name} ({product?.presentation})
                            </td>
                            <td className="py-3 px-3 text-right font-bold">{item.requested_quantity} un</td>
                            <td className={`py-3 px-3 text-right font-medium ${currentStock < currentAg ? 'text-[#DD0000] font-bold' : ''}`}>
                              {currentStock} un
                            </td>
                            <td className="py-3 px-3 text-center bg-amber-50">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="w-20 h-8 px-2 border border-amber-400 bg-white rounded text-center font-bold text-sm"
                                value={currentAg}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setAgMap({ ...agMap, [item.id]: val });
                                }}
                              />
                            </td>
                            <td className="py-3 px-3 text-right text-gray-600">
                              $ {item.unit_price_ars_snapshot.toLocaleString('es-AR')}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm">
                              $ {Math.round(lineTotal).toLocaleString('es-AR')}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Total Breakdown */}
              <div className="flex justify-between items-start pt-4 border-t border-[#D9D9D9]">
                <Button variant="secundario" onClick={() => setDeleteConfirmOpen(true)} className="text-[#DD0000] flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Cancelar / Borrar Pedido
                </Button>

                <div className="w-72 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal según AG:</span>
                    <span>
                      ${' '}
                      {Math.round(
                        Object.values(state.orderItems)
                          .filter((oi) => oi.order_id === selectedOrder.id)
                          .reduce((sum, it) => sum + (agMap[it.id] ?? it.requested_quantity) * it.unit_price_ars_snapshot, 0)
                      ).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-gray-200">
                    <span>Total Pedido a Facturar:</span>
                    <span className="text-[#B99D22]">
                      ${' '}
                      {Math.round(
                        Object.values(state.orderItems)
                          .filter((oi) => oi.order_id === selectedOrder.id)
                          .reduce((sum, it) => sum + (agMap[it.id] ?? it.requested_quantity) * it.unit_price_ars_snapshot, 0) * 0.7
                      ).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#D9D9D9] bg-gray-50">
              <Button variant="secundario" onClick={() => setSelectedOrderId(null)}>
                Volver
              </Button>
              <Button variant="principal" onClick={handleConfirmRto} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Confirmar Remito (RTO)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="¿Borrar Pedido Abierto?"
        message="Esta acción cancelará el pedido abierto sin modificar stock ni patrimonio. Desaparecerá de la planificación."
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};
