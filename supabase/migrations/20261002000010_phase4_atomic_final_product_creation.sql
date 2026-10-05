-- ==============================================================================
-- MIGRACIÓN 20261002000010: Funciones transaccionales atómicas para Producto Final (PRO)
-- 1. create_final_product: Alta integral de Producto Final (stock_items PRO, products,
--    product_components, stock_balances en 0 y stock inicial opcional vía business_operations + apply_stock_movement)
-- 2. update_final_product_metadata: Edición atómica exclusiva de metadatos permitidos (name, presentation,
--    stock_minimum, active). Inmutabilidad garantizada de PBA, peso, BOM y fechas.
-- Ambas con SECURITY DEFINER, SET search_path = '' y permisos exclusivos para service_role.
-- ==============================================================================

-- 1. Alta integral atómica de Producto Final
CREATE OR REPLACE FUNCTION public.create_final_product(
  p_name VARCHAR,
  p_base_product_id UUID,
  p_presentation VARCHAR,
  p_weight_kg NUMERIC,
  p_stock_minimum NUMERIC,
  p_components JSONB,
  p_initial_stock NUMERIC DEFAULT 0,
  p_created_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name VARCHAR;
  v_presentation VARCHAR;
  v_created_date DATE;
  v_initial_stock NUMERIC;
  
  v_pba_code VARCHAR(30);
  v_pba_name VARCHAR;
  v_pba_active BOOLEAN;
  v_current_formula_id UUID;

  v_code VARCHAR(30);
  v_product_id UUID;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
  v_operation_id UUID;
  v_movement_result JSONB := NULL;

  v_item JSONB;
  v_component_id UUID;
  v_comp_active BOOLEAN;
  v_comp_code VARCHAR(30);
  v_comp_name VARCHAR;
  v_comp_type VARCHAR(10);
  v_qty NUMERIC;
  v_sort_order INTEGER;
  v_index INTEGER := 0;
  v_seen_comps UUID[] := ARRAY[]::UUID[];
  v_components_result JSONB := pg_catalog.jsonb_build_array();
BEGIN
  -- 1. Validar nombre
  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'El nombre del Producto Final es obligatorio.';
  END IF;

  -- 2. Validar presentación comercial
  v_presentation := pg_catalog.btrim(p_presentation);
  IF v_presentation IS NULL OR v_presentation = '' THEN
    RAISE EXCEPTION 'La presentación comercial del Producto Final es obligatoria.';
  END IF;

  -- 3. Validar peso (weight_kg > 0 y máximo 3 decimales sin redondeo previo)
  IF p_weight_kg IS NULL OR p_weight_kg <= 0 THEN
    RAISE EXCEPTION 'El peso del Producto Final debe ser estrictamente mayor a 0 kg.';
  END IF;

  IF p_weight_kg <> pg_catalog.round(p_weight_kg, 3) THEN
    RAISE EXCEPTION 'El peso del Producto Final en kg admite como máximo 3 decimales (%).', p_weight_kg;
  END IF;

  -- 4. Validar stock mínimo (> 0 y entero)
  IF p_stock_minimum IS NULL OR p_stock_minimum <= 0 THEN
    RAISE EXCEPTION 'El stock mínimo debe ser estrictamente mayor a 0.';
  END IF;

  IF p_stock_minimum <> pg_catalog.trunc(p_stock_minimum) THEN
    RAISE EXCEPTION 'El stock mínimo de un Producto Final (UNIT) debe ser un número entero (%).', p_stock_minimum;
  END IF;

  -- 5. Validar stock inicial (>= 0 y entero)
  v_initial_stock := COALESCE(p_initial_stock, 0);
  IF v_initial_stock < 0 THEN
    RAISE EXCEPTION 'El stock inicial no puede ser negativo.';
  END IF;

  IF v_initial_stock > 0 AND v_initial_stock <> pg_catalog.trunc(v_initial_stock) THEN
    RAISE EXCEPTION 'El stock inicial de un Producto Final (UNIT) debe ser un número entero (%).', v_initial_stock;
  END IF;

  v_created_date := COALESCE(p_created_date, CURRENT_DATE);

  -- 6. Validar Producto Base (PBA)
  SELECT code, name, active
  INTO v_pba_code, v_pba_name, v_pba_active
  FROM public.base_products
  WHERE id = p_base_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto Base % no encontrado.', p_base_product_id;
  END IF;

  IF NOT v_pba_active THEN
    RAISE EXCEPTION 'El Producto Base % (%) se encuentra inactivo y no puede asociarse.', v_pba_code, v_pba_name;
  END IF;

  -- Validar que el PBA tenga exactamente una fórmula vigente
  SELECT id
  INTO v_current_formula_id
  FROM public.formula_versions
  WHERE base_product_id = p_base_product_id AND is_current = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Producto Base % (%) no posee una versión de fórmula vigente.', v_pba_code, v_pba_name;
  END IF;

  -- 7. Validar BOM (p_components)
  IF p_components IS NULL OR pg_catalog.jsonb_typeof(p_components) <> 'array' OR pg_catalog.jsonb_array_length(p_components) = 0 THEN
    RAISE EXCEPTION 'La composición de componentes (BOM) es obligatoria y debe contener al menos un elemento.';
  END IF;

  -- Pre-validación de los componentes antes de cualquier inserción
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_components)
  LOOP
    v_index := v_index + 1;

    BEGIN
      v_component_id := (v_item->>'component_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'El identificador de componente no es un UUID válido.';
    END;

    IF v_component_id IS NULL THEN
      RAISE EXCEPTION 'El identificador de componente es obligatorio en cada elemento del BOM.';
    END IF;

    -- Validar existencia en stock_items
    SELECT si.active, si.code, si.name, si.item_type
    INTO v_comp_active, v_comp_code, v_comp_name, v_comp_type
    FROM public.stock_items si
    WHERE si.id = v_component_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El componente con ID % no existe.', v_component_id;
    END IF;

    IF v_comp_type <> 'COM' THEN
      RAISE EXCEPTION 'El ítem % (%) no es de tipo Componente (COM).', v_comp_code, v_comp_name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.components WHERE stock_item_id = v_component_id) THEN
      RAISE EXCEPTION 'El componente % (%) no existe en la tabla de componentes.', v_comp_code, v_comp_name;
    END IF;

    IF NOT v_comp_active THEN
      RAISE EXCEPTION 'El componente % (%) se encuentra inactivo y no puede incluirse en el BOM.', v_comp_code, v_comp_name;
    END IF;

    -- Validar duplicados
    IF v_component_id = ANY(v_seen_comps) THEN
      RAISE EXCEPTION 'El componente % (%) está duplicado en el BOM.', v_comp_code, v_comp_name;
    END IF;
    v_seen_comps := pg_catalog.array_append(v_seen_comps, v_component_id);

    -- Validar cantidad por unidad
    BEGIN
      v_qty := (v_item->>'quantity_per_unit')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'La cantidad por unidad del componente % no es un número válido.', v_comp_code;
    END;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad por unidad del componente % debe ser mayor a 0.', v_comp_code;
    END IF;

    IF v_qty <> pg_catalog.trunc(v_qty) THEN
      RAISE EXCEPTION 'La cantidad por unidad del componente % debe ser un número entero (%).', v_comp_code, v_qty;
    END IF;
  END LOOP;

  -- 8. Generar código visible atómico (PROxxxx)
  v_code := public.get_next_code_sequence('PRO');

  -- 9. Crear stock_items
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
    'PRO',
    v_name,
    'UNIT',
    p_stock_minimum::NUMERIC(20,3),
    true,
    v_created_date
  )
  RETURNING id, created_at, updated_at INTO v_product_id, v_created_at, v_updated_at;

  -- 10. Crear products (extra_variable_pct fijo en 2.0000)
  INSERT INTO public.products (
    stock_item_id,
    base_product_id,
    presentation,
    weight_kg,
    extra_variable_pct
  ) VALUES (
    v_product_id,
    p_base_product_id,
    v_presentation,
    p_weight_kg::NUMERIC(12,3),
    2.0000
  );

  -- 11. Crear product_components
  v_index := 0;
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_components)
  LOOP
    v_index := v_index + 1;
    v_component_id := (v_item->>'component_id')::UUID;
    v_qty := (v_item->>'quantity_per_unit')::NUMERIC;
    v_sort_order := COALESCE((v_item->>'sort_order')::INTEGER, v_index);

    SELECT code, name INTO v_comp_code, v_comp_name
    FROM public.stock_items
    WHERE id = v_component_id;

    INSERT INTO public.product_components (
      product_id,
      component_id,
      quantity_per_unit,
      sort_order
    ) VALUES (
      v_product_id,
      v_component_id,
      v_qty::INTEGER,
      v_sort_order
    );

    v_components_result := pg_catalog.jsonb_insert(
      v_components_result,
      '{999999}',
      pg_catalog.jsonb_build_object(
        'id', v_product_id::TEXT || '_' || v_component_id::TEXT,
        'product_id', v_product_id,
        'component_id', v_component_id,
        'component_code', v_comp_code,
        'component_name', v_comp_name,
        'quantity_per_unit', v_qty::INTEGER,
        'sort_order', v_sort_order
      )
    );
  END LOOP;

  -- 12. Inicializar stock_balances en 0
  INSERT INTO public.stock_balances (stock_item_id, quantity, updated_at)
  VALUES (v_product_id, 0, pg_catalog.now());

  -- 13. Si initialStock > 0, registrar operación y aplicar movimiento atómico mediante apply_stock_movement
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
      v_product_id,
      'AJUSTE',
      v_initial_stock::NUMERIC(14,3),
      'Stock inicial de alta de Producto Final'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_product_id,
    'code', v_code,
    'item_type', 'PRO',
    'name', v_name,
    'unit_type', 'UNIT',
    'base_product_id', p_base_product_id,
    'base_product_code', v_pba_code,
    'base_product_name', v_pba_name,
    'presentation', v_presentation,
    'weight_kg', p_weight_kg::NUMERIC(12,3),
    'stock_minimum', p_stock_minimum::NUMERIC(20,3),
    'extra_variable_pct', 2.0000,
    'active', true,
    'created_date', v_created_date,
    'created_at', v_created_at,
    'updated_at', v_updated_at,
    'components', v_components_result,
    'initial_stock', v_initial_stock,
    'movement', v_movement_result
  );
END;
$$;

-- Permisos de create_final_product
REVOKE ALL ON FUNCTION public.create_final_product(VARCHAR, UUID, VARCHAR, NUMERIC, NUMERIC, JSONB, NUMERIC, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_final_product(VARCHAR, UUID, VARCHAR, NUMERIC, NUMERIC, JSONB, NUMERIC, DATE) TO service_role;


-- 2. Edición atómica exclusiva de metadatos permitidos de Producto Final
CREATE OR REPLACE FUNCTION public.update_final_product_metadata(
  p_product_id UUID,
  p_name VARCHAR DEFAULT NULL,
  p_presentation VARCHAR DEFAULT NULL,
  p_stock_minimum NUMERIC DEFAULT NULL,
  p_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item_type VARCHAR(10);
  v_name VARCHAR;
  v_presentation VARCHAR;
  v_code VARCHAR(30);
  v_base_product_id UUID;
  v_base_product_code VARCHAR(30);
  v_base_product_name VARCHAR;
  v_weight_kg NUMERIC(12,3);
  v_extra_variable_pct NUMERIC(7,4);
  v_stock_minimum NUMERIC(20,3);
  v_active BOOLEAN;
  v_created_date DATE;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
  v_components_result JSONB := pg_catalog.jsonb_build_array();
  v_comp RECORD;
BEGIN
  -- 1. Validar que p_product_id sea obligatorio
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'El identificador de Producto Final es obligatorio.';
  END IF;

  -- 2. Validar que exista en stock_items y sea de tipo 'PRO'
  SELECT si.item_type, si.code, si.name, si.stock_minimum, si.active, si.created_date, si.created_at
  INTO v_item_type, v_code, v_name, v_stock_minimum, v_active, v_created_date, v_created_at
  FROM public.stock_items si
  WHERE si.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto Final con ID % no encontrado.', p_product_id;
  END IF;

  IF v_item_type <> 'PRO' THEN
    RAISE EXCEPTION 'El ítem con ID % no es un Producto Final (PRO).', p_product_id;
  END IF;

  -- 3. Validar que exista en products
  SELECT p.base_product_id, p.presentation, p.weight_kg, p.extra_variable_pct,
         bp.code, bp.name
  INTO v_base_product_id, v_presentation, v_weight_kg, v_extra_variable_pct,
       v_base_product_code, v_base_product_name
  FROM public.products p
  JOIN public.base_products bp ON bp.id = p.base_product_id
  WHERE p.stock_item_id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de producto con ID % no encontrado en products.', p_product_id;
  END IF;

  -- 4. Exigir que al menos un campo editable haya sido enviado
  IF p_name IS NULL AND p_presentation IS NULL AND p_stock_minimum IS NULL AND p_active IS NULL THEN
    RAISE EXCEPTION 'Debe especificarse al menos un campo para actualizar.';
  END IF;

  -- 5. Validar p_name si fue provisto
  IF p_name IS NOT NULL THEN
    v_name := pg_catalog.btrim(p_name);
    IF v_name = '' THEN
      RAISE EXCEPTION 'El nombre del Producto Final no puede quedar vacío.';
    END IF;
  END IF;

  -- 6. Validar p_presentation si fue provisto
  IF p_presentation IS NOT NULL THEN
    v_presentation := pg_catalog.btrim(p_presentation);
    IF v_presentation = '' THEN
      RAISE EXCEPTION 'La presentación comercial del Producto Final no puede quedar vacía.';
    END IF;
  END IF;

  -- 7. Validar p_stock_minimum si fue provisto
  IF p_stock_minimum IS NOT NULL THEN
    IF p_stock_minimum <= 0 THEN
      RAISE EXCEPTION 'El stock mínimo debe ser estrictamente mayor a 0.';
    END IF;
    IF p_stock_minimum <> pg_catalog.trunc(p_stock_minimum) THEN
      RAISE EXCEPTION 'El stock mínimo de un Producto Final (UNIT) debe ser un número entero (%).', p_stock_minimum;
    END IF;
    v_stock_minimum := p_stock_minimum;
  END IF;

  -- 8. Validar p_active si fue provisto
  IF p_active IS NOT NULL THEN
    v_active := p_active;
  END IF;

  -- 9. Actualizar stock_items (solo name, stock_minimum, active, updated_at)
  UPDATE public.stock_items
  SET name = v_name,
      stock_minimum = v_stock_minimum,
      active = v_active,
      updated_at = pg_catalog.now()
  WHERE id = p_product_id
  RETURNING updated_at INTO v_updated_at;

  -- 10. Actualizar products (solo presentation) si fue provisto
  IF p_presentation IS NOT NULL THEN
    UPDATE public.products
    SET presentation = v_presentation
    WHERE stock_item_id = p_product_id;
  END IF;

  -- 11. Cargar componentes vigentes para el retorno consolidado
  FOR v_comp IN
    SELECT pc.product_id, pc.component_id, pc.quantity_per_unit, pc.sort_order,
           si.code AS component_code, si.name AS component_name
    FROM public.product_components pc
    JOIN public.stock_items si ON si.id = pc.component_id
    WHERE pc.product_id = p_product_id
    ORDER BY pc.sort_order ASC
  LOOP
    v_components_result := pg_catalog.jsonb_insert(
      v_components_result,
      '{999999}',
      pg_catalog.jsonb_build_object(
        'id', v_comp.product_id::TEXT || '_' || v_comp.component_id::TEXT,
        'product_id', v_comp.product_id,
        'component_id', v_comp.component_id,
        'component_code', v_comp.component_code,
        'component_name', v_comp.component_name,
        'quantity_per_unit', v_comp.quantity_per_unit,
        'sort_order', v_comp.sort_order
      )
    );
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'id', p_product_id,
    'code', v_code,
    'item_type', 'PRO',
    'name', v_name,
    'unit_type', 'UNIT',
    'base_product_id', v_base_product_id,
    'base_product_code', v_base_product_code,
    'base_product_name', v_base_product_name,
    'presentation', v_presentation,
    'weight_kg', v_weight_kg,
    'stock_minimum', v_stock_minimum,
    'extra_variable_pct', v_extra_variable_pct,
    'active', v_active,
    'created_date', v_created_date,
    'created_at', v_created_at,
    'updated_at', v_updated_at,
    'components', v_components_result
  );
END;
$$;

-- Permisos de update_final_product_metadata
REVOKE ALL ON FUNCTION public.update_final_product_metadata(UUID, VARCHAR, VARCHAR, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_final_product_metadata(UUID, VARCHAR, VARCHAR, NUMERIC, BOOLEAN) TO service_role;
