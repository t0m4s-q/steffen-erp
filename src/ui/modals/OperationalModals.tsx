// Operational Modals for ERP operations conforming to FLOWS.md

import React, { useState } from 'react';
import { Modal, FormField, ReadOnlyField, Button, MoneyDisplay } from '../components/UIComponents';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { UUID, CurrencyCode, ExpenseType, PaymentMode } from '../../types/domain';

// Modal Fabricación
export const ManufactureModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const baseProducts = Object.values(state.baseProducts).filter((p) => p.active);
  const [baseProductId, setBaseProductId] = useState<UUID>(baseProducts[0]?.id || '');
  const [kgFabricated, setKgFabricated] = useState<number>(50);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedFormula = baseProductId ? domainServices.getCurrentFormulaCost(baseProductId) : null;

  const handleManufacture = () => {
    setError('');
    try {
      domainServices.manufactureBulkLot({
        baseProductId,
        kgFabricated: Number(kgFabricated),
        businessDate,
        observations,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al fabricar');
    }
  };

  return (
    <Modal title="Registrar Fabricación de Granel" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Fecha de Fabricación">
            <input
              type="date"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </FormField>
          <FormField label="Producto Base">
            <select
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
              value={baseProductId}
              onChange={(e) => setBaseProductId(e.target.value)}
            >
              {baseProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Kg a Fabricar (kg)">
          <input
            type="number"
            step="0.001"
            min="0.001"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
            value={kgFabricated}
            onChange={(e) => setKgFabricated(parseFloat(e.target.value) || 0)}
          />
        </FormField>

        {selectedFormula && (
          <div className="p-3 bg-gray-50 border border-[#D9D9D9] rounded text-xs space-y-2">
            <div className="font-bold text-[#000000] flex justify-between">
              <span>Proporción teórica según fórmula:</span>
              <span>Costo estimado por kg: $ {selectedFormula.costPerKgArs.toFixed(2)}</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {selectedFormula.items.map((it) => {
                const needed = (it.quantityKg * kgFabricated) / (selectedFormula.totalKg || 1);
                const currentStock = db.getState().stockBalances[it.rawMaterialId]?.quantity || 0;
                const isShort = currentStock < needed;
                return (
                  <div key={it.rawMaterialId} className={`flex justify-between ${isShort ? 'text-[#DD0000] font-bold' : ''}`}>
                    <span>
                      {it.rawMaterialName}: {needed.toFixed(3)} kg
                    </span>
                    <span>Disp: {currentStock.toFixed(3)} kg</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <FormField label="Observaciones">
          <input
            type="text"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
            placeholder="Ej: Lote aprobado por control de calidad"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="principal" onClick={handleManufacture}>
            Confirmar Fabricación
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Envasado
export const PackagingModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const openLots = Object.values(state.bulkLots).filter((l) => l.status === 'OPEN' && l.kg_available > 0);
  const [selectedLotId, setSelectedLotId] = useState<UUID>(openLots[0]?.id || '');
  const selectedLot = state.bulkLots[selectedLotId];

  const availableProducts = selectedLot
    ? Object.values(state.products).filter((p) => p.base_product_id === selectedLot.base_product_id)
    : [];

  const [productId, setProductId] = useState<UUID>(availableProducts[0]?.stock_item_id || '');
  const [units, setUnits] = useState<number>(50);
  const [isLastOfLot, setIsLastOfLot] = useState<boolean>(false);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedProduct = state.products[productId];
  const stockItemPro = state.stockItems[productId];
  const kgNeeded = selectedProduct ? units * selectedProduct.weight_kg : 0;

  const handlePackaging = () => {
    setError('');
    try {
      domainServices.packageProduct({
        bulkLotId: selectedLotId,
        productId,
        unitsPackaged: Number(units),
        isLastOfLot,
        businessDate,
        observations,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al envasar');
    }
  };

  return (
    <Modal title="Registrar Envasado de Producto Final" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Lote de Granel Abierto">
            <select
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value);
                const l = state.bulkLots[e.target.value];
                const pros = l ? Object.values(state.products).filter((p) => p.base_product_id === l.base_product_id) : [];
                setProductId(pros[0]?.stock_item_id || '');
              }}
            >
              {openLots.map((l) => {
                const bp = state.baseProducts[l.base_product_id];
                return (
                  <option key={l.id} value={l.id}>
                    {l.code} - {bp?.name} ({l.kg_available.toFixed(3)} kg disp.)
                  </option>
                );
              })}
            </select>
          </FormField>

          <ReadOnlyField
            label="Kg Disponibles en Lote"
            value={`${selectedLot ? selectedLot.kg_available.toFixed(3) : '0.000'} kg`}
            highlight
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Producto Final a Envasar">
            <select
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {availableProducts.map((p) => {
                const si = state.stockItems[p.stock_item_id];
                return (
                  <option key={p.stock_item_id} value={p.stock_item_id}>
                    {si?.name} ({p.presentation}, {p.weight_kg.toFixed(3)} kg)
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Cantidad de Unidades">
            <input
              type="number"
              min="1"
              step="1"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={units}
              onChange={(e) => setUnits(parseInt(e.target.value, 10) || 0)}
            />
          </FormField>
        </div>

        <div className="p-3 bg-gray-50 border border-[#D9D9D9] rounded text-xs space-y-1">
          <div className="flex justify-between font-semibold">
            <span>Granel necesario ({units} un × {selectedProduct?.weight_kg || 0} kg):</span>
            <span className={selectedLot && kgNeeded > selectedLot.kg_available ? 'text-[#DD0000] font-bold' : ''}>
              {kgNeeded.toFixed(3)} kg
            </span>
          </div>
          <div className="text-gray-500">
            {selectedProduct &&
              state.productComponents
                .filter((pc) => pc.product_id === selectedProduct.stock_item_id)
                .map((pc) => {
                  const compItem = state.stockItems[pc.component_id];
                  const needed = pc.quantity_per_unit * units;
                  const available = state.stockBalances[pc.component_id]?.quantity || 0;
                  return (
                    <div key={pc.component_id} className={available < needed ? 'text-[#DD0000] font-bold' : ''}>
                      • {compItem?.name}: {needed} un (disp: {available} un)
                    </div>
                  );
                })}
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
          <input
            type="checkbox"
            id="lastOfLot"
            checked={isLastOfLot}
            onChange={(e) => setIsLastOfLot(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="lastOfLot" className="text-xs font-semibold text-amber-900 cursor-pointer">
            Último del lote (Cierra el lote GRA y registra automáticamente Merma o Sobrante físico)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="principal" onClick={handlePackaging}>
            Confirmar Envasado
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Compra
export const PurchaseModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const suppliers = Object.values(state.suppliers).filter((s) => s.active);
  const [supplierId, setSupplierId] = useState<UUID>(suppliers[0]?.id || '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('PAID');
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [fxOverride, setFxOverride] = useState<number>(domainServices.getCurrentExchangeRate());
  const [observations, setObservations] = useState<string>('');
  const [error, setError] = useState<string>('');

  const supplier = state.suppliers[supplierId];
  const isUsd = supplier?.currency_code === 'USD';

  // Purchase items state
  const availableItems = Object.values(state.stockItems).filter((si) => si.item_type !== 'PRO' && si.active);
  const [lines, setLines] = useState<Array<{ stockItemId: UUID; quantity: number; unitPriceNetSource: number }>>([
    { stockItemId: availableItems[0]?.id || '', quantity: 10, unitPriceNetSource: 1000 },
  ]);

  const addLine = () => {
    setLines([...lines, { stockItemId: availableItems[0]?.id || '', quantity: 1, unitPriceNetSource: 1000 }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = val;
    setLines(updated);
  };

  // Calculations
  const effectiveFx = isUsd ? fxOverride : 1.0;
  let totalNetSource = 0;
  let totalGrossArs = 0;

  lines.forEach((l) => {
    totalNetSource += l.quantity * l.unitPriceNetSource;
    totalGrossArs += l.quantity * l.unitPriceNetSource * effectiveFx * (1 + domainServices.getCurrentExchangeRate() ? 1.21 : 1.21);
  });

  const handleRegister = (mode: PaymentMode) => {
    setError('');
    try {
      domainServices.registerPurchase({
        supplierId,
        paymentMode: mode,
        businessDate,
        exchangeRateUsed: isUsd ? fxOverride : undefined,
        items: lines,
        observations,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar la compra');
    }
  };

  return (
    <Modal title="Registrar Compra a Proveedor" isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Proveedor">
            <select
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currency_code})
                </option>
              ))}
            </select>
          </FormField>

          <ReadOnlyField label="Moneda de Compra" value={supplier?.currency_code || 'ARS'} highlight />

          <FormField label="Fecha de Compra">
            <input
              type="date"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </FormField>
        </div>

        {isUsd && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded flex items-center justify-between">
            <span className="text-xs text-amber-900 font-semibold">
              Proveedor en USD — Cotización propuesta: $ {domainServices.getCurrentExchangeRate().toFixed(2)}
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-amber-900">Cotización para esta compra:</label>
              <input
                type="number"
                className="w-28 h-8 px-2 border border-amber-400 bg-white rounded text-sm font-bold"
                value={fxOverride}
                onChange={(e) => setFxOverride(parseFloat(e.target.value) || 1)}
              />
            </div>
          </div>
        )}

        {/* Lines */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase text-[#000]">Insumos de la compra</h3>
            <button onClick={addLine} className="text-xs font-bold text-[#B99D22] hover:underline cursor-pointer">
              + Agregar Línea
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {lines.map((l, idx) => {
              const item = state.stockItems[l.stockItemId];
              const unitGross = l.unitPriceNetSource * effectiveFx * 1.21;
              const lineTotal = l.quantity * unitGross;
              return (
                <div key={idx} className="flex gap-2 items-center p-2 bg-gray-50 border border-[#D9D9D9] rounded">
                  <select
                    className="h-9 px-2 border border-[#D9D9D9] rounded flex-1 bg-white text-xs"
                    value={l.stockItemId}
                    onChange={(e) => updateLine(idx, 'stockItemId', e.target.value)}
                  >
                    {availableItems.map((ai) => (
                      <option key={ai.id} value={ai.id}>
                        {ai.name} ({ai.item_type} - {ai.unit_type})
                      </option>
                    ))}
                  </select>

                  <div className="w-24">
                    <input
                      type="number"
                      step={item?.unit_type === 'KG' ? '0.001' : '1'}
                      className="h-9 px-2 border border-[#D9D9D9] rounded w-full text-xs"
                      placeholder="Cantidad"
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      step="0.01"
                      className="h-9 px-2 border border-[#D9D9D9] rounded w-full text-xs"
                      placeholder={`P. Neto (${supplier?.currency_code})`}
                      value={l.unitPriceNetSource}
                      onChange={(e) => updateLine(idx, 'unitPriceNetSource', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="w-32 text-right text-xs font-bold text-gray-700">
                    $ {Math.round(lineTotal).toLocaleString('es-AR')}
                  </div>

                  {lines.length > 1 && (
                    <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 font-bold px-1">
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals */}
        <div className="p-3 bg-gray-100 rounded flex justify-between items-center text-sm font-bold">
          <span>Total Neto: {totalNetSource.toFixed(2)} {supplier?.currency_code}</span>
          <span className="text-lg text-[#000000]">Total c/IVA (ARS): $ {Math.round(totalGrossArs).toLocaleString('es-AR')}</span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secundario" onClick={() => handleRegister('DEBT')}>
            Registrar a Deuda Proveedor
          </Button>
          <Button variant="verde" onClick={() => handleRegister('PAID')}>
            Registrar Pagada (Caja Steffen)
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Nuevo Pedido
export const NewOrderModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const customers = Object.values(state.customers).filter((c) => c.active);
  const products = Object.values(state.products);

  const [customerSource, setCustomerSource] = useState<'REGISTERED_CUSTOMER' | 'MERCADO_LIBRE' | 'CONSUMER_FINAL'>(
    'REGISTERED_CUSTOMER'
  );
  const [customerId, setCustomerId] = useState<UUID>(customers[0]?.id || '');
  const [recipientName, setRecipientName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [packageCount, setPackageCount] = useState<number>(1);
  const [lines, setLines] = useState<Array<{ productId: UUID; requestedQuantity: number }>>([
    { productId: products[0]?.stock_item_id || '', requestedQuantity: 6 },
  ]);
  const [error, setError] = useState<string>('');

  const addLine = () => {
    setLines([...lines, { productId: products[0]?.stock_item_id || '', requestedQuantity: 1 }]);
  };

  const handleCreate = () => {
    setError('');
    try {
      db.transaction((st) => {
        const now = new Date().toISOString();
        const code = db.nextCode('PED');
        const orderId = db.generateUUID();

        // Assign price list
        let priceListId = '';
        if (customerSource === 'REGISTERED_CUSTOMER') {
          const pl = Object.values(st.priceLists).find((p) => p.system_role === 'SALON_DEFAULT');
          priceListId = pl?.id || '';
        } else if (customerSource === 'MERCADO_LIBRE') {
          const pl = Object.values(st.priceLists).find((p) => p.system_role === 'ECOMMERCE_DEFAULT');
          priceListId = pl?.id || '';
        } else {
          const pl = Object.values(st.priceLists).find((p) => p.system_role === 'PUBLIC_DEFAULT');
          priceListId = pl?.id || '';
        }

        // Planning key
        const openCount = Object.values(st.orders).filter((o) => o.status === 'OPEN').length;

        st.orders[orderId] = {
          id: orderId,
          code,
          business_date: now.slice(0, 10),
          status: 'OPEN',
          customer_source: customerSource,
          customer_id: customerSource === 'REGISTERED_CUSTOMER' ? customerId : undefined,
          price_list_id: priceListId,
          price_snapshot_at: now,
          recipient_name: customerSource !== 'REGISTERED_CUSTOMER' ? recipientName : undefined,
          address: customerSource !== 'REGISTERED_CUSTOMER' ? address : undefined,
          package_count: packageCount,
          planning_sort_key: openCount + 1,
          created_at: now,
          updated_at: now,
        };

        // Discounts
        if (customerSource === 'REGISTERED_CUSTOMER') {
          const cust = st.customers[customerId];
          let pos = 1;
          if (cust?.discount_1_pct) {
            const did = db.generateUUID();
            st.orderDiscountSteps[did] = { id: did, order_id: orderId, position: pos++, percent: cust.discount_1_pct };
          }
          if (cust?.discount_2_pct) {
            const did = db.generateUUID();
            st.orderDiscountSteps[did] = { id: did, order_id: orderId, position: pos++, percent: cust.discount_2_pct };
          }
          if (cust?.discount_3_pct) {
            const did = db.generateUUID();
            st.orderDiscountSteps[did] = { id: did, order_id: orderId, position: pos++, percent: cust.discount_3_pct };
          }
        }

        // Order Items
        lines.forEach((l, idx) => {
          if (l.requestedQuantity <= 0) throw new Error('Las cantidades deben ser enteras mayores a 0');
          const unitPrice = domainServices.getPriceAtSnapshot(l.productId, priceListId, now);
          if (unitPrice <= 0) {
            const item = st.stockItems[l.productId];
            throw new Error(`El producto ${item?.name} no tiene precio en la lista seleccionada`);
          }

          const oiId = db.generateUUID();
          st.orderItems[oiId] = {
            id: oiId,
            order_id: orderId,
            product_id: l.productId,
            requested_quantity: l.requestedQuantity,
            ag_quantity: l.requestedQuantity, // Proposed default
            unit_price_ars_snapshot: unitPrice,
            sort_order: idx + 1,
            created_at: now,
            updated_at: now,
          };
        });
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el pedido');
    }
  };

  return (
    <Modal title="Crear Nuevo Pedido Abierto" isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <FormField label="Canal / Origen">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'REGISTERED_CUSTOMER', label: 'Cliente Registrado (Salón)' },
              { id: 'MERCADO_LIBRE', label: 'Mercado Libre (Ecommerce)' },
              { id: 'CONSUMER_FINAL', label: 'Consumidor Final (Público)' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomerSource(c.id as any)}
                className={`p-2 text-xs font-bold rounded border transition-colors ${
                  customerSource === c.id ? 'bg-[#B99D22] text-white border-[#B99D22]' : 'bg-gray-50 border-[#D9D9D9]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </FormField>

        {customerSource === 'REGISTERED_CUSTOMER' ? (
          <FormField label="Cliente Registrado">
            <select
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) - Desc: {[c.discount_1_pct, c.discount_2_pct].filter(Boolean).join('% + ')}%
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre / Referencia">
              <input
                type="text"
                className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
                placeholder={customerSource === 'MERCADO_LIBRE' ? 'Usuario ML #ID' : 'Nombre cliente'}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </FormField>
            <FormField label="Dirección / Destino">
              <input
                type="text"
                className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
                placeholder="Domicilio de entrega"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </FormField>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase">Productos Solicitados</h3>
            <button onClick={addLine} className="text-xs font-bold text-[#B99D22] hover:underline">
              + Agregar Producto
            </button>
          </div>

          {lines.map((l, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                className="h-9 px-2 border border-[#D9D9D9] rounded flex-1 bg-white text-xs"
                value={l.productId}
                onChange={(e) => {
                  const copy = [...lines];
                  copy[idx].productId = e.target.value;
                  setLines(copy);
                }}
              >
                {products.map((p) => {
                  const si = state.stockItems[p.stock_item_id];
                  return (
                    <option key={p.stock_item_id} value={p.stock_item_id}>
                      {si?.name} ({p.presentation})
                    </option>
                  );
                })}
              </select>

              <input
                type="number"
                min="1"
                step="1"
                className="w-24 h-9 px-2 border border-[#D9D9D9] rounded text-xs"
                value={l.requestedQuantity}
                onChange={(e) => {
                  const copy = [...lines];
                  copy[idx].requestedQuantity = parseInt(e.target.value, 10) || 0;
                  setLines(copy);
                }}
              />

              {lines.length > 1 && (
                <button
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  className="text-red-500 font-bold px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="principal" onClick={handleCreate}>
            Crear Pedido
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Completar RTM (Obligatorio)
export const CompleteRtmModal: React.FC<{
  isOpen: boolean;
  remittanceId: UUID;
  onClose: () => void;
}> = ({ isOpen, remittanceId, onClose }) => {
  const state = db.getState();
  const rem = state.remittances[remittanceId];
  const [transportCost, setTransportCost] = useState<number>(0);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string>('');

  if (!rem) return null;

  const remItems = Object.values(state.remittanceItems).filter((i) => i.remittance_id === remittanceId);
  let theoreticalCost = 0;
  remItems.forEach((i) => {
    const cost = domainServices.getCurrentProductCost(i.product_id);
    theoreticalCost += i.quantity_sent * cost.totalCostArs;
  });

  const estimatedGain = rem.total_order_ars - theoreticalCost - transportCost;

  const handleComplete = () => {
    setError('');
    try {
      domainServices.completeRtm({
        remittanceId,
        transportCostArs: transportCost,
        businessDate,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al completar RTM');
    }
  };

  return (
    <Modal title={`Completar RTM Obligatorio — ${rem.code}`} isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900">
          <strong>Acción obligatoria:</strong> Toda venta confirmada requiere completar su Remito Margen (RTM) congelando
          los costos teóricos y registrando el costo de flete/transporte para fijar la ganancia histórica.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="Total Pedido (Venta)" value={`$ ${Math.round(rem.total_order_ars).toLocaleString('es-AR')}`} />
          <ReadOnlyField label="Costo Teórico Insumos" value={`$ ${Math.round(theoreticalCost).toLocaleString('es-AR')}`} />
        </div>

        <FormField label="Costo de Transporte (ARS)">
          <input
            type="number"
            min="0"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
            placeholder="0 si el flete corre por cuenta del cliente"
            value={transportCost}
            onChange={(e) => setTransportCost(parseFloat(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-500">Si es mayor que 0, descontará automáticamente de Caja Steffen.</span>
        </FormField>

        <div className="p-4 bg-green-50 border border-[#008102] rounded flex justify-between items-center">
          <span className="font-bold text-[#008102] text-sm">GANANCIA NETA CALCULADA:</span>
          <span className="font-bold text-xl text-[#008102]">$ {Math.round(estimatedGain).toLocaleString('es-AR')}</span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="verde" onClick={handleComplete}>
            Completar RTM y Finalizar Venta
          </Button>
        </div>
      </div>
    </Modal>
  );
};
