import test from 'node:test';
import assert from 'node:assert';
import { Decimal } from '../src/domain/decimal';
import {
  serializeDiscountProfileStep,
  serializeDiscountProfile,
  serializeCostGainRow,
  serializeCostGainAnalysis,
  formatArsDecimals,
  formatArsInteger,
  formatMarkupMultiplier,
  type CostGainAnalysisDTO,
  type CostGainRowDTO,
  type DiscountProfileDTO,
} from '../src/actions/cost-gain.dto';
import type {
  CostGainProductAnalysis,
  CostGainAnalysisResult,
} from '../src/services/cost-gain.service';
import type {
  DiscountProfileWithStepsRecord,
} from '../src/repositories/discount-profile.repository';

test('Bloque UI-8 Costo-Ganancia — Validaciones, DTOs y formateadores analíticos', async (t) => {
  await t.test('1. serializeDiscountProfile serializa pasos ordenados y genera stepsSummary correctamente', () => {
    const profileRecord: DiscountProfileWithStepsRecord = {
      id: 'dp-1',
      name: 'Mayorista Escalonado',
      active: true,
      sortOrder: 2,
      steps: [
        { id: 's-2', discountProfileId: 'dp-1', position: 2, percent: new Decimal('10') },
        { id: 's-1', discountProfileId: 'dp-1', position: 1, percent: new Decimal('30') },
        { id: 's-3', discountProfileId: 'dp-1', position: 3, percent: new Decimal('5') },
      ],
    };

    const dto = serializeDiscountProfile(profileRecord);
    assert.strictEqual(dto.id, 'dp-1');
    assert.strictEqual(dto.name, 'Mayorista Escalonado');
    assert.strictEqual(dto.active, true);
    assert.strictEqual(dto.sortOrder, 2);
    assert.strictEqual(dto.stepsSummary, '30% + 10% + 5%');
    assert.strictEqual(dto.steps.length, 3);
    assert.strictEqual(dto.steps[0].position, 1);
    assert.strictEqual(dto.steps[0].percent, '30');
    assert.strictEqual(dto.steps[0].percentDisplay, '30%');
    assert.strictEqual(dto.steps[1].position, 2);
    assert.strictEqual(dto.steps[1].percent, '10');
    assert.strictEqual(dto.steps[2].position, 3);
    assert.strictEqual(dto.steps[2].percent, '5');
  });

  await t.test('2. serializeCostGainRow conserva exactitud de strings y gestiona productos completos', () => {
    const analysis: CostGainProductAnalysis = {
      productId: 'prod-001',
      productCode: 'PRO001',
      productName: 'Shampoo Neutro 5L',
      presentation: 'Bidón 5L',
      weightKg: new Decimal('5.250'),
      active: true,
      hasSalonPrice: true,
      salonPriceArs: new Decimal('15000'),
      hasCost: true,
      theoreticalCostArs: new Decimal('7500.50'),
      netPriceArs: new Decimal('9750.00'),
      gainArs: new Decimal('2249.50'),
      markup: new Decimal('1.2999'),
    };

    const row = serializeCostGainRow(analysis);
    assert.strictEqual(row.productId, 'prod-001');
    assert.strictEqual(row.productCode, 'PRO001');
    assert.strictEqual(row.productName, 'Shampoo Neutro 5L');
    assert.strictEqual(row.presentation, 'Bidón 5L');
    assert.strictEqual(row.weightKg, '5.25');
    assert.strictEqual(row.productActive, true);
    assert.strictEqual(row.hasSalonPrice, true);
    assert.strictEqual(row.salonPriceArs, '15000');
    assert.strictEqual(row.hasCost, true);
    assert.strictEqual(row.theoreticalCostArs, '7500.5');
    assert.strictEqual(row.netPriceArs, '9750');
    assert.strictEqual(row.gainArs, '2249.5');
    assert.strictEqual(row.markup, '1.2999');
    assert.strictEqual(row.costError, null);
  });

  await t.test('3. serializeCostGainRow maneja productos sin precio de Salón o sin costo teórico', () => {
    const unpriced: CostGainProductAnalysis = {
      productId: 'prod-002',
      productCode: 'PRO002',
      productName: 'Acondicionador 1L',
      presentation: 'Botella 1L',
      weightKg: new Decimal('1.050'),
      active: true,
      hasSalonPrice: false,
      salonPriceArs: null,
      hasCost: true,
      theoreticalCostArs: new Decimal('2500'),
      netPriceArs: null,
      gainArs: null,
      markup: null,
    };

    const rowUnpriced = serializeCostGainRow(unpriced);
    assert.strictEqual(rowUnpriced.hasSalonPrice, false);
    assert.strictEqual(rowUnpriced.salonPriceArs, null);
    assert.strictEqual(rowUnpriced.netPriceArs, null);
    assert.strictEqual(rowUnpriced.gainArs, null);
    assert.strictEqual(rowUnpriced.markup, null);

    const uncosted: CostGainProductAnalysis = {
      productId: 'prod-003',
      productCode: 'PRO003',
      productName: 'Serum 50ml',
      presentation: 'Dosificador 50ml',
      weightKg: new Decimal('0.050'),
      active: true,
      hasSalonPrice: true,
      salonPriceArs: new Decimal('8000'),
      hasCost: false,
      theoreticalCostArs: null,
      costError: 'No se encontró fórmula vigente para el producto.',
      netPriceArs: new Decimal('5200'),
      gainArs: null,
      markup: null,
    };

    const rowUncosted = serializeCostGainRow(uncosted);
    assert.strictEqual(rowUncosted.hasCost, false);
    assert.strictEqual(rowUncosted.theoreticalCostArs, null);
    assert.strictEqual(rowUncosted.costError, 'No se encontró fórmula vigente para el producto.');
    assert.strictEqual(rowUncosted.gainArs, null);
    assert.strictEqual(rowUncosted.markup, null);
  });

  await t.test('4. formatArsDecimals formatea importes con 2 decimales y separadores argentinos sin JS float', () => {
    assert.strictEqual(formatArsDecimals('1500.50'), '$ 1.500,50');
    assert.strictEqual(formatArsDecimals('1500000.75'), '$ 1.500.000,75');
    assert.strictEqual(formatArsDecimals('0'), '$ 0,00');
    assert.strictEqual(formatArsDecimals('0.00'), '$ 0,00');
    assert.strictEqual(formatArsDecimals('-250.25'), '-$ 250,25');
    assert.strictEqual(formatArsDecimals(null), '—');
    assert.strictEqual(formatArsDecimals(undefined), '—');
    assert.strictEqual(formatArsDecimals(''), '—');
  });

  await t.test('5. formatArsInteger formatea enteros en pesos sin JS float', () => {
    assert.strictEqual(formatArsInteger('15000'), '$ 15.000');
    assert.strictEqual(formatArsInteger('2500000'), '$ 2.500.000');
    assert.strictEqual(formatArsInteger('0'), '$ 0');
    assert.strictEqual(formatArsInteger('-500'), '-$ 500');
    assert.strictEqual(formatArsInteger(null), '—');
    assert.strictEqual(formatArsInteger(undefined), '—');
  });

  await t.test('6. formatMarkupMultiplier formatea el factor con 2 decimales y sufijo "x"', () => {
    assert.strictEqual(formatMarkupMultiplier('1.5'), '1,50x');
    assert.strictEqual(formatMarkupMultiplier('1.2999'), '1,30x');
    assert.strictEqual(formatMarkupMultiplier('2'), '2,00x');
    assert.strictEqual(formatMarkupMultiplier('0.85'), '0,85x');
    assert.strictEqual(formatMarkupMultiplier(null), '—');
    assert.strictEqual(formatMarkupMultiplier(undefined), '—');
  });

  await t.test('7. serializeCostGainAnalysis produce la estructura completa y canónica', () => {
    const mockResult: CostGainAnalysisResult = {
      salonPriceList: {
        id: 'pl-salon',
        name: 'Lista Salón Oficial',
        systemRole: 'SALON_DEFAULT',
      },
      selectedProfile: {
        id: 'dp-35',
        name: '35%',
        active: true,
        sortOrder: 1,
        steps: [{ id: 'step-1', discountProfileId: 'dp-35', position: 1, percent: new Decimal('35') }],
      },
      availableProfiles: [
        {
          id: 'dp-35',
          name: '35%',
          active: true,
          sortOrder: 1,
          steps: [{ id: 'step-1', discountProfileId: 'dp-35', position: 1, percent: new Decimal('35') }],
        },
      ],
      products: [
        {
          productId: 'p-1',
          productCode: 'PRO100',
          productName: 'Shampoo Keratina',
          presentation: '1000cc',
          weightKg: new Decimal('1.000'),
          active: true,
          hasSalonPrice: true,
          salonPriceArs: new Decimal('200'),
          hasCost: true,
          theoreticalCostArs: new Decimal('100'),
          netPriceArs: new Decimal('130'),
          gainArs: new Decimal('30'),
          markup: new Decimal('1.3'),
        },
      ],
      analyzedAt: '2026-10-08T05:00:00Z',
    };

    const dto = serializeCostGainAnalysis(mockResult);
    assert.strictEqual(dto.salonPriceList.name, 'Lista Salón Oficial');
    assert.strictEqual(dto.salonPriceList.systemRole, 'SALON_DEFAULT');
    assert.strictEqual(dto.selectedProfile.stepsSummary, '35%');
    assert.strictEqual(dto.products.length, 1);
    assert.strictEqual(dto.products[0].productCode, 'PRO100');
    assert.strictEqual(dto.products[0].netPriceArs, '130');
    assert.strictEqual(dto.products[0].gainArs, '30');
    assert.strictEqual(dto.products[0].markup, '1.3');
  });

  await t.test('8. CostGainDomainService utiliza getBatchProductCosts para cruzar costos teóricos en O(1) queries', async () => {
    const mockDiscountProfileRepo = {
      listActiveProfiles: async () => [
        {
          id: 'dp-35',
          name: '35%',
          active: true,
          sortOrder: 1,
          steps: [{ id: 's1', discountProfileId: 'dp-35', position: 1, percent: new Decimal('35') }],
        },
      ],
      getProfileById: async () => null,
      getProfileWithSteps: async () => null,
    };

    const mockPriceListRepo = {
      getPriceListBySystemRole: async () => ({
        id: 'pl-salon',
        name: 'Lista Salón',
        systemRole: 'SALON_DEFAULT' as const,
        active: true,
        createdAt: '',
        updatedAt: '',
      }),
      listCurrentPrices: async () => [
        {
          priceListId: 'pl-salon',
          productId: 'prod-1',
          priceArs: new Decimal('1000'),
          validFrom: '',
        },
      ],
      listPriceLists: async () => [],
      getPriceListById: async () => null,
      createPriceList: async () => ({} as any),
      updatePriceList: async () => ({} as any),
      getCurrentPrice: async () => null,
      setProductPrice: async () => ({} as any),
      getPriceHistory: async () => [],
      bulkPriceIncrease: async () => ({} as any),
    };

    const mockProductRepo = {
      listProducts: async () => [
        {
          productId: 'prod-1',
          code: 'PRO001',
          name: 'Shampoo 1L',
          baseProductId: 'pba-1',
          baseProductCode: 'PBA001',
          baseProductName: 'Base Shampoo',
          presentation: '1000cc',
          weightKg: new Decimal('1'),
          stockMinimum: new Decimal('10'),
          extraVariablePct: new Decimal('2'),
          active: true,
          createdDate: '',
          createdAt: '',
        },
      ],
      getProductDetails: async () => null,
      getProductComponents: async () => [],
      getPriceAtSnapshot: async () => null,
      createProduct: async () => ({} as any),
      updateProduct: async () => ({} as any),
      setProductActive: async () => ({} as any),
      getBatchProductCosts: async () => new Map([['prod-1', new Decimal('500')]]),
    };

    let batchCostCalled = false;
    const mockCostEngine = {
      getCurrentStockItemCost: async () => new Decimal(0),
      getCurrentFormulaCost: async () => ({} as any),
      getCurrentProductCost: async () => ({} as any),
      getBatchProductCosts: async () => {
        batchCostCalled = true;
        return new Map([['prod-1', new Decimal('500')]]);
      },
    };

    const { CostGainDomainService } = await import('../src/services/cost-gain.service');
    const service = new CostGainDomainService(
      mockDiscountProfileRepo as any,
      mockPriceListRepo as any,
      mockProductRepo as any,
      mockCostEngine as any
    );

    const result = await service.listProductAnalysis();
    assert.strictEqual(batchCostCalled, true, 'Debe invocar getBatchProductCosts para evitar N+1');
    assert.strictEqual(result.products.length, 1);
    const p1 = result.products[0];
    assert.strictEqual(p1.hasCost, true);
    assert.strictEqual(p1.theoreticalCostArs?.toString(), '500');
    assert.strictEqual(p1.netPriceArs?.toString(), '650');
    assert.strictEqual(p1.gainArs?.toString(), '150');
    assert.strictEqual(p1.markup?.toString(), '1.3');
  });
});

