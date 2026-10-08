'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/auth/guard';
import { getPriceListService } from '@/services/composition';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';
import {
  type PriceListDTO,
  type PriceHistoryRecordDTO,
  type BulkIncreaseResultDTO,
  type ActionResult,
  serializePriceList,
  serializePriceHistoryRecord,
  serializeBulkIncreaseResult,
} from './price-list.dto';

export interface CreatePriceListInput {
  name: string;
}

export interface UpdatePriceListInput {
  id: string;
  name?: string;
  active?: boolean;
}

export interface SetProductPriceInput {
  priceListId: string;
  productId: string;
  priceArs: number | string;
}

export interface BulkPriceIncreaseInput {
  priceListId: string;
  percentage: number | string;
  productIds?: string[];
}

export async function createPriceListAction(
  input: CreatePriceListInput
): Promise<ActionResult<PriceListDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getPriceListService();

    if (!input.name || !input.name.trim()) {
      return { success: false, error: 'El nombre de la lista de precios es obligatorio.' };
    }

    const created = await service.createPriceList({
      name: input.name.trim(),
    });

    revalidatePath('/precios');
    return {
      success: true,
      data: serializePriceList(created),
    };
  } catch (error) {
    const msg = error instanceof DomainError || error instanceof Error ? error.message : 'Error desconocido al crear lista de precios';
    return { success: false, error: msg };
  }
}

export async function updatePriceListAction(
  input: UpdatePriceListInput
): Promise<ActionResult<PriceListDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getPriceListService();

    if (!input.id || !input.id.trim()) {
      return { success: false, error: 'El identificador de la lista de precios es obligatorio.' };
    }

    if (input.name !== undefined && !input.name.trim()) {
      return { success: false, error: 'El nombre de la lista de precios no puede ser vacío.' };
    }

    if (input.name === undefined && input.active === undefined) {
      return { success: false, error: 'Debe especificar al menos un campo para actualizar.' };
    }

    const updated = await service.updatePriceList(input.id.trim(), {
      name: input.name !== undefined ? input.name.trim() : undefined,
      active: input.active,
    });

    revalidatePath('/precios');
    return {
      success: true,
      data: serializePriceList(updated),
    };
  } catch (error) {
    const msg = error instanceof DomainError || error instanceof Error ? error.message : 'Error desconocido al actualizar lista de precios';
    return { success: false, error: msg };
  }
}

export async function setProductPriceAction(
  input: SetProductPriceInput
): Promise<ActionResult<PriceHistoryRecordDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getPriceListService();

    if (!input.priceListId || !input.priceListId.trim()) {
      return { success: false, error: 'El identificador de lista de precios es obligatorio.' };
    }

    if (!input.productId || !input.productId.trim()) {
      return { success: false, error: 'El identificador de producto es obligatorio.' };
    }

    let priceDec: Decimal;
    try {
      priceDec = new Decimal(String(input.priceArs));
    } catch {
      return { success: false, error: 'El precio ingresado no es un valor numérico válido.' };
    }

    if (priceDec.lte(0)) {
      return { success: false, error: 'El precio de venta debe ser estrictamente mayor a 0.' };
    }

    if (!priceDec.isInteger()) {
      return { success: false, error: 'El precio de venta debe ser un número entero en pesos (sin centavos).' };
    }

    const version = await service.setProductPrice({
      priceListId: input.priceListId.trim(),
      productId: input.productId.trim(),
      priceArs: priceDec,
    });

    revalidatePath('/precios');
    return {
      success: true,
      data: serializePriceHistoryRecord(version),
    };
  } catch (error) {
    const msg = error instanceof DomainError || error instanceof Error ? error.message : 'Error desconocido al fijar precio de producto';
    return { success: false, error: msg };
  }
}

export async function applyBulkPriceIncreaseAction(
  input: BulkPriceIncreaseInput
): Promise<ActionResult<BulkIncreaseResultDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getPriceListService();

    if (!input.priceListId || !input.priceListId.trim()) {
      return { success: false, error: 'El identificador de lista de precios es obligatorio.' };
    }

    let pctDec: Decimal;
    try {
      pctDec = new Decimal(String(input.percentage));
    } catch {
      return { success: false, error: 'El porcentaje ingresado no es un valor numérico válido.' };
    }

    if (pctDec.lte(0)) {
      return { success: false, error: 'El porcentaje de aumento debe ser estrictamente mayor a 0.' };
    }

    const result = await service.applyBulkPriceIncrease({
      priceListId: input.priceListId.trim(),
      percentage: pctDec,
      productIds: input.productIds && input.productIds.length > 0 ? input.productIds : undefined,
    });

    revalidatePath('/precios');
    return {
      success: true,
      data: serializeBulkIncreaseResult(result),
    };
  } catch (error) {
    const msg = error instanceof DomainError || error instanceof Error ? error.message : 'Error desconocido al aplicar aumento de precios';
    return { success: false, error: msg };
  }
}

export async function getPriceHistoryAction(
  priceListId: string,
  productId: string
): Promise<ActionResult<PriceHistoryRecordDTO[]>> {
  try {
    await requireAuthenticatedUser();
    const service = getPriceListService();

    if (!priceListId || !priceListId.trim()) {
      return { success: false, error: 'El identificador de lista de precios es obligatorio.' };
    }

    if (!productId || !productId.trim()) {
      return { success: false, error: 'El identificador de producto es obligatorio.' };
    }

    const history = await service.getPriceHistory(priceListId.trim(), productId.trim());
    return {
      success: true,
      data: history.map(serializePriceHistoryRecord),
    };
  } catch (error) {
    const msg = error instanceof DomainError || error instanceof Error ? error.message : 'Error desconocido al obtener historial de precios';
    return { success: false, error: msg };
  }
}
