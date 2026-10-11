import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { FactoryDomainService } from '../src/services/factory.service';
import { FactoryRepository } from '../src/repositories/factory.repository';
import { FormulaRepository } from '../src/repositories/formula.repository';
import { SupplierItemRepository } from '../src/repositories/supplier-item.repository';
import { StockRepository } from '../src/repositories/stock.repository';
import { ProductRepository } from '../src/repositories/product.repository';
import { CostEngineService } from '../src/services/cost-engine.service';
import { Decimal } from '../src/domain/decimal';
import type { Database } from '../src/database/types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Fase 7 — Envasado: GRA + COM -> PRO, MST, MFA, Cierre de Lote (Merma/Sobrante), Concurrencia y Rollback Tardío', async (t) => {
  const factoryRepo = new FactoryRepository(supabase);
  const formulaRepo = new FormulaRepository(supabase);
  const supplierItemRepo = new SupplierItemRepository(supabase);
  const stockRepo = new StockRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const costEngineService = new CostEngineService(supplierItemRepo, formulaRepo, productRepo);

  const factoryService = new FactoryDomainService(
    factoryRepo,
    formulaRepo,
    supplierItemRepo,
    stockRepo,
    productRepo,
    costEngineService
  );

  const testTag = `ENV_${Date.now()}`;
  let supplierId: string;
  let com1Id: string;
  let com2Id: string;
  let baseProduct1Id: string;
  let baseProduct2Id: string;
  let product1Id: string;
  let product2Id: string;
  let rawMaterialId: string;
  let formulaVersionId: string;

  const createdOps: string[] = [];
  const createdBulkLots: string[] = [];
  const createdProducts: string[] = [];
  const createdBaseProducts: string[] = [];
  const createdStockItems: string[] = [];
  const createdSuppliers: string[] = [];

  t.before(async () => {
    // 1. Proveedor
    const { data: sup } = await supabase
      .from('suppliers')
      .insert({
        code: `PRV_${testTag}`,
        name: `Proveedor Envasado ${testTag}`,
        currency_code: 'ARS',
      })
      .select('id')
      .single();
    supplierId = sup!.id;
    createdSuppliers.push(supplierId);

    // 2. Componentes (COM, UNIT)
    const { data: c1 } = await supabase
      .from('stock_items')
      .insert({
        code: `C1_${testTag}`,
        item_type: 'COM',
        name: `Botella 1000cc ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    com1Id = c1!.id;
    createdStockItems.push(com1Id);
    await supabase.from('components').insert({ stock_item_id: com1Id });

    const { data: c2 } = await supabase
      .from('stock_items')
      .insert({
        code: `C2_${testTag}`,
        item_type: 'COM',
        name: `Tapa Flip Top ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    com2Id = c2!.id;
    createdStockItems.push(com2Id);
    await supabase.from('components').insert({ stock_item_id: com2Id });

    // Precios de proveedor para los componentes
    await supabase.from('supplier_items').insert([
      {
        supplier_id: supplierId,
        stock_item_id: com1Id,
        quoted_unit_price_net: 50.0,
        price_updated_at: new Date().toISOString(),
      },
      {
        supplier_id: supplierId,
        stock_item_id: com2Id,
        quoted_unit_price_net: 20.0,
        price_updated_at: new Date().toISOString(),
      },
    ]);

    // 3. Productos Base (PBA)
    const { data: bp1 } = await supabase
      .from('base_products')
      .insert({
        code: `PB1_${testTag}`,
        name: `Shampoo Base ${testTag}`,
        active: true,
      })
      .select('id')
      .single();
    baseProduct1Id = bp1!.id;
    createdBaseProducts.push(baseProduct1Id);

    const { data: bp2 } = await supabase
      .from('base_products')
      .insert({
        code: `PB2_${testTag}`,
        name: `Acondicionador Base ${testTag}`,
        active: true,
      })
      .select('id')
      .single();
    baseProduct2Id = bp2!.id;
    createdBaseProducts.push(baseProduct2Id);

    // 4. Materia prima para registrar fórmula mínima
    const { data: mpr } = await supabase
      .from('stock_items')
      .insert({
        code: `MP_${testTag}`,
        item_type: 'MPR',
        name: `Materia Prima Min ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 5,
      })
      .select('id')
      .single();
    rawMaterialId = mpr!.id;
    createdStockItems.push(rawMaterialId);
    await supabase.from('raw_materials').insert({ stock_item_id: rawMaterialId });

    // Versión de fórmula para bp1
    const { data: fv } = await supabase
      .from('formula_versions')
      .insert({
        base_product_id: baseProduct1Id,
        version_number: 1,
        is_current: true,
      })
      .select('id')
      .single();
    formulaVersionId = fv!.id;

    await supabase.from('formula_version_items').insert({
      formula_version_id: formulaVersionId,
      raw_material_id: rawMaterialId,
      quantity_kg: 100,
    });

    // 5. Productos Finales (PRO)
    // PRO1: compatible con PBA1 (Shampoo), 1.000 kg por unidad
    const { data: p1 } = await supabase
      .from('stock_items')
      .insert({
        code: `PR1_${testTag}`,
        item_type: 'PRO',
        name: `Shampoo 1000cc ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 5,
      })
      .select('id')
      .single();
    product1Id = p1!.id;
    createdStockItems.push(product1Id);
    createdProducts.push(product1Id);

    await supabase.from('products').insert({
      stock_item_id: product1Id,
      base_product_id: baseProduct1Id,
      presentation: '1000cc',
      weight_kg: 1.0,
      extra_variable_pct: 2.0,
    });

    // BOM de PRO1: 1 botella (com1) + 2 tapas (com2)
    await supabase.from('product_components').insert([
      {
        product_id: product1Id,
        component_id: com1Id,
        quantity_per_unit: 1,
        sort_order: 1,
      },
      {
        product_id: product1Id,
        component_id: com2Id,
        quantity_per_unit: 2,
        sort_order: 2,
      },
    ]);

    // PRO2: compatible con PBA2 (Acondicionador)
    const { data: p2 } = await supabase
      .from('stock_items')
      .insert({
        code: `PR2_${testTag}`,
        item_type: 'PRO',
        name: `Acondicionador 1000cc ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 5,
      })
      .select('id')
      .single();
    product2Id = p2!.id;
    createdStockItems.push(product2Id);
    createdProducts.push(product2Id);

    await supabase.from('products').insert({
      stock_item_id: product2Id,
      base_product_id: baseProduct2Id,
      presentation: '1000cc',
      weight_kg: 1.0,
      extra_variable_pct: 2.0,
    });

    await supabase.from('product_components').insert({
      product_id: product2Id,
      component_id: com1Id,
      quantity_per_unit: 1,
      sort_order: 1,
    });
  });

  t.after(async () => {
    // Limpieza de datos de prueba
    if (createdOps.length > 0) {
      await supabase.from('factory_movements').delete().in('operation_id', createdOps);
      await supabase.from('stock_movements').delete().in('operation_id', createdOps);
      await supabase.from('packaging_component_snapshots').delete().filter('packaging_operation_id', 'not.is', null);
      await supabase.from('packaging_operations').delete().in('operation_id', createdOps);
      await supabase.from('bulk_lots').delete().in('operation_id', createdOps);
      await supabase.from('business_operations').delete().in('id', createdOps);
    }
    if (createdBulkLots.length > 0) {
      await supabase.from('bulk_lots').delete().in('id', createdBulkLots);
    }
    if (createdProducts.length > 0) {
      await supabase.from('product_components').delete().in('product_id', createdProducts);
      await supabase.from('products').delete().in('stock_item_id', createdProducts);
    }
    if (formulaVersionId) {
      await supabase.from('formula_version_items').delete().eq('formula_version_id', formulaVersionId);
      await supabase.from('formula_versions').delete().eq('id', formulaVersionId);
    }
    if (createdStockItems.length > 0) {
      await supabase.from('stock_balances').delete().in('stock_item_id', createdStockItems);
      await supabase.from('supplier_items').delete().in('stock_item_id', createdStockItems);
      await supabase.from('components').delete().in('stock_item_id', createdStockItems);
      await supabase.from('raw_materials').delete().in('stock_item_id', createdStockItems);
      await supabase.from('stock_items').delete().in('id', createdStockItems);
    }
    if (createdBaseProducts.length > 0) {
      await supabase.from('base_products').delete().in('id', createdBaseProducts);
    }
    if (createdSuppliers.length > 0) {
      await supabase.from('suppliers').delete().in('id', createdSuppliers);
    }
  });

  // Helper para crear un lote de granel abierto
  async function createTestBulkLot(baseProdId: string, kg: number, costPerKg: number = 100.0) {
    const { data: op } = await supabase
      .from('business_operations')
      .insert({
        operation_type: 'BULK_PRODUCTION',
        business_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();
    createdOps.push(op!.id);

    const { data: seq } = await supabase.rpc('get_next_code_sequence', { p_prefix: 'GRA' });
    const graCode = seq as unknown as string;

    const { data: lot } = await supabase
      .from('bulk_lots')
      .insert({
        code: graCode,
        operation_id: op!.id,
        base_product_id: baseProdId,
        formula_version_id: formulaVersionId,
        kg_fabricated: kg,
        kg_available: kg,
        status: 'OPEN',
        total_cost_snapshot_ars: kg * costPerKg,
        cost_per_kg_snapshot_ars: costPerKg,
      })
      .select('id, code')
      .single();

    createdBulkLots.push(lot!.id);
    return lot!;
  }

  // Helper para asignar saldo a un ítem
  async function setStockBalance(itemId: string, qty: number) {
    await supabase.from('stock_balances').upsert({
      stock_item_id: itemId,
      quantity: qty,
      updated_at: new Date().toISOString(),
    });
  }

  await t.test('1. Envasado válido parcial: consume GRA, descuenta COMs según BOM, incrementa PRO, genera MST y MFA', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 50); // 50 kg disponibles
    await setStockBalance(com1Id, 100); // 100 botellas
    await setStockBalance(com2Id, 200); // 200 tapas
    await setStockBalance(product1Id, 0);   // 0 productos finales

    const result = await factoryService.packageProduct({
      bulkLotId: lot.id,
      productId: product1Id,
      unitsPackaged: 20, // 20 unidades * 1.0 kg = 20 kg
      isLastOfLot: false,
    });

    createdOps.push(result.operationId);

    // Validar resultado devuelto
    assert.ok(result.envCode.startsWith('ENV'), 'El código debe comenzar con ENV');
    assert.ok(result.mfaCode.startsWith('MFA'), 'El código MFA debe comenzar con MFA');
    assert.strictEqual(result.unitsPackaged, 20);
    assert.strictEqual(result.kgConsumed.toString(), '20');
    assert.strictEqual(result.isLastOfLot, false);
    assert.strictEqual(result.varianceType, 'NONE');
    assert.strictEqual(result.bulkLotStatus, 'OPEN');
    assert.strictEqual(result.bulkLotKgAvailable.toString(), '30');

    // Validar lote en base de datos
    const { data: lotDb } = await supabase
      .from('bulk_lots')
      .select('kg_available, status')
      .eq('id', lot.id)
      .single();
    assert.strictEqual(Number(lotDb!.kg_available), 30);
    assert.strictEqual(lotDb!.status, 'OPEN');

    // Validar saldos de stock
    const { data: balCom1 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com1Id).single();
    const { data: balCom2 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com2Id).single();
    const { data: balPro } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', product1Id).single();

    assert.strictEqual(Number(balCom1!.quantity), 80, 'COM1 debe descontar 20 (100 - 20 = 80)');
    assert.strictEqual(Number(balCom2!.quantity), 160, 'COM2 debe descontar 40 (200 - 40 = 160)');
    assert.strictEqual(Number(balPro!.quantity), 20, 'PRO debe incrementar en 20 (0 + 20 = 20)');

    // Validar movimientos MST
    const { data: msts } = await supabase
      .from('stock_movements')
      .select('stock_item_id, movement_type, quantity_delta')
      .eq('operation_id', result.operationId);
    assert.strictEqual(msts!.length, 3, 'Debe haber 3 movimientos MST (2 salidas COM, 1 entrada PRO)');
    for (const m of msts!) {
      assert.strictEqual(m.movement_type, 'ENVASADO');
    }

    // Validar MFA
    const { data: mfas } = await supabase
      .from('factory_movements')
      .select('movement_type, quantity_kg')
      .eq('operation_id', result.operationId);
    assert.strictEqual(mfas!.length, 1, 'Debe haber 1 movimiento MFA de envasado');
    assert.strictEqual(mfas![0].movement_type, 'ENVASADO');
    assert.strictEqual(Number(mfas![0].quantity_kg), 20);
  });

  await t.test('2. Cierre de lote con MERMA: is_last_of_lot=true con consumo menor al disponible', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 30); // 30 kg
    await setStockBalance(com1Id, 100);
    await setStockBalance(com2Id, 100);
    await setStockBalance(product1Id, 0);

    const result = await factoryService.packageProduct({
      bulkLotId: lot.id,
      productId: product1Id,
      unitsPackaged: 25, // 25 kg requeridos de los 30 kg disponibles -> 5 kg MERMA
      isLastOfLot: true,
    });

    createdOps.push(result.operationId);

    assert.strictEqual(result.isLastOfLot, true);
    assert.strictEqual(result.varianceType, 'MERMA');
    assert.strictEqual(result.varianceKg.toString(), '5');
    assert.strictEqual(result.bulkLotStatus, 'CLOSED');
    assert.strictEqual(result.bulkLotKgAvailable.toString(), '0');
    assert.ok(result.mfaVarianceCode, 'Debe generar código MFA para la merma');

    // Validar lote en DB
    const { data: lotDb } = await supabase
      .from('bulk_lots')
      .select('kg_available, status, closed_at')
      .eq('id', lot.id)
      .single();
    assert.strictEqual(Number(lotDb!.kg_available), 0);
    assert.strictEqual(lotDb!.status, 'CLOSED');
    assert.ok(lotDb!.closed_at !== null, 'closed_at debe estar seteado');

    // Validar movimientos MFA: deben ser 2 (ENVASADO + MERMA)
    const { data: mfas } = await supabase
      .from('factory_movements')
      .select('movement_type, quantity_kg, description')
      .eq('operation_id', result.operationId)
      .order('created_at', { ascending: true });
    assert.strictEqual(mfas!.length, 2, 'Debe haber 2 MFAs');
    assert.strictEqual(mfas![0].movement_type, 'ENVASADO');
    assert.strictEqual(Number(mfas![0].quantity_kg), 25);
    assert.strictEqual(mfas![1].movement_type, 'MERMA');
    assert.strictEqual(Number(mfas![1].quantity_kg), 5);
  });

  await t.test('3. Cierre de lote con SOBRANTE: is_last_of_lot=true con consumo mayor al disponible', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 10); // 10 kg teóricos
    await setStockBalance(com1Id, 100);
    await setStockBalance(com2Id, 100);
    await setStockBalance(product1Id, 0);

    const result = await factoryService.packageProduct({
      bulkLotId: lot.id,
      productId: product1Id,
      unitsPackaged: 12, // 12 kg envasados físicamente -> 2 kg SOBRANTE
      isLastOfLot: true,
    });

    createdOps.push(result.operationId);

    assert.strictEqual(result.isLastOfLot, true);
    assert.strictEqual(result.varianceType, 'SOBRANTE');
    assert.strictEqual(result.varianceKg.toString(), '2');
    assert.strictEqual(result.bulkLotStatus, 'CLOSED');
    assert.strictEqual(result.bulkLotKgAvailable.toString(), '0');

    // Validar 2 MFAs: ENVASADO + SOBRANTE
    const { data: mfas } = await supabase
      .from('factory_movements')
      .select('movement_type, quantity_kg')
      .eq('operation_id', result.operationId)
      .order('created_at', { ascending: true });
    assert.strictEqual(mfas!.length, 2);
    assert.strictEqual(mfas![0].movement_type, 'ENVASADO');
    assert.strictEqual(Number(mfas![0].quantity_kg), 12);
    assert.strictEqual(mfas![1].movement_type, 'SOBRANTE');
    assert.strictEqual(Number(mfas![1].quantity_kg), 2);
  });

  await t.test('4. Cierre de lote exacto a 0: is_last_of_lot=true con consumo exactamente igual al disponible', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 15);
    await setStockBalance(com1Id, 50);
    await setStockBalance(com2Id, 50);

    const result = await factoryService.packageProduct({
      bulkLotId: lot.id,
      productId: product1Id,
      unitsPackaged: 15,
      isLastOfLot: true,
    });

    createdOps.push(result.operationId);

    assert.strictEqual(result.isLastOfLot, true);
    assert.strictEqual(result.varianceType, 'NONE');
    assert.strictEqual(result.varianceKg.toString(), '0');
    assert.strictEqual(result.bulkLotStatus, 'CLOSED');
    assert.strictEqual(result.bulkLotKgAvailable.toString(), '0');

    // Solo 1 MFA (ENVASADO)
    const { data: mfas } = await supabase
      .from('factory_movements')
      .select('movement_type')
      .eq('operation_id', result.operationId);
    assert.strictEqual(mfas!.length, 1);
    assert.strictEqual(mfas![0].movement_type, 'ENVASADO');
  });

  await t.test('5. Rechazo por granel insuficiente cuando is_last_of_lot=false', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 5); // Solo 5 kg
    await setStockBalance(com1Id, 50);
    await setStockBalance(com2Id, 50);

    await assert.rejects(
      async () => {
        await factoryService.packageProduct({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 6, // Requiere 6 kg > 5 kg
          isLastOfLot: false,
        });
      },
      /Granel insuficiente/i
    );

    // Verificar que el lote no se modificó
    const { data: lotDb } = await supabase
      .from('bulk_lots')
      .select('kg_available, status')
      .eq('id', lot.id)
      .single();
    assert.strictEqual(Number(lotDb!.kg_available), 5);
    assert.strictEqual(lotDb!.status, 'OPEN');
  });

  await t.test('6. Rechazo por stock insuficiente de componentes (COM): ningún saldo alterado', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 50);
    await setStockBalance(com1Id, 5);  // Solo 5 botellas disponibles
    await setStockBalance(com2Id, 100);

    await assert.rejects(
      async () => {
        await factoryService.packageProduct({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 10, // Requiere 10 de COM1 y 20 de COM2
          isLastOfLot: false,
        });
      },
      /Stock insuficiente para el componente/i
    );

    // Verificar que COM1 y COM2 siguen intactos
    const { data: bal1 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com1Id).single();
    const { data: bal2 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com2Id).single();
    assert.strictEqual(Number(bal1!.quantity), 5);
    assert.strictEqual(Number(bal2!.quantity), 100);
  });

  await t.test('7. Rechazo por cantidad de unidades inválida: UNIT entero obligatorio y > 0', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 50);

    await assert.rejects(
      async () => {
        await factoryService.packageProduct({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 0,
        });
      },
      /entero mayor a 0/i
    );

    await assert.rejects(
      async () => {
        await factoryService.packageProduct({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: '2.5',
        });
      },
      /número entero/i
    );
  });

  await t.test('8. Rechazo de incompatibilidad: GRA incompatible con PRO (distinto PBA)', async () => {
    // lot pertenece a PBA1, product2 pertenece a PBA2
    const lot = await createTestBulkLot(baseProduct1Id, 50);
    await setStockBalance(com1Id, 50);

    await assert.rejects(
      async () => {
        await factoryService.packageProduct({
          bulkLotId: lot.id,
          productId: product2Id, // Compatible con PBA2, no con PBA1
          unitsPackaged: 5,
        });
      },
      /no corresponde al Producto Base/i
    );
  });

  await t.test('9. Rechazo de lote cerrado (CLOSED)', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 50);
    // Cerrar lote manualmente
    await supabase.from('bulk_lots').update({ status: 'CLOSED' }).eq('id', lot.id);
    await setStockBalance(com1Id, 50);
    await setStockBalance(com2Id, 50);

    await assert.rejects(
      async () => {
        await factoryService.packageProduct({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 5,
        });
      },
      /está cerrado/i
    );
  });

  await t.test('10. Congelamiento de costos históricos: base_cost_per_kg, snapshots de componentes y 2% extra variable', async () => {
    // Lote con costo granel = $100/kg
    const lot = await createTestBulkLot(baseProduct1Id, 50, 100.0);
    await setStockBalance(com1Id, 50);
    await setStockBalance(com2Id, 50);

    // Componentes:
    // COM1: neto $50 * 1.21 = $60.50 (1 unidad = $60.50)
    // COM2: neto $20 * 1.21 = $24.20 (2 unidades = $48.40)
    // Total componentes por unidad PRO = $60.50 + $48.40 = $108.90
    // Granel por unidad PRO (1 kg) = $100.00
    // Subtotal = $208.90
    // 2% extra variable = $208.90 * 0.02 = $4.178
    // Costo unitario = $208.90 * 1.02 = $213.078
    const result = await factoryService.packageProduct({
      bulkLotId: lot.id,
      productId: product1Id,
      unitsPackaged: 10,
    });

    createdOps.push(result.operationId);

    assert.strictEqual(result.unitCostSnapshotArs.toString(), '213.078');
    assert.strictEqual(result.totalCostSnapshotArs.toString(), '2130.78');

    // Validar registro en packaging_operations
    const { data: opDb } = await supabase
      .from('packaging_operations')
      .select('base_cost_per_kg_snapshot_ars, unit_cost_snapshot_ars, total_cost_snapshot_ars')
      .eq('operation_id', result.operationId)
      .single();
    assert.strictEqual(Number(opDb!.base_cost_per_kg_snapshot_ars), 100);
    assert.strictEqual(Number(opDb!.unit_cost_snapshot_ars), 213.078);
    assert.strictEqual(Number(opDb!.total_cost_snapshot_ars), 2130.78);

    // Validar snapshots en packaging_component_snapshots
    const { data: compSnaps } = await supabase
      .from('packaging_component_snapshots')
      .select('component_id, quantity_per_unit, quantity_total, unit_cost_gross_ars_snapshot')
      .eq('packaging_operation_id', result.packagingOperationId)
      .order('quantity_per_unit', { ascending: true });

    assert.strictEqual(compSnaps!.length, 2);
    // COM1
    assert.strictEqual(compSnaps![0].quantity_per_unit, 1);
    assert.strictEqual(compSnaps![0].quantity_total, 10);
    assert.strictEqual(Number(compSnaps![0].unit_cost_gross_ars_snapshot), 60.5);
    // COM2
    assert.strictEqual(compSnaps![1].quantity_per_unit, 2);
    assert.strictEqual(compSnaps![1].quantity_total, 20);
    assert.strictEqual(Number(compSnaps![1].unit_cost_gross_ars_snapshot), 24.2);
  });

  await t.test('11. Concurrencia sobre el mismo lote GRA: serialización determinista y consistencia de saldo', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 30); // 30 kg disponibles
    await setStockBalance(com1Id, 500);
    await setStockBalance(com2Id, 500);

    // Ejecutar dos envasados simultáneos de 20 unidades (total requeriría 40 kg, solo hay 30 kg)
    const [res1, res2] = await Promise.allSettled([
      factoryService.packageProduct({
        bulkLotId: lot.id,
        productId: product1Id,
        unitsPackaged: 20,
        isLastOfLot: false,
      }),
      factoryService.packageProduct({
        bulkLotId: lot.id,
        productId: product1Id,
        unitsPackaged: 20,
        isLastOfLot: false,
      }),
    ]);

    // Exactamente una debe triunfar y una debe ser rechazada por granel insuficiente
    const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactamente una operación debe completarse');
    assert.strictEqual(rejected.length, 1, 'Exactamente una operación debe rechazarse');

    const successfulResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    createdOps.push(successfulResult.operationId);

    // Verificar que el saldo restante es exactamente 10 kg (30 - 20)
    const { data: lotDb } = await supabase
      .from('bulk_lots')
      .select('kg_available, status')
      .eq('id', lot.id)
      .single();
    assert.strictEqual(Number(lotDb!.kg_available), 10);
    assert.strictEqual(lotDb!.status, 'OPEN');
  });

  await t.test('12. Concurrencia sobre los mismos componentes: serialización determinista y rechazo sin saldo negativo', async () => {
    const lotA = await createTestBulkLot(baseProduct1Id, 50);
    const lotB = await createTestBulkLot(baseProduct1Id, 50);

    // Configurar COM1 con stock para solo 1 envasado de 15 unidades (15 botellas disponibles)
    await setStockBalance(com1Id, 15);
    await setStockBalance(com2Id, 100);

    const [resA, resB] = await Promise.allSettled([
      factoryService.packageProduct({
        bulkLotId: lotA.id,
        productId: product1Id,
        unitsPackaged: 15,
        isLastOfLot: false,
      }),
      factoryService.packageProduct({
        bulkLotId: lotB.id,
        productId: product1Id,
        unitsPackaged: 15,
        isLastOfLot: false,
      }),
    ]);

    const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactamente una operación debe tener éxito');
    assert.strictEqual(rejected.length, 1, 'Exactamente una operación debe rechazarse por stock insuficiente');

    const successfulResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    createdOps.push(successfulResult.operationId);

    // Verificar que el saldo de COM1 llegó a 0 sin ser negativo
    const { data: bal1 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com1Id).single();
    assert.strictEqual(Number(bal1!.quantity), 0);
  });

  await t.test('13. Rollback tardío completo: fallo forzado por overflow en snapshot revierte business_operations, packaging_operations, snapshots, MSTs, MFAs y saldos', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 40);
    await setStockBalance(com1Id, 100);
    await setStockBalance(com2Id, 100);
    await setStockBalance(product1Id, 0);

    // Invocar directamente a la RPC pasando en el segundo componente un costo desbordante
    // que provoque fallo 'numeric field overflow' durante la inserción en packaging_component_snapshots (Paso 14),
    // DESPUÉS de haber insertado business_operations, packaging_operations y consumido secuencias.
    const desbordanteComponentCosts = [
      {
        componentId: com1Id,
        unitCostGrossArsSnapshot: new Decimal(50),
      },
      {
        componentId: com2Id,
        unitCostGrossArsSnapshot: new Decimal('999999999999999999'), // Provoca overflow en NUMERIC(20,6)
      },
    ];

    let errorOcurrido = false;
    try {
      await factoryRepo.packageProductAtomic({
        bulkLotId: lot.id,
        productId: product1Id,
        unitsPackaged: 10,
        isLastOfLot: false,
        componentCosts: desbordanteComponentCosts,
      });
    } catch (err: any) {
      errorOcurrido = true;
      assert.ok(
        /overflow|numérico|numeric/i.test(err.message),
        `El error debe ser de desbordamiento numérico en PostgreSQL, recibido: ${err.message}`
      );
    }

    assert.ok(errorOcurrido, 'La RPC debió fallar por overflow numérico en snapshot');

    // VERIFICAR AUSENCIA TOTAL DE RESIDUOS (ACID ROLLBACK)
    // 1. Cero packaging_operations huérfanas
    const { data: opsHuerfanas } = await supabase
      .from('packaging_operations')
      .select('id')
      .eq('bulk_lot_id', lot.id);
    assert.strictEqual(opsHuerfanas!.length, 0, 'No deben quedar packaging_operations residuales');

    // 2. Lote con saldo intacto
    const { data: lotDb } = await supabase
      .from('bulk_lots')
      .select('kg_available, status')
      .eq('id', lot.id)
      .single();
    assert.strictEqual(Number(lotDb!.kg_available), 40, 'kg_available del lote debe permanecer intacto (40 kg)');
    assert.strictEqual(lotDb!.status, 'OPEN', 'El status del lote debe seguir OPEN');

    // 3. Saldos de componentes y producto intactos
    const { data: bal1 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com1Id).single();
    const { data: bal2 } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', com2Id).single();
    const { data: balPro } = await supabase.from('stock_balances').select('quantity').eq('stock_item_id', product1Id).single();
    assert.strictEqual(Number(bal1!.quantity), 100, 'COM1 debe seguir en 100');
    assert.strictEqual(Number(bal2!.quantity), 100, 'COM2 debe seguir en 100');
    assert.strictEqual(Number(balPro!.quantity), 0, 'PRO debe seguir en 0');

    // 4. Cero movimientos de fábrica de envasado residuales para este lote
    const { data: mfas } = await supabase
      .from('factory_movements')
      .select('id')
      .eq('bulk_lot_id', lot.id)
      .eq('movement_type', 'ENVASADO');
    assert.strictEqual(mfas!.length, 0, 'No deben quedar movimientos MFA residuales');
  });

  await t.test('14. Rechazo explícito: snapshot COM faltante respecto al BOM', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 40);

    // BOM de product1Id tiene com1Id y com2Id. Enviamos únicamente com1Id.
    const faltanteComponentCosts = [
      {
        componentId: com1Id,
        unitCostGrossArsSnapshot: new Decimal(50),
      },
    ];

    await assert.rejects(
      async () => {
        await factoryRepo.packageProductAtomic({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 10,
          isLastOfLot: false,
          componentCosts: faltanteComponentCosts,
        });
      },
      /componentes faltantes/i,
      'Debe rechazar con error explícito de componentes faltantes respecto al BOM'
    );
  });

  await t.test('15. Rechazo explícito: snapshot COM extra que no pertenece al BOM', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 40);

    // BOM de product1Id tiene com1Id y com2Id. Enviamos com1Id, com2Id y un ítem extra (rawMaterialId).
    const extraComponentCosts = [
      {
        componentId: com1Id,
        unitCostGrossArsSnapshot: new Decimal(50),
      },
      {
        componentId: com2Id,
        unitCostGrossArsSnapshot: new Decimal(20),
      },
      {
        componentId: rawMaterialId,
        unitCostGrossArsSnapshot: new Decimal(10),
      },
    ];

    await assert.rejects(
      async () => {
        await factoryRepo.packageProductAtomic({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 10,
          isLastOfLot: false,
          componentCosts: extraComponentCosts,
        });
      },
      /componentes extra/i,
      'Debe rechazar con error explícito de componentes extra que no pertenecen al BOM'
    );
  });

  await t.test('16. Rechazo explícito: snapshot COM duplicado', async () => {
    const lot = await createTestBulkLot(baseProduct1Id, 40);

    // Enviamos el mismo componentId duplicado
    const duplicadoComponentCosts = [
      {
        componentId: com1Id,
        unitCostGrossArsSnapshot: new Decimal(50),
      },
      {
        componentId: com1Id,
        unitCostGrossArsSnapshot: new Decimal(50),
      },
    ];

    await assert.rejects(
      async () => {
        await factoryRepo.packageProductAtomic({
          bulkLotId: lot.id,
          productId: product1Id,
          unitsPackaged: 10,
          isLastOfLot: false,
          componentCosts: duplicadoComponentCosts,
        });
      },
      /componentes duplicados/i,
      'Debe rechazar con error explícito de componentes duplicados'
    );
  });
});
