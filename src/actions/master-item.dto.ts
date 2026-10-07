import { toNumericString, Decimal } from '@/domain/decimal';
import { InvalidStockUnitPrecisionError } from '@/domain/errors';
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
  theoreticalCostGrossArs: string | null;
  priceUpdatedAt: string | null;
  createdDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentDTO {
  id: string;
  code: string;
  name: string;
  active: boolean;
  stockMinimumUnits: number;
  stockCurrentUnits: number;
  stockRatio: string;
  isBelowMinimum: boolean;
  supplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  supplierCurrency: 'ARS' | 'USD' | null;
  quotedPriceNet: string | null;
  theoreticalCostGrossArs: string | null;
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
    theoreticalCostGrossArs: item.currentTheoreticalCostGrossArs
      ? toNumericString(item.currentTheoreticalCostGrossArs)
      : null,
    priceUpdatedAt: item.referencePriceUpdatedAt || null,
    createdDate: item.createdDate,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function serializeComponent(item: MasterItemWithCostAndBalance): ComponentDTO {
  const min = item.stockMinimum ?? new Decimal(0);
  const current = item.balance ?? new Decimal(0);
  const ratio = min.greaterThan(0) ? current.dividedBy(min) : new Decimal(0);
  const isBelowMinimum = min.greaterThan(0) && current.lessThan(min);

  // Validación estricta: COM exige cantidades enteras en unidades.
  // Rechazar inconsistencias fraccionales sin truncamiento silencioso (sin Math.trunc, Math.round ni parseInt).
  if (!min.isInteger()) {
    throw new InvalidStockUnitPrecisionError(
      `Inconsistencia de datos en componente ${item.code}: el stock mínimo debe ser un entero exacto de unidades, pero se recibió "${min.toString()}".`
    );
  }

  if (!current.isInteger()) {
    throw new InvalidStockUnitPrecisionError(
      `Inconsistencia de datos en componente ${item.code}: el stock actual (balance) debe ser un entero exacto de unidades, pero se recibió "${current.toString()}".`
    );
  }

  const stockMinimumUnits = min.toNumber();
  const stockCurrentUnits = current.toNumber();

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    active: item.active,
    stockMinimumUnits,
    stockCurrentUnits,
    stockRatio: toNumericString(ratio),
    isBelowMinimum,
    supplierId: item.referenceSupplierId || null,
    supplierCode: item.referenceSupplierCode || null,
    supplierName: item.referenceSupplierName || null,
    supplierCurrency: item.referenceCurrency || null,
    quotedPriceNet: item.referencePriceNet ? toNumericString(item.referencePriceNet) : null,
    theoreticalCostGrossArs: item.currentTheoreticalCostGrossArs
      ? toNumericString(item.currentTheoreticalCostGrossArs)
      : null,
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
