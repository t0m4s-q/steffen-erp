import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { StockDomainService } from '../src/services/stock.service';
import { StockRepository } from '../src/repositories/stock.repository';
import { InvalidStockUnitPrecisionError, DomainError } from '../src/domain/errors';
import { Decimal } from '../src/domain/decimal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Servicio base de stock — Pruebas de dominio, atomicidad y rollback', async (t) => {
  const stockRepo = new StockRepository(supabase);
  const stockService = new StockDomainService(stockRepo);

  const testTag = `STK_${Date.now()}`;
  let mprId: string;
  let comId: string;
  let operationId: string;

  t.before(async () => {
    // 1. Crear operación de negocio para asociar movimientos
    const { data: op } = await supabase
      .from('business_operations')
      .insert({
        operation_type: 'STOCK_ADJUSTMENT',
        business_date: '2026-10-02',
      })
      .select('id')
      .single();
    operationId = op!.id;

    // 2. Crear ítem MPR (KG)
    const { data: mprItem } = await supabase
      .from('stock_items')
      .insert({
        code: `MPR_${testTag}`,
        item_type: 'MPR',
        name: `Materia Prima Test ${testTag}`,
        unit_type: 'KG',
        stock_minimum: 10.0,
      })
      .select('id')
      .single();
    mprId = mprItem!.id;
    await supabase.from('raw_materials').insert({ stock_item_id: mprId });

    // 3. Crear ítem COM (UNIT)
    const { data: comItem } = await supabase
      .from('stock_items')
      .insert({
        code: `COM_${testTag}`,
        item_type: 'COM',
        name: `Componente Test ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 20,
      })
      .select('id')
      .single();
    comId = comItem!.id;
    await supabase.from('components').insert({ stock_item_id: comId });
  });

  t.after(async () => {
    // Limpieza
    await supabase.from('stock_movements').delete().in('stock_item_id', [mprId, comId]);
    await supabase.from('stock_balances').delete().in('stock_item_id', [mprId, comId]);
    await supabase.from('raw_materials').delete().eq('stock_item_id', mprId);
    await supabase.from('components').delete().eq('stock_item_id', comId);
    await supabase.from('stock_items').delete().in('id', [mprId, comId]);
    await supabase.from('business_operations').delete().eq('id', operationId);
  });

  await t.test('1. MST de entrada aumenta el saldo de stock_balances atómicamente', async () => {
    const initialBalance = await stockService.getStockBalance(comId);
    assert.strictEqual(initialBalance.toString(), '0');

    const result = await stockService.applyStockMovement({
      operationId,
      stockItemId: comId,
      movementType: 'AJUSTE',
      quantityDelta: 50,
      description: 'Ingreso inicial de prueba',
    });

    assert.ok(result.code.startsWith('MST'));
    assert.strictEqual(result.previousBalance.toString(), '0');
    assert.strictEqual(result.newBalance.toString(), '50');

    const balanceInDb = await stockService.getStockBalance(comId);
    assert.strictEqual(balanceInDb.toString(), '50');
  });

  await t.test('2. MST de salida descuenta el saldo de stock_balances atómicamente', async () => {
    const result = await stockService.applyStockMovement({
      operationId,
      stockItemId: comId,
      movementType: 'AJUSTE',
      quantityDelta: -20,
      description: 'Salida de prueba',
    });

    assert.strictEqual(result.previousBalance.toString(), '50');
    assert.strictEqual(result.newBalance.toString(), '30');

    const balanceInDb = await stockService.getStockBalance(comId);
    assert.strictEqual(balanceInDb.toString(), '30');
  });

  await t.test('3. Rechazo de unidades decimales para COM/PRO (validación de dominio)', async () => {
    await assert.rejects(
      async () =>
        await stockService.applyStockMovement({
          operationId,
          stockItemId: comId,
          movementType: 'AJUSTE',
          quantityDelta: 2.5,
          description: 'Intento de decimal en unidad',
        }),
      (err) => err instanceof InvalidStockUnitPrecisionError
    );
  });

  await t.test('4. Precisión de MPR admite hasta 3 decimales (kg) con Decimal exacto', async () => {
    const result = await stockService.applyStockMovement({
      operationId,
      stockItemId: mprId,
      movementType: 'AJUSTE',
      quantityDelta: '12.345',
      description: 'Ingreso MPR con 3 decimales',
    });

    assert.strictEqual(result.newBalance.toString(), '12.345');
    const balanceInDb = await stockService.getStockBalance(mprId);
    assert.strictEqual(balanceInDb.toString(), '12.345');

    // Salida parcial de 2.100 kg
    const resultOut = await stockService.applyStockMovement({
      operationId,
      stockItemId: mprId,
      movementType: 'AJUSTE',
      quantityDelta: '-2.1',
      description: 'Salida MPR',
    });
    assert.strictEqual(resultOut.newBalance.toString(), '10.245');
  });

  await t.test('5. Rollback forzado de Stock: si la transacción falla, no queda MST ni cambia el balance', async () => {
    // Tomamos el balance actual de comId
    const balanceBefore = await stockService.getStockBalance(comId);

    // Contamos movimientos de stock existentes antes del intento
    const { count: countBefore } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);

    // Forzamos un fallo en la función RPC enviando un operationId inexistente que viole la foreign key en PostgreSQL
    const fakeOperationId = '00000000-0000-0000-0000-000000000000';

    await assert.rejects(
      async () =>
        await stockService.applyStockMovement({
          operationId: fakeOperationId,
          stockItemId: comId,
          movementType: 'AJUSTE',
          quantityDelta: 100,
          description: 'Intento con foreign key inválida para forzar rollback',
        }),
      (err) => err instanceof DomainError
    );

    // Verificar que el balance de stock no cambió absolutamente nada
    const balanceAfter = await stockService.getStockBalance(comId);
    assert.strictEqual(balanceAfter.toString(), balanceBefore.toString(), 'El saldo no debe cambiar tras un rollback');

    // Verificar que no se insertó ningún movimiento parcial
    const { count: countAfter } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('stock_item_id', comId);
    assert.strictEqual(countAfter, countBefore, 'No debe quedar ningún registro MST huérfano');
  });
});
