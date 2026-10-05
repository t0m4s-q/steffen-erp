
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "base_products": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_date": string,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_date"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_date"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bulk_lot_material_snapshots": {
                  Row: {
                    "bulk_lot_id": string,"fx_rate_snapshot": number | null,"id": string,"quantity_kg": number,"raw_material_id": string,"source_currency": string,"source_supplier_id": string | null,"source_unit_price_net": number,"total_cost_ars_snapshot": number,"unit_cost_gross_ars_snapshot": number,"vat_rate_pct": number
                  }
                  Insert: {
                    "bulk_lot_id": string,"fx_rate_snapshot"?: number | null,"id"?: string,"quantity_kg": number,"raw_material_id": string,"source_currency": string,"source_supplier_id"?: string | null,"source_unit_price_net": number,"total_cost_ars_snapshot": number,"unit_cost_gross_ars_snapshot": number,"vat_rate_pct"?: number
                  }
                  Update: {
                    "bulk_lot_id"?: string,"fx_rate_snapshot"?: number | null,"id"?: string,"quantity_kg"?: number,"raw_material_id"?: string,"source_currency"?: string,"source_supplier_id"?: string | null,"source_unit_price_net"?: number,"total_cost_ars_snapshot"?: number,"unit_cost_gross_ars_snapshot"?: number,"vat_rate_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bulk_lot_material_snapshots_bulk_lot_id_fkey"
      columns: ["bulk_lot_id"]
isOneToOne: false
      referencedRelation: "bulk_lots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bulk_lot_material_snapshots_raw_material_id_fkey"
      columns: ["raw_material_id"]
isOneToOne: false
      referencedRelation: "raw_materials"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "bulk_lot_material_snapshots_source_supplier_id_fkey"
      columns: ["source_supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bulk_lot_material_snapshots_source_supplier_id_fkey"
      columns: ["source_supplier_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["supplier_id"]
    }
                  ]
                },"bulk_lots": {
                  Row: {
                    "base_product_id": string,"closed_at": string | null,"code": string,"cost_per_kg_snapshot_ars": number,"created_at": string,"formula_version_id": string,"id": string,"kg_available": number,"kg_fabricated": number,"observations": string | null,"operation_id": string,"status": string,"total_cost_snapshot_ars": number
                  }
                  Insert: {
                    "base_product_id": string,"closed_at"?: string | null,"code": string,"cost_per_kg_snapshot_ars"?: number,"created_at"?: string,"formula_version_id": string,"id"?: string,"kg_available": number,"kg_fabricated": number,"observations"?: string | null,"operation_id": string,"status": string,"total_cost_snapshot_ars"?: number
                  }
                  Update: {
                    "base_product_id"?: string,"closed_at"?: string | null,"code"?: string,"cost_per_kg_snapshot_ars"?: number,"created_at"?: string,"formula_version_id"?: string,"id"?: string,"kg_available"?: number,"kg_fabricated"?: number,"observations"?: string | null,"operation_id"?: string,"status"?: string,"total_cost_snapshot_ars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bulk_lots_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "base_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bulk_lots_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["base_product_id"]
    },{
      foreignKeyName: "bulk_lots_formula_version_id_fkey"
      columns: ["formula_version_id"]
isOneToOne: false
      referencedRelation: "formula_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bulk_lots_formula_version_id_fkey"
      columns: ["formula_version_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["formula_version_id"]
    },{
      foreignKeyName: "bulk_lots_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    }
                  ]
                },"business_operations": {
                  Row: {
                    "business_date": string,"created_at": string,"id": string,"operation_type": string,"updated_at": string
                  }
                  Insert: {
                    "business_date": string,"created_at"?: string,"id"?: string,"operation_type": string,"updated_at"?: string
                  }
                  Update: {
                    "business_date"?: string,"created_at"?: string,"id"?: string,"operation_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"code_sequences": {
                  Row: {
                    "last_value": number,"prefix": string,"updated_at": string
                  }
                  Insert: {
                    "last_value"?: number,"prefix": string,"updated_at"?: string
                  }
                  Update: {
                    "last_value"?: number,"prefix"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"components": {
                  Row: {
                    "stock_item_id": string
                  }
                  Insert: {
                    "stock_item_id": string
                  }
                  Update: {
                    "stock_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "components_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "components_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "active": boolean,"address": string | null,"category": string | null,"code": string,"created_at": string,"created_date": string,"discount_1_pct": number | null,"discount_2_pct": number | null,"discount_3_pct": number | null,"dni": string | null,"id": string,"locality": string | null,"name": string,"phone": string | null,"province": string | null,"transport_address": string | null,"transport_name": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"category"?: string | null,"code": string,"created_at"?: string,"created_date"?: string,"discount_1_pct"?: number | null,"discount_2_pct"?: number | null,"discount_3_pct"?: number | null,"dni"?: string | null,"id"?: string,"locality"?: string | null,"name": string,"phone"?: string | null,"province"?: string | null,"transport_address"?: string | null,"transport_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"category"?: string | null,"code"?: string,"created_at"?: string,"created_date"?: string,"discount_1_pct"?: number | null,"discount_2_pct"?: number | null,"discount_3_pct"?: number | null,"dni"?: string | null,"id"?: string,"locality"?: string | null,"name"?: string,"phone"?: string | null,"province"?: string | null,"transport_address"?: string | null,"transport_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"discount_profile_steps": {
                  Row: {
                    "discount_profile_id": string,"id": string,"percent": number,"position": number
                  }
                  Insert: {
                    "discount_profile_id": string,"id"?: string,"percent": number,"position": number
                  }
                  Update: {
                    "discount_profile_id"?: string,"id"?: string,"percent"?: number,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "discount_profile_steps_discount_profile_id_fkey"
      columns: ["discount_profile_id"]
isOneToOne: false
      referencedRelation: "discount_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"discount_profiles": {
                  Row: {
                    "active": boolean,"id": string,"name": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"exchange_rates": {
                  Row: {
                    "created_at": string,"currency_code": string,"effective_at": string,"id": string,"is_current": boolean,"rate_to_ars": number
                  }
                  Insert: {
                    "created_at"?: string,"currency_code": string,"effective_at"?: string,"id"?: string,"is_current"?: boolean,"rate_to_ars": number
                  }
                  Update: {
                    "created_at"?: string,"currency_code"?: string,"effective_at"?: string,"id"?: string,"is_current"?: boolean,"rate_to_ars"?: number
                  }
                  Relationships: [
                    
                  ]
                },"factory_movements": {
                  Row: {
                    "base_product_id": string | null,"bulk_lot_id": string | null,"code": string,"created_at": string,"description": string,"id": string,"movement_type": string,"operation_id": string,"quantity_kg": number | null
                  }
                  Insert: {
                    "base_product_id"?: string | null,"bulk_lot_id"?: string | null,"code": string,"created_at"?: string,"description": string,"id"?: string,"movement_type": string,"operation_id": string,"quantity_kg"?: number | null
                  }
                  Update: {
                    "base_product_id"?: string | null,"bulk_lot_id"?: string | null,"code"?: string,"created_at"?: string,"description"?: string,"id"?: string,"movement_type"?: string,"operation_id"?: string,"quantity_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "factory_movements_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "base_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "factory_movements_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["base_product_id"]
    },{
      foreignKeyName: "factory_movements_bulk_lot_id_fkey"
      columns: ["bulk_lot_id"]
isOneToOne: false
      referencedRelation: "bulk_lots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "factory_movements_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: false
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    }
                  ]
                },"financial_accounts": {
                  Row: {
                    "account_type": string,"active": boolean,"created_at": string,"current_balance": number,"customer_id": string | null,"id": string,"name": string,"supplier_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "account_type": string,"active"?: boolean,"created_at"?: string,"current_balance"?: number,"customer_id"?: string | null,"id"?: string,"name": string,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "account_type"?: string,"active"?: boolean,"created_at"?: string,"current_balance"?: number,"customer_id"?: string | null,"id"?: string,"name"?: string,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_accounts_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: true
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_accounts_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: true
      referencedRelation: "v_customer_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "financial_accounts_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: true
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_accounts_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: true
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["supplier_id"]
    }
                  ]
                },"financial_entries": {
                  Row: {
                    "created_at": string,"delta_ars": number,"financial_account_id": string,"id": string,"patrimonial_movement_id": string
                  }
                  Insert: {
                    "created_at"?: string,"delta_ars": number,"financial_account_id": string,"id"?: string,"patrimonial_movement_id": string
                  }
                  Update: {
                    "created_at"?: string,"delta_ars"?: number,"financial_account_id"?: string,"id"?: string,"patrimonial_movement_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_entries_financial_account_id_fkey"
      columns: ["financial_account_id"]
isOneToOne: false
      referencedRelation: "financial_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_entries_financial_account_id_fkey"
      columns: ["financial_account_id"]
isOneToOne: false
      referencedRelation: "v_customer_balances"
      referencedColumns: ["financial_account_id"]
    },{
      foreignKeyName: "financial_entries_financial_account_id_fkey"
      columns: ["financial_account_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["financial_account_id"]
    },{
      foreignKeyName: "financial_entries_patrimonial_movement_id_fkey"
      columns: ["patrimonial_movement_id"]
isOneToOne: false
      referencedRelation: "patrimonial_movements"
      referencedColumns: ["id"]
    }
                  ]
                },"formula_version_items": {
                  Row: {
                    "formula_version_id": string,"id": string,"quantity_kg": number,"raw_material_id": string,"sort_order": number
                  }
                  Insert: {
                    "formula_version_id": string,"id"?: string,"quantity_kg": number,"raw_material_id": string,"sort_order"?: number
                  }
                  Update: {
                    "formula_version_id"?: string,"id"?: string,"quantity_kg"?: number,"raw_material_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "formula_version_items_formula_version_id_fkey"
      columns: ["formula_version_id"]
isOneToOne: false
      referencedRelation: "formula_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formula_version_items_formula_version_id_fkey"
      columns: ["formula_version_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["formula_version_id"]
    },{
      foreignKeyName: "formula_version_items_raw_material_id_fkey"
      columns: ["raw_material_id"]
isOneToOne: false
      referencedRelation: "raw_materials"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"formula_versions": {
                  Row: {
                    "base_product_id": string,"business_date": string,"created_at": string,"id": string,"is_current": boolean,"observations": string | null,"version_number": number
                  }
                  Insert: {
                    "base_product_id": string,"business_date"?: string,"created_at"?: string,"id"?: string,"is_current"?: boolean,"observations"?: string | null,"version_number": number
                  }
                  Update: {
                    "base_product_id"?: string,"business_date"?: string,"created_at"?: string,"id"?: string,"is_current"?: boolean,"observations"?: string | null,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "formula_versions_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "base_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formula_versions_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["base_product_id"]
    }
                  ]
                },"generated_documents": {
                  Row: {
                    "attempt_count": number,"created_at": string,"document_type": string,"error_message": string | null,"file_reference": string | null,"file_size_bytes": number | null,"generated_at": string | null,"generation_status": string,"id": string,"payload_snapshot": NonNullable<Json>,"renderer_type": string,"source_id": string,"source_type": string,"template_key": string,"template_version": string
                  }
                  Insert: {
                    "attempt_count"?: number,"created_at"?: string,"document_type": string,"error_message"?: string | null,"file_reference"?: string | null,"file_size_bytes"?: number | null,"generated_at"?: string | null,"generation_status"?: string,"id"?: string,"payload_snapshot": NonNullable<Json>,"renderer_type"?: string,"source_id": string,"source_type": string,"template_key": string,"template_version": string
                  }
                  Update: {
                    "attempt_count"?: number,"created_at"?: string,"document_type"?: string,"error_message"?: string | null,"file_reference"?: string | null,"file_size_bytes"?: number | null,"generated_at"?: string | null,"generation_status"?: string,"id"?: string,"payload_snapshot"?: NonNullable<Json>,"renderer_type"?: string,"source_id"?: string,"source_type"?: string,"template_key"?: string,"template_version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"margin_remittance_items": {
                  Row: {
                    "id": string,"margin_remittance_id": string,"product_id": string,"quantity_sent": number,"total_cost_snapshot_ars": number,"unit_cost_theoretical_snapshot_ars": number
                  }
                  Insert: {
                    "id"?: string,"margin_remittance_id": string,"product_id": string,"quantity_sent": number,"total_cost_snapshot_ars": number,"unit_cost_theoretical_snapshot_ars": number
                  }
                  Update: {
                    "id"?: string,"margin_remittance_id"?: string,"product_id"?: string,"quantity_sent"?: number,"total_cost_snapshot_ars"?: number,"unit_cost_theoretical_snapshot_ars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "margin_remittance_items_margin_remittance_id_fkey"
      columns: ["margin_remittance_id"]
isOneToOne: false
      referencedRelation: "margin_remittances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "margin_remittance_items_margin_remittance_id_fkey"
      columns: ["margin_remittance_id"]
isOneToOne: false
      referencedRelation: "v_sales"
      referencedColumns: ["margin_remittance_id"]
    },{
      foreignKeyName: "margin_remittance_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "margin_remittance_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    }
                  ]
                },"margin_remittances": {
                  Row: {
                    "code": string,"created_at": string,"gain_ars": number,"id": string,"operation_id": string,"products_cost_total_ars": number,"remittance_id": string,"transport_cost_ars": number
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"gain_ars": number,"id"?: string,"operation_id": string,"products_cost_total_ars": number,"remittance_id": string,"transport_cost_ars"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"gain_ars"?: number,"id"?: string,"operation_id"?: string,"products_cost_total_ars"?: number,"remittance_id"?: string,"transport_cost_ars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "margin_remittances_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "margin_remittances_remittance_id_fkey"
      columns: ["remittance_id"]
isOneToOne: true
      referencedRelation: "remittances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "margin_remittances_remittance_id_fkey"
      columns: ["remittance_id"]
isOneToOne: true
      referencedRelation: "v_sales"
      referencedColumns: ["remittance_id"]
    }
                  ]
                },"marketplace_settlements": {
                  Row: {
                    "commission_amount_ars": number,"created_at": string,"gross_amount_ars": number,"id": string,"net_amount_ars": number,"operation_id": string
                  }
                  Insert: {
                    "commission_amount_ars": number,"created_at"?: string,"gross_amount_ars": number,"id"?: string,"net_amount_ars": number,"operation_id": string
                  }
                  Update: {
                    "commission_amount_ars"?: number,"created_at"?: string,"gross_amount_ars"?: number,"id"?: string,"net_amount_ars"?: number,"operation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "marketplace_settlements_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    }
                  ]
                },"operating_expenses": {
                  Row: {
                    "amount_ars": number,"created_at": string,"description": string | null,"expense_type": string,"id": string,"operation_id": string,"source_account_id": string
                  }
                  Insert: {
                    "amount_ars": number,"created_at"?: string,"description"?: string | null,"expense_type": string,"id"?: string,"operation_id": string,"source_account_id": string
                  }
                  Update: {
                    "amount_ars"?: number,"created_at"?: string,"description"?: string | null,"expense_type"?: string,"id"?: string,"operation_id"?: string,"source_account_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operating_expenses_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "operating_expenses_source_account_id_fkey"
      columns: ["source_account_id"]
isOneToOne: false
      referencedRelation: "financial_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "operating_expenses_source_account_id_fkey"
      columns: ["source_account_id"]
isOneToOne: false
      referencedRelation: "v_customer_balances"
      referencedColumns: ["financial_account_id"]
    },{
      foreignKeyName: "operating_expenses_source_account_id_fkey"
      columns: ["source_account_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["financial_account_id"]
    }
                  ]
                },"order_discount_steps": {
                  Row: {
                    "id": string,"order_id": string,"percent": number,"position": number
                  }
                  Insert: {
                    "id"?: string,"order_id": string,"percent": number,"position": number
                  }
                  Update: {
                    "id"?: string,"order_id"?: string,"percent"?: number,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_discount_steps_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "ag_quantity": number | null,"created_at": string,"id": string,"order_id": string,"product_id": string,"requested_quantity": number,"sort_order": number,"unit_price_ars_snapshot": number,"updated_at": string
                  }
                  Insert: {
                    "ag_quantity"?: number | null,"created_at"?: string,"id"?: string,"order_id": string,"product_id": string,"requested_quantity": number,"sort_order"?: number,"unit_price_ars_snapshot": number,"updated_at"?: string
                  }
                  Update: {
                    "ag_quantity"?: number | null,"created_at"?: string,"id"?: string,"order_id"?: string,"product_id"?: string,"requested_quantity"?: number,"sort_order"?: number,"unit_price_ars_snapshot"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": string | null,"business_date": string,"code": string,"converted_rto_id": string | null,"created_at": string,"customer_id": string | null,"customer_source": string,"id": string,"locality": string | null,"package_count": number | null,"phone": string | null,"planning_sort_key": number,"price_list_id": string,"price_snapshot_at": string,"province": string | null,"recipient_name": string | null,"status": string,"transport_address": string | null,"transport_name": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"business_date"?: string,"code": string,"converted_rto_id"?: string | null,"created_at"?: string,"customer_id"?: string | null,"customer_source": string,"id"?: string,"locality"?: string | null,"package_count"?: number | null,"phone"?: string | null,"planning_sort_key"?: number,"price_list_id": string,"price_snapshot_at"?: string,"province"?: string | null,"recipient_name"?: string | null,"status": string,"transport_address"?: string | null,"transport_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"business_date"?: string,"code"?: string,"converted_rto_id"?: string | null,"created_at"?: string,"customer_id"?: string | null,"customer_source"?: string,"id"?: string,"locality"?: string | null,"package_count"?: number | null,"phone"?: string | null,"planning_sort_key"?: number,"price_list_id"?: string,"price_snapshot_at"?: string,"province"?: string | null,"recipient_name"?: string | null,"status"?: string,"transport_address"?: string | null,"transport_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "v_customer_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "orders_price_list_id_fkey"
      columns: ["price_list_id"]
isOneToOne: false
      referencedRelation: "price_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"packaging_component_snapshots": {
                  Row: {
                    "component_id": string,"id": string,"packaging_operation_id": string,"quantity_per_unit": number,"quantity_total": number,"total_cost_ars_snapshot": number,"unit_cost_gross_ars_snapshot": number
                  }
                  Insert: {
                    "component_id": string,"id"?: string,"packaging_operation_id": string,"quantity_per_unit": number,"quantity_total": number,"total_cost_ars_snapshot": number,"unit_cost_gross_ars_snapshot": number
                  }
                  Update: {
                    "component_id"?: string,"id"?: string,"packaging_operation_id"?: string,"quantity_per_unit"?: number,"quantity_total"?: number,"total_cost_ars_snapshot"?: number,"unit_cost_gross_ars_snapshot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_component_snapshots_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "packaging_component_snapshots_packaging_operation_id_fkey"
      columns: ["packaging_operation_id"]
isOneToOne: false
      referencedRelation: "packaging_operations"
      referencedColumns: ["id"]
    }
                  ]
                },"packaging_operations": {
                  Row: {
                    "base_cost_per_kg_snapshot_ars": number,"bulk_lot_id": string,"code": string,"created_at": string,"id": string,"is_last_of_lot": boolean,"kg_available_before": number,"kg_consumed": number,"observations": string | null,"operation_id": string,"product_id": string,"total_cost_snapshot_ars": number,"unit_cost_snapshot_ars": number,"units_packaged": number,"variance_kg": number,"variance_type": string
                  }
                  Insert: {
                    "base_cost_per_kg_snapshot_ars": number,"bulk_lot_id": string,"code": string,"created_at"?: string,"id"?: string,"is_last_of_lot"?: boolean,"kg_available_before": number,"kg_consumed": number,"observations"?: string | null,"operation_id": string,"product_id": string,"total_cost_snapshot_ars": number,"unit_cost_snapshot_ars": number,"units_packaged": number,"variance_kg"?: number,"variance_type": string
                  }
                  Update: {
                    "base_cost_per_kg_snapshot_ars"?: number,"bulk_lot_id"?: string,"code"?: string,"created_at"?: string,"id"?: string,"is_last_of_lot"?: boolean,"kg_available_before"?: number,"kg_consumed"?: number,"observations"?: string | null,"operation_id"?: string,"product_id"?: string,"total_cost_snapshot_ars"?: number,"unit_cost_snapshot_ars"?: number,"units_packaged"?: number,"variance_kg"?: number,"variance_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packaging_operations_bulk_lot_id_fkey"
      columns: ["bulk_lot_id"]
isOneToOne: false
      referencedRelation: "bulk_lots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_operations_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packaging_operations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "packaging_operations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    }
                  ]
                },"patrimonial_movements": {
                  Row: {
                    "amount_ars": number,"code": string,"created_at": string,"description": string,"id": string,"movement_type": string,"operation_id": string
                  }
                  Insert: {
                    "amount_ars": number,"code": string,"created_at"?: string,"description": string,"id"?: string,"movement_type": string,"operation_id": string
                  }
                  Update: {
                    "amount_ars"?: number,"code"?: string,"created_at"?: string,"description"?: string,"id"?: string,"movement_type"?: string,"operation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patrimonial_movements_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: false
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_ars": number,"created_at": string,"customer_id": string | null,"id": string,"operation_id": string,"payment_type": string,"supplier_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount_ars": number,"created_at"?: string,"customer_id"?: string | null,"id"?: string,"operation_id": string,"payment_type": string,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_ars"?: number,"created_at"?: string,"customer_id"?: string | null,"id"?: string,"operation_id"?: string,"payment_type"?: string,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "v_customer_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "payments_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["supplier_id"]
    }
                  ]
                },"planning_product_priorities": {
                  Row: {
                    "product_id": string,"sort_key": number,"updated_at": string
                  }
                  Insert: {
                    "product_id": string,"sort_key"?: number,"updated_at"?: string
                  }
                  Update: {
                    "product_id"?: string,"sort_key"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planning_product_priorities_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "planning_product_priorities_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    }
                  ]
                },"price_lists": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"system_role": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"system_role"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"system_role"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_components": {
                  Row: {
                    "component_id": string,"product_id": string,"quantity_per_unit": number,"sort_order": number
                  }
                  Insert: {
                    "component_id": string,"product_id": string,"quantity_per_unit": number,"sort_order"?: number
                  }
                  Update: {
                    "component_id"?: string,"product_id"?: string,"quantity_per_unit"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_components_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "product_components_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "product_components_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    }
                  ]
                },"product_price_versions": {
                  Row: {
                    "created_at": string,"id": string,"price_ars": number,"price_list_id": string,"product_id": string,"valid_from": string,"valid_to": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"price_ars": number,"price_list_id": string,"product_id": string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"price_ars"?: number,"price_list_id"?: string,"product_id"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_price_versions_price_list_id_fkey"
      columns: ["price_list_id"]
isOneToOne: false
      referencedRelation: "price_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_price_versions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "product_price_versions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    }
                  ]
                },"products": {
                  Row: {
                    "base_product_id": string,"created_at": string,"extra_variable_pct": number,"presentation": string,"stock_item_id": string,"weight_kg": number
                  }
                  Insert: {
                    "base_product_id": string,"created_at"?: string,"extra_variable_pct"?: number,"presentation": string,"stock_item_id": string,"weight_kg": number
                  }
                  Update: {
                    "base_product_id"?: string,"created_at"?: string,"extra_variable_pct"?: number,"presentation"?: string,"stock_item_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "base_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["base_product_id"]
    },{
      foreignKeyName: "products_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"purchase_items": {
                  Row: {
                    "id": string,"line_total_gross_ars": number,"purchase_id": string,"quantity": number,"sort_order": number,"stock_item_id": string,"unit_price_gross_ars_snapshot": number,"unit_price_net_source": number,"vat_rate_pct": number
                  }
                  Insert: {
                    "id"?: string,"line_total_gross_ars": number,"purchase_id": string,"quantity": number,"sort_order"?: number,"stock_item_id": string,"unit_price_gross_ars_snapshot": number,"unit_price_net_source": number,"vat_rate_pct"?: number
                  }
                  Update: {
                    "id"?: string,"line_total_gross_ars"?: number,"purchase_id"?: string,"quantity"?: number,"sort_order"?: number,"stock_item_id"?: string,"unit_price_gross_ars_snapshot"?: number,"unit_price_net_source"?: number,"vat_rate_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_items_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"purchases": {
                  Row: {
                    "code": string,"created_at": string,"currency_code_snapshot": string,"exchange_rate_used": number | null,"id": string,"observations": string | null,"operation_id": string,"payment_mode": string,"supplier_id": string,"total_gross_ars": number,"total_net_source_currency": number,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"currency_code_snapshot": string,"exchange_rate_used"?: number | null,"id"?: string,"observations"?: string | null,"operation_id": string,"payment_mode": string,"supplier_id": string,"total_gross_ars": number,"total_net_source_currency": number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"currency_code_snapshot"?: string,"exchange_rate_used"?: number | null,"id"?: string,"observations"?: string | null,"operation_id"?: string,"payment_mode"?: string,"supplier_id"?: string,"total_gross_ars"?: number,"total_net_source_currency"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchases_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["supplier_id"]
    }
                  ]
                },"raw_materials": {
                  Row: {
                    "inci": string | null,"stock_item_id": string
                  }
                  Insert: {
                    "inci"?: string | null,"stock_item_id": string
                  }
                  Update: {
                    "inci"?: string | null,"stock_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "raw_materials_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "raw_materials_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"remittance_discount_steps": {
                  Row: {
                    "amount_ars_snapshot": number,"id": string,"percent": number,"position": number,"remittance_id": string
                  }
                  Insert: {
                    "amount_ars_snapshot": number,"id"?: string,"percent": number,"position": number,"remittance_id": string
                  }
                  Update: {
                    "amount_ars_snapshot"?: number,"id"?: string,"percent"?: number,"position"?: number,"remittance_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "remittance_discount_steps_remittance_id_fkey"
      columns: ["remittance_id"]
isOneToOne: false
      referencedRelation: "remittances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "remittance_discount_steps_remittance_id_fkey"
      columns: ["remittance_id"]
isOneToOne: false
      referencedRelation: "v_sales"
      referencedColumns: ["remittance_id"]
    }
                  ]
                },"remittance_items": {
                  Row: {
                    "id": string,"line_total_ars": number,"presentation_snapshot": string,"product_code_snapshot": string,"product_id": string,"product_name_snapshot": string,"quantity_sent": number,"remittance_id": string,"unit_price_ars_snapshot": number,"weight_kg_snapshot": number
                  }
                  Insert: {
                    "id"?: string,"line_total_ars": number,"presentation_snapshot": string,"product_code_snapshot": string,"product_id": string,"product_name_snapshot": string,"quantity_sent": number,"remittance_id": string,"unit_price_ars_snapshot": number,"weight_kg_snapshot": number
                  }
                  Update: {
                    "id"?: string,"line_total_ars"?: number,"presentation_snapshot"?: string,"product_code_snapshot"?: string,"product_id"?: string,"product_name_snapshot"?: string,"quantity_sent"?: number,"remittance_id"?: string,"unit_price_ars_snapshot"?: number,"weight_kg_snapshot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "remittance_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "remittance_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_current_product_cost"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "remittance_items_remittance_id_fkey"
      columns: ["remittance_id"]
isOneToOne: false
      referencedRelation: "remittances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "remittance_items_remittance_id_fkey"
      columns: ["remittance_id"]
isOneToOne: false
      referencedRelation: "v_sales"
      referencedColumns: ["remittance_id"]
    }
                  ]
                },"remittances": {
                  Row: {
                    "address_snapshot": string | null,"code": string,"created_at": string,"customer_id": string | null,"customer_source": string,"id": string,"locality_snapshot": string | null,"operation_id": string,"order_id": string,"package_count_snapshot": number | null,"phone_snapshot": string | null,"prior_balance_snapshot_ars": number,"province_snapshot": string | null,"recipient_name_snapshot": string | null,"status": string,"subtotal_ars": number,"total_order_ars": number,"total_to_collect_ars": number,"transport_address_snapshot": string | null,"transport_name_snapshot": string | null,"weight_kg_snapshot": number
                  }
                  Insert: {
                    "address_snapshot"?: string | null,"code": string,"created_at"?: string,"customer_id"?: string | null,"customer_source": string,"id"?: string,"locality_snapshot"?: string | null,"operation_id": string,"order_id": string,"package_count_snapshot"?: number | null,"phone_snapshot"?: string | null,"prior_balance_snapshot_ars"?: number,"province_snapshot"?: string | null,"recipient_name_snapshot"?: string | null,"status": string,"subtotal_ars": number,"total_order_ars": number,"total_to_collect_ars": number,"transport_address_snapshot"?: string | null,"transport_name_snapshot"?: string | null,"weight_kg_snapshot": number
                  }
                  Update: {
                    "address_snapshot"?: string | null,"code"?: string,"created_at"?: string,"customer_id"?: string | null,"customer_source"?: string,"id"?: string,"locality_snapshot"?: string | null,"operation_id"?: string,"order_id"?: string,"package_count_snapshot"?: number | null,"phone_snapshot"?: string | null,"prior_balance_snapshot_ars"?: number,"province_snapshot"?: string | null,"recipient_name_snapshot"?: string | null,"status"?: string,"subtotal_ars"?: number,"total_order_ars"?: number,"total_to_collect_ars"?: number,"transport_address_snapshot"?: string | null,"transport_name_snapshot"?: string | null,"weight_kg_snapshot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "remittances_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "remittances_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "v_customer_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "remittances_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "remittances_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_adjustment_items": {
                  Row: {
                    "adjustment_id": string,"id": string,"quantity_delta": number,"reason": string,"stock_item_id": string
                  }
                  Insert: {
                    "adjustment_id": string,"id"?: string,"quantity_delta": number,"reason": string,"stock_item_id": string
                  }
                  Update: {
                    "adjustment_id"?: string,"id"?: string,"quantity_delta"?: number,"reason"?: string,"stock_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
      columns: ["adjustment_id"]
isOneToOne: false
      referencedRelation: "stock_adjustments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustment_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustment_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"stock_adjustments": {
                  Row: {
                    "created_at": string,"id": string,"operation_id": string,"reason": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"operation_id": string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"operation_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_adjustments_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_balances": {
                  Row: {
                    "quantity": number,"stock_item_id": string,"updated_at": string
                  }
                  Insert: {
                    "quantity"?: number,"stock_item_id": string,"updated_at"?: string
                  }
                  Update: {
                    "quantity"?: number,"stock_item_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_balances_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_balances_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: true
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"stock_items": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_date": string,"id": string,"item_type": string,"name": string,"stock_minimum": number,"unit_type": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_date"?: string,"id"?: string,"item_type": string,"name": string,"stock_minimum": number,"unit_type": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_date"?: string,"id"?: string,"item_type"?: string,"name"?: string,"stock_minimum"?: number,"unit_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stock_movements": {
                  Row: {
                    "code": string,"created_at": string,"description": string,"id": string,"movement_type": string,"operation_id": string,"quantity_delta": number,"stock_item_id": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"description": string,"id"?: string,"movement_type": string,"operation_id": string,"quantity_delta": number,"stock_item_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string,"id"?: string,"movement_type"?: string,"operation_id"?: string,"quantity_delta"?: number,"stock_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: false
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"supplier_items": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"price_updated_at": string,"quoted_unit_price_net": number,"stock_item_id": string,"supplier_id": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"price_updated_at"?: string,"quoted_unit_price_net": number,"stock_item_id": string,"supplier_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"price_updated_at"?: string,"quoted_unit_price_net"?: number,"stock_item_id"?: string,"supplier_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "supplier_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["supplier_id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_date": string,"currency_code": string,"id": string,"name": string,"phone": string | null,"salesperson": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_date"?: string,"currency_code": string,"id"?: string,"name": string,"phone"?: string | null,"salesperson"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_date"?: string,"currency_code"?: string,"id"?: string,"name"?: string,"phone"?: string | null,"salesperson"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"withdrawals": {
                  Row: {
                    "amount_ars": number,"created_at": string,"description": string,"id": string,"operation_id": string
                  }
                  Insert: {
                    "amount_ars": number,"created_at"?: string,"description": string,"id"?: string,"operation_id": string
                  }
                  Update: {
                    "amount_ars"?: number,"created_at"?: string,"description"?: string,"id"?: string,"operation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "withdrawals_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "business_operations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_current_formula_cost": {
                  Row: {
                    "base_product_code": string | null,"base_product_id": string | null,"base_product_name": string | null,"cost_per_kg_ars": number | null,"formula_version_id": string | null,"total_bulk_cost_ars": number | null,"total_kg": number | null,"version_number": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_current_item_cost": {
                  Row: {
                    "fx_rate_used": number | null,"net_price_ars": number | null,"price_updated_at": string | null,"quoted_unit_price_net": number | null,"stock_item_id": string | null,"supplier_currency": string | null,"supplier_id": string | null,"supplier_name": string | null,"unit_cost_gross_ars": number | null,"vat_rate_pct": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_items_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    },{
      foreignKeyName: "supplier_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "v_supplier_debts"
      referencedColumns: ["supplier_id"]
    }
                  ]
                },"v_current_product_cost": {
                  Row: {
                    "base_cost_ars": number | null,"base_product_id": string | null,"components_cost_ars": number | null,"extra_variable_cost_ars": number | null,"extra_variable_pct": number | null,"presentation": string | null,"product_code": string | null,"product_id": string | null,"product_name": string | null,"subtotal_cost_ars": number | null,"total_product_cost_ars": number | null,"weight_kg": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "base_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_base_product_id_fkey"
      columns: ["base_product_id"]
isOneToOne: false
      referencedRelation: "v_current_formula_cost"
      referencedColumns: ["base_product_id"]
    },{
      foreignKeyName: "products_stock_item_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_stock_item_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "v_current_stock_priority"
      referencedColumns: ["stock_item_id"]
    }
                  ]
                },"v_current_reports": {
                  Row: {
                    "billed_current_month_ars": number | null,"gain_current_month_ars": number | null,"open_orders": number | null,"sales_current_month": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_current_stock_priority": {
                  Row: {
                    "code": string | null,"current_stock": number | null,"is_critical": boolean | null,"item_type": string | null,"name": string | null,"ratio": number | null,"stock_item_id": string | null,"stock_minimum": number | null,"unit_type": string | null
                  }
                  Relationships: [
                    
                  ]
                },"v_customer_balances": {
                  Row: {
                    "active": boolean | null,"category": string | null,"code": string | null,"current_balance_ars": number | null,"customer_id": string | null,"financial_account_id": string | null,"name": string | null,"phone": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                },"v_sales": {
                  Row: {
                    "business_date": string | null,"created_at": string | null,"customer_id": string | null,"customer_name": string | null,"customer_source": string | null,"gain_ars": number | null,"margin_remittance_id": string | null,"products_cost_total_ars": number | null,"recipient_name_snapshot": string | null,"remittance_id": string | null,"rtm_code": string | null,"rto_code": string | null,"total_order_ars": number | null,"transport_cost_ars": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "remittances_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "remittances_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "v_customer_balances"
      referencedColumns: ["customer_id"]
    }
                  ]
                },"v_supplier_debts": {
                  Row: {
                    "active": boolean | null,"code": string | null,"currency_code": string | null,"debt_balance_ars": number | null,"financial_account_id": string | null,"name": string | null,"phone": string | null,"supplier_id": string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "apply_stock_movement":
{ Args: { "p_description": string,"p_movement_type": string,"p_operation_id": string,"p_quantity_delta": number,"p_stock_item_id": string }; Returns: Json
                           },
"create_base_product_with_formula":
{ Args: { "p_business_date"?: string,"p_items": Json,"p_name": string,"p_observations"?: string }; Returns: Json
                           },
"create_customer_with_account":
{ Args: { "p_address"?: string,"p_category"?: string,"p_created_date"?: string,"p_discount_1_pct"?: number,"p_discount_2_pct"?: number,"p_discount_3_pct"?: number,"p_dni"?: string,"p_locality"?: string,"p_name": string,"p_phone"?: string,"p_province"?: string,"p_transport_address"?: string,"p_transport_name"?: string }; Returns: Json
                           },
"create_final_product":
{ Args: { "p_base_product_id": string,"p_components": Json,"p_created_date"?: string,"p_initial_stock"?: number,"p_name": string,"p_presentation": string,"p_stock_minimum": number,"p_weight_kg": number }; Returns: Json
                           },
"create_master_item":
{ Args: { "p_created_date"?: string,"p_inci"?: string,"p_initial_quoted_price_net": number,"p_initial_stock"?: number,"p_initial_supplier_id": string,"p_item_type": string,"p_name": string,"p_stock_minimum": number }; Returns: Json
                           },
"create_new_formula_version":
{ Args: { "p_base_product_id": string,"p_business_date"?: string,"p_items": Json,"p_observations"?: string }; Returns: Json
                           },
"create_supplier_with_account":
{ Args: { "p_created_date"?: string,"p_currency_code": string,"p_name": string,"p_phone"?: string,"p_salesperson"?: string }; Returns: Json
                           },
"get_next_code_sequence":
{ Args: { "p_prefix": string }; Returns: string
                           },
"post_patrimonial_movement":
{ Args: { "p_amount_ars": number,"p_description": string,"p_entries": Json,"p_movement_type": string,"p_operation_id": string }; Returns: Json
                           },
"update_final_product_metadata":
{ Args: { "p_active"?: boolean,"p_name"?: string,"p_presentation"?: string,"p_product_id": string,"p_stock_minimum"?: number }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
