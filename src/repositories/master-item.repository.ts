import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';
import type { Database } from '@/database/types';
import type { StockItemType, UnitType } from '@/database/domain-types';

export interface MasterItemRecord {
  id: string;
  code: string;
  itemType: 'MPR' | 'COM' | 'PRO';
  name: string;
  unitType: 'KG' | 'UNIT';
  stockMinimum: Decimal;
  active: boolean;
  createdDate: string;
  inci?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMasterItemInput {
  code: string;
  itemType: 'MPR' | 'COM';
  name: string;
  unitType: 'KG' | 'UNIT';
  stockMinimum: Decimal;
  inci?: string | null;
  createdDate?: string;
}

export interface CreateMasterItemAtomicInput {
  itemType: 'MPR' | 'COM';
  name: string;
  stockMinimum: Decimal | number | string;
  initialSupplierId: string;
  initialQuotedPriceNet: Decimal | number | string;
  initialStock?: Decimal | number | string;
  inci?: string | null;
  createdDate?: string;
}

export interface BatchItemCostRecord {
  stockItemId: string;
  supplierId: string;
  supplierName: string;
  supplierCurrency: 'ARS' | 'USD';
  quotedUnitPriceNet: Decimal;
  priceUpdatedAt: string;
  unitCostGrossArs: Decimal;
}

export interface UpdateMasterItemInput {
  name?: string;
  stockMinimum?: Decimal;
  inci?: string | null;
  active?: boolean;
}

interface MasterItemRowLike {
  id: string;
  code: string;
  item_type: StockItemType;
  name: string;
  unit_type: UnitType;
  stock_minimum: number | string;
  active: boolean;
  created_date: string;
  created_at?: string | null;
  updated_at?: string | null;
  raw_materials?: { inci?: string | null } | null;
}

export class MasterItemRepository extends BaseSupabaseRepository {
  async getBatchItemCosts(): Promise<Map<string, BatchItemCostRecord>> {
    const { data, error } = await this.client
      .from('v_current_item_cost')
      .select('stock_item_id, supplier_id, supplier_name, supplier_currency, quoted_unit_price_net, price_updated_at, unit_cost_gross_ars');

    if (error) {
      throw new DomainError(`Error consultando costos consolidados de insumos: ${error.message}`);
    }

    const map = new Map<string, BatchItemCostRecord>();
    for (const row of (data || [])) {
      if (row.stock_item_id && row.supplier_id) {
        map.set(row.stock_item_id, {
          stockItemId: row.stock_item_id,
          supplierId: row.supplier_id,
          supplierName: row.supplier_name || '',
          supplierCurrency: (row.supplier_currency as 'ARS' | 'USD') || 'ARS',
          quotedUnitPriceNet: new Decimal(String(row.quoted_unit_price_net || 0)),
          priceUpdatedAt: row.price_updated_at || '',
          unitCostGrossArs: new Decimal(String(row.unit_cost_gross_ars || 0)),
        });
      }
    }
    return map;
  }
  async createAtomic(input: CreateMasterItemAtomicInput): Promise<MasterItemRecord> {
    const minStock = new Decimal(input.stockMinimum);
    const initialPrice = new Decimal(input.initialQuotedPriceNet);
    const initialStock = input.initialStock !== undefined && input.initialStock !== null
      ? new Decimal(input.initialStock)
      : new Decimal(0);

    const { data, error } = await this.client.rpc('create_master_item', {
      p_item_type: input.itemType,
      p_name: input.name,
      p_stock_minimum: Number(toNumericString(minStock)),
      p_initial_supplier_id: input.initialSupplierId,
      p_initial_quoted_price_net: Number(toNumericString(initialPrice)),
      p_initial_stock: Number(toNumericString(initialStock)),
      p_inci: input.inci || undefined,
      p_created_date: input.createdDate || new Date().toISOString().split('T')[0],
    });

    if (error || !data) {
      throw new DomainError(`Error creando ítem maestro atómicamente: ${error?.message || 'Sin datos devueltos'}`);
    }

    return this.mapToRecord(data as Record<string, unknown>, input.inci);
  }
  async create(input: CreateMasterItemInput): Promise<MasterItemRecord> {
    const { data: itemData, error: itemErr } = await this.client
      .from('stock_items')
      .insert({
        code: input.code,
        item_type: input.itemType,
        name: input.name,
        unit_type: input.unitType,
        stock_minimum: Number(toNumericString(input.stockMinimum)),
        created_date: input.createdDate || new Date().toISOString().split('T')[0],
        active: true,
      })
      .select('*')
      .single();

    if (itemErr || !itemData) {
      throw new DomainError(`Error creando stock_item: ${itemErr?.message || 'Sin datos devueltos'}`);
    }

    const itemId = itemData.id;

    // Crear subtipo correspondiente
    if (input.itemType === 'MPR') {
      const { error: rErr } = await this.client
        .from('raw_materials')
        .insert({
          stock_item_id: itemId,
          inci: input.inci || null,
        });

      if (rErr) {
        throw new DomainError(`Error creando registro en raw_materials: ${rErr.message}`);
      }
    } else if (input.itemType === 'COM') {
      const { error: cErr } = await this.client
        .from('components')
        .insert({
          stock_item_id: itemId,
        });

      if (cErr) {
        throw new DomainError(`Error creando registro en components: ${cErr.message}`);
      }
    }

    // Inicializar stock_balances en 0 si no existe
    await this.client.from('stock_balances').upsert(
      {
        stock_item_id: itemId,
        quantity: 0,
      },
      { onConflict: 'stock_item_id' }
    );

    return this.mapToRecord(itemData, input.inci);
  }

  async update(id: string, input: UpdateMasterItemInput): Promise<MasterItemRecord> {
    const updatePayload: Database['public']['Tables']['stock_items']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.stockMinimum !== undefined) {
      updatePayload.stock_minimum = Number(toNumericString(input.stockMinimum));
    }
    if (input.active !== undefined) updatePayload.active = input.active;

    const { data, error } = await this.client
      .from('stock_items')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new DomainError(`Error actualizando stock_item ${id}: ${error?.message || 'No encontrado'}`);
    }

    if (data.item_type === 'MPR' && input.inci !== undefined) {
      await this.client
        .from('raw_materials')
        .update({ inci: input.inci || null })
        .eq('stock_item_id', id);
    }

    return this.mapToRecord(data, input.inci);
  }

  async findById(id: string): Promise<MasterItemRecord | null> {
    const { data, error } = await this.client
      .from('stock_items')
      .select(`
        *,
        raw_materials ( inci )
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const itemData = data as typeof data & { raw_materials?: { inci?: string | null } | null };
    const inci = itemData.raw_materials?.inci || null;
    return this.mapToRecord(data, inci);
  }

  async findByCode(code: string): Promise<MasterItemRecord | null> {
    const { data, error } = await this.client
      .from('stock_items')
      .select(`
        *,
        raw_materials ( inci )
      `)
      .eq('code', code)
      .single();

    if (error || !data) return null;
    const itemData = data as typeof data & { raw_materials?: { inci?: string | null } | null };
    const inci = itemData.raw_materials?.inci || null;
    return this.mapToRecord(data, inci);
  }

  async listAll(itemType?: 'MPR' | 'COM' | 'PRO', includeInactive = true): Promise<MasterItemRecord[]> {
    let query = this.client
      .from('stock_items')
      .select(`
        *,
        raw_materials ( inci )
      `)
      .order('code', { ascending: true });

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando items de stock: ${error.message}`);
    }

    const rows = (data || []) as unknown as MasterItemRowLike[];
    return rows.map((row) => this.mapToRecord(row, row.raw_materials?.inci));
  }

  async createAdjustmentOperation(businessDate?: string): Promise<string> {
    const { data, error } = await this.client
      .from('business_operations')
      .insert({
        operation_type: 'STOCK_ADJUSTMENT',
        business_date: businessDate || new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new DomainError(`Error creando operación de ajuste de stock: ${error?.message || 'Sin datos'}`);
    }

    return data.id;
  }

  private mapToRecord(row: MasterItemRowLike | Record<string, unknown>, inci?: string | null): MasterItemRecord {
    const rawMaterials = (row as MasterItemRowLike).raw_materials;
    return {
      id: String(row.id),
      code: String(row.code),
      itemType: (row.item_type as StockItemType),
      name: String(row.name),
      unitType: (row.unit_type as UnitType),
      stockMinimum: new Decimal(String(row.stock_minimum)),
      active: Boolean(row.active),
      createdDate: String(row.created_date),
      inci: inci !== undefined ? inci : (rawMaterials?.inci || null),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }
}
