import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';
import type { Database } from '@/database/types';

export interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  dni: string | null;
  address: string | null;
  locality: string | null;
  province: string | null;
  phone: string | null;
  transportName: string | null;
  transportAddress: string | null;
  createdDate: string;
  category: string | null;
  discount1Pct: Decimal;
  discount2Pct: Decimal;
  discount3Pct: Decimal;
  active: boolean;
  balanceArs: Decimal;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  code?: string;
  name: string;
  dni?: string | null;
  address?: string | null;
  locality?: string | null;
  province?: string | null;
  phone?: string | null;
  transportName?: string | null;
  transportAddress?: string | null;
  category?: string | null;
  discount1Pct?: Decimal | number;
  discount2Pct?: Decimal | number;
  discount3Pct?: Decimal | number;
  createdDate?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  dni?: string | null;
  address?: string | null;
  locality?: string | null;
  province?: string | null;
  phone?: string | null;
  transportName?: string | null;
  transportAddress?: string | null;
  category?: string | null;
  discount1Pct?: Decimal | number;
  discount2Pct?: Decimal | number;
  discount3Pct?: Decimal | number;
  active?: boolean;
}

export class CustomerRepository extends BaseSupabaseRepository {
  async create(input: CreateCustomerInput): Promise<CustomerRecord> {
    const d1 = new Decimal(input.discount1Pct ?? 0);
    const d2 = new Decimal(input.discount2Pct ?? 0);
    const d3 = new Decimal(input.discount3Pct ?? 0);

    const { data, error } = await this.client.rpc('create_customer_with_account', {
      p_name: input.name,
      p_dni: input.dni || undefined,
      p_address: input.address || undefined,
      p_locality: input.locality || undefined,
      p_province: input.province || undefined,
      p_phone: input.phone || undefined,
      p_transport_name: input.transportName || undefined,
      p_transport_address: input.transportAddress || undefined,
      p_category: input.category || undefined,
      p_discount_1_pct: Number(toNumericString(d1)),
      p_discount_2_pct: Number(toNumericString(d2)),
      p_discount_3_pct: Number(toNumericString(d3)),
      p_created_date: input.createdDate || new Date().toISOString().split('T')[0],
    });

    if (error || !data) {
      throw new DomainError(`Error creando cliente: ${error?.message || 'Sin datos devueltos'}`);
    }

    return this.mapToRecord(data);
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerRecord> {
    const updatePayload: Database['public']['Tables']['customers']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.dni !== undefined) updatePayload.dni = input.dni;
    if (input.address !== undefined) updatePayload.address = input.address;
    if (input.locality !== undefined) updatePayload.locality = input.locality;
    if (input.province !== undefined) updatePayload.province = input.province;
    if (input.phone !== undefined) updatePayload.phone = input.phone;
    if (input.transportName !== undefined) updatePayload.transport_name = input.transportName;
    if (input.transportAddress !== undefined) updatePayload.transport_address = input.transportAddress;
    if (input.category !== undefined) updatePayload.category = input.category;
    if (input.discount1Pct !== undefined) updatePayload.discount_1_pct = Number(toNumericString(new Decimal(input.discount1Pct)));
    if (input.discount2Pct !== undefined) updatePayload.discount_2_pct = Number(toNumericString(new Decimal(input.discount2Pct)));
    if (input.discount3Pct !== undefined) updatePayload.discount_3_pct = Number(toNumericString(new Decimal(input.discount3Pct)));
    if (input.active !== undefined) updatePayload.active = input.active;

    const { data, error } = await this.client
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select('*, financial_accounts ( id, current_balance )')
      .single();

    if (error || !data) {
      throw new DomainError(`Error actualizando cliente ${id}: ${error?.message || 'No encontrado'}`);
    }

    return this.mapToRecord(data);
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*, financial_accounts ( id, current_balance )')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  async findByCode(code: string): Promise<CustomerRecord | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*, financial_accounts ( id, current_balance )')
      .eq('code', code)
      .single();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  async listAll(includeInactive = true): Promise<CustomerRecord[]> {
    let query = this.client
      .from('customers')
      .select('*, financial_accounts ( id, current_balance )')
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando clientes: ${error.message}`);
    }

    return (data || []).map(d => this.mapToRecord(d));
  }

  private mapToRecord(row: any): CustomerRecord {
    const acc = Array.isArray(row.financial_accounts)
      ? row.financial_accounts[0]
      : row.financial_accounts;
    const balance = acc?.current_balance !== undefined ? acc.current_balance : 0;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      dni: row.dni,
      address: row.address,
      locality: row.locality,
      province: row.province,
      phone: row.phone,
      transportName: row.transport_name,
      transportAddress: row.transport_address,
      createdDate: row.created_date,
      category: row.category,
      discount1Pct: new Decimal(row.discount_1_pct ?? 0),
      discount2Pct: new Decimal(row.discount_2_pct ?? 0),
      discount3Pct: new Decimal(row.discount_3_pct ?? 0),
      active: row.active,
      balanceArs: new Decimal(balance),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
