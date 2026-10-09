-- Migración Fase 5: Ajuste Manual de Stock Atómico (ACID)
-- Garantiza en una única transacción PostgreSQL:
-- 1. business_operations (STOCK_ADJUSTMENT)
-- 2. stock_adjustments (cabecera con motivo)
-- 3. stock_adjustment_items (línea con ítem y cantidad)
-- 4. stock_movements (código secuencial MSTxxxx y trazabilidad)
-- 5. stock_balances (actualización de saldo con locking)

CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
  p_stock_item_id UUID,
  p_quantity_delta NUMERIC(14,3),
  p_reason TEXT,
  p_business_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operation_id UUID;
  v_adjustment_id UUID;
  v_unit_type VARCHAR(10);
  v_item_code VARCHAR(30);
  v_business_date DATE;
  v_clean_reason TEXT;
  v_movement_result JSONB;
BEGIN
  -- 1. Validaciones básicas
  IF p_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'El stock_item_id es obligatorio.';
  END IF;

  IF p_quantity_delta IS NULL OR p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'La cantidad del ajuste no puede ser 0.';
  END IF;

  v_clean_reason := pg_catalog.btrim(COALESCE(p_reason, ''));
  IF v_clean_reason = '' THEN
    RAISE EXCEPTION 'El motivo del ajuste es obligatorio según normativa.';
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 2. Lock del stock_item (entidad que siempre existe) para serialización de concurrencia
  SELECT unit_type, code INTO v_unit_type, v_item_code
  FROM public.stock_items
  WHERE id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem de stock % no encontrado.', p_stock_item_id;
  END IF;

  -- 3. Crear business_operation (STOCK_ADJUSTMENT)
  INSERT INTO public.business_operations (
    operation_type,
    business_date
  ) VALUES (
    'STOCK_ADJUSTMENT',
    v_business_date
  ) RETURNING id INTO v_operation_id;

  -- 4. Crear cabecera stock_adjustments
  INSERT INTO public.stock_adjustments (
    operation_id,
    reason
  ) VALUES (
    v_operation_id,
    v_clean_reason
  ) RETURNING id INTO v_adjustment_id;

  -- 5. Crear ítem stock_adjustment_items
  INSERT INTO public.stock_adjustment_items (
    adjustment_id,
    stock_item_id,
    quantity_delta,
    reason
  ) VALUES (
    v_adjustment_id,
    p_stock_item_id,
    p_quantity_delta,
    v_clean_reason
  );

  -- 6. Delegar movimiento y saldo en apply_stock_movement (misma transacción PostgreSQL)
  v_movement_result := public.apply_stock_movement(
    v_operation_id,
    p_stock_item_id,
    'AJUSTE',
    p_quantity_delta,
    'Ajuste manual: ' || v_clean_reason
  );

  -- 7. Retornar payload unificado
  RETURN pg_catalog.jsonb_build_object(
    'operation_id', v_operation_id,
    'adjustment_id', v_adjustment_id,
    'movement_id', (v_movement_result->>'movement_id')::uuid,
    'movement_code', v_movement_result->>'code',
    'stock_item_id', p_stock_item_id,
    'previous_balance', (v_movement_result->>'previous_balance')::numeric,
    'new_balance', (v_movement_result->>'new_balance')::numeric
  );
END;
$$;

-- Seguridad
REVOKE ALL ON FUNCTION public.adjust_stock_atomic(UUID, NUMERIC, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, NUMERIC, TEXT, DATE) TO service_role;
