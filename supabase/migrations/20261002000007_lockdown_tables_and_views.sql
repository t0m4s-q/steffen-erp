-- ==============================================================================
-- MIGRACIÓN 20261002000007: Bloqueo de seguridad (RLS y Grants) en tablas y vistas
-- 1. Habilita RLS en las 46 tablas del dominio.
-- 2. Revoca todos los privilegios (SELECT, INSERT, UPDATE, DELETE) en tablas y
--    vistas de PUBLIC, anon y authenticated.
-- 3. Configura security_invoker = true en las 8 vistas analíticas.
-- 4. Otorga todos los permisos exclusivamente al rol de backend: service_role.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Habilitar RLS en las 46 tablas del dominio
-- ------------------------------------------------------------------------------
ALTER TABLE public.code_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_version_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_lot_material_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_component_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_profile_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_discount_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_product_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_discount_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_remittance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrimonial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Configurar security_invoker = true en las 8 vistas analíticas
-- ------------------------------------------------------------------------------
ALTER VIEW public.v_current_stock_priority SET (security_invoker = true);
ALTER VIEW public.v_current_item_cost SET (security_invoker = true);
ALTER VIEW public.v_current_formula_cost SET (security_invoker = true);
ALTER VIEW public.v_current_product_cost SET (security_invoker = true);
ALTER VIEW public.v_customer_balances SET (security_invoker = true);
ALTER VIEW public.v_supplier_debts SET (security_invoker = true);
ALTER VIEW public.v_sales SET (security_invoker = true);
ALTER VIEW public.v_current_reports SET (security_invoker = true);

-- ------------------------------------------------------------------------------
-- 3. Revocar privilegios en tablas y vistas de roles no autorizados
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Revocación explícita sobre las 8 vistas
REVOKE ALL ON public.v_current_stock_priority FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_current_item_cost FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_current_formula_cost FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_current_product_cost FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_customer_balances FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_supplier_debts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_sales FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_current_reports FROM PUBLIC, anon, authenticated;

-- Revocar privilegios por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Otorgar acceso integral exclusivo al rol de servicio del backend (service_role)
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT ON public.v_current_stock_priority TO service_role;
GRANT SELECT ON public.v_current_item_cost TO service_role;
GRANT SELECT ON public.v_current_formula_cost TO service_role;
GRANT SELECT ON public.v_current_product_cost TO service_role;
GRANT SELECT ON public.v_customer_balances TO service_role;
GRANT SELECT ON public.v_supplier_debts TO service_role;
GRANT SELECT ON public.v_sales TO service_role;
GRANT SELECT ON public.v_current_reports TO service_role;
