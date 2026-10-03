// Admin and PDF viewer modals conforming to FLOWS.md & PDFS.md

import React, { useState } from 'react';
import { Modal, FormField, Button, ReadOnlyField, MoneyDisplay } from '../components/UIComponents';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { pdfService } from '../../pdf/pdfGenerator';
import { UUID, ExpenseType } from '../../types/domain';
import { Printer } from 'lucide-react';

// Modal Pagos
export const PaymentModal: React.FC<{
  isOpen: boolean;
  type: 'CUSTOMER' | 'SUPPLIER';
  onClose: () => void;
}> = ({ isOpen, type, onClose }) => {
  const state = db.getState();
  const isCustomer = type === 'CUSTOMER';

  // Only list entities with positive debt (> 0)
  const entities = isCustomer
    ? Object.values(state.customers).filter((c) => {
        const acc = Object.values(state.financialAccounts).find(
          (a) => a.account_type === 'CUSTOMER_RECEIVABLE' && a.customer_id === c.id
        );
        return acc && acc.current_balance > 0;
      })
    : Object.values(state.suppliers).filter((s) => {
        const acc = Object.values(state.financialAccounts).find(
          (a) => a.account_type === 'SUPPLIER_PAYABLE' && a.supplier_id === s.id
        );
        return acc && acc.current_balance > 0;
      });

  const [entityId, setEntityId] = useState<UUID>(entities[0]?.id || '');
  const [amount, setAmount] = useState<number>(0);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string>('');

  const selectedAccount = isCustomer
    ? Object.values(state.financialAccounts).find(
        (a) => a.account_type === 'CUSTOMER_RECEIVABLE' && a.customer_id === entityId
      )
    : Object.values(state.financialAccounts).find(
        (a) => a.account_type === 'SUPPLIER_PAYABLE' && a.supplier_id === entityId
      );

  const handlePay = () => {
    setError('');
    try {
      domainServices.registerPayment({
        paymentType: type,
        entityId,
        amountArs: Number(amount),
        businessDate,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el pago');
    }
  };

  return (
    <Modal title={isCustomer ? 'Registrar Cobro / Pago de Cliente' : 'Registrar Pago a Proveedor'} isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        {entities.length === 0 ? (
          <div className="p-4 text-center text-gray-500 font-medium">
            No hay {isCustomer ? 'clientes' : 'proveedores'} con saldo de deuda pendiente.
          </div>
        ) : (
          <>
            <FormField label={isCustomer ? 'Cliente' : 'Proveedor'}>
              <select
                className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
              >
                {entities.map((ent) => {
                  const acc = Object.values(state.financialAccounts).find((a) =>
                    isCustomer ? a.customer_id === ent.id : a.supplier_id === ent.id
                  );
                  return (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} | Deuda: $ {Math.round(acc?.current_balance || 0).toLocaleString('es-AR')}
                    </option>
                  );
                })}
              </select>
            </FormField>

            <ReadOnlyField
              label="Saldo Actual de Deuda"
              value={`$ ${Math.round(selectedAccount?.current_balance || 0).toLocaleString('es-AR')}`}
              highlight
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Importe a Registrar ($ ARS)">
                <input
                  type="number"
                  min="1"
                  className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full text-base font-bold"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </FormField>

              <FormField label="Fecha">
                <input
                  type="date"
                  className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
              <Button variant="secundario" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="principal" onClick={handlePay}>
                Confirmar Pago
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

// Modal Gasto Operativo
export const ExpenseModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [expenseType, setExpenseType] = useState<ExpenseType>('LUZ');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string>('');

  const handleRegister = () => {
    setError('');
    try {
      domainServices.registerOperatingExpense({
        expenseType,
        description,
        amountArs: Number(amount),
        businessDate,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el gasto');
    }
  };

  return (
    <Modal title="Registrar Gasto Operativo" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo de Gasto">
            <select
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
              value={expenseType}
              onChange={(e) => setExpenseType(e.target.value as any)}
            >
              <option value="LUZ">Luz</option>
              <option value="ALQUILER">Alquiler</option>
              <option value="COMISIÓN">Comisión</option>
              <option value="OTRO">Otro</option>
            </select>
          </FormField>

          <FormField label="Fecha">
            <input
              type="date"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label={expenseType === 'OTRO' ? 'Descripción (Obligatoria)' : 'Descripción (Opcional)'}>
          <input
            type="text"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
            placeholder="Detalle del gasto"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <FormField label="Importe ($ ARS)">
          <input
            type="number"
            min="1"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
            value={amount || ''}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-500">Descuenta de Caja Steffen.</span>
        </FormField>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="principal" onClick={handleRegister}>
            Registrar Gasto
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Retiro
export const WithdrawalModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string>('');

  const handleWithdraw = () => {
    setError('');
    try {
      domainServices.registerWithdrawal({
        description,
        amountArs: Number(amount),
        businessDate,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al retirar');
    }
  };

  return (
    <Modal title="Registrar Retiro de Caja Steffen" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <FormField label="Motivo / Descripción del Retiro">
          <input
            type="text"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
            placeholder="Ej: Retiro socios"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Importe a Retirar ($ ARS)">
            <input
              type="number"
              min="1"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </FormField>

          <FormField label="Fecha">
            <input
              type="date"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="rojo" onClick={handleWithdraw}>
            Confirmar Retiro
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Liquidación Mercado Libre
export const SettlementModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const cashML = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_MERCADO_LIBRE');
  const maxAvailable = cashML?.current_balance || 0;

  const [grossAmount, setGrossAmount] = useState<number>(maxAvailable > 0 ? maxAvailable : 0);
  const [netAmount, setNetAmount] = useState<number>(maxAvailable > 0 ? Math.round(maxAvailable * 0.85) : 0);
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string>('');

  const commission = Math.max(0, grossAmount - netAmount);

  const handleSettle = () => {
    setError('');
    try {
      domainServices.marketplaceSettlement({
        grossAmountArs: Number(grossAmount),
        netAmountArs: Number(netAmount),
        businessDate,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al liquidar');
    }
  };

  return (
    <Modal title="Liquidar Fondos de Mercado Libre" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <ReadOnlyField
          label="Saldo Disponible en Caja Mercado Libre"
          value={`$ ${Math.round(maxAvailable).toLocaleString('es-AR')}`}
          highlight
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Importe Bruto a Liquidar">
            <input
              type="number"
              max={maxAvailable}
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
              value={grossAmount || ''}
              onChange={(e) => setGrossAmount(parseFloat(e.target.value) || 0)}
            />
          </FormField>

          <FormField label="Importe Neto que Ingresa a Caja Steffen">
            <input
              type="number"
              max={grossAmount}
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
              value={netAmount || ''}
              onChange={(e) => setNetAmount(parseFloat(e.target.value) || 0)}
            />
          </FormField>
        </div>

        <div className="p-3 bg-gray-50 border border-[#D9D9D9] rounded flex justify-between items-center text-sm">
          <span>Comisión retenida (Gasto Operativo ML):</span>
          <span className="font-bold text-[#DD0000]">$ {Math.round(commission).toLocaleString('es-AR')}</span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="verde" onClick={handleSettle}>
            Confirmar Liquidación
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Ajuste de Stock
export const StockAdjustmentModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const items = Object.values(state.stockItems).filter((i) => i.active);
  const [stockItemId, setStockItemId] = useState<UUID>(items[0]?.id || '');
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedItem = state.stockItems[stockItemId];
  const currentBal = state.stockBalances[stockItemId]?.quantity || 0;

  const handleAdjust = () => {
    setError('');
    if (delta === 0) {
      setError('La cantidad a ajustar no puede ser 0');
      return;
    }
    if (!reason.trim()) {
      setError('El motivo del ajuste es obligatorio');
      return;
    }

    try {
      db.transaction((st) => {
        const now = new Date().toISOString();
        const opId = db.generateUUID();
        st.businessOperations[opId] = {
          id: opId,
          operation_type: 'STOCK_ADJUSTMENT',
          business_date: now.slice(0, 10),
          created_at: now,
          updated_at: now,
        };

        const adjId = db.generateUUID();
        st.stockAdjustments[adjId] = { id: adjId, operation_id: opId, reason, created_at: now };

        const adjItemId = db.generateUUID();
        st.stockAdjustmentItems[adjItemId] = {
          id: adjItemId,
          adjustment_id: adjId,
          stock_item_id: stockItemId,
          quantity_delta: delta,
          reason,
        };

        domainServices.applyStockMovement(
          st,
          opId,
          stockItemId,
          'AJUSTE',
          delta,
          `Ajuste manual: ${reason}`
        );
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al ajustar stock');
    }
  };

  return (
    <Modal title="Ajuste Manual de Stock" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <FormField label="Ítem a Ajustar">
          <select
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full bg-white"
            value={stockItemId}
            onChange={(e) => setStockItemId(e.target.value)}
          >
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.code}) - {it.item_type} [{it.unit_type}]
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField
            label="Saldo Actual"
            value={`${currentBal.toFixed(selectedItem?.unit_type === 'KG' ? 3 : 0)} ${selectedItem?.unit_type}`}
          />

          <FormField label="Cantidad de Ajuste (+ / -)">
            <input
              type="number"
              step={selectedItem?.unit_type === 'KG' ? '0.001' : '1'}
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
              placeholder="+5 o -3"
              value={delta || ''}
              onChange={(e) => setDelta(parseFloat(e.target.value) || 0)}
            />
          </FormField>
        </div>

        <FormField label="Motivo / Observación">
          <input
            type="text"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
            placeholder="Ej: Conteo físico fin de mes"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="principal" onClick={handleAdjust}>
            Guardar Ajuste
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Modal Visor PDF (Imprimible y descargable)
export const PdfViewerModal: React.FC<{
  isOpen: boolean;
  docType: 'RTO' | 'RTM';
  docId: UUID;
  onClose: () => void;
}> = ({ isOpen, docType, docId, onClose }) => {
  if (!isOpen) return null;

  const htmlContent = docType === 'RTO' ? pdfService.generateRtoHtml(docId) : pdfService.generateRtmHtml(docId);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  return (
    <Modal title={`Documento Oficial — ${docType}`} isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-[#FBFBFB] p-2 border border-[#D9D9D9] rounded">
          <span className="text-xs text-gray-600">
            Vista previa del documento generado conforme a la especificación de <strong>docs/PDFS.md</strong>.
          </span>
          <Button variant="principal" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </Button>
        </div>

        <div className="border border-[#D9D9D9] rounded p-2 bg-white shadow-inner max-h-[65vh] overflow-y-auto">
          <iframe
            srcDoc={htmlContent}
            title="Vista previa PDF"
            className="w-full min-h-[500px] border-none"
          />
        </div>

        <div className="flex justify-end">
          <Button variant="secundario" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
