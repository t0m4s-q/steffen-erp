-- ==============================================================================
-- MIGRACIÓN 20261002000011: Gestión Atómica y Transaccional de Listas de Precios (Fase 4)
-- 1. create_price_list: Creación de listas adicionales (fuerza system_role = NULL, active = true)
-- 2. update_price_list: Edición atómica (renombrado, activación/desactivación de adicionales,
--    protección contra desactivación de listas de sistema SALON_DEFAULT, PUBLIC_DEFAULT, ECOMMERCE_DEFAULT)
-- 3. set_product_price: Fijación atómica de precio individual por PRO y lista con orden consistente
--    de locks (1. price_lists, 2. products, 3. product_price_versions), timestamp unificado vía
--    clock_timestamp() post-locks y serialización total.
-- 4. apply_bulk_price_increase: Aumento porcentual masivo atómico (global o selectivo) con orden
--    consistente de locks iniciando en price_lists, clock_timestamp() único post-locks y
--    redondeo simétrico al peso entero más cercano (ROUND_HALF_UP equivalente).
-- ==============================================================================

-- 1. Creación de lista de precios adicional
CREATE OR REPLACE FUNCTION public.create_price_list(
  p_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name VARCHAR;
  v_id UUID;
  v_created_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
BEGIN
  -- Validar nombre no vacío
  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'El nombre de la lista de precios es obligatorio.';
  END IF;

  -- Crear lista forzando system_role = NULL y active = true
  INSERT INTO public.price_lists (
    name,
    system_role,
    active,
    created_at,
    updated_at
  ) VALUES (
    v_name,
    NULL,
    true,
    pg_catalog.now(),
    pg_catalog.now()
  )
  RETURNING id, created_at, updated_at INTO v_id, v_created_at, v_updated_at;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_id,
    'name', v_name,
    'system_role', NULL,
    'active', true,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
END;
$$;

-- Permisos de create_price_list
REVOKE ALL ON FUNCTION public.create_price_list(VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_price_list(VARCHAR) TO service_role;


-- 2. Edición atómica de lista de precios (renombrar / activar / desactivar)
CREATE OR REPLACE FUNCTION public.update_price_list(
  p_price_list_id UUID,
  p_name VARCHAR DEFAULT NULL,
  p_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_name VARCHAR;
  v_system_role VARCHAR;
  v_old_active BOOLEAN;
  v_created_at TIMESTAMPTZ;
  v_new_name VARCHAR;
  v_new_active BOOLEAN;
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF p_price_list_id IS NULL THEN
    RAISE EXCEPTION 'El identificador de lista de precios es obligatorio.';
  END IF;

  IF p_name IS NULL AND p_active IS NULL THEN
    RAISE EXCEPTION 'Debe proporcionar al menos un campo para actualizar.';
  END IF;

  -- ORDEN DE LOCK: Bloquear lista con FOR UPDATE
  SELECT name, system_role, active, created_at
  INTO v_old_name, v_system_role, v_old_active, v_created_at
  FROM public.price_lists
  WHERE id = p_price_list_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista de precios % no encontrada.', p_price_list_id;
  END IF;

  -- Resolver nombre
  IF p_name IS NOT NULL THEN
    v_new_name := pg_catalog.btrim(p_name);
    IF v_new_name = '' THEN
      RAISE EXCEPTION 'El nombre de la lista de precios no puede ser vacío.';
    END IF;
  ELSE
    v_new_name := v_old_name;
  END IF;

  -- Resolver estado activo
  IF p_active IS NOT NULL THEN
    IF v_system_role IS NOT NULL AND p_active = false THEN
      RAISE EXCEPTION 'Las listas de sistema (Salón, Público, Ecommerce) no pueden desactivarse.';
    END IF;
    v_new_active := p_active;
  ELSE
    v_new_active := v_old_active;
  END IF;

  UPDATE public.price_lists
  SET name = v_new_name,
      active = v_new_active,
      updated_at = pg_catalog.now()
  WHERE id = p_price_list_id
  RETURNING updated_at INTO v_updated_at;

  RETURN pg_catalog.jsonb_build_object(
    'id', p_price_list_id,
    'name', v_new_name,
    'system_role', v_system_role,
    'active', v_new_active,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
END;
$$;

-- Permisos de update_price_list
REVOKE ALL ON FUNCTION public.update_price_list(UUID, VARCHAR, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_price_list(UUID, VARCHAR, BOOLEAN) TO service_role;


-- 3. Fijación atómica de precio individual por PRO y lista
CREATE OR REPLACE FUNCTION public.set_product_price(
  p_price_list_id UUID,
  p_product_id UUID,
  p_price_ars NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list_active BOOLEAN;
  v_prod_code VARCHAR(30);
  v_prod_name VARCHAR;
  v_prod_type VARCHAR(10);
  v_prod_active BOOLEAN;

  v_curr_version_id UUID;
  v_curr_price NUMERIC;

  v_effective_at TIMESTAMPTZ;
  v_new_version_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- 1. Validaciones básicas de parámetros
  IF p_price_list_id IS NULL THEN
    RAISE EXCEPTION 'El identificador de lista de precios es obligatorio.';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'El identificador de producto es obligatorio.';
  END IF;

  IF p_price_ars IS NULL OR p_price_ars <= 0 THEN
    RAISE EXCEPTION 'El precio de venta debe ser estrictamente mayor a 0.';
  END IF;

  IF p_price_ars <> pg_catalog.trunc(p_price_ars) THEN
    RAISE EXCEPTION 'El precio de venta de una lista debe ser un número entero en pesos (%).', p_price_ars;
  END IF;

  -- 2. ORDEN DE LOCK 1: Bloquear fila de price_lists con FOR UPDATE
  SELECT active INTO v_list_active
  FROM public.price_lists
  WHERE id = p_price_list_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista de precios % no encontrada.', p_price_list_id;
  END IF;

  IF NOT v_list_active THEN
    RAISE EXCEPTION 'No se pueden modificar precios en una lista de precios inactiva.';
  END IF;

  -- 3. ORDEN DE LOCK 2: Bloquear Producto Final estable (FOR UPDATE OF p)
  -- El bloqueo estable sobre public.products garantiza que dos llamadas concurrentes
  -- sobre el mismo PRO/lista se serialicen limpiamente incluso al asignar el primer precio.
  SELECT si.code, si.name, si.item_type, si.active
  INTO v_prod_code, v_prod_name, v_prod_type, v_prod_active
  FROM public.products p
  JOIN public.stock_items si ON si.id = p.stock_item_id
  WHERE p.stock_item_id = p_product_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto Final con ID % no encontrado.', p_product_id;
  END IF;

  IF v_prod_type <> 'PRO' THEN
    RAISE EXCEPTION 'El ítem % (%) no es un Producto Final (PRO).', v_prod_code, v_prod_name;
  END IF;

  IF NOT v_prod_active THEN
    RAISE EXCEPTION 'El Producto Final % (%) está inactivo y no puede tener precios activos.', v_prod_code, v_prod_name;
  END IF;

  -- 4. ORDEN DE LOCK 3: Buscar y bloquear versión vigente previa (si existe)
  SELECT id, price_ars
  INTO v_curr_version_id, v_curr_price
  FROM public.product_price_versions
  WHERE price_list_id = p_price_list_id
    AND product_id = p_product_id
    AND valid_to IS NULL
  FOR UPDATE;

  -- 5. Generar timestamp efectivo con clock_timestamp() DESPUÉS de adquirir todos los locks
  -- clock_timestamp() garantiza un tiempo real monótono post-espera de locks
  v_effective_at := pg_catalog.clock_timestamp();

  -- 6. Si existe versión previa, cerrarla con el mismo timestamp efectivo
  IF FOUND THEN
    UPDATE public.product_price_versions
    SET valid_to = v_effective_at
    WHERE id = v_curr_version_id;
  END IF;

  -- 7. Insertar nueva versión vigente
  INSERT INTO public.product_price_versions (
    price_list_id,
    product_id,
    price_ars,
    valid_from,
    valid_to
  ) VALUES (
    p_price_list_id,
    p_product_id,
    p_price_ars::NUMERIC(20,0),
    v_effective_at,
    NULL
  )
  RETURNING id, created_at INTO v_new_version_id, v_created_at;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_new_version_id,
    'price_list_id', p_price_list_id,
    'product_id', p_product_id,
    'product_code', v_prod_code,
    'product_name', v_prod_name,
    'price_ars', p_price_ars::NUMERIC(20,0),
    'previous_price_ars', v_curr_price,
    'valid_from', v_effective_at,
    'valid_to', NULL,
    'created_at', v_created_at
  );
END;
$$;

-- Permisos de set_product_price
REVOKE ALL ON FUNCTION public.set_product_price(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_price(UUID, UUID, NUMERIC) TO service_role;


-- 4. Aumento masivo de precios (global o selectivo)
CREATE OR REPLACE FUNCTION public.apply_bulk_price_increase(
  p_price_list_id UUID,
  p_percentage NUMERIC,
  p_product_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list_active BOOLEAN;
  v_effective_at TIMESTAMPTZ;
  v_updated_count INTEGER := 0;
  v_items_result JSONB := pg_catalog.jsonb_build_array();

  -- Variables para iteración
  v_unique_ids UUID[];
  v_pid UUID;
  v_code VARCHAR(30);
  v_name VARCHAR;
  v_item_type VARCHAR(10);
  v_prod_active BOOLEAN;
  v_curr_version_id UUID;
  v_curr_price NUMERIC;
  v_raw_new_price NUMERIC;
  v_new_price NUMERIC;

  v_rec RECORD;
BEGIN
  -- 1. Validaciones de entrada
  IF p_price_list_id IS NULL THEN
    RAISE EXCEPTION 'El identificador de lista de precios es obligatorio.';
  END IF;

  IF p_percentage IS NULL OR p_percentage <= 0 THEN
    RAISE EXCEPTION 'El porcentaje de aumento debe ser estrictamente mayor a 0 (recibido %).', p_percentage;
  END IF;

  -- 2. ORDEN DE LOCK 1: Bloquear fila de price_lists con FOR UPDATE
  SELECT active INTO v_list_active
  FROM public.price_lists
  WHERE id = p_price_list_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista de precios % no encontrada.', p_price_list_id;
  END IF;

  IF NOT v_list_active THEN
    RAISE EXCEPTION 'No se pueden aplicar aumentos a una lista de precios inactiva.';
  END IF;

  -- 3. Discriminar entre Aumento Selectivo vs Aumento Global
  IF p_product_ids IS NOT NULL AND pg_catalog.cardinality(p_product_ids) > 0 THEN
    -- MODO SELECTIVO
    -- Orden determinístico: ordenar siempre por id ASC para prevenir deadlocks inter-listas
    SELECT pg_catalog.array_agg(u.id ORDER BY u.id ASC)
    INTO v_unique_ids
    FROM (
      SELECT DISTINCT id
      FROM pg_catalog.unnest(p_product_ids) AS id
    ) AS u;

    IF pg_catalog.cardinality(p_product_ids) <> pg_catalog.cardinality(v_unique_ids) THEN
      RAISE EXCEPTION 'La lista de productos para aumento selectivo contiene identificadores duplicados.';
    END IF;

    -- Pre-validación y adquisición de locks sobre todos los PROs y versiones solicitadas
    FOREACH v_pid IN ARRAY v_unique_ids
    LOOP
      SELECT si.code, si.name, si.item_type, si.active
      INTO v_code, v_name, v_item_type, v_prod_active
      FROM public.products p
      JOIN public.stock_items si ON si.id = p.stock_item_id
      WHERE p.stock_item_id = v_pid
      FOR UPDATE OF p;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto Final con ID % no encontrado.', v_pid;
      END IF;

      IF v_item_type <> 'PRO' THEN
        RAISE EXCEPTION 'El ítem % (%) no es de tipo Producto Final (PRO).', v_code, v_name;
      END IF;

      IF NOT v_prod_active THEN
        RAISE EXCEPTION 'El Producto Final % (%) está inactivo y no puede participar del aumento.', v_code, v_name;
      END IF;

      SELECT id, price_ars
      INTO v_curr_version_id, v_curr_price
      FROM public.product_price_versions
      WHERE price_list_id = p_price_list_id
        AND product_id = v_pid
        AND valid_to IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El Producto Final % (%) no posee precio vigente en la lista de precios.', v_code, v_name;
      END IF;
    END LOOP;

    -- Generar timestamp efectivo único con clock_timestamp() post-locks
    v_effective_at := pg_catalog.clock_timestamp();

    -- Aplicar actualizaciones e inserciones atómicas usando el mismo v_effective_at
    FOREACH v_pid IN ARRAY v_unique_ids
    LOOP
      SELECT id, price_ars
      INTO v_curr_version_id, v_curr_price
      FROM public.product_price_versions
      WHERE price_list_id = p_price_list_id
        AND product_id = v_pid
        AND valid_to IS NULL;

      SELECT si.code, si.name
      INTO v_code, v_name
      FROM public.stock_items si
      WHERE si.id = v_pid;

      -- Calcular precio nuevo con precisión completa y redondear al peso entero (ROUND_HALF_UP)
      v_raw_new_price := v_curr_price * (1.0 + (p_percentage / 100.0));
      v_new_price := pg_catalog.round(v_raw_new_price, 0);

      IF v_new_price <= 0 THEN
        RAISE EXCEPTION 'El precio calculado para el producto % no es válido (%).', v_code, v_new_price;
      END IF;

      -- Cerrar versión anterior
      UPDATE public.product_price_versions
      SET valid_to = v_effective_at
      WHERE id = v_curr_version_id;

      -- Insertar nueva versión
      INSERT INTO public.product_price_versions (
        price_list_id,
        product_id,
        price_ars,
        valid_from,
        valid_to
      ) VALUES (
        p_price_list_id,
        v_pid,
        v_new_price::NUMERIC(20,0),
        v_effective_at,
        NULL
      );

      v_updated_count := v_updated_count + 1;
      v_items_result := pg_catalog.jsonb_insert(
        v_items_result,
        '{999999}',
        pg_catalog.jsonb_build_object(
          'product_id', v_pid,
          'product_code', v_code,
          'product_name', v_name,
          'previous_price_ars', v_curr_price,
          'new_price_ars', v_new_price
        )
      );
    END LOOP;

  ELSE
    -- MODO GLOBAL: Aumentar todos los PRO activos con precio vigente en la lista
    -- Generar timestamp efectivo único con clock_timestamp() post-lock de price_lists
    v_effective_at := pg_catalog.clock_timestamp();

    FOR v_rec IN
      SELECT ppv.id AS version_id, ppv.product_id, ppv.price_ars, si.code, si.name
      FROM public.product_price_versions ppv
      JOIN public.products p ON p.stock_item_id = ppv.product_id
      JOIN public.stock_items si ON si.id = ppv.product_id
      WHERE ppv.price_list_id = p_price_list_id
        AND ppv.valid_to IS NULL
        AND si.item_type = 'PRO'
        AND si.active = true
      ORDER BY ppv.product_id ASC
      FOR UPDATE OF ppv, p
    LOOP
      v_raw_new_price := v_rec.price_ars * (1.0 + (p_percentage / 100.0));
      v_new_price := pg_catalog.round(v_raw_new_price, 0);

      IF v_new_price <= 0 THEN
        RAISE EXCEPTION 'El precio calculado para el producto % no es válido (%).', v_rec.code, v_new_price;
      END IF;

      -- Cerrar versión anterior
      UPDATE public.product_price_versions
      SET valid_to = v_effective_at
      WHERE id = v_rec.version_id;

      -- Insertar nueva versión
      INSERT INTO public.product_price_versions (
        price_list_id,
        product_id,
        price_ars,
        valid_from,
        valid_to
      ) VALUES (
        p_price_list_id,
        v_rec.product_id,
        v_new_price::NUMERIC(20,0),
        v_effective_at,
        NULL
      );

      v_updated_count := v_updated_count + 1;
      v_items_result := pg_catalog.jsonb_insert(
        v_items_result,
        '{999999}',
        pg_catalog.jsonb_build_object(
          'product_id', v_rec.product_id,
          'product_code', v_rec.code,
          'product_name', v_rec.name,
          'previous_price_ars', v_rec.price_ars,
          'new_price_ars', v_new_price
        )
      );
    END LOOP;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'price_list_id', p_price_list_id,
    'percentage', p_percentage,
    'updated_count', v_updated_count,
    'valid_from', v_effective_at,
    'items', v_items_result
  );
END;
$$;

-- Permisos de apply_bulk_price_increase
REVOKE ALL ON FUNCTION public.apply_bulk_price_increase(UUID, NUMERIC, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bulk_price_increase(UUID, NUMERIC, UUID[]) TO service_role;
