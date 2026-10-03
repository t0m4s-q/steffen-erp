-- ============================================================================
-- Steffen ERP — Migration 000003: Calculation & Analytical Views
-- Implementa Sección 60 de DATA_MODEL.md
-- ============================================================================

-- 1. Vista de prioridad de stock y criticidad
-- ratio = current_stock / stock_minimum
-- Orden: ratio ASC (críticos primero: ratio < 1)
CREATE OR REPLACE VIEW v_current_stock_priority AS
SELECT 
  si.id AS stock_item_id,
  si.code,
  si.name,
  si.item_type,
  si.unit_type,
  si.stock_minimum,
  COALESCE(sb.quantity, 0) AS current_stock,
  CASE 
    WHEN si.stock_minimum > 0 THEN ROUND(COALESCE(sb.quantity, 0) / si.stock_minimum, 4)
    ELSE 0 
  END AS ratio,
  (COALESCE(sb.quantity, 0) < si.stock_minimum) AS is_critical
FROM stock_items si
LEFT JOIN stock_balances sb ON sb.stock_item_id = si.id
WHERE si.active = true;

-- 2. Motor de costo actual de MPR/COM (con IVA 21%)
-- Usa la relación Proveedor <-> Ítem activa de mayor price_updated_at
-- Si USD, convierte a ARS según cotización global vigente. IVA = 21%
CREATE OR REPLACE VIEW v_current_item_cost AS
WITH ranked_supplier_items AS (
  SELECT 
    si.stock_item_id,
    si.supplier_id,
    s.name AS supplier_name,
    s.currency_code AS supplier_currency,
    si.quoted_unit_price_net,
    si.price_updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY si.stock_item_id 
      ORDER BY si.price_updated_at DESC, si.created_at DESC
    ) AS rn
  FROM supplier_items si
  JOIN suppliers s ON s.id = si.supplier_id
  WHERE si.active = true AND s.active = true
),
latest_usd_rate AS (
  SELECT rate_to_ars
  FROM exchange_rates
  WHERE currency_code = 'USD' AND is_current = true
  ORDER BY effective_at DESC
  LIMIT 1
)
SELECT 
  rsi.stock_item_id,
  rsi.supplier_id,
  rsi.supplier_name,
  rsi.supplier_currency,
  rsi.quoted_unit_price_net,
  rsi.price_updated_at,
  CASE 
    WHEN rsi.supplier_currency = 'ARS' THEN 1.000000
    ELSE COALESCE(lur.rate_to_ars, 1.000000)
  END AS fx_rate_used,
  CASE 
    WHEN rsi.supplier_currency = 'ARS' THEN rsi.quoted_unit_price_net
    ELSE rsi.quoted_unit_price_net * COALESCE(lur.rate_to_ars, 1.000000)
  END AS net_price_ars,
  0.2100 AS vat_rate_pct,
  ROUND(
    (CASE 
      WHEN rsi.supplier_currency = 'ARS' THEN rsi.quoted_unit_price_net
      ELSE rsi.quoted_unit_price_net * COALESCE(lur.rate_to_ars, 1.000000)
    END) * 1.210000, 
    6
  ) AS unit_cost_gross_ars
FROM ranked_supplier_items rsi
LEFT JOIN latest_usd_rate lur ON true
WHERE rsi.rn = 1;

-- 3. Costo teórico actual por PBA (Fórmula vigente)
-- Suma de las materias primas valorizadas a costo actual bruto con IVA
CREATE OR REPLACE VIEW v_current_formula_cost AS
SELECT 
  bp.id AS base_product_id,
  bp.code AS base_product_code,
  bp.name AS base_product_name,
  fv.id AS formula_version_id,
  fv.version_number,
  COALESCE(SUM(fvi.quantity_kg), 0) AS total_kg,
  COALESCE(SUM(fvi.quantity_kg * COALESCE(cic.unit_cost_gross_ars, 0)), 0) AS total_bulk_cost_ars,
  CASE 
    WHEN COALESCE(SUM(fvi.quantity_kg), 0) > 0 
    THEN ROUND(COALESCE(SUM(fvi.quantity_kg * COALESCE(cic.unit_cost_gross_ars, 0)), 0) / SUM(fvi.quantity_kg), 6)
    ELSE 0 
  END AS cost_per_kg_ars
FROM base_products bp
JOIN formula_versions fv ON fv.base_product_id = bp.id AND fv.is_current = true
LEFT JOIN formula_version_items fvi ON fvi.formula_version_id = fv.id
LEFT JOIN v_current_item_cost cic ON cic.stock_item_id = fvi.raw_material_id
WHERE bp.active = true
GROUP BY bp.id, bp.code, bp.name, fv.id, fv.version_number;

-- 4. Costo teórico actual por Producto Terminado (PRO)
-- costo base = peso * costo_kg_pba
-- costo componentes = suma(cantidad * costo_componente)
-- extra variable = subtotal * 2%
-- costo total = subtotal + extra variable
CREATE OR REPLACE VIEW v_current_product_cost AS
WITH product_components_cost AS (
  SELECT 
    pc.product_id,
    COALESCE(SUM(pc.quantity_per_unit * COALESCE(cic.unit_cost_gross_ars, 0)), 0) AS components_cost_ars
  FROM product_components pc
  LEFT JOIN v_current_item_cost cic ON cic.stock_item_id = pc.component_id
  GROUP BY pc.product_id
)
SELECT 
  p.stock_item_id AS product_id,
  si.code AS product_code,
  si.name AS product_name,
  p.presentation,
  p.weight_kg,
  p.base_product_id,
  COALESCE(p.weight_kg * cfc.cost_per_kg_ars, 0) AS base_cost_ars,
  COALESCE(pcc.components_cost_ars, 0) AS components_cost_ars,
  (COALESCE(p.weight_kg * cfc.cost_per_kg_ars, 0) + COALESCE(pcc.components_cost_ars, 0)) AS subtotal_cost_ars,
  p.extra_variable_pct,
  ROUND(
    (COALESCE(p.weight_kg * cfc.cost_per_kg_ars, 0) + COALESCE(pcc.components_cost_ars, 0)) * (p.extra_variable_pct / 100.0000),
    6
  ) AS extra_variable_cost_ars,
  ROUND(
    (COALESCE(p.weight_kg * cfc.cost_per_kg_ars, 0) + COALESCE(pcc.components_cost_ars, 0)) * (1.0000 + (p.extra_variable_pct / 100.0000)),
    6
  ) AS total_product_cost_ars
FROM products p
JOIN stock_items si ON si.id = p.stock_item_id
LEFT JOIN v_current_formula_cost cfc ON cfc.base_product_id = p.base_product_id
LEFT JOIN product_components_cost pcc ON pcc.product_id = p.stock_item_id
WHERE si.active = true;

-- 5. Saldos de cuentas corrientes de Clientes
CREATE OR REPLACE VIEW v_customer_balances AS
SELECT 
  c.id AS customer_id,
  c.code,
  c.name,
  c.category,
  c.phone,
  c.active,
  fa.id AS financial_account_id,
  COALESCE(fa.current_balance, 0) AS current_balance_ars,
  c.updated_at
FROM customers c
LEFT JOIN financial_accounts fa ON fa.customer_id = c.id AND fa.account_type = 'CUSTOMER_RECEIVABLE';

-- 6. Deudas con Proveedores (solo balance > 0 donde Steffen debe)
CREATE OR REPLACE VIEW v_supplier_debts AS
SELECT 
  s.id AS supplier_id,
  s.code,
  s.name,
  s.currency_code,
  s.phone,
  s.active,
  fa.id AS financial_account_id,
  fa.current_balance AS debt_balance_ars
FROM suppliers s
JOIN financial_accounts fa ON fa.supplier_id = s.id AND fa.account_type = 'SUPPLIER_PAYABLE'
WHERE fa.current_balance > 0;

-- 7. Ventas formalizadas completas (RTO + RTM COMPLETED)
CREATE OR REPLACE VIEW v_sales AS
SELECT 
  r.id AS remittance_id,
  r.code AS rto_code,
  mr.id AS margin_remittance_id,
  mr.code AS rtm_code,
  bo.business_date,
  r.customer_source,
  r.customer_id,
  c.name AS customer_name,
  r.recipient_name_snapshot,
  r.total_order_ars,
  mr.products_cost_total_ars,
  mr.transport_cost_ars,
  mr.gain_ars,
  r.created_at
FROM remittances r
JOIN margin_remittances mr ON mr.remittance_id = r.id
JOIN business_operations bo ON bo.id = r.operation_id
LEFT JOIN customers c ON c.id = r.customer_id
WHERE r.status = 'COMPLETED';

-- 8. Cuatro métricas oficiales de Reportes
-- sales_current_month: COUNT(RTO COMPLETED del mes corriente)
-- billed_current_month_ars: SUM(remittances.total_order_ars de RTO COMPLETED del mes corriente)
-- gain_current_month_ars: SUM(margin_remittances.gain_ars asociados a esos RTO)
-- open_orders: COUNT(orders WHERE status = OPEN) sin filtro mensual
CREATE OR REPLACE VIEW v_current_reports AS
WITH monthly_completed_sales AS (
  SELECT 
    r.total_order_ars,
    mr.gain_ars
  FROM remittances r
  JOIN margin_remittances mr ON mr.remittance_id = r.id
  JOIN business_operations bo ON bo.id = r.operation_id
  WHERE r.status = 'COMPLETED'
    AND DATE_TRUNC('month', bo.business_date) = DATE_TRUNC('month', CURRENT_DATE)
),
open_orders_count AS (
  SELECT COUNT(*) AS open_orders
  FROM orders
  WHERE status = 'OPEN'
)
SELECT 
  COALESCE(COUNT(mcs.total_order_ars), 0)::BIGINT AS sales_current_month,
  COALESCE(SUM(mcs.total_order_ars), 0)::NUMERIC(20,6) AS billed_current_month_ars,
  COALESCE(SUM(mcs.gain_ars), 0)::NUMERIC(20,6) AS gain_current_month_ars,
  (SELECT open_orders FROM open_orders_count)::BIGINT AS open_orders
FROM monthly_completed_sales mcs;
