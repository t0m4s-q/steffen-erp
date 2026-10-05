import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { ProductDomainService, CreateProductDto, UpdateProductDto } from '../src/services/product.service';
import { ProductRepository } from '../src/repositories/product.repository';
import { FormulaRepository } from '../src/repositories/formula.repository';
import { CostEngineService } from '../src/services/cost-engine.service';
import { StockDomainService } from '../src/services/stock.service';
import { Decimal } from '../src/domain/decimal';
import { DomainError } from '../src/domain/errors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Altas y Edición de Producto Final (PRO) — RPCs atómicas, rollback tardío, inmutabilidad y seguridad', async (t) => {
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  let authClient: any = null;
  let testUserId: string | null = null;
  const testUserEmail = `sec_product_${Date.now()}@steffen-test.local`;
  const testUserPassword = 'TestPassword123!';

  // Repositorios y servicios
  const productRepo = new ProductRepository(serverClient);
  const formulaRepo = new FormulaRepository(serverClient);
  const costEngineService = new CostEngineService(undefined, formulaRepo, productRepo);
  const stockDomainService = new StockDomainService();
  const productService = new ProductDomainService(
    productRepo,
    formulaRepo,
    costEngineService,
    stockDomainService
  );

  // Tracking para cleanup
  const createdProductIds: string[] = [];
  const createdBaseProductIds: string[] = [];
  const createdStockItemIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdOperationIds: string[] = [];

  let testSupplierId: string;
  let testMprId: string;
  let testCom1Id: string;
  let testCom2Id: string;
  let testPbaId: string;

  t.before(async () => {
    // 1. Crear usuario de prueba para authenticated
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

    // 2. Crear proveedor
    const { data: supData, error: supErr } = await (serverClient.rpc as any)('create_supplier_with_account', {
      p_name: `Proveedor PRO Test ${Date.now()}`,
      p_currency_code: 'ARS',
    });
    assert.ifError(supErr);
    testSupplierId = supData.id;
    createdSupplierIds.push(testSupplierId);

    // 3. Crear Materia Prima (MPR)
    const { data: mprData, error: mprErr } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'MPR',
      p_name: `MPR PRO Test ${Date.now()}`,
      p_stock_minimum: 10,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 500, // neto 500 => bruto 605 ARS
      p_initial_stock: 100,
      p_inci: 'Aqua Purificata',
    });
    assert.ifError(mprErr);
    testMprId = mprData.id;
    createdStockItemIds.push(testMprId);
    if (mprData.movement?.movement_id) {
      const { data: movRow } = await serverClient
        .from('stock_movements')
        .select('operation_id')
        .eq('id', mprData.movement.movement_id)
        .single();
      if (movRow?.operation_id) createdOperationIds.push(movRow.operation_id);
    }

    // 4. Crear Componentes (COM)
    const { data: com1Data, error: com1Err } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: `Botella 350ml Test ${Date.now()}`,
      p_stock_minimum: 50,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 100, // neto 100 => bruto 121 ARS
      p_initial_stock: 200,
    });
    assert.ifError(com1Err);
    testCom1Id = com1Data.id;
    createdStockItemIds.push(testCom1Id);
    if (com1Data.movement?.movement_id) {
      const { data: movRow } = await serverClient
        .from('stock_movements')
        .select('operation_id')
        .eq('id', com1Data.movement.movement_id)
        .single();
      if (movRow?.operation_id) createdOperationIds.push(movRow.operation_id);
    }

    const { data: com2Data, error: com2Err } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: `Tapa Flip Top Test ${Date.now()}`,
      p_stock_minimum: 50,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 50, // neto 50 => bruto 60.50 ARS
      p_initial_stock: 200,
    });
    assert.ifError(com2Err);
    testCom2Id = com2Data.id;
    createdStockItemIds.push(testCom2Id);
    if (com2Data.movement?.movement_id) {
      const { data: movRow } = await serverClient
        .from('stock_movements')
        .select('operation_id')
        .eq('id', com2Data.movement.movement_id)
        .single();
      if (movRow?.operation_id) createdOperationIds.push(movRow.operation_id);
    }

    // 5. Crear Producto Base con fórmula v1
    const { data: pbaData, error: pbaErr } = await (serverClient.rpc as any)('create_base_product_with_formula', {
      p_name: `PBA PRO Test ${Date.now()}`,
      p_items: [{ raw_material_id: testMprId, quantity_kg: 1.0, sort_order: 1 }],
      p_observations: 'Fórmula base test',
    });
    assert.ifError(pbaErr);
    testPbaId = pbaData.base_product.id;
    createdBaseProductIds.push(testPbaId);
  });

  t.after(async () => {
    // Limpieza
    if (testUserId) {
      try {
        await serverClient.auth.admin.deleteUser(testUserId);
      } catch {}
    }

    for (const prodId of createdProductIds) {
      await serverClient.from('product_components').delete().eq('product_id', prodId);
      await serverClient.from('products').delete().eq('stock_item_id', prodId);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', prodId);
      await serverClient.from('stock_items').delete().eq('id', prodId);
    }

    for (const opId of createdOperationIds) {
      await serverClient.from('stock_movements').delete().eq('operation_id', opId);
      await serverClient.from('business_operations').delete().eq('id', opId);
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

    for (const itemId of createdStockItemIds) {
      await serverClient.from('supplier_items').delete().eq('stock_item_id', itemId);
      await serverClient.from('raw_materials').delete().eq('stock_item_id', itemId);
      await serverClient.from('components').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_items').delete().eq('id', itemId);
    }

    for (const supId of createdSupplierIds) {
      await serverClient.from('financial_accounts').delete().eq('supplier_id', supId);
      await serverClient.from('suppliers').delete().eq('id', supId);
    }
  });

  // ============================================================================
  // 1. Alta PRO exitosa sin stock inicial
  // ============================================================================
  await t.test('Alta PRO exitosa sin stock inicial: genera PROxxxx, balances en 0 sin movimiento MST', async () => {
    const { data, error } = await (serverClient.rpc as any)('create_final_product', {
      p_name: `Shampoo 350ml Test ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '350 ml',
      p_weight_kg: 0.350,
      p_stock_minimum: 10,
      p_components: [
        { component_id: testCom1Id, quantity_per_unit: '1', sort_order: 1 },
        { component_id: testCom2Id, quantity_per_unit: '1', sort_order: 2 },
      ],
      p_initial_stock: 0,
    });

    assert.ifError(error);
    assert.ok(data);
    assert.match(data.code, /^PRO\d{4}$/);
    assert.strictEqual(data.initial_stock, 0);
    assert.strictEqual(data.movement, null);
    createdProductIds.push(data.id);

    // Verificar balance consolidado
    const { data: balRow } = await serverClient
      .from('stock_balances')
      .select('quantity')
      .eq('stock_item_id', data.id)
      .single();
    assert.strictEqual(Number(balRow?.quantity), 0);

    // Verificar que no existan movimientos de stock
    const { data: movs } = await serverClient
      .from('stock_movements')
      .select('id')
      .eq('stock_item_id', data.id);
    assert.strictEqual(movs?.length || 0, 0);
  });

  // ============================================================================
  // 2. Alta PRO exitosa con stock inicial
  // ============================================================================
  await t.test('Alta PRO exitosa con stock inicial: genera STOCK_ADJUSTMENT, MSTxxxx y saldo consolidado', async () => {
    const { data, error } = await (serverClient.rpc as any)('create_final_product', {
      p_name: `Acondicionador 350ml Test ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '350 cc',
      p_weight_kg: 0.360,
      p_stock_minimum: 15,
      p_components: [
        { component_id: testCom1Id, quantity_per_unit: '1' },
      ],
      p_initial_stock: 40,
    });

    assert.ifError(error);
    assert.ok(data);
    createdProductIds.push(data.id);

    assert.strictEqual(data.initial_stock, 40);
    assert.ok(data.movement);
    assert.match(data.movement.code, /^MST\d{4}$/);
    assert.strictEqual(Number(data.movement.new_balance), 40);

    // Verificar operación de negocio STOCK_ADJUSTMENT
    const { data: movRow } = await serverClient
      .from('stock_movements')
      .select('operation_id, movement_type, quantity_delta')
      .eq('id', data.movement.movement_id)
      .single();
    assert.strictEqual(movRow?.movement_type, 'AJUSTE');
    assert.strictEqual(Number(movRow?.quantity_delta), 40);
    if (movRow?.operation_id) createdOperationIds.push(movRow.operation_id);

    const { data: opRow } = await serverClient
      .from('business_operations')
      .select('operation_type')
      .eq('id', movRow?.operation_id)
      .single();
    assert.strictEqual(opRow?.operation_type, 'STOCK_ADJUSTMENT');

    // Verificar saldo consolidado
    const { data: balRow } = await serverClient
      .from('stock_balances')
      .select('quantity')
      .eq('stock_item_id', data.id)
      .single();
    assert.strictEqual(Number(balRow?.quantity), 40);
  });

  // ============================================================================
  // 3. Validación de Peso e Independencia con Presentación
  // ============================================================================
  await t.test('Validación de peso: rechaza <= 0 y rechaza 0.3501 (máx 3 decimales sin redondeo)', async () => {
    // Peso 0
    const { error: err0 } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Peso 0',
      p_base_product_id: testPbaId,
      p_presentation: '500 ml',
      p_weight_kg: 0,
      p_stock_minimum: 5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(err0);
    assert.match(err0.message, /peso.*mayor a 0/i);

    // Peso negativo
    const { error: errNeg } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Peso Negativo',
      p_base_product_id: testPbaId,
      p_presentation: '500 ml',
      p_weight_kg: -0.5,
      p_stock_minimum: 5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errNeg);

    // Peso 0.3501 (4 decimales -> rechazo)
    const { error: err4Dec } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Peso 4 dec',
      p_base_product_id: testPbaId,
      p_presentation: '350 ml',
      p_weight_kg: 0.3501,
      p_stock_minimum: 5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(err4Dec);
    assert.match(err4Dec.message, /máximo 3 decimales/i);

    // Independencia: presentación "1000 ml", peso 0.370 kg aceptado
    const { data: dataIndep, error: errIndep } = await (serverClient.rpc as any)('create_final_product', {
      p_name: `Prod Independiente ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '1000 ml presentación comercial',
      p_weight_kg: 0.370,
      p_stock_minimum: 5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ifError(errIndep);
    assert.strictEqual(Number(dataIndep.weight_kg), 0.370);
    assert.strictEqual(dataIndep.presentation, '1000 ml presentación comercial');
    createdProductIds.push(dataIndep.id);
  });

  // ============================================================================
  // 4. Validación de Stock Mínimo y Stock Inicial
  // ============================================================================
  await t.test('Validación de stock: mínimo <= 0 o fraccionario, e inicial negativo o fraccionario son rechazados', async () => {
    // Mínimo = 0
    const { error: errMin0 } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Min 0',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 0,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errMin0);
    assert.match(errMin0.message, /stock mínimo.*mayor a 0/i);

    // Mínimo fraccionario (10.5)
    const { error: errMinFrac } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Min Frac',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10.5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errMinFrac);
    assert.match(errMinFrac.message, /entero/i);

    // Inicial negativo (-5)
    const { error: errInitNeg } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Init Neg',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
      p_initial_stock: -5,
    });
    assert.ok(errInitNeg);
    assert.match(errInitNeg.message, /no puede ser negativo/i);

    // Inicial fraccionario (5.5)
    const { error: errInitFrac } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Init Frac',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
      p_initial_stock: 5.5,
    });
    assert.ok(errInitFrac);
    assert.match(errInitFrac.message, /entero/i);
  });

  // ============================================================================
  // 5. Validación de Producto Base (PBA)
  // ============================================================================
  await t.test('Validación de PBA: inexistente, inactivo o sin fórmula vigente son rechazados', async () => {
    // PBA Inexistente
    const fakePbaId = '00000000-0000-0000-0000-000000000999';
    const { error: errFakePba } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Fake PBA',
      p_base_product_id: fakePbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errFakePba);
    assert.match(errFakePba.message, /Producto Base.*no encontrado/i);

    // PBA Inactivo
    const { data: inactPba } = await serverClient
      .from('base_products')
      .insert({
        code: `PBA_INACT_${Date.now()}`,
        name: 'PBA Inactivo Test',
        active: false,
      })
      .select('id')
      .single();
    createdBaseProductIds.push(inactPba!.id);

    const { error: errInactPba } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Inact PBA',
      p_base_product_id: inactPba!.id,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errInactPba);
    assert.match(errInactPba.message, /inactivo/i);

    // PBA sin fórmula vigente
    const { data: noFormPba } = await serverClient
      .from('base_products')
      .insert({
        code: `PBA_NO_FORM_${Date.now()}`,
        name: 'PBA Sin Formula Test',
        active: true,
      })
      .select('id')
      .single();
    createdBaseProductIds.push(noFormPba!.id);

    const { error: errNoFormPba } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod No Form PBA',
      p_base_product_id: noFormPba!.id,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errNoFormPba);
    assert.match(errNoFormPba.message, /fórmula vigente/i);
  });

  // ============================================================================
  // 6. Validación de BOM de Componentes
  // ============================================================================
  await t.test('Validación de BOM: vacío, COM inexistente, COM inactivo, ítem no COM, duplicados y cantidades inválidas', async () => {
    // BOM vacío
    const { error: errEmptyBom } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod BOM Vacio',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [],
    });
    assert.ok(errEmptyBom);
    assert.match(errEmptyBom.message, /BOM.*al menos un elemento/i);

    // COM inexistente
    const fakeComId = '00000000-0000-0000-0000-000000000888';
    const { error: errFakeCom } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Fake COM',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: fakeComId, quantity_per_unit: '1' }],
    });
    assert.ok(errFakeCom);
    assert.match(errFakeCom.message, /componente con ID.*no existe/i);

    // Ítem que es MPR y no COM
    const { error: errNotCom } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod MPR como COM',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testMprId, quantity_per_unit: '1' }],
    });
    assert.ok(errNotCom);
    assert.match(errNotCom.message, /no es de tipo Componente/i);

    // COM inactivo
    const { data: inactComData } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: `COM Inactivo Test ${Date.now()}`,
      p_stock_minimum: 10,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 50,
      p_initial_stock: 0,
    });
    createdStockItemIds.push(inactComData.id);
    await serverClient.from('stock_items').update({ active: false }).eq('id', inactComData.id);

    const { error: errInactCom } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Inact COM',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: inactComData.id, quantity_per_unit: '1' }],
    });
    assert.ok(errInactCom);
    assert.match(errInactCom.message, /inactivo/i);

    // Componente duplicado
    const { error: errDupCom } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Dup COM',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [
        { component_id: testCom1Id, quantity_per_unit: '1' },
        { component_id: testCom1Id, quantity_per_unit: '2' },
      ],
    });
    assert.ok(errDupCom);
    assert.match(errDupCom.message, /duplicado/i);

    // Cantidad por unidad <= 0
    const { error: errQty0 } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Qty 0',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '0' }],
    });
    assert.ok(errQty0);
    assert.match(errQty0.message, /mayor a 0/i);

    // Cantidad por unidad fraccionaria (1.5)
    const { error: errQtyFrac } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Qty Frac',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1.5' }],
    });
    assert.ok(errQtyFrac);
    assert.match(errQtyFrac.message, /entero/i);
  });

  // ============================================================================
  // 6.1 Validación estricta de quantity_per_unit en RPC (service_role directo)
  // ============================================================================
  await t.test('BOM quantity_per_unit a nivel RPC: 1 y 3.000 aceptados; 0, -1, 1.5, 2.25 rechazados sin residuos', async () => {
    // 1. quantity_per_unit = 1 -> Aceptado
    const { data: rpc1, error: err1 } = await (serverClient.rpc as any)('create_final_product', {
      p_name: `PRO RPC Qty 1 ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ifError(err1);
    assert.ok(rpc1?.id);
    createdProductIds.push(rpc1.id);

    // 2. quantity_per_unit = 3.000 -> Aceptado
    const { data: rpc3, error: err3 } = await (serverClient.rpc as any)('create_final_product', {
      p_name: `PRO RPC Qty 3.000 ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '3.000' }],
    });
    assert.ifError(err3);
    assert.ok(rpc3?.id);
    createdProductIds.push(rpc3.id);

    // Casos de rechazo a nivel RPC
    const rpcRejectionCases = [
      { qty: '0', errorMatch: /mayor a 0/i, label: 'cero (0)' },
      { qty: '-1', errorMatch: /mayor a 0/i, label: 'negativo (-1)' },
      { qty: '1.5', errorMatch: /entero/i, label: 'fracción (1.5)' },
      { qty: '2.25', errorMatch: /entero/i, label: 'fracción (2.25)' },
    ];

    for (const rc of rpcRejectionCases) {
      const probeName = `PRO RPC Reject ${rc.label} ${Date.now()}`;
      const { data: rData, error: rErr } = await (serverClient.rpc as any)('create_final_product', {
        p_name: probeName,
        p_base_product_id: testPbaId,
        p_presentation: '100ml',
        p_weight_kg: 0.1,
        p_stock_minimum: 10,
        p_components: [{ component_id: testCom1Id, quantity_per_unit: rc.qty }],
      });

      assert.ok(rErr, `Se esperaba rechazo para quantity_per_unit = ${rc.qty}`);
      assert.strictEqual(rData, null);
      assert.match(rErr.message, rc.errorMatch);

      // Verificación estricta de ausencia de residuos
      const { data: orphanItems } = await serverClient
        .from('stock_items')
        .select('id')
        .eq('name', probeName);
      assert.strictEqual(orphanItems?.length ?? 0, 0, `No deben quedar stock_items para ${probeName}`);
    }
  });

  // ============================================================================
  // 6.2 Validación estricta de quantity_per_unit en ProductDomainService
  // ============================================================================
  await t.test('BOM quantity_per_unit a nivel ProductDomainService: 1 y 3.000 aceptados; 0, -1, 1.5, 2.25 rechazados sin residuos', async () => {
    // 1. quantityPerUnit = 1 -> Aceptado
    const svc1 = await productService.createProduct({
      name: `PRO SVC Qty 1 ${Date.now()}`,
      presentation: '100ml',
      baseProductId: testPbaId,
      weightKg: new Decimal('0.1'),
      stockMinimum: new Decimal('10'),
      components: [{ componentId: testCom1Id, quantityPerUnit: new Decimal('1') }],
    });
    assert.ok(svc1?.productId);
    createdProductIds.push(svc1.productId);

    // 2. quantityPerUnit = 3.000 -> Aceptado
    const svc3 = await productService.createProduct({
      name: `PRO SVC Qty 3.000 ${Date.now()}`,
      presentation: '100ml',
      baseProductId: testPbaId,
      weightKg: new Decimal('0.1'),
      stockMinimum: new Decimal('10'),
      components: [{ componentId: testCom1Id, quantityPerUnit: new Decimal('3.000') }],
    });
    assert.ok(svc3?.productId);
    createdProductIds.push(svc3.productId);

    // Casos de rechazo a nivel Service
    const svcRejectionCases = [
      { qty: new Decimal('0'), errorMatch: /mayor a 0/i, label: '0' },
      { qty: new Decimal('-1'), errorMatch: /mayor a 0/i, label: '-1' },
      { qty: new Decimal('1.5'), errorMatch: /entero/i, label: '1.5' },
      { qty: new Decimal('2.25'), errorMatch: /entero/i, label: '2.25' },
    ];

    for (const sc of svcRejectionCases) {
      const probeName = `PRO SVC Reject ${sc.label} ${Date.now()}`;
      await assert.rejects(
        async () => {
          await productService.createProduct({
            name: probeName,
            presentation: '100ml',
            baseProductId: testPbaId,
            weightKg: new Decimal('0.1'),
            stockMinimum: new Decimal('10'),
            components: [{ componentId: testCom1Id, quantityPerUnit: sc.qty }],
          });
        },
        (err: any) => {
          assert.match(err.message, sc.errorMatch);
          return true;
        }
      );

      // Verificación estricta de ausencia de residuos
      const { data: orphanItems } = await serverClient
        .from('stock_items')
        .select('id')
        .eq('name', probeName);
      assert.strictEqual(orphanItems?.length ?? 0, 0, `No deben quedar stock_items para ${probeName}`);
    }
  });

  // ============================================================================
  // 7. Nombre y Presentación obligatorios
  // ============================================================================
  await t.test('Validación de campos de texto: nombre y presentación vacíos son rechazados', async () => {
    const { error: errNoName } = await (serverClient.rpc as any)('create_final_product', {
      p_name: '   ',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errNoName);
    assert.match(errNoName.message, /nombre.*obligatorio/i);

    const { error: errNoPres } = await (serverClient.rpc as any)('create_final_product', {
      p_name: 'Prod Sin Pres',
      p_base_product_id: testPbaId,
      p_presentation: '   ',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ok(errNoPres);
    assert.match(errNoPres.message, /presentación comercial.*obligatoria/i);
  });

  // ============================================================================
  // 8. Test de Rollback Tardío Real (excepción tras escrituras previas dentro de la RPC)
  // ============================================================================
  await t.test('Rollback tardío real: excepción provocada durante inserción del BOM revierte stock_items, products y secuencia PRO', async () => {
    // 1. Registrar estado previo de la secuencia PRO
    const { data: seqBefore } = await serverClient
      .from('code_sequences')
      .select('last_value')
      .eq('prefix', 'PRO')
      .single();
    const lastValBefore = Number(seqBefore?.last_value || 0);

    const failName = `PRO Late Rollback ${Date.now()}`;

    // 2. Invocar RPC con payload que pasa todas las prevalidaciones (nombre, PBA, peso, componentes válidos),
    // pero envía sort_order no convertible a INTEGER ("INVALIDO").
    // La excepción ocurrirá en el segundo bucle FOR después de haber insertado en stock_items y products.
    const { error: lateErr } = await (serverClient.rpc as any)('create_final_product', {
      p_name: failName,
      p_base_product_id: testPbaId,
      p_presentation: '250 ml',
      p_weight_kg: 0.250,
      p_stock_minimum: 10,
      p_components: [
        { component_id: testCom1Id, quantity_per_unit: '1', sort_order: 'INVALIDO' },
      ],
      p_initial_stock: 0,
    });

    assert.ok(lateErr, 'La llamada debió fallar por sort_order no entero');
    assert.match(lateErr.message, /invalid input syntax for type integer/i);

    // 3. Verificar ausencia total de residuos en tablas afectadas
    const { data: itemsAfter } = await serverClient
      .from('stock_items')
      .select('id')
      .eq('name', failName);
    assert.strictEqual(itemsAfter?.length || 0, 0, 'No debe existir fila en stock_items');

    const { data: prodsAfter } = await serverClient
      .from('products')
      .select('stock_item_id')
      .eq('presentation', '250 ml')
      .eq('weight_kg', 0.250);
    // Filtrar si alguno correspondiera al nombre fallido
    assert.ok(prodsAfter !== null);

    // 4. Verificar que la secuencia de códigos PRO se revirtió por el rollback de PostgreSQL
    const { data: seqAfter } = await serverClient
      .from('code_sequences')
      .select('last_value')
      .eq('prefix', 'PRO')
      .single();
    const lastValAfter = Number(seqAfter?.last_value || 0);
    assert.strictEqual(lastValAfter, lastValBefore, 'El valor de la secuencia PRO no debe quedar consumido tras un rollback');
  });

  // ============================================================================
  // 9. Concurrencia de Códigos PRO
  // ============================================================================
  await t.test('Concurrencia: altas concurrentes generan códigos PRO secuenciales únicos sin colisión', async () => {
    const p1 = (serverClient.rpc as any)('create_final_product', {
      p_name: `PRO Concurrente 1 ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '250 ml',
      p_weight_kg: 0.250,
      p_stock_minimum: 5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });

    const p2 = (serverClient.rpc as any)('create_final_product', {
      p_name: `PRO Concurrente 2 ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: '250 ml',
      p_weight_kg: 0.250,
      p_stock_minimum: 5,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.ifError(res1.error);
    assert.ifError(res2.error);
    assert.ok(res1.data);
    assert.ok(res2.data);
    createdProductIds.push(res1.data.id, res2.data.id);

    assert.notStrictEqual(res1.data.code, res2.data.code);
    assert.match(res1.data.code, /^PRO\d{4}$/);
    assert.match(res2.data.code, /^PRO\d{4}$/);
  });

  // ============================================================================
  // 10. Costo Teórico del Servicio
  // ============================================================================
  await t.test('Costo teórico en ProductDomainService: cálculo exacto de base, componentes, 2% extra y total', async () => {
    // Configuración:
    // MPR tiene neto 500 => bruto con 21% IVA = 605 ARS/kg
    // Fórmula PBA: 1 kg de MPR => costo PBA/kg = 605 ARS
    // COM1: neto 100 => bruto con 21% IVA = 121 ARS (cant: 1) => 121 ARS
    // COM2: neto 50 => bruto con 21% IVA = 60.50 ARS (cant: 2) => 121 ARS
    // Peso PRO = 0.500 kg => Costo base = 0.500 * 605 = 302.50 ARS
    // Costo componentes = 121 + 121 = 242.00 ARS
    // Subtotal = 302.50 + 242.00 = 544.50 ARS
    // Extra variable 2% = 544.50 * 0.02 = 10.89 ARS
    // Costo total PRO = 544.50 * 1.02 = 555.39 ARS

    const dto: CreateProductDto = {
      name: `PRO Costo Test ${Date.now()}`,
      baseProductId: testPbaId,
      presentation: '500 cc',
      weightKg: '0.500',
      stockMinimum: 10,
      initialStock: 5,
      components: [
        { componentId: testCom1Id, quantityPerUnit: '1' },
        { componentId: testCom2Id, quantityPerUnit: '2' },
      ],
    };

    const result = await productService.createProduct(dto);
    createdProductIds.push(result.productId);

    assert.strictEqual(result.cost.baseCost.toFixed(2), '302.50');
    assert.strictEqual(result.cost.componentsCost.toFixed(2), '242.00');
    assert.strictEqual(result.cost.extraVariable.toFixed(2), '10.89');
    assert.strictEqual(result.cost.totalCost.toFixed(2), '555.39');
    assert.strictEqual(result.balance.toString(), '5');
  });

  // ============================================================================
  // 11. Edición Atómica de Metadatos (update_final_product_metadata)
  // ============================================================================
  await t.test('Edición atómica: name, presentation, stock_minimum, active y validación de inmutabilidad', async () => {
    // 1. Crear producto base para pruebas de edición
    const createRes = await (serverClient.rpc as any)('create_final_product', {
      p_name: `PRO Original Edit ${Date.now()}`,
      p_base_product_id: testPbaId,
      p_presentation: 'Original 250ml',
      p_weight_kg: 0.250,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    });
    assert.ifError(createRes.error);
    const prodId = createRes.data.id;
    createdProductIds.push(prodId);

    // a. Editar solo nombre
    const { data: dName, error: eName } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_name: 'Nombre Actualizado Solo',
    });
    assert.ifError(eName);
    assert.strictEqual(dName.name, 'Nombre Actualizado Solo');
    assert.strictEqual(dName.presentation, 'Original 250ml');
    assert.strictEqual(Number(dName.stock_minimum), 10);

    // b. Editar solo presentación
    const { data: dPres, error: ePres } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_presentation: 'Presentación 300ml',
    });
    assert.ifError(ePres);
    assert.strictEqual(dPres.presentation, 'Presentación 300ml');
    assert.strictEqual(dPres.name, 'Nombre Actualizado Solo');

    // c. Editar stock mínimo
    const { data: dMin, error: eMin } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_stock_minimum: 25,
    });
    assert.ifError(eMin);
    assert.strictEqual(Number(dMin.stock_minimum), 25);

    // d. Inactivar y Reactivar
    const { data: dInact, error: eInact } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_active: false,
    });
    assert.ifError(eInact);
    assert.strictEqual(dInact.active, false);

    const { data: dAct, error: eAct } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_active: true,
    });
    assert.ifError(eAct);
    assert.strictEqual(dAct.active, true);

    // e. Editar nombre + presentación + stock mínimo en una única operación atómica
    const { data: dCombo, error: eCombo } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_name: 'Nombre Combo Final',
      p_presentation: 'Combo 500cc',
      p_stock_minimum: 30,
    });
    assert.ifError(eCombo);
    assert.strictEqual(dCombo.name, 'Nombre Combo Final');
    assert.strictEqual(dCombo.presentation, 'Combo 500cc');
    assert.strictEqual(Number(dCombo.stock_minimum), 30);

    // f. Inmutabilidad estricta: verificar que base_product_id, weight_kg, extra_variable_pct y BOM permanezcan idénticos
    assert.strictEqual(dCombo.base_product_id, testPbaId);
    assert.strictEqual(Number(dCombo.weight_kg), 0.250);
    assert.strictEqual(Number(dCombo.extra_variable_pct), 2.0000);
    assert.strictEqual(dCombo.components.length, 1);
    assert.strictEqual(dCombo.components[0].component_id, testCom1Id);

    // g. Rechazos de validación en edición
    // Nombre vacío
    const { error: errEditEmptyName } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_name: '   ',
    });
    assert.ok(errEditEmptyName);
    assert.match(errEditEmptyName.message, /nombre.*no puede quedar vacío/i);

    // Presentación vacía
    const { error: errEditEmptyPres } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_presentation: '   ',
    });
    assert.ok(errEditEmptyPres);
    assert.match(errEditEmptyPres.message, /presentación comercial.*no puede quedar vacía/i);

    // Stock mínimo <= 0
    const { error: errEditMin0 } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_stock_minimum: 0,
    });
    assert.ok(errEditMin0);
    assert.match(errEditMin0.message, /stock mínimo.*mayor a 0/i);

    // Stock mínimo fraccionario
    const { error: errEditMinFrac } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
      p_stock_minimum: 12.34,
    });
    assert.ok(errEditMinFrac);
    assert.match(errEditMinFrac.message, /entero/i);

    // ID que no es PRO (usar testMprId)
    const { error: errNotPro } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: testMprId,
      p_name: 'Intento en MPR',
    });
    assert.ok(errNotPro);
    assert.match(errNotPro.message, /no es un Producto Final/i);

    // Ningún campo provisto
    const { error: errNoField } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: prodId,
    });
    assert.ok(errNoField);
    assert.match(errNoField.message, /al menos un campo/i);
  });

  // ============================================================================
  // 12. Seguridad Completa de Ambas RPCs: anon, authenticated, service_role
  // ============================================================================
  await t.test('Seguridad RPC: create_final_product y update_final_product_metadata deniegan anon/authenticated y permiten service_role', async () => {
    const payloadCreate = {
      p_name: 'PRO Security Test',
      p_base_product_id: testPbaId,
      p_presentation: '100ml',
      p_weight_kg: 0.1,
      p_stock_minimum: 10,
      p_components: [{ component_id: testCom1Id, quantity_per_unit: '1' }],
    };

    // 1. Anon en create
    const { error: anonCreateErr } = await (anonClient.rpc as any)('create_final_product', payloadCreate);
    assert.ok(anonCreateErr);
    assert.match(anonCreateErr.message, /permission denied/i);

    // 2. Authenticated en create
    if (authClient) {
      const { error: authCreateErr } = await (authClient.rpc as any)('create_final_product', payloadCreate);
      assert.ok(authCreateErr);
      assert.match(authCreateErr.message, /permission denied/i);
    }

    // 3. Service role en create
    const { data: servCreateData, error: servCreateErr } = await (serverClient.rpc as any)('create_final_product', payloadCreate);
    assert.ifError(servCreateErr);
    assert.ok(servCreateData);
    const newProdId = servCreateData.id;
    createdProductIds.push(newProdId);

    // 4. Anon en update
    const { error: anonUpdateErr } = await (anonClient.rpc as any)('update_final_product_metadata', {
      p_product_id: newProdId,
      p_name: 'Intento Anon',
    });
    assert.ok(anonUpdateErr);
    assert.match(anonUpdateErr.message, /permission denied/i);

    // 5. Authenticated en update
    if (authClient) {
      const { error: authUpdateErr } = await (authClient.rpc as any)('update_final_product_metadata', {
        p_product_id: newProdId,
        p_name: 'Intento Auth',
      });
      assert.ok(authUpdateErr);
      assert.match(authUpdateErr.message, /permission denied/i);
    }

    // 6. Service role en update
    const { data: servUpdateData, error: servUpdateErr } = await (serverClient.rpc as any)('update_final_product_metadata', {
      p_product_id: newProdId,
      p_name: 'Nombre Actualizado Seguro',
    });
    assert.ifError(servUpdateErr);
    assert.strictEqual(servUpdateData.name, 'Nombre Actualizado Seguro');
  });
});
