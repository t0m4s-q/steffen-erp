'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getFactoryService } from '@/services/composition';
import {
  serializeManufactureResult,
  serializeManufacturingPreview,
  type BulkManufacturingPreviewDTO,
  type ManufactureBulkLotResultDTO,
} from './factory.dto';

export interface ManufactureBulkLotActionInput {
  baseProductId: string;
  formulaVersionId: string;
  kgFabricated: string;
  businessDate?: string;
  observations?: string;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getManufacturingPreviewAction(
  baseProductId: string,
  kgFabricated: string
): Promise<ActionResult<BulkManufacturingPreviewDTO>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isUserAuthorized(user)) {
      return { success: false, error: 'Usuario no autenticado o no autorizado.' };
    }

    if (!baseProductId || !baseProductId.trim()) {
      return { success: false, error: 'Debe seleccionar un Producto Base.' };
    }

    if (!kgFabricated || !kgFabricated.trim()) {
      return { success: false, error: 'Debe ingresar los kg a fabricar.' };
    }

    const factoryService = getFactoryService();
    const preview = await factoryService.getManufacturingPreview(baseProductId, kgFabricated);

    return {
      success: true,
      data: serializeManufacturingPreview(preview),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado calculando requerimientos de fabricación.';
    return { success: false, error: msg };
  }
}

export async function manufactureBulkLotAction(
  input: ManufactureBulkLotActionInput
): Promise<ActionResult<ManufactureBulkLotResultDTO>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isUserAuthorized(user)) {
      return { success: false, error: 'Usuario no autenticado o no autorizado.' };
    }

    if (!input.baseProductId) {
      return { success: false, error: 'El Producto Base es obligatorio.' };
    }

    if (!input.formulaVersionId) {
      return { success: false, error: 'La versión de fórmula es obligatoria.' };
    }

    if (!input.kgFabricated || !input.kgFabricated.trim()) {
      return { success: false, error: 'Debe ingresar los kg a fabricar.' };
    }

    const factoryService = getFactoryService();
    const result = await factoryService.manufactureBulkLot({
      baseProductId: input.baseProductId,
      formulaVersionId: input.formulaVersionId,
      kgFabricated: input.kgFabricated.trim(),
      businessDate: input.businessDate?.trim() || undefined,
      observations: input.observations?.trim() || undefined,
    });

    revalidatePath('/fabrica');
    revalidatePath('/stock');

    return {
      success: true,
      data: serializeManufactureResult(result),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error registrando fabricación.';
    return { success: false, error: msg };
  }
}
