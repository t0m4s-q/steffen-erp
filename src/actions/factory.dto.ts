import { toNumericString } from '@/domain/decimal';
import type {
  BulkLotRecord,
  FactoryMovementRecord,
  ManufactureBulkLotResult,
} from '@/repositories/factory.repository';
import type { BulkManufacturingPreview } from '@/services/factory.service';

export interface BulkLotDTO {
  id: string;
  code: string;
  operationId: string;
  baseProductId: string;
  baseProductName: string;
  baseProductCode: string;
  formulaVersionId: string;
  formulaVersionNumber?: number;
  kgFabricated: string;
  kgAvailable: string;
  status: 'OPEN' | 'CLOSED';
  observations: string | null;
  totalCostSnapshotArs: string;
  costPerKgSnapshotArs: string;
  closedAt: string | null;
  createdAt: string;
  businessDate: string;
}

export interface FactoryMovementDTO {
  id: string;
  code: string;
  operationId: string;
  movementType: string;
  baseProductId: string | null;
  baseProductName: string | null;
  bulkLotId: string | null;
  bulkLotCode: string | null;
  quantityKg: string | null;
  description: string;
  createdAt: string;
  businessDate: string;
}

export interface MaterialRequirementPreviewDTO {
  rawMaterialId: string;
  rawMaterialCode: string;
  rawMaterialName: string;
  requiredKg: string;
  availableKg: string;
  isSufficient: boolean;
  unitCostGrossArs: string;
  totalCostArs: string;
}

export interface BulkManufacturingPreviewDTO {
  baseProductId: string;
  baseProductName: string;
  baseProductCode: string;
  formulaVersionId: string;
  formulaVersionNumber: number;
  kgFabricated: string;
  baseFormulaKg: string;
  scalingFactor: string;
  items: MaterialRequirementPreviewDTO[];
  isAllSufficient: boolean;
  estimatedTotalCostArs: string;
  estimatedCostPerKgArs: string;
}

export interface ManufactureBulkLotResultDTO {
  operationId: string;
  bulkLotId: string;
  graCode: string;
  mfaCode: string;
  baseProductId: string;
  formulaVersionId: string;
  kgFabricated: string;
  kgAvailable: string;
  totalCostSnapshotArs: string;
  costPerKgSnapshotArs: string;
}

export function serializeBulkLot(lot: BulkLotRecord): BulkLotDTO {
  return {
    id: lot.id,
    code: lot.code,
    operationId: lot.operationId,
    baseProductId: lot.baseProductId,
    baseProductName: lot.baseProductName,
    baseProductCode: lot.baseProductCode,
    formulaVersionId: lot.formulaVersionId,
    formulaVersionNumber: lot.formulaVersionNumber,
    kgFabricated: toNumericString(lot.kgFabricated),
    kgAvailable: toNumericString(lot.kgAvailable),
    status: lot.status,
    observations: lot.observations,
    totalCostSnapshotArs: toNumericString(lot.totalCostSnapshotArs),
    costPerKgSnapshotArs: toNumericString(lot.costPerKgSnapshotArs),
    closedAt: lot.closedAt,
    createdAt: lot.createdAt,
    businessDate: lot.businessDate,
  };
}

export function serializeFactoryMovement(mov: FactoryMovementRecord): FactoryMovementDTO {
  return {
    id: mov.id,
    code: mov.code,
    operationId: mov.operationId,
    movementType: mov.movementType,
    baseProductId: mov.baseProductId,
    baseProductName: mov.baseProductName,
    bulkLotId: mov.bulkLotId,
    bulkLotCode: mov.bulkLotCode,
    quantityKg: mov.quantityKg ? toNumericString(mov.quantityKg) : null,
    description: mov.description,
    createdAt: mov.createdAt,
    businessDate: mov.businessDate,
  };
}

export function serializeManufacturingPreview(
  preview: BulkManufacturingPreview
): BulkManufacturingPreviewDTO {
  return {
    baseProductId: preview.baseProductId,
    baseProductName: preview.baseProductName,
    baseProductCode: preview.baseProductCode,
    formulaVersionId: preview.formulaVersionId,
    formulaVersionNumber: preview.formulaVersionNumber,
    kgFabricated: toNumericString(preview.kgFabricated),
    baseFormulaKg: toNumericString(preview.baseFormulaKg),
    scalingFactor: toNumericString(preview.scalingFactor),
    items: preview.items.map((it) => ({
      rawMaterialId: it.rawMaterialId,
      rawMaterialCode: it.rawMaterialCode,
      rawMaterialName: it.rawMaterialName,
      requiredKg: toNumericString(it.requiredKg),
      availableKg: toNumericString(it.availableKg),
      isSufficient: it.isSufficient,
      unitCostGrossArs: toNumericString(it.unitCostGrossArs),
      totalCostArs: toNumericString(it.totalCostArs),
    })),
    isAllSufficient: preview.isAllSufficient,
    estimatedTotalCostArs: toNumericString(preview.estimatedTotalCostArs),
    estimatedCostPerKgArs: toNumericString(preview.estimatedCostPerKgArs),
  };
}

export function serializeManufactureResult(
  result: ManufactureBulkLotResult
): ManufactureBulkLotResultDTO {
  return {
    operationId: result.operationId,
    bulkLotId: result.bulkLotId,
    graCode: result.graCode,
    mfaCode: result.mfaCode,
    baseProductId: result.baseProductId,
    formulaVersionId: result.formulaVersionId,
    kgFabricated: toNumericString(result.kgFabricated),
    kgAvailable: toNumericString(result.kgAvailable),
    totalCostSnapshotArs: toNumericString(result.totalCostSnapshotArs),
    costPerKgSnapshotArs: toNumericString(result.costPerKgSnapshotArs),
  };
}
