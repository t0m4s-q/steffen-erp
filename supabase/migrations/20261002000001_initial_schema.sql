-- ============================================================================
-- Steffen ERP — Migration 000001: Initial Schema
-- Implementa DATA_MODEL.md (Fase 1 del IMPLEMENTATION_PLAN.md)
-- ============================================================================

-- Extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. INFRAESTRUCTURA BASE
-- ============================================================================

-- Secuencias de códigos visibles con bloqueo transaccional (evita MAX + 1)
CREATE TABLE IF NOT EXISTS code_sequences (
  prefix VARCHAR(3) PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Función para generar códigos visibles secuenciales y seguros
CREATE OR REPLACE FUNCTION get_next_code_sequence(p_prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_next_val BIGINT;
BEGIN
  UPDATE code_sequences
  SET last_value = last_value + 1,
      updated_at = NOW()
  WHERE prefix = p_prefix
  RETURNING last_value INTO v_next_val;

  IF NOT FOUND THEN
    INSERT INTO code_sequences (prefix, last_value, updated_at)
    VALUES (p_prefix, 1, NOW())
    RETURNING last_value INTO v_next_val;
  END IF;

  RETURN p_prefix || LPAD(v_next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Operaciones de negocio: fuente única de la fecha funcional (business_date)
CREATE TABLE IF NOT EXISTS business_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR NOT NULL CHECK (
    operation_type IN (
      'BULK_PRODUCTION',
      'PACKAGING',
      'PURCHASE',
      'SALE_RTO',
      'SALE_RTM',
      'CUSTOMER_PAYMENT',
      'SUPPLIER_PAYMENT',
      'OPERATING_EXPENSE',
      'WITHDRAWAL',
      'MARKETPLACE_SETTLEMENT',
      'STOCK_ADJUSTMENT'
    )
  ),
  business_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de cotizaciones de moneda extranjera
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code VARCHAR NOT NULL CHECK (currency_code IN ('USD', 'ARS')),
  rate_to_ars NUMERIC(20,6) NOT NULL CHECK (rate_to_ars > 0),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. MAESTROS
-- ============================================================================

-- Clientes registrados
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  name VARCHAR NOT NULL,
  dni VARCHAR NULL,
  address VARCHAR NULL,
  locality VARCHAR NULL,
  province VARCHAR NULL,
  phone VARCHAR NULL,
  transport_name VARCHAR NULL,
  transport_address VARCHAR NULL,
  category VARCHAR NULL,
  discount_1_pct NUMERIC(7,4) NULL CHECK (discount_1_pct IS NULL OR (discount_1_pct >= 0 AND discount_1_pct <= 100)),
  discount_2_pct NUMERIC(7,4) NULL CHECK (discount_2_pct IS NULL OR (discount_2_pct >= 0 AND discount_2_pct <= 100)),
  discount_3_pct NUMERIC(7,4) NULL CHECK (discount_3_pct IS NULL OR (discount_3_pct >= 0 AND discount_3_pct <= 100)),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proveedores (moneda única e inmutable)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  name VARCHAR NOT NULL,
  salesperson VARCHAR NULL,
  phone VARCHAR NULL,
  currency_code VARCHAR NOT NULL CHECK (currency_code IN ('ARS', 'USD')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Superentidad de ítems de stock (MPR, COM, PRO)
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  item_type VARCHAR NOT NULL CHECK (item_type IN ('MPR', 'COM', 'PRO')),
  name VARCHAR NOT NULL,
  unit_type VARCHAR NOT NULL CHECK (unit_type IN ('KG', 'UNIT')),
  stock_minimum NUMERIC(20,3) NOT NULL CHECK (stock_minimum > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_item_unit_type CHECK (
    (item_type = 'MPR' AND unit_type = 'KG') OR
    (item_type IN ('COM', 'PRO') AND unit_type = 'UNIT')
  )
);

-- Subtipo Materia Prima (MPR)
CREATE TABLE IF NOT EXISTS raw_materials (
  stock_item_id UUID PRIMARY KEY REFERENCES stock_items(id) ON DELETE RESTRICT,
  inci VARCHAR NULL
);

-- Subtipo Componente (COM)
CREATE TABLE IF NOT EXISTS components (
  stock_item_id UUID PRIMARY KEY REFERENCES stock_items(id) ON DELETE RESTRICT
);

-- Productos Base (PBA)
CREATE TABLE IF NOT EXISTS base_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subtipo Producto Terminado (PRO)
CREATE TABLE IF NOT EXISTS products (
  stock_item_id UUID PRIMARY KEY REFERENCES stock_items(id) ON DELETE RESTRICT,
  base_product_id UUID NOT NULL REFERENCES base_products(id) ON DELETE RESTRICT,
  presentation VARCHAR NOT NULL,
  weight_kg NUMERIC(12,3) NOT NULL CHECK (weight_kg > 0),
  extra_variable_pct NUMERIC(7,4) NOT NULL DEFAULT 2.0000 CHECK (extra_variable_pct = 2.0000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composición de componentes por producto terminado
CREATE TABLE IF NOT EXISTS product_components (
  product_id UUID NOT NULL REFERENCES products(stock_item_id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(stock_item_id) ON DELETE RESTRICT,
  quantity_per_unit INTEGER NOT NULL CHECK (quantity_per_unit > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, component_id)
);

-- ============================================================================
-- 3. FÓRMULAS Y RELACIÓN CON PROVEEDORES
-- ============================================================================

-- Versiones de fórmulas de PBA
CREATE TABLE IF NOT EXISTS formula_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_product_id UUID NOT NULL REFERENCES base_products(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observations TEXT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_product_id, version_number)
);

-- Renglones de versión de fórmula (MPRs que la componen)
CREATE TABLE IF NOT EXISTS formula_version_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id UUID NOT NULL REFERENCES formula_versions(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(stock_item_id) ON DELETE RESTRICT,
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (formula_version_id, raw_material_id)
);

-- Relación Proveedor <-> Ítem (MPR o COM)
CREATE TABLE IF NOT EXISTS supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  quoted_unit_price_net NUMERIC(20,6) NOT NULL CHECK (quoted_unit_price_net > 0),
  price_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, stock_item_id)
);

-- ============================================================================
-- 4. STOCK
-- ============================================================================

-- Saldos actuales rápidos de stock
CREATE TABLE IF NOT EXISTS stock_balances (
  stock_item_id UUID PRIMARY KEY REFERENCES stock_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(20,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger histórico de movimientos de stock (MST)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL REFERENCES business_operations(id) ON DELETE RESTRICT,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  movement_type VARCHAR NOT NULL CHECK (
    movement_type IN ('VENTA', 'COMPRA', 'ENVASADO', 'FABRICACIÓN', 'AJUSTE')
  ),
  quantity_delta NUMERIC(20,3) NOT NULL CHECK (quantity_delta != 0),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cabecera de Ajustes de stock
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Líneas de ajuste de stock
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  quantity_delta NUMERIC(20,3) NOT NULL CHECK (quantity_delta != 0),
  reason TEXT NOT NULL
);

-- ============================================================================
-- 5. FÁBRICA
-- ============================================================================

-- Lotes a granel (GRA)
CREATE TABLE IF NOT EXISTS bulk_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  base_product_id UUID NOT NULL REFERENCES base_products(id) ON DELETE RESTRICT,
  formula_version_id UUID NOT NULL REFERENCES formula_versions(id) ON DELETE RESTRICT,
  kg_fabricated NUMERIC(12,3) NOT NULL CHECK (kg_fabricated > 0),
  kg_available NUMERIC(12,3) NOT NULL CHECK (kg_available >= 0),
  status VARCHAR NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  observations TEXT NULL,
  total_cost_snapshot_ars NUMERIC(20,6) NOT NULL DEFAULT 0,
  cost_per_kg_snapshot_ars NUMERIC(20,6) NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot de materias primas consumidas por lote granel
CREATE TABLE IF NOT EXISTS bulk_lot_material_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_lot_id UUID NOT NULL REFERENCES bulk_lots(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(stock_item_id) ON DELETE RESTRICT,
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  source_supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  source_currency VARCHAR NOT NULL,
  source_unit_price_net NUMERIC(20,6) NOT NULL,
  fx_rate_snapshot NUMERIC(20,6) NULL,
  vat_rate_pct NUMERIC(7,4) NOT NULL DEFAULT 21.0000,
  unit_cost_gross_ars_snapshot NUMERIC(20,6) NOT NULL,
  total_cost_ars_snapshot NUMERIC(20,6) NOT NULL
);

-- Operaciones de envasado (ENV)
CREATE TABLE IF NOT EXISTS packaging_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  bulk_lot_id UUID NOT NULL REFERENCES bulk_lots(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(stock_item_id) ON DELETE RESTRICT,
  units_packaged INTEGER NOT NULL CHECK (units_packaged > 0),
  kg_available_before NUMERIC(12,3) NOT NULL,
  kg_consumed NUMERIC(12,3) NOT NULL CHECK (kg_consumed > 0),
  is_last_of_lot BOOLEAN NOT NULL DEFAULT false,
  variance_type VARCHAR NOT NULL CHECK (variance_type IN ('NONE', 'MERMA', 'SOBRANTE')),
  variance_kg NUMERIC(12,3) NOT NULL DEFAULT 0,
  base_cost_per_kg_snapshot_ars NUMERIC(20,6) NOT NULL,
  unit_cost_snapshot_ars NUMERIC(20,6) NOT NULL,
  total_cost_snapshot_ars NUMERIC(20,6) NOT NULL,
  observations TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot de componentes consumidos en la operación de envasado
CREATE TABLE IF NOT EXISTS packaging_component_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_operation_id UUID NOT NULL REFERENCES packaging_operations(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(stock_item_id) ON DELETE RESTRICT,
  quantity_per_unit INTEGER NOT NULL CHECK (quantity_per_unit > 0),
  quantity_total INTEGER NOT NULL CHECK (quantity_total > 0),
  unit_cost_gross_ars_snapshot NUMERIC(20,6) NOT NULL,
  total_cost_ars_snapshot NUMERIC(20,6) NOT NULL
);

-- Historial de movimientos de fábrica (MFA)
CREATE TABLE IF NOT EXISTS factory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL REFERENCES business_operations(id) ON DELETE RESTRICT,
  movement_type VARCHAR NOT NULL CHECK (
    movement_type IN ('FABRICACIÓN', 'ENVASADO', 'MERMA', 'SOBRANTE')
  ),
  base_product_id UUID NULL REFERENCES base_products(id) ON DELETE SET NULL,
  bulk_lot_id UUID NULL REFERENCES bulk_lots(id) ON DELETE SET NULL,
  quantity_kg NUMERIC(12,3) NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. COMPRAS
-- ============================================================================

-- Cabecera de compras (CMP)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  payment_mode VARCHAR NOT NULL CHECK (payment_mode IN ('PAID', 'DEBT')),
  currency_code_snapshot VARCHAR NOT NULL CHECK (currency_code_snapshot IN ('ARS', 'USD')),
  exchange_rate_used NUMERIC(20,6) NULL,
  total_net_source_currency NUMERIC(20,6) NOT NULL CHECK (total_net_source_currency >= 0),
  total_gross_ars NUMERIC(20,6) NOT NULL CHECK (total_gross_ars >= 0),
  observations TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Renglones de compra
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(20,3) NOT NULL CHECK (quantity > 0),
  unit_price_net_source NUMERIC(20,6) NOT NULL CHECK (unit_price_net_source > 0),
  vat_rate_pct NUMERIC(7,4) NOT NULL DEFAULT 21.0000 CHECK (vat_rate_pct >= 0),
  unit_price_gross_ars_snapshot NUMERIC(20,6) NOT NULL,
  line_total_gross_ars NUMERIC(20,6) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- 7. PRECIOS Y DESCUENTOS
-- ============================================================================

-- Listas de precios
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  system_role VARCHAR NULL CHECK (
    system_role IS NULL OR system_role IN ('SALON_DEFAULT', 'PUBLIC_DEFAULT', 'ECOMMERCE_DEFAULT')
  ),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de versiones de precio por producto y lista (pesos enteros)
CREATE TABLE IF NOT EXISTS product_price_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(stock_item_id) ON DELETE CASCADE,
  price_ars NUMERIC(20,0) NOT NULL CHECK (price_ars > 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Perfiles de Costo-Ganancia (simulación y análisis)
CREATE TABLE IF NOT EXISTS discount_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Pasos sucesivos de los perfiles de descuento
CREATE TABLE IF NOT EXISTS discount_profile_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_profile_id UUID NOT NULL REFERENCES discount_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  percent NUMERIC(7,4) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  UNIQUE (discount_profile_id, position)
);

-- ============================================================================
-- 8. PEDIDOS Y VENTAS
-- ============================================================================

-- Pedidos (PED)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR NOT NULL CHECK (status IN ('OPEN', 'CONVERTED', 'CANCELLED')),
  customer_source VARCHAR NOT NULL CHECK (
    customer_source IN ('REGISTERED_CUSTOMER', 'MERCADO_LIBRE', 'CONSUMER_FINAL')
  ),
  customer_id UUID NULL REFERENCES customers(id) ON DELETE RESTRICT,
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE RESTRICT,
  price_snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_name VARCHAR NULL,
  address VARCHAR NULL,
  locality VARCHAR NULL,
  province VARCHAR NULL,
  phone VARCHAR NULL,
  transport_name VARCHAR NULL,
  transport_address VARCHAR NULL,
  package_count INTEGER NULL CHECK (package_count IS NULL OR package_count >= 0),
  planning_sort_key NUMERIC(20,6) NOT NULL DEFAULT 0,
  converted_rto_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_order_customer_source CHECK (
    (customer_source = 'REGISTERED_CUSTOMER' AND customer_id IS NOT NULL) OR
    (customer_source IN ('MERCADO_LIBRE', 'CONSUMER_FINAL') AND customer_id IS NULL)
  )
);

-- Pasos de descuento congelados del Pedido
CREATE TABLE IF NOT EXISTS order_discount_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  percent NUMERIC(7,4) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  UNIQUE (order_id, position)
);

-- Renglones de Pedido
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(stock_item_id) ON DELETE RESTRICT,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  ag_quantity INTEGER NULL CHECK (ag_quantity IS NULL OR ag_quantity >= 0),
  unit_price_ars_snapshot NUMERIC(20,0) NOT NULL CHECK (unit_price_ars_snapshot > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prioridad de filas en la matriz de planificación
CREATE TABLE IF NOT EXISTS planning_product_priorities (
  product_id UUID PRIMARY KEY REFERENCES products(stock_item_id) ON DELETE CASCADE,
  sort_key NUMERIC(20,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remitos de Entrega (RTO) — venta formalizada
CREATE TABLE IF NOT EXISTS remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  status VARCHAR NOT NULL CHECK (status IN ('RTM_PENDING', 'COMPLETED')),
  customer_source VARCHAR NOT NULL CHECK (
    customer_source IN ('REGISTERED_CUSTOMER', 'MERCADO_LIBRE', 'CONSUMER_FINAL')
  ),
  customer_id UUID NULL REFERENCES customers(id) ON DELETE RESTRICT,
  recipient_name_snapshot VARCHAR NULL,
  address_snapshot VARCHAR NULL,
  locality_snapshot VARCHAR NULL,
  province_snapshot VARCHAR NULL,
  phone_snapshot VARCHAR NULL,
  transport_name_snapshot VARCHAR NULL,
  transport_address_snapshot VARCHAR NULL,
  package_count_snapshot INTEGER NULL CHECK (package_count_snapshot IS NULL OR package_count_snapshot >= 0),
  weight_kg_snapshot NUMERIC(12,3) NOT NULL CHECK (weight_kg_snapshot >= 0),
  subtotal_ars NUMERIC(20,6) NOT NULL,
  total_order_ars NUMERIC(20,6) NOT NULL,
  prior_balance_snapshot_ars NUMERIC(20,6) NOT NULL DEFAULT 0,
  total_to_collect_ars NUMERIC(20,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot de descuentos calculados para el Remito
CREATE TABLE IF NOT EXISTS remittance_discount_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES remittances(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  percent NUMERIC(7,4) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  amount_ars_snapshot NUMERIC(20,6) NOT NULL,
  UNIQUE (remittance_id, position)
);

-- Renglones enviados del Remito (solo productos con AG > 0)
CREATE TABLE IF NOT EXISTS remittance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES remittances(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(stock_item_id) ON DELETE RESTRICT,
  product_code_snapshot VARCHAR NOT NULL,
  product_name_snapshot VARCHAR NOT NULL,
  presentation_snapshot VARCHAR NOT NULL,
  weight_kg_snapshot NUMERIC(12,3) NOT NULL,
  quantity_sent INTEGER NOT NULL CHECK (quantity_sent > 0),
  unit_price_ars_snapshot NUMERIC(20,0) NOT NULL,
  line_total_ars NUMERIC(20,6) NOT NULL
);

-- Remito de Margen / Costo-Ganancia (RTM)
CREATE TABLE IF NOT EXISTS margin_remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  remittance_id UUID NOT NULL UNIQUE REFERENCES remittances(id) ON DELETE RESTRICT,
  products_cost_total_ars NUMERIC(20,6) NOT NULL,
  transport_cost_ars NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (transport_cost_ars >= 0),
  gain_ars NUMERIC(20,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot de costo teórico individual de cada producto al emitir RTM
CREATE TABLE IF NOT EXISTS margin_remittance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  margin_remittance_id UUID NOT NULL REFERENCES margin_remittances(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(stock_item_id) ON DELETE RESTRICT,
  quantity_sent INTEGER NOT NULL CHECK (quantity_sent > 0),
  unit_cost_theoretical_snapshot_ars NUMERIC(20,6) NOT NULL,
  total_cost_snapshot_ars NUMERIC(20,6) NOT NULL
);

-- ============================================================================
-- 9. PATRIMONIO Y TESORERÍA
-- ============================================================================

-- Cuentas patrimoniales reales (Caja Steffen, Caja ML, Clientes y Proveedores)
CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type VARCHAR NOT NULL CHECK (
    account_type IN ('CASH_STEFFEN', 'CASH_MERCADO_LIBRE', 'CUSTOMER_RECEIVABLE', 'SUPPLIER_PAYABLE')
  ),
  name VARCHAR NOT NULL,
  customer_id UUID UNIQUE NULL REFERENCES customers(id) ON DELETE RESTRICT,
  supplier_id UUID UNIQUE NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  current_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_financial_account_target CHECK (
    (account_type = 'CUSTOMER_RECEIVABLE' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
    (account_type = 'SUPPLIER_PAYABLE' AND supplier_id IS NOT NULL AND customer_id IS NULL) OR
    (account_type IN ('CASH_STEFFEN', 'CASH_MERCADO_LIBRE') AND customer_id IS NULL AND supplier_id IS NULL)
  )
);

-- Cabecera de movimientos patrimoniales (MOV)
CREATE TABLE IF NOT EXISTS patrimonial_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  operation_id UUID NOT NULL REFERENCES business_operations(id) ON DELETE RESTRICT,
  movement_type VARCHAR NOT NULL CHECK (
    movement_type IN (
      'RETIRO',
      'COMPRA',
      'PAGO_PROVEEDOR',
      'PAGO_CLIENTE',
      'TRANSPORTE',
      'VENTA',
      'GASTO_OPERATIVO',
      'TRANSFERENCIA_MERCADO_LIBRE'
    )
  ),
  description TEXT NOT NULL,
  amount_ars NUMERIC(20,6) NOT NULL CHECK (amount_ars >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger contable de variaciones patrimoniales
CREATE TABLE IF NOT EXISTS financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonial_movement_id UUID NOT NULL REFERENCES patrimonial_movements(id) ON DELETE CASCADE,
  financial_account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  delta_ars NUMERIC(20,6) NOT NULL CHECK (delta_ars != 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pagos (Cliente o Proveedor)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  payment_type VARCHAR NOT NULL CHECK (payment_type IN ('CUSTOMER', 'SUPPLIER')),
  customer_id UUID NULL REFERENCES customers(id) ON DELETE RESTRICT,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  amount_ars NUMERIC(20,6) NOT NULL CHECK (amount_ars > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_payment_party CHECK (
    (payment_type = 'CUSTOMER' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
    (payment_type = 'SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL)
  )
);

-- Gastos operativos
CREATE TABLE IF NOT EXISTS operating_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  expense_type VARCHAR NOT NULL CHECK (expense_type IN ('LUZ', 'ALQUILER', 'COMISIÓN', 'OTRO')),
  description TEXT NULL,
  amount_ars NUMERIC(20,6) NOT NULL CHECK (amount_ars > 0),
  source_account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_other_expense_description CHECK (
    expense_type != 'OTRO' OR (description IS NOT NULL AND TRIM(description) != '')
  )
);

-- Retiros de socios/titular
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount_ars NUMERIC(20,6) NOT NULL CHECK (amount_ars > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Liquidaciones de Mercado Libre
CREATE TABLE IF NOT EXISTS marketplace_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  gross_amount_ars NUMERIC(20,6) NOT NULL CHECK (gross_amount_ars > 0),
  net_amount_ars NUMERIC(20,6) NOT NULL CHECK (net_amount_ars >= 0),
  commission_amount_ars NUMERIC(20,6) NOT NULL CHECK (commission_amount_ars >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_marketplace_settlement_balance CHECK (
    gross_amount_ars = net_amount_ars + commission_amount_ars
  )
);

-- ============================================================================
-- 10. DOCUMENTOS GENERADOS (AUDITORÍA Y STORAGE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR NOT NULL CHECK (
    document_type IN ('RTO', 'RTM', 'CUSTOMER_ACCOUNT_STATEMENT', 'SUPPLIER_ACCOUNT_STATEMENT')
  ),
  source_type VARCHAR NOT NULL,
  source_id UUID NOT NULL,
  renderer_type VARCHAR NOT NULL DEFAULT 'INTERNAL_HTML_PDF' CHECK (
    renderer_type IN ('INTERNAL_HTML_PDF', 'N8N_WEBHOOK')
  ),
  template_key VARCHAR NOT NULL,
  template_version VARCHAR NOT NULL,
  payload_snapshot JSONB NOT NULL,
  generation_status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (
    generation_status IN ('PENDING', 'READY', 'FAILED')
  ),
  file_reference TEXT NULL,
  file_size_bytes BIGINT NULL,
  error_message TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  generated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_ready_file_ref CHECK (
    generation_status != 'READY' OR file_reference IS NOT NULL
  )
);
