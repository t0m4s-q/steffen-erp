/**
-- ============================================================================
-- Steffen ERP — Database Types (Supabase / PostgreSQL)
-- Fuente de verdad: DATA_MODEL.md
-- ============================================================================
*/

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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

export interface Database {
  public: {
    Tables: {
      code_sequences: {
        Row: {
          prefix: string;
          last_value: number;
          updated_at: string;
        };
        Insert: {
          prefix: string;
          last_value?: number;
          updated_at?: string;
        };
        Update: {
          prefix?: string;
          last_value?: number;
          updated_at?: string;
        };
      };
      business_operations: {
        Row: {
          id: string;
          operation_type: OperationType;
          business_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operation_type: OperationType;
          business_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          operation_type?: OperationType;
          business_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      exchange_rates: {
        Row: {
          id: string;
          currency_code: CurrencyCode;
          rate_to_ars: number;
          effective_at: string;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          currency_code: CurrencyCode;
          rate_to_ars: number;
          effective_at?: string;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          currency_code?: CurrencyCode;
          rate_to_ars?: number;
          effective_at?: string;
          is_current?: boolean;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          code: string;
          created_date: string;
          name: string;
          dni: string | null;
          address: string | null;
          locality: string | null;
          province: string | null;
          phone: string | null;
          transport_name: string | null;
          transport_address: string | null;
          category: string | null;
          discount_1_pct: number | null;
          discount_2_pct: number | null;
          discount_3_pct: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          created_date?: string;
          name: string;
          dni?: string | null;
          address?: string | null;
          locality?: string | null;
          province?: string | null;
          phone?: string | null;
          transport_name?: string | null;
          transport_address?: string | null;
          category?: string | null;
          discount_1_pct?: number | null;
          discount_2_pct?: number | null;
          discount_3_pct?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          created_date?: string;
          name?: string;
          dni?: string | null;
          address?: string | null;
          locality?: string | null;
          province?: string | null;
          phone?: string | null;
          transport_name?: string | null;
          transport_address?: string | null;
          category?: string | null;
          discount_1_pct?: number | null;
          discount_2_pct?: number | null;
          discount_3_pct?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          code: string;
          created_date: string;
          name: string;
          salesperson: string | null;
          phone: string | null;
          currency_code: CurrencyCode;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          created_date?: string;
          name: string;
          salesperson?: string | null;
          phone?: string | null;
          currency_code: CurrencyCode;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          created_date?: string;
          name?: string;
          salesperson?: string | null;
          phone?: string | null;
          currency_code?: CurrencyCode;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      stock_items: {
        Row: {
          id: string;
          code: string;
          item_type: StockItemType;
          name: string;
          unit_type: UnitType;
          stock_minimum: number;
          active: boolean;
          created_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          item_type: StockItemType;
          name: string;
          unit_type: UnitType;
          stock_minimum: number;
          active?: boolean;
          created_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          item_type?: StockItemType;
          name?: string;
          unit_type?: UnitType;
          stock_minimum?: number;
          active?: boolean;
          created_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      raw_materials: {
        Row: {
          stock_item_id: string;
          inci: string | null;
        };
        Insert: {
          stock_item_id: string;
          inci?: string | null;
        };
        Update: {
          stock_item_id?: string;
          inci?: string | null;
        };
      };
      components: {
        Row: {
          stock_item_id: string;
        };
        Insert: {
          stock_item_id: string;
        };
        Update: {
          stock_item_id?: string;
        };
      };
      base_products: {
        Row: {
          id: string;
          code: string;
          name: string;
          active: boolean;
          created_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          active?: boolean;
          created_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          active?: boolean;
          created_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          stock_item_id: string;
          base_product_id: string;
          presentation: string;
          weight_kg: number;
          extra_variable_pct: number;
          created_at: string;
        };
        Insert: {
          stock_item_id: string;
          base_product_id: string;
          presentation: string;
          weight_kg: number;
          extra_variable_pct?: number;
          created_at?: string;
        };
        Update: {
          stock_item_id?: string;
          base_product_id?: string;
          presentation?: string;
          weight_kg?: number;
          extra_variable_pct?: number;
          created_at?: string;
        };
      };
      product_components: {
        Row: {
          product_id: string;
          component_id: string;
          quantity_per_unit: number;
          sort_order: number;
        };
        Insert: {
          product_id: string;
          component_id: string;
          quantity_per_unit: number;
          sort_order?: number;
        };
        Update: {
          product_id?: string;
          component_id?: string;
          quantity_per_unit?: number;
          sort_order?: number;
        };
      };
      formula_versions: {
        Row: {
          id: string;
          base_product_id: string;
          version_number: number;
          business_date: string;
          observations: string | null;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          base_product_id: string;
          version_number: number;
          business_date?: string;
          observations?: string | null;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          base_product_id?: string;
          version_number?: number;
          business_date?: string;
          observations?: string | null;
          is_current?: boolean;
          created_at?: string;
        };
      };
      formula_version_items: {
        Row: {
          id: string;
          formula_version_id: string;
          raw_material_id: string;
          quantity_kg: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          formula_version_id: string;
          raw_material_id: string;
          quantity_kg: number;
          sort_order?: number;
        };
        Update: {
          id?: string;
          formula_version_id?: string;
          raw_material_id?: string;
          quantity_kg?: number;
          sort_order?: number;
        };
      };
      supplier_items: {
        Row: {
          id: string;
          supplier_id: string;
          stock_item_id: string;
          quoted_unit_price_net: number;
          price_updated_at: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          stock_item_id: string;
          quoted_unit_price_net: number;
          price_updated_at?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          stock_item_id?: string;
          quoted_unit_price_net?: number;
          price_updated_at?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      stock_balances: {
        Row: {
          stock_item_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          stock_item_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          stock_item_id?: string;
          quantity?: number;
          updated_at?: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          stock_item_id: string;
          movement_type: StockMovementType;
          quantity_delta: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          stock_item_id: string;
          movement_type: StockMovementType;
          quantity_delta: number;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          stock_item_id?: string;
          movement_type?: StockMovementType;
          quantity_delta?: number;
          description?: string;
          created_at?: string;
        };
      };
      stock_adjustments: {
        Row: {
          id: string;
          operation_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          operation_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          operation_id?: string;
          reason?: string;
          created_at?: string;
        };
      };
      stock_adjustment_items: {
        Row: {
          id: string;
          adjustment_id: string;
          stock_item_id: string;
          quantity_delta: number;
          reason: string;
        };
        Insert: {
          id?: string;
          adjustment_id: string;
          stock_item_id: string;
          quantity_delta: number;
          reason: string;
        };
        Update: {
          id?: string;
          adjustment_id?: string;
          stock_item_id?: string;
          quantity_delta?: number;
          reason?: string;
        };
      };
      bulk_lots: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          base_product_id: string;
          formula_version_id: string;
          kg_fabricated: number;
          kg_available: number;
          status: BulkLotStatus;
          observations: string | null;
          total_cost_snapshot_ars: number;
          cost_per_kg_snapshot_ars: number;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          base_product_id: string;
          formula_version_id: string;
          kg_fabricated: number;
          kg_available: number;
          status: BulkLotStatus;
          observations?: string | null;
          total_cost_snapshot_ars?: number;
          cost_per_kg_snapshot_ars?: number;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          base_product_id?: string;
          formula_version_id?: string;
          kg_fabricated?: number;
          kg_available?: number;
          status?: BulkLotStatus;
          observations?: string | null;
          total_cost_snapshot_ars?: number;
          cost_per_kg_snapshot_ars?: number;
          closed_at?: string | null;
          created_at?: string;
        };
      };
      bulk_lot_material_snapshots: {
        Row: {
          id: string;
          bulk_lot_id: string;
          raw_material_id: string;
          quantity_kg: number;
          source_supplier_id: string | null;
          source_currency: string;
          source_unit_price_net: number;
          fx_rate_snapshot: number | null;
          vat_rate_pct: number;
          unit_cost_gross_ars_snapshot: number;
          total_cost_ars_snapshot: number;
        };
        Insert: {
          id?: string;
          bulk_lot_id: string;
          raw_material_id: string;
          quantity_kg: number;
          source_supplier_id?: string | null;
          source_currency: string;
          source_unit_price_net: number;
          fx_rate_snapshot?: number | null;
          vat_rate_pct?: number;
          unit_cost_gross_ars_snapshot: number;
          total_cost_ars_snapshot: number;
        };
        Update: {
          id?: string;
          bulk_lot_id?: string;
          raw_material_id?: string;
          quantity_kg?: number;
          source_supplier_id?: string | null;
          source_currency?: string;
          source_unit_price_net?: number;
          fx_rate_snapshot?: number | null;
          vat_rate_pct?: number;
          unit_cost_gross_ars_snapshot?: number;
          total_cost_ars_snapshot?: number;
        };
      };
      packaging_operations: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          bulk_lot_id: string;
          product_id: string;
          units_packaged: number;
          kg_available_before: number;
          kg_consumed: number;
          is_last_of_lot: boolean;
          variance_type: VarianceType;
          variance_kg: number;
          base_cost_per_kg_snapshot_ars: number;
          unit_cost_snapshot_ars: number;
          total_cost_snapshot_ars: number;
          observations: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          bulk_lot_id: string;
          product_id: string;
          units_packaged: number;
          kg_available_before: number;
          kg_consumed: number;
          is_last_of_lot?: boolean;
          variance_type: VarianceType;
          variance_kg?: number;
          base_cost_per_kg_snapshot_ars: number;
          unit_cost_snapshot_ars: number;
          total_cost_snapshot_ars: number;
          observations?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          bulk_lot_id?: string;
          product_id?: string;
          units_packaged?: number;
          kg_available_before?: number;
          kg_consumed?: number;
          is_last_of_lot?: boolean;
          variance_type?: VarianceType;
          variance_kg?: number;
          base_cost_per_kg_snapshot_ars?: number;
          unit_cost_snapshot_ars?: number;
          total_cost_snapshot_ars?: number;
          observations?: string | null;
          created_at?: string;
        };
      };
      packaging_component_snapshots: {
        Row: {
          id: string;
          packaging_operation_id: string;
          component_id: string;
          quantity_per_unit: number;
          quantity_total: number;
          unit_cost_gross_ars_snapshot: number;
          total_cost_ars_snapshot: number;
        };
        Insert: {
          id?: string;
          packaging_operation_id: string;
          component_id: string;
          quantity_per_unit: number;
          quantity_total: number;
          unit_cost_gross_ars_snapshot: number;
          total_cost_ars_snapshot: number;
        };
        Update: {
          id?: string;
          packaging_operation_id?: string;
          component_id?: string;
          quantity_per_unit?: number;
          quantity_total?: number;
          unit_cost_gross_ars_snapshot?: number;
          total_cost_ars_snapshot?: number;
        };
      };
      factory_movements: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          movement_type: FactoryMovementType;
          base_product_id: string | null;
          bulk_lot_id: string | null;
          quantity_kg: number | null;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          movement_type: FactoryMovementType;
          base_product_id?: string | null;
          bulk_lot_id?: string | null;
          quantity_kg?: number | null;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          movement_type?: FactoryMovementType;
          base_product_id?: string | null;
          bulk_lot_id?: string | null;
          quantity_kg?: number | null;
          description?: string;
          created_at?: string;
        };
      };
      purchases: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          supplier_id: string;
          payment_mode: PurchasePaymentMode;
          currency_code_snapshot: CurrencyCode;
          exchange_rate_used: number | null;
          total_net_source_currency: number;
          total_gross_ars: number;
          observations: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          supplier_id: string;
          payment_mode: PurchasePaymentMode;
          currency_code_snapshot: CurrencyCode;
          exchange_rate_used?: number | null;
          total_net_source_currency: number;
          total_gross_ars: number;
          observations?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          supplier_id?: string;
          payment_mode?: PurchasePaymentMode;
          currency_code_snapshot?: CurrencyCode;
          exchange_rate_used?: number | null;
          total_net_source_currency?: number;
          total_gross_ars?: number;
          observations?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          stock_item_id: string;
          quantity: number;
          unit_price_net_source: number;
          vat_rate_pct: number;
          unit_price_gross_ars_snapshot: number;
          line_total_gross_ars: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          stock_item_id: string;
          quantity: number;
          unit_price_net_source: number;
          vat_rate_pct?: number;
          unit_price_gross_ars_snapshot: number;
          line_total_gross_ars: number;
          sort_order?: number;
        };
        Update: {
          id?: string;
          purchase_id?: string;
          stock_item_id?: string;
          quantity?: number;
          unit_price_net_source?: number;
          vat_rate_pct?: number;
          unit_price_gross_ars_snapshot?: number;
          line_total_gross_ars?: number;
          sort_order?: number;
        };
      };
      price_lists: {
        Row: {
          id: string;
          name: string;
          system_role: PriceListSystemRole | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          system_role?: PriceListSystemRole | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          system_role?: PriceListSystemRole | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_price_versions: {
        Row: {
          id: string;
          price_list_id: string;
          product_id: string;
          price_ars: number;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          price_list_id: string;
          product_id: string;
          price_ars: number;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          price_list_id?: string;
          product_id?: string;
          price_ars?: number;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
        };
      };
      discount_profiles: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          sort_order?: number;
        };
      };
      discount_profile_steps: {
        Row: {
          id: string;
          discount_profile_id: string;
          position: number;
          percent: number;
        };
        Insert: {
          id?: string;
          discount_profile_id: string;
          position: number;
          percent: number;
        };
        Update: {
          id?: string;
          discount_profile_id?: string;
          position?: number;
          percent?: number;
        };
      };
      orders: {
        Row: {
          id: string;
          code: string;
          business_date: string;
          status: OrderStatus;
          customer_source: CustomerSource;
          customer_id: string | null;
          price_list_id: string;
          price_snapshot_at: string;
          recipient_name: string | null;
          address: string | null;
          locality: string | null;
          province: string | null;
          phone: string | null;
          transport_name: string | null;
          transport_address: string | null;
          package_count: number | null;
          planning_sort_key: number;
          converted_rto_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          business_date?: string;
          status: OrderStatus;
          customer_source: CustomerSource;
          customer_id?: string | null;
          price_list_id: string;
          price_snapshot_at?: string;
          recipient_name?: string | null;
          address?: string | null;
          locality?: string | null;
          province?: string | null;
          phone?: string | null;
          transport_name?: string | null;
          transport_address?: string | null;
          package_count?: number | null;
          planning_sort_key?: number;
          converted_rto_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          business_date?: string;
          status?: OrderStatus;
          customer_source?: CustomerSource;
          customer_id?: string | null;
          price_list_id?: string;
          price_snapshot_at?: string;
          recipient_name?: string | null;
          address?: string | null;
          locality?: string | null;
          province?: string | null;
          phone?: string | null;
          transport_name?: string | null;
          transport_address?: string | null;
          package_count?: number | null;
          planning_sort_key?: number;
          converted_rto_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_discount_steps: {
        Row: {
          id: string;
          order_id: string;
          position: number;
          percent: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          position: number;
          percent: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          position?: number;
          percent?: number;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          requested_quantity: number;
          ag_quantity: number | null;
          unit_price_ars_snapshot: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          requested_quantity: number;
          ag_quantity?: number | null;
          unit_price_ars_snapshot: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          requested_quantity?: number;
          ag_quantity?: number | null;
          unit_price_ars_snapshot?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      planning_product_priorities: {
        Row: {
          product_id: string;
          sort_key: number;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          sort_key?: number;
          updated_at?: string;
        };
        Update: {
          product_id?: string;
          sort_key?: number;
          updated_at?: string;
        };
      };
      remittances: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          order_id: string;
          status: RemittanceStatus;
          customer_source: CustomerSource;
          customer_id: string | null;
          recipient_name_snapshot: string | null;
          address_snapshot: string | null;
          locality_snapshot: string | null;
          province_snapshot: string | null;
          phone_snapshot: string | null;
          transport_name_snapshot: string | null;
          transport_address_snapshot: string | null;
          package_count_snapshot: number | null;
          weight_kg_snapshot: number;
          subtotal_ars: number;
          total_order_ars: number;
          prior_balance_snapshot_ars: number;
          total_to_collect_ars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          order_id: string;
          status: RemittanceStatus;
          customer_source: CustomerSource;
          customer_id?: string | null;
          recipient_name_snapshot?: string | null;
          address_snapshot?: string | null;
          locality_snapshot?: string | null;
          province_snapshot?: string | null;
          phone_snapshot?: string | null;
          transport_name_snapshot?: string | null;
          transport_address_snapshot?: string | null;
          package_count_snapshot?: number | null;
          weight_kg_snapshot: number;
          subtotal_ars: number;
          total_order_ars: number;
          prior_balance_snapshot_ars?: number;
          total_to_collect_ars: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          order_id?: string;
          status?: RemittanceStatus;
          customer_source?: CustomerSource;
          customer_id?: string | null;
          recipient_name_snapshot?: string | null;
          address_snapshot?: string | null;
          locality_snapshot?: string | null;
          province_snapshot?: string | null;
          phone_snapshot?: string | null;
          transport_name_snapshot?: string | null;
          transport_address_snapshot?: string | null;
          package_count_snapshot?: number | null;
          weight_kg_snapshot?: number;
          subtotal_ars?: number;
          total_order_ars?: number;
          prior_balance_snapshot_ars?: number;
          total_to_collect_ars?: number;
          created_at?: string;
        };
      };
      remittance_discount_steps: {
        Row: {
          id: string;
          remittance_id: string;
          position: number;
          percent: number;
          amount_ars_snapshot: number;
        };
        Insert: {
          id?: string;
          remittance_id: string;
          position: number;
          percent: number;
          amount_ars_snapshot: number;
        };
        Update: {
          id?: string;
          remittance_id?: string;
          position?: number;
          percent?: number;
          amount_ars_snapshot?: number;
        };
      };
      remittance_items: {
        Row: {
          id: string;
          remittance_id: string;
          product_id: string;
          product_code_snapshot: string;
          product_name_snapshot: string;
          presentation_snapshot: string;
          weight_kg_snapshot: number;
          quantity_sent: number;
          unit_price_ars_snapshot: number;
          line_total_ars: number;
        };
        Insert: {
          id?: string;
          remittance_id: string;
          product_id: string;
          product_code_snapshot: string;
          product_name_snapshot: string;
          presentation_snapshot: string;
          weight_kg_snapshot: number;
          quantity_sent: number;
          unit_price_ars_snapshot: number;
          line_total_ars: number;
        };
        Update: {
          id?: string;
          remittance_id?: string;
          product_id?: string;
          product_code_snapshot?: string;
          product_name_snapshot?: string;
          presentation_snapshot?: string;
          weight_kg_snapshot?: number;
          quantity_sent?: number;
          unit_price_ars_snapshot?: number;
          line_total_ars?: number;
        };
      };
      margin_remittances: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          remittance_id: string;
          products_cost_total_ars: number;
          transport_cost_ars: number;
          gain_ars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          remittance_id: string;
          products_cost_total_ars: number;
          transport_cost_ars?: number;
          gain_ars: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          remittance_id?: string;
          products_cost_total_ars?: number;
          transport_cost_ars?: number;
          gain_ars?: number;
          created_at?: string;
        };
      };
      margin_remittance_items: {
        Row: {
          id: string;
          margin_remittance_id: string;
          product_id: string;
          quantity_sent: number;
          unit_cost_theoretical_snapshot_ars: number;
          total_cost_snapshot_ars: number;
        };
        Insert: {
          id?: string;
          margin_remittance_id: string;
          product_id: string;
          quantity_sent: number;
          unit_cost_theoretical_snapshot_ars: number;
          total_cost_snapshot_ars: number;
        };
        Update: {
          id?: string;
          margin_remittance_id?: string;
          product_id?: string;
          quantity_sent?: number;
          unit_cost_theoretical_snapshot_ars?: number;
          total_cost_snapshot_ars?: number;
        };
      };
      financial_accounts: {
        Row: {
          id: string;
          account_type: AccountType;
          name: string;
          customer_id: string | null;
          supplier_id: string | null;
          current_balance: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_type: AccountType;
          name: string;
          customer_id?: string | null;
          supplier_id?: string | null;
          current_balance?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_type?: AccountType;
          name?: string;
          customer_id?: string | null;
          supplier_id?: string | null;
          current_balance?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      patrimonial_movements: {
        Row: {
          id: string;
          code: string;
          operation_id: string;
          movement_type: PatrimonialMovementType;
          description: string;
          amount_ars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          operation_id: string;
          movement_type: PatrimonialMovementType;
          description: string;
          amount_ars: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          operation_id?: string;
          movement_type?: PatrimonialMovementType;
          description?: string;
          amount_ars?: number;
          created_at?: string;
        };
      };
      financial_entries: {
        Row: {
          id: string;
          patrimonial_movement_id: string;
          financial_account_id: string;
          delta_ars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          patrimonial_movement_id: string;
          financial_account_id: string;
          delta_ars: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          patrimonial_movement_id?: string;
          financial_account_id?: string;
          delta_ars?: number;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          operation_id: string;
          payment_type: PaymentType;
          customer_id: string | null;
          supplier_id: string | null;
          amount_ars: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operation_id: string;
          payment_type: PaymentType;
          customer_id?: string | null;
          supplier_id?: string | null;
          amount_ars: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          operation_id?: string;
          payment_type?: PaymentType;
          customer_id?: string | null;
          supplier_id?: string | null;
          amount_ars?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      operating_expenses: {
        Row: {
          id: string;
          operation_id: string;
          expense_type: ExpenseType;
          description: string | null;
          amount_ars: number;
          source_account_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          operation_id: string;
          expense_type: ExpenseType;
          description?: string | null;
          amount_ars: number;
          source_account_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          operation_id?: string;
          expense_type?: ExpenseType;
          description?: string | null;
          amount_ars?: number;
          source_account_id?: string;
          created_at?: string;
        };
      };
      withdrawals: {
        Row: {
          id: string;
          operation_id: string;
          description: string;
          amount_ars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          operation_id: string;
          description: string;
          amount_ars: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          operation_id?: string;
          description?: string;
          amount_ars?: number;
          created_at?: string;
        };
      };
      marketplace_settlements: {
        Row: {
          id: string;
          operation_id: string;
          gross_amount_ars: number;
          net_amount_ars: number;
          commission_amount_ars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          operation_id: string;
          gross_amount_ars: number;
          net_amount_ars: number;
          commission_amount_ars: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          operation_id?: string;
          gross_amount_ars?: number;
          net_amount_ars?: number;
          commission_amount_ars?: number;
          created_at?: string;
        };
      };
      generated_documents: {
        Row: {
          id: string;
          document_type: DocumentType;
          source_type: string;
          source_id: string;
          renderer_type: RendererType;
          template_key: string;
          template_version: string;
          payload_snapshot: Json;
          generation_status: GenerationStatus;
          file_reference: string | null;
          file_size_bytes: number | null;
          error_message: string | null;
          attempt_count: number;
          generated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_type: DocumentType;
          source_type: string;
          source_id: string;
          renderer_type?: RendererType;
          template_key: string;
          template_version: string;
          payload_snapshot: Json;
          generation_status?: GenerationStatus;
          file_reference?: string | null;
          file_size_bytes?: number | null;
          error_message?: string | null;
          attempt_count?: number;
          generated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_type?: DocumentType;
          source_type?: string;
          source_id?: string;
          renderer_type?: RendererType;
          template_key?: string;
          template_version?: string;
          payload_snapshot?: Json;
          generation_status?: GenerationStatus;
          file_reference?: string | null;
          file_size_bytes?: number | null;
          error_message?: string | null;
          attempt_count?: number;
          generated_at?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      v_current_stock_priority: {
        Row: {
          stock_item_id: string;
          code: string;
          name: string;
          item_type: StockItemType;
          unit_type: UnitType;
          stock_minimum: number;
          current_stock: number;
          ratio: number;
          is_critical: boolean;
        };
      };
      v_current_item_cost: {
        Row: {
          stock_item_id: string;
          supplier_id: string;
          supplier_name: string;
          supplier_currency: CurrencyCode;
          quoted_unit_price_net: number;
          price_updated_at: string;
          fx_rate_used: number;
          net_price_ars: number;
          vat_rate_pct: number;
          unit_cost_gross_ars: number;
        };
      };
      v_current_formula_cost: {
        Row: {
          base_product_id: string;
          base_product_code: string;
          base_product_name: string;
          formula_version_id: string;
          version_number: number;
          total_kg: number;
          total_bulk_cost_ars: number;
          cost_per_kg_ars: number;
        };
      };
      v_current_product_cost: {
        Row: {
          product_id: string;
          product_code: string;
          product_name: string;
          presentation: string;
          weight_kg: number;
          base_product_id: string;
          base_cost_ars: number;
          components_cost_ars: number;
          subtotal_cost_ars: number;
          extra_variable_pct: number;
          extra_variable_cost_ars: number;
          total_product_cost_ars: number;
        };
      };
      v_customer_balances: {
        Row: {
          customer_id: string;
          code: string;
          name: string;
          category: string | null;
          phone: string | null;
          active: boolean;
          financial_account_id: string | null;
          current_balance_ars: number;
          updated_at: string;
        };
      };
      v_supplier_debts: {
        Row: {
          supplier_id: string;
          code: string;
          name: string;
          currency_code: CurrencyCode;
          phone: string | null;
          active: boolean;
          financial_account_id: string;
          debt_balance_ars: number;
        };
      };
      v_sales: {
        Row: {
          remittance_id: string;
          rto_code: string;
          margin_remittance_id: string;
          rtm_code: string;
          business_date: string;
          customer_source: CustomerSource;
          customer_id: string | null;
          customer_name: string | null;
          recipient_name_snapshot: string | null;
          total_order_ars: number;
          products_cost_total_ars: number;
          transport_cost_ars: number;
          gain_ars: number;
          created_at: string;
        };
      };
      v_current_reports: {
        Row: {
          sales_current_month: number;
          billed_current_month_ars: number;
          gain_current_month_ars: number;
          open_orders: number;
        };
      };
    };
    Functions: {
      get_next_code_sequence: {
        Args: {
          p_prefix: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
