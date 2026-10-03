import { IStockRepository, StockRepository } from '@/repositories/stock.repository';
import type { StockMovementType } from '@/database/domain-types';
import {
  DomainError,
  InvalidStockUnitPrecisionError,
} from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface ApplyStockMovementParams {
  operationId: string;
  stockItemId: string;
  movementType: StockMovementType;
  quantityDelta: Decimal | number | string;
  description: string;
}

export interface StockMovementResult {
  movementId: string;
  code: string;
  stockItemId: string;
  previousBalance: Decimal;
  newBalance: Decimal;
}

export interface IStockDomainService {
  getStockBalance(stockItemId: string): Promise<Decimal>;
  applyStockMovement(params: ApplyStockMovementParams): Promise<StockMovementResult>;
}

export class StockDomainService implements IStockDomainService {
  constructor(private readonly stockRepo: IStockRepository = new StockRepository()) {}

  /**
   * Consulta el saldo actual físico de un ítem de stock como Decimal exacto.
   */
  async getStockBalance(stockItemId: string): Promise<Decimal> {
    if (!stockItemId) {
      throw new DomainError('El stockItemId es obligatorio.');
    }
    return await this.stockRepo.getBalance(stockItemId);
  }

  /**
   * Registra y aplica un movimiento de stock (MST) en una única transacción atómica de PostgreSQL.
   * Reglas estrictas:
   * - quantityDelta != 0.
   * - unit_type = 'UNIT' (COM/PRO) exige cantidad entera exacta.
   * - unit_type = 'KG' (MPR) admite como máximo 3 decimales (0.001 kg).
   * - Ejecución 100% transaccional: generación de código visible, insert en stock_movements
   *   y update de stock_balances se confirman o hacen rollback juntos.
   */
  async applyStockMovement(params: ApplyStockMovementParams): Promise<StockMovementResult> {
    const { operationId, stockItemId, movementType, quantityDelta, description } = params;

    if (!operationId) throw new DomainError('operationId es obligatorio.');
    if (!stockItemId) throw new DomainError('stockItemId es obligatorio.');
    if (!movementType) throw new DomainError('movementType es obligatorio.');
    if (!description || !description.trim()) throw new DomainError('description es obligatoria.');

    const delta = new Decimal(quantityDelta);
    if (delta.isZero()) {
      throw new DomainError('El delta de cantidad del movimiento de stock no puede ser 0.');
    }

    // 1. Obtener tipo de unidad del ítem para validación temprana de dominio
    const item = await this.stockRepo.getStockItem(stockItemId);
    if (!item) {
      throw new DomainError(`Ítem de stock ${stockItemId} no encontrado.`);
    }

    // 2. Validación de precisión según unidad
    if (item.unitType === 'UNIT') {
      if (!delta.isInteger()) {
        throw new InvalidStockUnitPrecisionError(
          `El ítem ${item.code} es por unidad (UNIT) y no admite cantidades decimales (${delta.toString()}).`
        );
      }
    } else if (item.unitType === 'KG') {
      if (delta.decimalPlaces() > 3) {
        throw new InvalidStockUnitPrecisionError(
          `El ítem ${item.code} (KG) admite como máximo 3 decimales de precisión (${delta.toString()}).`
        );
      }
    }

    // 3. Ejecutar transacción atómica en PostgreSQL mediante función RPC
    const rpcResult = await this.stockRepo.applyStockMovementAtomic({
      operationId,
      stockItemId,
      movementType,
      quantityDelta: delta,
      description: description.trim(),
    });

    return {
      movementId: rpcResult.movementId,
      code: rpcResult.code,
      stockItemId: rpcResult.stockItemId,
      previousBalance: rpcResult.previousBalance,
      newBalance: rpcResult.newBalance,
    };
  }
}
