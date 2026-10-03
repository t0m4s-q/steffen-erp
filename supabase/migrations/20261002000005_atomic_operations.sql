-- ==============================================================================
-- MIGRACIÓN 20261002000005: Funciones transaccionales atómicas para Stock y Patrimonio
-- ==============================================================================

-- 1. Función atómica para movimientos de stock (MST)
CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_operation_id UUID,
  p_stock_item_id UUID,
  p_movement_type VARCHAR,
  p_quantity_delta NUMERIC(14,3),
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'La descripción del movimiento de stock es obligatoria.';
  END IF;

  -- 1. Validar que el ítem existe y obtener unidad
  SELECT unit_type, code INTO v_unit_type, v_item_code
  FROM stock_items
  WHERE id = p_stock_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem de stock % no encontrado.', p_stock_item_id;
  END IF;

  -- 2. Validar precisión según unidad
  IF v_unit_type = 'UNIT' THEN
    IF p_quantity_delta <> TRUNC(p_quantity_delta) THEN
      RAISE EXCEPTION 'El ítem % es por unidad (UNIT) y no admite cantidades decimales (%).', v_item_code, p_quantity_delta;
    END IF;
  ELSIF v_unit_type = 'KG' THEN
    IF p_quantity_delta <> ROUND(p_quantity_delta, 3) THEN
      RAISE EXCEPTION 'El ítem % (KG) admite como máximo 3 decimales de precisión (%).', v_item_code, p_quantity_delta;
    END IF;
  END IF;

  -- 3. Generar código visible atómico (MSTxxxx)
  v_code := get_next_code_sequence('MST');

  -- 4. Registrar movimiento en ledger
  INSERT INTO stock_movements (
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
    TRIM(p_description)
  )
  RETURNING id INTO v_movement_id;

  -- 5. Actualizar o insertar saldo consolidado con bloqueo de fila anti-concurrencia
  INSERT INTO stock_balances (stock_item_id, quantity, updated_at)
  VALUES (p_stock_item_id, p_quantity_delta, NOW())
  ON CONFLICT (stock_item_id) DO UPDATE
  SET quantity = stock_balances.quantity + EXCLUDED.quantity,
      updated_at = NOW()
  RETURNING quantity INTO v_new_balance;

  v_prev_balance := v_new_balance - p_quantity_delta;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'code', v_code,
    'stock_item_id', p_stock_item_id,
    'previous_balance', v_prev_balance::text,
    'new_balance', v_new_balance::text
  );
END;
$$;

-- 2. Función atómica para movimientos patrimoniales (MOV)
CREATE OR REPLACE FUNCTION post_patrimonial_movement(
  p_operation_id UUID,
  p_movement_type VARCHAR,
  p_description TEXT,
  p_amount_ars NUMERIC(20,6),
  p_entries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code VARCHAR(30);
  v_movement_id UUID;
  v_entry JSONB;
  v_account_id UUID;
  v_delta_ars NUMERIC(20,6);
BEGIN
  IF p_amount_ars < 0 THEN
    RAISE EXCEPTION 'El importe de movimiento patrimonial no puede ser negativo.';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'La descripción del movimiento patrimonial es obligatoria.';
  END IF;

  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'Debe incluirse al menos una variación en entries.';
  END IF;

  -- 1. Generar código visible atómico (MOVxxxx)
  v_code := get_next_code_sequence('MOV');

  -- 2. Crear cabecera patrimonial
  INSERT INTO patrimonial_movements (
    code,
    operation_id,
    movement_type,
    description,
    amount_ars
  ) VALUES (
    v_code,
    p_operation_id,
    p_movement_type,
    TRIM(p_description),
    p_amount_ars
  )
  RETURNING id INTO v_movement_id;

  -- 3. Procesar renglones y actualizar cuentas con bloqueo de fila FOR UPDATE
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_account_id := (v_entry->>'financial_account_id')::UUID;
    v_delta_ars := (v_entry->>'delta_ars')::NUMERIC(20,6);

    IF v_delta_ars = 0 THEN
      RAISE EXCEPTION 'El deltaArs de una entrada financiera no puede ser 0.';
    END IF;

    -- Validar existencia y bloquear cuenta
    PERFORM 1 FROM financial_accounts WHERE id = v_account_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cuenta financiera % no encontrada.', v_account_id;
    END IF;

    -- Registrar variación
    INSERT INTO financial_entries (
      patrimonial_movement_id,
      financial_account_id,
      delta_ars
    ) VALUES (
      v_movement_id,
      v_account_id,
      v_delta_ars
    );

    -- Actualizar balance acumulado
    UPDATE financial_accounts
    SET current_balance = current_balance + v_delta_ars,
        updated_at = NOW()
    WHERE id = v_account_id;
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'code', v_code
  );
END;
$$;
