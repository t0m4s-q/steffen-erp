import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface SupplierRecord {
  id: string;
  code: string;
  createdDate: string;
  name: string;
  salesperson: string | null;
  phone: string | null;
  currencyCode: 'ARS' | 'USD';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierItemRecord {
  id: string;
  supplierId: string;
  stockItemId: string;
  stockItemCode: string;
  stockItemName: string;
  stockItemType: 'MPR' | 'COM';
  unitType: 'KG' | 'UNIT';
  quotedUnitPriceNet: Decimal;
  priceUpdatedAt: string;
  active: boolean;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  salesperson?: string | null;
  phone?: string | null;
  currencyCode: 'ARS' | 'USD';
  createdDate?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  salesperson?: string | null;
  phone?: string | null;
  active?: boolean;
}

export class SupplierRepository extends BaseSupabaseRepository {
  async create(input: CreateSupplierInput): Promise<SupplierRecord> {
    const { data, error } = await this.client
      .from('suppliers')
      .insert({
        code: input.code,
        name: input.name,
        salesperson: input.salesperson || null,
        phone: input.phone || null,
        currency_code: input.currencyCode,
        created_date: input.createdDate || new Date().toISOString().split('T')[0],
        active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new DomainError(`Error creando proveedor: ${error?.message || 'Sin datos devueltos'}`);
    }

    // Crear cuenta contable SUPPLIER_PAYABLE
    const accountCode = `CTA_${input.code}`;
    const { error: accErr } = await this.client.from('financial_accounts').insert({
      code: accountCode,
      name: `Deuda Proveedor - ${input.name}`,
      account_type: 'SUPPLIER_PAYABLE',
      active: true,
      initial_balance_ars: 0,
    });

    if (accErr) {
      // Ignorar si ya existe (por idempotencia) o loguear
    }

    return this.mapToRecord(data);
  }

  async update(id: string, input: UpdateSupplierInput): Promise<SupplierRecord> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.salesperson !== undefined) updatePayload.salesperson = input.salesperson;
    if (input.phone !== undefined) updatePayload.phone = input.phone;
    if (input.active !== undefined) updatePayload.active = input.active;

    const { data, error } = await this.client
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new DomainError(`Error actualizando proveedor ${id}: ${error?.message || 'No encontrado'}`);
    }

    return this.mapToRecord(data);
  }

  async findById(id: string): Promise<SupplierRecord | null> {
    const { data, error } = await this.client
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  async findByCode(code: string): Promise<SupplierRecord | null> {
    const { data, error } = await this.client
      .from('suppliers')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  async listAll(includeInactive = true): Promise<SupplierRecord[]> {
    let query = this.client.from('suppliers').select('*').order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando proveedores: ${error.message}`);
    }

    return (data || []).map(d => this.mapToRecord(d));
  }

  async getSupplierItems(supplierId: string): Promise<SupplierItemRecord[]> {
    const { data, error } = await this.client
      .from('supplier_items')
      .select(`
        id,
        supplier_id,
        stock_item_id,
        quoted_unit_price_net,
        price_updated_at,
        active,
        stock_items (
          code,
          name,
          item_type,
          unit_type
        )
      `)
      .eq('supplier_id', supplierId)
      .order('price_updated_at', { ascending: false });

    if (error) {
      throw new DomainError(`Error obteniendo items del proveedor ${supplierId}: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      supplierId: row.supplier_id,
      stockItemId: row.stock_item_id,
      stockItemCode: row.stock_items?.code || '',
      stockItemName: row.stock_items?.name || '',
      stockItemType: row.stock_items?.item_type || 'MPR',
      unitType: row.stock_items?.unit_type || 'KG',
      quotedUnitPriceNet: new Decimal(row.quoted_unit_price_net),
      priceUpdatedAt: row.price_updated_at,
      active: row.active ?? true,
    }));
  }

  async upsertSupplierItem(
    supplierId: string,
    stockItemId: string,
    quotedUnitPriceNet: Decimal
  ): Promise<SupplierItemRecord> {
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from('supplier_items')
      .upsert(
        {
          supplier_id: supplierId,
          stock_item_id: stockItemId,
          quoted_unit_price_net: Number(quotedUnitPriceNet.toNumericString()),
          price_updated_at: now,
          active: true,
          updated_at: now,
        },
        { onConflict: 'supplier_id,stock_item_id' }
      )
      .select(`
        id,
        supplier_id,
        stock_item_id,
        quoted_unit_price_net,
        price_updated_at,
        active,
        stock_items (
          code,
          name,
          item_type,
          unit_type
        )
      `)
      .single();

    if (error || !data) {
      throw new DomainError(`Error actualizando item del proveedor: ${error?.message || 'Error desconocido'}`);
    }

    const row = data as any;
    return {
      id: row.id,
      supplierId: row.supplier_id,
      stockItemId: row.stock_item_id,
      stockItemCode: row.stock_items?.code || '',
      stockItemName: row.stock_items?.name || '',
      stockItemType: row.stock_items?.item_type || 'MPR',
      unitType: row.stock_items?.unit_type || 'KG',
      quotedUnitPriceNet: new Decimal(row.quoted_unit_price_net),
      priceUpdatedAt: row.price_updated_at,
      active: row.active ?? true,
    };
  }

  private mapToRecord(row: any): SupplierRecord {
    return {
      id: row.id,
      code: row.code,
      createdDate: row.created_date,
      name: row.name,
      salesperson: row.salesperson,
      phone: row.phone,
      currencyCode: row.currency_code,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
