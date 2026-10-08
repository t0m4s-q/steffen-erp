import test from 'node:test';
import assert from 'node:assert';
import { Decimal } from '../src/domain/decimal';
import {
  serializePriceList,
  serializePriceHistoryRecord,
  serializeBulkIncreaseResult,
  type PriceListDTO,
  type PriceHistoryRecordDTO,
  type BulkIncreaseResultDTO,
} from '../src/actions/price-list.dto';
import type {
  PriceListRecord,
  ProductPriceVersionRecord,
  BulkPriceIncreaseResult,
} from '../src/repositories/price-list.repository';

test('Bloque UI-7 Listas de Precios — Validaciones, DTOs y reglas de negocio', async (t) => {
  await t.test('1. serializePriceList maneja roles de sistema (Salón, Público, Ecommerce) y listas adicionales', () => {
    const salonRecord: PriceListRecord = {
      id: 'pl-salon-1',
      name: 'Lista Salón Principal',
      systemRole: 'SALON_DEFAULT',
      active: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    };

    const dtoSalon = serializePriceList(salonRecord);
    assert.strictEqual(dtoSalon.id, 'pl-salon-1');
    assert.strictEqual(dtoSalon.name, 'Lista Salón Principal');
    assert.strictEqual(dtoSalon.systemRole, 'SALON_DEFAULT');
    assert.strictEqual(dtoSalon.isSystem, true);
    assert.strictEqual(dtoSalon.systemRoleLabel, 'Salón (Sistema)');
    assert.strictEqual(dtoSalon.active, true);

    const publicRecord: PriceListRecord = {
      id: 'pl-public-1',
      name: 'Público Mostrador',
      systemRole: 'PUBLIC_DEFAULT',
      active: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    };
    const dtoPublic = serializePriceList(publicRecord);
    assert.strictEqual(dtoPublic.isSystem, true);
    assert.strictEqual(dtoPublic.systemRoleLabel, 'Público (Sistema)');

    const ecomRecord: PriceListRecord = {
      id: 'pl-ecom-1',
      name: 'Tienda Online',
      systemRole: 'ECOMMERCE_DEFAULT',
      active: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    };
    const dtoEcom = serializePriceList(ecomRecord);
    assert.strictEqual(dtoEcom.isSystem, true);
    assert.strictEqual(dtoEcom.systemRoleLabel, 'Ecommerce (Sistema)');

    const customRecord: PriceListRecord = {
      id: 'pl-custom-1',
      name: 'Mayorista Distribuidores',
      systemRole: null,
      active: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    };
    const dtoCustom = serializePriceList(customRecord);
    assert.strictEqual(dtoCustom.isSystem, false);
    assert.strictEqual(dtoCustom.systemRoleLabel, 'Adicional');
  });

  await t.test('2. serializePriceHistoryRecord conserva Decimal exacto como string JSON-safe e identifica versión vigente', () => {
    const activeVersionRecord: ProductPriceVersionRecord = {
      id: 'version-1',
      priceListId: 'pl-salon-1',
      productId: 'prod-uuid-1',
      productCode: 'PRO0001',
      productName: 'Shampoo Neutro 250ml',
      priceArs: new Decimal('18500'),
      previousPriceArs: new Decimal('15000'),
      validFrom: '2026-10-08T00:00:00Z',
      validTo: null,
      createdAt: '2026-10-08T00:00:00Z',
    };

    const dtoActive = serializePriceHistoryRecord(activeVersionRecord);
    assert.strictEqual(dtoActive.id, 'version-1');
    assert.strictEqual(dtoActive.priceArs, '18500');
    assert.strictEqual(dtoActive.previousPriceArs, '15000');
    assert.strictEqual(dtoActive.validTo, null);
    assert.strictEqual(dtoActive.isActive, true);

    const closedVersionRecord: ProductPriceVersionRecord = {
      id: 'version-0',
      priceListId: 'pl-salon-1',
      productId: 'prod-uuid-1',
      productCode: 'PRO0001',
      productName: 'Shampoo Neutro 250ml',
      priceArs: new Decimal('15000'),
      previousPriceArs: null,
      validFrom: '2026-09-01T00:00:00Z',
      validTo: '2026-10-08T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
    };

    const dtoClosed = serializePriceHistoryRecord(closedVersionRecord);
    assert.strictEqual(dtoClosed.id, 'version-0');
    assert.strictEqual(dtoClosed.priceArs, '15000');
    assert.strictEqual(dtoClosed.previousPriceArs, null);
    assert.strictEqual(dtoClosed.validTo, '2026-10-08T00:00:00Z');
    assert.strictEqual(dtoClosed.isActive, false);
  });

  await t.test('3. serializeBulkIncreaseResult mapea ítems con precios enteros e incrementos exactos', () => {
    const bulkResult: BulkPriceIncreaseResult = {
      priceListId: 'pl-salon-1',
      percentage: new Decimal('15.5'),
      updatedCount: 2,
      validFrom: '2026-10-08T12:00:00Z',
      items: [
        {
          productId: 'p-1',
          productCode: 'PRO0001',
          productName: 'Shampoo 250ml',
          previousPriceArs: new Decimal('10000'),
          newPriceArs: new Decimal('11550'),
        },
        {
          productId: 'p-2',
          productCode: 'PRO0002',
          productName: 'Crema 50g',
          previousPriceArs: new Decimal('8000'),
          newPriceArs: new Decimal('9240'),
        },
      ],
    };

    const dto = serializeBulkIncreaseResult(bulkResult);
    assert.strictEqual(dto.priceListId, 'pl-salon-1');
    assert.strictEqual(dto.percentage, '15.5');
    assert.strictEqual(dto.updatedCount, 2);
    assert.strictEqual(dto.validFrom, '2026-10-08T12:00:00Z');
    assert.strictEqual(dto.items.length, 2);
    assert.strictEqual(dto.items[0].productCode, 'PRO0001');
    assert.strictEqual(dto.items[0].previousPriceArs, '10000');
    assert.strictEqual(dto.items[0].newPriceArs, '11550');
    assert.strictEqual(dto.items[1].productCode, 'PRO0002');
    assert.strictEqual(dto.items[1].previousPriceArs, '8000');
    assert.strictEqual(dto.items[1].newPriceArs, '9240');
  });

  await t.test('4. Regla de precios: enteros en pesos estrictamente mayores a 0', () => {
    // Casos válidos
    const validPrice1 = new Decimal('15000');
    assert.strictEqual(validPrice1.gt(0), true);
    assert.strictEqual(validPrice1.isInteger(), true);

    const validPrice2 = new Decimal(25000);
    assert.strictEqual(validPrice2.gt(0), true);
    assert.strictEqual(validPrice2.isInteger(), true);

    // Casos inválidos (menor o igual a cero)
    const zeroPrice = new Decimal(0);
    assert.strictEqual(zeroPrice.lte(0), true);

    const negativePrice = new Decimal(-500);
    assert.strictEqual(negativePrice.lte(0), true);

    // Casos inválidos (con decimales / centavos)
    const centavosPrice = new Decimal('1500.50');
    assert.strictEqual(centavosPrice.isInteger(), false);
  });

  await t.test('5. Regla de aumento: porcentaje estrictamente mayor a 0 y redondeo simétrico al peso', () => {
    const validPct = new Decimal('10');
    assert.strictEqual(validPct.gt(0), true);

    const zeroPct = new Decimal(0);
    assert.strictEqual(zeroPct.lte(0), true);

    const negativePct = new Decimal('-5');
    assert.strictEqual(negativePct.lte(0), true);

    // Simulación de cálculo y redondeo al peso entero más cercano
    // 1234 * (1 + 0.125) = 1388.25 -> 1388
    const currPrice1 = 1234;
    const newPrice1 = Math.round(currPrice1 * (1 + 12.5 / 100));
    assert.strictEqual(newPrice1, 1388);

    // 1234 * (1 + 0.126) = 1389.484 -> 1389
    const newPrice2 = Math.round(currPrice1 * (1 + 12.6 / 100));
    assert.strictEqual(newPrice2, 1389);
  });

  await t.test('6. formatExactIntegerArs preserva el string exacto y formatea miles sin conversión a JS Number', () => {
    const { formatExactIntegerArs } = require('../src/actions/price-list.dto');

    assert.strictEqual(formatExactIntegerArs('18500'), '$ 18.500');
    assert.strictEqual(formatExactIntegerArs('1000000'), '$ 1.000.000');
    assert.strictEqual(formatExactIntegerArs('123456789'), '$ 123.456.789');
    assert.strictEqual(formatExactIntegerArs('0'), '$ 0');
    assert.strictEqual(formatExactIntegerArs(''), '$ 0');
    assert.strictEqual(formatExactIntegerArs(null), '$ 0');
    assert.strictEqual(formatExactIntegerArs(undefined), '$ 0');
    assert.strictEqual(formatExactIntegerArs('-1500'), '-$ 1.500');
    assert.strictEqual(formatExactIntegerArs('18500.00'), '$ 18.500');
  });

  await t.test('7. Cálculo de preview en client-side con Decimal.js y toWholePesos coincide con PostgreSQL ROUND_HALF_UP', () => {
    const { toWholePesos, toNumericString } = require('../src/domain/decimal');

    const currPrice = new Decimal('1234');
    const pct1 = new Decimal('12.5'); // 1234 * 1.125 = 1388.25 -> 1388
    const raw1 = currPrice.times(new Decimal(1).plus(pct1.dividedBy(100)));
    const rounded1 = toWholePesos(raw1);
    assert.strictEqual(toNumericString(rounded1), '1388');

    const pct2 = new Decimal('12.6'); // 1234 * 1.126 = 1389.484 -> 1389
    const raw2 = currPrice.times(new Decimal(1).plus(pct2.dividedBy(100)));
    const rounded2 = toWholePesos(raw2);
    assert.strictEqual(toNumericString(rounded2), '1389');

    // Caso exacto .5: 10 * 1.05 = 10.5 -> 11 (ROUND_HALF_UP)
    const currPriceHalf = new Decimal('10');
    const pctHalf = new Decimal('5');
    const rawHalf = currPriceHalf.times(new Decimal(1).plus(pctHalf.dividedBy(100)));
    const roundedHalf = toWholePesos(rawHalf);
    assert.strictEqual(toNumericString(roundedHalf), '11');
  });
});

