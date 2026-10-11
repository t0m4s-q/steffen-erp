import {
  IFactoryRepository,
  FactoryRepository,
  BulkLotRecord,
  FactoryMovementRecord,
  ManufactureBulkLotResult,
  MaterialCostSnapshotInput,
  PackageProductInput,
  PackageProductResult,
  ComponentCostSnapshotInput,
} from '@/repositories/factory.repository';
import { IFormulaRepository, FormulaRepository } from '@/repositories/formula.repository';
import { ISupplierItemRepository, SupplierItemRepository } from '@/repositories/supplier-item.repository';
import { IStockRepository, StockRepository } from '@/repositories/stock.repository';
import { IProductRepository, ProductRepository } from '@/repositories/product.repository';
import { ICostEngineService, CostEngineService } from '@/services/cost-engine.service';
import { Decimal, VAT_MULTIPLIER_DECIMAL } from '@/domain/decimal';
import { DomainError } from '@/domain/errors';

export interface ManufactureBulkLotParams {
  baseProductId: string;
  formulaVersionId: string;
  kgFabricated: Decimal | number | string;
  businessDate?: string;
  observations?: string;
}

export interface PackageProductParams {
  bulkLotId: string;
  productId: string;
  unitsPackaged: Decimal | number | string;
  isLastOfLot?: boolean;
  businessDate?: string;
  observations?: string;
}

export interface MaterialRequirementPreview {
  rawMaterialId: string;
  rawMaterialCode: string;
  rawMaterialName: string;
  requiredKg: Decimal;
  availableKg: Decimal;
  isSufficient: boolean;
  unitCostGrossArs: Decimal;
  totalCostArs: Decimal;
}

export interface ComponentRequirementPreview {
  componentId: string;
  componentCode: string;
  componentName: string;
  quantityPerUnit: number;
  requiredUnits: number;
  availableUnits: Decimal;
  isSufficient: boolean;
  unitCostArs: Decimal;
  totalCostArs: Decimal;
}

export interface BulkManufacturingPreview {
  baseProductId: string;
  baseProductName: string;
  baseProductCode: string;
  formulaVersionId: string;
  formulaVersionNumber: number;
  kgFabricated: Decimal;
  baseFormulaKg: Decimal;
  scalingFactor: Decimal;
  items: MaterialRequirementPreview[];
  isAllSufficient: boolean;
  estimatedTotalCostArs: Decimal;
  estimatedCostPerKgArs: Decimal;
}

export interface PackagingPreview {
  bulkLotId: string;
  bulkLotCode: string;
  baseProductId: string;
  baseProductName: string;
  kgAvailable: Decimal;
  productId: string;
  productCode: string;
  productName: string;
  productPresentation: string;
  weightKg: Decimal;
  unitsPackaged: number;
  kgConsumed: Decimal;
  isLastOfLot: boolean;
  varianceType: 'NONE' | 'MERMA' | 'SOBRANTE';
  varianceKg: Decimal;
  isBulkSufficient: boolean;
  components: ComponentRequirementPreview[];
  isAllComponentsSufficient: boolean;
  canPackage: boolean;
  bulkCostPerKgArs: Decimal;
  estimatedUnitCostArs: Decimal;
  estimatedTotalCostArs: Decimal;
}

export interface IFactoryDomainService {
  listOpenBulkLots(): Promise<BulkLotRecord[]>;
  listRecentFactoryMovements(limit?: number): Promise<FactoryMovementRecord[]>;
  getManufacturingPreview(
    baseProductId: string,
    kgFabricated: Decimal | number | string
  ): Promise<BulkManufacturingPreview>;
  manufactureBulkLot(params: ManufactureBulkLotParams): Promise<ManufactureBulkLotResult>;
  getPackagingPreview(
    bulkLotId: string,
    productId: string,
    unitsPackaged: Decimal | number | string,
    isLastOfLot?: boolean
  ): Promise<PackagingPreview>;
  packageProduct(params: PackageProductParams): Promise<PackageProductResult>;
}

export class FactoryDomainService implements IFactoryDomainService {
  constructor(
    private readonly factoryRepo: IFactoryRepository = new FactoryRepository(),
    private readonly formulaRepo: IFormulaRepository = new FormulaRepository(),
    private readonly supplierItemRepo: ISupplierItemRepository = new SupplierItemRepository(),
    private readonly stockRepo: IStockRepository = new StockRepository(),
    private readonly productRepo: IProductRepository = new ProductRepository(),
    private readonly costEngineService: ICostEngineService = new CostEngineService()
  ) {}

  async listOpenBulkLots(): Promise<BulkLotRecord[]> {
    return await this.factoryRepo.listOpenBulkLots();
  }

  async listRecentFactoryMovements(limit: number = 50): Promise<FactoryMovementRecord[]> {
    return await this.factoryRepo.listRecentFactoryMovements(limit);
  }

  async getManufacturingPreview(
    baseProductId: string,
    kgFabricated: Decimal | number | string
  ): Promise<BulkManufacturingPreview> {
    if (!baseProductId) {
      throw new DomainError('El baseProductId es obligatorio.');
    }

    const kgFabDecimal = new Decimal(kgFabricated);
    if (kgFabDecimal.lte(0)) {
      throw new DomainError('La cantidad a fabricar debe ser mayor a 0 kg.');
    }

    // Máximo 3 decimales para kg
    if (kgFabDecimal.decimalPlaces() > 3) {
      throw new DomainError('La cantidad a fabricar no puede tener más de 3 decimales.');
    }

    const baseProduct = await this.formulaRepo.getBaseProductById(baseProductId);
    if (!baseProduct) {
      throw new DomainError(`Producto Base ${baseProductId} no encontrado.`);
    }

    const currentFormula = await this.formulaRepo.getCurrentFormulaWithItems(baseProductId);
    if (!currentFormula) {
      throw new DomainError(`El Producto Base "${baseProduct.name}" no tiene fórmula vigente.`);
    }

    if (!currentFormula.items || currentFormula.items.length === 0) {
      throw new DomainError(`La fórmula vigente de "${baseProduct.name}" no contiene materias primas.`);
    }

    let baseFormulaKg = new Decimal(0);
    for (const item of currentFormula.items) {
      baseFormulaKg = baseFormulaKg.plus(item.quantityKg);
    }

    if (baseFormulaKg.lte(0)) {
      throw new DomainError('El peso total de la fórmula base debe ser mayor a 0 kg.');
    }

    const scalingFactor = kgFabDecimal.dividedBy(baseFormulaKg);
    const balancesMap = await this.stockRepo.getBatchBalances();

    // Obtener cotización USD si es necesaria
    const usdRate = await this.supplierItemRepo.getCurrentUsdExchangeRate();

    const itemsPreview: MaterialRequirementPreview[] = [];
    let isAllSufficient = true;
    let estimatedTotalCost = new Decimal(0);

    for (const it of currentFormula.items) {
      const stockItem = await this.stockRepo.getStockItem(it.rawMaterialId);
      const availableKg = balancesMap.get(it.rawMaterialId) || new Decimal(0);

      // Regla normativa de escalado: round_half_up a 3 decimales
      const requiredKg = it.quantityKg.times(scalingFactor).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      const isSufficient = availableKg.gte(requiredKg);

      if (!isSufficient) {
        isAllSufficient = false;
      }

      // Costo teórico actual
      let unitCostGrossArs = new Decimal(0);
      const latestSupplier = await this.supplierItemRepo.getLatestSupplierItem(it.rawMaterialId);

      if (latestSupplier) {
        let fxRate = new Decimal(1);
        if (latestSupplier.supplierCurrency === 'USD') {
          if (!usdRate || usdRate.lte(0)) {
            throw new DomainError(`Cotización USD requerida pero no configurada para ${stockItem?.code || it.rawMaterialId}`);
          }
          fxRate = usdRate;
        }
        unitCostGrossArs = latestSupplier.quotedUnitPriceNet.times(fxRate).times(VAT_MULTIPLIER_DECIMAL);
      }

      const totalCostArs = requiredKg.times(unitCostGrossArs).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
      estimatedTotalCost = estimatedTotalCost.plus(totalCostArs);

      itemsPreview.push({
        rawMaterialId: it.rawMaterialId,
        rawMaterialCode: stockItem?.code || '',
        rawMaterialName: stockItem?.name || 'Materia Prima Desconocida',
        requiredKg,
        availableKg,
        isSufficient,
        unitCostGrossArs,
        totalCostArs,
      });
    }

    const estimatedCostPerKgArs = kgFabDecimal.gt(0)
      ? estimatedTotalCost.dividedBy(kgFabDecimal).toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    return {
      baseProductId,
      baseProductName: baseProduct.name,
      baseProductCode: baseProduct.code,
      formulaVersionId: currentFormula.formulaVersionId,
      formulaVersionNumber: currentFormula.versionNumber,
      kgFabricated: kgFabDecimal,
      baseFormulaKg,
      scalingFactor,
      items: itemsPreview,
      isAllSufficient,
      estimatedTotalCostArs: estimatedTotalCost,
      estimatedCostPerKgArs,
    };
  }

  async manufactureBulkLot(params: ManufactureBulkLotParams): Promise<ManufactureBulkLotResult> {
    const { baseProductId, formulaVersionId, kgFabricated, businessDate, observations } = params;

    if (!baseProductId) {
      throw new DomainError('El baseProductId es obligatorio.');
    }
    if (!formulaVersionId) {
      throw new DomainError('El formulaVersionId es obligatorio.');
    }

    const kgFabDecimal = new Decimal(kgFabricated);
    if (kgFabDecimal.lte(0)) {
      throw new DomainError('La cantidad a fabricar debe ser mayor a 0 kg.');
    }
    if (kgFabDecimal.decimalPlaces() > 3) {
      throw new DomainError('La cantidad a fabricar no puede tener más de 3 decimales.');
    }

    // 1. Validar versión de fórmula inmutable y vigencia
    const currentFormula = await this.formulaRepo.getCurrentFormulaWithItems(baseProductId);
    if (!currentFormula) {
      throw new DomainError(`El Producto Base ${baseProductId} no tiene fórmula vigente.`);
    }

    if (currentFormula.formulaVersionId !== formulaVersionId) {
      throw new DomainError(
        `La versión de fórmula enviada (${formulaVersionId}) ya no es la versión vigente del Producto Base. Recargue la pantalla antes de fabricar.`
      );
    }

    // 2. Construir snapshots de costos de todas las materias primas desde el motor de costos
    const usdRate = await this.supplierItemRepo.getCurrentUsdExchangeRate();
    const costSnapshots: MaterialCostSnapshotInput[] = [];

    for (const it of currentFormula.items) {
      const latestSupplier = await this.supplierItemRepo.getLatestSupplierItem(it.rawMaterialId);
      if (!latestSupplier) {
        const itemInfo = await this.stockRepo.getStockItem(it.rawMaterialId);
        throw new DomainError(
          `La materia prima ${itemInfo?.code || it.rawMaterialId} (${itemInfo?.name || ''}) no tiene una relación con proveedor activa para calcular costos.`
        );
      }

      let fxRateSnapshot: Decimal | null = null;
      let effectiveFx = new Decimal(1);

      if (latestSupplier.supplierCurrency === 'USD') {
        if (!usdRate || usdRate.lte(0)) {
          throw new DomainError('Cotización USD requerida pero no configurada en el sistema.');
        }
        fxRateSnapshot = usdRate;
        effectiveFx = usdRate;
      }

      const vatRatePct = new Decimal(21.0000);
      const unitCostGrossArsSnapshot = latestSupplier.quotedUnitPriceNet
        .times(effectiveFx)
        .times(VAT_MULTIPLIER_DECIMAL)
        .toDecimalPlaces(6, Decimal.ROUND_HALF_UP);

      costSnapshots.push({
        rawMaterialId: it.rawMaterialId,
        sourceSupplierId: latestSupplier.supplierId,
        sourceCurrency: latestSupplier.supplierCurrency,
        sourceUnitPriceNet: latestSupplier.quotedUnitPriceNet,
        fxRateSnapshot,
        vatRatePct,
        unitCostGrossArsSnapshot,
      });
    }

    // 3. Delegar la transacción atómica completa a la RPC de PostgreSQL
    return await this.factoryRepo.manufactureBulkLotAtomic({
      baseProductId,
      formulaVersionId,
      kgFabricated: kgFabDecimal,
      businessDate,
      observations,
      costSnapshots,
    });
  }

  async getPackagingPreview(
    bulkLotId: string,
    productId: string,
    unitsPackaged: Decimal | number | string,
    isLastOfLot?: boolean
  ): Promise<PackagingPreview> {
    if (!bulkLotId) {
      throw new DomainError('El bulkLotId es obligatorio.');
    }
    if (!productId) {
      throw new DomainError('El productId es obligatorio.');
    }

    const unitsDec = new Decimal(String(unitsPackaged));
    if (!unitsDec.isInteger() || unitsDec.lte(0)) {
      throw new DomainError('La cantidad a envasar debe ser un número entero mayor a 0.');
    }
    const units = unitsDec.toNumber();

    const bulkLot = await this.factoryRepo.getBulkLotById(bulkLotId);
    if (!bulkLot) {
      throw new DomainError(`Lote de granel ${bulkLotId} no encontrado.`);
    }
    if (bulkLot.status !== 'OPEN') {
      throw new DomainError(`El lote ${bulkLot.code} está cerrado y no admite envasado.`);
    }

    const product = await this.productRepo.getProductDetails(productId);
    if (!product) {
      throw new DomainError(`Producto Final ${productId} no encontrado.`);
    }
    if (!product.active) {
      throw new DomainError(`El Producto Final "${product.name}" está inactivo.`);
    }

    if (product.baseProductId !== bulkLot.baseProductId) {
      throw new DomainError(
        `El Producto Final "${product.name}" no corresponde al Producto Base del lote seleccionado (${bulkLot.baseProductName}).`
      );
    }

    const kgConsumed = unitsDec.times(product.weightKg).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    const isLast = Boolean(isLastOfLot);
    const isBulkSufficient = isLast || kgConsumed.lte(bulkLot.kgAvailable);

    let varianceType: 'NONE' | 'MERMA' | 'SOBRANTE' = 'NONE';
    let varianceKg = new Decimal(0);
    if (isLast) {
      if (kgConsumed.lt(bulkLot.kgAvailable)) {
        varianceType = 'MERMA';
        varianceKg = bulkLot.kgAvailable.minus(kgConsumed).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      } else if (kgConsumed.gt(bulkLot.kgAvailable)) {
        varianceType = 'SOBRANTE';
        varianceKg = kgConsumed.minus(bulkLot.kgAvailable).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      } else {
        varianceType = 'NONE';
        varianceKg = new Decimal(0);
      }
    }

    const components = await this.productRepo.getProductComponents(productId);
    if (!components || components.length === 0) {
      throw new DomainError(`El Producto Final "${product.name}" no tiene componentes configurados (BOM).`);
    }

    // Consulta batch de saldos de componentes
    const balanceMap = await this.stockRepo.getBatchBalances();

    let unitCompsCostSum = new Decimal(0);
    const componentPreviews: ComponentRequirementPreview[] = [];

    for (const comp of components) {
      const qPerUnit = comp.quantityPerUnit.toNumber();
      const requiredUnits = units * qPerUnit;
      const availableUnits = balanceMap.get(comp.componentId) || new Decimal(0);
      const isSufficient = availableUnits.gte(requiredUnits);

      let unitCost = new Decimal(0);
      try {
        unitCost = await this.costEngineService.getCurrentStockItemCost(comp.componentId);
      } catch {
        unitCost = new Decimal(0);
      }

      const totalCost = new Decimal(requiredUnits).times(unitCost).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
      unitCompsCostSum = unitCompsCostSum.plus(new Decimal(qPerUnit).times(unitCost));

      componentPreviews.push({
        componentId: comp.componentId,
        componentCode: comp.componentCode,
        componentName: comp.componentName,
        quantityPerUnit: qPerUnit,
        requiredUnits,
        availableUnits,
        isSufficient,
        unitCostArs: unitCost,
        totalCostArs: totalCost,
      });
    }

    const isAllComponentsSufficient = componentPreviews.every((c) => c.isSufficient);
    const canPackage = isBulkSufficient && isAllComponentsSufficient;

    // Costo unitario teórico congelado
    const bulkCostPerKg = bulkLot.costPerKgSnapshotArs;
    const unitBaseCost = product.weightKg.times(bulkCostPerKg).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
    const unitSubtotal = unitBaseCost.plus(unitCompsCostSum);
    const unitExtraVariable = unitSubtotal.times(product.extraVariablePct.dividedBy(100));
    const estimatedUnitCostArs = unitSubtotal.plus(unitExtraVariable).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
    const estimatedTotalCostArs = unitsDec.times(estimatedUnitCostArs).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);

    return {
      bulkLotId,
      bulkLotCode: bulkLot.code,
      baseProductId: bulkLot.baseProductId,
      baseProductName: bulkLot.baseProductName,
      kgAvailable: bulkLot.kgAvailable,
      productId: product.productId,
      productCode: product.code,
      productName: product.name,
      productPresentation: product.presentation,
      weightKg: product.weightKg,
      unitsPackaged: units,
      kgConsumed,
      isLastOfLot: isLast,
      varianceType,
      varianceKg,
      isBulkSufficient,
      components: componentPreviews,
      isAllComponentsSufficient,
      canPackage,
      bulkCostPerKgArs: bulkCostPerKg,
      estimatedUnitCostArs,
      estimatedTotalCostArs,
    };
  }

  async packageProduct(params: PackageProductParams): Promise<PackageProductResult> {
    const { bulkLotId, productId, unitsPackaged, isLastOfLot, businessDate, observations } = params;

    if (!bulkLotId) {
      throw new DomainError('El bulkLotId es obligatorio.');
    }
    if (!productId) {
      throw new DomainError('El productId es obligatorio.');
    }

    const unitsDec = new Decimal(String(unitsPackaged));
    if (!unitsDec.isInteger() || unitsDec.lte(0)) {
      throw new DomainError('La cantidad a envasar debe ser un número entero mayor a 0.');
    }
    const units = unitsDec.toNumber();

    const components = await this.productRepo.getProductComponents(productId);
    if (!components || components.length === 0) {
      throw new DomainError(`El producto seleccionado no tiene componentes configurados (BOM).`);
    }

    const componentCosts: ComponentCostSnapshotInput[] = [];
    for (const comp of components) {
      const unitCost = await this.costEngineService.getCurrentStockItemCost(comp.componentId);
      componentCosts.push({
        componentId: comp.componentId,
        unitCostGrossArsSnapshot: unitCost.toDecimalPlaces(6, Decimal.ROUND_HALF_UP),
      });
    }

    return await this.factoryRepo.packageProductAtomic({
      bulkLotId,
      productId,
      unitsPackaged: units,
      isLastOfLot: Boolean(isLastOfLot),
      businessDate,
      observations,
      componentCosts,
    });
  }
}
