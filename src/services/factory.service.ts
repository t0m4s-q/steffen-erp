import {
  IFactoryRepository,
  FactoryRepository,
  BulkLotRecord,
  FactoryMovementRecord,
  ManufactureBulkLotResult,
  MaterialCostSnapshotInput,
} from '@/repositories/factory.repository';
import { IFormulaRepository, FormulaRepository } from '@/repositories/formula.repository';
import { ISupplierItemRepository, SupplierItemRepository } from '@/repositories/supplier-item.repository';
import { IStockRepository, StockRepository } from '@/repositories/stock.repository';
import { Decimal, VAT_MULTIPLIER_DECIMAL } from '@/domain/decimal';
import { DomainError } from '@/domain/errors';

export interface ManufactureBulkLotParams {
  baseProductId: string;
  formulaVersionId: string;
  kgFabricated: Decimal | number | string;
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

export interface IFactoryDomainService {
  listOpenBulkLots(): Promise<BulkLotRecord[]>;
  listRecentFactoryMovements(limit?: number): Promise<FactoryMovementRecord[]>;
  getManufacturingPreview(
    baseProductId: string,
    kgFabricated: Decimal | number | string
  ): Promise<BulkManufacturingPreview>;
  manufactureBulkLot(params: ManufactureBulkLotParams): Promise<ManufactureBulkLotResult>;
}

export class FactoryDomainService implements IFactoryDomainService {
  constructor(
    private readonly factoryRepo: IFactoryRepository = new FactoryRepository(),
    private readonly formulaRepo: IFormulaRepository = new FormulaRepository(),
    private readonly supplierItemRepo: ISupplierItemRepository = new SupplierItemRepository(),
    private readonly stockRepo: IStockRepository = new StockRepository()
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
}
