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

export interface ComponentRequirementPreviewDTO {
  componentId: string;
  componentCode: string;
  componentName: string;
  quantityPerUnit: number;
  requiredUnits: number;
  availableUnits: string;
  isSufficient: boolean;
  unitCostArs: string;
  totalCostArs: string;
}

export interface PackagingPreviewDTO {
  bulkLotId: string;
  bulkLotCode: string;
  baseProductId: string;
  baseProductName: string;
  kgAvailable: string;
  productId: string;
  productCode: string;
  productName: string;
  productPresentation: string;
  weightKg: string;
  unitsPackaged: number;
  kgConsumed: string;
  isLastOfLot: boolean;
  varianceType: 'NONE' | 'MERMA' | 'SOBRANTE';
  varianceKg: string;
  isBulkSufficient: boolean;
  components: ComponentRequirementPreviewDTO[];
  isAllComponentsSufficient: boolean;
  canPackage: boolean;
  bulkCostPerKgArs: string;
  estimatedUnitCostArs: string;
  estimatedTotalCostArs: string;
}

export interface PackageProductInputDTO {
  bulkLotId: string;
  productId: string;
  unitsPackaged: number | string;
  isLastOfLot?: boolean;
  businessDate?: string;
  observations?: string;
}

export interface PackageProductResultDTO {
  operationId: string;
  packagingOperationId: string;
  envCode: string;
  mfaCode: string;
  mfaVarianceCode?: string | null;
  bulkLotId: string;
  productId: string;
  unitsPackaged: number;
  kgConsumed: string;
  isLastOfLot: boolean;
  varianceType: 'NONE' | 'MERMA' | 'SOBRANTE';
  varianceKg: string;
  bulkLotStatus: 'OPEN' | 'CLOSED';
  bulkLotKgAvailable: string;
  unitCostSnapshotArs: string;
  totalCostSnapshotArs: string;
}

export function serializePackagingPreview(
  preview: import('@/services/factory.service').PackagingPreview
): PackagingPreviewDTO {
  return {
    bulkLotId: preview.bulkLotId,
    bulkLotCode: preview.bulkLotCode,
    baseProductId: preview.baseProductId,
    baseProductName: preview.baseProductName,
    kgAvailable: toNumericString(preview.kgAvailable),
    productId: preview.productId,
    productCode: preview.productCode,
    productName: preview.productName,
    productPresentation: preview.productPresentation,
    weightKg: toNumericString(preview.weightKg),
    unitsPackaged: preview.unitsPackaged,
    kgConsumed: toNumericString(preview.kgConsumed),
    isLastOfLot: preview.isLastOfLot,
    varianceType: preview.varianceType,
    varianceKg: toNumericString(preview.varianceKg),
    isBulkSufficient: preview.isBulkSufficient,
    components: preview.components.map((c) => ({
      componentId: c.componentId,
      componentCode: c.componentCode,
      componentName: c.componentName,
      quantityPerUnit: c.quantityPerUnit,
      requiredUnits: c.requiredUnits,
      availableUnits: toNumericString(c.availableUnits),
      isSufficient: c.isSufficient,
      unitCostArs: toNumericString(c.unitCostArs),
      totalCostArs: toNumericString(c.totalCostArs),
    })),
    isAllComponentsSufficient: preview.isAllComponentsSufficient,
    canPackage: preview.canPackage,
    bulkCostPerKgArs: toNumericString(preview.bulkCostPerKgArs),
    estimatedUnitCostArs: toNumericString(preview.estimatedUnitCostArs),
    estimatedTotalCostArs: toNumericString(preview.estimatedTotalCostArs),
  };
}

export function serializePackageProductResult(
  result: import('@/repositories/factory.repository').PackageProductResult
): PackageProductResultDTO {
  return {
    operationId: result.operationId,
    packagingOperationId: result.packagingOperationId,
    envCode: result.envCode,
    mfaCode: result.mfaCode,
    mfaVarianceCode: result.mfaVarianceCode,
    bulkLotId: result.bulkLotId,
    productId: result.productId,
    unitsPackaged: result.unitsPackaged,
    kgConsumed: toNumericString(result.kgConsumed),
    isLastOfLot: result.isLastOfLot,
    varianceType: result.varianceType,
    varianceKg: toNumericString(result.varianceKg),
    bulkLotStatus: result.bulkLotStatus,
    bulkLotKgAvailable: toNumericString(result.bulkLotKgAvailable),
    unitCostSnapshotArs: toNumericString(result.unitCostSnapshotArs),
    totalCostSnapshotArs: toNumericString(result.totalCostSnapshotArs),
  };
}
