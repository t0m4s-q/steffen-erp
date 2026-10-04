-- ==============================================================================
-- MIGRACIÓN 20261002000009: Funciones transaccionales atómicas para PBA y Fórmulas
-- 1. create_base_product_with_formula: Alta de Producto Base + Fórmula v1 + Items
-- 2. create_new_formula_version: Alta de nueva versión v2+ con desactivación de versión previa
-- Ambas con SECURITY DEFINER, SET search_path = '' y permisos exclusivos para service_role.
-- ==============================================================================

-- 1. Alta integral atómica de Producto Base con su primera versión de fórmula
CREATE OR REPLACE FUNCTION public.create_base_product_with_formula(
  p_name VARCHAR,
  p_items JSONB,
  p_observations TEXT DEFAULT NULL,
  p_business_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name VARCHAR;
  v_code VARCHAR(30);
  v_base_product_id UUID;
  v_formula_version_id UUID;
  v_business_date DATE;
  v_observations TEXT;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
  v_version_created_at TIMESTAMPTZ;
  
  v_item JSONB;
  v_raw_material_id UUID;
  v_qty NUMERIC;
  v_sort_order INTEGER;
  v_index INTEGER := 0;
  
  v_seen_mprs UUID[] := ARRAY[]::UUID[];
  v_mpr_active BOOLEAN;
  v_mpr_code VARCHAR(30);
  v_mpr_name VARCHAR;
  
  v_items_result JSONB := pg_catalog.jsonb_build_array();
  v_item_id UUID;
BEGIN
  -- 1. Validar nombre del Producto Base
  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'El nombre del Producto Base es obligatorio.';
  END IF;

  -- 2. Validar que p_items sea un array JSON y contenga al menos un renglón
  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array' OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La fórmula debe contener al menos una Materia Prima.';
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);
  v_observations := NULLIF(pg_catalog.btrim(p_observations), '');

  -- 3. Generar código visible atómico (PBAxxxx)
  v_code := public.get_next_code_sequence('PBA');

  -- 4. Crear registro en base_products
  INSERT INTO public.base_products (
    code,
    name,
    active,
    created_date
  ) VALUES (
    v_code,
    v_name,
    true,
    v_business_date
  )
  RETURNING id, created_at, updated_at INTO v_base_product_id, v_created_at, v_updated_at;

  -- 5. Crear formula_versions con version_number = 1 e is_current = true
  INSERT INTO public.formula_versions (
    base_product_id,
    version_number,
    business_date,
    observations,
    is_current
  ) VALUES (
    v_base_product_id,
    1,
    v_business_date,
    v_observations,
    true
  )
  RETURNING id, created_at INTO v_formula_version_id, v_version_created_at;

  -- 6. Validar e insertar renglones (formula_version_items)
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_index := v_index + 1;

    -- Validar formato UUID de raw_material_id
    BEGIN
      v_raw_material_id := (v_item->>'raw_material_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'El identificador de Materia Prima no es un UUID válido.';
    END;

    IF v_raw_material_id IS NULL THEN
      RAISE EXCEPTION 'El identificador de Materia Prima es obligatorio en cada renglón.';
    END IF;

    -- Validar existencia en raw_materials + stock_items y verificar que esté activa
    SELECT si.active, si.code, si.name
    INTO v_mpr_active, v_mpr_code, v_mpr_name
    FROM public.stock_items si
    JOIN public.raw_materials rm ON rm.stock_item_id = si.id
    WHERE si.id = v_raw_material_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La Materia Prima con ID % no existe en raw_materials.', v_raw_material_id;
    END IF;

    IF NOT v_mpr_active THEN
      RAISE EXCEPTION 'La Materia Prima % (%) se encuentra inactiva y no puede incluirse en la fórmula.', v_mpr_code, v_mpr_name;
    END IF;

    -- Impedir MPR duplicadas dentro de la misma versión
    IF v_raw_material_id = ANY(v_seen_mprs) THEN
      RAISE EXCEPTION 'La Materia Prima % (%) está duplicada en la fórmula.', v_mpr_code, v_mpr_name;
    END IF;
    v_seen_mprs := pg_catalog.array_append(v_seen_mprs, v_raw_material_id);

    -- Extraer cantidad como NUMERIC sin escala limitada para no redondear prematuramente
    BEGIN
      v_qty := (v_item->>'quantity_kg')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'La cantidad en kg de la Materia Prima % no es un número válido.', v_mpr_code;
    END;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad en kg de la Materia Prima % debe ser mayor a 0.', v_mpr_code;
    END IF;

    -- Validar que no tenga más de 3 decimales (rechaza explícitamente 1.1234)
    IF v_qty <> pg_catalog.round(v_qty, 3) THEN
      RAISE EXCEPTION 'La cantidad en kg de la Materia Prima % admite como máximo 3 decimales (%).', v_mpr_code, v_qty;
    END IF;

    -- Determinar sort_order
    v_sort_order := COALESCE((v_item->>'sort_order')::INTEGER, v_index);

    -- Insertar renglón en formula_version_items
    INSERT INTO public.formula_version_items (
      formula_version_id,
      raw_material_id,
      quantity_kg,
      sort_order
    ) VALUES (
      v_formula_version_id,
      v_raw_material_id,
      v_qty::NUMERIC(12,3),
      v_sort_order
    )
    RETURNING id INTO v_item_id;

    -- Construir objeto de resultado para este renglón
    v_items_result := v_items_result || pg_catalog.jsonb_build_object(
      'id', v_item_id,
      'formula_version_id', v_formula_version_id,
      'raw_material_id', v_raw_material_id,
      'raw_material_code', v_mpr_code,
      'raw_material_name', v_mpr_name,
      'quantity_kg', v_qty::NUMERIC(12,3),
      'sort_order', v_sort_order
    );
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'base_product', pg_catalog.jsonb_build_object(
      'id', v_base_product_id,
      'code', v_code,
      'name', v_name,
      'active', true,
      'created_date', v_business_date,
      'created_at', v_created_at,
      'updated_at', v_updated_at
    ),
    'formula_version', pg_catalog.jsonb_build_object(
      'id', v_formula_version_id,
      'base_product_id', v_base_product_id,
      'version_number', 1,
      'business_date', v_business_date,
      'observations', v_observations,
      'is_current', true,
      'created_at', v_version_created_at,
      'items', v_items_result
    )
  );
END;
$$;

-- 2. Alta integral atómica de una nueva versión de fórmula para un PBA existente
CREATE OR REPLACE FUNCTION public.create_new_formula_version(
  p_base_product_id UUID,
  p_items JSONB,
  p_observations TEXT DEFAULT NULL,
  p_business_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bp_active BOOLEAN;
  v_bp_name VARCHAR;
  v_next_version INTEGER;
  v_formula_version_id UUID;
  v_business_date DATE;
  v_observations TEXT;
  v_version_created_at TIMESTAMPTZ;
  
  v_item JSONB;
  v_raw_material_id UUID;
  v_qty NUMERIC;
  v_sort_order INTEGER;
  v_index INTEGER := 0;
  
  v_seen_mprs UUID[] := ARRAY[]::UUID[];
  v_mpr_active BOOLEAN;
  v_mpr_code VARCHAR(30);
  v_mpr_name VARCHAR;
  
  v_items_result JSONB := pg_catalog.jsonb_build_array();
  v_item_id UUID;
BEGIN
  -- 1. Bloquear y validar Producto Base mediante FOR UPDATE para serializar versiones concurrentes
  SELECT active, name
  INTO v_bp_active, v_bp_name
  FROM public.base_products
  WHERE id = p_base_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto Base con ID % no encontrado.', p_base_product_id;
  END IF;

  IF NOT v_bp_active THEN
    RAISE EXCEPTION 'El Producto Base % (%) se encuentra inactivo y no admite nuevas versiones de fórmula.', p_base_product_id, v_bp_name;
  END IF;

  -- 2. Validar que p_items sea un array JSON y contenga al menos un renglón
  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array' OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La nueva versión de fórmula debe contener al menos una Materia Prima.';
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);
  v_observations := NULLIF(pg_catalog.btrim(p_observations), '');

  -- 3. Calcular siguiente número de versión
  SELECT COALESCE(pg_catalog.max(version_number), 0) + 1
  INTO v_next_version
  FROM public.formula_versions
  WHERE base_product_id = p_base_product_id;

  -- 4. Marcar versión vigente anterior como is_current = false
  UPDATE public.formula_versions
  SET is_current = false
  WHERE base_product_id = p_base_product_id
    AND is_current = true;

  -- 5. Crear la nueva versión con is_current = true
  INSERT INTO public.formula_versions (
    base_product_id,
    version_number,
    business_date,
    observations,
    is_current
  ) VALUES (
    p_base_product_id,
    v_next_version,
    v_business_date,
    v_observations,
    true
  )
  RETURNING id, created_at INTO v_formula_version_id, v_version_created_at;

  -- 6. Validar e insertar renglones de la nueva versión
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_index := v_index + 1;

    -- Validar formato UUID de raw_material_id
    BEGIN
      v_raw_material_id := (v_item->>'raw_material_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'El identificador de Materia Prima no es un UUID válido.';
    END;

    IF v_raw_material_id IS NULL THEN
      RAISE EXCEPTION 'El identificador de Materia Prima es obligatorio en cada renglón.';
    END IF;

    -- Validar existencia en raw_materials + stock_items y verificar que esté activa
    SELECT si.active, si.code, si.name
    INTO v_mpr_active, v_mpr_code, v_mpr_name
    FROM public.stock_items si
    JOIN public.raw_materials rm ON rm.stock_item_id = si.id
    WHERE si.id = v_raw_material_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La Materia Prima con ID % no existe en raw_materials.', v_raw_material_id;
    END IF;

    IF NOT v_mpr_active THEN
      RAISE EXCEPTION 'La Materia Prima % (%) se encuentra inactiva y no puede incluirse en la fórmula.', v_mpr_code, v_mpr_name;
    END IF;

    -- Impedir MPR duplicadas dentro de la misma versión
    IF v_raw_material_id = ANY(v_seen_mprs) THEN
      RAISE EXCEPTION 'La Materia Prima % (%) está duplicada en la fórmula.', v_mpr_code, v_mpr_name;
    END IF;
    v_seen_mprs := pg_catalog.array_append(v_seen_mprs, v_raw_material_id);

    -- Extraer cantidad como NUMERIC sin escala limitada para no redondear prematuramente
    BEGIN
      v_qty := (v_item->>'quantity_kg')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'La cantidad en kg de la Materia Prima % no es un número válido.', v_mpr_code;
    END;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad en kg de la Materia Prima % debe ser mayor a 0.', v_mpr_code;
    END IF;

    -- Validar que no tenga más de 3 decimales (rechaza explícitamente 1.1234)
    IF v_qty <> pg_catalog.round(v_qty, 3) THEN
      RAISE EXCEPTION 'La cantidad en kg de la Materia Prima % admite como máximo 3 decimales (%).', v_mpr_code, v_qty;
    END IF;

    -- Determinar sort_order
    v_sort_order := COALESCE((v_item->>'sort_order')::INTEGER, v_index);

    -- Insertar renglón en formula_version_items
    INSERT INTO public.formula_version_items (
      formula_version_id,
      raw_material_id,
      quantity_kg,
      sort_order
    ) VALUES (
      v_formula_version_id,
      v_raw_material_id,
      v_qty::NUMERIC(12,3),
      v_sort_order
    )
    RETURNING id INTO v_item_id;

    -- Construir objeto de resultado para este renglón
    v_items_result := v_items_result || pg_catalog.jsonb_build_object(
      'id', v_item_id,
      'formula_version_id', v_formula_version_id,
      'raw_material_id', v_raw_material_id,
      'raw_material_code', v_mpr_code,
      'raw_material_name', v_mpr_name,
      'quantity_kg', v_qty::NUMERIC(12,3),
      'sort_order', v_sort_order
    );
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_formula_version_id,
    'base_product_id', p_base_product_id,
    'version_number', v_next_version,
    'business_date', v_business_date,
    'observations', v_observations,
    'is_current', true,
    'created_at', v_version_created_at,
    'items', v_items_result
  );
END;
$$;

-- 3. Revocar permisos de ejecución a roles no autorizados
REVOKE ALL ON FUNCTION public.create_base_product_with_formula(VARCHAR, JSONB, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_new_formula_version(UUID, JSONB, TEXT, DATE) FROM PUBLIC, anon, authenticated;

-- 4. Otorgar ejecución exclusiva al rol backend (service_role)
GRANT EXECUTE ON FUNCTION public.create_base_product_with_formula(VARCHAR, JSONB, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_new_formula_version(UUID, JSONB, TEXT, DATE) TO service_role;
