'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/auth/guard';
import { getCustomerService } from '@/services/composition';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';
import { serializeCustomer, type CustomerDTO, type ActionResult } from './customer.dto';

export type { CustomerDTO, ActionResult };

export async function createCustomerAction(formData: {
  name: string;
  dni?: string | null;
  address?: string | null;
  locality?: string | null;
  province?: string | null;
  phone?: string | null;
  transportName?: string | null;
  transportAddress?: string | null;
  category?: string | null;
  discount1Pct?: string | number;
  discount2Pct?: string | number;
  discount3Pct?: string | number;
}): Promise<ActionResult<CustomerDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getCustomerService();

    const result = await service.createCustomer({
      name: formData.name,
      dni: formData.dni || null,
      address: formData.address || null,
      locality: formData.locality || null,
      province: formData.province || null,
      phone: formData.phone || null,
      transportName: formData.transportName || null,
      transportAddress: formData.transportAddress || null,
      category: formData.category || null,
      discount1Pct: formData.discount1Pct !== undefined && formData.discount1Pct !== '' ? new Decimal(formData.discount1Pct) : 0,
      discount2Pct: formData.discount2Pct !== undefined && formData.discount2Pct !== '' ? new Decimal(formData.discount2Pct) : 0,
      discount3Pct: formData.discount3Pct !== undefined && formData.discount3Pct !== '' ? new Decimal(formData.discount3Pct) : 0,
    });

    revalidatePath('/clientes');
    return { success: true, data: serializeCustomer(result) };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al crear cliente';
    return { success: false, error: message };
  }
}

export async function updateCustomerAction(
  id: string,
  formData: {
    name?: string;
    dni?: string | null;
    address?: string | null;
    locality?: string | null;
    province?: string | null;
    phone?: string | null;
    transportName?: string | null;
    transportAddress?: string | null;
    category?: string | null;
    discount1Pct?: string | number;
    discount2Pct?: string | number;
    discount3Pct?: string | number;
    active?: boolean;
  }
): Promise<ActionResult<CustomerDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getCustomerService();

    const result = await service.updateCustomer(id, {
      name: formData.name,
      dni: formData.dni,
      address: formData.address,
      locality: formData.locality,
      province: formData.province,
      phone: formData.phone,
      transportName: formData.transportName,
      transportAddress: formData.transportAddress,
      category: formData.category,
      discount1Pct: formData.discount1Pct !== undefined && formData.discount1Pct !== '' ? new Decimal(formData.discount1Pct) : undefined,
      discount2Pct: formData.discount2Pct !== undefined && formData.discount2Pct !== '' ? new Decimal(formData.discount2Pct) : undefined,
      discount3Pct: formData.discount3Pct !== undefined && formData.discount3Pct !== '' ? new Decimal(formData.discount3Pct) : undefined,
      active: formData.active,
    });

    revalidatePath('/clientes');
    return { success: true, data: serializeCustomer(result) };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al actualizar cliente';
    return { success: false, error: message };
  }
}

export async function toggleCustomerActiveAction(id: string, active: boolean): Promise<ActionResult<CustomerDTO>> {
  try {
    await requireAuthenticatedUser();
    const service = getCustomerService();

    const result = await service.setCustomerActiveStatus(id, active);
    revalidatePath('/clientes');
    return { success: true, data: serializeCustomer(result) };
  } catch (err: unknown) {
    const message = err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Error al modificar estado del cliente';
    return { success: false, error: message };
  }
}
