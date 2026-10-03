import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { PricingService } from '../src/services/pricing.service';
import { ProductRepository } from '../src/repositories/product.repository';
import { NoPriceSnapshotFoundError } from '../src/domain/errors';
import { Decimal } from '../src/domain/decimal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Servicio de precio histórico — Snapshot inmutable de listas de precio con Decimal', async (t) => {
  const productRepo = new ProductRepository(supabase);
  const pricingService = new PricingService(productRepo);

  const testTag = `PRC_${Date.now()}`;
  let productId: string;
  let baseProductId: string;
  let priceListId: string;

  t.before(async () => {
    // 1. Obtener Lista Salón existente
    const { data: list } = await supabase
      .from('price_lists')
      .select('id')
      .eq('system_role', 'SALON_DEFAULT')
      .single();
    priceListId = list!.id;

    // 2. Crear Producto Base y Producto Terminado de prueba
    const { data: pba } = await supabase
      .from('base_products')
      .insert({
        code: `PBA_${testTag}`,
        name: `Base Test ${testTag}`,
      })
      .select('id')
      .single();
    baseProductId = pba!.id;

    const { data: itemPro } = await supabase
      .from('stock_items')
      .insert({
        code: `PRO_${testTag}`,
        item_type: 'PRO',
        name: `Producto Test ${testTag}`,
        unit_type: 'UNIT',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    productId = itemPro!.id;

    await supabase.from('products').insert({
      stock_item_id: productId,
      base_product_id: baseProductId,
      presentation: '250 ml',
      weight_kg: 0.25,
      extra_variable_pct: 2.0,
    });

    // 3. Crear versiones históricas de precio:
    // Versión 1: Válida desde 2026-01-01 hasta 2026-06-01 por $1.000 ARS
    await supabase.from('product_price_versions').insert({
      product_id: productId,
      price_list_id: priceListId,
      price_ars: 1000,
      valid_from: '2026-01-01T00:00:00Z',
      valid_to: '2026-06-01T00:00:00Z',
    });

    // Versión 2: Válida desde 2026-06-01 en adelante (valid_to NULL) por $1.500 ARS
    await supabase.from('product_price_versions').insert({
      product_id: productId,
      price_list_id: priceListId,
      price_ars: 1500,
      valid_from: '2026-06-01T00:00:00Z',
      valid_to: null,
    });
  });

  t.after(async () => {
    // Limpieza
    await supabase.from('product_price_versions').delete().eq('product_id', productId);
    await supabase.from('products').delete().eq('stock_item_id', productId);
    await supabase.from('stock_items').delete().eq('id', productId);
    await supabase.from('base_products').delete().eq('id', baseProductId);
  });

  await t.test('1. Recupera precio vigente en fecha histórica intermedia (marzo 2026 -> $1000)', async () => {
    const price = await pricingService.getPriceAtSnapshot(
      productId,
      priceListId,
      '2026-03-15T12:00:00Z'
    );
    assert.ok(price instanceof Decimal);
    assert.strictEqual(price.toString(), '1000');
  });

  await t.test('2. Recupera precio vigente tras el aumento (agosto 2026 -> $1500)', async () => {
    const price = await pricingService.getPriceAtSnapshot(
      productId,
      priceListId,
      '2026-08-01T10:00:00Z'
    );
    assert.ok(price instanceof Decimal);
    assert.strictEqual(price.toString(), '1500');
  });

  await t.test('3. Snapshot en el límite exacto de vigencia inicial (2026-01-01T00:00:00Z -> $1000)', async () => {
    const price = await pricingService.getPriceAtSnapshot(
      productId,
      priceListId,
      '2026-01-01T00:00:00Z'
    );
    assert.strictEqual(price.toString(), '1000');
  });

  await t.test('4. Snapshot anterior a la primera versión produce NoPriceSnapshotFoundError', async () => {
    await assert.rejects(
      async () =>
        await pricingService.getPriceAtSnapshot(
          productId,
          priceListId,
          '2025-12-31T23:59:59Z'
        ),
      (err) => err instanceof NoPriceSnapshotFoundError
    );
  });
});
