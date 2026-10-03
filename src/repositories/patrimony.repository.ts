import { BaseSupabaseRepository } from './base.repository';
import type { AccountType, PatrimonialMovementType } from '@/database/types';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';

export interface FinancialAccountRecord {
  id: string;
  accountType: AccountType;
  name: string;
  currentBalance: Decimal;
  active: boolean;
}

export interface FinancialEntryRpcParam {
  financial_account_id: string;
  delta_ars: string;
}

export interface PostPatrimonialMovementRpcInput {
  operationId: string;
  movementType: PatrimonialMovementType;
  description: string;
  amountArs: Decimal;
  entries: Array<{ financialAccountId: string; deltaArs: Decimal }>;
}

export interface PatrimonialMovementRpcResult {
  movementId: string;
  code: string;
}

export interface IPatrimonyRepository {
  getAccount(accountId: string): Promise<FinancialAccountRecord | null>;
  postPatrimonialMovementAtomic(input: PostPatrimonialMovementRpcInput): Promise<PatrimonialMovementRpcResult>;
}

export class PatrimonyRepository extends BaseSupabaseRepository implements IPatrimonyRepository {
  async getAccount(accountId: string): Promise<FinancialAccountRecord | null> {
    const { data, error } = await this.client
      .from('financial_accounts')
      .select('id, account_type, name, current_balance, active')
      .eq('id', accountId)
      .limit(1);

    if (error) {
      throw new DomainError(`Error obteniendo cuenta financiera ${accountId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0] as any;
    return {
      id: row.id,
      accountType: row.account_type as AccountType,
      name: row.name,
      currentBalance: new Decimal(row.current_balance),
      active: row.active,
    };
  }

  /**
   * Ejecuta el movimiento patrimonial en una única transacción atómica en PostgreSQL
   * mediante la función RPC post_patrimonial_movement.
   * Si falla cualquier renglón o validación, se produce rollback total.
   */
  async postPatrimonialMovementAtomic(input: PostPatrimonialMovementRpcInput): Promise<PatrimonialMovementRpcResult> {
    const entriesPayload = input.entries.map((e) => ({
      financial_account_id: e.financialAccountId,
      delta_ars: toNumericString(e.deltaArs),
    }));

    const { data, error } = await (this.client.rpc as any)('post_patrimonial_movement', {
      p_operation_id: input.operationId,
      p_movement_type: input.movementType,
      p_description: input.description,
      p_amount_ars: toNumericString(input.amountArs),
      p_entries: entriesPayload,
    });

    if (error) {
      throw new DomainError(`Error registrando movimiento patrimonial: ${error.message}`);
    }

    const result = data as any;
    return {
      movementId: result.movement_id,
      code: result.code,
    };
  }
}
