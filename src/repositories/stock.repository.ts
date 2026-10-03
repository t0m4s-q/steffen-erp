import { BaseSupabaseRepository } from './base.repository';
import type { StockItemType, UnitType, StockMovementType } from '@/database/domain-types';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';

export interface StockItemInfo {
  id: string;
  code: string;
  itemType: StockItemType;
  name: string;
  unitType: UnitType;
  stockMinimum: Decimal;
  active: boolean;
}

export interface ApplyStockMovementRpcInput {
  operationId: string;
  stockItemId: string;
  movementType: StockMovementType;
  quantityDelta: Decimal;
  description: string;
}

export interface StockMovementRpcResult {
  movementId: string;
  code: string;
  stockItemId: string;
  previousBalance: Decimal;
  newBalance: Decimal;
}

export interface IStockRepository {
  getStockItem(stockItemId: string): Promise<StockItemInfo | null>;
  getBalance(stockItemId: string): Promise<Decimal>;
  applyStockMovementAtomic(input: ApplyStockMovementRpcInput): Promise<StockMovementRpcResult>;
}

export class StockRepository extends BaseSupabaseRepository implements IStockRepository {
  async getStockItem(stockItemId: string): Promise<StockItemInfo | null> {
    const { data, error } = await this.client
      .from('stock_items')
      .select('id, code, item_type, name, unit_type, stock_minimum, active')
      .eq('id', stockItemId)
      .limit(1);

    if (error) {
      throw new DomainError(`Error obteniendo ítem de stock ${stockItemId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0] as any;
    return {
      id: row.id,
      code: row.code,
      itemType: row.item_type as StockItemType,
      name: row.name,
      unitType: row.unit_type as UnitType,
      stockMinimum: new Decimal(row.stock_minimum),
      active: row.active,
    };
  }

  async getBalance(stockItemId: string): Promise<Decimal> {
    const { data, error } = await this.client
      .from('stock_balances')
      .select('quantity')
      .eq('stock_item_id', stockItemId)
      .limit(1);

    if (error) {
      throw new DomainError(`Error consultando saldo de stock para ${stockItemId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return new Decimal(0);
    }

    return new Decimal((data as any)[0].quantity);
  }

  /**
   * Ejecuta el movimiento de stock en una única transacción atómica en PostgreSQL
   * mediante la función RPC apply_stock_movement.
   * Si falla cualquier validación o paso, se produce rollback total.
   */
  async applyStockMovementAtomic(input: ApplyStockMovementRpcInput): Promise<StockMovementRpcResult> {
    const { data, error } = await (this.client.rpc as any)('apply_stock_movement', {
      p_operation_id: input.operationId,
      p_stock_item_id: input.stockItemId,
      p_movement_type: input.movementType,
      p_quantity_delta: toNumericString(input.quantityDelta),
      p_description: input.description,
    });

    if (error) {
      throw new DomainError(`Error aplicando movimiento de stock: ${error.message}`);
    }

    const result = data as any;
    return {
      movementId: result.movement_id,
      code: result.code,
      stockItemId: result.stock_item_id,
      previousBalance: new Decimal(result.previous_balance),
      newBalance: new Decimal(result.new_balance),
    };
  }
}
