-- ============================================================================
-- Steffen ERP — Migration 000016: Envasado Atómico (Fase 7)
-- Implementa la RPC autoritativa public.package_product_atomic
-- Flujo productivo: Lote GRA abierto + Componentes (BOM) -> Producto Final (PRO)
-- Gestiona:
-- 1. Compatibilidad estricta GRA (PBA) -> PRO (PBA).
-- 2. Consumo real de granel (unidades * peso_kg).
-- 3. Consumo de componentes según BOM de products (unidades * quantity_per_unit).
-- 4. Exclusión mutua y locking pesimista determinista (bulk_lots y stock_items).
-- 5. No negatividad estricta en balances de stock.
-- 6. Operación ENVxxxx en business_operations (PACKAGING) y packaging_operations.
-- 7. Snapshots históricos de componentes consumidos y costos congelados.
-- 8. Movimientos MST canónicos (salida COM, entrada PRO) vía apply_stock_movement.
-- 9. Actualización de kg_available de bulk_lots.
-- 10. Gestión de último del lote (is_last_of_lot): cierre a 0 kg, MERMA o SOBRANTE.
-- 11. Movimientos MFAxxxx (ENVASADO, y MERMA/SOBRANTE si corresponde).
-- 12. Rollback total ante cualquier falla o inconsistencia.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.package_product_atomic(
  p_bulk_lot_id UUID,
  p_product_id UUID,
  p_units_packaged INTEGER,
  p_is_last_of_lot BOOLEAN DEFAULT false,
  p_business_date DATE DEFAULT CURRENT_DATE,
  p_observations TEXT DEFAULT NULL,
  p_component_costs JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Lote de granel
  v_bulk_code VARCHAR(30);
  v_bulk_base_product_id UUID;
  v_bulk_kg_available NUMERIC(12,3);
  v_bulk_status VARCHAR(20);
  v_bulk_cost_per_kg NUMERIC(20,6);
  v_new_kg_available NUMERIC(12,3);

  -- Producto Final
  v_product_name VARCHAR(255);
  v_product_presentation VARCHAR(100);
  v_product_base_product_id UUID;
  v_product_weight_kg NUMERIC(12,3);
  v_product_extra_variable_pct NUMERIC(7,4);
  v_product_active BOOLEAN;

  -- Producto Base
  v_base_product_name VARCHAR(255);

  -- BOM y locking
  v_comp_count INTEGER;
  v_comp_ids UUID[];
  v_all_stock_items UUID[];
  v_cost_snap_count INTEGER;

  -- Variables de iteración BOM
  v_comp RECORD;
  v_snap_elem JSONB;
  v_req_qty INTEGER;
  v_current_balance NUMERIC(20,3);
  v_comp_unit_cost NUMERIC(20,6);
  v_comp_total_cost NUMERIC(20,6);

  -- Cálculos de granel y varianza
  v_kg_consumed NUMERIC(12,3);
  v_variance_type VARCHAR(20);
  v_variance_kg NUMERIC(12,3);
  v_is_last_of_lot BOOLEAN;

  -- Cálculos de costos
  v_unit_base_cost NUMERIC(20,6);
  v_unit_comps_cost NUMERIC(20,6) := 0;
  v_unit_subtotal NUMERIC(20,6);
  v_unit_cost_snapshot_ars NUMERIC(20,6);
  v_total_cost_snapshot_ars NUMERIC(20,6);

  -- Identificadores y secuencias
  v_business_date DATE;
  v_operation_id UUID;
  v_packaging_op_id UUID;
  v_env_code VARCHAR(30);
  v_mfa_code VARCHAR(30);
  v_mfa_variance_code VARCHAR(30) := NULL;
BEGIN
  -- 1. Validaciones básicas de parámetros
  IF p_bulk_lot_id IS NULL THEN
    RAISE EXCEPTION 'El bulk_lot_id es obligatorio.';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'El product_id es obligatorio.';
  END IF;

  IF p_units_packaged IS NULL OR p_units_packaged <= 0 THEN
    RAISE EXCEPTION 'La cantidad de unidades a envasar debe ser un entero mayor a 0.';
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);
  v_is_last_of_lot := COALESCE(p_is_last_of_lot, false);

  -- 2. Validar lote de granel (GRA) con bloqueo pesimista FOR UPDATE
  SELECT
    code,
    base_product_id,
    kg_available,
    status,
    cost_per_kg_snapshot_ars
  INTO
    v_bulk_code,
    v_bulk_base_product_id,
    v_bulk_kg_available,
    v_bulk_status,
    v_bulk_cost_per_kg
  FROM public.bulk_lots
  WHERE id = p_bulk_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de granel % no encontrado.', p_bulk_lot_id;
  END IF;

  IF v_bulk_status <> 'OPEN' THEN
    RAISE EXCEPTION 'El lote % está cerrado (status %) y no admite nuevas operaciones de envasado.',
      v_bulk_code, v_bulk_status;
  END IF;

  IF v_bulk_kg_available <= 0 AND NOT v_is_last_of_lot THEN
    RAISE EXCEPTION 'El lote % no tiene granel disponible (0 kg).', v_bulk_code;
  END IF;

  -- 3. Validar Producto Final (PRO)
  SELECT
    si.name,
    p.presentation,
    p.base_product_id,
    p.weight_kg,
    p.extra_variable_pct,
    si.active
  INTO
    v_product_name,
    v_product_presentation,
    v_product_base_product_id,
    v_product_weight_kg,
    v_product_extra_variable_pct,
    v_product_active
  FROM public.products p
  JOIN public.stock_items si ON si.id = p.stock_item_id
  WHERE p.stock_item_id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto Final % no encontrado.', p_product_id;
  END IF;

  IF NOT v_product_active THEN
    RAISE EXCEPTION 'El Producto Final % está inactivo.', v_product_name;
  END IF;

  IF v_product_weight_kg IS NULL OR v_product_weight_kg <= 0 THEN
    RAISE EXCEPTION 'El Producto Final % no tiene configurado un peso válido en kg.', v_product_name;
  END IF;

  -- 4. Validar compatibilidad estricta GRA -> PBA -> PRO
  IF v_product_base_product_id <> v_bulk_base_product_id THEN
    RAISE EXCEPTION 'El Producto Final "%" no corresponde al Producto Base del lote seleccionado (%).',
      v_product_name, v_bulk_code;
  END IF;

  SELECT name INTO v_base_product_name
  FROM public.base_products
  WHERE id = v_bulk_base_product_id;

  -- 5. Cargar BOM real de componentes desde product_components
  SELECT
    pg_catalog.count(*),
    pg_catalog.array_agg(component_id ORDER BY component_id ASC)
  INTO
    v_comp_count,
    v_comp_ids
  FROM public.product_components
  WHERE product_id = p_product_id;

  IF v_comp_count = 0 OR v_comp_ids IS NULL THEN
    RAISE EXCEPTION 'El Producto Final % no tiene componentes configurados en su composición (BOM).', v_product_name;
  END IF;

  -- 6. Validar integridad de p_component_costs
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_component_costs, '[]'::JSONB)) AS snap(val)
    GROUP BY (snap.val->>'component_id')::UUID
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'El snapshot de costos contiene componentes duplicados.';
  END IF;

  v_cost_snap_count := pg_catalog.jsonb_array_length(COALESCE(p_component_costs, '[]'::JSONB));

  IF v_cost_snap_count < v_comp_count THEN
    RAISE EXCEPTION 'El snapshot de costos tiene componentes faltantes respecto al BOM del producto.';
  END IF;

  IF v_cost_snap_count > v_comp_count THEN
    RAISE EXCEPTION 'El snapshot de costos contiene componentes extra que no pertenecen al BOM del producto.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_components pc
    WHERE pc.product_id = p_product_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_component_costs) AS snap(val)
      WHERE (snap.val->>'component_id')::UUID = pc.component_id
    )
  ) THEN
    RAISE EXCEPTION 'El snapshot de costos tiene componentes faltantes respecto al BOM del producto.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_component_costs) AS snap(val)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_components pc
      WHERE pc.product_id = p_product_id
      AND pc.component_id = (snap.val->>'component_id')::UUID
    )
  ) THEN
    RAISE EXCEPTION 'El snapshot de costos contiene componentes extra que no pertenecen al BOM del producto.';
  END IF;

  -- 7. Locking pesimista determinista global de todos los stock_items (COMs + PRO) en orden ASC
  v_all_stock_items := ARRAY[p_product_id] || v_comp_ids;

  PERFORM id
  FROM public.stock_items
  WHERE id = ANY(v_all_stock_items)
  ORDER BY id ASC
  FOR UPDATE;

  -- 8. Cálculo de consumo de granel y varianza (Merma / Sobrante)
  v_kg_consumed := pg_catalog.round(p_units_packaged * v_product_weight_kg, 3);
  IF v_kg_consumed <= 0 THEN
    RAISE EXCEPTION 'El consumo de granel debe ser mayor a 0 kg.';
  END IF;

  IF NOT v_is_last_of_lot THEN
    IF v_kg_consumed > v_bulk_kg_available THEN
      RAISE EXCEPTION 'Granel insuficiente en el lote %: disponible % kg, requerido % kg.',
        v_bulk_code, v_bulk_kg_available, v_kg_consumed;
    END IF;
    v_variance_type := 'NONE';
    v_variance_kg := 0;
    v_new_kg_available := v_bulk_kg_available - v_kg_consumed;
  ELSE
    -- Último del lote: el lote se vacía por completo (kg_available pasa a 0)
    IF v_kg_consumed < v_bulk_kg_available THEN
      v_variance_type := 'MERMA';
      v_variance_kg := v_bulk_kg_available - v_kg_consumed;
    ELSIF v_kg_consumed > v_bulk_kg_available THEN
      v_variance_type := 'SOBRANTE';
      v_variance_kg := v_kg_consumed - v_bulk_kg_available;
    ELSE
      v_variance_type := 'NONE';
      v_variance_kg := 0;
    END IF;
    v_new_kg_available := 0;
  END IF;

  -- 9. Pre-validar disponibilidad de stock de todos los componentes (COM) antes de escribir
  FOR v_comp IN
    SELECT
      pc.component_id,
      pc.quantity_per_unit,
      si.code AS item_code,
      si.name AS item_name
    FROM public.product_components pc
    JOIN public.stock_items si ON si.id = pc.component_id
    WHERE pc.product_id = p_product_id
    ORDER BY pc.component_id ASC
  LOOP
    v_req_qty := p_units_packaged * v_comp.quantity_per_unit;

    SELECT quantity INTO v_current_balance
    FROM public.stock_balances
    WHERE stock_item_id = v_comp.component_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_current_balance := 0;
    END IF;

    IF v_current_balance < v_req_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para el componente % (%): disponible %, requerido %.',
        v_comp.item_code, v_comp.item_name, v_current_balance, v_req_qty
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  -- 10. Crear operación de negocio en business_operations (PACKAGING)
  INSERT INTO public.business_operations (
    operation_type,
    business_date
  ) VALUES (
    'PACKAGING',
    v_business_date
  )
  RETURNING id INTO v_operation_id;

  -- 11. Generar secuencias visibles atómicas: ENVxxxx y MFAxxxx
  v_env_code := public.get_next_code_sequence('ENV');
  v_mfa_code := public.get_next_code_sequence('MFA');

  IF v_is_last_of_lot AND v_variance_type IN ('MERMA', 'SOBRANTE') THEN
    v_mfa_variance_code := public.get_next_code_sequence('MFA');
  END IF;

  -- 12. Calcular costos unitarios y totales congelados
  v_unit_base_cost := pg_catalog.round(v_product_weight_kg * v_bulk_cost_per_kg, 6);

  FOR v_comp IN
    SELECT
      pc.component_id,
      pc.quantity_per_unit
    FROM public.product_components pc
    WHERE pc.product_id = p_product_id
    ORDER BY pc.component_id ASC
  LOOP
    SELECT elem.val INTO v_snap_elem
    FROM pg_catalog.jsonb_array_elements(p_component_costs) AS elem(val)
    WHERE (elem.val->>'component_id')::UUID = v_comp.component_id;

    v_comp_unit_cost := COALESCE((v_snap_elem->>'unit_cost_gross_ars_snapshot')::NUMERIC, 0);
    v_unit_comps_cost := v_unit_comps_cost + (v_comp.quantity_per_unit * v_comp_unit_cost);
  END LOOP;

  v_unit_subtotal := v_unit_base_cost + v_unit_comps_cost;
  v_unit_cost_snapshot_ars := pg_catalog.round(
    v_unit_subtotal * (1 + (v_product_extra_variable_pct / 100)),
    6
  );
  v_total_cost_snapshot_ars := pg_catalog.round(p_units_packaged * v_unit_cost_snapshot_ars, 6);

  -- 13. Registrar cabecera en packaging_operations
  INSERT INTO public.packaging_operations (
    code,
    operation_id,
    bulk_lot_id,
    product_id,
    units_packaged,
    kg_available_before,
    kg_consumed,
    is_last_of_lot,
    variance_type,
    variance_kg,
    base_cost_per_kg_snapshot_ars,
    unit_cost_snapshot_ars,
    total_cost_snapshot_ars,
    observations
  ) VALUES (
    v_env_code,
    v_operation_id,
    p_bulk_lot_id,
    p_product_id,
    p_units_packaged,
    v_bulk_kg_available,
    v_kg_consumed,
    v_is_last_of_lot,
    v_variance_type,
    v_variance_kg,
    v_bulk_cost_per_kg,
    v_unit_cost_snapshot_ars,
    v_total_cost_snapshot_ars,
    pg_catalog.btrim(p_observations)
  )
  RETURNING id INTO v_packaging_op_id;

  -- 14. Registrar snapshots de componentes y descontar stock COM vía apply_stock_movement
  FOR v_comp IN
    SELECT
      pc.component_id,
      pc.quantity_per_unit,
      si.code AS item_code
    FROM public.product_components pc
    JOIN public.stock_items si ON si.id = pc.component_id
    WHERE pc.product_id = p_product_id
    ORDER BY pc.component_id ASC
  LOOP
    SELECT elem.val INTO v_snap_elem
    FROM pg_catalog.jsonb_array_elements(p_component_costs) AS elem(val)
    WHERE (elem.val->>'component_id')::UUID = v_comp.component_id;

    v_req_qty := p_units_packaged * v_comp.quantity_per_unit;
    v_comp_unit_cost := COALESCE((v_snap_elem->>'unit_cost_gross_ars_snapshot')::NUMERIC, 0);
    v_comp_total_cost := pg_catalog.round(v_req_qty * v_comp_unit_cost, 6);

    INSERT INTO public.packaging_component_snapshots (
      packaging_operation_id,
      component_id,
      quantity_per_unit,
      quantity_total,
      unit_cost_gross_ars_snapshot,
      total_cost_ars_snapshot
    ) VALUES (
      v_packaging_op_id,
      v_comp.component_id,
      v_comp.quantity_per_unit,
      v_req_qty,
      v_comp_unit_cost,
      v_comp_total_cost
    );

    -- Descontar stock mediante apply_stock_movement (MST ENVASADO)
    PERFORM public.apply_stock_movement(
      v_operation_id,
      v_comp.component_id,
      'ENVASADO',
      -v_req_qty,
      'Consumo en envasado ' || v_env_code
    );
  END LOOP;

  -- 15. Incrementar stock del Producto Final (PRO) mediante apply_stock_movement
  PERFORM public.apply_stock_movement(
    v_operation_id,
    p_product_id,
    'ENVASADO',
    p_units_packaged,
    'Producción por envasado ' || v_env_code
  );

  -- 16. Actualizar lote de granel (bulk_lots)
  IF v_is_last_of_lot THEN
    UPDATE public.bulk_lots
    SET kg_available = 0,
        status = 'CLOSED',
        closed_at = pg_catalog.now()
    WHERE id = p_bulk_lot_id;
  ELSE
    UPDATE public.bulk_lots
    SET kg_available = v_new_kg_available
    WHERE id = p_bulk_lot_id;
  END IF;

  -- 17. Registrar movimiento de fábrica principal (MFAxxxx ENVASADO)
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
    'ENVASADO',
    v_bulk_base_product_id,
    p_bulk_lot_id,
    v_kg_consumed,
    'Se envasaron ' || p_units_packaged || ' unidades de ' || v_product_name || ' (' || v_product_presentation || ')'
  );

  -- 18. Registrar movimiento de fábrica por diferencia de cierre (MERMA o SOBRANTE) si corresponde
  IF v_is_last_of_lot AND v_variance_type IN ('MERMA', 'SOBRANTE') THEN
    INSERT INTO public.factory_movements (
      code,
      operation_id,
      movement_type,
      base_product_id,
      bulk_lot_id,
      quantity_kg,
      description
    ) VALUES (
      v_mfa_variance_code,
      v_operation_id,
      v_variance_type,
      v_bulk_base_product_id,
      p_bulk_lot_id,
      v_variance_kg,
      CASE
        WHEN v_variance_type = 'MERMA' THEN
          'Se registró merma de ' || v_variance_kg || ' kg de ' || v_base_product_name || ' (Lote ' || v_bulk_code || ')'
        ELSE
          'Se registró sobrante de ' || v_variance_kg || ' kg de ' || v_base_product_name || ' (Lote ' || v_bulk_code || ')'
      END
    );
  END IF;

  -- 19. Retornar payload resultante
  RETURN pg_catalog.jsonb_build_object(
    'operation_id', v_operation_id,
    'packaging_operation_id', v_packaging_op_id,
    'env_code', v_env_code,
    'mfa_code', v_mfa_code,
    'mfa_variance_code', v_mfa_variance_code,
    'bulk_lot_id', p_bulk_lot_id,
    'product_id', p_product_id,
    'units_packaged', p_units_packaged,
    'kg_consumed', v_kg_consumed,
    'is_last_of_lot', v_is_last_of_lot,
    'variance_type', v_variance_type,
    'variance_kg', v_variance_kg,
    'bulk_lot_status', CASE WHEN v_is_last_of_lot THEN 'CLOSED' ELSE 'OPEN' END,
    'bulk_lot_kg_available', v_new_kg_available,
    'unit_cost_snapshot_ars', v_unit_cost_snapshot_ars,
    'total_cost_snapshot_ars', v_total_cost_snapshot_ars
  );
END;
$$;

-- Permisos estrictos de seguridad
REVOKE ALL ON FUNCTION public.package_product_atomic(UUID, UUID, INTEGER, BOOLEAN, DATE, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.package_product_atomic(UUID, UUID, INTEGER, BOOLEAN, DATE, TEXT, JSONB) TO service_role;
