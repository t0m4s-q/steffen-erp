// Domain Types conforming to DATA_MODEL.md & BUSINESS_RULES.md

export type UUID = string;

export type ItemType = 'MPR' | 'COM' | 'PRO';
export type UnitType = 'KG' | 'UNIT';
export type CurrencyCode = 'ARS' | 'USD';
export type OperationType =
  | 'BULK_PRODUCTION'
  | 'PACKAGING'
  | 'PURCHASE'
  | 'SALE_RTO'
  | 'SALE_RTM'
  | 'CUSTOMER_PAYMENT'
  | 'SUPPLIER_PAYMENT'
  | 'OPERATING_EXPENSE'
  | 'WITHDRAWAL'
  | 'MARKETPLACE_SETTLEMENT'
  | 'STOCK_ADJUSTMENT';

export type StockMovementType = 'VENTA' | 'COMPRA' | 'ENVASADO' | 'FABRICACIÓN' | 'AJUSTE';
export type FactoryMovementType = 'FABRICACIÓN' | 'ENVASADO' | 'MERMA' | 'SOBRANTE';
export type PatrimonialMovementType =
  | 'RETIRO'
  | 'COMPRA'
  | 'PAGO_PROVEEDOR'
  | 'PAGO_CLIENTE'
  | 'TRANSPORTE'
  | 'VENTA'
  | 'GASTO_OPERATIVO'
  | 'TRANSFERENCIA_MERCADO_LIBRE';

export type AccountType =
  | 'CASH_STEFFEN'
  | 'CASH_MERCADO_LIBRE'
  | 'CUSTOMER_RECEIVABLE'
  | 'SUPPLIER_PAYABLE';

export type OrderStatus = 'OPEN' | 'CONVERTED' | 'CANCELLED';
export type CustomerSource = 'REGISTERED_CUSTOMER' | 'MERCADO_LIBRE' | 'CONSUMER_FINAL';
export type RemittanceStatus = 'RTM_PENDING' | 'COMPLETED';
export type BulkLotStatus = 'OPEN' | 'CLOSED';
export type PaymentMode = 'PAID' | 'DEBT';
export type SystemRole = 'SALON_DEFAULT' | 'PUBLIC_DEFAULT' | 'ECOMMERCE_DEFAULT' | null;
export type ExpenseType = 'LUZ' | 'ALQUILER' | 'COMISIÓN' | 'OTRO';
export type DocumentGenerationStatus = 'PENDING' | 'READY' | 'FAILED';
export type DocumentType =
  | 'RTO'
  | 'RTM'
  | 'CUSTOMER_ACCOUNT_STATEMENT'
  | 'SUPPLIER_ACCOUNT_STATEMENT';

// Tables

export interface CodeSequence {
  prefix: string; // COM, MPR, PBA, PRO, GRA, ENV, CLI, PRV, PED, CMP, RTO, RTM, MFA, MST, MOV
  last_value: number;
  updated_at: string;
}

export interface BusinessOperation {
  id: UUID;
  operation_type: OperationType;
  business_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: UUID;
  currency_code: CurrencyCode;
  rate_to_ars: number;
  effective_at: string;
  is_current: boolean;
  created_at: string;
}

export interface Customer {
  id: UUID;
  code: string; // CLIxxxx
  created_date: string;
  name: string;
  dni?: string;
  address?: string;
  locality?: string;
  province?: string;
  phone?: string;
  transport_name?: string;
  transport_address?: string;
  category?: string;
  discount_1_pct?: number;
  discount_2_pct?: number;
  discount_3_pct?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: UUID;
  code: string; // PRVxxxx
  created_date: string;
  name: string;
  salesperson?: string;
  phone?: string;
  currency_code: CurrencyCode; // Inmutable tras creación
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockItem {
  id: UUID;
  code: string; // MPRxxxx, COMxxxx, PROxxxx
  item_type: ItemType;
  name: string;
  unit_type: UnitType;
  stock_minimum: number; // > 0
  active: boolean;
  created_date: string;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  stock_item_id: UUID;
  inci?: string;
}

export interface Component {
  stock_item_id: UUID;
}

export interface BaseProduct {
  id: UUID;
  code: string; // PBAxxxx
  name: string;
  active: boolean;
  created_date: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  stock_item_id: UUID;
  base_product_id: UUID;
  presentation: string; // Comercial: 350 cc, etc.
  weight_kg: number; // > 0, resolución 0.001
  extra_variable_pct: number; // Fijo 2.0 en el MVP
  created_at: string;
}

export interface ProductComponent {
  product_id: UUID;
  component_id: UUID;
  quantity_per_unit: number; // Entero > 0
  sort_order: number;
}

export interface FormulaVersion {
  id: UUID;
  base_product_id: UUID;
  version_number: number;
  business_date: string;
  observations?: string;
  is_current: boolean;
  created_at: string;
}

export interface FormulaVersionItem {
  id: UUID;
  formula_version_id: UUID;
  raw_material_id: UUID;
  quantity_kg: number; // > 0, 3 decimales
  sort_order: number;
}

export interface SupplierItem {
  id: UUID;
  supplier_id: UUID;
  stock_item_id: UUID;
  quoted_unit_price_net: number; // Moneda del proveedor
  price_updated_at: string; // Determinante del costo teórico
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockBalance {
  stock_item_id: UUID;
  quantity: number; // 3 decimales para MPR, enteros para COM/PRO
  updated_at: string;
}

export interface StockMovement {
  id: UUID;
  code: string; // MSTxxxx
  operation_id: UUID;
  stock_item_id: UUID;
  movement_type: StockMovementType;
  quantity_delta: number;
  description: string;
  created_at: string;
}

export interface StockAdjustment {
  id: UUID;
  operation_id: UUID;
  reason: string;
  created_at: string;
}

export interface StockAdjustmentItem {
  id: UUID;
  adjustment_id: UUID;
  stock_item_id: UUID;
  quantity_delta: number;
  reason: string;
}

export interface BulkLot {
  id: UUID;
  code: string; // GRAxxxx
  operation_id: UUID;
  base_product_id: UUID;
  formula_version_id: UUID;
  kg_fabricated: number;
  kg_available: number;
  status: BulkLotStatus;
  observations?: string;
  total_cost_snapshot_ars: number;
  cost_per_kg_snapshot_ars: number;
  closed_at?: string;
  created_at: string;
}

export interface BulkLotMaterialSnapshot {
  id: UUID;
  bulk_lot_id: UUID;
  raw_material_id: UUID;
  quantity_kg: number;
  source_supplier_id?: UUID;
  source_currency: CurrencyCode;
  source_unit_price_net: number;
  fx_rate_snapshot?: number;
  vat_rate_pct: number;
  unit_cost_gross_ars_snapshot: number;
  total_cost_ars_snapshot: number;
}

export interface PackagingOperation {
  id: UUID;
  code: string; // ENVxxxx
  operation_id: UUID;
  bulk_lot_id: UUID;
  product_id: UUID;
  units_packaged: number;
  kg_available_before: number;
  kg_consumed: number;
  is_last_of_lot: boolean;
  variance_type: 'NONE' | 'MERMA' | 'SOBRANTE';
  variance_kg: number;
  base_cost_per_kg_snapshot_ars: number;
  unit_cost_snapshot_ars: number;
  total_cost_snapshot_ars: number;
  observations?: string;
  created_at: string;
}

export interface PackagingComponentSnapshot {
  id: UUID;
  packaging_operation_id: UUID;
  component_id: UUID;
  quantity_per_unit: number;
  quantity_total: number;
  unit_cost_gross_ars_snapshot: number;
  total_cost_ars_snapshot: number;
}

export interface FactoryMovement {
  id: UUID;
  code: string; // MFAxxxx
  operation_id: UUID;
  movement_type: FactoryMovementType;
  base_product_id?: UUID;
  bulk_lot_id?: UUID;
  quantity_kg?: number;
  description: string;
  created_at: string;
}

export interface Purchase {
  id: UUID;
  code: string; // CMPxxxx
  operation_id: UUID;
  supplier_id: UUID;
  payment_mode: PaymentMode;
  currency_code_snapshot: CurrencyCode;
  exchange_rate_used?: number;
  total_net_source_currency: number;
  total_gross_ars: number;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: UUID;
  purchase_id: UUID;
  stock_item_id: UUID;
  quantity: number;
  unit_price_net_source: number;
  vat_rate_pct: number;
  unit_price_gross_ars_snapshot: number;
  line_total_gross_ars: number;
  sort_order: number;
}

export interface PriceList {
  id: UUID;
  name: string;
  system_role: SystemRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPriceVersion {
  id: UUID;
  price_list_id: UUID;
  product_id: UUID;
  price_ars: number; // Entero sin centavos
  valid_from: string;
  valid_to?: string;
  created_at: string;
}

export interface DiscountProfile {
  id: UUID;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface DiscountProfileStep {
  id: UUID;
  discount_profile_id: UUID;
  position: number;
  percent: number;
}

export interface Order {
  id: UUID;
  code: string; // PEDxxxx
  business_date: string;
  status: OrderStatus;
  customer_source: CustomerSource;
  customer_id?: UUID;
  price_list_id: UUID;
  price_snapshot_at: string;
  recipient_name?: string;
  address?: string;
  locality?: string;
  province?: string;
  phone?: string;
  transport_name?: string;
  transport_address?: string;
  package_count?: number;
  planning_sort_key: number;
  converted_rto_id?: UUID;
  created_at: string;
  updated_at: string;
}

export interface OrderDiscountStep {
  id: UUID;
  order_id: UUID;
  position: number;
  percent: number;
}

export interface OrderItem {
  id: UUID;
  order_id: UUID;
  product_id: UUID;
  requested_quantity: number;
  ag_quantity?: number;
  unit_price_ars_snapshot: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlanningProductPriority {
  product_id: UUID;
  sort_key: number;
  updated_at: string;
}

export interface Remittance {
  id: UUID;
  code: string; // RTOxxxx
  operation_id: UUID;
  order_id: UUID;
  status: RemittanceStatus;
  customer_source: CustomerSource;
  customer_id?: UUID;
  recipient_name_snapshot?: string;
  address_snapshot?: string;
  locality_snapshot?: string;
  province_snapshot?: string;
  phone_snapshot?: string;
  transport_name_snapshot?: string;
  transport_address_snapshot?: string;
  package_count_snapshot?: number;
  weight_kg_snapshot: number;
  subtotal_ars: number;
  total_order_ars: number; // Monto real venta
  prior_balance_snapshot_ars: number;
  total_to_collect_ars: number;
  created_at: string;
}

export interface RemittanceDiscountStep {
  id: UUID;
  remittance_id: UUID;
  position: number;
  percent: number;
  amount_ars_snapshot: number;
}

export interface RemittanceItem {
  id: UUID;
  remittance_id: UUID;
  product_id: UUID;
  product_code_snapshot: string;
  product_name_snapshot: string;
  presentation_snapshot: string;
  weight_kg_snapshot: number;
  quantity_sent: number; // AG confirmado > 0
  unit_price_ars_snapshot: number;
  line_total_ars: number;
}

export interface MarginRemittance {
  id: UUID;
  code: string; // RTMxxxx
  operation_id: UUID;
  remittance_id: UUID;
  products_cost_total_ars: number;
  transport_cost_ars: number;
  gain_ars: number;
  created_at: string;
}

export interface MarginRemittanceItem {
  id: UUID;
  margin_remittance_id: UUID;
  product_id: UUID;
  quantity_sent: number;
  unit_cost_theoretical_snapshot_ars: number;
  total_cost_snapshot_ars: number;
}

export interface FinancialAccount {
  id: UUID;
  account_type: AccountType;
  name: string;
  customer_id?: UUID;
  supplier_id?: UUID;
  current_balance: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatrimonialMovement {
  id: UUID;
  code: string; // MOVxxxx
  operation_id: UUID;
  movement_type: PatrimonialMovementType;
  description: string;
  amount_ars: number;
  created_at: string;
}

export interface FinancialEntry {
  id: UUID;
  patrimonial_movement_id: UUID;
  financial_account_id: UUID;
  delta_ars: number; // Positivo o negativo
  created_at: string;
}

export interface Payment {
  id: UUID;
  operation_id: UUID;
  payment_type: 'CUSTOMER' | 'SUPPLIER';
  customer_id?: UUID;
  supplier_id?: UUID;
  amount_ars: number;
  created_at: string;
  updated_at: string;
}

export interface OperatingExpense {
  id: UUID;
  operation_id: UUID;
  expense_type: ExpenseType;
  description?: string;
  amount_ars: number;
  source_account_id: UUID;
  created_at: string;
}

export interface Withdrawal {
  id: UUID;
  operation_id: UUID;
  description: string;
  amount_ars: number;
  created_at: string;
}

export interface MarketplaceSettlement {
  id: UUID;
  operation_id: UUID;
  gross_amount_ars: number;
  net_amount_ars: number;
  commission_amount_ars: number;
  created_at: string;
}

export interface GeneratedDocument {
  id: UUID;
  document_type: DocumentType;
  source_type: string;
  source_id: UUID;
  renderer_type: 'INTERNAL_HTML_PDF' | 'N8N_WEBHOOK';
  template_key: string;
  template_version: string;
  payload_snapshot: any;
  generation_status: DocumentGenerationStatus;
  file_reference?: string;
  file_size_bytes?: number;
  error_message?: string;
  attempt_count: number;
  generated_at?: string;
  created_at: string;
}
