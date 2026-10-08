import { Decimal, toNumericString } from '@/domain/decimal';
import type { ProductWithCostAndStockRecord } from '@/services/product.service';

export interface ProductComponentDTO {
  id: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  quantityPerUnit: number;
  unitCostArs: string;
  lineCostArs: string;
  sortOrder: number;
}

export interface ProductCostBreakdownDTO {
  baseCostArs: string;
  componentsCostArs: string;
  subtotalArs: string;
  extraVariableArs: string;
  totalCostArs: string;
}

export interface FinalProductDTO {
  id: string;
  code: string;
  name: string;
  baseProductId: string;
  baseProductCode: string;
  baseProductName: string;
  presentation: string;
  weightKg: string;
  stockCurrent: number;
  stockMinimum: number;
  isBelowMinimum: boolean;
  stockRatio: number;
  extraVariablePct: string;
  active: boolean;
  createdDate: string;
  createdAt: string;
  cost: ProductCostBreakdownDTO;
  components: ProductComponentDTO[];
}

export interface BaseProductOptionDTO {
  id: string;
  code: string;
  name: string;
  currentVersion?: number | null;
  currentCostPerKg?: string | null;
}

export interface ComponentOptionDTO {
  id: string;
  code: string;
  name: string;
  currentTheoreticalCostGrossArs?: string | null;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function validateIntegerUnit(value: Decimal | number | string, fieldName: string): number {
  let d: Decimal;
  try {
    d = value instanceof Decimal ? value : new Decimal(value);
  } catch {
    throw new Error(
      `Inconsistencia en dominio: el campo ${fieldName} (UNIT) debe ser un entero exacto pero se recibió ${value}`
    );
  }
  if (!d.isInteger() || d.isNegative()) {
    throw new Error(
      `Inconsistencia en dominio: el campo ${fieldName} (UNIT) debe ser un entero exacto no negativo pero se recibió ${d.toString()}`
    );
  }
  return d.toNumber();
}

export function serializeFinalProduct(p: ProductWithCostAndStockRecord): FinalProductDTO {
  const stockCur = validateIntegerUnit(p.balance, 'stockCurrent');
  const stockMin = validateIntegerUnit(p.stockMinimum, 'stockMinimum');
  const isBelow = p.balance.lt(p.stockMinimum);

  const minRatio = p.stockMinimum.gt(0) ? p.stockMinimum : new Decimal(1);
  const ratio = p.balance.dividedBy(minRatio).toNumber();

  const subtotal = p.cost.baseCost.plus(p.cost.componentsCost);

  return {
    id: p.productId,
    code: p.code,
    name: p.name,
    baseProductId: p.baseProductId,
    baseProductCode: p.baseProductCode,
    baseProductName: p.baseProductName,
    presentation: p.presentation,
    weightKg: toNumericString(p.weightKg),
    stockCurrent: stockCur,
    stockMinimum: stockMin,
    isBelowMinimum: isBelow,
    stockRatio: ratio,
    extraVariablePct: toNumericString(p.extraVariablePct),
    active: p.active,
    createdDate: p.createdDate,
    createdAt: p.createdAt,
    cost: {
      baseCostArs: toNumericString(p.cost.baseCost),
      componentsCostArs: toNumericString(p.cost.componentsCost),
      subtotalArs: toNumericString(subtotal),
      extraVariableArs: toNumericString(p.cost.extraVariable),
      totalCostArs: toNumericString(p.cost.totalCost),
    },
    components: p.components.map((c) => ({
      id: c.id,
      componentId: c.componentId,
      componentCode: c.componentCode,
      componentName: c.componentName,
      quantityPerUnit: validateIntegerUnit(c.quantityPerUnit, `quantityPerUnit (${c.componentCode})`),
      unitCostArs: c.unitCostArs ? toNumericString(c.unitCostArs) : '0',
      lineCostArs: c.lineCostArs ? toNumericString(c.lineCostArs) : '0',
      sortOrder: c.sortOrder,
    })),
  };
}
