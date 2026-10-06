import {
  IPriceListRepository,
  PriceListRepository,
  PriceListRecord,
  ProductPriceVersionRecord,
  BulkPriceIncreaseResult,
} from '@/repositories/price-list.repository';
import { DomainError, NoPriceSnapshotFoundError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface CreatePriceListDto {
  name: string;
}

export interface UpdatePriceListDto {
  name?: string;
  active?: boolean;
}

export interface SetProductPriceDto {
  priceListId: string;
  productId: string;
  priceArs: Decimal | number | string;
}

export interface BulkPriceIncreaseDto {
  priceListId: string;
  percentage: Decimal | number | string;
  productIds?: string[];
}

export interface IPriceListDomainService {
  listPriceLists(includeInactive?: boolean): Promise<PriceListRecord[]>;
  getPriceListById(id: string): Promise<PriceListRecord | null>;
  createPriceList(dto: CreatePriceListDto): Promise<PriceListRecord>;
  updatePriceList(id: string, dto: UpdatePriceListDto): Promise<PriceListRecord>;
  getCurrentPrice(priceListId: string, productId: string): Promise<ProductPriceVersionRecord | null>;
  getPriceAtSnapshot(priceListId: string, productId: string, snapshotAt: Date | string): Promise<Decimal>;
  listCurrentPrices(priceListId: string): Promise<ProductPriceVersionRecord[]>;
  getPriceHistory(priceListId: string, productId: string): Promise<ProductPriceVersionRecord[]>;
  setProductPrice(dto: SetProductPriceDto): Promise<ProductPriceVersionRecord>;
  applyBulkPriceIncrease(dto: BulkPriceIncreaseDto): Promise<BulkPriceIncreaseResult>;
}

export class PriceListDomainService implements IPriceListDomainService {
  constructor(
    private readonly priceListRepo: IPriceListRepository = new PriceListRepository()
  ) {}

  async listPriceLists(includeInactive = true): Promise<PriceListRecord[]> {
    return this.priceListRepo.listPriceLists(includeInactive);
  }

  async getPriceListById(id: string): Promise<PriceListRecord | null> {
    if (!id || !id.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }
    return this.priceListRepo.getPriceListById(id.trim());
  }

  async createPriceList(dto: CreatePriceListDto): Promise<PriceListRecord> {
    if (!dto.name || !dto.name.trim()) {
      throw new DomainError('El nombre de la lista de precios es obligatorio.');
    }
    return this.priceListRepo.createPriceList(dto.name.trim());
  }

  async updatePriceList(id: string, dto: UpdatePriceListDto): Promise<PriceListRecord> {
    if (!id || !id.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new DomainError('El nombre de la lista de precios no puede ser vacío.');
    }

    if (dto.name === undefined && dto.active === undefined) {
      throw new DomainError('Debe proporcionar al menos un campo para actualizar.');
    }

    return this.priceListRepo.updatePriceList(id.trim(), {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      active: dto.active,
    });
  }

  async getCurrentPrice(priceListId: string, productId: string): Promise<ProductPriceVersionRecord | null> {
    if (!priceListId || !priceListId.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }
    if (!productId || !productId.trim()) {
      throw new DomainError('El identificador de producto es obligatorio.');
    }
    return this.priceListRepo.getCurrentPrice(priceListId.trim(), productId.trim());
  }

  async getPriceAtSnapshot(priceListId: string, productId: string, snapshotAt: Date | string): Promise<Decimal> {
    if (!priceListId || !priceListId.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }
    if (!productId || !productId.trim()) {
      throw new DomainError('El identificador de producto es obligatorio.');
    }
    if (!snapshotAt) {
      throw new DomainError('La fecha de snapshot es obligatoria.');
    }

    const snapshotDate = typeof snapshotAt === 'string' ? new Date(snapshotAt) : snapshotAt;
    if (isNaN(snapshotDate.getTime())) {
      throw new DomainError(`Fecha de snapshot inválida: ${String(snapshotAt)}`);
    }

    const price = await this.priceListRepo.getPriceAtSnapshot(
      priceListId.trim(),
      productId.trim(),
      snapshotDate.toISOString()
    );

    if (price === null) {
      throw new NoPriceSnapshotFoundError(productId.trim(), priceListId.trim(), snapshotDate.toISOString());
    }

    return price;
  }

  async listCurrentPrices(priceListId: string): Promise<ProductPriceVersionRecord[]> {
    if (!priceListId || !priceListId.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }
    return this.priceListRepo.listCurrentPrices(priceListId.trim());
  }

  async getPriceHistory(priceListId: string, productId: string): Promise<ProductPriceVersionRecord[]> {
    if (!priceListId || !priceListId.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }
    if (!productId || !productId.trim()) {
      throw new DomainError('El identificador de producto es obligatorio.');
    }
    return this.priceListRepo.getPriceHistory(priceListId.trim(), productId.trim());
  }

  async setProductPrice(dto: SetProductPriceDto): Promise<ProductPriceVersionRecord> {
    if (!dto.priceListId || !dto.priceListId.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }
    if (!dto.productId || !dto.productId.trim()) {
      throw new DomainError('El identificador de producto es obligatorio.');
    }

    const price = new Decimal(String(dto.priceArs));
    if (price.lte(0)) {
      throw new DomainError('El precio de venta debe ser estrictamente mayor a 0.');
    }
    if (!price.isInteger()) {
      throw new DomainError(`El precio de venta debe ser un número entero en pesos (${price.toString()}).`);
    }

    return this.priceListRepo.setProductPrice(dto.priceListId.trim(), dto.productId.trim(), price);
  }

  async applyBulkPriceIncrease(dto: BulkPriceIncreaseDto): Promise<BulkPriceIncreaseResult> {
    if (!dto.priceListId || !dto.priceListId.trim()) {
      throw new DomainError('El identificador de lista de precios es obligatorio.');
    }

    const pct = new Decimal(String(dto.percentage));
    if (pct.lte(0)) {
      throw new DomainError('El porcentaje de aumento debe ser estrictamente mayor a 0.');
    }

    let cleanedProductIds: string[] | undefined = undefined;
    if (dto.productIds && dto.productIds.length > 0) {
      const seen = new Set<string>();
      cleanedProductIds = [];
      for (const id of dto.productIds) {
        if (!id || !id.trim()) {
          throw new DomainError('Identificador de producto inválido en la lista de selección.');
        }
        const trimmed = id.trim();
        if (seen.has(trimmed)) {
          throw new DomainError(`Identificador de producto duplicado en la selección: ${trimmed}`);
        }
        seen.add(trimmed);
        cleanedProductIds.push(trimmed);
      }
    }

    return this.priceListRepo.applyBulkPriceIncrease(dto.priceListId.trim(), pct, cleanedProductIds);
  }
}
