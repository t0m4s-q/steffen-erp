import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { PriceListDomainService } from '../src/services/price-list.service';
import { PriceListRepository } from '../src/repositories/price-list.repository';
import { PricingService } from '../src/services/pricing.service';
import { ProductRepository } from '../src/repositories/product.repository';
import { Decimal } from '../src/domain/decimal';
import { DomainError, NoPriceSnapshotFoundError } from '../src/domain/errors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Gestión Atómica de Listas de Precios (Fase 4) — RPCs, versionado, aumentos masivos y seguridad', async (t) => {
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  let authClient: any = null;
  let testUserId: string | null = null;
  const testUserEmail = `sec_pricelist_${Date.now()}@steffen-test.local`;
  const testUserPassword = 'TestPassword123!';

  // Repositorios y servicios
  const priceListRepo = new PriceListRepository(serverClient);
  const priceListService = new PriceListDomainService(priceListRepo);
  const productRepo = new ProductRepository(serverClient);
  const pricingService = new PricingService(productRepo);

  // Tracking para limpieza
  const createdPriceListIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdBaseProductIds: string[] = [];
  const createdStockItemIds: string[] = [];
  const createdSupplierIds: string[] = [];

  let testSupplierId: string;
  let testMprId: string;
  let testComId: string;
  let testPbaId: string;
  let salonListId: string;
  let publicListId: string;
  let ecomListId: string;

  t.before(async () => {
    // 1. Usuario autenticado de prueba
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
      // Ignorar si auth admin no está habilitado
    }

    // 2. Localizar las 3 listas de sistema existentes
    const { data: lists } = await serverClient
      .from('price_lists')
      .select('id, system_role');

    salonListId = lists?.find((l) => l.system_role === 'SALON_DEFAULT')?.id!;
    publicListId = lists?.find((l) => l.system_role === 'PUBLIC_DEFAULT')?.id!;
    ecomListId = lists?.find((l) => l.system_role === 'ECOMMERCE_DEFAULT')?.id!;

    assert.ok(salonListId, 'Debe existir SALON_DEFAULT');
    assert.ok(publicListId, 'Debe existir PUBLIC_DEFAULT');
    assert.ok(ecomListId, 'Debe existir ECOMMERCE_DEFAULT');

    // 3. Crear insumos base para generar PROs reales
    const { data: supData } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: `Proveedor PL Test ${Date.now()}`,
      p_currency_code: 'ARS',
    });
    testSupplierId = supData.id;
    createdSupplierIds.push(testSupplierId);

    const { data: mprData } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'MPR',
      p_name: `MPR PL Test ${Date.now()}`,
      p_stock_minimum: 10,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 500,
      p_initial_stock: 50,
      p_inci: 'Aqua Purificata',
    });
    testMprId = mprData.id;
    createdStockItemIds.push(testMprId);

    const { data: comData } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: `Envase PL Test ${Date.now()}`,
      p_stock_minimum: 20,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 100,
      p_initial_stock: 50,
    });
    testComId = comData.id;
    createdStockItemIds.push(testComId);

    const { data: pbaData } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: `PBA PL Test ${Date.now()}`,
      p_items: [{ raw_material_id: testMprId, quantity_kg: 1.0, sort_order: 1 }],
      p_observations: 'Fórmula test',
    });
    testPbaId = pbaData.base_product.id;
    createdBaseProductIds.push(testPbaId);
  });

  t.after(async () => {
    if (testUserId) {
      try {
        await serverClient.auth.admin.deleteUser(testUserId);
      } catch {}
    }

    for (const prodId of createdProductIds) {
      await serverClient.from('product_price_versions').delete().eq('product_id', prodId);
      await serverClient.from('product_components').delete().eq('product_id', prodId);
      await serverClient.from('products').delete().eq('stock_item_id', prodId);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', prodId);
      await serverClient.from('stock_items').delete().eq('id', prodId);
    }

    for (const listId of createdPriceListIds) {
      await serverClient.from('product_price_versions').delete().eq('price_list_id', listId);
      await serverClient.from('price_lists').delete().eq('id', listId);
    }

    for (const pbaId of createdBaseProductIds) {
      const { data: fvs } = await serverClient.from('formula_versions').select('id').eq('base_product_id', pbaId);
      if (fvs) {
        for (const fv of fvs) {
          await serverClient.from('formula_version_items').delete().eq('formula_version_id', fv.id);
        }
      }
      await serverClient.from('formula_versions').delete().eq('base_product_id', pbaId);
      await serverClient.from('base_products').delete().eq('id', pbaId);
    }

    for (const sid of createdStockItemIds) {
      await serverClient.from('components').delete().eq('stock_item_id', sid);
      await serverClient.from('raw_materials').delete().eq('stock_item_id', sid);
      await serverClient.from('supplier_items').delete().eq('stock_item_id', sid);
      await serverClient.from('stock_movements').delete().eq('stock_item_id', sid);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', sid);
      await serverClient.from('stock_items').delete().eq('id', sid);
    }

    for (const supId of createdSupplierIds) {
      await serverClient.from('supplier_items').delete().eq('supplier_id', supId);
      await serverClient.from('financial_entries').delete().eq('source_id', supId);
      await serverClient.from('financial_accounts').delete().eq('entity_id', supId);
      await serverClient.from('suppliers').delete().eq('id', supId);
    }
  });

  // Helper para crear PRO de prueba
  async function createTestPro(name: string, active = true): Promise<string> {
    const { data: proData, error } = await (serverClient.rpc as any)('create_final_product', {
      p_name: name,
      p_base_product_id: testPbaId,
      p_presentation: '250ml',
      p_weight_kg: 0.25,
      p_stock_minimum: 10,
      p_components: [{ component_id: testComId, quantity_per_unit: '1' }],
    });
    assert.ifError(error);
    const pid = proData.id;
    createdProductIds.push(pid);

    if (!active) {
      await serverClient.from('stock_items').update({ active: false }).eq('id', pid);
    }
    return pid;
  }

  // ============================================================================
  // 1. Listas de sistema y listas adicionales
  // ============================================================================
  await t.test('1. Listas de sistema existen, no pueden desactivarse y pueden renombrarse conservando su rol', async () => {
    // A. Intento de desactivar SALON_DEFAULT -> Rechazado
    const { error: errDeact } = await (serverClient.rpc as any)('update_price_list', {
      p_price_list_id: salonListId,
      p_active: false,
    });
    assert.ok(errDeact);
    assert.match(errDeact.message, /listas de sistema.*no pueden desactivarse/i);

    // B. Renombrar SALON_DEFAULT -> Permitido, conserva system_role
    const { data: renData, error: errRen } = await (serverClient.rpc as any)('update_price_list', {
      p_price_list_id: salonListId,
      p_name: 'Lista Salón Principal',
    });
    assert.ifError(errRen);
    assert.strictEqual(renData.name, 'Lista Salón Principal');
    assert.strictEqual(renData.system_role, 'SALON_DEFAULT');
    assert.strictEqual(renData.active, true);

    // Restaurar nombre
    await (serverClient.rpc as any)('update_price_list', {
      p_price_list_id: salonListId,
      p_name: 'Lista Salón',
    });
  });

  await t.test('2. Crear lista adicional: system_role = NULL forzado, activable y desactivable', async () => {
    // A. Creación de lista adicional
    const listName = `Lista Mayorista ${Date.now()}`;
    const { data: newList, error: errCreate } = await (serverClient.rpc as any)('create_price_list', {
      p_name: listName,
    });
    assert.ifError(errCreate);
    assert.ok(newList.id);
    createdPriceListIds.push(newList.id);
    assert.strictEqual(newList.name, listName);
    assert.strictEqual(newList.system_role, null);
    assert.strictEqual(newList.active, true);

    // B. Desactivar lista adicional -> Permitido
    const { data: deactData, error: errDeact } = await (serverClient.rpc as any)('update_price_list', {
      p_price_list_id: newList.id,
      p_active: false,
    });
    assert.ifError(errDeact);
    assert.strictEqual(deactData.active, false);

    // C. Reactivar lista adicional -> Permitido
    const { data: reactData, error: errReact } = await (serverClient.rpc as any)('update_price_list', {
      p_price_list_id: newList.id,
      p_active: true,
    });
    assert.ifError(errReact);
    assert.strictEqual(reactData.active, true);
  });

  // ============================================================================
  // 2. Precios individuales de PRO, versionado e inmutabilidad
  // ============================================================================
  await t.test('3. Precio inicial y actualización: genera nueva versión, preserva historia y única vigente', async () => {
    const proId = await createTestPro(`PRO Precios ${Date.now()}`);

    // A. Fijar precio inicial ($2.000 ARS)
    const { data: v1, error: e1 } = await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proId,
      p_price_ars: 2000,
    });
    assert.ifError(e1);
    assert.ok(v1.id);
    assert.strictEqual(v1.price_ars, 2000);
    assert.strictEqual(v1.previous_price_ars, null);
    assert.strictEqual(v1.valid_to, null);

    // B. Actualizar precio ($2.800 ARS)
    const { data: v2, error: e2 } = await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proId,
      p_price_ars: 2800,
    });
    assert.ifError(e2);
    assert.ok(v2.id);
    assert.strictEqual(v2.price_ars, 2800);
    assert.strictEqual(v2.previous_price_ars, 2000);
    assert.strictEqual(v2.valid_to, null);

    // C. Verificar versión histórica v1 cerrada
    const { data: v1Db } = await serverClient
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('id', v1.id)
      .single();
    assert.strictEqual(Number(v1Db!.price_ars), 2000);
    assert.ok(v1Db!.valid_to !== null);
    assert.strictEqual(v1Db!.valid_to, v2.valid_from);

    // D. Verificar que sólo hay una versión vigente
    const { data: currents } = await serverClient
      .from('product_price_versions')
      .select('id')
      .eq('price_list_id', salonListId)
      .eq('product_id', proId)
      .is('valid_to', null);
    assert.strictEqual(currents?.length, 1);
  });

  await t.test('4. Validaciones de precio individual: rechaza <= 0 y rechaza centavos/fracciones', async () => {
    const proId = await createTestPro(`PRO Precios Val ${Date.now()}`);

    // Cero
    const { error: err0 } = await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proId,
      p_price_ars: 0,
    });
    assert.ok(err0);
    assert.match(err0.message, /mayor a 0/i);

    // Negativo
    const { error: errNeg } = await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proId,
      p_price_ars: -500,
    });
    assert.ok(errNeg);
    assert.match(errNeg.message, /mayor a 0/i);

    // Decimales (1250.75)
    const { error: errDec } = await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proId,
      p_price_ars: 1250.75,
    });
    assert.ok(errDec);
    assert.match(errDec.message, /entero/i);
  });

  // ============================================================================
  // 3. Aumentos masivos: global, selectivo, redondeo y rollback
  // ============================================================================
  await t.test('5. Aumento global: actualiza todos los PROs activos con precio y excluye inactivos', async () => {
    const proActivo = await createTestPro(`PRO Activo Global ${Date.now()}`, true);
    const proInactivo = await createTestPro(`PRO Inactivo Global ${Date.now()}`, false);

    // Asignar precio de partida
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proActivo,
      p_price_ars: 1000,
    });

    // Forzar inserción de precio en inactivo directamente para probar exclusión en aumento global
    await serverClient.from('product_price_versions').insert({
      price_list_id: salonListId,
      product_id: proInactivo,
      price_ars: 500,
      valid_from: new Date().toISOString(),
      valid_to: null,
    });

    // Aumento global del 15%
    const { data: bulkRes, error: bulkErr } = await (serverClient.rpc as any)('apply_bulk_price_increase', {
      p_price_list_id: salonListId,
      p_percentage: 15,
      p_product_ids: null,
    });
    assert.ifError(bulkErr);
    assert.ok(bulkRes.updated_count >= 1);

    // Verificar proActivo: 1000 * 1.15 = 1150
    const { data: actPrice } = await serverClient
      .from('product_price_versions')
      .select('price_ars')
      .eq('price_list_id', salonListId)
      .eq('product_id', proActivo)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(actPrice!.price_ars), 1150);

    // Verificar proInactivo: conservó su precio original (no fue aumentado)
    const { data: inactPrice } = await serverClient
      .from('product_price_versions')
      .select('price_ars')
      .eq('price_list_id', salonListId)
      .eq('product_id', proInactivo)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(inactPrice!.price_ars), 500);
  });

  await t.test('6. Aumento selectivo: actualiza sólo los seleccionados; redondeo simétrico al peso entero', async () => {
    const proSel = await createTestPro(`PRO Selectivo ${Date.now()}`);
    const proNoSel = await createTestPro(`PRO No Selectivo ${Date.now()}`);

    // proSel: $1.000 ARS; proNoSel: $1.000 ARS
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proSel,
      p_price_ars: 1000,
    });
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proNoSel,
      p_price_ars: 1000,
    });

    // Aumento selectivo del 12.5% sobre proSel (1000 * 1.125 = 1125)
    const { data: selRes, error: selErr } = await (serverClient.rpc as any)('apply_bulk_price_increase', {
      p_price_list_id: salonListId,
      p_percentage: 12.5,
      p_product_ids: [proSel],
    });
    assert.ifError(selErr);
    assert.strictEqual(selRes.updated_count, 1);

    // Verificar proSel = 1125
    const { data: pSel } = await serverClient
      .from('product_price_versions')
      .select('price_ars')
      .eq('price_list_id', salonListId)
      .eq('product_id', proSel)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(pSel!.price_ars), 1125);

    // Verificar proNoSel = 1000 intacto
    const { data: pNoSel } = await serverClient
      .from('product_price_versions')
      .select('price_ars')
      .eq('price_list_id', salonListId)
      .eq('product_id', proNoSel)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(pNoSel!.price_ars), 1000);
  });

  await t.test('7. Rollback total en aumento selectivo si un producto no tiene precio previo o está duplicado', async () => {
    const proConPrecio = await createTestPro(`PRO Con Precio ${Date.now()}`);
    const proSinPrecio = await createTestPro(`PRO Sin Precio ${Date.now()}`);

    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proConPrecio,
      p_price_ars: 1000,
    });

    // A. Incluir proSinPrecio -> Falla y proConPrecio permanece intacto
    const { error: errSinPrecio } = await (serverClient.rpc as any)('apply_bulk_price_increase', {
      p_price_list_id: salonListId,
      p_percentage: 10,
      p_product_ids: [proConPrecio, proSinPrecio],
    });
    assert.ok(errSinPrecio);
    assert.match(errSinPrecio.message, /no posee precio vigente/i);

    // Verificar que proConPrecio no sufrió cambio
    const { data: checkP } = await serverClient
      .from('product_price_versions')
      .select('price_ars')
      .eq('price_list_id', salonListId)
      .eq('product_id', proConPrecio)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(checkP!.price_ars), 1000);

    // B. Enviar IDs duplicados -> Falla
    const { error: errDup } = await (serverClient.rpc as any)('apply_bulk_price_increase', {
      p_price_list_id: salonListId,
      p_percentage: 10,
      p_product_ids: [proConPrecio, proConPrecio],
    });
    assert.ok(errDup);
    assert.match(errDup.message, /duplicados/i);
  });

  // ============================================================================
  // 4. Concurrencia de primer precio, cronología y serialización con aumentos
  // ============================================================================
  await t.test('8. Concurrencia al asignar precio: serialización limpia, cronología monótona y valid_to = valid_from siguiente', async () => {
    const proNuevo = await createTestPro(`PRO Concurrente ${Date.now()}`);

    // Disparar dos asignaciones de precio en paralelo sobre el mismo PRO y lista
    const [res1, res2] = await Promise.all([
      (serverClient.rpc as any)('set_product_price', {
        p_price_list_id: salonListId,
        p_product_id: proNuevo,
        p_price_ars: 1500,
      }),
      (serverClient.rpc as any)('set_product_price', {
        p_price_list_id: salonListId,
        p_product_id: proNuevo,
        p_price_ars: 1600,
      }),
    ]);

    assert.ifError(res1.error);
    assert.ifError(res2.error);

    // Debe existir exactamente una versión vigente
    const { data: currs } = await serverClient
      .from('product_price_versions')
      .select('id, price_ars, valid_from, valid_to')
      .eq('price_list_id', salonListId)
      .eq('product_id', proNuevo)
      .is('valid_to', null);
    assert.strictEqual(currs?.length, 1);

    // Debe existir un total de 2 versiones ordenadas cronológicamente
    const { data: allVers } = await serverClient
      .from('product_price_versions')
      .select('id, price_ars, valid_from, valid_to')
      .eq('price_list_id', salonListId)
      .eq('product_id', proNuevo)
      .order('valid_from', { ascending: true });

    assert.strictEqual(allVers?.length, 2);

    const vClosed = allVers![0];
    const vOpen = allVers![1];

    // Cronología estricta:
    // 1. La cerrada debe tener valid_to >= valid_from
    assert.ok(vClosed.valid_to !== null);
    const closedFrom = new Date(vClosed.valid_from).getTime();
    const closedTo = new Date(vClosed.valid_to!).getTime();
    assert.ok(closedTo >= closedFrom, 'valid_to de versión cerrada debe ser >= valid_from');

    // 2. La versión cerrada termina exactamente donde comienza la siguiente
    assert.strictEqual(
      new Date(vClosed.valid_to!).toISOString(),
      new Date(vOpen.valid_from).toISOString(),
      'La versión anterior debe cerrarse en el instante exacto en que inicia la nueva'
    );

    // 3. La versión vigente tiene valid_to IS NULL
    assert.strictEqual(vOpen.valid_to, null);
  });

  await t.test('9. Concurrencia entre set_product_price y apply_bulk_price_increase sobre la misma lista: serialización sin deadlock', async () => {
    const proA = await createTestPro(`PRO Lock A ${Date.now()}`);
    const proB = await createTestPro(`PRO Lock B ${Date.now()}`);

    // Pre-cargar precios base
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proA,
      p_price_ars: 1000,
    });
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proB,
      p_price_ars: 2000,
    });

    // Disparar en paralelo un cambio individual en proA y un aumento global sobre la misma lista
    const [resIndiv, resBulk] = await Promise.all([
      (serverClient.rpc as any)('set_product_price', {
        p_price_list_id: salonListId,
        p_product_id: proA,
        p_price_ars: 1200,
      }),
      (serverClient.rpc as any)('apply_bulk_price_increase', {
        p_price_list_id: salonListId,
        p_percentage: 10,
        p_product_ids: [proA, proB],
      }),
    ]);

    assert.strictEqual(resIndiv.error, null);
    assert.strictEqual(resBulk.error, null);

    // Para ambos productos debe existir exactamente una versión vigente
    for (const pid of [proA, proB]) {
      const { data: currs } = await serverClient
        .from('product_price_versions')
        .select('id, price_ars, valid_from, valid_to')
        .eq('price_list_id', salonListId)
        .eq('product_id', pid)
        .is('valid_to', null);
      assert.strictEqual(currs?.length, 1, `Debe existir exactamente 1 versión vigente para PRO ${pid}`);
    }

    // Comprobar orden cronológico en proA (recibió ambas operaciones de forma serializada)
    const { data: versA } = await serverClient
      .from('product_price_versions')
      .select('id, price_ars, valid_from, valid_to')
      .eq('price_list_id', salonListId)
      .eq('product_id', proA)
      .order('valid_from', { ascending: true });

    assert.strictEqual(versA?.length, 3, 'proA debe tener 3 versiones históricas serializadas');
    const itemsA = versA || [];
    for (let i = 0; i < itemsA.length - 1; i++) {
      const currentItem: { id: string; price_ars: any; valid_from: string; valid_to: string | null } = itemsA[i];
      const nextItem: { id: string; price_ars: any; valid_from: string; valid_to: string | null } = itemsA[i + 1];
      assert.ok(currentItem.valid_to !== null);
      assert.ok(new Date(currentItem.valid_to!).getTime() >= new Date(currentItem.valid_from).getTime());
      assert.strictEqual(new Date(currentItem.valid_to!).toISOString(), new Date(nextItem.valid_from).toISOString());
    }
  });

  await t.test('10. Concurrencia entre dos apply_bulk_price_increase sobre listas distintas con IDs en orden opuesto: prevención de deadlock mediante orden determinístico', async () => {
    const proX = await createTestPro(`PRO CrossList X ${Date.now()}`);
    const proY = await createTestPro(`PRO CrossList Y ${Date.now()}`);

    // Pre-cargar precios en Lista Salón (proX: $1.000, proY: $2.000)
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proX,
      p_price_ars: 1000,
    });
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: proY,
      p_price_ars: 2000,
    });

    // Pre-cargar precios en Lista Público (proX: $1.200, proY: $2.400)
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: publicListId,
      p_product_id: proX,
      p_price_ars: 1200,
    });
    await (serverClient.rpc as any)('set_product_price', {
      p_price_list_id: publicListId,
      p_product_id: proY,
      p_price_ars: 2400,
    });

    // Disparar en paralelo dos aumentos en listas distintas pero con el orden de IDs invertido
    // Transacción 1: Lista Salón con [proX, proY], +10%
    // Transacción 2: Lista Público con [proY, proX], +20%
    const [resList1, resList2] = await Promise.all([
      (serverClient.rpc as any)('apply_bulk_price_increase', {
        p_price_list_id: salonListId,
        p_percentage: 10,
        p_product_ids: [proX, proY],
      }),
      (serverClient.rpc as any)('apply_bulk_price_increase', {
        p_price_list_id: publicListId,
        p_percentage: 20,
        p_product_ids: [proY, proX],
      }),
    ]);

    assert.strictEqual(resList1.error, null, 'Aumento masivo en Lista Salón no debe fallar por deadlock');
    assert.strictEqual(resList2.error, null, 'Aumento masivo en Lista Público no debe fallar por deadlock');

    // 1. Verificar Lista Salón (10% de aumento: 1000 -> 1100, 2000 -> 2200)
    const { data: pXSal } = await serverClient
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('price_list_id', salonListId)
      .eq('product_id', proX)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(pXSal!.price_ars), 1100);

    const { data: pYSal } = await serverClient
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('price_list_id', salonListId)
      .eq('product_id', proY)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(pYSal!.price_ars), 2200);

    // 2. Verificar Lista Público (20% de aumento: 1200 -> 1440, 2400 -> 2880)
    const { data: pXPub } = await serverClient
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('price_list_id', publicListId)
      .eq('product_id', proX)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(pXPub!.price_ars), 1440);

    const { data: pYPub } = await serverClient
      .from('product_price_versions')
      .select('price_ars, valid_from, valid_to')
      .eq('price_list_id', publicListId)
      .eq('product_id', proY)
      .is('valid_to', null)
      .single();
    assert.strictEqual(Number(pYPub!.price_ars), 2880);

    // 3. Comprobar que en ambas listas cada producto tiene exactamente 1 versión vigente
    for (const lid of [salonListId, publicListId]) {
      for (const pid of [proX, proY]) {
        const { data: currs } = await serverClient
          .from('product_price_versions')
          .select('id, valid_from, valid_to')
          .eq('price_list_id', lid)
          .eq('product_id', pid)
          .is('valid_to', null);
        assert.strictEqual(currs?.length, 1, `Debe existir exactamente 1 versión vigente para lista ${lid} y PRO ${pid}`);

        const { data: allV } = await serverClient
          .from('product_price_versions')
          .select('id, valid_from, valid_to')
          .eq('price_list_id', lid)
          .eq('product_id', pid)
          .order('valid_from', { ascending: true });

        assert.strictEqual(allV?.length, 2);
        const vOld: { id: string; valid_from: string; valid_to: string | null } = allV![0];
        const vNew: { id: string; valid_from: string; valid_to: string | null } = allV![1];
        assert.ok(vOld.valid_to !== null);
        assert.ok(new Date(vOld.valid_to!).getTime() >= new Date(vOld.valid_from).getTime());
        assert.strictEqual(new Date(vOld.valid_to!).toISOString(), new Date(vNew.valid_from).toISOString());
      }
    }
  });

  await t.test('11. Seguridad: permisos anon y authenticated denegados, service_role permitido', async () => {
    const probeName = `Lista Sec ${Date.now()}`;

    // A. anon create_price_list -> denegado
    const { error: aErr1 } = await (anonClient.rpc as any)('create_price_list', { p_name: probeName });
    assert.ok(aErr1);
    assert.match(aErr1.message, /permission denied/i);

    // B. authenticated create_price_list -> denegado
    if (authClient) {
      const { error: authErr1 } = await (authClient.rpc as any)('create_price_list', { p_name: probeName });
      assert.ok(authErr1);
      assert.match(authErr1.message, /permission denied/i);
    }

    // C. anon update_price_list -> denegado
    const { error: aErr2 } = await (anonClient.rpc as any)('update_price_list', {
      p_price_list_id: salonListId,
      p_name: 'Hack',
    });
    assert.ok(aErr2);
    assert.match(aErr2.message, /permission denied/i);

    // D. anon set_product_price -> denegado
    const { error: aErr3 } = await (anonClient.rpc as any)('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: '00000000-0000-0000-0000-000000000000',
      p_price_ars: 100,
    });
    assert.ok(aErr3);
    assert.match(aErr3.message, /permission denied/i);

    // E. anon apply_bulk_price_increase -> denegado
    const { error: aErr4 } = await (anonClient.rpc as any)('apply_bulk_price_increase', {
      p_price_list_id: salonListId,
      p_percentage: 10,
    });
    assert.ok(aErr4);
    assert.match(aErr4.message, /permission denied/i);
  });
});
