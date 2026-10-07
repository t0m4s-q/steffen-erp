import { toNumericString } from '@/domain/decimal';
import type {
  BaseProductWithCurrentCost,
  FormulaCostBreakdown,
} from '@/services/formula.service';
import type { FormulaVersionFullRecord } from '@/repositories/formula.repository';

export interface FormulaItemDTO {
  id?: string;
  rawMaterialId: string;
  rawMaterialCode: string;
  rawMaterialName: string;
  quantityKg: string;
  currentUnitCost: string;
  partialCost: string;
  sortOrder: number;
}

export interface FormulaCostBreakdownDTO {
  lines: FormulaItemDTO[];
  totalKgBulk: string;
  totalCostBulkArs: string;
  costPerKgPbaArs: string;
}

export interface FormulaVersionDTO {
  id: string;
  baseProductId: string;
  versionNumber: number;
  businessDate: string;
  observations: string | null;
  isCurrent: boolean;
  createdAt: string;
  costBreakdown: FormulaCostBreakdownDTO;
}

export interface BaseProductDTO {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdDate: string;
  createdAt: string;
  updatedAt: string;
  currentFormulaId: string | null;
  currentVersion: number | null;
  currentCostPerKg: string | null;
  currentFormulaBreakdown: FormulaCostBreakdownDTO | null;
}

export interface ActiveRawMaterialDTO {
  id: string;
  code: string;
  name: string;
  currentTheoreticalCostGrossArs: string | null;
  supplierCode: string | null;
  supplierName: string | null;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function serializeFormulaBreakdown(breakdown: FormulaCostBreakdown): FormulaCostBreakdownDTO {
  return {
    lines: breakdown.lines.map((line) => ({
      rawMaterialId: line.rawMaterialId,
      rawMaterialCode: line.rawMaterialCode,
      rawMaterialName: line.rawMaterialName,
      quantityKg: toNumericString(line.quantityKg),
      currentUnitCost: toNumericString(line.unitCostGrossArs),
      partialCost: toNumericString(line.lineCostArs),
      sortOrder: line.sortOrder,
    })),
    totalKgBulk: toNumericString(breakdown.totalKgBulk),
    totalCostBulkArs: toNumericString(breakdown.totalCostBulkArs),
    costPerKgPbaArs: toNumericString(breakdown.costPerKgPbaArs),
  };
}

export function serializeBaseProduct(
  bp: BaseProductWithCurrentCost,
  currentFormulaId: string | null = null
): BaseProductDTO {
  const breakdownDto = bp.currentFormulaBreakdown
    ? serializeFormulaBreakdown(bp.currentFormulaBreakdown)
    : null;

  return {
    id: bp.id,
    code: bp.code,
    name: bp.name,
    active: bp.active,
    createdDate: bp.createdDate,
    createdAt: bp.createdAt,
    updatedAt: bp.updatedAt,
    currentFormulaId,
    currentVersion: bp.currentVersionNumber,
    currentCostPerKg: breakdownDto ? breakdownDto.costPerKgPbaArs : null,
    currentFormulaBreakdown: breakdownDto,
  };
}

export function serializeFormulaVersion(
  version: FormulaVersionFullRecord,
  costBreakdown: FormulaCostBreakdown
): FormulaVersionDTO {
  return {
    id: version.id,
    baseProductId: version.baseProductId,
    versionNumber: version.versionNumber,
    businessDate: version.businessDate,
    observations: version.observations,
    isCurrent: version.isCurrent,
    createdAt: version.createdAt,
    costBreakdown: serializeFormulaBreakdown(costBreakdown),
  };
}

export interface FormRowDTO {
  rawMaterialId: string;
  quantityKg: string;
}

export function getInitialFormulaRows(baseProduct: BaseProductDTO): FormRowDTO[] {
  if (baseProduct.currentFormulaBreakdown?.lines && baseProduct.currentFormulaBreakdown.lines.length > 0) {
    return baseProduct.currentFormulaBreakdown.lines.map((l) => ({
      rawMaterialId: l.rawMaterialId,
      quantityKg: l.quantityKg,
    }));
  }
  return [{ rawMaterialId: '', quantityKg: '' }];
}

