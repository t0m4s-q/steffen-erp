'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/auth/guard';
import { getSupplierService } from '@/services/composition';
import { DomainError } from '@/domain/errors';
import { serializeSupplier, type SupplierDTO, type ActionResult } from './supplier.dto';

export type { SupplierDTO, ActionResult };

export async function createSupplierAction(formData: {
  name: string;
  currencyCode: 'ARS' | 'USD';
  salesperson?: string | null;
  phone?: string | null;
}): Promise<ActionResult<SupplierDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getSupplierService();

    if (!formData.name || !formData.name.trim()) {
      return { success: false, error: 'El nombre o razón social del proveedor es obligatorio.' };
    }

    if (!formData.currencyCode || !['ARS', 'USD'].includes(formData.currencyCode)) {
      return { success: false, error: 'La moneda del proveedor es obligatoria y debe ser ARS o USD.' };
    }

    const result = await service.createSupplier({
      name: formData.name.trim(),
      currencyCode: formData.currencyCode,
      salesperson: formData.salesperson ? formData.salesperson.trim() : null,
      phone: formData.phone ? formData.phone.trim() : null,
    });

    revalidatePath('/proveedores');
    return { success: true, data: serializeSupplier(result) };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al crear proveedor';
    return { success: false, error: message };
  }
}

export async function updateSupplierAction(
  id: string,
  formData: {
    name?: string;
    salesperson?: string | null;
    phone?: string | null;
    active?: boolean;
  }
): Promise<ActionResult<SupplierDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getSupplierService();

    if (formData.name !== undefined && !formData.name.trim()) {
      return { success: false, error: 'El nombre del proveedor no puede estar vacío.' };
    }

    const result = await service.updateSupplier(id, {
      name: formData.name ? formData.name.trim() : undefined,
      salesperson: formData.salesperson !== undefined ? (formData.salesperson?.trim() || null) : undefined,
      phone: formData.phone !== undefined ? (formData.phone?.trim() || null) : undefined,
      active: formData.active,
    });

    revalidatePath('/proveedores');
    return { success: true, data: serializeSupplier(result) };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al actualizar proveedor';
    return { success: false, error: message };
  }
}

export async function toggleSupplierActiveAction(id: string, active: boolean): Promise<ActionResult<SupplierDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getSupplierService();

    const result = await service.setSupplierActiveStatus(id, active);
    revalidatePath('/proveedores');
    return { success: true, data: serializeSupplier(result) };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al modificar estado del proveedor';
    return { success: false, error: message };
  }
}
