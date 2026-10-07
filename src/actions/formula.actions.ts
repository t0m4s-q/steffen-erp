'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/auth/guard';
import { getFormulaService } from '@/services/composition';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';
import {
  type BaseProductDTO,
  type FormulaVersionDTO,
  type ActionResult,
  serializeBaseProduct,
  serializeFormulaVersion,
} from './formula.dto';

export type { BaseProductDTO, FormulaVersionDTO, ActionResult };

export interface CreateBaseProductWithFormulaInput {
  name: string;
  items: Array<{
    rawMaterialId: string;
    quantityKg: string;
    sortOrder?: number;
  }>;
  observations?: string | null;
  businessDate?: string | null;
}

export interface CreateNewFormulaVersionInput {
  baseProductId: string;
  items: Array<{
    rawMaterialId: string;
    quantityKg: string;
    sortOrder?: number;
  }>;
  observations?: string | null;
  businessDate?: string | null;
}

export async function createBaseProductWithFormulaAction(
  input: CreateBaseProductWithFormulaInput
): Promise<ActionResult<BaseProductDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getFormulaService();

    if (!input.name || !input.name.trim()) {
      return { success: false, error: 'El nombre del Producto Base es obligatorio.' };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'La fórmula debe contener al menos una Materia Prima.' };
    }

    // Validar formato y números en input antes de invocar dominio
    for (const it of input.items) {
      if (!it.rawMaterialId) {
        return { success: false, error: 'Todas las filas deben tener una Materia Prima seleccionada.' };
      }
      try {
        const qty = new Decimal(it.quantityKg);
        if (qty.lte(0)) {
          return { success: false, error: 'Las cantidades en kg deben ser mayores a cero.' };
        }
        const str = toNumericString(qty);
        const parts = str.split('.');
        if (parts.length > 1 && parts[1].length > 3) {
          return { success: false, error: 'Las cantidades en kg no pueden tener más de 3 decimales.' };
        }
      } catch {
        return { success: false, error: `Cantidad en kg inválida: "${it.quantityKg}".` };
      }
    }

    const created = await service.createFormulaAndBaseProduct({
      name: input.name.trim(),
      items: input.items.map((it, idx) => ({
        rawMaterialId: it.rawMaterialId,
        quantityKg: new Decimal(it.quantityKg),
        sortOrder: it.sortOrder ?? idx + 1,
      })),
      observations: input.observations ? input.observations.trim() : null,
      createdDate: input.businessDate || undefined,
    });

    revalidatePath('/formulas');

    const pbaWithCost = {
      ...created.baseProduct,
      currentVersionNumber: created.formulaVersion.versionNumber,
      currentFormulaBreakdown: created.costBreakdown,
    };

    return {
      success: true,
      data: serializeBaseProduct(pbaWithCost, created.formulaVersion.id),
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al crear el Producto Base con fórmula.';
    return { success: false, error: message };
  }
}

export async function createNewFormulaVersionAction(
  input: CreateNewFormulaVersionInput
): Promise<ActionResult<FormulaVersionDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getFormulaService();

    if (!input.baseProductId) {
      return { success: false, error: 'El Producto Base es obligatorio.' };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'La nueva versión de fórmula debe contener al menos una Materia Prima.' };
    }

    for (const it of input.items) {
      if (!it.rawMaterialId) {
        return { success: false, error: 'Todas las filas deben tener una Materia Prima seleccionada.' };
      }
      try {
        const qty = new Decimal(it.quantityKg);
        if (qty.lte(0)) {
          return { success: false, error: 'Las cantidades en kg deben ser mayores a cero.' };
        }
        const str = toNumericString(qty);
        const parts = str.split('.');
        if (parts.length > 1 && parts[1].length > 3) {
          return { success: false, error: 'Las cantidades en kg no pueden tener más de 3 decimales.' };
        }
      } catch {
        return { success: false, error: `Cantidad en kg inválida: "${it.quantityKg}".` };
      }
    }

    const created = await service.createNewFormulaVersion({
      baseProductId: input.baseProductId,
      items: input.items.map((it, idx) => ({
        rawMaterialId: it.rawMaterialId,
        quantityKg: new Decimal(it.quantityKg),
        sortOrder: it.sortOrder ?? idx + 1,
      })),
      observations: input.observations ? input.observations.trim() : null,
      businessDate: input.businessDate || undefined,
    });

    revalidatePath('/formulas');

    return {
      success: true,
      data: serializeFormulaVersion(created.formulaVersion, created.costBreakdown),
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al crear la nueva versión de fórmula.';
    return { success: false, error: message };
  }
}

export async function toggleBaseProductActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult<{ id: string; active: boolean }>> {
  try {
    await requireAuthenticatedUser();
    const service = getFormulaService();

    const updated = await service.setBaseProductActiveStatus(id, active);
    revalidatePath('/formulas');

    return {
      success: true,
      data: { id: updated.id, active: updated.active },
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al actualizar el estado del Producto Base.';
    return { success: false, error: message };
  }
}

export async function getBaseProductVersionsAction(
  baseProductId: string
): Promise<ActionResult<FormulaVersionDTO[]>> {
  try {
    await requireAuthenticatedUser();
    const service = getFormulaService();

    const details = await service.getBaseProductDetails(baseProductId);
    if (!details) {
      return { success: false, error: 'Producto Base no encontrado.' };
    }

    const versionsDto = details.versions.map((v) =>
      serializeFormulaVersion(v.version, v.costBreakdown)
    );

    return {
      success: true,
      data: versionsDto,
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Error inesperado al consultar versiones.';
    return { success: false, error: message };
  }
}
