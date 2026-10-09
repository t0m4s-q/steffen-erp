import { Decimal, toNumericString } from '@/domain/decimal';
import type { StockMovementRecord, StockAdjustmentResult } from '@/repositories/stock.repository';

export interface StockMovementDTO {
  id: string;
  code: string;
  operationId: string;
  stockItemId: string;
  itemCode: string;
  itemName: string;
  itemType: 'MPR' | 'COM' | 'PRO';
  unitType: 'KG' | 'UNIT';
  movementType: 'VENTA' | 'COMPRA' | 'ENVASADO' | 'FABRICACIÓN' | 'AJUSTE';
  quantityDelta: string;
  quantityDeltaFormatted: string;
  description: string;
  createdAt: string;
  businessDate: string;
}

export interface AdjustStockInputDTO {
  stockItemId: string;
  quantityDelta: number | string;
  reason: string;
  businessDate?: string;
}

export interface StockAdjustmentResultDTO {
  operationId: string;
  adjustmentId: string;
  movementId: string;
  movementCode: string;
  stockItemId: string;
  previousBalance: string;
  newBalance: string;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function serializeStockMovement(record: StockMovementRecord): StockMovementDTO {
  const deltaStr = toNumericString(record.quantityDelta);
  const isPos = record.quantityDelta.gt(0);
  const sign = isPos ? '+' : '';
  const absDec = record.quantityDelta.abs();

  let formattedDelta = '';
  if (record.unitType === 'KG') {
    const str = absDec.toFixed(3);
    const [rawInt, rawDec] = str.split('.');
    const formattedInt = rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const trimmedDec = (rawDec || '').replace(/0+$/, '');
    formattedDelta = trimmedDec ? `${sign}${formattedInt},${trimmedDec} kg` : `${sign}${formattedInt} kg`;
  } else {
    const intPart = absDec.truncated().toString();
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    formattedDelta = `${sign}${formattedInt} un`;
  }

  return {
    id: record.id,
    code: record.code,
    operationId: record.operationId,
    stockItemId: record.stockItemId,
    itemCode: record.itemCode || '',
    itemName: record.itemName || '',
    itemType: (record.itemType as 'MPR' | 'COM' | 'PRO') || 'MPR',
    unitType: (record.unitType as 'KG' | 'UNIT') || 'KG',
    movementType: record.movementType,
    quantityDelta: deltaStr,
    quantityDeltaFormatted: formattedDelta,
    description: record.description,
    createdAt: record.createdAt,
    businessDate: record.businessDate,
  };
}

export function serializeStockAdjustmentResult(result: StockAdjustmentResult): StockAdjustmentResultDTO {
  return {
    operationId: result.operationId,
    adjustmentId: result.adjustmentId,
    movementId: result.movementId,
    movementCode: result.movementCode,
    stockItemId: result.stockItemId,
    previousBalance: toNumericString(result.previousBalance),
    newBalance: toNumericString(result.newBalance),
  };
}
