import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { StockDomainService } from '../src/services/stock.service';
import { StockRepository } from '../src/repositories/stock.repository';
import { PatrimonyDomainService } from '../src/services/patrimony.service';
import { PatrimonyRepository } from '../src/repositories/patrimony.repository';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Concurrencia — Protección de actualizaciones y bloqueo transaccional', async (t) => {
  const stockRepo = new StockRepository(supabase);
  const stockService = new StockDomainService(stockRepo);
  const patrimonyRepo = new PatrimonyRepository(supabase);
  const patrimonyService = new PatrimonyDomainService(patrimonyRepo);

  const testTag = `CNC_${Date.now()}`;
  let stockItemId: string;
  let operationId: string;
  let customerId: string;
  let testAccountId: string;

  t.before(async () => {
    // 1. Crear operación de prueba
    const { data: op } = await supabase
      .from('business_operations')
      .insert({
        operation_type: 'STOCK_ADJUSTMENT',
        business_date: '2026-10-02',
      })
      .select('id')
      .single();
    operationId = op!.id;

    // 2. Crear ítem COM de prueba
    const { data: item } = await supabase
      .from('stock_items')
      .insert({
        code: `COM_${testTag}`,
        item_type: 'COM',
        name: `Componente Concurrencia ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    stockItemId = item!.id;
    await supabase.from('components').insert({ stock_item_id: stockItemId });

    // 3. Crear cliente y su cuenta financiera CUSTOMER_RECEIVABLE
    const { data: cust } = await supabase
      .from('customers')
      .insert({
        code: `CLI_${testTag}`,
        name: `Cliente Concurrencia ${testTag}`,
      })
      .select('id')
      .single();
    customerId = cust!.id;

    const { data: acc } = await supabase
      .from('financial_accounts')
      .insert({
        account_type: 'CUSTOMER_RECEIVABLE',
        name: `Cuenta Concurrencia ${testTag}`,
        customer_id: customerId,
        current_balance: 0,
      })
      .select('id')
      .single();
    testAccountId = acc!.id;
  });

  t.after(async () => {
    // Limpieza
    await supabase.from('stock_movements').delete().eq('stock_item_id', stockItemId);
    await supabase.from('stock_balances').delete().eq('stock_item_id', stockItemId);
    await supabase.from('components').delete().eq('stock_item_id', stockItemId);
    await supabase.from('stock_items').delete().eq('id', stockItemId);

    const { data: entries } = await supabase
      .from('financial_entries')
      .select('patrimonial_movement_id')
      .eq('financial_account_id', testAccountId);

    if (entries && entries.length > 0) {
      const movIds = entries.map((e) => e.patrimonial_movement_id);
      await supabase.from('financial_entries').delete().in('patrimonial_movement_id', movIds);
      await supabase.from('patrimonial_movements').delete().in('id', movIds);
    }

    await supabase.from('financial_accounts').delete().eq('id', testAccountId);
    await supabase.from('customers').delete().eq('id', customerId);
    await supabase.from('business_operations').delete().eq('id', operationId);
  });

  await t.test('1. Movimientos de stock simultáneos sobre el mismo balance (sin pérdida de updates)', async () => {
    // Lanzamos 5 llamadas simultáneas concurrentes sumando 10 unidades cada una
    const concurrentCount = 5;
    const deltaEach = 10;
    const expectedFinalBalance = concurrentCount * deltaEach; // 50

    const promises = Array.from({ length: concurrentCount }, (_, i) =>
      stockService.applyStockMovement({
        operationId,
        stockItemId,
        movementType: 'AJUSTE',
        quantityDelta: deltaEach,
        description: `Ajuste concurrente #${i + 1}`,
      })
    );

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, concurrentCount);

    // Todos los códigos generados deben ser únicos
    const codes = results.map((r) => r.code);
    assert.strictEqual(new Set(codes).size, concurrentCount, 'No debe haber códigos MST duplicados');

    // El balance en la base debe ser exactamente 50
    const finalBalance = await stockService.getStockBalance(stockItemId);
    assert.strictEqual(
      finalBalance.toString(),
      expectedFinalBalance.toString(),
      'El balance final debe acumular exactamente todas las operaciones concurrentes sin pérdida de updates'
    );
  });

  await t.test('2. Movimientos patrimoniales simultáneos sobre la misma cuenta (bloqueo FOR UPDATE)', async () => {
    // Lanzamos 5 llamadas simultáneas concurrentes sumando $1.000 ARS cada una
    const concurrentCount = 5;
    const amountEach = 1000;
    const expectedFinalBalance = concurrentCount * amountEach; // 5000

    const promises = Array.from({ length: concurrentCount }, (_, i) =>
      patrimonyService.postPatrimonialMovement({
        operationId,
        movementType: 'VENTA',
        description: `Ingreso concurrente #${i + 1}`,
        amountArs: amountEach,
        entries: [{ financialAccountId: testAccountId, deltaArs: amountEach }],
      })
    );

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, concurrentCount);

    // Todos los códigos MOV deben ser únicos
    const codes = results.map((r) => r.code);
    assert.strictEqual(new Set(codes).size, concurrentCount, 'No debe haber códigos MOV duplicados');

    // El balance en la cuenta debe ser exactamente $5000
    const finalBalance = await patrimonyService.getFinancialAccountBalance(testAccountId);
    assert.strictEqual(
      finalBalance.toString(),
      expectedFinalBalance.toString(),
      'El saldo final de la cuenta debe acumular exactamente todas las operaciones sin pérdida de updates'
    );
  });
});
