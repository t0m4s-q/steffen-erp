-- ==============================================================================
-- MIGRACIÓN 20261002000008: Funciones transaccionales atómicas para altas maestras de Fase 4
-- 1. create_customer_with_account: Alta de cliente + cuenta corriente CUSTOMER_RECEIVABLE
-- 2. create_supplier_with_account: Alta de proveedor + cuenta corriente SUPPLIER_PAYABLE
-- 3. create_master_item: Alta de MPR/COM + subtipo + relación proveedor + saldo inicial vía apply_stock_movement
-- Todas con SECURITY DEFINER, SET search_path = '' y permisos exclusivos para service_role.
-- ==============================================================================

-- 1. Alta integral atómica de Cliente
CREATE OR REPLACE FUNCTION public.create_customer_with_account(
  p_name VARCHAR,
  p_dni VARCHAR DEFAULT NULL,
  p_address VARCHAR DEFAULT NULL,
  p_locality VARCHAR DEFAULT NULL,
  p_province VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_transport_name VARCHAR DEFAULT NULL,
  p_transport_address VARCHAR DEFAULT NULL,
  p_category VARCHAR DEFAULT NULL,
  p_discount_1_pct NUMERIC(7,4) DEFAULT 0,
  p_discount_2_pct NUMERIC(7,4) DEFAULT 0,
  p_discount_3_pct NUMERIC(7,4) DEFAULT 0,
  p_created_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name VARCHAR;
  v_code VARCHAR(30);
  v_customer_id UUID;
  v_account_id UUID;
  v_created_date DATE;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
  v_d1 NUMERIC(7,4);
  v_d2 NUMERIC(7,4);
  v_d3 NUMERIC(7,4);
BEGIN
  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio.';
  END IF;

  v_d1 := COALESCE(p_discount_1_pct, 0);
  v_d2 := COALESCE(p_discount_2_pct, 0);
  v_d3 := COALESCE(p_discount_3_pct, 0);

  IF v_d1 < 0 OR v_d1 > 100 OR v_d2 < 0 OR v_d2 > 100 OR v_d3 < 0 OR v_d3 > 100 THEN
    RAISE EXCEPTION 'Los descuentos deben estar en el rango de 0 a 100.';
  END IF;

  v_created_date := COALESCE(p_created_date, CURRENT_DATE);

  -- 1. Generar código visible atómico (CLIxxxx)
  v_code := public.get_next_code_sequence('CLI');

  -- 2. Insertar cliente
  INSERT INTO public.customers (
    code,
    name,
    dni,
    address,
    locality,
    province,
    phone,
    transport_name,
    transport_address,
    category,
    discount_1_pct,
    discount_2_pct,
    discount_3_pct,
    created_date,
    active
  ) VALUES (
    v_code,
    v_name,
    NULLIF(pg_catalog.btrim(p_dni), ''),
    NULLIF(pg_catalog.btrim(p_address), ''),
    NULLIF(pg_catalog.btrim(p_locality), ''),
    NULLIF(pg_catalog.btrim(p_province), ''),
    NULLIF(pg_catalog.btrim(p_phone), ''),
    NULLIF(pg_catalog.btrim(p_transport_name), ''),
    NULLIF(pg_catalog.btrim(p_transport_address), ''),
    NULLIF(pg_catalog.btrim(p_category), ''),
    v_d1,
    v_d2,
    v_d3,
    v_created_date,
    true
  )
  RETURNING id, created_at, updated_at INTO v_customer_id, v_created_at, v_updated_at;

  -- 3. Crear cuenta contable CUSTOMER_RECEIVABLE
  INSERT INTO public.financial_accounts (
    name,
    account_type,
    customer_id,
    supplier_id,
    current_balance,
    active
  ) VALUES (
    'CC Cliente - ' || v_name,
    'CUSTOMER_RECEIVABLE',
    v_customer_id,
    NULL,
    0,
    true
  )
  RETURNING id INTO v_account_id;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_customer_id,
    'code', v_code,
    'name', v_name,
    'dni', p_dni,
    'address', p_address,
    'locality', p_locality,
    'province', p_province,
    'phone', p_phone,
    'transport_name', p_transport_name,
    'transport_address', p_transport_address,
    'category', p_category,
    'discount_1_pct', v_d1,
    'discount_2_pct', v_d2,
    'discount_3_pct', v_d3,
    'created_date', v_created_date,
    'active', true,
    'created_at', v_created_at,
    'updated_at', v_updated_at,
    'financial_account_id', v_account_id
  );
END;
$$;

-- 2. Alta integral atómica de Proveedor
CREATE OR REPLACE FUNCTION public.create_supplier_with_account(
  p_name VARCHAR,
  p_currency_code VARCHAR,
  p_salesperson VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_created_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name VARCHAR;
  v_currency VARCHAR;
  v_code VARCHAR(30);
  v_supplier_id UUID;
  v_account_id UUID;
  v_created_date DATE;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
BEGIN
  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'El nombre del proveedor es obligatorio.';
  END IF;

  v_currency := pg_catalog.upper(pg_catalog.btrim(p_currency_code));
  IF v_currency IS NULL OR v_currency NOT IN ('ARS', 'USD') THEN
    RAISE EXCEPTION 'Moneda inválida para proveedor: %. Debe ser ARS o USD.', p_currency_code;
  END IF;

  v_created_date := COALESCE(p_created_date, CURRENT_DATE);

  -- 1. Generar código visible atómico (PRVxxxx)
  v_code := public.get_next_code_sequence('PRV');

  -- 2. Insertar proveedor
  INSERT INTO public.suppliers (
    code,
    name,
    salesperson,
    phone,
    currency_code,
    created_date,
    active
  ) VALUES (
    v_code,
    v_name,
    NULLIF(pg_catalog.btrim(p_salesperson), ''),
    NULLIF(pg_catalog.btrim(p_phone), ''),
    v_currency,
    v_created_date,
    true
  )
  RETURNING id, created_at, updated_at INTO v_supplier_id, v_created_at, v_updated_at;

  -- 3. Crear cuenta contable SUPPLIER_PAYABLE
  INSERT INTO public.financial_accounts (
    name,
    account_type,
    supplier_id,
    customer_id,
    current_balance,
    active
  ) VALUES (
    'CC Proveedor - ' || v_name,
    'SUPPLIER_PAYABLE',
    v_supplier_id,
    NULL,
    0,
    true
  )
  RETURNING id INTO v_account_id;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_supplier_id,
    'code', v_code,
    'name', v_name,
    'salesperson', p_salesperson,
    'phone', p_phone,
    'currency_code', v_currency,
    'created_date', v_created_date,
    'active', true,
    'created_at', v_created_at,
    'updated_at', v_updated_at,
    'financial_account_id', v_account_id
  );
END;
$$;

-- 3. Alta integral atómica de Materia Prima / Componente
CREATE OR REPLACE FUNCTION public.create_master_item(
  p_item_type VARCHAR,
  p_name VARCHAR,
  p_stock_minimum NUMERIC(20,3),
  p_initial_supplier_id UUID,
  p_initial_quoted_price_net NUMERIC(20,6),
  p_initial_stock NUMERIC(20,3) DEFAULT 0,
  p_inci VARCHAR DEFAULT NULL,
  p_created_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item_type VARCHAR(10);
  v_unit_type VARCHAR(10);
  v_name VARCHAR;
  v_inci VARCHAR;
  v_initial_stock NUMERIC(20,3);
  v_code VARCHAR(30);
  v_item_id UUID;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
  v_supplier_item_id UUID;
  v_supplier_active BOOLEAN;
  v_supplier_currency VARCHAR(10);
  v_created_date DATE;
  v_operation_id UUID;
  v_movement_result JSONB := NULL;
  v_description TEXT;
BEGIN
  -- Validar tipo de ítem
  v_item_type := pg_catalog.upper(pg_catalog.btrim(p_item_type));
  IF v_item_type NOT IN ('MPR', 'COM') THEN
    RAISE EXCEPTION 'Tipo de ítem maestro inválido: %. Solo se admite MPR o COM.', p_item_type;
  END IF;

  -- Validar nombre
  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'El nombre del ítem es obligatorio.';
  END IF;

  -- Determinar unidad y validar stock mínimo según tipo
  IF p_stock_minimum IS NULL OR p_stock_minimum <= 0 THEN
    RAISE EXCEPTION 'El stock mínimo debe ser estrictamente mayor a 0.';
  END IF;

  v_initial_stock := COALESCE(p_initial_stock, 0);
  IF v_initial_stock < 0 THEN
    RAISE EXCEPTION 'El stock inicial no puede ser negativo.';
  END IF;

  IF v_item_type = 'MPR' THEN
    v_unit_type := 'KG';
    IF p_stock_minimum <> pg_catalog.round(p_stock_minimum, 3) THEN
      RAISE EXCEPTION 'El stock mínimo de Materia Prima (KG) admite como máximo 3 decimales (%).', p_stock_minimum;
    END IF;
    IF v_initial_stock > 0 AND v_initial_stock <> pg_catalog.round(v_initial_stock, 3) THEN
      RAISE EXCEPTION 'El stock inicial de Materia Prima (KG) admite como máximo 3 decimales (%).', v_initial_stock;
    END IF;
    v_inci := NULLIF(pg_catalog.btrim(p_inci), '');
    v_description := 'Stock inicial de alta de Materia Prima';
  ELSE
    v_unit_type := 'UNIT';
    IF p_stock_minimum <> pg_catalog.trunc(p_stock_minimum) THEN
      RAISE EXCEPTION 'El stock mínimo de un Componente (UNIT) debe ser un número entero (%).', p_stock_minimum;
    END IF;
    IF v_initial_stock > 0 AND v_initial_stock <> pg_catalog.trunc(v_initial_stock) THEN
      RAISE EXCEPTION 'El stock inicial de un Componente (UNIT) debe ser un número entero (%).', v_initial_stock;
    END IF;
    v_inci := NULL;
    v_description := 'Stock inicial de alta de Componente';
  END IF;

  -- Validar proveedor inicial
  SELECT active, currency_code INTO v_supplier_active, v_supplier_currency
  FROM public.suppliers
  WHERE id = p_initial_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proveedor inicial % no encontrado.', p_initial_supplier_id;
  END IF;

  IF NOT v_supplier_active THEN
    RAISE EXCEPTION 'El proveedor inicial se encuentra inactivo y no puede ser asignado.';
  END IF;

  -- Validar precio inicial
  IF p_initial_quoted_price_net IS NULL OR p_initial_quoted_price_net <= 0 THEN
    RAISE EXCEPTION 'El precio cotizado inicial debe ser mayor a 0.';
  END IF;

  v_created_date := COALESCE(p_created_date, CURRENT_DATE);

  -- 1. Generar código visible atómico (MPRxxxx o COMxxxx)
  v_code := public.get_next_code_sequence(v_item_type);

  -- 2. Crear registro en stock_items
  INSERT INTO public.stock_items (
    code,
    item_type,
    name,
    unit_type,
    stock_minimum,
    active,
    created_date
  ) VALUES (
    v_code,
    v_item_type,
    v_name,
    v_unit_type,
    p_stock_minimum,
    true,
    v_created_date
  )
  RETURNING id, created_at, updated_at INTO v_item_id, v_created_at, v_updated_at;

  -- 3. Crear subtipo correspondiente
  IF v_item_type = 'MPR' THEN
    INSERT INTO public.raw_materials (stock_item_id, inci)
    VALUES (v_item_id, v_inci);
  ELSE
    INSERT INTO public.components (stock_item_id)
    VALUES (v_item_id);
  END IF;

  -- 4. Asociar proveedor inicial en supplier_items
  INSERT INTO public.supplier_items (
    supplier_id,
    stock_item_id,
    quoted_unit_price_net,
    price_updated_at,
    active
  ) VALUES (
    p_initial_supplier_id,
    v_item_id,
    p_initial_quoted_price_net,
    pg_catalog.now(),
    true
  )
  RETURNING id INTO v_supplier_item_id;

  -- 5. Inicializar saldo consolidado en 0
  INSERT INTO public.stock_balances (stock_item_id, quantity, updated_at)
  VALUES (v_item_id, 0, pg_catalog.now());

  -- 6. Si stock inicial > 0, registrar operación y aplicar movimiento atómico mediante apply_stock_movement
  IF v_initial_stock > 0 THEN
    INSERT INTO public.business_operations (
      operation_type,
      business_date
    ) VALUES (
      'STOCK_ADJUSTMENT',
      v_created_date
    )
    RETURNING id INTO v_operation_id;

    v_movement_result := public.apply_stock_movement(
      v_operation_id,
      v_item_id,
      'AJUSTE',
      v_initial_stock,
      v_description
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_item_id,
    'code', v_code,
    'item_type', v_item_type,
    'name', v_name,
    'unit_type', v_unit_type,
    'stock_minimum', p_stock_minimum,
    'inci', v_inci,
    'active', true,
    'created_date', v_created_date,
    'created_at', v_created_at,
    'updated_at', v_updated_at,
    'supplier_item_id', v_supplier_item_id,
    'initial_supplier_id', p_initial_supplier_id,
    'initial_quoted_price_net', p_initial_quoted_price_net,
    'supplier_currency', v_supplier_currency,
    'initial_stock', v_initial_stock,
    'movement', v_movement_result
  );
END;
$$;

-- 4. Revocar permisos de ejecución a roles no autorizados
REVOKE ALL ON FUNCTION public.create_customer_with_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_supplier_with_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_master_item(VARCHAR, VARCHAR, NUMERIC, UUID, NUMERIC, NUMERIC, VARCHAR, DATE) FROM PUBLIC, anon, authenticated;

-- 5. Otorgar ejecución exclusiva al rol backend (service_role)
GRANT EXECUTE ON FUNCTION public.create_customer_with_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_supplier_with_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_master_item(VARCHAR, VARCHAR, NUMERIC, UUID, NUMERIC, NUMERIC, VARCHAR, DATE) TO service_role;
