import { toNumericString, Decimal } from '@/domain/decimal';
import type { MasterItemWithCostAndBalance } from '@/services/master-item.service';

export interface RawMaterialDTO {
  id: string;
  code: string;
  name: string;
  inci: string | null;
  active: boolean;
  stockMinimumKg: string;
  stockCurrentKg: string;
  stockRatio: string;
  isBelowMinimum: boolean;
  supplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  supplierCurrency: 'ARS' | 'USD' | null;
  quotedPriceNet: string | null;
  priceUpdatedAt: string | null;
  createdDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOptionDTO {
  id: string;
  code: string;
  name: string;
  currencyCode: 'ARS' | 'USD';
}

export function serializeRawMaterial(item: MasterItemWithCostAndBalance): RawMaterialDTO {
  const min = item.stockMinimum ?? new Decimal(0);
  const current = item.balance ?? new Decimal(0);
  const ratio = min.greaterThan(0) ? current.dividedBy(min) : new Decimal(0);
  const isBelowMinimum = min.greaterThan(0) && current.lessThan(min);

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    inci: item.inci || null,
    active: item.active,
    stockMinimumKg: toNumericString(min),
    stockCurrentKg: toNumericString(current),
    stockRatio: toNumericString(ratio),
    isBelowMinimum,
    supplierId: item.referenceSupplierId || null,
    supplierCode: item.referenceSupplierCode || null,
    supplierName: item.referenceSupplierName || null,
    supplierCurrency: item.referenceCurrency || null,
    quotedPriceNet: item.referencePriceNet ? toNumericString(item.referencePriceNet) : null,
    priceUpdatedAt: item.referencePriceUpdatedAt || null,
    createdDate: item.createdDate,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
