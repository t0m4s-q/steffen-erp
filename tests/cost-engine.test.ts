import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { CostEngineService } from '../src/services/cost-engine.service';
import { SupplierItemRepository } from '../src/repositories/supplier-item.repository';
import { FormulaRepository } from '../src/repositories/formula.repository';
import { ProductRepository } from '../src/repositories/product.repository';
import { InvalidExchangeRateError } from '../src/domain/errors';
import { Decimal } from '../src/domain/decimal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Motor de costo actual — Pruebas de dominio e integración con Decimal exacto', async (t) => {
  const supplierRepo = new SupplierItemRepository(supabase);
  const formulaRepo = new FormulaRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const costService = new CostEngineService(supplierRepo, formulaRepo, productRepo);

  const testTag = `CST_${Date.now()}`;
  let supplierArsId: string;
  let supplierUsdId: string;
  let supplierArs2Id: string;
  let mpr1Id: string;
  let mpr2Id: string;
  let mprTieId: string;
  let com1Id: string;
  let baseProductId: string;
  let formulaVersionId: string;
  let productId: string;
  let usdRateId: string | null = null;

  t.before(async () => {
    // 1. Crear proveedores de prueba
    const { data: sArs } = await supabase
      .from('suppliers')
      .insert({
        code: `PRV_${testTag}_1`,
        name: `Proveedor ARS ${testTag}`,
        currency_code: 'ARS',
      })
      .select('id')
      .single();
    supplierArsId = sArs!.id;

    const { data: sArs2 } = await supabase
      .from('suppliers')
      .insert({
        code: `PRV_${testTag}_2`,
        name: `Proveedor ARS 2 ${testTag}`,
        currency_code: 'ARS',
      })
      .select('id')
      .single();
    supplierArs2Id = sArs2!.id;

    const { data: sUsd } = await supabase
      .from('suppliers')
      .insert({
        code: `PRV_${testTag}_3`,
        name: `Proveedor USD ${testTag}`,
        currency_code: 'USD',
      })
      .select('id')
      .single();
    supplierUsdId = sUsd!.id;

    // 2. Crear materias primas y componentes
    const { data: item1 } = await supabase
      .from('stock_items')
      .insert({
        code: `MPR_${testTag}_1`,
        item_type: 'MPR',
        name: `Materia Prima 1 ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    mpr1Id = item1!.id;
    await supabase.from('raw_materials').insert({ stock_item_id: mpr1Id });

    const { data: item2 } = await supabase
      .from('stock_items')
      .insert({
        code: `MPR_${testTag}_2`,
        item_type: 'MPR',
        name: `Materia Prima 2 ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 5,
      })
      .select('id')
      .single();
    mpr2Id = item2!.id;
    await supabase.from('raw_materials').insert({ stock_item_id: mpr2Id });

    const { data: itemTie } = await supabase
      .from('stock_items')
      .insert({
        code: `MPR_${testTag}_TIE`,
        item_type: 'MPR',
        name: `Materia Prima Desempate ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 5,
      })
      .select('id')
      .single();
    mprTieId = itemTie!.id;
    await supabase.from('raw_materials').insert({ stock_item_id: mprTieId });

    const { data: itemCom } = await supabase
      .from('stock_items')
      .insert({
        code: `COM_${testTag}_1`,
        item_type: 'COM',
        name: `Envase 250ml ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 100,
      })
      .select('id')
      .single();
    com1Id = itemCom!.id;
    await supabase.from('components').insert({ stock_item_id: com1Id });

    // 3. Crear Producto Base y versión de fórmula
    const { data: pba } = await supabase
      .from('base_products')
      .insert({
        code: `PBA_${testTag}_1`,
        name: `Shampoo Base ${testTag}`,
      })
      .select('id')
      .single();
    baseProductId = pba!.id;

    const { data: fv } = await supabase
      .from('formula_versions')
      .insert({
        base_product_id: baseProductId,
        version_number: 1,
        is_current: true,
      })
      .select('id')
      .single();
    formulaVersionId = fv!.id;

    // Fórmula: 2 kg de MPR 1 + 1 kg de MPR 2 = 3 kg total
    await supabase.from('formula_version_items').insert([
      { formula_version_id: formulaVersionId, raw_material_id: mpr1Id, quantity_kg: 2.0, sort_order: 1 },
      { formula_version_id: formulaVersionId, raw_material_id: mpr2Id, quantity_kg: 1.0, sort_order: 2 },
    ]);

    // 4. Crear Producto Terminado (PRO)
    const { data: itemPro } = await supabase
      .from('stock_items')
      .insert({
        code: `PRO_${testTag}_1`,
        item_type: 'PRO',
        name: `Shampoo 350ml ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 50,
      })
      .select('id')
      .single();
    productId = itemPro!.id;

    await supabase.from('products').insert({
      stock_item_id: productId,
      base_product_id: baseProductId,
      presentation: '350 ml',
      weight_kg: 0.350,
      extra_variable_pct: 2.0,
    });

    // Requiere 1 unidad de Envase (COM 1)
    await supabase.from('product_components').insert({
      product_id: productId,
      component_id: com1Id,
      quantity_per_unit: 1,
      sort_order: 1,
    });
  });

  t.after(async () => {
    // Limpieza completa en cascada de los datos de prueba
    if (usdRateId) {
      await supabase.from('exchange_rates').delete().eq('id', usdRateId);
    }
    await supabase.from('product_components').delete().eq('product_id', productId);
    await supabase.from('products').delete().eq('stock_item_id', productId);
    await supabase.from('formula_version_items').delete().eq('formula_version_id', formulaVersionId);
    await supabase.from('formula_versions').delete().eq('id', formulaVersionId);
    await supabase.from('base_products').delete().eq('id', baseProductId);
    await supabase.from('supplier_items').delete().in('stock_item_id', [mpr1Id, mpr2Id, mprTieId, com1Id]);
    await supabase.from('raw_materials').delete().in('stock_item_id', [mpr1Id, mpr2Id, mprTieId]);
    await supabase.from('components').delete().eq('stock_item_id', com1Id);
    await supabase.from('stock_items').delete().in('id', [mpr1Id, mpr2Id, mprTieId, com1Id, productId]);
    await supabase.from('suppliers').delete().in('id', [supplierArsId, supplierArs2Id, supplierUsdId]);
  });

  await t.test('1. Costo MPR en ARS con IVA 21%', async () => {
    // Precio neto 100 ARS -> 100 * 1.21 = 121 exacto
    await supabase.from('supplier_items').insert({
      supplier_id: supplierArsId,
      stock_item_id: mpr1Id,
      quoted_unit_price_net: 100.0,
      price_updated_at: '2026-01-01T10:00:00Z',
    });

    const cost = await costService.getCurrentStockItemCost(mpr1Id);
    assert.ok(cost instanceof Decimal);
    assert.strictEqual(cost.toString(), '121');
  });

  await t.test('2. Selección por último price_updated_at (ignora compras viejas)', async () => {
    // Proveedor 2 actualiza precio más reciente con neto 200 ARS -> 200 * 1.21 = 242 exacto
    await supabase.from('supplier_items').insert({
      supplier_id: supplierArs2Id,
      stock_item_id: mpr1Id,
      quoted_unit_price_net: 200.0,
      price_updated_at: '2026-02-01T10:00:00Z',
    });

    const cost = await costService.getCurrentStockItemCost(mpr1Id);
    assert.strictEqual(cost.toString(), '242');
  });

  await t.test('3. Desempate determinístico ante igual price_updated_at (created_at DESC, id DESC)', async () => {
    // Creamos dos relaciones de proveedores con la misma fecha de price_updated_at
    const sameTimestamp = '2026-03-01T12:00:00Z';

    // Proveedor 1 con precio 100 (creado primero)
    await supabase.from('supplier_items').insert({
      supplier_id: supplierArsId,
      stock_item_id: mprTieId,
      quoted_unit_price_net: 100.0,
      price_updated_at: sameTimestamp,
      created_at: '2026-03-01T12:00:00Z',
    });

    // Proveedor 2 con precio 150 (creado 1 segundo después)
    await supabase.from('supplier_items').insert({
      supplier_id: supplierArs2Id,
      stock_item_id: mprTieId,
      quoted_unit_price_net: 150.0,
      price_updated_at: sameTimestamp,
      created_at: '2026-03-01T12:00:01Z',
    });

    const cost = await costService.getCurrentStockItemCost(mprTieId);
    // Debe seleccionar Proveedor 2: 150 * 1.21 = 181.5 exacto
    assert.strictEqual(cost.toString(), '181.5');
  });

  await t.test('4. Falta de cotización USD produce InvalidExchangeRateError', async () => {
    // MPR 2 cotizada en USD pero sin cotización vigente en exchange_rates
    await supabase.from('supplier_items').insert({
      supplier_id: supplierUsdId,
      stock_item_id: mpr2Id,
      quoted_unit_price_net: 10.0,
      price_updated_at: '2026-02-01T10:00:00Z',
    });

    await assert.rejects(
      async () => await costService.getCurrentStockItemCost(mpr2Id),
      (err) => err instanceof InvalidExchangeRateError
    );
  });

  await t.test('5. Costo MPR en USD con cotización global vigente', async () => {
    // Insertar cotización vigente USD = 1200 ARS
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .insert({
        currency_code: 'USD',
        rate_to_ars: 1200.0,
        is_current: true,
        effective_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    usdRateId = rateData!.id;

    // Precio 10 USD * 1200 ARS/USD * 1.21 = 14520 ARS exacto
    const cost = await costService.getCurrentStockItemCost(mpr2Id);
    assert.strictEqual(cost.toString(), '14520');
  });

  await t.test('6. Costo teórico PBA a partir de fórmula vigente con Decimal exacto', async () => {
    // Fórmula: 2 kg de MPR 1 ($242/kg) + 1 kg de MPR 2 ($14520/kg) = 3 kg total
    // Costo total granel = (2 * 242) + (1 * 14520) = 484 + 14520 = 15004 ARS
    // Costo por kg = 15004 / 3
    const formulaCost = await costService.getCurrentFormulaCost(baseProductId);

    assert.strictEqual(formulaCost.totalKg.toString(), '3');
    assert.strictEqual(formulaCost.totalBulkCost.toString(), '15004');
    assert.strictEqual(formulaCost.costPerKg.times(3).toString(), '15004');
  });

  await t.test('7. Costo teórico PRO + BOM + 2% extra variable', async () => {
    // COM 1: Envase a 50 ARS neto -> 50 * 1.21 = 60.5 ARS
    await supabase.from('supplier_items').insert({
      supplier_id: supplierArsId,
      stock_item_id: com1Id,
      quoted_unit_price_net: 50.0,
      price_updated_at: '2026-02-01T10:00:00Z',
    });

    // PRO: weight_kg = 0.350
    // baseCost = 0.350 * (15004 / 3) = 1750.466666666666666666666667
    // componentsCost = 1 * 60.5 = 60.5
    // subtotal = baseCost + 60.5
    // extraVariable = subtotal * 0.02
    // totalCost = subtotal * 1.02
    const productCost = await costService.getCurrentProductCost(productId);

    const expectedBaseCost = new Decimal('0.350').times(new Decimal('15004').dividedBy('3'));
    const expectedComponentsCost = new Decimal('60.5');
    const expectedSubtotal = expectedBaseCost.plus(expectedComponentsCost);
    const expectedExtraVariable = expectedSubtotal.times('0.02');
    const expectedTotalCost = expectedSubtotal.times('1.02');

    assert.ok(productCost.baseCost.equals(expectedBaseCost));
    assert.ok(productCost.componentsCost.equals(expectedComponentsCost));
    assert.ok(productCost.extraVariable.equals(expectedExtraVariable));
    assert.ok(productCost.totalCost.equals(expectedTotalCost));
  });
});
