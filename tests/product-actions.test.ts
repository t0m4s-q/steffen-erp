import test from 'node:test';
import assert from 'node:assert';
import { Decimal } from '../src/domain/decimal';
import {
  validateIntegerUnit,
  serializeFinalProduct,
  type FinalProductDTO,
} from '../src/actions/product.dto';
import type { ProductWithCostAndStockRecord } from '../src/services/product.service';

test('Bloque UI-6 Productos Finales (PRO) — Validaciones, DTOs y reglas de negocio', async (t) => {
  await t.test('1. validateIntegerUnit valida enteros y rechaza estrictamente números fraccionarios o negativos', () => {
    // Casos válidos
    assert.strictEqual(validateIntegerUnit(0, 'test'), 0);
    assert.strictEqual(validateIntegerUnit(10, 'test'), 10);
    assert.strictEqual(validateIntegerUnit('5', 'test'), 5);
    assert.strictEqual(validateIntegerUnit(new Decimal(20), 'test'), 20);
    assert.strictEqual(validateIntegerUnit(new Decimal('15.000'), 'test'), 15);

    // Casos inválidos (fraccionarios)
    assert.throws(() => validateIntegerUnit(0.5, 'stock'), /entero/);
    assert.throws(() => validateIntegerUnit('12.25', 'stock'), /entero/);
    assert.throws(() => validateIntegerUnit(new Decimal('3.14'), 'stock'), /entero/);
    assert.throws(() => validateIntegerUnit(-1, 'stock'), /entero/);
    assert.throws(() => validateIntegerUnit('abc', 'stock'), /entero/);
  });

  await t.test('2. serializeFinalProduct entrega enteros para stock/BOM y costos desglosados exactos', () => {
    const mockRecord: ProductWithCostAndStockRecord = {
      productId: 'prod-uuid-1',
      code: 'PRO0001',
      name: 'Shampoo Neutro 250ml',
      baseProductId: 'pba-uuid-1',
      baseProductCode: 'PBA0001',
      baseProductName: 'Base Shampoo Neutro',
      presentation: '250 ml',
      weightKg: new Decimal('0.250'),
      stockMinimum: new Decimal('50.000'),
      active: true,
      createdDate: '2026-10-07',
      createdAt: '2026-10-07T12:00:00Z',
      balance: new Decimal('20.000'), // Bajo mínimo (20 < 50)
      extraVariablePct: new Decimal('0.02'),
      cost: {
        baseCost: new Decimal('150.00'),
        componentsCost: new Decimal('100.00'),
        extraVariable: new Decimal('5.00'),
        totalCost: new Decimal('255.00'),
      },
      components: [
        {
          id: 'bom-item-1',
          productId: 'prod-uuid-1',
          componentId: 'com-uuid-1',
          componentCode: 'COM0001',
          componentName: 'Envase 250cc Pet',
          quantityPerUnit: new Decimal('1.000'),
          sortOrder: 1,
          unitCostArs: new Decimal('70.00'),
          lineCostArs: new Decimal('70.00'),
        },
        {
          id: 'bom-item-2',
          productId: 'prod-uuid-1',
          componentId: 'com-uuid-2',
          componentCode: 'COM0002',
          componentName: 'Tapa Disc Top',
          quantityPerUnit: new Decimal('1.000'),
          sortOrder: 2,
          unitCostArs: new Decimal('30.00'),
          lineCostArs: new Decimal('30.00'),
        },
      ],
    };

    const dto: FinalProductDTO = serializeFinalProduct(mockRecord);

    // Identidad y datos básicos
    assert.strictEqual(dto.id, 'prod-uuid-1');
    assert.strictEqual(dto.code, 'PRO0001');
    assert.strictEqual(dto.name, 'Shampoo Neutro 250ml');
    assert.strictEqual(dto.baseProductId, 'pba-uuid-1');
    assert.strictEqual(dto.baseProductCode, 'PBA0001');
    assert.strictEqual(dto.presentation, '250 ml');
    assert.strictEqual(dto.weightKg, '0.25');

    // Stock entero
    assert.strictEqual(dto.stockCurrent, 20);
    assert.strictEqual(dto.stockMinimum, 50);
    assert.strictEqual(dto.isBelowMinimum, true);
    assert.strictEqual(dto.stockRatio, 0.4); // 20 / 50 = 0.4

    // Costos desglosados (subtotal = base + componentes)
    assert.strictEqual(dto.cost.baseCostArs, '150');
    assert.strictEqual(dto.cost.componentsCostArs, '100');
    assert.strictEqual(dto.cost.subtotalArs, '250');
    assert.strictEqual(dto.cost.extraVariableArs, '5');
    assert.strictEqual(dto.cost.totalCostArs, '255');

    // BOM con cantidades enteras y costos en línea
    assert.strictEqual(dto.components.length, 2);
    assert.strictEqual(dto.components[0].componentCode, 'COM0001');
    assert.strictEqual(dto.components[0].quantityPerUnit, 1);
    assert.strictEqual(dto.components[0].unitCostArs, '70');
    assert.strictEqual(dto.components[0].lineCostArs, '70');

    assert.strictEqual(dto.components[1].componentCode, 'COM0002');
    assert.strictEqual(dto.components[1].quantityPerUnit, 1);
    assert.strictEqual(dto.components[1].unitCostArs, '30');
    assert.strictEqual(dto.components[1].lineCostArs, '30');
  });

  await t.test('3. serializeFinalProduct calcula correctamente producto sobre mínimo con stockMinimo = 0', () => {
    const mockRecord: ProductWithCostAndStockRecord = {
      productId: 'prod-uuid-2',
      code: 'PRO0002',
      name: 'Crema Hidratante 50g',
      baseProductId: 'pba-uuid-2',
      baseProductCode: 'PBA0002',
      baseProductName: 'Base Crema',
      presentation: '50 g',
      weightKg: new Decimal('0.050'),
      stockMinimum: new Decimal('0.000'),
      active: true,
      createdDate: '2026-10-07',
      createdAt: '2026-10-07T12:00:00Z',
      balance: new Decimal('10.000'),
      extraVariablePct: new Decimal('0.02'),
      cost: {
        baseCost: new Decimal('50.00'),
        componentsCost: new Decimal('50.00'),
        extraVariable: new Decimal('2.00'),
        totalCost: new Decimal('102.00'),
      },
      components: [],
    };

    const dto = serializeFinalProduct(mockRecord);
    assert.strictEqual(dto.isBelowMinimum, false);
    assert.strictEqual(dto.stockRatio, 10); // 10 / 1 (fallback) = 10
  });

  await t.test('4. serializeFinalProduct rechaza cantidad no entera en componente BOM', () => {
    const invalidRecord: ProductWithCostAndStockRecord = {
      productId: 'prod-uuid-3',
      code: 'PRO0003',
      name: 'Producto Fraccional Erróneo',
      baseProductId: 'pba-uuid-1',
      baseProductCode: 'PBA0001',
      baseProductName: 'Base',
      presentation: '100 ml',
      weightKg: new Decimal('0.100'),
      stockMinimum: new Decimal('10.000'),
      active: true,
      createdDate: '2026-10-07',
      createdAt: '2026-10-07T12:00:00Z',
      balance: new Decimal('5.000'),
      extraVariablePct: new Decimal('0.02'),
      cost: {
        baseCost: new Decimal('10'),
        componentsCost: new Decimal('10'),
        extraVariable: new Decimal('0.4'),
        totalCost: new Decimal('20.4'),
      },
      components: [
        {
          id: 'bom-1',
          productId: 'prod-uuid-3',
          componentId: 'com-1',
          componentCode: 'COM0001',
          componentName: 'Tapa',
          quantityPerUnit: new Decimal('1.5'), // Inválido: cantidad fraccionaria
          sortOrder: 1,
        },
      ],
    };

    assert.throws(() => serializeFinalProduct(invalidRecord), /entero/);
  });

  await t.test('5. serializeFinalProduct conserva Decimal exacto como string JSON-safe sin redondeos (read-only precision)', () => {
    const precisionRecord: ProductWithCostAndStockRecord = {
      productId: 'prod-uuid-precision',
      code: 'PRO0004',
      name: 'Serum Facial Antiage 30ml',
      baseProductId: 'pba-uuid-1',
      baseProductCode: 'PBA0001',
      baseProductName: 'Base Serum',
      presentation: '30 ml',
      weightKg: new Decimal('0.035'), // 3 decimales exactos
      stockMinimum: new Decimal('100.000'),
      active: true,
      createdDate: '2026-10-07',
      createdAt: '2026-10-07T12:00:00Z',
      balance: new Decimal('150.000'),
      extraVariablePct: new Decimal('0.02'),
      cost: {
        baseCost: new Decimal('123.4567'), // 4 decimales
        componentsCost: new Decimal('87.6543'), // 4 decimales
        extraVariable: new Decimal('4.2222'),
        totalCost: new Decimal('215.3332'),
      },
      components: [
        {
          id: 'bom-p-1',
          productId: 'prod-uuid-precision',
          componentId: 'com-p-1',
          componentCode: 'COM0010',
          componentName: 'Gotero Vidrio 30ml',
          quantityPerUnit: new Decimal('1'),
          sortOrder: 1,
          unitCostArs: new Decimal('87.6543'),
          lineCostArs: new Decimal('87.6543'),
        },
      ],
    };

    const dto = serializeFinalProduct(precisionRecord);

    // Sin toFixed(2) o toFixed(3): preserva exactitud del dominio
    assert.strictEqual(dto.weightKg, '0.035');
    assert.strictEqual(dto.cost.baseCostArs, '123.4567');
    assert.strictEqual(dto.cost.componentsCostArs, '87.6543');
    assert.strictEqual(dto.cost.subtotalArs, '211.111'); // 123.4567 + 87.6543 = 211.111
    assert.strictEqual(dto.cost.extraVariableArs, '4.2222');
    assert.strictEqual(dto.cost.totalCostArs, '215.3332');
    assert.strictEqual(dto.components[0].unitCostArs, '87.6543');
    assert.strictEqual(dto.components[0].lineCostArs, '87.6543');
  });

  await t.test('6. ProductDomainService valida reglas de stock y BOM: rechaza stockMin=0, BOM qty=0, -1, 1.5 y acepta initialStock=0', async () => {
    const { ProductDomainService } = await import('../src/services/product.service');
    const dummyService = new ProductDomainService(
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const baseDto = {
      name: 'Producto Test Validaciones',
      presentation: '250 ml',
      baseProductId: 'pba-uuid-test',
      weightKg: '0.250',
      stockMinimum: 10,
      initialStock: 0,
      components: [
        { componentId: 'com-uuid-test', quantityPerUnit: 1 },
      ],
    };

    // 1. stockMinimum = 0 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({ ...baseDto, stockMinimum: 0 }),
      /stock mínimo debe ser estrictamente mayor a 0/i
    );

    // 2. stockMinimum = -1 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({ ...baseDto, stockMinimum: -1 }),
      /stock mínimo debe ser estrictamente mayor a 0/i
    );

    // 3. stockMinimum = 10.5 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({ ...baseDto, stockMinimum: 10.5 }),
      /debe ser un número entero/i
    );

    // 4. BOM quantity = 0 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({
        ...baseDto,
        components: [{ componentId: 'com-uuid-test', quantityPerUnit: 0 }],
      }),
      /debe ser mayor a 0/i
    );

    // 5. BOM quantity = -1 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({
        ...baseDto,
        components: [{ componentId: 'com-uuid-test', quantityPerUnit: -1 }],
      }),
      /debe ser mayor a 0/i
    );

    // 6. BOM quantity = 1.5 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({
        ...baseDto,
        components: [{ componentId: 'com-uuid-test', quantityPerUnit: 1.5 }],
      }),
      /debe ser un número entero/i
    );

    // 7. initialStock = -1 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({ ...baseDto, initialStock: -1 }),
      /no puede ser negativo/i
    );

    // 8. initialStock = 2.5 -> RECHAZADO
    await assert.rejects(
      async () => dummyService.createProduct({ ...baseDto, initialStock: 2.5 }),
      /debe ser un número entero/i
    );

    // 9. initialStock = 0 -> ACEPTADO en validación (falla recién al buscar PBA en repo dummy)
    await assert.rejects(
      async () => dummyService.createProduct({ ...baseDto, initialStock: 0 }),
      (err: any) => {
        // No debe fallar por initialStock ni stockMinimum ni BOM
        assert.ok(!err.message.includes('stock inicial'));
        assert.ok(!err.message.includes('stock mínimo'));
        assert.ok(!err.message.includes('BOM'));
        return true;
      }
    );
  });
});
