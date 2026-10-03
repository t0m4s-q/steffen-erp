import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

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
  code: string;
  name: string;
  baseProductId: string;
  presentation: string;
  weightKg: Decimal;
  stockMinimum: Decimal;
  extraVariablePct?: Decimal;
  createdDate?: string;
  components: Array<{
    componentId: string;
    quantityPerUnit: Decimal;
    sortOrder?: number;
  }>;
}

export interface UpdateProductInput {
  name?: string;
  baseProductId?: string;
  presentation?: string;
  weightKg?: Decimal;
  stockMinimum?: Decimal;
  active?: boolean;
  components?: Array<{
    componentId: string;
    quantityPerUnit: Decimal;
    sortOrder?: number;
  }>;
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
        stock_items:stock_item_id (
          code,
          name,
          stock_minimum,
          active,
          created_date
        ),
        base_products:base_product_id (
          code,
          name
        )
      `)
      .eq('stock_item_id', productId)
      .single();

    if (error || !data) return null;

    const row = data as any;
    return {
      productId: row.stock_item_id,
      code: row.stock_items?.code || '',
      name: row.stock_items?.name || '',
      baseProductId: row.base_product_id,
      baseProductCode: row.base_products?.code || '',
      baseProductName: row.base_products?.name || '',
      presentation: row.presentation,
      weightKg: new Decimal(row.weight_kg),
      stockMinimum: new Decimal(row.stock_items?.stock_minimum || 1),
      extraVariablePct: new Decimal(row.extra_variable_pct || 2.0),
      active: row.stock_items?.active ?? true,
      createdDate: row.stock_items?.created_date || '',
      createdAt: row.created_at,
    };
  }

  async getProductComponents(productId: string): Promise<ProductComponentDetailRecord[]> {
    const { data, error } = await this.client
      .from('product_components')
      .select(`
        id,
        product_id,
        component_id,
        quantity_per_unit,
        sort_order,
        stock_items:component_id (
          code,
          name
        )
      `)
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new DomainError(`Error obteniendo componentes del producto ${productId}: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      componentId: row.component_id,
      componentCode: row.stock_items?.code || '',
      componentName: row.stock_items?.name || '',
      quantityPerUnit: new Decimal(row.quantity_per_unit),
      sortOrder: row.sort_order,
    }));
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

    return new Decimal(data[0].price_ars);
  }

  async createProduct(input: CreateProductInput): Promise<ProductDetailsRecord> {
    const today = input.createdDate || new Date().toISOString().split('T')[0];

    // 1. Crear stock_items
    const { data: itemData, error: itemErr } = await this.client
      .from('stock_items')
      .insert({
        code: input.code,
        item_type: 'PRO',
        name: input.name,
        unit_type: 'UNIT',
        stock_minimum: Number(input.stockMinimum.toNumericString()),
        created_date: today,
        active: true,
      })
      .select('*')
      .single();

    if (itemErr || !itemData) {
      throw new DomainError(`Error creando stock_item PRO: ${itemErr?.message || 'Sin datos'}`);
    }

    const productId = itemData.id;

    // 2. Crear products
    const extraVar = input.extraVariablePct ?? new Decimal(2.0);
    const { error: prodErr } = await this.client
      .from('products')
      .insert({
        stock_item_id: productId,
        base_product_id: input.baseProductId,
        presentation: input.presentation,
        weight_kg: Number(input.weightKg.toNumericString()),
        extra_variable_pct: Number(extraVar.toNumericString()),
      });

    if (prodErr) {
      throw new DomainError(`Error creando registro en products: ${prodErr.message}`);
    }

    // 3. Crear product_components (BOM)
    if (input.components && input.components.length > 0) {
      const compPayload = input.components.map((c, idx) => ({
        product_id: productId,
        component_id: c.componentId,
        quantity_per_unit: Number(c.quantityPerUnit.toNumericString()),
        sort_order: c.sortOrder ?? idx + 1,
      }));

      const { error: compErr } = await this.client
        .from('product_components')
        .insert(compPayload);

      if (compErr) {
        throw new DomainError(`Error asociando componentes al producto: ${compErr.message}`);
      }
    }

    // 4. Inicializar stock_balances en 0 si no existe
    await this.client.from('stock_balances').upsert(
      {
        stock_item_id: productId,
        balance_raw: 0,
      },
      { onConflict: 'stock_item_id' }
    );

    const full = await this.getProductDetails(productId);
    return full!;
  }

  async updateProduct(productId: string, input: UpdateProductInput): Promise<ProductDetailsRecord> {
    // 1. Actualizar stock_items si corresponde
    const itemUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) itemUpdates.name = input.name;
    if (input.stockMinimum !== undefined) {
      itemUpdates.stock_minimum = Number(input.stockMinimum.toNumericString());
    }
    if (input.active !== undefined) itemUpdates.active = input.active;

    await this.client
      .from('stock_items')
      .update(itemUpdates)
      .eq('id', productId);

    // 2. Actualizar products si corresponde
    const prodUpdates: Record<string, any> = {};
    if (input.baseProductId !== undefined) prodUpdates.base_product_id = input.baseProductId;
    if (input.presentation !== undefined) prodUpdates.presentation = input.presentation;
    if (input.weightKg !== undefined) prodUpdates.weight_kg = Number(input.weightKg.toNumericString());

    if (Object.keys(prodUpdates).length > 0) {
      await this.client
        .from('products')
        .update(prodUpdates)
        .eq('stock_item_id', productId);
    }

    // 3. Actualizar BOM de componentes si se provee
    if (input.components !== undefined) {
      // Eliminar componentes actuales y reinsertar
      await this.client
        .from('product_components')
        .delete()
        .eq('product_id', productId);

      if (input.components.length > 0) {
        const compPayload = input.components.map((c, idx) => ({
          product_id: productId,
          component_id: c.componentId,
          quantity_per_unit: Number(c.quantityPerUnit.toNumericString()),
          sort_order: c.sortOrder ?? idx + 1,
        }));

        await this.client.from('product_components').insert(compPayload);
      }
    }

    const full = await this.getProductDetails(productId);
    return full!;
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
        stock_items:stock_item_id (
          code,
          name,
          stock_minimum,
          active,
          created_date
        ),
        base_products:base_product_id (
          code,
          name
        )
      `);

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando productos: ${error.message}`);
    }

    const records: ProductDetailsRecord[] = (data || []).map((row: any) => ({
      productId: row.stock_item_id,
      code: row.stock_items?.code || '',
      name: row.stock_items?.name || '',
      baseProductId: row.base_product_id,
      baseProductCode: row.base_products?.code || '',
      baseProductName: row.base_products?.name || '',
      presentation: row.presentation,
      weightKg: new Decimal(row.weight_kg),
      stockMinimum: new Decimal(row.stock_items?.stock_minimum || 1),
      extraVariablePct: new Decimal(row.extra_variable_pct || 2.0),
      active: row.stock_items?.active ?? true,
      createdDate: row.stock_items?.created_date || '',
      createdAt: row.created_at,
    }));

    if (!includeInactive) {
      return records.filter(r => r.active);
    }

    return records.sort((a, b) => a.code.localeCompare(b.code));
  }

  async setProductActive(productId: string, active: boolean): Promise<ProductDetailsRecord> {
    await this.client
      .from('stock_items')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', productId);

    const full = await this.getProductDetails(productId);
    return full!;
  }
}
