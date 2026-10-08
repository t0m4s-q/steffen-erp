'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/auth/guard';
import { getProductService } from '@/services/composition';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';
import {
  type FinalProductDTO,
  type ActionResult,
  serializeFinalProduct,
} from './product.dto';

export type { FinalProductDTO, ActionResult };

export interface CreateFinalProductInput {
  name: string;
  baseProductId: string;
  presentation: string;
  weightKg: string;
  stockMinimum: number;
  initialStock?: number;
  components: Array<{
    componentId: string;
    quantityPerUnit: number;
    sortOrder?: number;
  }>;
  createdDate?: string | null;
}

export interface UpdateFinalProductMetadataInput {
  productId: string;
  name?: string;
  presentation?: string;
  stockMinimum?: number;
  active?: boolean;
}

export async function createFinalProductAction(
  input: CreateFinalProductInput
): Promise<ActionResult<FinalProductDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getProductService();

    if (!input.name || !input.name.trim()) {
      return { success: false, error: 'El nombre del Producto Final es obligatorio.' };
    }

    if (!input.baseProductId || !input.baseProductId.trim()) {
      return { success: false, error: 'Debe seleccionar un Producto Base (PBA).' };
    }

    if (!input.presentation || !input.presentation.trim()) {
      return { success: false, error: 'La presentación comercial es obligatoria.' };
    }

    let weight: Decimal;
    try {
      weight = new Decimal(input.weightKg);
      if (weight.lte(0)) {
        return { success: false, error: 'El peso/contenido debe ser mayor a 0 kg.' };
      }
      if (weight.decimalPlaces() > 3) {
        return { success: false, error: 'El peso/contenido en kg admite como máximo 3 decimales.' };
      }
    } catch {
      return { success: false, error: `Peso en kg inválido: "${input.weightKg}".` };
    }

    const minStock = Number(input.stockMinimum);
    if (!Number.isInteger(minStock) || minStock <= 0) {
      return { success: false, error: 'El stock mínimo debe ser un número entero mayor a 0.' };
    }

    let initStock: number | undefined = undefined;
    if (input.initialStock !== undefined && input.initialStock !== null) {
      initStock = Number(input.initialStock);
      if (!Number.isInteger(initStock) || initStock < 0) {
        return { success: false, error: 'El stock inicial debe ser un número entero mayor o igual a 0.' };
      }
    }

    if (!Array.isArray(input.components) || input.components.length === 0) {
      return { success: false, error: 'El producto debe tener al menos un componente en el BOM.' };
    }

    const seenComps = new Set<string>();
    for (let i = 0; i < input.components.length; i++) {
      const comp = input.components[i];
      if (!comp.componentId || !comp.componentId.trim()) {
        return { success: false, error: `Debe seleccionar un Componente en la fila ${i + 1}.` };
      }
      if (seenComps.has(comp.componentId)) {
        return { success: false, error: `Componente duplicado en el BOM (fila ${i + 1}). Cada componente solo puede agregarse una vez.` };
      }
      seenComps.add(comp.componentId);

      const qty = Number(comp.quantityPerUnit);
      if (!Number.isInteger(qty) || qty <= 0) {
        return { success: false, error: `La cantidad del componente en la fila ${i + 1} debe ser un entero mayor a 0.` };
      }
    }

    const created = await service.createProduct({
      name: input.name.trim(),
      baseProductId: input.baseProductId.trim(),
      presentation: input.presentation.trim(),
      weightKg: weight,
      stockMinimum: minStock,
      initialStock: initStock,
      createdDate: input.createdDate || undefined,
      components: input.components.map((c, idx) => ({
        componentId: c.componentId.trim(),
        quantityPerUnit: c.quantityPerUnit,
        sortOrder: c.sortOrder ?? idx + 1,
      })),
    });

    revalidatePath('/stock');

    return {
      success: true,
      data: serializeFinalProduct(created),
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al crear el Producto Final.';
    return { success: false, error: message };
  }
}

export async function updateFinalProductMetadataAction(
  input: UpdateFinalProductMetadataInput
): Promise<ActionResult<{ productId: string }>> {
  try {
    await requireAuthenticatedUser();
    const service = getProductService();

    if (!input.productId || !input.productId.trim()) {
      return { success: false, error: 'El identificador del Producto Final es obligatorio.' };
    }

    if (
      input.name === undefined &&
      input.presentation === undefined &&
      input.stockMinimum === undefined &&
      input.active === undefined
    ) {
      return { success: false, error: 'Debe indicarse al menos un campo para actualizar.' };
    }

    if (input.name !== undefined && !input.name.trim()) {
      return { success: false, error: 'El nombre del producto no puede quedar vacío.' };
    }

    if (input.presentation !== undefined && !input.presentation.trim()) {
      return { success: false, error: 'La presentación comercial no puede quedar vacía.' };
    }

    if (input.stockMinimum !== undefined) {
      const minStock = Number(input.stockMinimum);
      if (!Number.isInteger(minStock) || minStock <= 0) {
        return { success: false, error: 'El stock mínimo debe ser un número entero mayor a 0.' };
      }
    }

    const updated = await service.updateProduct(input.productId, {
      name: input.name !== undefined ? input.name.trim() : undefined,
      presentation: input.presentation !== undefined ? input.presentation.trim() : undefined,
      stockMinimum: input.stockMinimum !== undefined ? Number(input.stockMinimum) : undefined,
      active: input.active,
    });

    revalidatePath('/stock');

    return {
      success: true,
      data: { productId: updated.productId },
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al actualizar el Producto Final.';
    return { success: false, error: message };
  }
}

export async function toggleFinalProductActiveAction(
  productId: string,
  active: boolean
): Promise<ActionResult<{ id: string; active: boolean }>> {
  try {
    await requireAuthenticatedUser();
    const service = getProductService();

    const updated = await service.setProductActive(productId, active);
    revalidatePath('/stock');

    return {
      success: true,
      data: { id: updated.productId, active: updated.active },
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al modificar estado del Producto Final.';
    return { success: false, error: message };
  }
}
