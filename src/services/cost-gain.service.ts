import { Decimal } from '@/domain/decimal';
import {
  DomainError,
  NoCurrentFormulaError,
  NoActiveSupplierItemCostError,
  InvalidExchangeRateError,
  ProductNotFoundError,
} from '@/domain/errors';
import {
  IDiscountProfileRepository,
  DiscountProfileRepository,
  DiscountProfileWithStepsRecord,
} from '@/repositories/discount-profile.repository';
import { IPriceListRepository, PriceListRepository, PriceListRecord } from '@/repositories/price-list.repository';
import { IProductRepository, ProductRepository, ProductDetailsRecord } from '@/repositories/product.repository';
import { ICostEngineService, CostEngineService } from './cost-engine.service';

export class SalonPriceListNotFoundError extends DomainError {
  constructor(message = 'No se encontró la lista de precios del sistema con rol SALON_DEFAULT.') {
    super(message);
    this.name = 'SalonPriceListNotFoundError';
  }
}

export class InactiveSalonPriceListError extends DomainError {
  constructor(message = 'La lista de precios del sistema con rol SALON_DEFAULT se encuentra inactiva.') {
    super(message);
    this.name = 'InactiveSalonPriceListError';
  }
}

export class DiscountProfileNotFoundError extends DomainError {
  constructor(idOrName: string) {
    super(`Perfil de descuento no encontrado o inactivo: ${idOrName}`);
    this.name = 'DiscountProfileNotFoundError';
  }
}

export class InvalidDiscountProfileConfigurationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDiscountProfileConfigurationError';
  }
}

export class InvalidProductCostInconsistencyError extends DomainError {
  constructor(productId: string, costStr: string) {
    super(`Inconsistencia de dominio: el costo teórico del producto ${productId} es negativo (${costStr}).`);
    this.name = 'InvalidProductCostInconsistencyError';
  }
}

export interface CostGainProductAnalysis {
  productId: string;
  productCode: string;
  productName: string;
  presentation: string;
  weightKg: Decimal;
  active: boolean;

  hasSalonPrice: boolean;
  salonPriceArs: Decimal | null;

  hasCost: boolean;
  theoreticalCostArs: Decimal | null;
  costError?: string;

  netPriceArs: Decimal | null;
  gainArs: Decimal | null;
  markup: Decimal | null;
}

export interface CostGainAnalysisResult {
  salonPriceList: {
    id: string;
    name: string;
    systemRole: 'SALON_DEFAULT';
  };
  selectedProfile: DiscountProfileWithStepsRecord;
  availableProfiles: DiscountProfileWithStepsRecord[];
  products: CostGainProductAnalysis[];
  analyzedAt: string;
}

export interface ICostGainDomainService {
  listDiscountProfiles(): Promise<DiscountProfileWithStepsRecord[]>;
  getProductAnalysis(productId: string, discountProfileId?: string): Promise<CostGainProductAnalysis>;
  listProductAnalysis(discountProfileId?: string, includeInactive?: boolean): Promise<CostGainAnalysisResult>;
}

export class CostGainDomainService implements ICostGainDomainService {
  constructor(
    private readonly discountProfileRepo: IDiscountProfileRepository = new DiscountProfileRepository(),
    private readonly priceListRepo: IPriceListRepository = new PriceListRepository(),
    private readonly productRepo: IProductRepository = new ProductRepository(),
    private readonly costEngineService: ICostEngineService = new CostEngineService()
  ) {}

  async listDiscountProfiles(): Promise<DiscountProfileWithStepsRecord[]> {
    return this.discountProfileRepo.listActiveProfiles();
  }

  private async resolveSalonList(): Promise<PriceListRecord> {
    const salonList = await this.priceListRepo.getPriceListBySystemRole('SALON_DEFAULT');
    if (!salonList) {
      throw new SalonPriceListNotFoundError();
    }
    if (!salonList.active) {
      throw new InactiveSalonPriceListError();
    }
    return salonList;
  }

  private async resolveProfile(
    discountProfileId?: string
  ): Promise<{ selectedProfile: DiscountProfileWithStepsRecord; availableProfiles: DiscountProfileWithStepsRecord[] }> {
    let selectedProfile: DiscountProfileWithStepsRecord | null = null;
    let availableProfiles: DiscountProfileWithStepsRecord[] = [];

    if (discountProfileId) {
      selectedProfile = await this.discountProfileRepo.getProfileWithSteps(discountProfileId);
      if (!selectedProfile || !selectedProfile.active) {
        throw new DiscountProfileNotFoundError(discountProfileId);
      }
      availableProfiles = await this.discountProfileRepo.listActiveProfiles();
      if (availableProfiles.length === 0) {
        availableProfiles = [selectedProfile];
      }
    } else {
      availableProfiles = await this.discountProfileRepo.listActiveProfiles();
      if (availableProfiles.length === 0) {
        throw new InvalidDiscountProfileConfigurationError('No existen perfiles de descuento activos configurados en el sistema.');
      }
      selectedProfile = availableProfiles[0];
    }

    if (!selectedProfile.steps || selectedProfile.steps.length === 0) {
      throw new InvalidDiscountProfileConfigurationError(
        `El perfil de descuento "${selectedProfile.name}" (${selectedProfile.id}) no posee ningún paso de descuento configurado.`
      );
    }

    // Validación defensiva de cada paso: 0 <= percent <= 100
    for (const step of selectedProfile.steps) {
      if (step.percent.lt(0) || step.percent.gt(100)) {
        throw new InvalidDiscountProfileConfigurationError(
          `El paso ${step.position} del perfil "${selectedProfile.name}" posee un porcentaje inválido: ${step.percent.toString()}%. Debe estar entre 0 y 100.`
        );
      }
    }

    return { selectedProfile, availableProfiles };
  }

  private calculateNetPrice(salonPrice: Decimal, steps: DiscountProfileWithStepsRecord['steps']): Decimal {
    let net = salonPrice;
    for (const step of steps) {
      const factor = new Decimal(1).minus(step.percent.dividedBy(100));
      net = net.times(factor);
    }
    return net;
  }

  async getProductAnalysis(productId: string, discountProfileId?: string): Promise<CostGainProductAnalysis> {
    const product = await this.productRepo.getProductDetails(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    const salonList = await this.resolveSalonList();
    const { selectedProfile } = await this.resolveProfile(discountProfileId);

    // 1. Precio de lista Salón vigente
    const currentPriceRecord = await this.priceListRepo.getCurrentPrice(salonList.id, productId);
    const hasSalonPrice = currentPriceRecord !== null && currentPriceRecord.priceArs !== null;
    const salonPriceArs = hasSalonPrice ? currentPriceRecord.priceArs : null;

    // 2. Precio neto analítico
    let netPriceArs: Decimal | null = null;
    if (hasSalonPrice && salonPriceArs) {
      netPriceArs = this.calculateNetPrice(salonPriceArs, selectedProfile.steps);
    }

    // 3. Costo teórico actual (en getProductAnalysis no toleramos fallos para alertar al caller)
    const costResult = await this.costEngineService.getCurrentProductCost(productId);
    const cost = costResult.totalCost;
    if (cost.lt(0)) {
      throw new InvalidProductCostInconsistencyError(productId, cost.toString());
    }

    const hasCost = true;
    const theoreticalCostArs = cost;

    let gainArs: Decimal | null = null;
    let markup: Decimal | null = null;

    if (hasSalonPrice && netPriceArs !== null) {
      if (cost.isZero()) {
        gainArs = netPriceArs;
        markup = null;
      } else {
        gainArs = netPriceArs.minus(cost);
        markup = netPriceArs.dividedBy(cost);
      }
    }

    return {
      productId: product.productId,
      productCode: product.code,
      productName: product.name,
      presentation: product.presentation,
      weightKg: product.weightKg,
      active: product.active,
      hasSalonPrice,
      salonPriceArs,
      hasCost,
      theoreticalCostArs,
      netPriceArs,
      gainArs,
      markup,
    };
  }

  async listProductAnalysis(
    discountProfileId?: string,
    includeInactive = false
  ): Promise<CostGainAnalysisResult> {
    const salonList = await this.resolveSalonList();
    const { selectedProfile, availableProfiles } = await this.resolveProfile(discountProfileId);

    const products = await this.productRepo.listProducts(includeInactive);
    const currentPrices = await this.priceListRepo.listCurrentPrices(salonList.id);

    const priceMap = new Map<string, Decimal>();
    for (const cp of currentPrices) {
      priceMap.set(cp.productId, cp.priceArs);
    }

    // Lectura batch de costos teóricos vigentes desde v_current_product_cost (O(1) queries)
    const hasBatchCostSupport = typeof this.costEngineService.getBatchProductCosts === 'function';
    let batchCostMap: Map<string, Decimal> | null = null;
    if (hasBatchCostSupport) {
      batchCostMap = await this.costEngineService.getBatchProductCosts!();
    }

    const analyzedProducts: CostGainProductAnalysis[] = [];

    for (const prod of products) {
      // 1. Precio Salón vigente
      const salonPrice = priceMap.get(prod.productId) ?? null;
      const hasSalonPrice = salonPrice !== null;
      const salonPriceArs = salonPrice;

      // 2. Precio neto analítico
      let netPriceArs: Decimal | null = null;
      if (hasSalonPrice && salonPrice) {
        netPriceArs = this.calculateNetPrice(salonPrice, selectedProfile.steps);
      }

      // 3. Costo teórico con tolerancia estricta por fila para errores de dominio conocidos
      let hasCost = false;
      let theoreticalCostArs: Decimal | null = null;
      let costError: string | undefined;
      let gainArs: Decimal | null = null;
      let markup: Decimal | null = null;

      if (hasBatchCostSupport && batchCostMap) {
        const cost = batchCostMap.get(prod.productId);
        if (cost !== undefined) {
          if (cost.lt(0)) {
            throw new InvalidProductCostInconsistencyError(prod.productId, cost.toString());
          }

          hasCost = true;
          theoreticalCostArs = cost;

          if (hasSalonPrice && netPriceArs !== null) {
            if (cost.isZero()) {
              gainArs = netPriceArs;
              markup = null;
            } else {
              gainArs = netPriceArs.minus(cost);
              markup = netPriceArs.dividedBy(cost);
            }
          }
        } else {
          // Si para un producto la vista consolidada no devuelve costo válido (ej. inactivo o sin fórmula vigente)
          hasCost = false;
          theoreticalCostArs = null;
          costError = 'Sin costo registrado en la vista consolidada';
          gainArs = null;
          markup = null;
        }
      } else {
        // Fallback para engines mockeados que no implementan lectura batch
        try {
          const costResult = await this.costEngineService.getCurrentProductCost(prod.productId);
          const cost = costResult.totalCost;
          if (cost.lt(0)) {
            throw new InvalidProductCostInconsistencyError(prod.productId, cost.toString());
          }

          hasCost = true;
          theoreticalCostArs = cost;

          if (hasSalonPrice && netPriceArs !== null) {
            if (cost.isZero()) {
              gainArs = netPriceArs;
              markup = null;
            } else {
              gainArs = netPriceArs.minus(cost);
              markup = netPriceArs.dividedBy(cost);
            }
          }
        } catch (err: unknown) {
          // Tolerancia restringida a errores de configuración de insumos/fórmulas que impiden calcular costo teórico actual
          if (
            err instanceof NoCurrentFormulaError ||
            err instanceof NoActiveSupplierItemCostError ||
            err instanceof InvalidExchangeRateError
          ) {
            hasCost = false;
            theoreticalCostArs = null;
            costError = err.message;
            gainArs = null;
            markup = null;
          } else {
            // Errores de infraestructura, Supabase, inconsistencia de dominio o programación se propagan
            throw err;
          }
        }
      }

      analyzedProducts.push({
        productId: prod.productId,
        productCode: prod.code,
        productName: prod.name,
        presentation: prod.presentation,
        weightKg: prod.weightKg,
        active: prod.active,
        hasSalonPrice,
        salonPriceArs,
        hasCost,
        theoreticalCostArs,
        costError,
        netPriceArs,
        gainArs,
        markup,
      });
    }

    return {
      salonPriceList: {
        id: salonList.id,
        name: salonList.name,
        systemRole: 'SALON_DEFAULT',
      },
      selectedProfile,
      availableProfiles,
      products: analyzedProducts,
      analyzedAt: new Date().toISOString(),
    };
  }
}
