/**
 * Steffen ERP — Domain & Business Union Types
 * Fuente de verdad de tipos de dominio y estados de negocio.
 * Separados de los tipos generados de Supabase para respetar el esquema PostgreSQL.
 */

export type CurrencyCode = 'ARS' | 'USD';
export type StockItemType = 'MPR' | 'COM' | 'PRO';
export type UnitType = 'KG' | 'UNIT';
export type BulkLotStatus = 'OPEN' | 'CLOSED';
export type VarianceType = 'NONE' | 'MERMA' | 'SOBRANTE';
export type PurchasePaymentMode = 'PAID' | 'DEBT';
export type PriceListSystemRole = 'SALON_DEFAULT' | 'PUBLIC_DEFAULT' | 'ECOMMERCE_DEFAULT';
export type OrderStatus = 'OPEN' | 'CONVERTED' | 'CANCELLED';
export type CustomerSource = 'REGISTERED_CUSTOMER' | 'MERCADO_LIBRE' | 'CONSUMER_FINAL';
export type RemittanceStatus = 'RTM_PENDING' | 'COMPLETED';
export type AccountType = 'CASH_STEFFEN' | 'CASH_MERCADO_LIBRE' | 'CUSTOMER_RECEIVABLE' | 'SUPPLIER_PAYABLE';
export type StockMovementType = 'VENTA' | 'COMPRA' | 'ENVASADO' | 'FABRICACIÓN' | 'AJUSTE';
export type FactoryMovementType = 'FABRICACIÓN' | 'ENVASADO' | 'MERMA' | 'SOBRANTE';
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

export type PatrimonialMovementType =
  | 'RETIRO'
  | 'COMPRA'
  | 'PAGO_PROVEEDOR'
  | 'PAGO_CLIENTE'
  | 'TRANSPORTE'
  | 'VENTA'
  | 'GASTO_OPERATIVO'
  | 'TRANSFERENCIA_MERCADO_LIBRE';

export type PaymentType = 'CUSTOMER' | 'SUPPLIER';
export type ExpenseType = 'LUZ' | 'ALQUILER' | 'COMISIÓN' | 'OTRO';
export type DocumentType = 'RTO' | 'RTM' | 'CUSTOMER_ACCOUNT_STATEMENT' | 'SUPPLIER_ACCOUNT_STATEMENT';
export type RendererType = 'INTERNAL_HTML_PDF' | 'N8N_WEBHOOK';
export type GenerationStatus = 'PENDING' | 'READY' | 'FAILED';
