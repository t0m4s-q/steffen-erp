-- ============================================================================
-- Steffen ERP — Seeds y Datos Iniciales (Fase 2)
-- ============================================================================

-- Secuencias de códigos visibles iniciales
INSERT INTO code_sequences (prefix, last_value, updated_at)
VALUES 
  ('COM', 0, NOW()),
  ('MPR', 0, NOW()),
  ('PBA', 0, NOW()),
  ('PRO', 0, NOW()),
  ('GRA', 0, NOW()),
  ('ENV', 0, NOW()),
  ('PED', 0, NOW()),
  ('CMP', 0, NOW()),
  ('RTO', 0, NOW()),
  ('RTM', 0, NOW()),
  ('MOV', 0, NOW()),
  ('MST', 0, NOW()),
  ('MFA', 0, NOW()),
  ('CLI', 0, NOW()),
  ('PRV', 0, NOW())
ON CONFLICT (prefix) DO NOTHING;

-- Cuentas patrimoniales fijas del sistema
INSERT INTO financial_accounts (account_type, name, current_balance, active, created_at, updated_at)
VALUES 
  ('CASH_STEFFEN', 'Caja Steffen', 0, true, NOW(), NOW()),
  ('CASH_MERCADO_LIBRE', 'Caja Mercado Libre', 0, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Listas de precios fijas del sistema
INSERT INTO price_lists (name, system_role, active, created_at, updated_at)
VALUES 
  ('Lista Salón', 'SALON_DEFAULT', true, NOW(), NOW()),
  ('Lista Público', 'PUBLIC_DEFAULT', true, NOW(), NOW()),
  ('Lista Ecommerce', 'ECOMMERCE_DEFAULT', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Perfiles de Costo-Ganancia predefinidos
DO $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM discount_profiles WHERE name = '35%') THEN
    INSERT INTO discount_profiles (name, active, sort_order)
    VALUES ('35%', true, 1)
    RETURNING id INTO v_profile_id;

    INSERT INTO discount_profile_steps (discount_profile_id, position, percent)
    VALUES (v_profile_id, 1, 35.0000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM discount_profiles WHERE name = '30% + 10% + 5%') THEN
    INSERT INTO discount_profiles (name, active, sort_order)
    VALUES ('30% + 10% + 5%', true, 2)
    RETURNING id INTO v_profile_id;

    INSERT INTO discount_profile_steps (discount_profile_id, position, percent)
    VALUES 
      (v_profile_id, 1, 30.0000),
      (v_profile_id, 2, 10.0000),
      (v_profile_id, 3, 5.0000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM discount_profiles WHERE name = '40% + 10%') THEN
    INSERT INTO discount_profiles (name, active, sort_order)
    VALUES ('40% + 10%', true, 3)
    RETURNING id INTO v_profile_id;

    INSERT INTO discount_profile_steps (discount_profile_id, position, percent)
    VALUES 
      (v_profile_id, 1, 40.0000),
      (v_profile_id, 2, 10.0000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM discount_profiles WHERE name = '50%') THEN
    INSERT INTO discount_profiles (name, active, sort_order)
    VALUES ('50%', true, 4)
    RETURNING id INTO v_profile_id;

    INSERT INTO discount_profile_steps (discount_profile_id, position, percent)
    VALUES (v_profile_id, 1, 50.0000);
  END IF;
END $$;
