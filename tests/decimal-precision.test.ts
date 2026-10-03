import test from 'node:test';
import assert from 'node:assert';
import {
  Decimal,
  VAT_MULTIPLIER_DECIMAL,
  toKgPrecision,
  toWholePesos,
  toNumericString,
} from '../src/domain/decimal';

test('Precisión decimal — Verificación contra errores de coma flotante IEEE 754', async (t) => {
  await t.test('1. Resuelve exactamente operaciones tipo 0.1 + 0.2 sin drift flotante', () => {
    // Demostración del error nativo de IEEE 754:
    const nativeSum = 0.1 + 0.2;
    assert.notStrictEqual(nativeSum, 0.3, 'En JavaScript nativo 0.1 + 0.2 da 0.30000000000000004');

    // Con Decimal:
    const decimalSum = new Decimal('0.1').plus('0.2');
    assert.strictEqual(decimalSum.toString(), '0.3');
    assert.ok(decimalSum.equals('0.3'));
  });

  await t.test('2. IVA 21% sobre importes decimales con precisión exacta', () => {
    // $10.15 neto * 1.21 = $12.2815 exacto
    const net = new Decimal('10.15');
    const gross = net.times(VAT_MULTIPLIER_DECIMAL);
    assert.strictEqual(gross.toString(), '12.2815');

    // Comprobación de multiplicación con varios decimales:
    // $123.456789 * 1.21 = $149.38271469 exacto
    const complexNet = new Decimal('123.456789');
    const complexGross = complexNet.times(VAT_MULTIPLIER_DECIMAL);
    assert.strictEqual(complexGross.toString(), '149.38271469');
  });

  await t.test('3. Conversión de USD a ARS con cotización decimal exacta', () => {
    // 12.35 USD a cotización 1245.75 ARS * 1.21 IVA
    const usd = new Decimal('12.35');
    const rate = new Decimal('1245.75');
    const netArs = usd.times(rate); // 15385.0125
    const grossArs = netArs.times(VAT_MULTIPLIER_DECIMAL); // 18615.865125

    assert.strictEqual(netArs.toString(), '15385.0125');
    assert.strictEqual(grossArs.toString(), '18615.865125');
  });

  await t.test('4. Costo por kg de fórmula sin redondeos prematuros', () => {
    // MP1: 1.500 kg a $200.00/kg = 300
    // MP2: 1.500 kg a $400.00/kg = 600
    // Total kg = 3.000 kg exactos
    // Total bulk cost = 900
    // Costo por kg = 900 / 3 = 300 exacto
    const q1 = new Decimal('1.5');
    const c1 = new Decimal('200.00');
    const q2 = new Decimal('1.5');
    const c2 = new Decimal('400.00');

    const totalKg = q1.plus(q2);
    const totalBulkCost = q1.times(c1).plus(q2.times(c2));
    const costPerKg = totalBulkCost.dividedBy(totalKg);

    assert.strictEqual(totalKg.toString(), '3');
    assert.strictEqual(totalBulkCost.toString(), '900');
    assert.strictEqual(costPerKg.toString(), '300');
    assert.strictEqual(costPerKg.times(3).toString(), '900');

    // División con números decimales arbitrarios sin pérdida de precisión:
    const qA = new Decimal('2.125');
    const cA = new Decimal('150.50');
    const totalA = qA.times(cA); // 319.8125
    assert.strictEqual(totalA.toString(), '319.8125');
  });

  await t.test('5. Precisión de kg limitada a un máximo de 3 decimales', () => {
    const kg1 = toKgPrecision('1.2345');
    assert.strictEqual(kg1.toString(), '1.235'); // redondeo HALF_UP

    const kg2 = toKgPrecision('0.001');
    assert.strictEqual(kg2.toString(), '0.001');

    const kg3 = toKgPrecision('5.5');
    assert.strictEqual(kg3.toString(), '5.5');
  });

  await t.test('6. Precios de lista terminan en pesos enteros', () => {
    const p1 = toWholePesos('1245.49');
    assert.strictEqual(p1.toString(), '1245');

    const p2 = toWholePesos('1245.50');
    assert.strictEqual(p2.toString(), '1246');

    const p3 = toWholePesos('1500.00');
    assert.strictEqual(p3.toString(), '1500');
  });

  await t.test('7. toNumericString produce strings exactos sin notación exponencial estándar', () => {
    const val = new Decimal('0.000000123456');
    assert.strictEqual(toNumericString(val), '0.000000123456');
  });
});
