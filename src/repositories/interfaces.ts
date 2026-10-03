import type {
  CustomerDomain,
  SupplierDomain,
  StockItemDomain,
  StockBalanceDomain,
  StockMovementDomain,
  FinancialAccountDomain,
} from '@/domain/models';

export interface IStockRepository {
  getBalance(stockItemId: string): Promise<number>;
  getMovementHistory(stockItemId: string): Promise<StockMovementDomain[]>;
}

export interface ICustomerRepository {
  findById(id: string): Promise<CustomerDomain | null>;
  findByCode(code: string): Promise<CustomerDomain | null>;
  listActive(): Promise<CustomerDomain[]>;
}

export interface ISupplierRepository {
  findById(id: string): Promise<SupplierDomain | null>;
  findByCode(code: string): Promise<SupplierDomain | null>;
  listActive(): Promise<SupplierDomain[]>;
}

export interface IPatrimonyRepository {
  getAccountBalance(accountId: string): Promise<number>;
  getAccountByType(accountType: string): Promise<FinancialAccountDomain | null>;
}
