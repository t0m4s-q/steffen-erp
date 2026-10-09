import {
  IStockRepository,
  StockRepository,
  StockMovementRecord,
  StockAdjustmentResult,
} from '@/repositories/stock.repository';
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

export interface AdjustStockParams {
  stockItemId: string;
  quantityDelta: Decimal | number | string;
  reason: string;
  businessDate?: string;
}

export interface IStockDomainService {
  getStockBalance(stockItemId: string): Promise<Decimal>;
  getBatchBalances(): Promise<Map<string, Decimal>>;
  listRecentMovements(limit?: number): Promise<StockMovementRecord[]>;
  applyStockMovement(params: ApplyStockMovementParams): Promise<StockMovementResult>;
  adjustStock(params: AdjustStockParams): Promise<StockAdjustmentResult>;
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
   * Consulta los saldos de todos los ítems en una sola consulta batch (O(1)).
   */
  async getBatchBalances(): Promise<Map<string, Decimal>> {
    return await this.stockRepo.getBatchBalances();
  }

  /**
   * Lista los movimientos de stock más recientes con trazabilidad y datos de ítems.
   */
  async listRecentMovements(limit: number = 50): Promise<StockMovementRecord[]> {
    return await this.stockRepo.listMovements(limit);
  }

  /**
   * Registra un ajuste de stock manual (positivo o negativo) con trazabilidad normativa.
   */
  async adjustStock(params: AdjustStockParams): Promise<StockAdjustmentResult> {
    const { stockItemId, quantityDelta, reason, businessDate } = params;

    if (!stockItemId) {
      throw new DomainError('El stockItemId es obligatorio.');
    }
    if (!reason || !reason.trim()) {
      throw new DomainError('El motivo del ajuste es obligatorio.');
    }

    const delta = new Decimal(quantityDelta);
    if (delta.isZero()) {
      throw new DomainError('La cantidad del ajuste no puede ser 0.');
    }

    // 1. Obtener tipo de unidad del ítem para validación temprana de precisión
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

    // 3. Validación anticipada de no negatividad para mensaje amigable
    const currentBalance = await this.stockRepo.getBalance(stockItemId);
    const newBalance = currentBalance.plus(delta);
    if (newBalance.isNegative()) {
      if (item.unitType === 'UNIT') {
        throw new DomainError(
          `Stock insuficiente. Disponible: ${currentBalance.toString()} un. Ajuste solicitado: ${delta.toString()} un.`
        );
      } else {
        const availStr = currentBalance.toFixed(3).replace('.', ',');
        const reqStr = delta.toFixed(3).replace('.', ',');
        throw new DomainError(
          `Stock insuficiente. Disponible: ${availStr} kg. Ajuste solicitado: ${reqStr} kg.`
        );
      }
    }

    return await this.stockRepo.createAdjustment({
      stockItemId,
      quantityDelta: delta,
      reason: reason.trim(),
      businessDate,
    });
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

    // 3. Validación anticipada de no negatividad
    const currentBalance = await this.stockRepo.getBalance(stockItemId);
    const newBalance = currentBalance.plus(delta);
    if (newBalance.isNegative()) {
      if (item.unitType === 'UNIT') {
        throw new DomainError(
          `Stock insuficiente. Disponible: ${currentBalance.toString()} un. Salida solicitada: ${delta.toString()} un.`
        );
      } else {
        const availStr = currentBalance.toFixed(3).replace('.', ',');
        const reqStr = delta.toFixed(3).replace('.', ',');
        throw new DomainError(
          `Stock insuficiente. Disponible: ${availStr} kg. Salida solicitada: ${reqStr} kg.`
        );
      }
    }

    // 4. Ejecutar transacción atómica en PostgreSQL mediante función RPC
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

