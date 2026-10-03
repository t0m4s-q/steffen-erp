-- ============================================================================
-- Steffen ERP — Migration 000002: Indexes and Specific Constraints
-- Implementa Sección 67 de DATA_MODEL.md
-- ============================================================================

-- Cotización vigente única por moneda
CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_rates_current
ON exchange_rates (currency_code)
WHERE is_current = true;

-- Versión vigente única de fórmula por producto base
CREATE UNIQUE INDEX IF NOT EXISTS idx_formula_versions_current
ON formula_versions (base_product_id)
WHERE is_current = true;

-- Versión vigente única de precio por lista y producto
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_price_current
ON product_price_versions (price_list_id, product_id)
WHERE valid_to IS NULL;

-- Rol de sistema único en listas de precios (SALON_DEFAULT, PUBLIC_DEFAULT, ECOMMERCE_DEFAULT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_system_role
ON price_lists (system_role)
WHERE system_role IS NOT NULL;

-- Índices de consulta de maestros y estados
CREATE INDEX IF NOT EXISTS idx_stock_items_type_active
ON stock_items (item_type, active);

CREATE INDEX IF NOT EXISTS idx_stock_balances_quantity
ON stock_balances (quantity);

CREATE INDEX IF NOT EXISTS idx_supplier_items_stock_item
ON supplier_items (stock_item_id, active);

CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier
ON supplier_items (supplier_id, active);

CREATE INDEX IF NOT EXISTS idx_supplier_items_price_updated
ON supplier_items (stock_item_id, price_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_formula_version_items_fv
ON formula_version_items (formula_version_id);

CREATE INDEX IF NOT EXISTS idx_bulk_lots_base_product_status
ON bulk_lots (base_product_id, status);

CREATE INDEX IF NOT EXISTS idx_bulk_lots_status_created
ON bulk_lots (status, created_at);

CREATE INDEX IF NOT EXISTS idx_packaging_ops_bulk_lot
ON packaging_operations (bulk_lot_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_stock_purchase
ON purchase_items (stock_item_id, purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_created
ON purchases (supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_operations_type_date
ON business_operations (operation_type, business_date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_planning
ON orders (status, planning_sort_key);

CREATE INDEX IF NOT EXISTS idx_order_items_order
ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product
ON order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_product_price_lookup
ON product_price_versions (price_list_id, product_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_type
ON financial_accounts (account_type);

CREATE INDEX IF NOT EXISTS idx_financial_entries_account_created
ON financial_entries (financial_account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_created
ON stock_movements (stock_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_factory_movements_created
ON factory_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remittances_created
ON remittances (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_documents_lookup
ON generated_documents (source_type, source_id, generation_status);

-- Triggers automáticos para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_code_sequences') THEN
    CREATE TRIGGER trg_update_code_sequences BEFORE UPDATE ON code_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_business_operations') THEN
    CREATE TRIGGER trg_update_business_operations BEFORE UPDATE ON business_operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_customers') THEN
    CREATE TRIGGER trg_update_customers BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_suppliers') THEN
    CREATE TRIGGER trg_update_suppliers BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_stock_items') THEN
    CREATE TRIGGER trg_update_stock_items BEFORE UPDATE ON stock_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_base_products') THEN
    CREATE TRIGGER trg_update_base_products BEFORE UPDATE ON base_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_supplier_items') THEN
    CREATE TRIGGER trg_update_supplier_items BEFORE UPDATE ON supplier_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_stock_balances') THEN
    CREATE TRIGGER trg_update_stock_balances BEFORE UPDATE ON stock_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_purchases') THEN
    CREATE TRIGGER trg_update_purchases BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_price_lists') THEN
    CREATE TRIGGER trg_update_price_lists BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_orders') THEN
    CREATE TRIGGER trg_update_orders BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_order_items') THEN
    CREATE TRIGGER trg_update_order_items BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_planning_priorities') THEN
    CREATE TRIGGER trg_update_planning_priorities BEFORE UPDATE ON planning_product_priorities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_financial_accounts') THEN
    CREATE TRIGGER trg_update_financial_accounts BEFORE UPDATE ON financial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_payments') THEN
    CREATE TRIGGER trg_update_payments BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
