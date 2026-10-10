import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { FactoryDomainService } from '../src/services/factory.service';
import { FactoryRepository } from '../src/repositories/factory.repository';
import { FormulaRepository } from '../src/repositories/formula.repository';
import { SupplierItemRepository } from '../src/repositories/supplier-item.repository';
import { StockRepository } from '../src/repositories/stock.repository';
import { Decimal } from '../src/domain/decimal';
import type { Database } from '../src/database/types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Fase 6 — Fabricación de Granel: Atomicidad, GRA, MFA, MST, Concurrencia y Congelamiento de Costos', async (t) => {
  const factoryRepo = new FactoryRepository(supabase);
  const formulaRepo = new FormulaRepository(supabase);
  const supplierItemRepo = new SupplierItemRepository(supabase);
  const stockRepo = new StockRepository(supabase);
  const factoryService = new FactoryDomainService(
    factoryRepo,
    formulaRepo,
    supplierItemRepo,
    stockRepo
  );

  const testTag = `FAB_${Date.now()}`;
  let supplierId: string;
  let mpr1Id: string;
  let mpr2Id: string;
  let mpr3Id: string;
  let baseProductId: string;
  let formulaVersionId: string;

  const createdOps: string[] = [];
  const createdBulkLots: string[] = [];
  const createdBaseProducts: string[] = [];
  const createdStockItems: string[] = [];
  const createdSuppliers: string[] = [];

  t.before(async () => {
    // 1. Crear proveedor en ARS
    const { data: sup } = await supabase
      .from('suppliers')
      .insert({
        code: `PRV_${testTag}`,
        name: `Proveedor Fab ${testTag}`,
        currency_code: 'ARS',
      })
      .select('id')
      .single();
    supplierId = sup!.id;
    createdSuppliers.push(supplierId);

    // 2. Crear 3 Materias Primas (KG)
    const { data: item1 } = await supabase
      .from('stock_items')
      .insert({
        code: `MP1_${testTag}`,
        item_type: 'MPR',
        name: `Materia Prima 1 ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    mpr1Id = item1!.id;
    createdStockItems.push(mpr1Id);
    await supabase.from('raw_materials').insert({ stock_item_id: mpr1Id });

    const { data: item2 } = await supabase
      .from('stock_items')
      .insert({
        code: `MP2_${testTag}`,
        item_type: 'MPR',
        name: `Materia Prima 2 ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    mpr2Id = item2!.id;
    createdStockItems.push(mpr2Id);
    await supabase.from('raw_materials').insert({ stock_item_id: mpr2Id });

    const { data: item3 } = await supabase
      .from('stock_items')
      .insert({
        code: `MP3_${testTag}`,
        item_type: 'MPR',
        name: `Materia Prima 3 ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    mpr3Id = item3!.id;
    createdStockItems.push(mpr3Id);
    await supabase.from('raw_materials').insert({ stock_item_id: mpr3Id });

    // 3. Crear relaciones supplier_items (precios netos)
    await supabase.from('supplier_items').insert([
      {
        supplier_id: supplierId,
        stock_item_id: mpr1Id,
        quoted_unit_price_net: 1000.0,
        price_updated_at: new Date().toISOString(),
      },
      {
        supplier_id: supplierId,
        stock_item_id: mpr2Id,
        quoted_unit_price_net: 2000.0,
        price_updated_at: new Date().toISOString(),
      },
      {
        supplier_id: supplierId,
        stock_item_id: mpr3Id,
        quoted_unit_price_net: 3000.0,
        price_updated_at: new Date().toISOString(),
      },
    ]);

    // 4. Cargar stock inicial con ajuste atómico: 100 kg a cada una
    await stockRepo.createAdjustment({
      stockItemId: mpr1Id,
      quantityDelta: new Decimal(100),
      reason: 'Stock inicial prueba fabricación 1',
    });
    await stockRepo.createAdjustment({
      stockItemId: mpr2Id,
      quantityDelta: new Decimal(100),
      reason: 'Stock inicial prueba fabricación 2',
    });
    await stockRepo.createAdjustment({
      stockItemId: mpr3Id,
      quantityDelta: new Decimal(100),
      reason: 'Stock inicial prueba fabricación 3',
    });

    // 5. Crear Producto Base (PBA) con fórmula: 60 kg de MPR1 + 40 kg de MPR2 = 100 kg total
    const { data: bp } = await supabase
      .from('base_products')
      .insert({
        code: `PBA_${testTag}`,
        name: `Producto Base Fab ${testTag}`,
      })
      .select('id')
      .single();
    baseProductId = bp!.id;
    createdBaseProducts.push(baseProductId);

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

    await supabase.from('formula_version_items').insert([
      {
        formula_version_id: formulaVersionId,
        raw_material_id: mpr1Id,
        quantity_kg: 60.0,
        sort_order: 1,
      },
      {
        formula_version_id: formulaVersionId,
        raw_material_id: mpr2Id,
        quantity_kg: 40.0,
        sort_order: 2,
      },
    ]);
  });

  t.after(async () => {
    // Cleanup ordenado
    for (const lotId of createdBulkLots) {
      await supabase.from('bulk_lot_material_snapshots').delete().eq('bulk_lot_id', lotId);
      await supabase.from('factory_movements').delete().eq('bulk_lot_id', lotId);
      await supabase.from('bulk_lots').delete().eq('id', lotId);
    }
    for (const opId of createdOps) {
      await supabase.from('stock_movements').delete().eq('operation_id', opId);
      await supabase.from('business_operations').delete().eq('id', opId);
    }
    for (const bpId of createdBaseProducts) {
      const { data: fvs } = await supabase.from('formula_versions').select('id').eq('base_product_id', bpId);
      for (const f of fvs || []) {
        await supabase.from('formula_version_items').delete().eq('formula_version_id', f.id);
      }
      await supabase.from('formula_versions').delete().eq('base_product_id', bpId);
      await supabase.from('base_products').delete().eq('id', bpId);
    }
    for (const itemId of createdStockItems) {
      await supabase.from('supplier_items').delete().eq('stock_item_id', itemId);
      await supabase.from('stock_balances').delete().eq('stock_item_id', itemId);
      await supabase.from('stock_movements').delete().eq('stock_item_id', itemId);
      await supabase.from('raw_materials').delete().eq('stock_item_id', itemId);
      await supabase.from('stock_items').delete().eq('id', itemId);
    }
    for (const sId of createdSuppliers) {
      await supabase.from('suppliers').delete().eq('id', sId);
    }
  });

  await t.test('1. Fabricación válida de 50 kg: escalado proporcional, GRA OPEN, MFA y descuento MST', async () => {
    const bal1Before = await stockRepo.getBalance(mpr1Id);
    const bal2Before = await stockRepo.getBalance(mpr2Id);

    // Fabricar 50 kg (la mitad de la fórmula base de 100 kg)
    // Consumo esperado: MPR1 = 30 kg, MPR2 = 20 kg
    const res = await factoryService.manufactureBulkLot({
      baseProductId,
      formulaVersionId,
      kgFabricated: 50,
      businessDate: '2026-10-10',
      observations: 'Fabricación lote prueba 1',
    });

    createdBulkLots.push(res.bulkLotId);
    createdOps.push(res.operationId);

    // Validar respuesta de la función
    assert.ok(res.graCode.startsWith('GRA'), `Código GRA debe iniciar con GRA, recibido ${res.graCode}`);
    assert.ok(res.mfaCode.startsWith('MFA'), `Código MFA debe iniciar con MFA, recibido ${res.mfaCode}`);
    assert.ok(res.kgFabricated.eq(50), `kgFabricated debe ser 50, recibido ${res.kgFabricated}`);
    assert.ok(res.kgAvailable.eq(50), `kgAvailable debe ser 50, recibido ${res.kgAvailable}`);

    // Validar bulk_lots en base de datos
    const { data: lot } = await supabase.from('bulk_lots').select('*').eq('id', res.bulkLotId).single();
    assert.strictEqual(lot?.status, 'OPEN');
    assert.strictEqual(lot?.kg_fabricated, 50.0);
    assert.strictEqual(lot?.kg_available, 50.0);

    // Validar factory_movements
    const { data: mfa } = await supabase.from('factory_movements').select('*').eq('code', res.mfaCode).single();
    assert.strictEqual(mfa?.movement_type, 'FABRICACIÓN');
    assert.strictEqual(mfa?.bulk_lot_id, res.bulkLotId);
    assert.strictEqual(mfa?.quantity_kg, 50.0);

    // Validar descuentos físicos en stock_balances
    const bal1After = await stockRepo.getBalance(mpr1Id);
    const bal2After = await stockRepo.getBalance(mpr2Id);
    assert.ok(bal1Before.minus(bal1After).eq(30), `Debe haber descontado 30 kg de MPR1, recibido ${bal1Before.minus(bal1After)}`);
    assert.ok(bal2Before.minus(bal2After).eq(20), `Debe haber descontado 20 kg de MPR2, recibido ${bal2Before.minus(bal2After)}`);

    // Validar movimientos en stock_movements (ledger)
    const { data: msts } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('operation_id', res.operationId);
    assert.strictEqual(msts?.length, 2);
    for (const m of msts || []) {
      assert.strictEqual(m.movement_type, 'FABRICACIÓN');
      assert.ok(m.quantity_delta < 0, 'El delta de consumo debe ser negativo');
    }

    // Validar bulk_lot_material_snapshots
    const { data: snaps } = await supabase
      .from('bulk_lot_material_snapshots')
      .select('*')
      .eq('bulk_lot_id', res.bulkLotId);
    assert.strictEqual(snaps?.length, 2);
  });

  await t.test('2. Precisión en kg: rechazo de cantidades con más de 3 decimales', async () => {
    await assert.rejects(
      async () => {
        await factoryService.manufactureBulkLot({
          baseProductId,
          formulaVersionId,
          kgFabricated: '50.1234',
        });
      },
      (err: any) => {
        assert.match(err.message, /decimales/);
        return true;
      }
    );
  });

  await t.test('3. Validación: rechazo de cantidad cero o negativa', async () => {
    await assert.rejects(
      async () => {
        await factoryService.manufactureBulkLot({
          baseProductId,
          formulaVersionId,
          kgFabricated: '0',
        });
      },
      (err: any) => {
        assert.match(err.message, /mayor a 0/);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await factoryService.manufactureBulkLot({
          baseProductId,
          formulaVersionId,
          kgFabricated: '-10',
        });
      },
      (err: any) => {
        assert.match(err.message, /mayor a 0/);
        return true;
      }
    );
  });

  await t.test('4. Prohibición de stock negativo: MPR insuficiente rechaza con rollback total en PostgreSQL', async () => {
    // El saldo actual de MPR1 es ~70 kg. Solicitar fabricar 200 kg requeriría 120 kg de MPR1.
    const { count: opsBefore } = await supabase.from('business_operations').select('*', { count: 'exact', head: true });
    const { count: lotsBefore } = await supabase.from('bulk_lots').select('*', { count: 'exact', head: true });
    const { count: snapsBefore } = await supabase.from('bulk_lot_material_snapshots').select('*', { count: 'exact', head: true });
    const { count: mfasBefore } = await supabase.from('factory_movements').select('*', { count: 'exact', head: true });
    const { count: mstsBefore } = await supabase.from('stock_movements').select('*', { count: 'exact', head: true });
    const bal1Before = await stockRepo.getBalance(mpr1Id);
    const bal2Before = await stockRepo.getBalance(mpr2Id);

    await assert.rejects(
      async () => {
        await factoryService.manufactureBulkLot({
          baseProductId,
          formulaVersionId,
          kgFabricated: 200,
        });
      },
      (err: any) => {
        assert.match(err.message, /Stock insuficiente/);
        return true;
      }
    );

    // Rollback total: verificar que no quedó ningún registro residual
    const { count: opsAfter } = await supabase.from('business_operations').select('*', { count: 'exact', head: true });
    const { count: lotsAfter } = await supabase.from('bulk_lots').select('*', { count: 'exact', head: true });
    const { count: snapsAfter } = await supabase.from('bulk_lot_material_snapshots').select('*', { count: 'exact', head: true });
    const { count: mfasAfter } = await supabase.from('factory_movements').select('*', { count: 'exact', head: true });
    const { count: mstsAfter } = await supabase.from('stock_movements').select('*', { count: 'exact', head: true });
    const bal1After = await stockRepo.getBalance(mpr1Id);
    const bal2After = await stockRepo.getBalance(mpr2Id);

    assert.strictEqual(opsAfter, opsBefore, 'Cero business_operations residuales');
    assert.strictEqual(lotsAfter, lotsBefore, 'Cero bulk_lots residuales');
    assert.strictEqual(snapsAfter, snapsBefore, 'Cero snapshots residuales');
    assert.strictEqual(mfasAfter, mfasBefore, 'Cero factory_movements residuales');
    assert.strictEqual(mstsAfter, mstsBefore, 'Cero stock_movements residuales');
    assert.strictEqual(bal1After.toString(), bal1Before.toString(), 'Saldo MPR1 intacto');
    assert.strictEqual(bal2After.toString(), bal2Before.toString(), 'Saldo MPR2 intacto');
  });

  await t.test('5. Saldo exacto a cero permitido: consumir exactamente el saldo disponible', async () => {
    // MPR3 tiene 100 kg. Creemos una fórmula para PBA de prueba con 100 kg de MPR3.
    const { data: bpSolo } = await supabase
      .from('base_products')
      .insert({ code: `PBS_${testTag}`, name: `PBA Solo ${testTag}` })
      .select('id')
      .single();
    createdBaseProducts.push(bpSolo!.id);

    const { data: fvSolo } = await supabase
      .from('formula_versions')
      .insert({ base_product_id: bpSolo!.id, version_number: 1, is_current: true })
      .select('id')
      .single();

    await supabase.from('formula_version_items').insert({
      formula_version_id: fvSolo!.id,
      raw_material_id: mpr3Id,
      quantity_kg: 100.0,
      sort_order: 1,
    });

    // Fabricar exactamente 100 kg -> consume 100 kg de MPR3 -> saldo final 0.000 kg
    const res = await factoryService.manufactureBulkLot({
      baseProductId: bpSolo!.id,
      formulaVersionId: fvSolo!.id,
      kgFabricated: 100,
    });

    createdBulkLots.push(res.bulkLotId);
    createdOps.push(res.operationId);

    const bal3Final = await stockRepo.getBalance(mpr3Id);
    assert.ok(bal3Final.isZero(), `El saldo debe quedar exactamente en 0, recibido ${bal3Final}`);
  });

  await t.test('6. Versión de fórmula incorrecta para PBA es rechazada', async () => {
    // Pasar un baseProductId con una formulaVersionId que pertenece a otro PBA
    const { data: bpOtro } = await supabase
      .from('base_products')
      .insert({ code: `PBO_${testTag}`, name: `PBA Otro ${testTag}` })
      .select('id')
      .single();
    createdBaseProducts.push(bpOtro!.id);

    await assert.rejects(
      async () => {
        await factoryRepo.manufactureBulkLotAtomic({
          baseProductId: bpOtro!.id,
          formulaVersionId: formulaVersionId, // pertenece al primer PBA
          kgFabricated: new Decimal(10),
          costSnapshots: [],
        });
      },
      (err: any) => {
        assert.match(err.message, /no pertenece al Producto Base/);
        return true;
      }
    );
  });

  await t.test('7. Versión que dejó de ser vigente (is_current = false) es rechazada con mensaje de recarga', async () => {
    // Crear versión 2 para baseProductId y marcar versión 1 como is_current = false
    const { data: fv2 } = await supabase
      .from('formula_versions')
      .insert({ base_product_id: baseProductId, version_number: 2, is_current: true })
      .select('id')
      .single();

    try {
      await supabase
        .from('formula_versions')
        .update({ is_current: false })
        .eq('id', formulaVersionId);

      // Intentar fabricar con la versión 1 desactualizada
      await assert.rejects(
        async () => {
          await factoryRepo.manufactureBulkLotAtomic({
            baseProductId,
            formulaVersionId,
            kgFabricated: new Decimal(10),
            costSnapshots: [],
          });
        },
        (err: any) => {
          assert.match(err.message, /ya no es la versión vigente/);
          return true;
        }
      );
    } finally {
      // Restaurar vigencia de versión 1 para las pruebas restantes
      if (fv2?.id) {
        await supabase.from('formula_versions').delete().eq('id', fv2.id);
      }
      await supabase.from('formula_versions').update({ is_current: true }).eq('id', formulaVersionId);
    }
  });

  await t.test('8. Snapshot de costos con MPR faltante es rechazado por la RPC', async () => {
    await assert.rejects(
      async () => {
        await factoryRepo.manufactureBulkLotAtomic({
          baseProductId,
          formulaVersionId,
          kgFabricated: new Decimal(10),
          costSnapshots: [
            {
              rawMaterialId: mpr1Id,
              sourceCurrency: 'ARS',
              sourceUnitPriceNet: new Decimal(1000),
              vatRatePct: new Decimal(21),
              unitCostGrossArsSnapshot: new Decimal(1210),
            },
            // Falta MPR2
          ],
        });
      },
      (err: any) => {
        assert.match(err.message, /materias primas faltantes/);
        return true;
      }
    );
  });

  await t.test('9. Snapshot de costos con MPR extra es rechazado por la RPC', async () => {
    await assert.rejects(
      async () => {
        await factoryRepo.manufactureBulkLotAtomic({
          baseProductId,
          formulaVersionId,
          kgFabricated: new Decimal(10),
          costSnapshots: [
            {
              rawMaterialId: mpr1Id,
              sourceCurrency: 'ARS',
              sourceUnitPriceNet: new Decimal(1000),
              vatRatePct: new Decimal(21),
              unitCostGrossArsSnapshot: new Decimal(1210),
            },
            {
              rawMaterialId: mpr2Id,
              sourceCurrency: 'ARS',
              sourceUnitPriceNet: new Decimal(2000),
              vatRatePct: new Decimal(21),
              unitCostGrossArsSnapshot: new Decimal(2420),
            },
            {
              rawMaterialId: mpr3Id, // extra
              sourceCurrency: 'ARS',
              sourceUnitPriceNet: new Decimal(3000),
              vatRatePct: new Decimal(21),
              unitCostGrossArsSnapshot: new Decimal(3630),
            },
          ],
        });
      },
      (err: any) => {
        assert.match(err.message, /materias primas extra/);
        return true;
      }
    );
  });

  await t.test('10. Snapshot de costos con MPR duplicada es rechazado por la RPC', async () => {
    await assert.rejects(
      async () => {
        await factoryRepo.manufactureBulkLotAtomic({
          baseProductId,
          formulaVersionId,
          kgFabricated: new Decimal(10),
          costSnapshots: [
            {
              rawMaterialId: mpr1Id,
              sourceCurrency: 'ARS',
              sourceUnitPriceNet: new Decimal(1000),
              vatRatePct: new Decimal(21),
              unitCostGrossArsSnapshot: new Decimal(1210),
            },
            {
              rawMaterialId: mpr1Id, // duplicado
              sourceCurrency: 'ARS',
              sourceUnitPriceNet: new Decimal(1000),
              vatRatePct: new Decimal(21),
              unitCostGrossArsSnapshot: new Decimal(1210),
            },
          ],
        });
      },
      (err: any) => {
        assert.match(err.message, /materias primas duplicadas/);
        return true;
      }
    );
  });

  await t.test('11. Concurrencia: dos fabricaciones simultáneas compitiendo por la misma MPR se serializan', async () => {
    // MPR1 tiene 70 kg y MPR2 tiene 80 kg restantes.
    // Cada fabricación de 100 kg de granel necesita 60 kg de MPR1 y 40 kg de MPR2.
    // Dos transacciones concurrentes compiten por 100 kg cada una (requerirían 120 kg de MPR1 en total):
    // exactamente una debe ganar y tener éxito (dejando 10 kg de MPR1), y la otra debe fallar por saldo insuficiente.
    const promises = [
      factoryService.manufactureBulkLot({
        baseProductId,
        formulaVersionId,
        kgFabricated: 100, // requiere 60 kg de MPR1
      }),
      factoryService.manufactureBulkLot({
        baseProductId,
        formulaVersionId,
        kgFabricated: 100, // requiere 60 kg de MPR1
      }),
    ];

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactamente una fabricación concurrente debe tener éxito');
    assert.strictEqual(rejected.length, 1, 'La otra fabricación concurrente debe ser rechazada');

    const successResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    createdBulkLots.push(successResult.bulkLotId);
    createdOps.push(successResult.operationId);
  });

  await t.test('12. Costo histórico congelado: no cambia al modificar precio de proveedor posterior', async () => {
    // 1. Fabricar 10 kg
    const res = await factoryService.manufactureBulkLot({
      baseProductId,
      formulaVersionId,
      kgFabricated: 10,
    });
    createdBulkLots.push(res.bulkLotId);
    createdOps.push(res.operationId);

    const costBefore = res.totalCostSnapshotArs;
    const unitCostBefore = res.costPerKgSnapshotArs;

    // 2. Modificar drásticamente el precio del proveedor de MPR1
    await supabase
      .from('supplier_items')
      .update({ quoted_unit_price_net: 99999.0 })
      .eq('stock_item_id', mpr1Id);

    // 3. Consultar nuevamente el lote en base de datos
    const lotAfter = await factoryRepo.getBulkLotById(res.bulkLotId);
    assert.strictEqual(
      lotAfter?.totalCostSnapshotArs.toString(),
      costBefore.toString(),
      'El costo histórico total del lote no debe cambiar'
    );
    assert.strictEqual(
      lotAfter?.costPerKgSnapshotArs.toString(),
      unitCostBefore.toString(),
      'El costo por kg histórico no debe cambiar'
    );
  });

  await t.test('13. Rollback tardío completo: fallo de FK en snapshot revierte business_operations, bulk_lots, snapshots, MSTs y saldos', async () => {
    // Tomar snapshots exactos antes de la operación fallida
    const { count: opsBefore } = await supabase.from('business_operations').select('*', { count: 'exact', head: true });
    const { count: lotsBefore } = await supabase.from('bulk_lots').select('*', { count: 'exact', head: true });
    const { count: snapsBefore } = await supabase.from('bulk_lot_material_snapshots').select('*', { count: 'exact', head: true });
    const { count: mfasBefore } = await supabase.from('factory_movements').select('*', { count: 'exact', head: true });
    const { count: mstsBefore } = await supabase.from('stock_movements').select('*', { count: 'exact', head: true });
    const bal1Before = await stockRepo.getBalance(mpr1Id);
    const bal2Before = await stockRepo.getBalance(mpr2Id);

    // Preparar snapshots: MPR1 con proveedor válido, MPR2 con proveedor inexistente para violar FK
    const fakeSupplierId = '00000000-0000-0000-0000-000000000001';
    const costSnapshots = [
      {
        rawMaterialId: mpr1Id,
        sourceSupplierId: supplierId,
        sourceCurrency: 'ARS',
        sourceUnitPriceNet: new Decimal(1000),
        vatRatePct: new Decimal(21),
        unitCostGrossArsSnapshot: new Decimal(1210),
      },
      {
        rawMaterialId: mpr2Id,
        sourceSupplierId: fakeSupplierId, // Violación de FK en bulk_lot_material_snapshots_source_supplier_id_fkey
        sourceCurrency: 'ARS',
        sourceUnitPriceNet: new Decimal(2000),
        vatRatePct: new Decimal(21),
        unitCostGrossArsSnapshot: new Decimal(2420),
      },
    ];

    // Intentar fabricar 5 kg (hay suficiente stock de ambas MPR para pasar la pre-validación de stock)
    await assert.rejects(
      async () => {
        await factoryRepo.manufactureBulkLotAtomic({
          baseProductId,
          formulaVersionId,
          kgFabricated: new Decimal(5),
          costSnapshots,
        });
      },
      (err: any) => {
        assert.match(err.message, /foreign key|bulk_lot_material_snapshots/i);
        return true;
      }
    );

    // Verificar estado después del rollback tardío en PostgreSQL
    const { count: opsAfter } = await supabase.from('business_operations').select('*', { count: 'exact', head: true });
    const { count: lotsAfter } = await supabase.from('bulk_lots').select('*', { count: 'exact', head: true });
    const { count: snapsAfter } = await supabase.from('bulk_lot_material_snapshots').select('*', { count: 'exact', head: true });
    const { count: mfasAfter } = await supabase.from('factory_movements').select('*', { count: 'exact', head: true });
    const { count: mstsAfter } = await supabase.from('stock_movements').select('*', { count: 'exact', head: true });
    const bal1After = await stockRepo.getBalance(mpr1Id);
    const bal2After = await stockRepo.getBalance(mpr2Id);

    assert.strictEqual(opsAfter, opsBefore, 'Cero business_operations residuales');
    assert.strictEqual(lotsAfter, lotsBefore, 'Cero bulk_lots residuales');
    assert.strictEqual(snapsAfter, snapsBefore, 'Cero snapshots residuales');
    assert.strictEqual(mstsAfter, mstsBefore, 'Cero stock_movements residuales');
    assert.strictEqual(mfasAfter, mfasBefore, 'Cero factory_movements residuales');
    assert.ok(bal1After.eq(bal1Before), `Saldo MPR1 intacto: ${bal1After} === ${bal1Before}`);
    assert.ok(bal2After.eq(bal2Before), `Saldo MPR2 intacto: ${bal2After} === ${bal2Before}`);
  });
});
