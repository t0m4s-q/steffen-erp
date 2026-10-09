import {
  IProductRepository,
  ProductRepository,
  ProductDetailsRecord,
  ProductComponentDetailRecord,
  CreateProductInput,
  UpdateProductInput,
} from '@/repositories/product.repository';
import { IFormulaRepository, FormulaRepository } from '@/repositories/formula.repository';
import { ICostEngineService, CostEngineService, ProductCostResult } from './cost-engine.service';
import { IStockDomainService, StockDomainService } from './stock.service';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface CreateProductDto {
  name: string;
  baseProductId: string;
  presentation: string;
  weightKg: Decimal | number | string;
  stockMinimum: Decimal | number | string;
  components: Array<{
    componentId: string;
    quantityPerUnit: Decimal | number | string;
    sortOrder?: number;
  }>;
  initialStock?: Decimal | number | string;
  createdDate?: string;
}

export interface UpdateProductDto {
  name?: string;
  presentation?: string;
  stockMinimum?: Decimal | number | string;
  active?: boolean;
}

export interface ProductWithCostAndStockRecord extends ProductDetailsRecord {
  balance: Decimal;
  cost: ProductCostResult;
  components: ProductComponentDetailRecord[];
}

export interface IProductDomainService {
  createProduct(dto: CreateProductDto): Promise<ProductWithCostAndStockRecord>;
  getProductDetails(productId: string): Promise<ProductWithCostAndStockRecord | null>;
  listProducts(includeInactive?: boolean): Promise<ProductWithCostAndStockRecord[]>;
  setProductActive(productId: string, active: boolean): Promise<ProductDetailsRecord>;
  updateProduct(productId: string, dto: UpdateProductDto): Promise<ProductDetailsRecord>;
  getCurrentProductCost(productId: string): Promise<ProductCostResult>;
}

export class ProductDomainService implements IProductDomainService {
  constructor(
    private readonly productRepo: IProductRepository = new ProductRepository(),
    private readonly formulaRepo: IFormulaRepository = new FormulaRepository(),
    private readonly costEngineService: ICostEngineService = new CostEngineService(),
    private readonly stockDomainService: IStockDomainService = new StockDomainService()
  ) {}

  /**
   * Alta integral atómica de Producto Final (PRO).
   * Valida negocio (nombre, presentación, peso <= 3 dec, stock mínimo entero > 0,
   * stock inicial opcional entero >= 0, PBA activo con fórmula vigente, BOM no vacío con COM activos sin duplicados).
   * Ejecuta RPC create_final_product y retorna registro enriquecido con saldo y costo teórico.
   */
  async createProduct(dto: CreateProductDto): Promise<ProductWithCostAndStockRecord> {
    // 1. Validar nombre
    if (!dto.name || !dto.name.trim()) {
      throw new DomainError('El nombre del Producto Final es obligatorio.');
    }

    // 2. Validar presentación comercial
    if (!dto.presentation || !dto.presentation.trim()) {
      throw new DomainError('La presentación comercial del Producto Final es obligatoria.');
    }

    // 3. Validar Producto Base (PBA)
    if (!dto.baseProductId || !dto.baseProductId.trim()) {
      throw new DomainError('El Producto Base es obligatorio.');
    }

    // 4. Validar peso (weight_kg > 0 y máximo 3 decimales)
    const weight = new Decimal(String(dto.weightKg));
    if (weight.lte(0)) {
      throw new DomainError('El peso del Producto Final debe ser estrictamente mayor a 0 kg.');
    }
    if (weight.decimalPlaces() > 3) {
      throw new DomainError(`El peso del Producto Final en kg admite como máximo 3 decimales (${weight.toString()}).`);
    }

    // 5. Validar stock mínimo (> 0 y entero)
    const minStock = new Decimal(String(dto.stockMinimum));
    if (minStock.lte(0)) {
      throw new DomainError('El stock mínimo debe ser estrictamente mayor a 0.');
    }
    if (!minStock.isInteger()) {
      throw new DomainError(`El stock mínimo de un Producto Final (UNIT) debe ser un número entero (${minStock.toString()}).`);
    }

    // 6. Validar stock inicial (>= 0 y entero si fue provisto)
    let initStock: Decimal | undefined = undefined;
    if (dto.initialStock !== undefined && dto.initialStock !== null) {
      initStock = new Decimal(String(dto.initialStock));
      if (initStock.lt(0)) {
        throw new DomainError('El stock inicial no puede ser negativo.');
      }
      if (initStock.gt(0) && !initStock.isInteger()) {
        throw new DomainError(`El stock inicial de un Producto Final (UNIT) debe ser un número entero (${initStock.toString()}).`);
      }
    }

    // 7. Validar BOM
    if (!Array.isArray(dto.components) || dto.components.length === 0) {
      throw new DomainError('La composición de componentes (BOM) es obligatoria y debe contener al menos un elemento.');
    }

    const seenComps = new Set<string>();
    const validatedComponents = dto.components.map((c, idx) => {
      if (!c.componentId || !c.componentId.trim()) {
        throw new DomainError('El identificador de componente es obligatorio en cada elemento del BOM.');
      }
      const compId = c.componentId.trim();
      if (seenComps.has(compId)) {
        throw new DomainError(`El componente ${compId} está duplicado en el BOM.`);
      }
      seenComps.add(compId);

      const qty = new Decimal(String(c.quantityPerUnit));
      if (qty.lte(0)) {
        throw new DomainError(`La cantidad por unidad del componente ${compId} debe ser mayor a 0.`);
      }
      if (!qty.isInteger()) {
        throw new DomainError(`La cantidad por unidad del componente ${compId} debe ser un número entero (${qty.toString()}).`);
      }

      return {
        componentId: compId,
        quantityPerUnit: qty,
        sortOrder: c.sortOrder ?? idx + 1,
      };
    });

    // 8. Validar existencia temprana de fórmula vigente para el PBA
    const currentFormula = await this.formulaRepo.getCurrentFormulaWithItems(dto.baseProductId);
    if (!currentFormula) {
      throw new DomainError(`El Producto Base ${dto.baseProductId} no posee una versión de fórmula vigente.`);
    }

    // 9. Ejecutar creación atómica en repositorio
    const createInput: CreateProductInput = {
      name: dto.name.trim(),
      baseProductId: dto.baseProductId,
      presentation: dto.presentation.trim(),
      weightKg: weight,
      stockMinimum: minStock,
      initialStock: initStock,
      createdDate: dto.createdDate,
      components: validatedComponents,
    };

    const created = await this.productRepo.createProduct(createInput);

    // 10. Enriquecer con saldo de stock, componentes y costo teórico actual
    const [balance, rawComponents, cost] = await Promise.all([
      this.stockDomainService.getStockBalance(created.productId),
      this.productRepo.getProductComponents(created.productId),
      this.costEngineService.getCurrentProductCost(created.productId),
    ]);
    const components = await this.enrichComponentsWithCosts(rawComponents);

    return {
      ...created,
      balance,
      cost,
      components,
    };
  }

  /**
   * Obtiene los detalles de un Producto Final con componentes, saldo de stock y desglose de costo teórico.
   */
  async getProductDetails(productId: string): Promise<ProductWithCostAndStockRecord | null> {
    if (!productId || !productId.trim()) {
      throw new DomainError('El productId es obligatorio.');
    }

    const product = await this.productRepo.getProductDetails(productId);
    if (!product) return null;

    const [balance, rawComponents, cost] = await Promise.all([
      this.stockDomainService.getStockBalance(productId),
      this.productRepo.getProductComponents(productId),
      this.costEngineService.getCurrentProductCost(productId),
    ]);
    const components = await this.enrichComponentsWithCosts(rawComponents);

    return {
      ...product,
      balance,
      cost,
      components,
    };
  }

  /**
   * Lista todos los Productos Finales con sus saldos y costos teóricos actuales en batch O(1).
   */
  async listProducts(includeInactive = true): Promise<ProductWithCostAndStockRecord[]> {
    const products = await this.productRepo.listProducts(includeInactive);

    const [balancesMap, detailedCostsMap, allComponents] = await Promise.all([
      this.stockDomainService.getBatchBalances(),
      this.productRepo.getBatchProductDetailedCosts(),
      this.productRepo.listAllProductComponents(),
    ]);

    const componentsByProductId = new Map<string, ProductComponentDetailRecord[]>();
    for (const c of allComponents) {
      const list = componentsByProductId.get(c.productId) || [];
      list.push(c);
      componentsByProductId.set(c.productId, list);
    }

    return products.map((p) => {
      const balance = balancesMap.get(p.productId) ?? new Decimal(0);
      const cost = detailedCostsMap.get(p.productId) ?? {
        baseCost: new Decimal(0),
        componentsCost: new Decimal(0),
        extraVariable: new Decimal(0),
        totalCost: new Decimal(0),
      };
      const components = componentsByProductId.get(p.productId) || [];

      return {
        ...p,
        balance,
        cost,
        components,
      };
    });
  }

  private async enrichComponentsWithCosts(
    components: ProductComponentDetailRecord[]
  ): Promise<ProductComponentDetailRecord[]> {
    return Promise.all(
      components.map(async (c) => {
        let unitCost = new Decimal(0);
        try {
          unitCost = await this.costEngineService.getCurrentStockItemCost(c.componentId);
        } catch {
          unitCost = new Decimal(0);
        }
        return {
          ...c,
          unitCostArs: unitCost,
          lineCostArs: c.quantityPerUnit.times(unitCost),
        };
      })
    );
  }

  /**
   * Modifica el estado activo/inactivo (Sección 37.3 BUSINESS_RULES.md).
   * Delega en updateProduct() para garantizar ejecución vía update_final_product_metadata.
   */
  async setProductActive(productId: string, active: boolean): Promise<ProductDetailsRecord> {
    if (!productId || !productId.trim()) {
      throw new DomainError('El productId es obligatorio.');
    }
    return this.productRepo.setProductActive(productId, active);
  }

  /**
   * Actualiza exclusivamente los campos mutables: name, presentation, stockMinimum, active.
   * Rechaza/ignora cualquier intento de alterar base_product_id, weight_kg o BOM.
   */
  async updateProduct(productId: string, dto: UpdateProductDto): Promise<ProductDetailsRecord> {
    if (!productId || !productId.trim()) {
      throw new DomainError('El productId es obligatorio.');
    }

    if (
      dto.name === undefined &&
      dto.presentation === undefined &&
      dto.stockMinimum === undefined &&
      dto.active === undefined
    ) {
      throw new DomainError('Debe especificarse al menos un campo para actualizar.');
    }

    const input: UpdateProductInput = {};

    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new DomainError('El nombre no puede quedar vacío.');
      input.name = dto.name.trim();
    }

    if (dto.presentation !== undefined) {
      if (!dto.presentation.trim()) throw new DomainError('La presentación comercial no puede quedar vacía.');
      input.presentation = dto.presentation.trim();
    }

    if (dto.stockMinimum !== undefined) {
      const minStock = new Decimal(String(dto.stockMinimum));
      if (minStock.lte(0)) {
        throw new DomainError('El stock mínimo debe ser estrictamente mayor a 0.');
      }
      if (!minStock.isInteger()) {
        throw new DomainError(`El stock mínimo de un Producto Final (UNIT) debe ser un número entero (${minStock.toString()}).`);
      }
      input.stockMinimum = minStock;
    }

    if (dto.active !== undefined) {
      input.active = dto.active;
    }

    return this.productRepo.updateProduct(productId, input);
  }

  /**
   * Desglose dinámico de costo teórico actual:
   * Costo base = weight_kg × costo actual PBA/kg
   * Costo componentes = Σ(quantity_per_unit × costo bruto actual COM)
   * Subtotal = costo base + costo componentes
   * Extra variable = Subtotal × 0.02
   * Costo total = Subtotal × 1.02
   */
  async getCurrentProductCost(productId: string): Promise<ProductCostResult> {
    if (!productId || !productId.trim()) {
      throw new DomainError('El productId es obligatorio.');
    }
    return this.costEngineService.getCurrentProductCost(productId);
  }
}
