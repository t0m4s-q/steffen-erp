import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

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

export interface UpdateMasterItemInput {
  name?: string;
  stockMinimum?: Decimal;
  inci?: string | null;
  active?: boolean;
}

export class MasterItemRepository extends BaseSupabaseRepository {
  async create(input: CreateMasterItemInput): Promise<MasterItemRecord> {
    const { data: itemData, error: itemErr } = await this.client
      .from('stock_items')
      .insert({
        code: input.code,
        item_type: input.itemType,
        name: input.name,
        unit_type: input.unitType,
        stock_minimum: Number(input.stockMinimum.toNumericString()),
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
        balance_raw: 0,
      },
      { onConflict: 'stock_item_id' }
    );

    return this.mapToRecord(itemData, input.inci);
  }

  async update(id: string, input: UpdateMasterItemInput): Promise<MasterItemRecord> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.stockMinimum !== undefined) {
      updatePayload.stock_minimum = Number(input.stockMinimum.toNumericString());
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
    const inci = (data as any).raw_materials?.inci || null;
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
    const inci = (data as any).raw_materials?.inci || null;
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

    return (data || []).map((row: any) => this.mapToRecord(row, row.raw_materials?.inci));
  }

  private mapToRecord(row: any, inci?: string | null): MasterItemRecord {
    return {
      id: row.id,
      code: row.code,
      itemType: row.item_type,
      name: row.name,
      unitType: row.unit_type,
      stockMinimum: new Decimal(row.stock_minimum),
      active: row.active,
      createdDate: row.created_date,
      inci: inci !== undefined ? inci : (row.raw_materials?.inci || null),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
