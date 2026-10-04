import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Altas de PBA y Fórmulas — RPCs atómicas, validación, precisión e inmutabilidad', async (t) => {
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  // Cliente autenticado de prueba (rol authenticated)
  let authClient: any = null;
  let testUserId: string | null = null;
  const testUserEmail = `sec_formula_${Date.now()}@steffen-test.local`;
  const testUserPassword = 'TestPassword123!';

  // Tracking para cleanup exhaustivo
  const createdBaseProductIds: string[] = [];
  const createdStockItemIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdOperationIds: string[] = [];

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
      // Ignorar si auth admin no está disponible
    }
  });

  // Helper para crear proveedor
  async function createSupplier(name: string): Promise<string> {
    const { data, error } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: `${name} ${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      p_currency_code: 'ARS',
    });
    assert.ifError(error);
    createdSupplierIds.push(data.id);
    return data.id;
  }

  // Helper para crear Materia Prima (MPR)
  async function createRawMaterial(supplierId: string, name: string): Promise<string> {
    const { data, error } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'MPR',
      p_name: `${name} ${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      p_stock_minimum: 10,
      p_initial_supplier_id: supplierId,
      p_initial_quoted_price_net: 1000,
      p_initial_stock: 50,
      p_inci: 'Aqua / Purified Water',
    });
    assert.ifError(error);
    createdStockItemIds.push(data.id);
    if (data.movement?.movement_id) {
      const { data: movRow } = await serverClient
        .from('stock_movements')
        .select('operation_id')
        .eq('id', data.movement.movement_id)
        .single();
      if (movRow?.operation_id) {
        createdOperationIds.push(movRow.operation_id);
      }
    }
    return data.id;
  }

  t.after(async () => {
    // 1. Limpieza de usuario autenticado de prueba
    if (testUserId) {
      try {
        await serverClient.auth.admin.deleteUser(testUserId);
      } catch {
        // Ignorar
      }
    }

    // 2. Limpieza de fórmulas y productos base
    for (const bpId of createdBaseProductIds) {
      const { data: versions } = await serverClient
        .from('formula_versions')
        .select('id')
        .eq('base_product_id', bpId);
      if (versions) {
        for (const v of versions) {
          await serverClient.from('formula_version_items').delete().eq('formula_version_id', v.id);
        }
      }
      await serverClient.from('formula_versions').delete().eq('base_product_id', bpId);
      await serverClient.from('base_products').delete().eq('id', bpId);
    }

    // 3. Limpieza de stock items (MPR) y dependencias
    for (const itemId of createdStockItemIds) {
      await serverClient.from('stock_movements').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', itemId);
      await serverClient.from('supplier_items').delete().eq('stock_item_id', itemId);
      await serverClient.from('raw_materials').delete().eq('stock_item_id', itemId);
      await serverClient.from('components').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_items').delete().eq('id', itemId);
    }

    // 4. Limpieza de operaciones
    for (const opId of createdOperationIds) {
      await serverClient.from('business_operations').delete().eq('id', opId);
    }

    // 5. Limpieza de proveedores
    for (const supId of createdSupplierIds) {
      await serverClient.from('financial_accounts').delete().eq('supplier_id', supId);
      await serverClient.from('suppliers').delete().eq('id', supId);
    }
  });

  // Preparar datos base
  const supplierId = await createSupplier('Proveedor Base Formulas');
  const mprId1 = await createRawMaterial(supplierId, 'MPR Activa 1');
  const mprId2 = await createRawMaterial(supplierId, 'MPR Activa 2');

  // ============================================================================
  // GRUPO 1: VALIDACIONES SIN EFECTOS LATERALES (ROLLBACK TEMPRANO)
  // ============================================================================
  await t.test('1. Validación: rechaza nombre de PBA vacío o inválido', async () => {
    const { data, error } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: '   ',
      p_items: [{ raw_material_id: mprId1, quantity_kg: 5.0 }],
    });
    assert.ok(error, 'Debe fallar ante nombre vacío');
    assert.strictEqual(data, null);
  });

  await t.test('2. Validación: rechaza fórmula sin renglones o items vacíos', async () => {
    const { data: d1, error: e1 } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA Sin Items',
      p_items: [],
    });
    assert.ok(e1, 'Debe fallar ante p_items vacío');
    assert.strictEqual(d1, null);

    const { data: d2, error: e2 } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA Null Items',
      p_items: null,
    });
    assert.ok(e2, 'Debe fallar ante p_items null');
    assert.strictEqual(d2, null);
  });

  await t.test('3. Validación: rechaza UUID de Materia Prima inexistente', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA Fake MPR',
      p_items: [{ raw_material_id: fakeUuid, quantity_kg: 2.0 }],
    });
    assert.ok(error, 'Debe fallar ante MPR inexistente');
    assert.strictEqual(data, null);
  });

  await t.test('4. Validación: rechaza Materia Prima inactiva', async () => {
    // Crear una MPR y desactivarla
    const inactMprId = await createRawMaterial(supplierId, 'MPR Inactiva Test');
    await serverClient.from('stock_items').update({ active: false }).eq('id', inactMprId);

    const { data, error } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA MPR Inactiva',
      p_items: [{ raw_material_id: inactMprId, quantity_kg: 1.0 }],
    });
    assert.ok(error, 'Debe fallar ante MPR inactiva');
    assert.strictEqual(data, null);
  });

  await t.test('5. Validación: rechaza Materias Primas duplicadas dentro de la misma fórmula', async () => {
    const { data, error } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA MPR Duplicada',
      p_items: [
        { raw_material_id: mprId1, quantity_kg: 1.0 },
        { raw_material_id: mprId1, quantity_kg: 2.5 },
      ],
    });
    assert.ok(error, 'Debe fallar si la misma MPR se incluye más de una vez en la fórmula');
    assert.strictEqual(data, null);
  });

  await t.test('6. Validación: rechaza cantidad <= 0', async () => {
    // Cantidad 0
    const { data: d1, error: e1 } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA Qty Cero',
      p_items: [{ raw_material_id: mprId1, quantity_kg: 0 }],
    });
    assert.ok(e1, 'Debe fallar ante cantidad 0');
    assert.strictEqual(d1, null);

    // Cantidad negativa
    const { data: d2, error: e2 } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA Qty Negativa',
      p_items: [{ raw_material_id: mprId1, quantity_kg: -2.5 }],
    });
    assert.ok(e2, 'Debe fallar ante cantidad negativa');
    assert.strictEqual(d2, null);
  });

  await t.test('7. Validación: rechaza precisión mayor a 3 decimales (ej: 1.1234)', async () => {
    const { data, error } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'PBA 4 Decimales',
      p_items: [{ raw_material_id: mprId1, quantity_kg: 1.1234 }],
    });
    assert.ok(error, 'Debe rechazar 1.1234 por exceder 3 decimales permitidos');
    assert.strictEqual(data, null);
  });

  // ============================================================================
  // GRUPO 2: ÉXITO ATÓMICO Y PRECISIÓN EXACTA (PBA + FÓRMULA v1)
  // ============================================================================
  let sharedBaseProductId = '';

  await t.test('8. Éxito: alta atómica de PBA + Fórmula v1 con 3 decimales válidos (1.123)', async () => {
    const testPbaName = `Crema Base Lavanda ${Date.now()}`;
    const { data, error } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: testPbaName,
      p_items: [
        { raw_material_id: mprId1, quantity_kg: 1.123, sort_order: 1 },
        { raw_material_id: mprId2, quantity_kg: 0.877, sort_order: 2 },
      ],
      p_observations: 'Fórmula v1 inicial para prueba atómica',
    });

    assert.ifError(error);
    assert.ok(data.base_product?.id, 'Debe devolver base_product.id');
    assert.match(data.base_product.code, /^PBA\d{4,}$/, 'El código debe respetar formato PBAxxxx');
    assert.strictEqual(data.base_product.name, testPbaName);
    assert.strictEqual(data.base_product.active, true);

    assert.ok(data.formula_version?.id, 'Debe devolver formula_version.id');
    assert.strictEqual(data.formula_version.version_number, 1, 'La versión inicial debe ser 1');
    assert.strictEqual(data.formula_version.is_current, true, 'La versión 1 debe ser is_current = true');
    assert.strictEqual(data.formula_version.items.length, 2, 'Debe contener exactamente 2 items');

    // Verificar item con 3 decimales
    const item1 = data.formula_version.items.find((i: any) => i.raw_material_id === mprId1);
    assert.ok(item1);
    assert.strictEqual(Number(item1.quantity_kg), 1.123, 'La cantidad debe conservarse exacta con 3 decimales');
    assert.strictEqual(item1.sort_order, 1);

    sharedBaseProductId = data.base_product.id;
    createdBaseProductIds.push(sharedBaseProductId);

    // Verificar en BD que las 3 tablas tienen los registros correspondientes
    const { data: bpRow, error: bpErr } = await serverClient
      .from('base_products')
      .select('*')
      .eq('id', sharedBaseProductId)
      .single();
    assert.ifError(bpErr);
    assert.strictEqual(bpRow.code, data.base_product.code);

    const { data: fvRows, error: fvErr } = await serverClient
      .from('formula_versions')
      .select('*')
      .eq('base_product_id', sharedBaseProductId);
    assert.ifError(fvErr);
    assert.strictEqual(fvRows.length, 1);
    assert.strictEqual(fvRows[0].version_number, 1);
    assert.strictEqual(fvRows[0].is_current, true);

    const { data: fviRows, error: fviErr } = await serverClient
      .from('formula_version_items')
      .select('*')
      .eq('formula_version_id', fvRows[0].id);
    assert.ifError(fviErr);
    assert.strictEqual(fviRows.length, 2);
  });

  // ============================================================================
  // GRUPO 3: CREACIÓN DE NUEVA VERSIÓN (v2), INMUTABILIDAD Y DESACTIVACIÓN DE v1
  // ============================================================================
  await t.test('9. Éxito: crear v2 desactiva is_current de v1 y mantiene sus renglones inmutables', async () => {
    assert.ok(sharedBaseProductId, 'Debe existir un PBA previo');

    // Consultar items de v1 antes de crear v2
    const { data: v1Before } = await serverClient
      .from('formula_versions')
      .select('id, version_number, is_current')
      .eq('base_product_id', sharedBaseProductId)
      .eq('version_number', 1)
      .single();
    assert.ok(v1Before);

    const { data: v1ItemsBefore } = await serverClient
      .from('formula_version_items')
      .select('*')
      .eq('formula_version_id', v1Before.id)
      .order('sort_order', { ascending: true });

    // Crear v2 con p_items distintos
    const { data: v2Data, error: v2Err } = await (serverClient.rpc as any)('create_new_formula_version', {
      p_base_product_id: sharedBaseProductId,
      p_items: [
        { raw_material_id: mprId1, quantity_kg: 2.5, sort_order: 1 },
      ],
      p_observations: 'Versión 2 ajustada',
    });

    assert.ifError(v2Err);
    assert.strictEqual(v2Data.version_number, 2, 'El nuevo version_number debe ser 2');
    assert.strictEqual(v2Data.is_current, true, 'La nueva versión v2 debe ser is_current = true');
    assert.strictEqual(v2Data.items.length, 1, 'La nueva versión tiene 1 renglón');

    // 1. Comprobar que v1 pasó a is_current = false
    const { data: v1After } = await serverClient
      .from('formula_versions')
      .select('id, version_number, is_current')
      .eq('id', v1Before.id)
      .single();
    assert.ok(v1After);
    assert.strictEqual(v1After.is_current, false, 'La versión v1 debe ser ahora is_current = false');

    // 2. Comprobar que los items de v1 siguen exactamente intactos (inmutabilidad histórica)
    const { data: v1ItemsAfter } = await serverClient
      .from('formula_version_items')
      .select('*')
      .eq('formula_version_id', v1Before.id)
      .order('sort_order', { ascending: true });
    assert.deepStrictEqual(v1ItemsBefore, v1ItemsAfter, 'Los items de la versión histórica 1 no deben ser alterados');

    // 3. Comprobar que existe exactamente UNA versión activa (is_current = true) para este PBA
    const { data: currentVersions } = await serverClient
      .from('formula_versions')
      .select('id, version_number')
      .eq('base_product_id', sharedBaseProductId)
      .eq('is_current', true);
    assert.strictEqual(currentVersions?.length, 1, 'Debe haber exactamente una versión vigente');
    assert.strictEqual(currentVersions?.[0].version_number, 2);
  });

  await t.test('10. Validación: rechaza nueva versión si el Producto Base está inactivo', async () => {
    // Desactivar temporalmente el PBA
    await serverClient.from('base_products').update({ active: false }).eq('id', sharedBaseProductId);

    const { data, error } = await (serverClient.rpc as any)('create_new_formula_version', {
      p_base_product_id: sharedBaseProductId,
      p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
    });

    assert.ok(error, 'Debe fallar al intentar versionar un PBA inactivo');
    assert.strictEqual(data, null);

    // Restaurar activo
    await serverClient.from('base_products').update({ active: true }).eq('id', sharedBaseProductId);
  });

  // ============================================================================
  // GRUPO 4: SEGURIDAD COMPLETA (anon / authenticated / service_role)
  // ============================================================================
  await t.test('11. Seguridad completa: anon y authenticated denegados, service_role autorizado en ambas RPCs', async () => {
    // 1. anon denegado en create_base_product_with_formula
    const { data: dAnon1, error: anonErr1 } = await (anonClient.rpc as any)('create_base_product_with_formula', {
      p_name: 'Hacker PBA Anon',
      p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
    });
    assert.ok(anonErr1, 'anon no debe poder ejecutar create_base_product_with_formula');
    assert.strictEqual(dAnon1, null);

    // 2. anon denegado en create_new_formula_version
    const { data: dAnon2, error: anonErr2 } = await (anonClient.rpc as any)('create_new_formula_version', {
      p_base_product_id: sharedBaseProductId,
      p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
    });
    assert.ok(anonErr2, 'anon no debe poder ejecutar create_new_formula_version');
    assert.strictEqual(dAnon2, null);

    // 3. authenticated denegado en ambas RPCs
    if (authClient) {
      const { data: dAuth1, error: authErr1 } = await (authClient.rpc as any)('create_base_product_with_formula', {
        p_name: 'Hacker PBA Auth',
        p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
      });
      assert.ok(authErr1, 'authenticated no debe poder ejecutar create_base_product_with_formula');
      assert.strictEqual(dAuth1, null);

      const { data: dAuth2, error: authErr2 } = await (authClient.rpc as any)('create_new_formula_version', {
        p_base_product_id: sharedBaseProductId,
        p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
      });
      assert.ok(authErr2, 'authenticated no debe poder ejecutar create_new_formula_version');
      assert.strictEqual(dAuth2, null);
    }

    // 4. service_role autorizado en ambas RPCs
    const { data: srvData1, error: srvErr1 } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: `PBA Autorizado SR ${Date.now()}`,
      p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
    });
    assert.ifError(srvErr1);
    assert.ok(srvData1?.base_product?.id, 'service_role debe poder ejecutar create_base_product_with_formula');
    createdBaseProductIds.push(srvData1.base_product.id);

    const { data: srvData2, error: srvErr2 } = await (serverClient.rpc as any)('create_new_formula_version', {
      p_base_product_id: srvData1.base_product.id,
      p_items: [{ raw_material_id: mprId2, quantity_kg: 2.0 }],
    });
    assert.ifError(srvErr2);
    assert.ok(srvData2?.id, 'service_role debe poder ejecutar create_new_formula_version');
  });

  // ============================================================================
  // GRUPO 5: CONCURRENCIA
  // ============================================================================
  await t.test('12. Concurrencia de códigos: llamadas paralelas a create_base_product_with_formula generan PBAxxxx únicos', async () => {
    const promises = Array.from({ length: 4 }, (_, i) =>
      (serverClient.rpc as any)('create_base_product_with_formula', {
        p_name: `PBA Paralelo ${Date.now()}_${i}`,
        p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0 }],
      })
    );

    const results = await Promise.all(promises);
    const codes = new Set<string>();

    for (const res of results) {
      assert.ifError(res.error);
      assert.ok(res.data?.base_product?.id);
      assert.ok(res.data?.base_product?.code);
      createdBaseProductIds.push(res.data.base_product.id);
      assert.strictEqual(codes.has(res.data.base_product.code), false, `Código duplicado detectado: ${res.data.base_product.code}`);
      codes.add(res.data.base_product.code);
    }

    assert.strictEqual(codes.size, 4, 'Deben haberse generado exactamente 4 códigos únicos');
  });

  await t.test('13. Concurrencia de versionado sobre el mismo PBA: FOR UPDATE previene duplicación de versión', async () => {
    // 1. Crear un PBA dedicado con versión inicial v1
    const pbaName = `PBA Concurrente Versionado ${Date.now()}`;
    const { data: pbaInit, error: pbaErr } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: pbaName,
      p_items: [{ raw_material_id: mprId1, quantity_kg: 1.0, sort_order: 1 }],
      p_observations: 'Versión 1 original para prueba de concurrencia',
    });
    assert.ifError(pbaErr);
    const concurrentBpId = pbaInit.base_product.id;
    createdBaseProductIds.push(concurrentBpId);

    const v1Id = pbaInit.formula_version.id;
    const { data: v1ItemsBefore } = await serverClient
      .from('formula_version_items')
      .select('*')
      .eq('formula_version_id', v1Id)
      .order('sort_order', { ascending: true });

    // 2. Disparar dos llamadas concurrentes a create_new_formula_version sobre el mismo base_product_id
    const promiseA = (serverClient.rpc as any)('create_new_formula_version', {
      p_base_product_id: concurrentBpId,
      p_items: [{ raw_material_id: mprId1, quantity_kg: 2.5, sort_order: 1 }],
      p_observations: 'Rama concurrente A',
    });

    const promiseB = (serverClient.rpc as any)('create_new_formula_version', {
      p_base_product_id: concurrentBpId,
      p_items: [{ raw_material_id: mprId2, quantity_kg: 3.75, sort_order: 1 }],
      p_observations: 'Rama concurrente B',
    });

    const [resA, resB] = await Promise.all([promiseA, promiseB]);
    assert.ifError(resA.error);
    assert.ifError(resB.error);

    // 3. Verificar que no existan version_number duplicados y sean 2 y 3
    const newVersions = [resA.data.version_number, resB.data.version_number].sort();
    assert.deepStrictEqual(newVersions, [2, 3], 'Las dos versiones concurrentes deben ser exactamente 2 y 3');

    // 4. Verificar todas las versiones en base de datos
    const { data: allVersions, error: allVerErr } = await serverClient
      .from('formula_versions')
      .select('*')
      .eq('base_product_id', concurrentBpId)
      .order('version_number', { ascending: true });

    assert.ifError(allVerErr);
    assert.strictEqual(allVersions?.length, 3, 'Deben existir exactamente 3 versiones (v1, v2, v3)');

    const versionNums = allVersions!.map((v: any) => v.version_number);
    assert.deepStrictEqual(versionNums, [1, 2, 3], 'Los números de versión deben ser exactamente 1, 2 y 3');

    // 5. Verificar que exactamente una versión quede is_current = true (la última, versión 3)
    const currentVersions = allVersions!.filter((v: any) => v.is_current === true);
    assert.strictEqual(currentVersions.length, 1, 'Exactamente una versión debe ser is_current = true');
    assert.strictEqual(currentVersions[0].version_number, 3, 'La versión vigente final debe ser la 3');

    // 6. Verificar que las versiones anteriores (v1 y v2) tengan is_current = false
    const inactiveVersions = allVersions!.filter((v: any) => v.is_current === false);
    assert.strictEqual(inactiveVersions.length, 2, 'Las otras 2 versiones deben ser is_current = false');

    // 7. Verificar que las versiones históricas (v1) permanezcan intactas
    const { data: v1ItemsAfter } = await serverClient
      .from('formula_version_items')
      .select('*')
      .eq('formula_version_id', v1Id)
      .order('sort_order', { ascending: true });
    assert.deepStrictEqual(v1ItemsBefore, v1ItemsAfter, 'Los items de la versión inicial v1 deben permanecer inmutables');
  });
});
