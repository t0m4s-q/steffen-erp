import {
  IPatrimonyRepository,
  PatrimonyRepository,
  FinancialAccountRecord,
  PatrimonialMovementRecord,
} from '@/repositories/patrimony.repository';
import type { PatrimonialMovementType } from '@/database/domain-types';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface FinancialEntryParam {
  financialAccountId: string;
  deltaArs: Decimal | number | string;
}

export interface PostPatrimonialMovementParams {
  operationId: string;
  movementType: PatrimonialMovementType;
  description: string;
  amountArs: Decimal | number | string;
  entries: FinancialEntryParam[];
}

export interface PatrimonialMovementResult {
  movementId: string;
  code: string;
}

export interface IPatrimonyDomainService {
  getFinancialAccountBalance(accountId: string): Promise<Decimal>;
  listAccounts(): Promise<FinancialAccountRecord[]>;
  listRecentMovements(limit?: number): Promise<PatrimonialMovementRecord[]>;
  postPatrimonialMovement(params: PostPatrimonialMovementParams): Promise<PatrimonialMovementResult>;
}

export class PatrimonyDomainService implements IPatrimonyDomainService {
  constructor(private readonly patrimonyRepo: IPatrimonyRepository = new PatrimonyRepository()) {}

  async listAccounts(): Promise<FinancialAccountRecord[]> {
    return this.patrimonyRepo.listAccounts();
  }

  async listRecentMovements(limit = 10): Promise<PatrimonialMovementRecord[]> {
    return this.patrimonyRepo.listRecentMovements(limit);
  }

  /**
   * Consulta el saldo actual de una cuenta financiera como Decimal exacto.
   */
  async getFinancialAccountBalance(accountId: string): Promise<Decimal> {
    if (!accountId) {
      throw new DomainError('El accountId es obligatorio.');
    }
    const account = await this.patrimonyRepo.getAccount(accountId);
    if (!account) {
      throw new DomainError(`Cuenta financiera ${accountId} no encontrada.`);
    }
    return account.currentBalance;
  }

  /**
   * Registra un movimiento patrimonial (MOV) y sus correspondientes variaciones en financial_entries,
   * actualizando atómicamente el current_balance de cada cuenta involucrada en una única transacción PostgreSQL.
   */
  async postPatrimonialMovement(params: PostPatrimonialMovementParams): Promise<PatrimonialMovementResult> {
    const { operationId, movementType, description, amountArs, entries } = params;

    if (!operationId) throw new DomainError('operationId es obligatorio.');
    if (!movementType) throw new DomainError('movementType es obligatorio.');
    if (!description || !description.trim()) throw new DomainError('description es obligatoria.');

    const amount = new Decimal(amountArs);
    if (amount.isNegative()) {
      throw new DomainError('El importe de movimiento patrimonial no puede ser negativo.');
    }

    if (!entries || entries.length === 0) {
      throw new DomainError('Debe incluirse al menos una variación en entries.');
    }

    // 1. Validar que cada entrada tenga delta != 0 y formatear como Decimal
    const formattedEntries: Array<{ financialAccountId: string; deltaArs: Decimal }> = [];

    for (const entry of entries) {
      if (!entry.financialAccountId) {
        throw new DomainError('Cada entrada financiera debe especificar un financialAccountId.');
      }
      const delta = new Decimal(entry.deltaArs);
      if (delta.isZero()) {
        throw new DomainError('El deltaArs de una entrada financiera no puede ser 0.');
      }
      formattedEntries.push({
        financialAccountId: entry.financialAccountId,
        deltaArs: delta,
      });
    }

    // 2. Ejecutar transacción atómica en PostgreSQL mediante función RPC
    const rpcResult = await this.patrimonyRepo.postPatrimonialMovementAtomic({
      operationId,
      movementType,
      description: description.trim(),
      amountArs: amount,
      entries: formattedEntries,
    });

    return {
      movementId: rpcResult.movementId,
      code: rpcResult.code,
    };
  }
}
