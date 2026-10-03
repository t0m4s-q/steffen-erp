import type {
  CurrencyCode,
  StockItemType,
  UnitType,
  BulkLotStatus,
  VarianceType,
  PurchasePaymentMode,
  PriceListSystemRole,
  OrderStatus,
  CustomerSource,
  RemittanceStatus,
  AccountType,
  StockMovementType,
  FactoryMovementType,
  PatrimonialMovementType,
  PaymentType,
  ExpenseType,
} from '@/database/types';

export interface CustomerDomain {
  id: string;
  code: string;
  name: string;
  dni?: string | null;
  address?: string | null;
  locality?: string | null;
  province?: string | null;
  phone?: string | null;
  transportName?: string | null;
  transportAddress?: string | null;
  category?: string | null;
  discount1Pct?: number | null;
  discount2Pct?: number | null;
  discount3Pct?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDomain {
  id: string;
  code: string;
  name: string;
  salesperson?: string | null;
  phone?: string | null;
  currencyCode: CurrencyCode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItemDomain {
  id: string;
  code: string;
  itemType: StockItemType;
  name: string;
  unitType: UnitType;
  stockMinimum: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDomain extends StockItemDomain {
  baseProductId: string;
  presentation: string;
  weightKg: number;
  extraVariablePct: number;
}

export interface BaseProductDomain {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormulaVersionDomain {
  id: string;
  baseProductId: string;
  versionNumber: number;
  businessDate: string;
  observations?: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface StockBalanceDomain {
  stockItemId: string;
  quantity: number;
  updatedAt: string;
}

export interface StockMovementDomain {
  id: string;
  code: string;
  operationId: string;
  stockItemId: string;
  movementType: StockMovementType;
  quantityDelta: number;
  description: string;
  createdAt: string;
}

export interface FinancialAccountDomain {
  id: string;
  accountType: AccountType;
  name: string;
  customerId?: string | null;
  supplierId?: string | null;
  currentBalance: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
