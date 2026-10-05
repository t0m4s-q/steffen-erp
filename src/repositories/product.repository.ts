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

export interface ProductDetailsRecord {
  productId: string;
  code: string;
  name: string;
  baseProductId: string;
  baseProductCode: string;
  baseProductName: string;
  presentation: string;
  weightKg: Decimal;
  stockMinimum: Decimal;
  extraVariablePct: Decimal;
  active: boolean;
  createdDate: string;
  createdAt: string;
}

export interface ProductComponentDetailRecord {
  id: string;
  productId: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  quantityPerUnit: Decimal;
  sortOrder: number;
}

export interface CreateProductInput {
  name: string;
  baseProductId: string;
  presentation: string;
  weightKg: Decimal;
  stockMinimum: Decimal;
  initialStock?: Decimal;
  createdDate?: string;
  components: Array<{
    componentId: string;
    quantityPerUnit: Decimal;
    sortOrder?: number;
  }>;
}

export interface UpdateProductInput {
  name?: string;
  presentation?: string;
  stockMinimum?: Decimal;
  active?: boolean;
}

export interface IProductRepository {
  getProductDetails(productId: string): Promise<ProductDetailsRecord | null>;
  getProductComponents(productId: string): Promise<ProductComponentDetailRecord[]>;
  getPriceAtSnapshot(productId: string, priceListId: string, snapshotIso: string): Promise<Decimal | null>;
  createProduct(input: CreateProductInput): Promise<ProductDetailsRecord>;
  updateProduct(productId: string, input: UpdateProductInput): Promise<ProductDetailsRecord>;
  listProducts(includeInactive?: boolean): Promise<ProductDetailsRecord[]>;
  setProductActive(productId: string, active: boolean): Promise<ProductDetailsRecord>;
}

export class ProductRepository extends BaseSupabaseRepository implements IProductRepository {
  async getProductDetails(productId: string): Promise<ProductDetailsRecord | null> {
    const { data, error } = await this.client
      .from('products')
      .select(`
        stock_item_id,
        base_product_id,
        presentation,
        weight_kg,
        extra_variable_pct,
        created_at,
        stock_items (
          code,
          name,
          stock_minimum,
          active,
          created_date
        ),
        base_products (
          code,
          name
        )
      `)
      .eq('stock_item_id', productId)
      .single();

    if (error || !data) return null;

    const row = parseJsonObject(data);
    const stockItem = parseJsonObject(row.stock_items);
    const baseProduct = parseJsonObject(row.base_products);

    return {
      productId: String(row.stock_item_id),
      code: String(stockItem.code || ''),
      name: String(stockItem.name || ''),
      baseProductId: String(row.base_product_id),
      baseProductCode: String(baseProduct.code || ''),
      baseProductName: String(baseProduct.name || ''),
      presentation: String(row.presentation || ''),
      weightKg: new Decimal(String(row.weight_kg)),
      stockMinimum: new Decimal(String(stockItem.stock_minimum || 1)),
      extraVariablePct: new Decimal(String(row.extra_variable_pct || 2.0)),
      active: stockItem.active !== undefined ? Boolean(stockItem.active) : true,
      createdDate: String(stockItem.created_date || ''),
      createdAt: String(row.created_at || ''),
    };
  }

  async getProductComponents(productId: string): Promise<ProductComponentDetailRecord[]> {
    const { data, error } = await this.client
      .from('product_components')
      .select(`
        product_id,
        component_id,
        quantity_per_unit,
        sort_order,
        components (
          stock_items (
            code,
            name
          )
        )
      `)
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new DomainError(`Error obteniendo componentes del producto ${productId}: ${error.message}`);
    }

    const rows = parseJsonArray(data);
    return rows.map((r) => {
      const row = parseJsonObject(r);
      const compRecord = parseJsonObject(
        Array.isArray(row.components) ? row.components[0] : row.components
      );
      const stockItem = parseJsonObject(
        Array.isArray(compRecord.stock_items) ? compRecord.stock_items[0] : compRecord.stock_items
      );

      return {
        id: `${String(row.product_id)}_${String(row.component_id)}`,
        productId: String(row.product_id),
        componentId: String(row.component_id),
        componentCode: String(stockItem.code || ''),
        componentName: String(stockItem.name || ''),
        quantityPerUnit: new Decimal(String(row.quantity_per_unit)),
        sortOrder: Number(row.sort_order),
      };
    });
  }

  async getPriceAtSnapshot(productId: string, priceListId: string, snapshotIso: string): Promise<Decimal | null> {
    const { data, error } = await this.client
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('product_id', productId)
      .eq('price_list_id', priceListId)
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

  async createProduct(input: CreateProductInput): Promise<ProductDetailsRecord> {
    // quantity_per_unit enviado como string decimal exacto
    const componentsPayload = input.components.map((c, idx) => ({
      component_id: c.componentId,
      quantity_per_unit: toNumericString(c.quantityPerUnit),
      sort_order: c.sortOrder ?? idx + 1,
    }));

    const { data, error } = await this.client.rpc('create_final_product', {
      p_name: input.name,
      p_base_product_id: input.baseProductId,
      p_presentation: input.presentation,
      p_weight_kg: Number(toNumericString(input.weightKg)),
      p_stock_minimum: Number(toNumericString(input.stockMinimum)),
      p_components: componentsPayload,
      p_initial_stock: input.initialStock ? Number(toNumericString(input.initialStock)) : 0,
      p_created_date: input.createdDate,
    });

    if (error || !data) {
      throw new DomainError(`Error creando Producto Final: ${error?.message || 'Sin datos devueltos'}`);
    }

    const resObj = parseJsonObject(data);
    return {
      productId: String(resObj.id),
      code: String(resObj.code),
      name: String(resObj.name),
      baseProductId: String(resObj.base_product_id),
      baseProductCode: String(resObj.base_product_code),
      baseProductName: String(resObj.base_product_name),
      presentation: String(resObj.presentation),
      weightKg: new Decimal(String(resObj.weight_kg)),
      stockMinimum: new Decimal(String(resObj.stock_minimum)),
      extraVariablePct: new Decimal(String(resObj.extra_variable_pct)),
      active: Boolean(resObj.active),
      createdDate: String(resObj.created_date),
      createdAt: String(resObj.created_at),
    };
  }

  async updateProduct(productId: string, input: UpdateProductInput): Promise<ProductDetailsRecord> {
    const { data, error } = await this.client.rpc('update_final_product_metadata', {
      p_product_id: productId,
      p_name: input.name !== undefined ? input.name : undefined,
      p_presentation: input.presentation !== undefined ? input.presentation : undefined,
      p_stock_minimum: input.stockMinimum !== undefined ? Number(toNumericString(input.stockMinimum)) : undefined,
      p_active: input.active !== undefined ? input.active : undefined,
    });

    if (error || !data) {
      throw new DomainError(`Error actualizando Producto Final ${productId}: ${error?.message || 'Sin datos devueltos'}`);
    }

    const resObj = parseJsonObject(data);
    return {
      productId: String(resObj.id),
      code: String(resObj.code),
      name: String(resObj.name),
      baseProductId: String(resObj.base_product_id),
      baseProductCode: String(resObj.base_product_code),
      baseProductName: String(resObj.base_product_name),
      presentation: String(resObj.presentation),
      weightKg: new Decimal(String(resObj.weight_kg)),
      stockMinimum: new Decimal(String(resObj.stock_minimum)),
      extraVariablePct: new Decimal(String(resObj.extra_variable_pct)),
      active: Boolean(resObj.active),
      createdDate: String(resObj.created_date),
      createdAt: String(resObj.created_at),
    };
  }

  async listProducts(includeInactive = true): Promise<ProductDetailsRecord[]> {
    let query = this.client
      .from('products')
      .select(`
        stock_item_id,
        base_product_id,
        presentation,
        weight_kg,
        extra_variable_pct,
        created_at,
        stock_items (
          code,
          name,
          stock_minimum,
          active,
          created_date
        ),
        base_products (
          code,
          name
        )
      `);

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando productos: ${error.message}`);
    }

    const rows = parseJsonArray(data);
    const records: ProductDetailsRecord[] = rows.map((r) => {
      const row = parseJsonObject(r);
      const stockItem = parseJsonObject(row.stock_items);
      const baseProduct = parseJsonObject(row.base_products);

      return {
        productId: String(row.stock_item_id),
        code: String(stockItem.code || ''),
        name: String(stockItem.name || ''),
        baseProductId: String(row.base_product_id),
        baseProductCode: String(baseProduct.code || ''),
        baseProductName: String(baseProduct.name || ''),
        presentation: String(row.presentation || ''),
        weightKg: new Decimal(String(row.weight_kg)),
        stockMinimum: new Decimal(String(stockItem.stock_minimum || 1)),
        extraVariablePct: new Decimal(String(row.extra_variable_pct || 2.0)),
        active: stockItem.active !== undefined ? Boolean(stockItem.active) : true,
        createdDate: String(stockItem.created_date || ''),
        createdAt: String(row.created_at || ''),
      };
    });

    if (!includeInactive) {
      return records.filter((r) => r.active);
    }

    return records.sort((a, b) => a.code.localeCompare(b.code));
  }

  async setProductActive(productId: string, active: boolean): Promise<ProductDetailsRecord> {
    return this.updateProduct(productId, { active });
  }
}
