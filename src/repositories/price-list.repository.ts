import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';

function parseJsonObject(val: unknown): Record<string, unknown> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function parseJsonArray(val: unknown): unknown[] {
  if (Array.isArray(val)) {
    return val;
  }
  return [];
}

export interface PriceListRecord {
  id: string;
  name: string;
  systemRole: 'SALON_DEFAULT' | 'PUBLIC_DEFAULT' | 'ECOMMERCE_DEFAULT' | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPriceVersionRecord {
  id: string;
  priceListId: string;
  productId: string;
  productCode?: string;
  productName?: string;
  priceArs: Decimal;
  previousPriceArs?: Decimal | null;
  validFrom: string;
  validTo: string | null;
  createdAt?: string;
}

export interface BulkPriceIncreaseItemResult {
  productId: string;
  productCode: string;
  productName: string;
  previousPriceArs: Decimal;
  newPriceArs: Decimal;
}

export interface BulkPriceIncreaseResult {
  priceListId: string;
  percentage: Decimal;
  updatedCount: number;
  validFrom: string;
  items: BulkPriceIncreaseItemResult[];
}

export interface IPriceListRepository {
  listPriceLists(includeInactive?: boolean): Promise<PriceListRecord[]>;
  getPriceListById(id: string): Promise<PriceListRecord | null>;
  getPriceListBySystemRole(role: 'SALON_DEFAULT' | 'PUBLIC_DEFAULT' | 'ECOMMERCE_DEFAULT'): Promise<PriceListRecord | null>;
  createPriceList(name: string): Promise<PriceListRecord>;
  updatePriceList(id: string, input: { name?: string; active?: boolean }): Promise<PriceListRecord>;
  getCurrentPrice(priceListId: string, productId: string): Promise<ProductPriceVersionRecord | null>;
  getPriceAtSnapshot(priceListId: string, productId: string, snapshotIso: string): Promise<Decimal | null>;
  listCurrentPrices(priceListId: string): Promise<ProductPriceVersionRecord[]>;
  getPriceHistory(priceListId: string, productId: string): Promise<ProductPriceVersionRecord[]>;
  setProductPrice(priceListId: string, productId: string, priceArs: Decimal | number | string): Promise<ProductPriceVersionRecord>;
  applyBulkPriceIncrease(priceListId: string, percentage: Decimal | number | string, productIds?: string[]): Promise<BulkPriceIncreaseResult>;
}

export class PriceListRepository extends BaseSupabaseRepository implements IPriceListRepository {
  async listPriceLists(includeInactive = true): Promise<PriceListRecord[]> {
    let query = this.client
      .from('price_lists')
      .select('id, name, system_role, active, created_at, updated_at')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando listas de precios: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      systemRole: row.system_role as PriceListRecord['systemRole'],
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getPriceListById(id: string): Promise<PriceListRecord | null> {
    const { data, error } = await this.client
      .from('price_lists')
      .select('id, name, system_role, active, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new DomainError(`Error obteniendo lista de precios ${id}: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      systemRole: data.system_role as PriceListRecord['systemRole'],
      active: data.active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getPriceListBySystemRole(
    role: 'SALON_DEFAULT' | 'PUBLIC_DEFAULT' | 'ECOMMERCE_DEFAULT'
  ): Promise<PriceListRecord | null> {
    const { data, error } = await this.client
      .from('price_lists')
      .select('id, name, system_role, active, created_at, updated_at')
      .eq('system_role', role)
      .maybeSingle();

    if (error) {
      throw new DomainError(`Error obteniendo lista de precios con rol de sistema ${role}: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      systemRole: data.system_role as PriceListRecord['systemRole'],
      active: data.active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createPriceList(name: string): Promise<PriceListRecord> {
    const { data, error } = await this.client.rpc('create_price_list', {
      p_name: name,
    });

    if (error || !data) {
      throw new DomainError(`Error creando lista de precios: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    return {
      id: String(res.id),
      name: String(res.name),
      systemRole: (res.system_role as PriceListRecord['systemRole']) || null,
      active: Boolean(res.active),
      createdAt: String(res.created_at),
      updatedAt: String(res.updated_at),
    };
  }

  async updatePriceList(id: string, input: { name?: string; active?: boolean }): Promise<PriceListRecord> {
    const { data, error } = await this.client.rpc('update_price_list', {
      p_price_list_id: id,
      p_name: input.name !== undefined ? input.name : undefined,
      p_active: input.active !== undefined ? input.active : undefined,
    });

    if (error || !data) {
      throw new DomainError(`Error actualizando lista de precios ${id}: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    return {
      id: String(res.id),
      name: String(res.name),
      systemRole: (res.system_role as PriceListRecord['systemRole']) || null,
      active: Boolean(res.active),
      createdAt: String(res.created_at),
      updatedAt: String(res.updated_at),
    };
  }

  async getCurrentPrice(priceListId: string, productId: string): Promise<ProductPriceVersionRecord | null> {
    const { data, error } = await this.client
      .from('product_price_versions')
      .select(`
        id,
        price_list_id,
        product_id,
        price_ars,
        valid_from,
        valid_to,
        created_at,
        products (
          stock_items (
            code,
            name
          )
        )
      `)
      .eq('price_list_id', priceListId)
      .eq('product_id', productId)
      .is('valid_to', null)
      .maybeSingle();

    if (error) {
      throw new DomainError(`Error consultando precio vigente: ${error.message}`);
    }

    if (!data) return null;

    const row = parseJsonObject(data);
    const prodObj = parseJsonObject(Array.isArray(row.products) ? row.products[0] : row.products);
    const stockItem = parseJsonObject(Array.isArray(prodObj.stock_items) ? prodObj.stock_items[0] : prodObj.stock_items);

    return {
      id: String(row.id),
      priceListId: String(row.price_list_id),
      productId: String(row.product_id),
      productCode: stockItem.code ? String(stockItem.code) : undefined,
      productName: stockItem.name ? String(stockItem.name) : undefined,
      priceArs: new Decimal(String(row.price_ars)),
      validFrom: String(row.valid_from),
      validTo: row.valid_to ? String(row.valid_to) : null,
      createdAt: String(row.created_at),
    };
  }

  async getPriceAtSnapshot(priceListId: string, productId: string, snapshotIso: string): Promise<Decimal | null> {
    const { data, error } = await this.client
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('price_list_id', priceListId)
      .eq('product_id', productId)
      .lte('valid_from', snapshotIso)
      .or(`valid_to.is.null,valid_to.gt.${snapshotIso}`)
      .order('valid_from', { ascending: false })
      .limit(1);

    if (error) {
      throw new DomainError(`Error obteniendo precio histórico para producto ${productId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return new Decimal(String(data[0].price_ars));
  }

  async listCurrentPrices(priceListId: string): Promise<ProductPriceVersionRecord[]> {
    const { data, error } = await this.client
      .from('product_price_versions')
      .select(`
        id,
        price_list_id,
        product_id,
        price_ars,
        valid_from,
        valid_to,
        created_at,
        products (
          stock_items (
            code,
            name
          )
        )
      `)
      .eq('price_list_id', priceListId)
      .is('valid_to', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new DomainError(`Error listando precios vigentes de lista ${priceListId}: ${error.message}`);
    }

    const rows = parseJsonArray(data);
    return rows.map((r) => {
      const row = parseJsonObject(r);
      const prodObj = parseJsonObject(Array.isArray(row.products) ? row.products[0] : row.products);
      const stockItem = parseJsonObject(Array.isArray(prodObj.stock_items) ? prodObj.stock_items[0] : prodObj.stock_items);

      return {
        id: String(row.id),
        priceListId: String(row.price_list_id),
        productId: String(row.product_id),
        productCode: stockItem.code ? String(stockItem.code) : undefined,
        productName: stockItem.name ? String(stockItem.name) : undefined,
        priceArs: new Decimal(String(row.price_ars)),
        validFrom: String(row.valid_from),
        validTo: null,
        createdAt: String(row.created_at),
      };
    });
  }

  async getPriceHistory(priceListId: string, productId: string): Promise<ProductPriceVersionRecord[]> {
    const { data, error } = await this.client
      .from('product_price_versions')
      .select(`
        id,
        price_list_id,
        product_id,
        price_ars,
        valid_from,
        valid_to,
        created_at,
        products (
          stock_items (
            code,
            name
          )
        )
      `)
      .eq('price_list_id', priceListId)
      .eq('product_id', productId)
      .order('valid_from', { ascending: false });

    if (error) {
      throw new DomainError(`Error obteniendo historial de precios: ${error.message}`);
    }

    const rows = parseJsonArray(data);
    return rows.map((r) => {
      const row = parseJsonObject(r);
      const prodObj = parseJsonObject(Array.isArray(row.products) ? row.products[0] : row.products);
      const stockItem = parseJsonObject(Array.isArray(prodObj.stock_items) ? prodObj.stock_items[0] : prodObj.stock_items);

      return {
        id: String(row.id),
        priceListId: String(row.price_list_id),
        productId: String(row.product_id),
        productCode: stockItem.code ? String(stockItem.code) : undefined,
        productName: stockItem.name ? String(stockItem.name) : undefined,
        priceArs: new Decimal(String(row.price_ars)),
        validFrom: String(row.valid_from),
        validTo: row.valid_to ? String(row.valid_to) : null,
        createdAt: String(row.created_at),
      };
    });
  }

  async setProductPrice(
    priceListId: string,
    productId: string,
    priceArs: Decimal | number | string
  ): Promise<ProductPriceVersionRecord> {
    const priceStr = toNumericString(priceArs);
    const { data, error } = await this.client.rpc('set_product_price', {
      p_price_list_id: priceListId,
      p_product_id: productId,
      p_price_ars: Number(priceStr),
    });

    if (error || !data) {
      throw new DomainError(`Error fijando precio para producto ${productId}: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    return {
      id: String(res.id),
      priceListId: String(res.price_list_id),
      productId: String(res.product_id),
      productCode: res.product_code ? String(res.product_code) : undefined,
      productName: res.product_name ? String(res.product_name) : undefined,
      priceArs: new Decimal(String(res.price_ars)),
      previousPriceArs: res.previous_price_ars ? new Decimal(String(res.previous_price_ars)) : null,
      validFrom: String(res.valid_from),
      validTo: null,
      createdAt: String(res.created_at),
    };
  }

  async applyBulkPriceIncrease(
    priceListId: string,
    percentage: Decimal | number | string,
    productIds?: string[]
  ): Promise<BulkPriceIncreaseResult> {
    const pctStr = toNumericString(percentage);
    const { data, error } = await this.client.rpc('apply_bulk_price_increase', {
      p_price_list_id: priceListId,
      p_percentage: Number(pctStr),
      p_product_ids: productIds && productIds.length > 0 ? productIds : undefined,
    });

    if (error || !data) {
      throw new DomainError(`Error aplicando aumento masivo de precios: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    const rawItems = parseJsonArray(res.items);
    const items: BulkPriceIncreaseItemResult[] = rawItems.map((i) => {
      const itemObj = parseJsonObject(i);
      return {
        productId: String(itemObj.product_id),
        productCode: String(itemObj.product_code || ''),
        productName: String(itemObj.product_name || ''),
        previousPriceArs: new Decimal(String(itemObj.previous_price_ars)),
        newPriceArs: new Decimal(String(itemObj.new_price_ars)),
      };
    });

    return {
      priceListId: String(res.price_list_id),
      percentage: new Decimal(String(res.percentage)),
      updatedCount: Number(res.updated_count || 0),
      validFrom: String(res.valid_from),
      items,
    };
  }
}
