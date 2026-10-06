import { toNumericString, Decimal } from '@/domain/decimal';
import type { SupplierRecord } from '@/repositories/supplier.repository';

export interface SupplierDTO {
  id: string;
  code: string;
  name: string;
  currencyCode: 'ARS' | 'USD';
  salesperson: string | null;
  phone: string | null;
  balance: string;
  active: boolean;
  createdDate: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeSupplier(s: SupplierRecord): SupplierDTO {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    currencyCode: s.currencyCode,
    salesperson: s.salesperson,
    phone: s.phone,
    balance: toNumericString(s.balance ?? new Decimal(0)),
    active: s.active,
    createdDate: s.createdDate,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
