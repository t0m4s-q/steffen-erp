import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

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

export interface DiscountProfileStepRecord {
  id: string;
  discountProfileId: string;
  position: number;
  percent: Decimal;
}

export interface DiscountProfileRecord {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

export interface DiscountProfileWithStepsRecord extends DiscountProfileRecord {
  steps: DiscountProfileStepRecord[];
}

export interface IDiscountProfileRepository {
  listActiveProfiles(): Promise<DiscountProfileWithStepsRecord[]>;
  getProfileById(id: string): Promise<DiscountProfileRecord | null>;
  getProfileWithSteps(id: string): Promise<DiscountProfileWithStepsRecord | null>;
}

export class DiscountProfileRepository extends BaseSupabaseRepository implements IDiscountProfileRepository {
  async listActiveProfiles(): Promise<DiscountProfileWithStepsRecord[]> {
    const { data, error } = await this.client
      .from('discount_profiles')
      .select(`
        id,
        name,
        active,
        sort_order,
        discount_profile_steps (
          id,
          discount_profile_id,
          position,
          percent
        )
      `)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new DomainError(`Error listando perfiles de descuento: ${error.message}`);
    }

    const rows = parseJsonArray(data);
    return rows.map((r) => {
      const row = parseJsonObject(r);
      const rawSteps = parseJsonArray(row.discount_profile_steps);
      const steps: DiscountProfileStepRecord[] = rawSteps
        .map((s) => {
          const stepObj = parseJsonObject(s);
          return {
            id: String(stepObj.id),
            discountProfileId: String(stepObj.discount_profile_id),
            position: Number(stepObj.position),
            percent: new Decimal(String(stepObj.percent)),
          };
        })
        .sort((a, b) => a.position - b.position);

      return {
        id: String(row.id),
        name: String(row.name),
        active: Boolean(row.active),
        sortOrder: Number(row.sort_order),
        steps,
      };
    });
  }

  async getProfileById(id: string): Promise<DiscountProfileRecord | null> {
    const { data, error } = await this.client
      .from('discount_profiles')
      .select('id, name, active, sort_order')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new DomainError(`Error obteniendo perfil de descuento ${id}: ${error.message}`);
    }

    if (!data) return null;

    const row = parseJsonObject(data);
    return {
      id: String(row.id),
      name: String(row.name),
      active: Boolean(row.active),
      sortOrder: Number(row.sort_order),
    };
  }

  async getProfileWithSteps(id: string): Promise<DiscountProfileWithStepsRecord | null> {
    const { data, error } = await this.client
      .from('discount_profiles')
      .select(`
        id,
        name,
        active,
        sort_order,
        discount_profile_steps (
          id,
          discount_profile_id,
          position,
          percent
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new DomainError(`Error obteniendo perfil de descuento con pasos ${id}: ${error.message}`);
    }

    if (!data) return null;

    const row = parseJsonObject(data);
    const rawSteps = parseJsonArray(row.discount_profile_steps);
    const steps: DiscountProfileStepRecord[] = rawSteps
      .map((s) => {
        const stepObj = parseJsonObject(s);
        return {
          id: String(stepObj.id),
          discountProfileId: String(stepObj.discount_profile_id),
          position: Number(stepObj.position),
          percent: new Decimal(String(stepObj.percent)),
        };
      })
      .sort((a, b) => a.position - b.position);

    return {
      id: String(row.id),
      name: String(row.name),
      active: Boolean(row.active),
      sortOrder: Number(row.sort_order),
      steps,
    };
  }
}
