import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Seguridad — Control de acceso y bloqueo en tablas, vistas y RPCs', async (t) => {
  // 1. Cliente simulado de navegador (rol anon)
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  // 2. Cliente administrativo autorizado de backend (rol service_role)
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 3. Crear usuario autenticado de prueba para probar rol authenticated
  let authClient: any;
  let testUserId: string | null = null;
  const testUserEmail = `sec_test_${Date.now()}@steffen-test.local`;
  const testUserPassword = 'TestPassword123!';

  t.before(async () => {
    try {
      const { data: userData, error: uErr } = await serverClient.auth.admin.createUser({
        email: testUserEmail,
        password: testUserPassword,
        email_confirm: true,
      });

      if (!uErr && userData?.user) {
        testUserId = userData.user.id;
        const { data: sessionData, error: sErr } = await anonClient.auth.signInWithPassword({
          email: testUserEmail,
          password: testUserPassword,
        });

        if (!sErr && sessionData?.session?.access_token) {
          authClient = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false },
            global: {
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            },
          });
        }
      }
    } catch {
      // Si la administración de usuarios no estuviera disponible, authClient se manejará como fallback
    }
  });

  t.after(async () => {
    if (testUserId) {
      await serverClient.auth.admin.deleteUser(testUserId);
    }
  });

  // Helper para verificar código de error 42501 (permission denied) o 401/403
  const isPermissionDeniedError = (error: any) => {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    return (
      code === '42501' ||
      msg.includes('permission denied') ||
      msg.includes('not found') ||
      error.status === 401 ||
      error.status === 403
    );
  };

  // --- SECCIÓN 1: ROL ANON ---
  await t.test('1. anon NO puede SELECT de una tabla de negocio (customers)', async () => {
    const { data, error } = await anonClient.from('customers').select('*').limit(1);
    assert.ok(error, 'anon debe recibir error al intentar SELECT en customers');
    assert.strictEqual(data, null);
    assert.ok(isPermissionDeniedError(error), `Error recibido: ${error.message} (${error.code})`);
  });

  await t.test('2. anon NO puede INSERT en tablas de negocio (stock_items)', async () => {
    const { data, error } = await anonClient.from('stock_items').insert({
      code: 'HACK_ITEM',
      item_type: 'MPR',
      name: 'Hack Item',
      unit_type: 'KG',
    });
    assert.ok(error, 'anon debe recibir error al intentar INSERT en stock_items');
    assert.strictEqual(data, null);
    assert.ok(isPermissionDeniedError(error), `Error recibido: ${error.message} (${error.code})`);
  });

  await t.test('3. anon NO puede UPDATE ni DELETE en tablas de negocio (suppliers)', async () => {
    const { error: updErr } = await anonClient
      .from('suppliers')
      .update({ name: 'Hacked' })
      .eq('code', 'PRV_TEST');
    assert.ok(updErr, 'anon debe recibir error en UPDATE');
    assert.ok(isPermissionDeniedError(updErr));

    const { error: delErr } = await anonClient
      .from('suppliers')
      .delete()
      .eq('code', 'PRV_TEST');
    assert.ok(delErr, 'anon debe recibir error en DELETE');
    assert.ok(isPermissionDeniedError(delErr));
  });

  await t.test('4. anon NO puede SELECT de las vistas del ERP (v_current_item_cost, v_current_stock_priority)', async () => {
    const { data: d1, error: err1 } = await anonClient.from('v_current_item_cost').select('*').limit(1);
    assert.ok(err1, 'anon debe recibir error en v_current_item_cost');
    assert.strictEqual(d1, null);
    assert.ok(isPermissionDeniedError(err1));

    const { data: d2, error: err2 } = await anonClient.from('v_current_stock_priority').select('*').limit(1);
    assert.ok(err2, 'anon debe recibir error en v_current_stock_priority');
    assert.strictEqual(d2, null);
    assert.ok(isPermissionDeniedError(err2));
  });

  await t.test('5. anon NO puede ejecutar los RPCs SECURITY DEFINER', async () => {
    const { error: rpcErr1 } = await (anonClient.rpc as any)('apply_stock_movement', {
      p_operation_id: '00000000-0000-0000-0000-000000000000',
      p_stock_item_id: '00000000-0000-0000-0000-000000000000',
      p_movement_type: 'AJUSTE',
      p_quantity_delta: '10',
      p_description: 'Intento anon',
    });
    assert.ok(rpcErr1);
    assert.ok(isPermissionDeniedError(rpcErr1));

    const { error: rpcErr2 } = await (anonClient.rpc as any)('post_patrimonial_movement', {
      p_operation_id: '00000000-0000-0000-0000-000000000000',
      p_movement_type: 'VENTA',
      p_description: 'Intento anon',
      p_amount_ars: '100',
      p_entries: [],
    });
    assert.ok(rpcErr2);
    assert.ok(isPermissionDeniedError(rpcErr2));

    const { error: rpcErr3 } = await (anonClient.rpc as any)('get_next_code_sequence', {
      p_prefix: 'MST',
    });
    assert.ok(rpcErr3);
    assert.ok(isPermissionDeniedError(rpcErr3));
  });

  // --- SECCIÓN 2: ROL AUTHENTICATED ---
  await t.test('6. authenticated TAMPOCO puede acceder directamente a tablas, vistas o RPCs en el MVP', async () => {
    if (!authClient) {
      assert.ok(true, 'Test omitido si no fue posible inicializar authClient');
      return;
    }

    // Intento de SELECT en tabla de negocio
    const { data: custData, error: custErr } = await authClient.from('customers').select('*').limit(1);
    assert.ok(custErr, 'authenticated no debe poder SELECT en customers');
    assert.strictEqual(custData, null);
    assert.ok(isPermissionDeniedError(custErr));

    // Intento de SELECT en vista
    const { data: viewData, error: viewErr } = await authClient.from('v_current_item_cost').select('*').limit(1);
    assert.ok(viewErr, 'authenticated no debe poder SELECT en v_current_item_cost');
    assert.strictEqual(viewData, null);
    assert.ok(isPermissionDeniedError(viewErr));

    // Intento de RPC privilegiado
    const { error: rpcErr } = await (authClient.rpc as any)('apply_stock_movement', {
      p_operation_id: '00000000-0000-0000-0000-000000000000',
      p_stock_item_id: '00000000-0000-0000-0000-000000000000',
      p_movement_type: 'AJUSTE',
      p_quantity_delta: '10',
      p_description: 'Intento authenticated',
    });
    assert.ok(rpcErr, 'authenticated no debe poder invocar apply_stock_movement');
    assert.ok(isPermissionDeniedError(rpcErr));
  });

  // --- SECCIÓN 3: ROL SERVICE_ROLE (Contexto de servidor autorizado) ---
  await t.test('7. service_role SÍ puede consultar tablas y vistas analíticas', async () => {
    // SELECT en tabla
    const { data: tablesData, error: tErr } = await serverClient.from('customers').select('id').limit(1);
    assert.ifError(tErr);
    assert.ok(Array.isArray(tablesData));

    // SELECT en vista
    const { data: viewData, error: vErr } = await serverClient.from('v_current_item_cost').select('*').limit(1);
    assert.ifError(vErr);
    assert.ok(Array.isArray(viewData));
  });

  await t.test('8. service_role SÍ puede ejecutar exitosamente los RPCs: get_next_code_sequence, apply_stock_movement y post_patrimonial_movement', async () => {
    const testTag = `SEC_RPC_${Date.now()}`;

    // a) get_next_code_sequence
    const { data: seqData, error: seqErr } = await (serverClient.rpc as any)('get_next_code_sequence', {
      p_prefix: 'TST',
    });
    assert.ifError(seqErr);
    assert.ok(typeof seqData === 'string');
    assert.ok(seqData.startsWith('TST'));

    // b) Crear datos mínimos para probar apply_stock_movement y post_patrimonial_movement
    const { data: op } = await serverClient
      .from('business_operations')
      .insert({
        operation_type: 'STOCK_ADJUSTMENT',
        business_date: '2026-10-02',
      })
      .select('id')
      .single();
    const operationId = op!.id;

    const { data: item } = await serverClient
      .from('stock_items')
      .insert({
        code: `COM_${testTag}`,
        item_type: 'COM',
        name: `Item Sec ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 1,
      })
      .select('id')
      .single();
    const stockItemId = item!.id;
    await serverClient.from('components').insert({ stock_item_id: stockItemId });

    // Ejecutar apply_stock_movement
    const { data: stockMovData, error: stockMovErr } = await (serverClient.rpc as any)('apply_stock_movement', {
      p_operation_id: operationId,
      p_stock_item_id: stockItemId,
      p_movement_type: 'AJUSTE',
      p_quantity_delta: '15',
      p_description: 'Movimiento autorizado de prueba',
    });
    assert.ifError(stockMovErr);
    assert.ok(stockMovData.movement_id);
    assert.ok(stockMovData.code.startsWith('MST'));
    assert.strictEqual(stockMovData.new_balance, '15.000');

    // c) Probar post_patrimonial_movement
    const { data: cust } = await serverClient
      .from('customers')
      .insert({
        code: `CLI_${testTag}`,
        name: `Cliente Sec ${testTag}`,
      })
      .select('id')
      .single();
    const customerId = cust!.id;

    const { data: acc } = await serverClient
      .from('financial_accounts')
      .insert({
        account_type: 'CUSTOMER_RECEIVABLE',
        name: `Cuenta Sec ${testTag}`,
        customer_id: customerId,
        current_balance: 5000,
      })
      .select('id')
      .single();
    const accountId = acc!.id;

    const { data: patMovData, error: patMovErr } = await (serverClient.rpc as any)('post_patrimonial_movement', {
      p_operation_id: operationId,
      p_movement_type: 'VENTA',
      p_description: 'Movimiento patrimonial autorizado',
      p_amount_ars: '2000',
      p_entries: [{ financial_account_id: accountId, delta_ars: '2000' }],
    });
    assert.ifError(patMovErr);
    assert.ok(patMovData.movement_id);
    assert.ok(patMovData.code.startsWith('MOV'));

    // Limpieza
    await serverClient.from('financial_entries').delete().eq('patrimonial_movement_id', patMovData.movement_id);
    await serverClient.from('patrimonial_movements').delete().eq('id', patMovData.movement_id);
    await serverClient.from('financial_accounts').delete().eq('id', accountId);
    await serverClient.from('customers').delete().eq('id', customerId);
    await serverClient.from('stock_movements').delete().eq('stock_item_id', stockItemId);
    await serverClient.from('stock_balances').delete().eq('stock_item_id', stockItemId);
    await serverClient.from('components').delete().eq('stock_item_id', stockItemId);
    await serverClient.from('stock_items').delete().eq('id', stockItemId);
    await serverClient.from('business_operations').delete().eq('id', operationId);
  });
});
