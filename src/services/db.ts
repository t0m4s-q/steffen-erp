// Transactional Database & Repository layer conforming to DATA_MODEL.md

import {
  UUID,
  CodeSequence,
  BusinessOperation,
  ExchangeRate,
  Customer,
  Supplier,
  StockItem,
  RawMaterial,
  Component,
  BaseProduct,
  Product,
  ProductComponent,
  FormulaVersion,
  FormulaVersionItem,
  SupplierItem,
  StockBalance,
  StockMovement,
  StockAdjustment,
  StockAdjustmentItem,
  BulkLot,
  BulkLotMaterialSnapshot,
  PackagingOperation,
  PackagingComponentSnapshot,
  FactoryMovement,
  Purchase,
  PurchaseItem,
  PriceList,
  ProductPriceVersion,
  DiscountProfile,
  DiscountProfileStep,
  Order,
  OrderDiscountStep,
  OrderItem,
  PlanningProductPriority,
  Remittance,
  RemittanceDiscountStep,
  RemittanceItem,
  MarginRemittance,
  MarginRemittanceItem,
  FinancialAccount,
  PatrimonialMovement,
  FinancialEntry,
  Payment,
  OperatingExpense,
  Withdrawal,
  MarketplaceSettlement,
  GeneratedDocument,
} from '../types/domain';

export interface DatabaseState {
  codeSequences: Record<string, CodeSequence>;
  businessOperations: Record<UUID, BusinessOperation>;
  exchangeRates: Record<UUID, ExchangeRate>;
  customers: Record<UUID, Customer>;
  suppliers: Record<UUID, Supplier>;
  stockItems: Record<UUID, StockItem>;
  rawMaterials: Record<UUID, RawMaterial>;
  components: Record<UUID, Component>;
  baseProducts: Record<UUID, BaseProduct>;
  products: Record<UUID, Product>;
  productComponents: ProductComponent[];
  formulaVersions: Record<UUID, FormulaVersion>;
  formulaVersionItems: Record<UUID, FormulaVersionItem>;
  supplierItems: Record<UUID, SupplierItem>;
  stockBalances: Record<UUID, StockBalance>;
  stockMovements: Record<UUID, StockMovement>;
  stockAdjustments: Record<UUID, StockAdjustment>;
  stockAdjustmentItems: Record<UUID, StockAdjustmentItem>;
  bulkLots: Record<UUID, BulkLot>;
  bulkLotMaterialSnapshots: Record<UUID, BulkLotMaterialSnapshot>;
  packagingOperations: Record<UUID, PackagingOperation>;
  packagingComponentSnapshots: Record<UUID, PackagingComponentSnapshot>;
  factoryMovements: Record<UUID, FactoryMovement>;
  purchases: Record<UUID, Purchase>;
  purchaseItems: Record<UUID, PurchaseItem>;
  priceLists: Record<UUID, PriceList>;
  productPriceVersions: Record<UUID, ProductPriceVersion>;
  discountProfiles: Record<UUID, DiscountProfile>;
  discountProfileSteps: Record<UUID, DiscountProfileStep>;
  orders: Record<UUID, Order>;
  orderDiscountSteps: Record<UUID, OrderDiscountStep>;
  orderItems: Record<UUID, OrderItem>;
  planningProductPriorities: Record<UUID, PlanningProductPriority>;
  remittances: Record<UUID, Remittance>;
  remittanceDiscountSteps: Record<UUID, RemittanceDiscountStep>;
  remittanceItems: Record<UUID, RemittanceItem>;
  marginRemittances: Record<UUID, MarginRemittance>;
  marginRemittanceItems: Record<UUID, MarginRemittanceItem>;
  financialAccounts: Record<UUID, FinancialAccount>;
  patrimonialMovements: Record<UUID, PatrimonialMovement>;
  financialEntries: Record<UUID, FinancialEntry>;
  payments: Record<UUID, Payment>;
  operatingExpenses: Record<UUID, OperatingExpense>;
  withdrawals: Record<UUID, Withdrawal>;
  marketplaceSettlements: Record<UUID, MarketplaceSettlement>;
  generatedDocuments: Record<UUID, GeneratedDocument>;
}

export function createEmptyState(): DatabaseState {
  return {
    codeSequences: {},
    businessOperations: {},
    exchangeRates: {},
    customers: {},
    suppliers: {},
    stockItems: {},
    rawMaterials: {},
    components: {},
    baseProducts: {},
    products: {},
    productComponents: [],
    formulaVersions: {},
    formulaVersionItems: {},
    supplierItems: {},
    stockBalances: {},
    stockMovements: {},
    stockAdjustments: {},
    stockAdjustmentItems: {},
    bulkLots: {},
    bulkLotMaterialSnapshots: {},
    packagingOperations: {},
    packagingComponentSnapshots: {},
    factoryMovements: {},
    purchases: {},
    purchaseItems: {},
    priceLists: {},
    productPriceVersions: {},
    discountProfiles: {},
    discountProfileSteps: {},
    orders: {},
    orderDiscountSteps: {},
    orderItems: {},
    planningProductPriorities: {},
    remittances: {},
    remittanceDiscountSteps: {},
    remittanceItems: {},
    marginRemittances: {},
    marginRemittanceItems: {},
    financialAccounts: {},
    patrimonialMovements: {},
    financialEntries: {},
    payments: {},
    operatingExpenses: {},
    withdrawals: {},
    marketplaceSettlements: {},
    generatedDocuments: {},
  };
}

const STORAGE_KEY = 'steffen_erp_db_v1';

class Database {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();
  private inTransaction = false;
  private transactionState: DatabaseState | null = null;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using fresh state', e);
    }
    return createEmptyState();
  }

  public save() {
    if (this.inTransaction) return; // Only save on commit
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not persist to localStorage', e);
    }
    this.notify();
  }

  public getState(): DatabaseState {
    return this.inTransaction && this.transactionState ? this.transactionState : this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public resetToEmpty() {
    this.state = createEmptyState();
    this.save();
  }

  // Atomic Transaction with rollback guarantee
  public transaction<T>(fn: (state: DatabaseState) => T): T {
    if (this.inTransaction) {
      return fn(this.transactionState!);
    }

    this.inTransaction = true;
    this.transactionState = JSON.parse(JSON.stringify(this.state));

    try {
      const result = fn(this.transactionState!);
      this.state = this.transactionState!;
      this.inTransaction = false;
      this.transactionState = null;
      this.save();
      return result;
    } catch (error) {
      this.inTransaction = false;
      this.transactionState = null;
      console.error('Transaction rollback due to error:', error);
      throw error;
    }
  }

  // Sequence generator conforming to DATA_MODEL.md Section 4 (code_sequences, LPAD 4 min)
  public nextCode(prefix: string): string {
    const state = this.getState();
    const now = new Date().toISOString();
    let seq = state.codeSequences[prefix];
    if (!seq) {
      seq = { prefix, last_value: 0, updated_at: now };
      state.codeSequences[prefix] = seq;
    }
    seq.last_value += 1;
    seq.updated_at = now;
    const numStr = String(seq.last_value).padStart(4, '0');
    return `${prefix}${numStr}`;
  }

  // ID generator
  public generateUUID(): UUID {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const db = new Database();
