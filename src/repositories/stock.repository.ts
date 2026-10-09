import { BaseSupabaseRepository } from './base.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/database/types';
import type { StockItemType, UnitType, StockMovementType } from '@/database/domain-types';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';

/**
 * Adaptador estrecho y fuertemente tipado para las RPCs de stock.
 *
 * Justificación técnica:
 * En PostgreSQL, p_quantity_delta es NUMERIC. PostgREST y PostgreSQL aceptan
 * strings decimales exactos en el payload JSON (ej: "25.500", "-5.250").
 * Los tipos generados de Supabase infieren NUMERIC como TypeScript `number`,
 * lo cual induciría al uso de Number() y pérdida de precisión con IEEE 754.
 *
 * Este adaptador redefine de forma explícita el contrato RPC para reflejar el tipo
 * real de transporte (`p_quantity_delta: string`) sin alterar `types.ts`, sin
 * requerir casts dobles (`as unknown as number`) y sin usar `any`.
 */
export interface AdjustStockAtomicRpcArgs {
  p_stock_item_id: string;
  p_quantity_delta: string;
  p_reason: string;
  p_business_date?: string;
  [key: string]: unknown;
}

export interface ApplyStockMovementRpcArgs {
  p_operation_id: string;
  p_stock_item_id: string;
  p_movement_type: string;
  p_quantity_delta: string;
  p_description: string;
  [key: string]: unknown;
}

type GenericRpcInvoker = (
  fn: string,
  args?: Record<string, unknown>
) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;

function parseJsonObject(val: unknown): Record<string, unknown> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

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

export interface StockMovementRecord {
  id: string;
  code: string;
  operationId: string;
  stockItemId: string;
  movementType: StockMovementType;
  quantityDelta: Decimal;
  description: string;
  createdAt: string;
  businessDate: string;
  itemCode?: string;
  itemName?: string;
  itemType?: StockItemType;
  unitType?: UnitType;
}

export interface CreateStockAdjustmentInput {
  stockItemId: string;
  quantityDelta: Decimal;
  reason: string;
  businessDate?: string;
}

export interface StockAdjustmentResult {
  operationId: string;
  adjustmentId: string;
  movementId: string;
  movementCode: string;
  stockItemId: string;
  previousBalance: Decimal;
  newBalance: Decimal;
}

export interface IStockRepository {
  getStockItem(stockItemId: string): Promise<StockItemInfo | null>;
  getBalance(stockItemId: string): Promise<Decimal>;
  getBatchBalances(): Promise<Map<string, Decimal>>;
  listMovements(limit?: number): Promise<StockMovementRecord[]>;
  applyStockMovementAtomic(input: ApplyStockMovementRpcInput): Promise<StockMovementRpcResult>;
  createAdjustment(input: CreateStockAdjustmentInput): Promise<StockAdjustmentResult>;
}

interface StockMovementQueryRow {
  id: string;
  code: string;
  operation_id: string;
  stock_item_id: string;
  movement_type: string;
  quantity_delta: number;
  description: string;
  created_at: string;
  business_operations?: { business_date?: string | null } | { business_date?: string | null }[] | null;
  stock_items?: { code?: string; name?: string; item_type?: string; unit_type?: string } | { code?: string; name?: string; item_type?: string; unit_type?: string }[] | null;
}

export class StockRepository extends BaseSupabaseRepository implements IStockRepository {
  /**
   * Invoca una RPC de Supabase manteniendo el enlace de contexto ('this') del cliente
   * y adaptando el contrato de transporte HTTP/JSON para enviar strings decimales exactos.
   */
  private callRpc(fn: string, args: Record<string, unknown>) {
    const invoker = this.client.rpc.bind(this.client) as GenericRpcInvoker;
    return invoker(fn, args);
  }

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

    const row = data[0];
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

    return new Decimal(data[0].quantity);
  }

  async getBatchBalances(): Promise<Map<string, Decimal>> {
    const { data, error } = await this.client
      .from('stock_balances')
      .select('stock_item_id, quantity');

    if (error) {
      throw new DomainError(`Error consultando saldos consolidados de stock: ${error.message}`);
    }

    const map = new Map<string, Decimal>();
    for (const row of data || []) {
      map.set(row.stock_item_id, new Decimal(row.quantity));
    }
    return map;
  }

  async listMovements(limit = 50): Promise<StockMovementRecord[]> {
    const { data, error } = await this.client
      .from('stock_movements')
      .select(`
        id,
        code,
        operation_id,
        stock_item_id,
        movement_type,
        quantity_delta,
        description,
        created_at,
        business_operations ( business_date ),
        stock_items ( code, name, item_type, unit_type )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DomainError(`Error listando movimientos de stock: ${error.message}`);
    }

    const rows = (data || []) as unknown as StockMovementQueryRow[];
    return rows.map((row) => {
      const op = Array.isArray(row.business_operations) ? row.business_operations[0] : row.business_operations;
      const item = Array.isArray(row.stock_items) ? row.stock_items[0] : row.stock_items;
      return {
        id: row.id,
        code: row.code,
        operationId: row.operation_id,
        stockItemId: row.stock_item_id,
        movementType: row.movement_type as StockMovementType,
        quantityDelta: new Decimal(row.quantity_delta),
        description: row.description,
        createdAt: row.created_at,
        businessDate: op?.business_date || row.created_at.slice(0, 10),
        itemCode: item?.code,
        itemName: item?.name,
        itemType: item?.item_type as StockItemType,
        unitType: item?.unit_type as UnitType,
      };
    });
  }

  /**
   * Ejecuta el movimiento de stock en una única transacción atómica en PostgreSQL
   * mediante la función RPC apply_stock_movement.
   * Si falla cualquier validación o paso, se produce rollback total.
   */
  async applyStockMovementAtomic(input: ApplyStockMovementRpcInput): Promise<StockMovementRpcResult> {
    const args: ApplyStockMovementRpcArgs = {
      p_operation_id: input.operationId,
      p_stock_item_id: input.stockItemId,
      p_movement_type: input.movementType,
      p_quantity_delta: toNumericString(input.quantityDelta),
      p_description: input.description,
    };

    const { data, error } = await this.callRpc('apply_stock_movement', args);

    if (error || !data) {
      throw new DomainError(`Error aplicando movimiento de stock: ${error?.message || 'Sin datos devueltos'}`);
    }

    const result = parseJsonObject(data);
    return {
      movementId: String(result.movement_id),
      code: String(result.code),
      stockItemId: String(result.stock_item_id),
      previousBalance: new Decimal(String(result.previous_balance)),
      newBalance: new Decimal(String(result.new_balance)),
    };
  }

  /**
   * Crea un ajuste manual de stock completo con atomicidad ACID en PostgreSQL
   * mediante la función RPC adjust_stock_atomic:
   * 1. business_operations (STOCK_ADJUSTMENT)
   * 2. stock_adjustments (cabecera con motivo)
   * 3. stock_adjustment_items (línea de ajuste)
   * 4. apply_stock_movement (MSTxxxx + actualización de stock_balances)
   * Todo ocurre dentro de la misma transacción PostgreSQL nativa.
   */
  async createAdjustment(input: CreateStockAdjustmentInput): Promise<StockAdjustmentResult> {
    const args: AdjustStockAtomicRpcArgs = {
      p_stock_item_id: input.stockItemId,
      p_quantity_delta: toNumericString(input.quantityDelta),
      p_reason: input.reason.trim(),
      p_business_date: input.businessDate || undefined,
    };

    const { data, error } = await this.callRpc('adjust_stock_atomic', args);

    if (error || !data) {
      throw new DomainError(`Error registrando ajuste de stock atómico: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    return {
      operationId: String(res.operation_id),
      adjustmentId: String(res.adjustment_id),
      movementId: String(res.movement_id),
      movementCode: String(res.movement_code),
      stockItemId: String(res.stock_item_id),
      previousBalance: new Decimal(String(res.previous_balance)),
      newBalance: new Decimal(String(res.new_balance)),
    };
  }
}
