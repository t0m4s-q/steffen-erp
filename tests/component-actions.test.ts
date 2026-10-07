import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { Decimal } from '../src/domain/decimal';
import { serializeComponent } from '../src/actions/master-item.dto';
import type { MasterItemWithCostAndBalance } from '../src/services/master-item.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Bloque UI-4 Componentes (COM) — Integración, DTOs, reglas enteras y contratos reales', async (t) => {
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const createdStockItemIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdOperationIds: string[] = [];

  t.after(async () => {
    // Limpieza
    for (const itemId of createdStockItemIds) {
      await serverClient.from('stock_movements').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', itemId);
      await serverClient.from('supplier_items').delete().eq('stock_item_id', itemId);
      await serverClient.from('components').delete().eq('stock_item_id', itemId);
      await serverClient.from('stock_items').delete().eq('id', itemId);
    }
    for (const opId of createdOperationIds) {
      await serverClient.from('business_operations').delete().eq('id', opId);
    }
    for (const supId of createdSupplierIds) {
      await serverClient.from('financial_accounts').delete().eq('supplier_id', supId);
      await serverClient.from('suppliers').delete().eq('id', supId);
    }
  });

  // 1. Crear proveedor de prueba activo
  const { data: supData, error: supErr } = await (serverClient.rpc as any)('create_supplier_with_account', {
    p_name: `Proveedor Test COM ${Date.now()}`,
    p_currency_code: 'ARS',
  });
  assert.ifError(supErr);
  createdSupplierIds.push(supData.id);

  await t.test('1. serializeComponent entrega estrictamente números enteros para cantidades de unidades', () => {
    const mockItem: MasterItemWithCostAndBalance = {
      id: 'mock-uuid',
      code: 'COM0042',
      itemType: 'COM',
      name: 'Válvula Spray 24/410',
      unitType: 'UNIT',
      stockMinimum: new Decimal('100.000'),
      active: true,
      createdDate: '2026-10-07',
      createdAt: '2026-10-07T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z',
      balance: new Decimal('25.000'),
      currentTheoreticalCostGrossArs: new Decimal('121.00'),
      referenceSupplierId: 'sup-1',
      referenceSupplierCode: 'PRV0001',
      referenceSupplierName: 'Envases S.A.',
      referenceCurrency: 'ARS',
      referencePriceNet: new Decimal('100.00'),
      referencePriceUpdatedAt: '2026-10-07T00:00:00Z',
    };

    const dto = serializeComponent(mockItem);

    assert.strictEqual(dto.code, 'COM0042');
    assert.strictEqual(dto.name, 'Válvula Spray 24/410');
    assert.strictEqual(typeof dto.stockMinimumUnits, 'number');
    assert.strictEqual(dto.stockMinimumUnits, 100);
    assert.strictEqual(Number.isInteger(dto.stockMinimumUnits), true);

    assert.strictEqual(typeof dto.stockCurrentUnits, 'number');
    assert.strictEqual(dto.stockCurrentUnits, 25);
    assert.strictEqual(Number.isInteger(dto.stockCurrentUnits), true);

    assert.strictEqual(dto.isBelowMinimum, true); // 25 < 100
    assert.strictEqual(dto.stockRatio, '0.25');
    assert.strictEqual(dto.quotedPriceNet, '100');
    assert.strictEqual(dto.theoreticalCostGrossArs, '121');

    // Inconsistencia en stock mínimo fraccional (ej: 100.5) debe fallar explícitamente y no truncar silenciosamente
    assert.throws(
      () => {
        serializeComponent({
          ...mockItem,
          stockMinimum: new Decimal('100.5'),
        });
      },
      /Inconsistencia de datos en componente COM0042.*stock mínimo debe ser un entero exacto/,
      'Debe lanzar error ante stock mínimo fraccional en componente'
    );

    // Inconsistencia en balance fraccional (ej: 25.75) debe fallar explícitamente y no truncar silenciosamente
    assert.throws(
      () => {
        serializeComponent({
          ...mockItem,
          balance: new Decimal('25.75'),
        });
      },
      /Inconsistencia de datos en componente COM0042.*stock actual \(balance\) debe ser un entero exacto/,
      'Debe lanzar error ante balance fraccional en componente'
    );
  });

  await t.test('2. create_master_item para COM crea registro COMxxxx, tabla components, balance y cotización atómica', async () => {
    const { data: comData, error: comErr } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: `Componente Test E2E ${Date.now()}`,
      p_stock_minimum: 150,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 45.5,
      p_initial_stock: 30,
    });

    assert.ifError(comErr);
    assert.ok(comData, 'Debe devolver datos del ítem creado');
    assert.ok(comData.code.startsWith('COM'), `El código debe comenzar con COM: ${comData.code}`);
    assert.strictEqual(comData.unit_type, 'UNIT');
    createdStockItemIds.push(comData.id);

    // Verificar tabla stock_items
    const { data: itemRow, error: itemErr } = await serverClient
      .from('stock_items')
      .select('*')
      .eq('id', comData.id)
      .single();
    assert.ifError(itemErr);
    assert.strictEqual(itemRow.item_type, 'COM');
    assert.strictEqual(itemRow.unit_type, 'UNIT');
    assert.strictEqual(Number(itemRow.stock_minimum), 150);

    // Verificar tabla components (subtipo)
    const { data: compRow, error: compErr } = await serverClient
      .from('components')
      .select('*')
      .eq('stock_item_id', comData.id)
      .single();
    assert.ifError(compErr);
    assert.ok(compRow, 'Debe existir registro en la tabla components');

    // Verificar saldo en stock_balances = 30
    const { data: balRow, error: balErr } = await serverClient
      .from('stock_balances')
      .select('*')
      .eq('stock_item_id', comData.id)
      .single();
    assert.ifError(balErr);
    assert.strictEqual(Number(balRow.quantity), 30);

    // Verificar supplier_items
    const { data: quoteRow, error: quoteErr } = await serverClient
      .from('supplier_items')
      .select('*')
      .eq('stock_item_id', comData.id)
      .eq('supplier_id', supData.id)
      .single();
    assert.ifError(quoteErr);
    assert.strictEqual(Number(quoteRow.quoted_unit_price_net), 45.5);
    assert.strictEqual(quoteRow.active, true);
  });

  await t.test('3. Rechazo estricto de números decimales en stock para COM', async () => {
    // Min decimal
    const { data: d1, error: e1 } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: 'COM Decimal Min Test',
      p_stock_minimum: 10.5,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 10,
    });
    assert.ok(e1, 'Debe fallar ante stock mínimo decimal');
    assert.strictEqual(d1, null);

    // Inicial decimal
    const { data: d2, error: e2 } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: 'COM Decimal Init Test',
      p_stock_minimum: 10,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 10,
      p_initial_stock: 0.5,
    });
    assert.ok(e2, 'Debe fallar ante stock inicial decimal');
    assert.strictEqual(d2, null);
  });

  await t.test('4. Modificación de metadatos y cotización de COM y desactivación/reactivación', async () => {
    // 1. Crear COM sin stock inicial
    const { data: newCom, error: createErr } = await (serverClient.rpc as any)('create_master_item', {
      p_item_type: 'COM',
      p_name: `COM Para Modificar ${Date.now()}`,
      p_stock_minimum: 50,
      p_initial_supplier_id: supData.id,
      p_initial_quoted_price_net: 200,
      p_initial_stock: 0,
    });
    assert.ifError(createErr);
    createdStockItemIds.push(newCom.id);

    // 2. Modificar metadatos (nombre y stock mínimo)
    const { data: updatedItem, error: updateErr } = await serverClient
      .from('stock_items')
      .update({
        name: 'COM Modificado Exitosamente',
        stock_minimum: 80,
      })
      .eq('id', newCom.id)
      .select('*')
      .single();
    assert.ifError(updateErr);
    assert.strictEqual(updatedItem.name, 'COM Modificado Exitosamente');
    assert.strictEqual(Number(updatedItem.stock_minimum), 80);

    // 3. Desactivar y reactivar
    const { error: deactErr } = await serverClient
      .from('stock_items')
      .update({ active: false })
      .eq('id', newCom.id);
    assert.ifError(deactErr);

    const { data: inactRow } = await serverClient
      .from('stock_items')
      .select('active')
      .eq('id', newCom.id)
      .single();
    assert.strictEqual(inactRow?.active, false);

    const { error: reactErr } = await serverClient
      .from('stock_items')
      .update({ active: true })
      .eq('id', newCom.id);
    assert.ifError(reactErr);

    const { data: actRow } = await serverClient
      .from('stock_items')
      .select('active')
      .eq('id', newCom.id)
      .single();
    assert.strictEqual(actRow?.active, true);
  });
});
