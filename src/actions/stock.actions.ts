'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getStockService } from '@/services/composition';
import {
  AdjustStockInputDTO,
  StockAdjustmentResultDTO,
  StockMovementDTO,
  ActionResult,
  serializeStockMovement,
  serializeStockAdjustmentResult,
} from './stock.dto';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export async function adjustStockAction(
  input: AdjustStockInputDTO
): Promise<ActionResult<StockAdjustmentResultDTO>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isUserAuthorized(user)) {
      return { success: false, error: 'No autorizado.' };
    }

    if (!input.stockItemId) {
      return { success: false, error: 'Debe seleccionar un ítem para realizar el ajuste.' };
    }

    if (!input.quantityDelta) {
      return { success: false, error: 'La cantidad a ajustar es obligatoria.' };
    }

    let deltaDecimal: Decimal;
    try {
      deltaDecimal = new Decimal(input.quantityDelta);
    } catch {
      return { success: false, error: 'La cantidad ingresada no es válida.' };
    }

    if (deltaDecimal.isZero()) {
      return { success: false, error: 'La cantidad a ajustar debe ser distinta de cero.' };
    }

    if (!input.reason || !input.reason.trim()) {
      return { success: false, error: 'El motivo del ajuste es obligatorio.' };
    }

    const stockService = getStockService();
    const result = await stockService.adjustStock({
      stockItemId: input.stockItemId,
      quantityDelta: deltaDecimal,
      reason: input.reason.trim(),
      businessDate: input.businessDate,
    });

    revalidatePath('/stock');
    revalidatePath('/fabrica');
    revalidatePath('/costo-ganancia');
    revalidatePath('/administracion');

    return {
      success: true,
      data: serializeStockAdjustmentResult(result),
    };
  } catch (error) {
    const message = error instanceof DomainError
      ? error.message
      : (error instanceof Error ? error.message : 'Error al procesar el ajuste de stock.');
    return {
      success: false,
      error: message,
    };
  }
}

export async function getRecentStockMovementsAction(
  limit: number = 50
): Promise<ActionResult<StockMovementDTO[]>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isUserAuthorized(user)) {
      return { success: false, error: 'No autorizado.' };
    }

    const stockService = getStockService();
    const movements = await stockService.listRecentMovements(limit);

    return {
      success: true,
      data: movements.map(serializeStockMovement),
    };
  } catch (error) {
    const message = error instanceof DomainError
      ? error.message
      : (error instanceof Error ? error.message : 'Error al obtener los movimientos de stock.');
    return {
      success: false,
      error: message,
    };
  }
}
