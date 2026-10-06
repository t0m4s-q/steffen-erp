import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import {
  CostGainDomainService,
  SalonPriceListNotFoundError,
  InactiveSalonPriceListError,
  DiscountProfileNotFoundError,
  InvalidDiscountProfileConfigurationError,
  InvalidProductCostInconsistencyError,
} from '../src/services/cost-gain.service';
import {
  DiscountProfileRepository,
  DiscountProfileWithStepsRecord,
} from '../src/repositories/discount-profile.repository';
import { PriceListRepository } from '../src/repositories/price-list.repository';
import { ProductRepository } from '../src/repositories/product.repository';
import { FormulaRepository } from '../src/repositories/formula.repository';
import { CostEngineService } from '../src/services/cost-engine.service';
import { Decimal } from '../src/domain/decimal';
import { NoCurrentFormulaError, ProductNotFoundError } from '../src/domain/errors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('Costo-Ganancia (Fase 4) — Motor analítico, descuentos sucesivos con Decimal.js y tolerancia controlada', async (t) => {
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const discountProfileRepo = new DiscountProfileRepository(serverClient);
  const priceListRepo = new PriceListRepository(serverClient);
  const productRepo = new ProductRepository(serverClient);
  const formulaRepo = new FormulaRepository(serverClient);
  const costEngineService = new CostEngineService(undefined, formulaRepo, productRepo);

  const costGainService = new CostGainDomainService(
    discountProfileRepo,
    priceListRepo,
    productRepo,
    costEngineService
  );

  // Tracking para limpieza al finalizar
  const createdStockItemIds: string[] = [];
  const createdBaseProductIds: string[] = [];
  const createdSupplierIds: string[] = [];

  let testSupplierId: string;
  let testMprId: string;
  let testComId: string;
  let testPbaId: string;
  let salonListId: string;
  let salonOriginalName: string;

  let testProConPrecio: string;
  let testProSinPrecio: string;
  let testProInactivo: string;

  t.before(async () => {
    // 1. Localizar lista SALON_DEFAULT
    const salonList = await priceListRepo.getPriceListBySystemRole('SALON_DEFAULT');
    assert.ok(salonList, 'Debe existir lista de precios con rol SALON_DEFAULT en seeds');
    salonListId = salonList.id;
    salonOriginalName = salonList.name;

    // 2. Crear insumos e infraestructura de prueba con tag único
    const tag = Date.now();
    const { data: supData, error: supErr } = await serverClient.rpc('create_supplier_with_account', {
      p_name: `Proveedor CG Test ${tag}`,
      p_currency_code: 'ARS',
    });
    assert.ifError(supErr);
    testSupplierId = (supData as any).id;
    createdSupplierIds.push(testSupplierId);

    // MPR con costo neto $200 -> con IVA 21% = $242/kg
    const { data: mprData, error: mprErr } = await serverClient.rpc('create_master_item', {
      p_item_type: 'MPR',
      p_name: `MPR CG Test ${tag}`,
      p_stock_minimum: 10,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 200,
      p_initial_stock: 50,
      p_inci: 'Aqua Purificata Test',
    });
    assert.ifError(mprErr);
    testMprId = (mprData as any).id;
    createdStockItemIds.push(testMprId);

    // COM con costo neto $100 -> con IVA 21% = $121/u
    const { data: comData, error: comErr } = await serverClient.rpc('create_master_item', {
      p_item_type: 'COM',
      p_name: `Envase CG Test ${tag}`,
      p_stock_minimum: 20,
      p_initial_supplier_id: testSupplierId,
      p_initial_quoted_price_net: 100,
      p_initial_stock: 50,
    });
    assert.ifError(comErr);
    testComId = (comData as any).id;
    createdStockItemIds.push(testComId);

    // PBA con 1 kg de MPR -> Costo PBA/kg = $242
    const { data: pbaData, error: pbaErr } = await serverClient.rpc('create_base_product_with_formula', {
      p_name: `PBA CG Test ${tag}`,
      p_items: [{ raw_material_id: testMprId, quantity_kg: 1.0, sort_order: 1 }],
      p_observations: 'Fórmula test CG',
    });
    assert.ifError(pbaErr);
    testPbaId = (pbaData as any).base_product.id;
    createdBaseProductIds.push(testPbaId);

    // PRO 1 (Con precio Salón):
    // Peso: 0.5 kg -> baseCost = 0.5 * 242 = $121.
    // Componentes: 1 Envase -> componentsCost = 1 * 121 = $121.
    // Subtotal: 121 + 121 = $242.
    // Extra variable 2%: 242 * 0.02 = $4.84.
    // Costo total PRO: 242 * 1.02 = $246.84.
    const { data: pro1Data, error: pro1Err } = await serverClient.rpc('create_final_product', {
      p_name: `PRO Con Precio ${tag}`,
      p_base_product_id: testPbaId,
      p_presentation: '500ml',
      p_weight_kg: 0.5,
      p_stock_minimum: 5,
      p_components: [{ component_id: testComId, quantity_per_unit: 1, sort_order: 1 }],
    });
    assert.ifError(pro1Err);
    testProConPrecio = (pro1Data as any).id;
    createdStockItemIds.push(testProConPrecio);

    // Asignar precio en SALON_DEFAULT: $1.000 entero
    await serverClient.rpc('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: testProConPrecio,
      p_price_ars: 1000,
    });

    // PRO 2 (Sin precio Salón)
    const { data: pro2Data, error: pro2Err } = await serverClient.rpc('create_final_product', {
      p_name: `PRO Sin Precio ${tag}`,
      p_base_product_id: testPbaId,
      p_presentation: '250ml',
      p_weight_kg: 0.25,
      p_stock_minimum: 5,
      p_components: [{ component_id: testComId, quantity_per_unit: 1, sort_order: 1 }],
    });
    assert.ifError(pro2Err);
    testProSinPrecio = (pro2Data as any).id;
    createdStockItemIds.push(testProSinPrecio);

    // PRO 3 (Inactivo con precio Salón)
    const { data: pro3Data, error: pro3Err } = await serverClient.rpc('create_final_product', {
      p_name: `PRO Inactivo ${tag}`,
      p_base_product_id: testPbaId,
      p_presentation: '500ml',
      p_weight_kg: 0.5,
      p_stock_minimum: 5,
      p_components: [{ component_id: testComId, quantity_per_unit: 1, sort_order: 1 }],
    });
    assert.ifError(pro3Err);
    testProInactivo = (pro3Data as any).id;
    createdStockItemIds.push(testProInactivo);

    await serverClient.rpc('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: testProInactivo,
      p_price_ars: 1500,
    });

    // Inactivar PRO 3
    await serverClient.rpc('update_final_product_metadata', {
      p_product_id: testProInactivo,
      p_active: false,
    });
  });

  t.after(async () => {
    // Restaurar nombre de Lista Salón por si quedó renombrada
    try {
      await serverClient.rpc('update_price_list', {
        p_price_list_id: salonListId,
        p_name: salonOriginalName,
      });
    } catch {}

    // Eliminar PROs creados
    for (const pid of [testProConPrecio, testProSinPrecio, testProInactivo]) {
      if (!pid) continue;
      await serverClient.from('product_price_versions').delete().eq('product_id', pid);
      await serverClient.from('product_components').delete().eq('product_id', pid);
      await serverClient.from('products').delete().eq('stock_item_id', pid);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', pid);
      await serverClient.from('stock_items').delete().eq('id', pid);
    }

    // Eliminar fórmulas y PBA
    for (const pbaId of createdBaseProductIds) {
      const { data: fvs } = await serverClient.from('formula_versions').select('id').eq('base_product_id', pbaId);
      if (fvs) {
        for (const fv of fvs) {
          await serverClient.from('formula_version_items').delete().eq('formula_version_id', fv.id);
        }
      }
      await serverClient.from('formula_versions').delete().eq('base_product_id', pbaId);
      await serverClient.from('base_products').delete().eq('id', pbaId);
    }

    // Eliminar insumos y proveedor
    for (const sid of createdStockItemIds) {
      await serverClient.from('components').delete().eq('stock_item_id', sid);
      await serverClient.from('raw_materials').delete().eq('stock_item_id', sid);
      await serverClient.from('supplier_items').delete().eq('stock_item_id', sid);
      await serverClient.from('stock_movements').delete().eq('stock_item_id', sid);
      await serverClient.from('stock_balances').delete().eq('stock_item_id', sid);
      await serverClient.from('stock_items').delete().eq('id', sid);
    }

    for (const supId of createdSupplierIds) {
      await serverClient.from('supplier_items').delete().eq('supplier_id', supId);
      await serverClient.from('financial_entries').delete().eq('source_id', supId);
      await serverClient.from('financial_accounts').delete().eq('entity_id', supId);
      await serverClient.from('suppliers').delete().eq('id', supId);
    }
  });

  // ============================================================================
  // 1. Repositorio de Perfiles de Descuento y Seeds
  // ============================================================================
  await t.test('1. DiscountProfileRepository: lista los 4 perfiles oficiales ordenados por sort_order con steps ordenados por position y percent Decimal', async () => {
    const profiles = await discountProfileRepo.listActiveProfiles();
    assert.strictEqual(profiles.length, 4, 'Deben existir exactamente 4 perfiles activos');

    // Comprobar orden sort_order
    assert.strictEqual(profiles[0].sortOrder, 1);
    assert.strictEqual(profiles[0].name, '35%');
    assert.strictEqual(profiles[1].sortOrder, 2);
    assert.strictEqual(profiles[1].name, '30% + 10% + 5%');
    assert.strictEqual(profiles[2].sortOrder, 3);
    assert.strictEqual(profiles[2].name, '40% + 10%');
    assert.strictEqual(profiles[3].sortOrder, 4);
    assert.strictEqual(profiles[3].name, '50%');

    // Comprobar steps del perfil 30% + 10% + 5%
    const pMulti = profiles[1];
    assert.strictEqual(pMulti.steps.length, 3);
    assert.strictEqual(pMulti.steps[0].position, 1);
    assert.ok(pMulti.steps[0].percent instanceof Decimal);
    assert.strictEqual(pMulti.steps[0].percent.toString(), '30');

    assert.strictEqual(pMulti.steps[1].position, 2);
    assert.strictEqual(pMulti.steps[1].percent.toString(), '10');

    assert.strictEqual(pMulti.steps[2].position, 3);
    assert.strictEqual(pMulti.steps[2].percent.toString(), '5');

    // getProfileById y getProfileWithSteps
    const single = await discountProfileRepo.getProfileById(pMulti.id);
    assert.ok(single);
    assert.strictEqual(single?.name, '30% + 10% + 5%');

    const withSteps = await discountProfileRepo.getProfileWithSteps(pMulti.id);
    assert.ok(withSteps);
    assert.strictEqual(withSteps?.steps.length, 3);
  });

  // ============================================================================
  // 2. Resolución de Lista Salón por SALON_DEFAULT y Resistencia a Renombrado
  // ============================================================================
  await t.test('2. Resolución por SALON_DEFAULT: no depende del nombre y renombrar la lista no rompe el análisis', async () => {
    const tempName = `Lista Salón Modificada ${Date.now()}`;
    try {
      // Renombrar Lista Salón
      await serverClient.rpc('update_price_list', {
        p_price_list_id: salonListId,
        p_name: tempName,
      });

      // El servicio debe seguir encontrándola por system_role = 'SALON_DEFAULT'
      const analysis = await costGainService.listProductAnalysis();
      assert.strictEqual(analysis.salonPriceList.id, salonListId);
      assert.strictEqual(analysis.salonPriceList.name, tempName);
      assert.strictEqual(analysis.salonPriceList.systemRole, 'SALON_DEFAULT');
    } finally {
      // Restaurar nombre original
      await serverClient.rpc('update_price_list', {
        p_price_list_id: salonListId,
        p_name: salonOriginalName,
      });
    }
  });

  // ============================================================================
  // 3. Selección de Perfil por Defecto e Inexistente
  // ============================================================================
  await t.test('3. Perfil por defecto: usa primer activo (sort_order 1). Error si perfil inexistente o sin pasos', async () => {
    const analysisDefault = await costGainService.listProductAnalysis();
    assert.strictEqual(analysisDefault.selectedProfile.name, '35%', 'El perfil por defecto debe ser 35%');

    // Perfil inexistente
    await assert.rejects(
      async () => {
        await costGainService.listProductAnalysis('00000000-0000-0000-0000-000000000000');
      },
      (err: any) => err instanceof DiscountProfileNotFoundError
    );

    // Mock perfil sin pasos -> InvalidDiscountProfileConfigurationError
    const mockRepoWithoutSteps = {
      listActiveProfiles: async () => [],
      getProfileById: async () => null,
      getProfileWithSteps: async () => ({
        id: 'mock-id',
        name: 'Sin pasos',
        active: true,
        sortOrder: 1,
        steps: [],
      }),
    };
    const brokenService = new CostGainDomainService(mockRepoWithoutSteps as any, priceListRepo, productRepo, costEngineService);
    await assert.rejects(
      async () => {
        await brokenService.getProductAnalysis(testProConPrecio, 'mock-id');
      },
      (err: any) => err instanceof InvalidDiscountProfileConfigurationError
    );
  });

  // ============================================================================
  // 4. Precisión Matemática: 35%, 50%, 30%+10%+5% y 40%+10%
  // ============================================================================
  await t.test('4. Descuentos sucesivos con Decimal.js: 35%, 50%, 40%+10%, y 30%+10%+5% != 45%', async () => {
    const profiles = await discountProfileRepo.listActiveProfiles();
    const p35 = profiles.find((p) => p.name === '35%')!;
    const p50 = profiles.find((p) => p.name === '50%')!;
    const p30_10_5 = profiles.find((p) => p.name === '30% + 10% + 5%')!;
    const p40_10 = profiles.find((p) => p.name === '40% + 10%')!;

    // Precio lista: $1000. Costo teórico: $246.84
    const expectedCost = new Decimal('246.84');

    // A. 35%: 1000 * 0.65 = 650.00
    const res35 = await costGainService.getProductAnalysis(testProConPrecio, p35.id);
    assert.ok(res35.netPriceArs instanceof Decimal);
    assert.strictEqual(res35.netPriceArs.toString(), '650');
    assert.ok(res35.theoreticalCostArs?.equals(expectedCost));
    assert.strictEqual(res35.gainArs?.toString(), '403.16'); // 650 - 246.84 = 403.16
    // Markup: 650 / 246.84 = 2.633284718846216172419380976
    assert.ok(res35.markup?.gt(2.63) && res35.markup?.lt(2.64));

    // B. 50%: 1000 * 0.50 = 500.00
    const res50 = await costGainService.getProductAnalysis(testProConPrecio, p50.id);
    assert.strictEqual(res50.netPriceArs?.toString(), '500');
    assert.strictEqual(res50.gainArs?.toString(), '253.16'); // 500 - 246.84

    // C. 40% + 10%: 1000 * 0.60 * 0.90 = 540.00
    const res40_10 = await costGainService.getProductAnalysis(testProConPrecio, p40_10.id);
    assert.strictEqual(res40_10.netPriceArs?.toString(), '540');
    assert.strictEqual(res40_10.gainArs?.toString(), '293.16'); // 540 - 246.84

    // D. 30% + 10% + 5%: 1000 * 0.70 * 0.90 * 0.95 = 598.50
    const res30_10_5 = await costGainService.getProductAnalysis(testProConPrecio, p30_10_5.id);
    assert.strictEqual(res30_10_5.netPriceArs?.toString(), '598.5');
    assert.strictEqual(res30_10_5.gainArs?.toString(), '351.66'); // 598.50 - 246.84 = 351.66

    // Demostración explícita de no linealidad: 598.50 != 550.00 (suma simple 45%)
    assert.notStrictEqual(res30_10_5.netPriceArs?.toString(), '550');
    assert.ok(res30_10_5.netPriceArs?.equals(new Decimal('598.5')));
  });

  // ============================================================================
  // 5. Casos Límite: Descuento 100%, Descuento > 100%, Costo 0 y Costo Negativo
  // ============================================================================
  await t.test('5. Casos límite matemáticos: Descuento 100%, costo 0 (markup null) e inconsistencia costo negativo', async () => {
    // A. Descuento 100%: netPrice = 0, gain = -cost, markup = 0
    const profile100: DiscountProfileWithStepsRecord = {
      id: 'prof-100',
      name: '100% Promo',
      active: true,
      sortOrder: 1,
      steps: [{ id: 's1', discountProfileId: 'prof-100', position: 1, percent: new Decimal(100) }],
    };
    const mock100Repo = {
      listActiveProfiles: async () => [profile100],
      getProfileById: async () => profile100,
      getProfileWithSteps: async () => profile100,
    };
    const service100 = new CostGainDomainService(mock100Repo as any, priceListRepo, productRepo, costEngineService);
    const res100 = await service100.getProductAnalysis(testProConPrecio, 'prof-100');
    assert.strictEqual(res100.netPriceArs?.toString(), '0');
    assert.strictEqual(res100.gainArs?.toString(), '-246.84');
    assert.strictEqual(res100.markup?.toString(), '0');

    // B. Descuento > 100%: InvalidDiscountProfileConfigurationError
    const profileOver: DiscountProfileWithStepsRecord = {
      id: 'prof-over',
      name: 'Over',
      active: true,
      sortOrder: 1,
      steps: [{ id: 's1', discountProfileId: 'prof-over', position: 1, percent: new Decimal(110) }],
    };
    const mockOver100Repo = {
      listActiveProfiles: async () => [profileOver],
      getProfileById: async () => profileOver,
      getProfileWithSteps: async () => profileOver,
    };
    const serviceOver = new CostGainDomainService(mockOver100Repo as any, priceListRepo, productRepo, costEngineService);
    await assert.rejects(
      async () => {
        await serviceOver.getProductAnalysis(testProConPrecio, 'prof-over');
      },
      (err: any) => err instanceof InvalidDiscountProfileConfigurationError
    );

    // C. Costo = 0: hasCost = true, gain = netPrice, markup = null (división indefinida)
    const mockCostZeroEngine = {
      getCurrentProductCost: async () => ({ totalCost: new Decimal(0), baseCost: new Decimal(0), componentsCost: new Decimal(0), extraVariable: new Decimal(0) }),
    };
    const serviceZeroCost = new CostGainDomainService(discountProfileRepo, priceListRepo, productRepo, mockCostZeroEngine as any);
    const resZeroCost = await serviceZeroCost.getProductAnalysis(testProConPrecio);
    assert.strictEqual(resZeroCost.hasCost, true);
    assert.strictEqual(resZeroCost.theoreticalCostArs?.toString(), '0');
    assert.strictEqual(resZeroCost.gainArs?.toString(), '650');
    assert.strictEqual(resZeroCost.markup, null, 'Markup debe ser null cuando el costo es 0');

    // D. Costo < 0: InvalidProductCostInconsistencyError
    const mockCostNegEngine = {
      getCurrentProductCost: async () => ({ totalCost: new Decimal('-10'), baseCost: new Decimal(0), componentsCost: new Decimal(0), extraVariable: new Decimal(0) }),
    };
    const serviceNegCost = new CostGainDomainService(discountProfileRepo, priceListRepo, productRepo, mockCostNegEngine as any);
    await assert.rejects(
      async () => {
        await serviceNegCost.getProductAnalysis(testProConPrecio);
      },
      (err: any) => err instanceof InvalidProductCostInconsistencyError
    );
  });

  // ============================================================================
  // 6. Estados de Producto: Sin Precio en Salón y Sin Costo Teórico (Tolerancia)
  // ============================================================================
  await t.test('6. Estados de Producto: PRO sin precio Salón (null) y PRO con error de costo (tolerancia en listProductAnalysis)', async () => {
    // PRO sin precio Salón: hasSalonPrice = false, valores derivados en null
    const resSinPrecio = await costGainService.getProductAnalysis(testProSinPrecio);
    assert.strictEqual(resSinPrecio.hasSalonPrice, false);
    assert.strictEqual(resSinPrecio.salonPriceArs, null);
    assert.strictEqual(resSinPrecio.netPriceArs, null);
    assert.strictEqual(resSinPrecio.gainArs, null);
    assert.strictEqual(resSinPrecio.markup, null);
    assert.strictEqual(resSinPrecio.hasCost, true); // Sí tiene costo calculado

    // Tolerancia por fila en listProductAnalysis para error de dominio de costo
    const mockFailingCostEngine = {
      getCurrentProductCost: async (pid: string) => {
        if (pid === testProSinPrecio) {
          throw new NoCurrentFormulaError('pba-invalido');
        }
        return costEngineService.getCurrentProductCost(pid);
      },
    };
    const tolerantService = new CostGainDomainService(discountProfileRepo, priceListRepo, productRepo, mockFailingCostEngine as any);
    const listRes = await tolerantService.listProductAnalysis();
    assert.ok(listRes.products.length > 0);

    const failingItem = listRes.products.find((p) => p.productId === testProSinPrecio);
    assert.ok(failingItem);
    assert.strictEqual(failingItem.hasCost, false);
    assert.strictEqual(failingItem.theoreticalCostArs, null);
    assert.ok(failingItem.costError && failingItem.costError.length > 0);
    assert.strictEqual(failingItem.gainArs, null);
    assert.strictEqual(failingItem.markup, null);

    // Los demás productos deben haber procesado su costo normalmente
    const okItem = listRes.products.find((p) => p.productId === testProConPrecio);
    assert.ok(okItem);
    assert.strictEqual(okItem.hasCost, true);
    assert.ok(okItem.theoreticalCostArs?.gt(0));

    // Propagación obligatoria: ProductNotFoundError NO es tolerable en listProductAnalysis y debe propagarse
    const mockNotFoundCostEngine = {
      getCurrentProductCost: async () => {
        throw new ProductNotFoundError(testProSinPrecio);
      },
    };
    const nonTolerantService = new CostGainDomainService(discountProfileRepo, priceListRepo, productRepo, mockNotFoundCostEngine as any);
    await assert.rejects(
      async () => {
        await nonTolerantService.listProductAnalysis();
      },
      (err: any) => err instanceof ProductNotFoundError
    );
  });

  // ============================================================================
  // 7. Productos Inactivos: Excluidos por Defecto e Incluidos con includeInactive = true
  // ============================================================================
  await t.test('7. Inactivos: excluidos por defecto de listProductAnalysis, incluidos con includeInactive = true', async () => {
    // Por defecto (includeInactive = false)
    const listDefault = await costGainService.listProductAnalysis();
    const foundDefault = listDefault.products.find((p) => p.productId === testProInactivo);
    assert.strictEqual(foundDefault, undefined, 'El PRO inactivo no debe aparecer por defecto');

    // Con includeInactive = true
    const listAll = await costGainService.listProductAnalysis(undefined, true);
    const foundAll = listAll.products.find((p) => p.productId === testProInactivo);
    assert.ok(foundAll, 'El PRO inactivo debe aparecer cuando includeInactive = true');
    assert.strictEqual(foundAll?.active, false);
    assert.strictEqual(foundAll?.hasSalonPrice, true);
    assert.strictEqual(foundAll?.salonPriceArs?.toString(), '1500');
  });

  // ============================================================================
  // 8. Dinamismo en Tiempo Real de Precios sin Snapshots Persistidos
  // ============================================================================
  await t.test('8. Dinamismo en tiempo real: nuevo precio en Salón se refleja de inmediato en el análisis', async () => {
    // Modificar precio de testProConPrecio de 1.000 a 2.000 en Salón
    await serverClient.rpc('set_product_price', {
      p_price_list_id: salonListId,
      p_product_id: testProConPrecio,
      p_price_ars: 2000,
    });

    // Próxima consulta de análisis: debe tomar $2.000
    const updatedRes = await costGainService.getProductAnalysis(testProConPrecio);
    assert.strictEqual(updatedRes.salonPriceArs?.toString(), '2000');
    // Con 35% de descuento: 2000 * 0.65 = 1300
    assert.strictEqual(updatedRes.netPriceArs?.toString(), '1300');
    // Ganancia previa al cambio de costo: 1300 - 246.84 = 1053.16
    assert.strictEqual(updatedRes.gainArs?.toString(), '1053.16');
  });

  // ============================================================================
  // 9. Dinamismo en Tiempo Real del Costo de Insumos sin Snapshots Persistidos
  // ============================================================================
  await t.test('9. Dinamismo en tiempo real: modificación del costo de un insumo (MPR) impacta de inmediato en Costo-Ganancia', async () => {
    // 1. Verificar costo previo del producto ($246.84)
    const prevRes = await costGainService.getProductAnalysis(testProConPrecio);
    assert.ok(prevRes.theoreticalCostArs?.equals(new Decimal('246.84')));

    // 2. Modificar el precio cotizado de la MPR del proveedor (de $200 a $400 neto)
    const { error: updErr } = await serverClient
      .from('supplier_items')
      .update({
        quoted_unit_price_net: 400,
        price_updated_at: new Date().toISOString(),
      })
      .eq('stock_item_id', testMprId);
    assert.ifError(updErr);

    // 3. Volver a consultar Costo-Ganancia inmediatamente sin snapshots intermedios
    // Nuevo costo:
    // MPR bruto c/IVA = 400 * 1.21 = 484/kg
    // baseCost = 0.5 * 484 = 242
    // componentsCost = 1 * 121 = 121
    // subtotal = 242 + 121 = 363
    // extraVariable (2%) = 363 * 0.02 = 7.26
    // totalCost = 363 * 1.02 = 370.26
    const updatedRes = await costGainService.getProductAnalysis(testProConPrecio);

    // 4. theoreticalCostArs cambió
    assert.ok(updatedRes.theoreticalCostArs?.equals(new Decimal('370.26')));
    assert.notStrictEqual(updatedRes.theoreticalCostArs?.toString(), '246.84');

    // 5. gainArs y markup cambiaron
    // netPrice = 2000 * 0.65 = 1300
    // gainArs = 1300 - 370.26 = 929.74
    assert.ok(updatedRes.gainArs?.equals(new Decimal('929.74')));
    // markup = 1300 / 370.26 = 3.511046291794954896559174634
    assert.ok(updatedRes.markup?.gt(3.51) && updatedRes.markup?.lt(3.52));
  });
});
