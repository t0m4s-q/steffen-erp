import { IProductRepository, ProductRepository } from '@/repositories/product.repository';
import { DomainError, NoPriceSnapshotFoundError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface IPricingService {
  getPriceAtSnapshot(productId: string, priceListId: string, snapshotAt: Date | string): Promise<Decimal>;
}

export class PricingService implements IPricingService {
  constructor(private readonly productRepo: IProductRepository = new ProductRepository()) {}

  /**
   * Obtiene el precio vigente de un producto en una lista de precios para un instante temporal exacto (snapshot).
   * Respeta la regla:
   * valid_from <= snapshotAt AND (valid_to IS NULL OR valid_to > snapshotAt)
   * Retorna un Decimal exacto.
   * Nunca utiliza simplemente el precio actual del producto.
   */
  async getPriceAtSnapshot(productId: string, priceListId: string, snapshotAt: Date | string): Promise<Decimal> {
    if (!productId) throw new DomainError('productId es obligatorio.');
    if (!priceListId) throw new DomainError('priceListId es obligatorio.');
    if (!snapshotAt) throw new DomainError('snapshotAt es obligatorio.');

    const snapshotDate = typeof snapshotAt === 'string' ? new Date(snapshotAt) : snapshotAt;
    if (isNaN(snapshotDate.getTime())) {
      throw new DomainError(`Fecha de snapshot inválida: ${String(snapshotAt)}`);
    }

    const snapshotIso = snapshotDate.toISOString();
    const price = await this.productRepo.getPriceAtSnapshot(productId, priceListId, snapshotIso);

    if (price === null || price === undefined) {
      throw new NoPriceSnapshotFoundError(productId, priceListId, snapshotIso);
    }

    return price;
  }
}
