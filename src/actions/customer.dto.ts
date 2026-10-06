import { toNumericString, Decimal } from '@/domain/decimal';
import type { CustomerRecord } from '@/repositories/customer.repository';

export interface CustomerDTO {
  id: string;
  code: string;
  name: string;
  dni: string | null;
  address: string | null;
  locality: string | null;
  province: string | null;
  phone: string | null;
  transportName: string | null;
  transportAddress: string | null;
  createdDate: string;
  category: string | null;
  discount1Pct: string;
  discount2Pct: string;
  discount3Pct: string;
  active: boolean;
  balanceArs: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeCustomer(c: CustomerRecord): CustomerDTO {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    dni: c.dni,
    address: c.address,
    locality: c.locality,
    province: c.province,
    phone: c.phone,
    transportName: c.transportName,
    transportAddress: c.transportAddress,
    createdDate: c.createdDate,
    category: c.category,
    discount1Pct: toNumericString(c.discount1Pct),
    discount2Pct: toNumericString(c.discount2Pct),
    discount3Pct: toNumericString(c.discount3Pct),
    active: c.active,
    balanceArs: toNumericString(c.balanceArs ?? new Decimal(0)),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
