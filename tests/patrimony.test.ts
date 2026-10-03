import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { PatrimonyDomainService } from '../src/services/patrimony.service';
import { PatrimonyRepository } from '../src/repositories/patrimony.repository';
import { DomainError } from '../src/domain/errors';
import { Decimal } from '../src/domain/decimal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Servicio base patrimonial — Pruebas de dominio, atomicidad y rollback', async (t) => {
  const patrimonyRepo = new PatrimonyRepository(supabase);
  const patrimonyService = new PatrimonyDomainService(patrimonyRepo);

  const testTag = `PAT_${Date.now()}`;
  let operationId: string;
  let customerId: string;
  let customerAccountId: string;
  let steffenAccountId: string;
  let movementId: string;

  t.before(async () => {
    // 1. Obtener ID de Caja Steffen
    const { data: steffenAcc } = await supabase
      .from('financial_accounts')
      .select('id, current_balance')
      .eq('account_type', 'CASH_STEFFEN')
      .single();
    steffenAccountId = steffenAcc!.id;

    // 2. Crear cliente de prueba y su cuenta corriente CUSTOMER_RECEIVABLE
    const { data: customer } = await supabase
      .from('customers')
      .insert({
        code: `CLI_${testTag}`,
        name: `Cliente Prueba ${testTag}`,
      })
      .select('id')
      .single();
    customerId = customer!.id;

    const { data: custAcc } = await supabase
      .from('financial_accounts')
      .insert({
        account_type: 'CUSTOMER_RECEIVABLE',
        name: `Cuenta Corriente ${testTag}`,
        customer_id: customerId,
        current_balance: 10000.0, // Cliente debe $10.000 inicialmente
      })
      .select('id')
      .single();
    customerAccountId = custAcc!.id;

    // 3. Crear operación de prueba
    const { data: op } = await supabase
      .from('business_operations')
      .insert({
        operation_type: 'CUSTOMER_PAYMENT',
        business_date: '2026-10-02',
      })
      .select('id')
      .single();
    operationId = op!.id;
  });

  t.after(async () => {
    // Limpieza
    if (movementId) {
      await supabase.from('financial_entries').delete().eq('patrimonial_movement_id', movementId);
      await supabase.from('patrimonial_movements').delete().eq('id', movementId);
    }
    await supabase.from('financial_accounts').delete().eq('id', customerAccountId);
    await supabase.from('customers').delete().eq('id', customerId);
    await supabase.from('business_operations').delete().eq('id', operationId);
  });

  await t.test('1. Consulta de saldo inicial de cuenta financiera con Decimal', async () => {
    const balance = await patrimonyService.getFinancialAccountBalance(customerAccountId);
    assert.ok(balance instanceof Decimal);
    assert.strictEqual(balance.toString(), '10000');
  });

  await t.test('2. MOV con dos o más financial_entries y actualización atómica de balances', async () => {
    // Pago de Cliente: Cliente abona $4.000
    // - Cuenta corriente del Cliente reduce su deuda: delta -4000 (pasa de 10.000 a 6.000)
    // - Caja Steffen ingresa efectivo: delta +4000
    const initialSteffenBalance = await patrimonyService.getFinancialAccountBalance(steffenAccountId);

    const result = await patrimonyService.postPatrimonialMovement({
      operationId,
      movementType: 'PAGO_CLIENTE',
      description: 'Cobro de cliente a cuenta corriente',
      amountArs: 4000.0,
      entries: [
        { financialAccountId: customerAccountId, deltaArs: -4000.0 },
        { financialAccountId: steffenAccountId, deltaArs: 4000.0 },
      ],
    });

    movementId = result.movementId;
    assert.ok(result.code.startsWith('MOV'));

    // Verificar nuevo saldo de cuenta corriente cliente
    const newCustomerBalance = await patrimonyService.getFinancialAccountBalance(customerAccountId);
    assert.strictEqual(newCustomerBalance.toString(), '6000');

    // Verificar nuevo saldo de Caja Steffen
    const newSteffenBalance = await patrimonyService.getFinancialAccountBalance(steffenAccountId);
    assert.strictEqual(newSteffenBalance.toString(), initialSteffenBalance.plus(4000).toString());

    // Revertir el efecto en Caja Steffen para dejar los saldos limpios
    await supabase
      .from('financial_accounts')
      .update({ current_balance: initialSteffenBalance.toNumber() })
      .eq('id', steffenAccountId);
  });

  await t.test('3. Rechaza deltaArs = 0 o entradas vacías', async () => {
    await assert.rejects(
      async () =>
        await patrimonyService.postPatrimonialMovement({
          operationId,
          movementType: 'PAGO_CLIENTE',
          description: 'Intento inválido',
          amountArs: 100.0,
          entries: [],
        }),
      (err) => err instanceof DomainError
    );

    await assert.rejects(
      async () =>
        await patrimonyService.postPatrimonialMovement({
          operationId,
          movementType: 'PAGO_CLIENTE',
          description: 'Intento inválido con delta cero',
          amountArs: 100.0,
          entries: [{ financialAccountId: customerAccountId, deltaArs: 0 }],
        }),
      (err) => err instanceof DomainError
    );
  });

  await t.test('4. Rollback forzado de Patrimonio: si una entrada falla, ninguna cuenta cambia y no queda MOV', async () => {
    const custBalanceBefore = await patrimonyService.getFinancialAccountBalance(customerAccountId);
    const steffenBalanceBefore = await patrimonyService.getFinancialAccountBalance(steffenAccountId);

    const { count: movCountBefore } = await supabase
      .from('patrimonial_movements')
      .select('*', { count: 'exact', head: true });

    const fakeAccountId = '00000000-0000-0000-0000-000000000000';

    // Intentamos un movimiento donde la primera entrada es válida pero la segunda es una cuenta inexistente
    await assert.rejects(
      async () =>
        await patrimonyService.postPatrimonialMovement({
          operationId,
          movementType: 'PAGO_CLIENTE',
          description: 'Movimiento con fallo forzado en segunda cuenta',
          amountArs: 1000.0,
          entries: [
            { financialAccountId: customerAccountId, deltaArs: -1000.0 }, // Válida
            { financialAccountId: fakeAccountId, deltaArs: 1000.0 }, // Inválida -> lanza excepción en loop plpgsql
          ],
        }),
      (err) => err instanceof DomainError
    );

    // Verificar que ninguna cuenta sufrió modificación
    const custBalanceAfter = await patrimonyService.getFinancialAccountBalance(customerAccountId);
    const steffenBalanceAfter = await patrimonyService.getFinancialAccountBalance(steffenAccountId);

    assert.strictEqual(custBalanceAfter.toString(), custBalanceBefore.toString(), 'La cuenta 1 no debe cambiar su saldo');
    assert.strictEqual(steffenBalanceAfter.toString(), steffenBalanceBefore.toString(), 'La cuenta 2 no debe cambiar su saldo');

    // Verificar que no quedó ningún movimiento MOV registrado
    const { count: movCountAfter } = await supabase
      .from('patrimonial_movements')
      .select('*', { count: 'exact', head: true });
    assert.strictEqual(movCountAfter, movCountBefore, 'No debe quedar ningún MOV huérfano tras el rollback');
  });
});
