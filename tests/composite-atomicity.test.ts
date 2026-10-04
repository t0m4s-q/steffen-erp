import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Altas compuestas de Fase 4 — RPCs atómicas, validación y seguridad', async (t) => {
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  // Tracking para cleanup
  const createdCustomerIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdStockItemIds: string[] = [];
  const createdOperationIds: string[] = [];

  t.after(async () => {
    // 1. Limpieza de stock items y dependencias
    for (const itemId of createdStockItemIds) {
      await serverClient.from('stock_movements').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', itemId);
      await serverClient.from('supplier_items').delete().eq('stock_item_id', itemId);
      await serverClient.from('raw_materials').delete().eq('stock_item_id', itemId);
      await serverClient.from('components').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_items').delete().eq('id', itemId);
    }

    // 2. Limpieza de operaciones
    for (const opId of createdOperationIds) {
      await serverClient.from('business_operations').delete().eq('id', opId);
    }

    // 3. Limpieza de clientes y sus cuentas
    for (const custId of createdCustomerIds) {
      await serverClient.from('financial_accounts').delete().eq('customer_id', custId);
      await serverClient.from('customers').delete().eq('id', custId);
    }

    // 4. Limpieza de proveedores y sus cuentas
    for (const supId of createdSupplierIds) {
      await serverClient.from('financial_accounts').delete().eq('supplier_id', supId);
      await serverClient.from('suppliers').delete().eq('id', supId);
    }
  });

  // ============================================================================
  // GRUPO 1: VALIDACIÓN SIN EFECTOS LATERALES
  // ============================================================================
  await t.test('1. Validación: rechaza cliente con nombre vacío o descuentos inválidos sin escribir en base', async () => {
    // Nombre vacío
    const { data: d1, error: e1 } = await (serverClient.rpc as any)('create_customer_with_account', {
      p_name: '   ',
    });
    assert.ok(e1, 'Debe fallar ante nombre vacío');
    assert.strictEqual(d1, null);

    // Descuento negativo
    const { data: d2, error: e2 } = await (serverClient.rpc as any)('create_customer_with_account', {
      p_name: 'Cliente Test Invalido',
      p_discount_1_pct: -5,
    });
    assert.ok(e2, 'Debe fallar ante descuento negativo');
    assert.strictEqual(d2, null);

    // Descuento > 100
    const { data: d3, error: e3 } = await (serverClient.rpc as any)('create_customer_with_account', {
      p_name: 'Cliente Test Invalido 2',
      p_discount_1_pct: 105,
    });
    assert.ok(e3, 'Debe fallar ante descuento > 100');
    assert.strictEqual(d3, null);
  });

  await t.test('2. Validación: rechaza proveedor con moneda inválida sin escribir en base', async () => {
    const { data, error } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: 'Proveedor Test EUR',
      p_currency_code: 'EUR',
    });
    assert.ok(error, 'Debe fallar ante moneda distinta de ARS o USD');
    assert.strictEqual(data, null);
  });

  await t.test('3. Validación: rechaza Componente (COM) con cantidad fraccionaria en stock mínimo o inicial', async () => {
    // Crear un proveedor activo válido para la prueba
    const { data: supData, error: supErr } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: `Prov Test COM Val ${Date.now()}`,
      p_currency_code: 'ARS',
    });
    assert.ifError(supErr);
    createdSupplierIds.push(supData.id);

    // Intento con stock mínimo decimal (ej: 1.5)
    const { data: d1, error: e1 } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: 'Componente Invalido Min Decimal',
      p_stock_minimum: 1.5,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 100,
    });
    assert.ok(e1, 'Debe rechazar stock mínimo decimal para COM');
    assert.strictEqual(d1, null);

    // Intento con stock inicial decimal (ej: 2.75)
    const { data: d2, error: e2 } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: 'Componente Invalido Stock Decimal',
      p_stock_minimum: 10,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 100,
      p_initial_stock: 2.75,
    });
    assert.ok(e2, 'Debe rechazar stock inicial decimal para COM');
    assert.strictEqual(d2, null);
  });

  await t.test('4. Validación: proveedor inactivo impide el alta de ítem maestro sin dejar registros', async () => {
    // 1. Crear proveedor inactivo
    const { data: inactSup, error: supErr } = await serverClient
      .from('suppliers')
      .insert({
        code: `PRV_INACT_${Date.now()}`.slice(0, 30),
        name: 'Proveedor Inactivo Test',
        currency_code: 'ARS',
        active: false,
      })
      .select('id')
      .single();
    assert.ifError(supErr);
    createdSupplierIds.push(inactSup.id);

    const testItemName = `MPR Inactivo Test ${Date.now()}`;
    const { data, error } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'MPR',
      p_name: testItemName,
      p_stock_minimum: 10,
      p_initial_supplier_id: inactSup.id,
      p_initial_quoted_price_net: 500,
    });

    assert.ok(error, 'Debe fallar si el proveedor inicial está inactivo');
    assert.strictEqual(data, null);

    // Verificar mediante SELECT que no quedó ningún registro huérfano
    const { data: checkItem } = await serverClient
      .from('stock_items')
      .select('id')
      .eq('name', testItemName);
    assert.strictEqual(checkItem?.length ?? 0, 0, 'No debe existir fila en stock_items');
  });

  // ============================================================================
  // GRUPO 2: ÉXITO ATÓMICO CONSOLIDADO
  // ============================================================================
  await t.test('5. Éxito: alta de Cliente crea registro con CLIxxxx y exactamente una cuenta CUSTOMER_RECEIVABLE', async () => {
    const testName = `Cliente Atómico Test ${Date.now()}`;
    const { data, error } = await (serverClient.rpc as any)('create_customer_with_account', {
      p_name: testName,
      p_dni: '12345678',
      p_discount_1_pct: 10,
      p_discount_2_pct: 5,
    });

    assert.ifError(error);
    assert.ok(data.id, 'Debe devolver el id del cliente');
    assert.match(data.code, /^CLI\d{4,}$/, 'El código debe respetar formato CLIxxxx');
    assert.ok(data.financial_account_id, 'Debe devolver el id de la cuenta financiera');
    createdCustomerIds.push(data.id);

    // Verificar en base de datos la cuenta creada
    const { data: accData, error: accErr } = await serverClient
      .from('financial_accounts')
      .select('*')
      .eq('customer_id', data.id);

    assert.ifError(accErr);
    assert.strictEqual(accData?.length, 1, 'Debe existir exactamente 1 cuenta contable para el cliente');
    assert.strictEqual(accData[0].account_type, 'CUSTOMER_RECEIVABLE');
    assert.strictEqual(accData[0].supplier_id, null);
    assert.strictEqual(Number(accData[0].current_balance), 0);
    assert.strictEqual(accData[0].active, true);
  });

  await t.test('6. Éxito: alta de Proveedor crea registro con PRVxxxx y exactamente una cuenta SUPPLIER_PAYABLE', async () => {
    const testName = `Proveedor Atómico Test ${Date.now()}`;
    const { data, error } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: testName,
      p_currency_code: 'USD',
      p_salesperson: 'Juan Vendedor',
    });

    assert.ifError(error);
    assert.ok(data.id, 'Debe devolver el id del proveedor');
    assert.match(data.code, /^PRV\d{4,}$/, 'El código debe respetar formato PRVxxxx');
    assert.strictEqual(data.currency_code, 'USD');
    createdSupplierIds.push(data.id);

    // Verificar en base de datos la cuenta contable
    const { data: accData, error: accErr } = await serverClient
      .from('financial_accounts')
      .select('*')
      .eq('supplier_id', data.id);

    assert.ifError(accErr);
    assert.strictEqual(accData?.length, 1, 'Debe existir exactamente 1 cuenta contable para el proveedor');
    assert.strictEqual(accData[0].account_type, 'SUPPLIER_PAYABLE');
    assert.strictEqual(accData[0].customer_id, null);
    assert.strictEqual(Number(accData[0].current_balance), 0);
    assert.strictEqual(accData[0].active, true);
  });

  await t.test('7. Éxito: alta de MPR con stock inicial > 0 crea simultáneamente maestro, subtipo, relación proveedor, operación, MST y balance', async () => {
    // 1. Crear proveedor para la MPR
    const { data: supData, error: supErr } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: `Prov MPR Test ${Date.now()}`,
      p_currency_code: 'ARS',
    });
    assert.ifError(supErr);
    createdSupplierIds.push(supData.id);

    const testItemName = `Aceite de Argán Test ${Date.now()}`;
    const initialStockKg = 12.345; // 3 decimales válidos para KG

    const { data, error } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'MPR',
      p_name: testItemName,
      p_stock_minimum: 5.0,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 2500.50,
      p_initial_stock: initialStockKg,
      p_inci: 'Argania Spinosa Kernel Oil',
    });

    assert.ifError(error);
    assert.ok(data.id, 'Debe retornar id de stock_items');
    assert.match(data.code, /^MPR\d{4,}$/, 'El código debe respetar formato MPRxxxx');
    assert.strictEqual(data.unit_type, 'KG');
    assert.ok(data.movement, 'Debe incluir resultado de apply_stock_movement');
    assert.match(data.movement.code, /^MST\d{4,}$/, 'El movimiento debe tener código MSTxxxx');

    createdStockItemIds.push(data.id);
    if (data.movement?.movement_id) {
      // Buscar la operación para trackearla en cleanup
      const { data: movRow } = await serverClient
        .from('stock_movements')
        .select('operation_id')
        .eq('id', data.movement.movement_id)
        .single();
      if (movRow?.operation_id) {
        createdOperationIds.push(movRow.operation_id);
      }
    }

    // Verificar subtipo en raw_materials
    const { data: rawData, error: rawErr } = await serverClient
      .from('raw_materials')
      .select('*')
      .eq('stock_item_id', data.id)
      .single();
    assert.ifError(rawErr);
    assert.strictEqual(rawData.inci, 'Argania Spinosa Kernel Oil');

    // Verificar relación en supplier_items
    const { data: supItemData, error: supItemErr } = await serverClient
      .from('supplier_items')
      .select('*')
      .eq('stock_item_id', data.id)
      .eq('supplier_id', supData.id)
      .single();
    assert.ifError(supItemErr);
    assert.strictEqual(Number(supItemData.quoted_unit_price_net), 2500.50);

    // Verificar saldo consolidado en stock_balances
    const { data: balData, error: balErr } = await serverClient
      .from('stock_balances')
      .select('*')
      .eq('stock_item_id', data.id)
      .single();
    assert.ifError(balErr);
    assert.strictEqual(Number(balData.quantity), initialStockKg);
  });

  // ============================================================================
  // GRUPO 3: SEGURIDAD Y PERMISOS
  // ============================================================================
  await t.test('8. Seguridad: anon y authenticated NO pueden ejecutar las 3 nuevas RPCs', async () => {
    // 1. Probar llamadas desde anonClient
    const { error: anonErr1 } = await (anonClient.rpc as any)('create_customer_with_account', {
      p_name: 'Hacker Anon',
    });
    assert.ok(anonErr1, 'anon no debe poder ejecutar create_customer_with_account');

    const { error: anonErr2 } = await (anonClient.rpc as any)('create_supplier_with_account', {
      p_name: 'Hacker Anon',
      p_currency_code: 'ARS',
    });
    assert.ok(anonErr2, 'anon no debe poder ejecutar create_supplier_with_account');

    const { error: anonErr3 } = await (anonClient.rpc as any)('create_master_item', {
      p_item_type: 'MPR',
      p_name: 'Hacker Anon',
      p_stock_minimum: 1,
      p_initial_supplier_id: '00000000-0000-0000-0000-000000000000',
      p_initial_quoted_price_net: 1,
    });
    assert.ok(anonErr3, 'anon no debe poder ejecutar create_master_item');
  });

  // ============================================================================
  // GRUPO 4: CONCURRENCIA DE CÓDIGOS VISIBLES
  // ============================================================================
  await t.test('9. Concurrencia: llamadas paralelas no generan códigos visibles duplicados', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      (serverClient.rpc as any)('create_customer_with_account', {
        p_name: `Cliente Concurrente ${Date.now()}_${i}`,
      })
    );

    const results = await Promise.all(promises);
    const codes = new Set<string>();

    for (const res of results) {
      assert.ifError(res.error);
      assert.ok(res.data?.id);
      assert.ok(res.data?.code);
      createdCustomerIds.push(res.data.id);
      assert.strictEqual(codes.has(res.data.code), false, `Código duplicado detectado: ${res.data.code}`);
      codes.add(res.data.code);
    }

    assert.strictEqual(codes.size, 5, 'Deben haberse generado exactamente 5 códigos únicos');
  });
});
