-- Migración 00015: Fabricación Atómica de Granel (Fase 6)
-- Implementa la RPC transaccional manufacture_bulk_lot_atomic
-- Garantiza en una única transacción PostgreSQL ACID:
-- 1. Validación de base_product y versión inmutable (is_current = true y pertenece al PBA).
-- 2. Lectura autoritativa de fórmula y cálculo proporcional de consumos en PostgreSQL.
-- 3. Validación de snapshot de costos por MPR (sin faltantes, extras ni duplicados).
-- 4. Bloqueo determinista de stock_items en orden ascendente (raw_material_id ASC) para evitar deadlocks.
-- 5. Validación completa de disponibilidad previa (saldo >= requerido, no negativo).
-- 6. Creación de business_operations (BULK_PRODUCTION).
-- 7. Generación de código GRAxxxx y creación de bulk_lots (status = OPEN, kg_available = kg_fabricated).
-- 8. Creación de bulk_lot_material_snapshots para congelar costos históricos.
-- 9. Descuento de stock y generación de MSTxxxx para cada MPR mediante apply_stock_movement.
-- 10. Generación de código MFAxxxx y registro en factory_movements (FABRICACIÓN).

CREATE OR REPLACE FUNCTION public.manufacture_bulk_lot_atomic(
  p_base_product_id UUID,
  p_formula_version_id UUID,
  p_kg_fabricated NUMERIC(12,3),
  p_business_date DATE DEFAULT NULL,
  p_observations TEXT DEFAULT NULL,
  p_cost_snapshots JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base_product_name VARCHAR;
  v_base_product_active BOOLEAN;
  v_version_number INT;
  v_is_current BOOLEAN;
  v_base_formula_kg NUMERIC(12,3);
  v_formula_item_count INT;
  v_formula_mpr_ids UUID[];
  v_snap_count INT;
  v_factor NUMERIC(28,14);
  v_fvi RECORD;
  v_req_kg NUMERIC(12,3);
  v_current_balance NUMERIC(14,3);
  v_mpr_code VARCHAR(30);
  v_operation_id UUID;
  v_gra_code VARCHAR(30);
  v_mfa_code VARCHAR(30);
  v_bulk_lot_id UUID;
  v_snap_elem JSONB;
  v_source_supplier_id UUID;
  v_source_currency VARCHAR;
  v_source_unit_price_net NUMERIC(20,6);
  v_fx_rate_snapshot NUMERIC(20,6);
  v_vat_rate_pct NUMERIC(7,4);
  v_unit_cost_gross_ars NUMERIC(20,6);
  v_mpr_total_cost_ars NUMERIC(20,6);
  v_total_cost_snapshot_ars NUMERIC(20,6) := 0;
  v_cost_per_kg_snapshot_ars NUMERIC(20,6) := 0;
  v_business_date DATE;
BEGIN
  -- 1. Validaciones de entrada
  IF p_base_product_id IS NULL THEN
    RAISE EXCEPTION 'El base_product_id es obligatorio.';
  END IF;

  IF p_formula_version_id IS NULL THEN
    RAISE EXCEPTION 'El formula_version_id es obligatorio.';
  END IF;

  IF p_kg_fabricated IS NULL OR p_kg_fabricated <= 0 THEN
    RAISE EXCEPTION 'La cantidad a fabricar debe ser mayor a 0 kg.';
  END IF;

  IF p_kg_fabricated <> pg_catalog.round(p_kg_fabricated, 3) THEN
    RAISE EXCEPTION 'La cantidad a fabricar no puede exceder 3 decimales de precisión (kg).';
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 2. Validar que el Producto Base existe y está activo
  SELECT name, active INTO v_base_product_name, v_base_product_active
  FROM public.base_products
  WHERE id = p_base_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto Base % no encontrado.', p_base_product_id;
  END IF;

  IF NOT v_base_product_active THEN
    RAISE EXCEPTION 'El Producto Base % está inactivo.', v_base_product_name;
  END IF;

  -- 3. Validar versión de fórmula inmutable (pertenencia y vigencia)
  SELECT version_number, is_current INTO v_version_number, v_is_current
  FROM public.formula_versions
  WHERE id = p_formula_version_id AND base_product_id = p_base_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La versión de fórmula % no pertenece al Producto Base %.', p_formula_version_id, p_base_product_id;
  END IF;

  IF NOT v_is_current THEN
    RAISE EXCEPTION 'La versión de fórmula seleccionada (v%) ya no es la versión vigente del Producto Base. Recargue la pantalla antes de fabricar.',
      v_version_number;
  END IF;

  -- 4. Obtener items de fórmula y calcular total kg base
  SELECT
    COALESCE(pg_catalog.sum(quantity_kg), 0),
    pg_catalog.count(*),
    pg_catalog.array_agg(raw_material_id ORDER BY raw_material_id ASC)
  INTO v_base_formula_kg, v_formula_item_count, v_formula_mpr_ids
  FROM public.formula_version_items
  WHERE formula_version_id = p_formula_version_id;

  IF v_formula_item_count = 0 THEN
    RAISE EXCEPTION 'La fórmula vigente no contiene materias primas.';
  END IF;

  IF v_base_formula_kg <= 0 THEN
    RAISE EXCEPTION 'El peso total de la fórmula base debe ser mayor a 0 kg.';
  END IF;

  -- 5. Validar snapshot de costos
  IF pg_catalog.jsonb_typeof(p_cost_snapshots) <> 'array' THEN
    RAISE EXCEPTION 'p_cost_snapshots debe ser un array JSONB.';
  END IF;

  SELECT pg_catalog.count(*) INTO v_snap_count
  FROM pg_catalog.jsonb_array_elements(p_cost_snapshots) AS elem(val);

  IF (SELECT pg_catalog.count(DISTINCT (elem.val->>'raw_material_id')::UUID)
      FROM pg_catalog.jsonb_array_elements(p_cost_snapshots) AS elem(val)) <> v_snap_count THEN
    RAISE EXCEPTION 'El snapshot de costos contiene materias primas duplicadas.';
  END IF;

  IF v_snap_count < v_formula_item_count THEN
    RAISE EXCEPTION 'El snapshot de costos tiene materias primas faltantes respecto a la fórmula.';
  END IF;

  IF v_snap_count > v_formula_item_count THEN
    RAISE EXCEPTION 'El snapshot de costos contiene materias primas extra que no pertenecen a la fórmula.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.formula_version_items fvi
    WHERE fvi.formula_version_id = p_formula_version_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_cost_snapshots) AS snap(val)
      WHERE (snap.val->>'raw_material_id')::UUID = fvi.raw_material_id
    )
  ) THEN
    RAISE EXCEPTION 'El snapshot de costos tiene materias primas faltantes respecto a la fórmula.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_cost_snapshots) AS snap(val)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.formula_version_items fvi
      WHERE fvi.formula_version_id = p_formula_version_id
      AND fvi.raw_material_id = (snap.val->>'raw_material_id')::UUID
    )
  ) THEN
    RAISE EXCEPTION 'El snapshot de costos contiene materias primas extra que no pertenecen a la fórmula.';
  END IF;

  -- 6. Locking determinista de todas las MPR en orden ascendente (raw_material_id ASC) para prevenir deadlocks
  PERFORM id
  FROM public.stock_items
  WHERE id = ANY(v_formula_mpr_ids)
  ORDER BY id ASC
  FOR UPDATE;

  -- 7. Factor de escala proporcional
  v_factor := p_kg_fabricated / v_base_formula_kg;

  -- 8. Pre-validar disponibilidad física de todas las MPR antes de alterar ningún saldo
  FOR v_fvi IN
    SELECT raw_material_id, quantity_kg
    FROM public.formula_version_items
    WHERE formula_version_id = p_formula_version_id
    ORDER BY raw_material_id ASC
  LOOP
    v_req_kg := pg_catalog.round(v_fvi.quantity_kg * v_factor, 3);
    IF v_req_kg <= 0 THEN
      RAISE EXCEPTION 'La cantidad requerida de materia prima (%) debe ser mayor a 0.', v_fvi.raw_material_id;
    END IF;

    SELECT quantity INTO v_current_balance
    FROM public.stock_balances
    WHERE stock_item_id = v_fvi.raw_material_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_current_balance := 0;
    END IF;

    IF v_current_balance < v_req_kg THEN
      SELECT code INTO v_mpr_code FROM public.stock_items WHERE id = v_fvi.raw_material_id;
      RAISE EXCEPTION 'Stock insuficiente para la materia prima %: saldo actual (%), requerido (%).',
        COALESCE(v_mpr_code, v_fvi.raw_material_id::text), v_current_balance, v_req_kg
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  -- 9. Crear operación de negocio BULK_PRODUCTION
  INSERT INTO public.business_operations (
    operation_type,
    business_date
  ) VALUES (
    'BULK_PRODUCTION',
    v_business_date
  ) RETURNING id INTO v_operation_id;

  -- 10. Generar códigos secuenciales oficiales
  v_gra_code := public.get_next_code_sequence('GRA');
  v_mfa_code := public.get_next_code_sequence('MFA');

  -- 11. Calcular costo histórico total a partir del snapshot provisto
  FOR v_fvi IN
    SELECT raw_material_id, quantity_kg
    FROM public.formula_version_items
    WHERE formula_version_id = p_formula_version_id
    ORDER BY raw_material_id ASC
  LOOP
    v_req_kg := pg_catalog.round(v_fvi.quantity_kg * v_factor, 3);

    SELECT elem.val INTO v_snap_elem
    FROM pg_catalog.jsonb_array_elements(p_cost_snapshots) AS elem(val)
    WHERE (elem.val->>'raw_material_id')::UUID = v_fvi.raw_material_id;

    v_unit_cost_gross_ars := COALESCE((v_snap_elem->>'unit_cost_gross_ars_snapshot')::NUMERIC, 0);
    v_mpr_total_cost_ars := pg_catalog.round(v_req_kg * v_unit_cost_gross_ars, 6);

    v_total_cost_snapshot_ars := v_total_cost_snapshot_ars + v_mpr_total_cost_ars;
  END LOOP;

  v_cost_per_kg_snapshot_ars := pg_catalog.round(v_total_cost_snapshot_ars / p_kg_fabricated, 6);

  -- 12. Crear lote físico de granel (bulk_lots)
  INSERT INTO public.bulk_lots (
    code,
    operation_id,
    base_product_id,
    formula_version_id,
    kg_fabricated,
    kg_available,
    status,
    observations,
    total_cost_snapshot_ars,
    cost_per_kg_snapshot_ars
  ) VALUES (
    v_gra_code,
    v_operation_id,
    p_base_product_id,
    p_formula_version_id,
    p_kg_fabricated,
    p_kg_fabricated,
    'OPEN',
    p_observations,
    v_total_cost_snapshot_ars,
    v_cost_per_kg_snapshot_ars
  ) RETURNING id INTO v_bulk_lot_id;

  -- 13. Persistir bulk_lot_material_snapshots y registrar movimientos MST tipo FABRICACIÓN
  FOR v_fvi IN
    SELECT raw_material_id, quantity_kg
    FROM public.formula_version_items
    WHERE formula_version_id = p_formula_version_id
    ORDER BY raw_material_id ASC
  LOOP
    v_req_kg := pg_catalog.round(v_fvi.quantity_kg * v_factor, 3);

    SELECT elem.val INTO v_snap_elem
    FROM pg_catalog.jsonb_array_elements(p_cost_snapshots) AS elem(val)
    WHERE (elem.val->>'raw_material_id')::UUID = v_fvi.raw_material_id;

    v_source_supplier_id := NULL;
    IF (v_snap_elem->>'source_supplier_id') IS NOT NULL AND pg_catalog.btrim(v_snap_elem->>'source_supplier_id') <> '' THEN
      v_source_supplier_id := (v_snap_elem->>'source_supplier_id')::UUID;
    END IF;

    v_source_currency := COALESCE(v_snap_elem->>'source_currency', 'ARS');
    v_source_unit_price_net := COALESCE((v_snap_elem->>'source_unit_price_net')::NUMERIC, 0);

    v_fx_rate_snapshot := NULL;
    IF (v_snap_elem->>'fx_rate_snapshot') IS NOT NULL AND pg_catalog.btrim(v_snap_elem->>'fx_rate_snapshot') <> '' THEN
      v_fx_rate_snapshot := (v_snap_elem->>'fx_rate_snapshot')::NUMERIC;
    END IF;

    v_vat_rate_pct := COALESCE((v_snap_elem->>'vat_rate_pct')::NUMERIC, 21.0000);
    v_unit_cost_gross_ars := COALESCE((v_snap_elem->>'unit_cost_gross_ars_snapshot')::NUMERIC, 0);
    v_mpr_total_cost_ars := pg_catalog.round(v_req_kg * v_unit_cost_gross_ars, 6);

    INSERT INTO public.bulk_lot_material_snapshots (
      bulk_lot_id,
      raw_material_id,
      quantity_kg,
      source_supplier_id,
      source_currency,
      source_unit_price_net,
      fx_rate_snapshot,
      vat_rate_pct,
      unit_cost_gross_ars_snapshot,
      total_cost_ars_snapshot
    ) VALUES (
      v_bulk_lot_id,
      v_fvi.raw_material_id,
      v_req_kg,
      v_source_supplier_id,
      v_source_currency,
      v_source_unit_price_net,
      v_fx_rate_snapshot,
      v_vat_rate_pct,
      v_unit_cost_gross_ars,
      v_mpr_total_cost_ars
    );

    -- Descontar stock mediante apply_stock_movement (misma transacción, MST FABRICACIÓN)
    PERFORM public.apply_stock_movement(
      v_operation_id,
      v_fvi.raw_material_id,
      'FABRICACIÓN',
      -v_req_kg,
      'Consumo de fabricación para lote ' || v_gra_code
    );
  END LOOP;

  -- 14. Registrar movimiento de fábrica MFAxxxx tipo FABRICACIÓN
  INSERT INTO public.factory_movements (
    code,
    operation_id,
    movement_type,
    base_product_id,
    bulk_lot_id,
    quantity_kg,
    description
  ) VALUES (
    v_mfa_code,
    v_operation_id,
    'FABRICACIÓN',
    p_base_product_id,
    v_bulk_lot_id,
    p_kg_fabricated,
    'Se fabricó un granel de ' || v_base_product_name
  );

  -- 15. Retornar payload resultante
  RETURN pg_catalog.jsonb_build_object(
    'operation_id', v_operation_id,
    'bulk_lot_id', v_bulk_lot_id,
    'gra_code', v_gra_code,
    'mfa_code', v_mfa_code,
    'base_product_id', p_base_product_id,
    'formula_version_id', p_formula_version_id,
    'kg_fabricated', p_kg_fabricated::text,
    'kg_available', p_kg_fabricated::text,
    'total_cost_snapshot_ars', v_total_cost_snapshot_ars::text,
    'cost_per_kg_snapshot_ars', v_cost_per_kg_snapshot_ars::text
  );
END;
$$;

-- Permisos estrictos de seguridad
REVOKE ALL ON FUNCTION public.manufacture_bulk_lot_atomic(UUID, UUID, NUMERIC, DATE, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manufacture_bulk_lot_atomic(UUID, UUID, NUMERIC, DATE, TEXT, JSONB) TO service_role;
