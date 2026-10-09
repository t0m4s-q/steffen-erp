-- Migración 00013: Prohibir stock negativo de forma autoritativa
-- Regla normativa única: stock_balances.quantity >= 0 para todos los ítems (MPR, COM, PRO).

-- 1. Restricción CHECK en stock_balances para impedir cualquier saldo negativo a nivel de base de datos
ALTER TABLE public.stock_balances
  ADD CONSTRAINT stock_balances_quantity_non_negative
  CHECK (quantity >= 0);

-- 2. Actualización autoritativa de apply_stock_movement con locking previo y validación de saldo
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_operation_id UUID,
  p_stock_item_id UUID,
  p_movement_type VARCHAR,
  p_quantity_delta NUMERIC(14,3),
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit_type VARCHAR(10);
  v_item_code VARCHAR(30);
  v_code VARCHAR(30);
  v_movement_id UUID;
  v_new_balance NUMERIC(14,3);
  v_prev_balance NUMERIC(14,3);
BEGIN
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'El delta de cantidad del movimiento de stock no puede ser 0.';
  END IF;

  IF p_description IS NULL OR pg_catalog.btrim(p_description) = '' THEN
    RAISE EXCEPTION 'La descripción del movimiento de stock es obligatoria.';
  END IF;

  -- 1. Validar que el ítem existe y obtener unidad y código
  SELECT unit_type, code INTO v_unit_type, v_item_code
  FROM public.stock_items
  WHERE id = p_stock_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem de stock % no encontrado.', p_stock_item_id;
  END IF;

  -- 2. Validar precisión según unidad
  IF v_unit_type = 'UNIT' THEN
    IF p_quantity_delta <> pg_catalog.trunc(p_quantity_delta) THEN
      RAISE EXCEPTION 'El ítem % es por unidad (UNIT) y no admite cantidades decimales (%).', v_item_code, p_quantity_delta;
    END IF;
  ELSIF v_unit_type = 'KG' THEN
    IF p_quantity_delta <> pg_catalog.round(p_quantity_delta, 3) THEN
      RAISE EXCEPTION 'El ítem % (KG) admite como máximo 3 decimales de precisión (%).', v_item_code, p_quantity_delta;
    END IF;
  END IF;

  -- 3. Bloqueo pesimista de fila en stock_balances y cálculo de saldo
  SELECT quantity INTO v_prev_balance
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_prev_balance := 0;
  END IF;

  v_new_balance := v_prev_balance + p_quantity_delta;

  -- 4. Validación autoritativa de no negatividad: ningún movimiento puede dejar saldo negativo
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para el ítem % (código %): saldo actual %, cantidad solicitada % (resultaría en %).',
      p_stock_item_id, v_item_code, v_prev_balance, p_quantity_delta, v_new_balance
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Generar código visible atómico (MSTxxxx)
  v_code := public.get_next_code_sequence('MST');

  -- 6. Registrar movimiento en ledger
  INSERT INTO public.stock_movements (
    code,
    operation_id,
    stock_item_id,
    movement_type,
    quantity_delta,
    description
  ) VALUES (
    v_code,
    p_operation_id,
    p_stock_item_id,
    p_movement_type,
    p_quantity_delta,
    pg_catalog.btrim(p_description)
  )
  RETURNING id INTO v_movement_id;

  -- 7. Actualizar o insertar saldo consolidado
  INSERT INTO public.stock_balances (stock_item_id, quantity, updated_at)
  VALUES (p_stock_item_id, v_new_balance, pg_catalog.now())
  ON CONFLICT (stock_item_id) DO UPDATE
  SET quantity = EXCLUDED.quantity,
      updated_at = pg_catalog.now();

  RETURN pg_catalog.jsonb_build_object(
    'movement_id', v_movement_id,
    'code', v_code,
    'stock_item_id', p_stock_item_id,
    'previous_balance', v_prev_balance::text,
    'new_balance', v_new_balance::text
  );
END;
$$;

-- Mantener permisos restrictivos de seguridad de RPC
REVOKE ALL ON FUNCTION public.apply_stock_movement(UUID, UUID, VARCHAR, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stock_movement(UUID, UUID, VARCHAR, NUMERIC, TEXT) TO service_role;
