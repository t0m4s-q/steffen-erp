import { Decimal } from '@/domain/decimal';

export interface AdminCustomerRowDTO {
  id: string;
  name: string;
  balanceArs: string;
  lastPaymentDate: string | null;
  lastPurchaseDate: string | null;
}

export interface AdminSupplierRowDTO {
  id: string;
  name: string;
  balanceArs: string;
  lastPaymentDate: string | null;
  lastPurchaseDate: string | null;
}

export interface AdminPatrimonialMovementRowDTO {
  id: string;
  code: string;
  date: string;
  type: string;
  description: string;
  amountArs: string;
  patrimonialVariation: string;
}

export interface AdministracionDashboardDTO {
  currentUsdRate: string | null;
  cajaSteffenArs: string;
  deudasClientesArs: string;
  deudasProveedoresArs: string;
  netoArs: string;
  customerRows: AdminCustomerRowDTO[];
  supplierRows: AdminSupplierRowDTO[];
  recentMovements: AdminPatrimonialMovementRowDTO[];
}

export function formatArsInteger(value: Decimal | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '$ 0';
  }
  const d = value instanceof Decimal ? value : new Decimal(value);
  const rounded = d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const isNeg = rounded.isNegative();
  const absStr = rounded.abs().toFixed(0);
  const formatted = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNeg ? `-$ ${formatted}` : `$ ${formatted}`;
}
