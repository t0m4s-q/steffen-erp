import { BaseSupabaseRepository } from './base.repository';
import type { CurrencyCode } from '@/database/domain-types';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface LatestSupplierItemResult {
  supplierItemId: string;
  supplierId: string;
  stockItemId: string;
  quotedUnitPriceNet: Decimal;
  priceUpdatedAt: string;
  supplierName: string;
  supplierCurrency: CurrencyCode;
}

export interface ISupplierItemRepository {
  getLatestSupplierItem(stockItemId: string): Promise<LatestSupplierItemResult | null>;
  getCurrentUsdExchangeRate(): Promise<Decimal | null>;
}

export class SupplierItemRepository extends BaseSupabaseRepository implements ISupplierItemRepository {
  async getLatestSupplierItem(stockItemId: string): Promise<LatestSupplierItemResult | null> {
    const { data, error } = await this.client
      .from('supplier_items')
      .select(`
        id,
        supplier_id,
        stock_item_id,
        quoted_unit_price_net,
        price_updated_at,
        created_at,
        active,
        suppliers!inner (
          id,
          name,
          currency_code,
          active
        )
      `)
      .eq('stock_item_id', stockItemId)
      .eq('active', true)
      .eq('suppliers.active', true)
      .order('price_updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      throw new DomainError(`Error obteniendo proveedor para ítem ${stockItemId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0] as any;
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;

    return {
      supplierItemId: row.id,
      supplierId: row.supplier_id,
      stockItemId: row.stock_item_id,
      quotedUnitPriceNet: new Decimal(row.quoted_unit_price_net),
      priceUpdatedAt: row.price_updated_at,
      supplierName: supplier.name,
      supplierCurrency: supplier.currency_code as CurrencyCode,
    };
  }

  async getCurrentUsdExchangeRate(): Promise<Decimal | null> {
    const { data, error } = await this.client
      .from('exchange_rates')
      .select('rate_to_ars')
      .eq('currency_code', 'USD')
      .eq('is_current', true)
      .order('effective_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new DomainError(`Error consultando cotización USD vigente: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return new Decimal((data as any)[0].rate_to_ars);
  }
}
