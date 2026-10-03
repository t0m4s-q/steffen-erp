/**
 * Registro de migraciones y esquema de base de datos Steffen ERP
 * Fases 0, 1 y 2
 */

export interface MigrationRecord {
  version: string;
  name: string;
  description: string;
  fileName: string;
}

export const MIGRATIONS_REGISTRY: MigrationRecord[] = [
  {
    version: '20261002000001',
    name: 'initial_schema',
    description: 'Tablas maestras, stock, fábrica, compras, pedidos, finanzas, documentos y función de secuencias de código',
    fileName: '20261002000001_initial_schema.sql',
  },
  {
    version: '20261002000002',
    name: 'indexes_and_constraints',
    description: 'Índices de performance, índices únicos parciales y triggers automáticos para updated_at',
    fileName: '20261002000002_indexes_and_constraints.sql',
  },
  {
    version: '20261002000003',
    name: 'views',
    description: 'Vistas analíticas y de cálculo: v_current_stock_priority, v_current_item_cost, v_current_formula_cost, v_current_product_cost, v_customer_balances, v_supplier_debts, v_sales, v_current_reports',
    fileName: '20261002000003_views.sql',
  },
  {
    version: '20261002000004',
    name: 'seeds',
    description: 'Seeds de Fase 2: secuencias de códigos iniciales, cuentas Caja Steffen/ML, listas del sistema y perfiles Costo-Ganancia',
    fileName: '20261002000004_seeds.sql',
  },
  {
    version: '20261002000005',
    name: 'atomic_operations',
    description: 'Funciones RPC PostgreSQL transaccionales: apply_stock_movement y post_patrimonial_movement con atomicidad y bloqueo anti-concurrencia',
    fileName: '20261002000005_atomic_operations.sql',
  },
  {
    version: '20261002000006',
    name: 'security_hardening_rpcs',
    description: 'Hardening de seguridad: search_path vacío, nombres calificados y revocación de EXECUTE para roles no privilegiados (solo service_role)',
    fileName: '20261002000006_security_hardening_rpcs.sql',
  },
  {
    version: '20261002000007',
    name: 'lockdown_tables_and_views',
    description: 'Habilitación de RLS en las 46 tablas, security_invoker en las 8 vistas y revocación total de permisos a PUBLIC, anon y authenticated (acceso exclusivo service_role)',
    fileName: '20261002000007_lockdown_tables_and_views.sql',
  },
];

export const SYSTEM_TABLES = [
  'code_sequences',
  'business_operations',
  'exchange_rates',
  'customers',
  'suppliers',
  'stock_items',
  'raw_materials',
  'components',
  'base_products',
  'products',
  'product_components',
  'formula_versions',
  'formula_version_items',
  'supplier_items',
  'stock_balances',
  'stock_movements',
  'stock_adjustments',
  'stock_adjustment_items',
  'bulk_lots',
  'bulk_lot_material_snapshots',
  'packaging_operations',
  'packaging_component_snapshots',
  'factory_movements',
  'purchases',
  'purchase_items',
  'price_lists',
  'product_price_versions',
  'discount_profiles',
  'discount_profile_steps',
  'orders',
  'order_discount_steps',
  'order_items',
  'planning_product_priorities',
  'remittances',
  'remittance_discount_steps',
  'remittance_items',
  'margin_remittances',
  'margin_remittance_items',
  'financial_accounts',
  'patrimonial_movements',
  'financial_entries',
  'payments',
  'operating_expenses',
  'withdrawals',
  'marketplace_settlements',
  'generated_documents',
] as const;

export const SYSTEM_VIEWS = [
  'v_current_stock_priority',
  'v_current_item_cost',
  'v_current_formula_cost',
  'v_current_product_cost',
  'v_customer_balances',
  'v_supplier_debts',
  'v_sales',
  'v_current_reports',
] as const;
