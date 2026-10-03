import { ISupplierItemRepository, SupplierItemRepository } from '@/repositories/supplier-item.repository';
import { IFormulaRepository, FormulaRepository } from '@/repositories/formula.repository';
import { IProductRepository, ProductRepository } from '@/repositories/product.repository';
import {
  Decimal,
  VAT_MULTIPLIER_DECIMAL,
  PRODUCT_EXTRA_VARIABLE_FACTOR_DECIMAL,
} from '@/domain/decimal';
import {
  NoActiveSupplierItemCostError,
  InvalidExchangeRateError,
  NoCurrentFormulaError,
  ProductNotFoundError,
} from '@/domain/errors';

export interface FormulaCostResult {
  totalKg: Decimal;
  totalBulkCost: Decimal;
  costPerKg: Decimal;
}

export interface ProductCostResult {
  baseCost: Decimal;
  componentsCost: Decimal;
  extraVariable: Decimal;
  totalCost: Decimal;
}

export interface ICostEngineService {
  getCurrentStockItemCost(stockItemId: string): Promise<Decimal>;
  getCurrentFormulaCost(baseProductId: string): Promise<FormulaCostResult>;
  getCurrentProductCost(productId: string): Promise<ProductCostResult>;
}

export class CostEngineService implements ICostEngineService {
  constructor(
    private readonly supplierItemRepo: ISupplierItemRepository = new SupplierItemRepository(),
    private readonly formulaRepo: IFormulaRepository = new FormulaRepository(),
    private readonly productRepo: IProductRepository = new ProductRepository()
  ) {}

  /**
   * Obtiene el costo teórico bruto unitario (con IVA 21%) para una Materia Prima o Componente.
   * Utiliza aritmética decimal exacta (Decimal.js).
   * Selecciona la relación Proveedor <-> Ítem activa de mayor price_updated_at (desempate determinístico created_at, id).
   * Si la moneda es USD, convierte usando la cotización vigente.
   * Si no existe cotización vigente para USD, lanza InvalidExchangeRateError.
   * No redondea prematuramente.
   */
  async getCurrentStockItemCost(stockItemId: string): Promise<Decimal> {
    const latestItem = await this.supplierItemRepo.getLatestSupplierItem(stockItemId);
    if (!latestItem) {
      throw new NoActiveSupplierItemCostError(stockItemId);
    }

    let fxRate = new Decimal(1);
    if (latestItem.supplierCurrency === 'USD') {
      const usdRate = await this.supplierItemRepo.getCurrentUsdExchangeRate();
      if (!usdRate || usdRate.lte(0)) {
        throw new InvalidExchangeRateError(
          `No existe una cotización vigente para la conversión de USD a ARS requerida por el ítem ${stockItemId}.`
        );
      }
      fxRate = usdRate;
    }

    // Costo teórico bruto con IVA 21%: precio neto * cotización * 1.21
    const unitCostGrossArs = latestItem.quotedUnitPriceNet.times(fxRate).times(VAT_MULTIPLIER_DECIMAL);
    return unitCostGrossArs;
  }

  /**
   * Obtiene el costo teórico actual de un Producto Base (PBA) a partir de su fórmula vigente.
   * Calcula:
   * - Total de kg de granel (Decimal exacto).
   * - Costo total del granel sumando cada MPR valorizada a su costo teórico actual bruto con IVA.
   * - Costo por kg = Costo granel / Total kg granel.
   */
  async getCurrentFormulaCost(baseProductId: string): Promise<FormulaCostResult> {
    const formula = await this.formulaRepo.getCurrentFormulaWithItems(baseProductId);
    if (!formula) {
      throw new NoCurrentFormulaError(baseProductId);
    }

    let totalKg = new Decimal(0);
    let totalBulkCost = new Decimal(0);

    for (const item of formula.items) {
      const mprCostPerKg = await this.getCurrentStockItemCost(item.rawMaterialId);
      const lineCost = item.quantityKg.times(mprCostPerKg);
      totalKg = totalKg.plus(item.quantityKg);
      totalBulkCost = totalBulkCost.plus(lineCost);
    }

    const costPerKg = totalKg.gt(0) ? totalBulkCost.dividedBy(totalKg) : new Decimal(0);

    return {
      totalKg,
      totalBulkCost,
      costPerKg,
    };
  }

  /**
   * Obtiene el costo teórico actual de un Producto Terminado (PRO).
   * Respeta:
   * - Costo base = Peso explícito (kg) * Costo por kg del PBA.
   * - Costo componentes = Suma de cada componente requerido * su costo teórico actual bruto.
   * - Subtotal = Costo base + Costo componentes.
   * - Costo extra variable fijo del 2% = Subtotal * 0.02.
   * - Costo total PRO = Subtotal * 1.02.
   * Todos los cálculos realizados con aritmética decimal exacta sin coma flotante.
   */
  async getCurrentProductCost(productId: string): Promise<ProductCostResult> {
    const product = await this.productRepo.getProductDetails(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    // 1. Costo base desde fórmula vigente de su PBA
    const formulaCost = await this.getCurrentFormulaCost(product.baseProductId);
    const baseCost = product.weightKg.times(formulaCost.costPerKg);

    // 2. Costo de componentes (BOM actual)
    const components = await this.productRepo.getProductComponents(productId);
    let componentsCost = new Decimal(0);

    for (const comp of components) {
      const compUnitCost = await this.getCurrentStockItemCost(comp.componentId);
      componentsCost = componentsCost.plus(comp.quantityPerUnit.times(compUnitCost));
    }

    // 3. Subtotal y extra variable 2%
    const subtotal = baseCost.plus(componentsCost);
    const extraFactor = product.extraVariablePct.gt(0)
      ? product.extraVariablePct.dividedBy(100)
      : PRODUCT_EXTRA_VARIABLE_FACTOR_DECIMAL;
    const extraVariable = subtotal.times(extraFactor);
    const totalCost = subtotal.plus(extraVariable);

    return {
      baseCost,
      componentsCost,
      extraVariable,
      totalCost,
    };
  }
}
