// Modal Nuevo Insumo (MPR o COM) conforming to BUSINESS_RULES.md Section 12

import React, { useState } from 'react';
import { Modal, FormField, Button, ReadOnlyField } from '../components/UIComponents';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { UUID, ItemType, CurrencyCode } from '../../types/domain';

export const NewItemModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const state = db.getState();
  const suppliers = Object.values(state.suppliers).filter((s) => s.active);

  const [itemType, setItemType] = useState<ItemType>('MPR');
  const [name, setName] = useState('');
  const [inci, setInci] = useState('');
  const [supplierId, setSupplierId] = useState<UUID>(suppliers[0]?.id || '');
  const [quotedPriceNet, setQuotedPriceNet] = useState<number>(1000);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [stockMinimum, setStockMinimum] = useState<number>(itemType === 'MPR' ? 10 : 50);
  const [error, setError] = useState('');

  const supplier = state.suppliers[supplierId];
  const currency = supplier?.currency_code || 'ARS';
  const fxRate = currency === 'USD' ? domainServices.getCurrentExchangeRate() : 1.0;
  const grossPriceArs = quotedPriceNet * fxRate * 1.21;

  const handleCreate = () => {
    setError('');
    if (!name.trim()) {
      setError('El nombre del insumo es obligatorio');
      return;
    }
    if (stockMinimum <= 0) {
      setError('El stock mínimo es obligatorio y debe ser mayor que 0');
      return;
    }
    if (quotedPriceNet <= 0) {
      setError('El precio unitario debe ser mayor que 0');
      return;
    }

    try {
      db.transaction((st) => {
        const now = new Date().toISOString();
        const prefix = itemType === 'MPR' ? 'MPR' : 'COM';
        const code = db.nextCode(prefix);
        const itemId = db.generateUUID();

        st.stockItems[itemId] = {
          id: itemId,
          code,
          item_type: itemType,
          name,
          unit_type: itemType === 'MPR' ? 'KG' : 'UNIT',
          stock_minimum: stockMinimum,
          active: true,
          created_date: now.slice(0, 10),
          created_at: now,
          updated_at: now,
        };

        if (itemType === 'MPR') {
          st.rawMaterials[itemId] = { stock_item_id: itemId, inci };
        } else {
          st.components[itemId] = { stock_item_id: itemId };
        }

        // Relation Proveedor <-> Ítem
        const relId = db.generateUUID();
        st.supplierItems[relId] = {
          id: relId,
          supplier_id: supplierId,
          stock_item_id: itemId,
          quoted_unit_price_net: quotedPriceNet,
          price_updated_at: now,
          active: true,
          created_at: now,
          updated_at: now,
        };

        // Initial stock balance
        st.stockBalances[itemId] = {
          stock_item_id: itemId,
          quantity: initialStock,
          updated_at: now,
        };

        // If initial stock > 0, generate adjustment MST
        if (initialStock > 0) {
          const opId = db.generateUUID();
          st.businessOperations[opId] = {
            id: opId,
            operation_type: 'STOCK_ADJUSTMENT',
            business_date: now.slice(0, 10),
            created_at: now,
            updated_at: now,
          };
          domainServices.applyStockMovement(
            st,
            opId,
            itemId,
            'AJUSTE',
            initialStock,
            `Stock inicial de alta de ${code}`
          );
        }
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el insumo');
    }
  };

  return (
    <Modal title="Nuevo Insumo (Materia Prima o Componente)" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{error}</div>}

        <FormField label="Tipo de Insumo">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setItemType('MPR');
                setStockMinimum(10);
              }}
              className={`p-2.5 text-xs font-bold rounded border cursor-pointer ${
                itemType === 'MPR' ? 'bg-[#B99D22] text-white border-[#B99D22]' : 'bg-gray-50 border-gray-300'
              }`}
            >
              Materia Prima (MPR - en kg)
            </button>
            <button
              type="button"
              onClick={() => {
                setItemType('COM');
                setStockMinimum(50);
              }}
              className={`p-2.5 text-xs font-bold rounded border cursor-pointer ${
                itemType === 'COM' ? 'bg-[#B99D22] text-white border-[#B99D22]' : 'bg-gray-50 border-gray-300'
              }`}
            >
              Componente (COM - en unidades)
            </button>
          </div>
        </FormField>

        <FormField label="Nombre Comercial">
          <input
            type="text"
            className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
            placeholder={itemType === 'MPR' ? 'Ej: Aceite de Coco Puro' : 'Ej: Envase Pet 250cc'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        {itemType === 'MPR' && (
          <FormField label="Nomenclatura INCI (Opcional)">
            <input
              type="text"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full text-xs"
              placeholder="Ej: Cocos Nucifera Oil"
              value={inci}
              onChange={(e) => setInci(e.target.value)}
            />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Proveedor Inicial">
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

          <ReadOnlyField label="Moneda Heredada" value={currency} highlight />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Precio Unitario Neto (${currency})`}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
              value={quotedPriceNet || ''}
              onChange={(e) => setQuotedPriceNet(parseFloat(e.target.value) || 0)}
            />
          </FormField>

          <ReadOnlyField label="Costo Bruto en Pesos (c/IVA 21%)" value={`$ ${grossPriceArs.toFixed(2)}`} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Stock Mínimo Obligatorio (${itemType === 'MPR' ? 'kg' : 'un'})`}>
            <input
              type="number"
              min="0.001"
              step={itemType === 'MPR' ? '0.001' : '1'}
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold text-red-600"
              value={stockMinimum || ''}
              onChange={(e) => setStockMinimum(parseFloat(e.target.value) || 0)}
            />
          </FormField>

          <FormField label={`Stock Inicial de Entrada (${itemType === 'MPR' ? 'kg' : 'un'})`}>
            <input
              type="number"
              min="0"
              step={itemType === 'MPR' ? '0.001' : '1'}
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={initialStock || ''}
              onChange={(e) => setInitialStock(parseFloat(e.target.value) || 0)}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
          <Button variant="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="principal" onClick={handleCreate}>
            Crear Insumo
          </Button>
        </div>
      </div>
    </Modal>
  );
};
