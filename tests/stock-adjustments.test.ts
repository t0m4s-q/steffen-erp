import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { StockDomainService } from '../src/services/stock.service';
import { StockRepository } from '../src/repositories/stock.repository';
import { InvalidStockUnitPrecisionError, DomainError } from '../src/domain/errors';
import { Decimal } from '../src/domain/decimal';
import type { Database } from '../src/database/types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Fase 5 — Stock: Ajustes manuales, trazabilidad, prohibición de stock negativo, saldos batch y precisión', async (t) => {
  const stockRepo = new StockRepository(supabase);
  const stockService = new StockDomainService(stockRepo);

  const testTag = `ADJ_${Date.now()}`;
  let mprId: string;
  let comId: string;
  let proId: string;
  let bpId: string;
  const createdOps: string[] = [];

  t.before(async () => {
    // 1. Crear ítem MPR (KG)
    const { data: mprItem } = await supabase
      .from('stock_items')
      .insert({
        code: `MPR_${testTag}`,
        item_type: 'MPR',
        name: `Materia Prima Ajuste ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 15.0,
      })
      .select('id')
      .single();
    mprId = mprItem!.id;
    await supabase.from('raw_materials').insert({ stock_item_id: mprId });

    // 2. Crear ítem COM (UNIT)
    const { data: comItem } = await supabase
      .from('stock_items')
      .insert({
        code: `COM_${testTag}`,
        item_type: 'COM',
        name: `Componente Ajuste ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 30,
      })
      .select('id')
      .single();
    comId = comItem!.id;
    await supabase.from('components').insert({ stock_item_id: comId });

    // 3. Crear ítem PRO (UNIT) con base_products
    const { data: bp } = await supabase
      .from('base_products')
      .insert({
        code: `BP_${testTag}`,
        name: `Base Product ${testTag}`,
      })
      .select('id')
      .single();
    bpId = bp!.id;

    const { data: proItem } = await supabase
      .from('stock_items')
      .insert({
        code: `PRO_${testTag}`,
        item_type: 'PRO',
        name: `Producto Final Ajuste ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    proId = proItem!.id;

    await supabase.from('products').insert({
      stock_item_id: proId,
      base_product_id: bpId,
      presentation: '250ml',
      weight_kg: 0.25,
    });
  });

  t.after(async () => {
    // Limpieza profunda de trazabilidad y datos de prueba
    if (createdOps.length > 0) {
      await supabase.from('stock_movements').delete().in('operation_id', createdOps);
      await supabase.from('stock_adjustment_items').delete().in('stock_item_id', [mprId, comId, proId]);
      await supabase.from('stock_adjustments').delete().in('operation_id', createdOps);
      await supabase.from('business_operations').delete().in('id', createdOps);
    }
    await supabase.from('stock_movements').delete().in('stock_item_id', [mprId, comId, proId]);
    await supabase.from('stock_balances').delete().in('stock_item_id', [mprId, comId, proId]);
    await supabase.from('raw_materials').delete().eq('stock_item_id', mprId);
    await supabase.from('components').delete().eq('stock_item_id', comId);
    await supabase.from('products').delete().eq('stock_item_id', proId);
    await supabase.from('base_products').delete().eq('id', bpId);
    await supabase.from('stock_items').delete().in('id', [mprId, comId, proId]);
  });

  await t.test('1. Ajuste positivo de MPR: cabecera + ítem + MST + balance actualizado', async () => {
    const balBefore = await stockService.getStockBalance(mprId);
    assert.strictEqual(balBefore.toString(), '0');

    const result = await stockService.adjustStock({
      stockItemId: mprId,
      quantityDelta: '25.500',
      reason: 'Conteo físico de inventario inicial',
      businessDate: '2026-10-08',
    });
    createdOps.push(result.operationId);

    assert.ok(result.operationId, 'Debe generar business_operation');
    assert.ok(result.adjustmentId, 'Debe generar cabecera stock_adjustments');
    assert.ok(result.movementId, 'Debe generar stock_movement');
    assert.ok(result.movementCode.startsWith('MST'), `Código debe iniciar con MST: ${result.movementCode}`);
    assert.strictEqual(result.previousBalance.toString(), '0');
    assert.strictEqual(result.newBalance.toString(), '25.5');

    // Verificar en BD saldo actualizado
    const balAfter = await stockService.getStockBalance(mprId);
    assert.strictEqual(balAfter.toString(), '25.5');

    // Verificar registro en stock_adjustments
    const { data: adjRow } = await supabase
      .from('stock_adjustments')
      .select('reason')
      .eq('id', result.adjustmentId)
      .single();
    assert.strictEqual(adjRow?.reason, 'Conteo físico de inventario inicial');
  });

  await t.test('2. Ajuste negativo de MPR dentro del saldo: descuenta stock correctamente', async () => {
    const result = await stockService.adjustStock({
      stockItemId: mprId,
      quantityDelta: '-5.250',
      reason: 'Derrame en depósito',
    });
    createdOps.push(result.operationId);

    assert.strictEqual(result.previousBalance.toString(), '25.5');
    assert.strictEqual(result.newBalance.toString(), '20.25');

    const balAfter = await stockService.getStockBalance(mprId);
    assert.strictEqual(balAfter.toString(), '20.25');
  });

  await t.test('3. Prohibición de stock negativo en PRO: saldo 10 + salida -10 -> 0; salida -11 -> rechazado', async () => {
    // 1. Ingreso de 10 unidades a PRO
    const resIn = await stockService.adjustStock({
      stockItemId: proId,
      quantityDelta: '10',
      reason: 'Producción inicial PRO para prueba',
    });
    createdOps.push(resIn.operationId);
    assert.strictEqual(resIn.newBalance.toString(), '10');

    // 2. Salida de 10 unidades (deja saldo en 0 exactamente)
    const resOut = await stockService.adjustStock({
      stockItemId: proId,
      quantityDelta: '-10',
      reason: 'Despacho total disponible',
    });
    createdOps.push(resOut.operationId);
    assert.strictEqual(resOut.newBalance.toString(), '0');

    const balZero = await stockService.getStockBalance(proId);
    assert.strictEqual(balZero.toString(), '0');

    // Contadores antes del rechazo
    const { count: opsBefore } = await supabase
      .from('business_operations')
      .select('*', { count: 'exact', head: true })
      .eq('operation_type', 'STOCK_ADJUSTMENT');
    const { count: mvtsBefore } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', proId);
    const { count: adjsBefore } = await supabase
      .from('stock_adjustments')
      .select('*', { count: 'exact', head: true });

    // 3. Intento de salida de -11 unidades cuando el saldo es 0 (o superior al disponible)
    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: proId,
          quantityDelta: '-11',
          reason: 'Intento de venta que superaría el stock disponible',
        });
      },
      (err) => err instanceof DomainError && /Stock insuficiente/.test(err.message)
    );

    // 4. Verificaciones estrictas tras el rechazo:
    // - balance sin cambios
    const balAfter = await stockService.getStockBalance(proId);
    assert.strictEqual(balAfter.toString(), '0', 'Balance de PRO debe permanecer en 0 tras rechazo');

    // - 0 MST nuevo
    const { count: mvtsAfter } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', proId);
    assert.strictEqual(mvtsAfter, mvtsBefore, '0 movimientos MST generados ante rechazo');

    // - 0 operación parcial
    const { count: opsAfter } = await supabase
      .from('business_operations')
      .select('*', { count: 'exact', head: true })
      .eq('operation_type', 'STOCK_ADJUSTMENT');
    assert.strictEqual(opsAfter, opsBefore, '0 business_operations creadas ante rechazo');

    // - 0 adjustment residual
    const { count: adjsAfter } = await supabase
      .from('stock_adjustments')
      .select('*', { count: 'exact', head: true });
    assert.strictEqual(adjsAfter, adjsBefore, '0 stock_adjustments residuales ante rechazo');
  });

  await t.test('4. Prohibición de stock negativo en COM: saldo 5 + salida -5 -> 0; salida -6 -> rechazado', async () => {
    // 1. Ingreso de 5 unidades a COM
    const resIn = await stockService.adjustStock({
      stockItemId: comId,
      quantityDelta: '5',
      reason: 'Ingreso inicial COM',
    });
    createdOps.push(resIn.operationId);
    assert.strictEqual(resIn.newBalance.toString(), '5');

    // 2. Salida de 5 unidades -> saldo 0
    const resOut = await stockService.adjustStock({
      stockItemId: comId,
      quantityDelta: '-5',
      reason: 'Consumo total COM',
    });
    createdOps.push(resOut.operationId);
    assert.strictEqual(resOut.newBalance.toString(), '0');

    // Contadores antes del rechazo
    const { count: mvtsBefore } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);

    // 3. Intento de salida de -6 unidades
    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: comId,
          quantityDelta: '-6',
          reason: 'Intento de consumo excesivo en COM',
        });
      },
      (err) => err instanceof DomainError && /Stock insuficiente/.test(err.message)
    );

    // Verificar balance sin cambios y 0 MST
    const balAfter = await stockService.getStockBalance(comId);
    assert.strictEqual(balAfter.toString(), '0');

    const { count: mvtsAfter } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);
    assert.strictEqual(mvtsAfter, mvtsBefore, '0 MST creados ante rechazo en COM');
  });

  await t.test('5. Prohibición de stock negativo en MPR: saldo 1.250 kg + salida -1.250 -> 0; salida -1.251 -> rechazado', async () => {
    // Llevar mprId de 20.25 a 1.250 primero
    const resPrep = await stockService.adjustStock({
      stockItemId: mprId,
      quantityDelta: '-19.000',
      reason: 'Ajuste preparatorio para prueba exacta de kg',
    });
    createdOps.push(resPrep.operationId);
    assert.strictEqual(resPrep.newBalance.toString(), '1.25');

    // 1. Salida exacta de -1.250 kg -> saldo 0
    const resZero = await stockService.adjustStock({
      stockItemId: mprId,
      quantityDelta: '-1.250',
      reason: 'Consumo total de lote MPR',
    });
    createdOps.push(resZero.operationId);
    assert.strictEqual(resZero.newBalance.toString(), '0');

    const balZero = await stockService.getStockBalance(mprId);
    assert.strictEqual(balZero.toString(), '0');

    // Contadores antes del rechazo
    const { count: mvtsBefore } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', mprId);

    // 2. Intento de salida de -1.251 kg cuando hay 0 disponible
    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: mprId,
          quantityDelta: '-1.251',
          reason: 'Intento de salida por encima del saldo en kg',
        });
      },
      (err) => err instanceof DomainError && /Stock insuficiente/.test(err.message)
    );

    // Verificaciones
    const balAfter = await stockService.getStockBalance(mprId);
    assert.strictEqual(balAfter.toString(), '0');

    const { count: mvtsAfter } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', mprId);
    assert.strictEqual(mvtsAfter, mvtsBefore, '0 MST creados ante rechazo en MPR');
  });

  await t.test('6. Precisión: rechazo de decimales en ítems tipo UNIT (COM)', async () => {
    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: comId,
          quantityDelta: '4.5',
          reason: 'Intento de decimal en unidades',
        });
      },
      (err) => err instanceof InvalidStockUnitPrecisionError
    );
  });

  await t.test('7. Precisión: rechazo de más de 3 decimales en ítems tipo KG (MPR)', async () => {
    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: mprId,
          quantityDelta: '1.2345',
          reason: 'Intento de 4 decimales en kg',
        });
      },
      (err) => err instanceof InvalidStockUnitPrecisionError
    );
  });

  await t.test('8. Validación: rechazo de cantidad 0 y motivo vacío', async () => {
    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: comId,
          quantityDelta: '0',
          reason: 'Ajuste cero',
        });
      },
      (err) => err instanceof DomainError
    );

    await assert.rejects(
      async () => {
        await stockService.adjustStock({
          stockItemId: comId,
          quantityDelta: '10',
          reason: '   ',
        });
      },
      (err) => err instanceof DomainError
    );
  });

  await t.test('9. getBatchBalances() carga saldos consolidados en Map O(1)', async () => {
    const balances = await stockService.getBatchBalances();
    assert.ok(balances instanceof Map);
    assert.ok(balances.has(mprId));
    assert.strictEqual(balances.get(mprId)?.toString(), '0');
  });

  await t.test('10. listRecentMovements() incluye trazabilidad e información del ítem', async () => {
    const movements = await stockService.listRecentMovements(10);
    assert.ok(Array.isArray(movements));
    assert.ok(movements.length > 0);

    const first = movements[0];
    assert.ok(first.code.startsWith('MST'));
    assert.ok(first.movementType);
    assert.ok(first.quantityDelta instanceof Decimal);
    assert.ok(first.createdAt);
  });

  await t.test('11. Rollback autoritativo en PostgreSQL: rechazo por stock insuficiente en RPC revierte business_operations, stock_adjustments, items, MST y balances sin residuos', async () => {
    const balBefore = await stockService.getStockBalance(comId);

    // Contar registros antes del intento fallido
    const { count: opsBefore } = await supabase
      .from('business_operations')
      .select('*', { count: 'exact', head: true })
      .eq('operation_type', 'STOCK_ADJUSTMENT');

    const { count: adjsBefore } = await supabase
      .from('stock_adjustments')
      .select('*', { count: 'exact', head: true });

    const { count: itemsBefore } = await supabase
      .from('stock_adjustment_items')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);

    const { count: mvtsBefore } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);

    // Invocar directamente la RPC en PostgreSQL intentando descontar saldo cuando hay 0
    const { error: rpcErr } = await supabase.rpc('adjust_stock_atomic', {
      p_stock_item_id: comId,
      p_quantity_delta: -50,
      p_reason: 'Intento forzado de saldo negativo directo a PostgreSQL',
    });

    assert.ok(rpcErr, 'La RPC en PostgreSQL debe arrojar error por stock insuficiente');
    assert.match(rpcErr.message, /Stock insuficiente/);

    // 1. Verificar 0 operaciones residuales
    const { count: opsAfter } = await supabase
      .from('business_operations')
      .select('*', { count: 'exact', head: true })
      .eq('operation_type', 'STOCK_ADJUSTMENT');
    assert.strictEqual(opsAfter, opsBefore, 'business_operations: 0 registros residuales tras rollback');

    // 2. Verificar 0 cabeceras residuales
    const { count: adjsAfter } = await supabase
      .from('stock_adjustments')
      .select('*', { count: 'exact', head: true });
    assert.strictEqual(adjsAfter, adjsBefore, 'stock_adjustments: 0 registros residuales tras rollback');

    // 3. Verificar 0 líneas residuales
    const { count: itemsAfter } = await supabase
      .from('stock_adjustment_items')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);
    assert.strictEqual(itemsAfter, itemsBefore, 'stock_adjustment_items: 0 registros residuales tras rollback');

    // 4. Verificar 0 movimientos MST residuales
    const { count: mvtsAfter } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);
    assert.strictEqual(mvtsAfter, mvtsBefore, 'stock_movements: 0 MST residuales tras rollback');

    // 5. Verificar saldo exactamente sin cambios
    const balAfter = await stockService.getStockBalance(comId);
    assert.strictEqual(balAfter.toString(), balBefore.toString(), 'stock_balances: saldo sin cambios tras rollback');
  });
});
