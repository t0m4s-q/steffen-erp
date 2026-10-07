'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/auth/guard';
import { getMasterItemService, getSupplierService } from '@/services/composition';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';
import {
  type RawMaterialDTO,
  type ComponentDTO,
  type ActionResult,
} from './master-item.dto';

export type { RawMaterialDTO, ComponentDTO, ActionResult };

export async function createRawMaterialAction(formData: {
  name: string;
  inci?: string | null;
  stockMinimumKg: string;
  initialStockKg?: string | null;
  initialSupplierId: string;
  initialQuotedPriceNet: string;
}): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const service = getMasterItemService();

    if (!formData.name || !formData.name.trim()) {
      return { success: false, error: 'El nombre de la Materia Prima es obligatorio.' };
    }

    if (!formData.initialSupplierId) {
      return { success: false, error: 'El proveedor inicial es obligatorio.' };
    }

    const minStock = new Decimal(formData.stockMinimumKg);
    if (minStock.lessThanOrEqualTo(0)) {
      return { success: false, error: 'El stock mínimo debe ser estrictamente mayor a 0 kg.' };
    }

    const initialPrice = new Decimal(formData.initialQuotedPriceNet);
    if (initialPrice.lessThanOrEqualTo(0)) {
      return { success: false, error: 'El precio cotizado inicial debe ser mayor a cero.' };
    }

    const initialStock = formData.initialStockKg && formData.initialStockKg.trim() !== ''
      ? new Decimal(formData.initialStockKg)
      : new Decimal(0);

    if (initialStock.lessThan(0)) {
      return { success: false, error: 'El stock inicial no puede ser negativo.' };
    }

    await service.createRawMaterial({
      name: formData.name.trim(),
      inci: formData.inci ? formData.inci.trim() : null,
      stockMinimum: minStock,
      initialStock,
      initialSupplierId: formData.initialSupplierId,
      initialQuotedPriceNet: initialPrice,
    });

    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al crear materia prima';
    return { success: false, error: message };
  }
}

export async function updateRawMaterialMetadataAction(
  id: string,
  formData: {
    name?: string;
    inci?: string | null;
    stockMinimumKg?: string;
  }
): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const service = getMasterItemService();

    if (formData.name !== undefined && !formData.name.trim()) {
      return { success: false, error: 'El nombre de la materia prima no puede estar vacío.' };
    }

    let minStock: Decimal | undefined = undefined;
    if (formData.stockMinimumKg !== undefined) {
      minStock = new Decimal(formData.stockMinimumKg);
      if (minStock.lessThanOrEqualTo(0)) {
        return { success: false, error: 'El stock mínimo debe ser estrictamente mayor a 0 kg.' };
      }
    }

    await service.updateMasterItem(id, {
      name: formData.name !== undefined ? formData.name.trim() : undefined,
      inci: formData.inci !== undefined ? (formData.inci?.trim() || null) : undefined,
      stockMinimum: minStock,
    });

    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al actualizar ficha de materia prima';
    return { success: false, error: message };
  }
}

export async function updateRawMaterialSupplierQuoteAction(
  stockItemId: string,
  formData: {
    supplierId: string;
    quotedPriceNet: string;
  }
): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const supplierService = getSupplierService();

    if (!formData.supplierId) {
      return { success: false, error: 'Debe seleccionar un proveedor para cotizar.' };
    }

    const price = new Decimal(formData.quotedPriceNet);
    if (price.lessThanOrEqualTo(0)) {
      return { success: false, error: 'El precio cotizado del insumo debe ser mayor a cero.' };
    }

    await supplierService.setSupplierItemPrice(formData.supplierId, stockItemId, price);

    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al actualizar cotización de proveedor';
    return { success: false, error: message };
  }
}

export async function toggleRawMaterialActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const service = getMasterItemService();

    await service.setMasterItemActiveStatus(id, active);
    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al modificar estado de la materia prima';
    return { success: false, error: message };
  }
}

export async function createComponentAction(formData: {
  name: string;
  stockMinimumUnits: number | string;
  initialStockUnits?: number | string | null;
  initialSupplierId: string;
  initialQuotedPriceNet: string;
}): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const service = getMasterItemService();

    if (!formData.name || !formData.name.trim()) {
      return { success: false, error: 'El nombre del Componente es obligatorio.' };
    }

    if (!formData.initialSupplierId) {
      return { success: false, error: 'El proveedor inicial es obligatorio.' };
    }

    const minStock = new Decimal(formData.stockMinimumUnits);
    if (minStock.lessThanOrEqualTo(0) || !minStock.isInteger()) {
      return {
        success: false,
        error: 'El stock mínimo de un Componente debe ser un número entero mayor a 0 unidades.',
      };
    }

    const initialPrice = new Decimal(formData.initialQuotedPriceNet);
    if (initialPrice.lessThanOrEqualTo(0)) {
      return { success: false, error: 'El precio cotizado inicial debe ser mayor a cero.' };
    }

    let initialStock = new Decimal(0);
    if (
      formData.initialStockUnits !== undefined &&
      formData.initialStockUnits !== null &&
      `${formData.initialStockUnits}`.trim() !== ''
    ) {
      initialStock = new Decimal(formData.initialStockUnits);
      if (initialStock.lessThan(0)) {
        return { success: false, error: 'El stock inicial no puede ser negativo.' };
      }
      if (initialStock.greaterThan(0) && !initialStock.isInteger()) {
        return {
          success: false,
          error: 'El stock inicial de un Componente debe ser un número entero de unidades.',
        };
      }
    }

    await service.createComponent({
      name: formData.name.trim(),
      stockMinimum: minStock.toNumber(),
      initialStock: initialStock.toNumber(),
      initialSupplierId: formData.initialSupplierId,
      initialQuotedPriceNet: initialPrice,
    });

    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof DomainError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Error al crear componente';
    return { success: false, error: message };
  }
}

export async function updateComponentMetadataAction(
  id: string,
  formData: {
    name?: string;
    stockMinimumUnits?: number | string;
  }
): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const service = getMasterItemService();

    if (formData.name !== undefined && !formData.name.trim()) {
      return { success: false, error: 'El nombre del componente no puede estar vacío.' };
    }

    let minStock: Decimal | undefined = undefined;
    if (formData.stockMinimumUnits !== undefined) {
      minStock = new Decimal(formData.stockMinimumUnits);
      if (minStock.lessThanOrEqualTo(0) || !minStock.isInteger()) {
        return {
          success: false,
          error: 'El stock mínimo de un Componente debe ser un número entero mayor a 0 unidades.',
        };
      }
    }

    await service.updateMasterItem(id, {
      name: formData.name !== undefined ? formData.name.trim() : undefined,
      stockMinimum: minStock,
    });

    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof DomainError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Error al actualizar ficha de componente';
    return { success: false, error: message };
  }
}

export async function updateComponentSupplierQuoteAction(
  stockItemId: string,
  formData: {
    supplierId: string;
    quotedPriceNet: string;
  }
): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const supplierService = getSupplierService();

    if (!formData.supplierId) {
      return { success: false, error: 'Debe seleccionar un proveedor para cotizar.' };
    }

    const price = new Decimal(formData.quotedPriceNet);
    if (price.lessThanOrEqualTo(0)) {
      return { success: false, error: 'El precio cotizado del insumo debe ser mayor a cero.' };
    }

    await supplierService.setSupplierItemPrice(formData.supplierId, stockItemId, price);

    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof DomainError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Error al actualizar cotización de proveedor para componente';
    return { success: false, error: message };
  }
}

export async function toggleComponentActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult<void>> {
  try {
    await requireAuthenticatedUser();
    const service = getMasterItemService();

    await service.setMasterItemActiveStatus(id, active);
    revalidatePath('/stock');
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof DomainError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Error al modificar estado del componente';
    return { success: false, error: message };
  }
}
