// Seed Data conforming to Fase 2 of IMPLEMENTATION_PLAN.md

import { db } from './db';

export function initializeDatabaseIfNeeded() {
  const state = db.getState();
  if (Object.keys(state.financialAccounts).length > 0) {
    return; // Already initialized
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // 1. Sequences
  const prefixes = ['COM', 'MPR', 'PBA', 'PRO', 'GRA', 'ENV', 'CLI', 'PRV', 'PED', 'CMP', 'RTO', 'RTM', 'MFA', 'MST', 'MOV'];
  prefixes.forEach((p) => {
    state.codeSequences[p] = { prefix: p, last_value: 0, updated_at: now };
  });

  // 2. Financial Accounts
  const cashSteffenId = db.generateUUID();
  state.financialAccounts[cashSteffenId] = {
    id: cashSteffenId,
    account_type: 'CASH_STEFFEN',
    name: 'Caja Steffen',
    current_balance: 450000,
    active: true,
    created_at: now,
    updated_at: now,
  };

  const cashMLId = db.generateUUID();
  state.financialAccounts[cashMLId] = {
    id: cashMLId,
    account_type: 'CASH_MERCADO_LIBRE',
    name: 'Caja Mercado Libre',
    current_balance: 185000,
    active: true,
    created_at: now,
    updated_at: now,
  };

  // 3. System Price Lists
  const listSalonId = db.generateUUID();
  state.priceLists[listSalonId] = {
    id: listSalonId,
    name: 'Lista Salón',
    system_role: 'SALON_DEFAULT',
    active: true,
    created_at: now,
    updated_at: now,
  };

  const listPublicId = db.generateUUID();
  state.priceLists[listPublicId] = {
    id: listPublicId,
    name: 'Lista Público',
    system_role: 'PUBLIC_DEFAULT',
    active: true,
    created_at: now,
    updated_at: now,
  };

  const listEcommerceId = db.generateUUID();
  state.priceLists[listEcommerceId] = {
    id: listEcommerceId,
    name: 'Lista Ecommerce',
    system_role: 'ECOMMERCE_DEFAULT',
    active: true,
    created_at: now,
    updated_at: now,
  };

  // 4. Discount Profiles for Costo-Ganancia simulation
  const dp1 = db.generateUUID();
  state.discountProfiles[dp1] = { id: dp1, name: '35%', active: true, sort_order: 1 };
  const dps1 = db.generateUUID();
  state.discountProfileSteps[dps1] = { id: dps1, discount_profile_id: dp1, position: 1, percent: 35 };

  const dp2 = db.generateUUID();
  state.discountProfiles[dp2] = { id: dp2, name: '30% + 10% + 5%', active: true, sort_order: 2 };
  const dps2_1 = db.generateUUID();
  state.discountProfileSteps[dps2_1] = { id: dps2_1, discount_profile_id: dp2, position: 1, percent: 30 };
  const dps2_2 = db.generateUUID();
  state.discountProfileSteps[dps2_2] = { id: dps2_2, discount_profile_id: dp2, position: 2, percent: 10 };
  const dps2_3 = db.generateUUID();
  state.discountProfileSteps[dps2_3] = { id: dps2_3, discount_profile_id: dp2, position: 3, percent: 5 };

  const dp3 = db.generateUUID();
  state.discountProfiles[dp3] = { id: dp3, name: '40% + 10%', active: true, sort_order: 3 };
  const dps3_1 = db.generateUUID();
  state.discountProfileSteps[dps3_1] = { id: dps3_1, discount_profile_id: dp3, position: 1, percent: 40 };
  const dps3_2 = db.generateUUID();
  state.discountProfileSteps[dps3_2] = { id: dps3_2, discount_profile_id: dp3, position: 2, percent: 10 };

  const dp4 = db.generateUUID();
  state.discountProfiles[dp4] = { id: dp4, name: '50%', active: true, sort_order: 4 };
  const dps4_1 = db.generateUUID();
  state.discountProfileSteps[dps4_1] = { id: dps4_1, discount_profile_id: dp4, position: 1, percent: 50 };

  // 5. Exchange Rate (USD -> ARS)
  const fxId = db.generateUUID();
  state.exchangeRates[fxId] = {
    id: fxId,
    currency_code: 'USD',
    rate_to_ars: 1350,
    effective_at: today,
    is_current: true,
    created_at: now,
  };

  // 6. Suppliers (with immutable currency)
  const prv1 = db.generateUUID();
  const prv1Code = db.nextCode('PRV');
  state.suppliers[prv1] = {
    id: prv1,
    code: prv1Code,
    created_date: today,
    name: 'Química del Plata SA',
    salesperson: 'Martín Rodríguez',
    phone: '11-4567-8901',
    currency_code: 'ARS',
    active: true,
    created_at: now,
    updated_at: now,
  };
  const prv1Acc = db.generateUUID();
  state.financialAccounts[prv1Acc] = {
    id: prv1Acc,
    account_type: 'SUPPLIER_PAYABLE',
    name: `Cuenta Proveedor ${prv1Code}`,
    supplier_id: prv1,
    current_balance: 120000,
    active: true,
    created_at: now,
    updated_at: now,
  };

  const prv2 = db.generateUUID();
  const prv2Code = db.nextCode('PRV');
  state.suppliers[prv2] = {
    id: prv2,
    code: prv2Code,
    created_date: today,
    name: 'Envases & Tapas Industriales',
    salesperson: 'Carla Méndez',
    phone: '11-5678-1234',
    currency_code: 'ARS',
    active: true,
    created_at: now,
    updated_at: now,
  };
  const prv2Acc = db.generateUUID();
  state.financialAccounts[prv2Acc] = {
    id: prv2Acc,
    account_type: 'SUPPLIER_PAYABLE',
    name: `Cuenta Proveedor ${prv2Code}`,
    supplier_id: prv2,
    current_balance: 0,
    active: true,
    created_at: now,
    updated_at: now,
  };

  const prv3 = db.generateUUID();
  const prv3Code = db.nextCode('PRV');
  state.suppliers[prv3] = {
    id: prv3,
    code: prv3Code,
    created_date: today,
    name: 'Global Raw Chem Ltd',
    salesperson: 'John Smith',
    phone: '+1-305-555-0199',
    currency_code: 'USD',
    active: true,
    created_at: now,
    updated_at: now,
  };
  const prv3Acc = db.generateUUID();
  state.financialAccounts[prv3Acc] = {
    id: prv3Acc,
    account_type: 'SUPPLIER_PAYABLE',
    name: `Cuenta Proveedor ${prv3Code}`,
    supplier_id: prv3,
    current_balance: 0,
    active: true,
    created_at: now,
    updated_at: now,
  };

  // 7. Raw Materials (MPR)
  const mprsData = [
    { name: 'Lauril Éter Sulfato de Sodio 70%', inci: 'Sodium Laureth Sulfate', min: 100, stock: 250, supplierId: prv1, netPrice: 3200 },
    { name: 'Betaina de Coco', inci: 'Cocamidopropyl Betaine', min: 40, stock: 85, supplierId: prv1, netPrice: 4100 },
    { name: 'Keratina Hidrolizada', inci: 'Hydrolyzed Keratin', min: 10, stock: 8.5, supplierId: prv3, netPrice: 18.5 }, // USD!
    { name: 'Fragancia Frutos Rojos', inci: 'Parfum', min: 5, stock: 12, supplierId: prv1, netPrice: 15500 },
    { name: 'Conservante Euxyl PE 9010', inci: 'Phenoxyethanol, Ethylhexylglycerin', min: 8, stock: 15, supplierId: prv1, netPrice: 12800 },
    { name: 'Agua Desmineralizada', inci: 'Aqua', min: 500, stock: 1200, supplierId: prv1, netPrice: 250 },
  ];

  const mprIds: Record<string, string> = {};

  mprsData.forEach((m) => {
    const id = db.generateUUID();
    const code = db.nextCode('MPR');
    mprIds[m.name] = id;

    state.stockItems[id] = {
      id,
      code,
      item_type: 'MPR',
      name: m.name,
      unit_type: 'KG',
      stock_minimum: m.min,
      active: true,
      created_date: today,
      created_at: now,
      updated_at: now,
    };
    state.rawMaterials[id] = { stock_item_id: id, inci: m.inci };
    state.stockBalances[id] = { stock_item_id: id, quantity: m.stock, updated_at: now };

    const siId = db.generateUUID();
    state.supplierItems[siId] = {
      id: siId,
      supplier_id: m.supplierId,
      stock_item_id: id,
      quoted_unit_price_net: m.netPrice,
      price_updated_at: now,
      active: true,
      created_at: now,
      updated_at: now,
    };
  });

  // 8. Components (COM)
  const comsData = [
    { name: 'Envase PET 350cc Cilíndrico', min: 200, stock: 450, netPrice: 420 },
    { name: 'Bomba Dosificadora 28/410 Negra', min: 200, stock: 180, netPrice: 380 }, // critical stock!
    { name: 'Etiqueta Shampoo Keratina 350cc', min: 300, stock: 600, netPrice: 95 },
    { name: 'Envase PET 1000cc Blanco', min: 100, stock: 220, netPrice: 750 },
    { name: 'Tapa Flip-Top 28/410 Negra', min: 150, stock: 310, netPrice: 210 },
  ];

  const comIds: Record<string, string> = {};

  comsData.forEach((c) => {
    const id = db.generateUUID();
    const code = db.nextCode('COM');
    comIds[c.name] = id;

    state.stockItems[id] = {
      id,
      code,
      item_type: 'COM',
      name: c.name,
      unit_type: 'UNIT',
      stock_minimum: c.min,
      active: true,
      created_date: today,
      created_at: now,
      updated_at: now,
    };
    state.components[id] = { stock_item_id: id };
    state.stockBalances[id] = { stock_item_id: id, quantity: c.stock, updated_at: now };

    const siId = db.generateUUID();
    state.supplierItems[siId] = {
      id: siId,
      supplier_id: prv2,
      stock_item_id: id,
      quoted_unit_price_net: c.netPrice,
      price_updated_at: now,
      active: true,
      created_at: now,
      updated_at: now,
    };
  });

  // 9. Base Product (PBA) & Formula
  const pba1 = db.generateUUID();
  const pba1Code = db.nextCode('PBA');
  state.baseProducts[pba1] = {
    id: pba1,
    code: pba1Code,
    name: 'Shampoo Keratina',
    active: true,
    created_date: today,
    created_at: now,
    updated_at: now,
  };

  const fv1 = db.generateUUID();
  state.formulaVersions[fv1] = {
    id: fv1,
    base_product_id: pba1,
    version_number: 1,
    business_date: today,
    observations: 'Fórmula base oficial para Shampoo Keratina',
    is_current: true,
    created_at: now,
  };

  // Recipe per 100 kg batch
  const recipe = [
    { name: 'Agua Desmineralizada', kg: 78.0 },
    { name: 'Lauril Éter Sulfato de Sodio 70%', kg: 14.0 },
    { name: 'Betaina de Coco', kg: 5.0 },
    { name: 'Keratina Hidrolizada', kg: 1.5 },
    { name: 'Fragancia Frutos Rojos', kg: 0.8 },
    { name: 'Conservante Euxyl PE 9010', kg: 0.7 },
  ];

  recipe.forEach((r, idx) => {
    const fviId = db.generateUUID();
    state.formulaVersionItems[fviId] = {
      id: fviId,
      formula_version_id: fv1,
      raw_material_id: mprIds[r.name],
      quantity_kg: r.kg,
      sort_order: idx + 1,
    };
  });

  // 10. Products (PRO)
  // PRO 1: 350cc (0.350 kg)
  const pro1 = db.generateUUID();
  const pro1Code = db.nextCode('PRO');
  state.stockItems[pro1] = {
    id: pro1,
    code: pro1Code,
    item_type: 'PRO',
    name: 'Shampoo Keratina 350 cc',
    unit_type: 'UNIT',
    stock_minimum: 50,
    active: true,
    created_date: today,
    created_at: now,
    updated_at: now,
  };
  state.products[pro1] = {
    stock_item_id: pro1,
    base_product_id: pba1,
    presentation: '350 cc',
    weight_kg: 0.35,
    extra_variable_pct: 2.0,
    created_at: now,
  };
  state.stockBalances[pro1] = { stock_item_id: pro1, quantity: 42, updated_at: now }; // below 50!

  // Components for PRO 1
  state.productComponents.push(
    { product_id: pro1, component_id: comIds['Envase PET 350cc Cilíndrico'], quantity_per_unit: 1, sort_order: 1 },
    { product_id: pro1, component_id: comIds['Bomba Dosificadora 28/410 Negra'], quantity_per_unit: 1, sort_order: 2 },
    { product_id: pro1, component_id: comIds['Etiqueta Shampoo Keratina 350cc'], quantity_per_unit: 1, sort_order: 3 }
  );

  // PRO 2: 1000cc (1.000 kg)
  const pro2 = db.generateUUID();
  const pro2Code = db.nextCode('PRO');
  state.stockItems[pro2] = {
    id: pro2,
    code: pro2Code,
    item_type: 'PRO',
    name: 'Shampoo Keratina 1000 cc',
    unit_type: 'UNIT',
    stock_minimum: 20,
    active: true,
    created_date: today,
    created_at: now,
    updated_at: now,
  };
  state.products[pro2] = {
    stock_item_id: pro2,
    base_product_id: pba1,
    presentation: '1000 cc',
    weight_kg: 1.0,
    extra_variable_pct: 2.0,
    created_at: now,
  };
  state.stockBalances[pro2] = { stock_item_id: pro2, quantity: 28, updated_at: now };

  state.productComponents.push(
    { product_id: pro2, component_id: comIds['Envase PET 1000cc Blanco'], quantity_per_unit: 1, sort_order: 1 },
    { product_id: pro2, component_id: comIds['Tapa Flip-Top 28/410 Negra'], quantity_per_unit: 1, sort_order: 2 }
  );

  // Price versions for PRO 1
  const pv1Salon = db.generateUUID();
  state.productPriceVersions[pv1Salon] = {
    id: pv1Salon,
    price_list_id: listSalonId,
    product_id: pro1,
    price_ars: 6200,
    valid_from: today,
    created_at: now,
  };

  const pv1Pub = db.generateUUID();
  state.productPriceVersions[pv1Pub] = {
    id: pv1Pub,
    price_list_id: listPublicId,
    product_id: pro1,
    price_ars: 9500,
    valid_from: today,
    created_at: now,
  };

  const pv1Ecom = db.generateUUID();
  state.productPriceVersions[pv1Ecom] = {
    id: pv1Ecom,
    price_list_id: listEcommerceId,
    product_id: pro1,
    price_ars: 8900,
    valid_from: today,
    created_at: now,
  };

  // Price versions for PRO 2
  const pv2Salon = db.generateUUID();
  state.productPriceVersions[pv2Salon] = {
    id: pv2Salon,
    price_list_id: listSalonId,
    product_id: pro2,
    price_ars: 13500,
    valid_from: today,
    created_at: now,
  };

  const pv2Pub = db.generateUUID();
  state.productPriceVersions[pv2Pub] = {
    id: pv2Pub,
    price_list_id: listPublicId,
    product_id: pro2,
    price_ars: 19800,
    valid_from: today,
    created_at: now,
  };

  const pv2Ecom = db.generateUUID();
  state.productPriceVersions[pv2Ecom] = {
    id: pv2Ecom,
    price_list_id: listEcommerceId,
    product_id: pro2,
    price_ars: 18500,
    valid_from: today,
    created_at: now,
  };

  // Product priorities in planning
  state.planningProductPriorities[pro1] = { product_id: pro1, sort_key: 1, updated_at: now };
  state.planningProductPriorities[pro2] = { product_id: pro2, sort_key: 2, updated_at: now };

  // 11. Bulk Lots (GRA)
  const gra1 = db.generateUUID();
  const gra1Code = db.nextCode('GRA');
  const gra1Op = db.generateUUID();
  state.businessOperations[gra1Op] = {
    id: gra1Op,
    operation_type: 'BULK_PRODUCTION',
    business_date: today,
    created_at: now,
    updated_at: now,
  };
  state.bulkLots[gra1] = {
    id: gra1,
    code: gra1Code,
    operation_id: gra1Op,
    base_product_id: pba1,
    formula_version_id: fv1,
    kg_fabricated: 100.0,
    kg_available: 65.0, // 35 kg already packaged
    status: 'OPEN',
    observations: 'Lote de prueba de calidad aprobado',
    total_cost_snapshot_ars: 245000,
    cost_per_kg_snapshot_ars: 2450,
    created_at: now,
  };

  // 12. Customers (CLI)
  const cli1 = db.generateUUID();
  const cli1Code = db.nextCode('CLI');
  state.customers[cli1] = {
    id: cli1,
    code: cli1Code,
    created_date: today,
    name: 'Salón Bella Donna',
    dni: '30-71234567-8',
    address: 'Av. Santa Fe 3420',
    locality: 'Palermo',
    province: 'Buenos Aires',
    phone: '11-4822-9900',
    transport_name: 'Expreso Baires',
    transport_address: 'Depósito Central',
    category: 'Salón Premium',
    discount_1_pct: 30,
    discount_2_pct: 10,
    discount_3_pct: 0,
    active: true,
    created_at: now,
    updated_at: now,
  };
  const cli1Acc = db.generateUUID();
  state.financialAccounts[cli1Acc] = {
    id: cli1Acc,
    account_type: 'CUSTOMER_RECEIVABLE',
    name: `Cuenta Cliente ${cli1Code}`,
    customer_id: cli1,
    current_balance: 45000,
    active: true,
    created_at: now,
    updated_at: now,
  };

  const cli2 = db.generateUUID();
  const cli2Code = db.nextCode('CLI');
  state.customers[cli2] = {
    id: cli2,
    code: cli2Code,
    created_date: today,
    name: 'Estudio Glamour & Co',
    dni: '27-28999444-4',
    address: 'Calle 50 N° 789',
    locality: 'La Plata',
    province: 'Buenos Aires',
    phone: '221-456-7890',
    transport_name: 'Vía Cargo',
    category: 'Salón VIP',
    discount_1_pct: 35,
    discount_2_pct: 0,
    discount_3_pct: 0,
    active: true,
    created_at: now,
    updated_at: now,
  };
  const cli2Acc = db.generateUUID();
  state.financialAccounts[cli2Acc] = {
    id: cli2Acc,
    account_type: 'CUSTOMER_RECEIVABLE',
    name: `Cuenta Cliente ${cli2Code}`,
    customer_id: cli2,
    current_balance: 0,
    active: true,
    created_at: now,
    updated_at: now,
  };

  // 13. Open Orders (PED)
  // Order 1: Salón Bella Donna
  const ped1 = db.generateUUID();
  const ped1Code = db.nextCode('PED');
  state.orders[ped1] = {
    id: ped1,
    code: ped1Code,
    business_date: today,
    status: 'OPEN',
    customer_source: 'REGISTERED_CUSTOMER',
    customer_id: cli1,
    price_list_id: listSalonId,
    price_snapshot_at: now,
    package_count: 2,
    planning_sort_key: 1,
    created_at: now,
    updated_at: now,
  };
  // Discounts 30% then 10%
  const ods1_1 = db.generateUUID();
  state.orderDiscountSteps[ods1_1] = { id: ods1_1, order_id: ped1, position: 1, percent: 30 };
  const ods1_2 = db.generateUUID();
  state.orderDiscountSteps[ods1_2] = { id: ods1_2, order_id: ped1, position: 2, percent: 10 };

  const oi1_1 = db.generateUUID();
  state.orderItems[oi1_1] = {
    id: oi1_1,
    order_id: ped1,
    product_id: pro1,
    requested_quantity: 24,
    ag_quantity: 24,
    unit_price_ars_snapshot: 6200,
    sort_order: 1,
    created_at: now,
    updated_at: now,
  };

  const oi1_2 = db.generateUUID();
  state.orderItems[oi1_2] = {
    id: oi1_2,
    order_id: ped1,
    product_id: pro2,
    requested_quantity: 10,
    ag_quantity: 10,
    unit_price_ars_snapshot: 13500,
    sort_order: 2,
    created_at: now,
    updated_at: now,
  };

  // Order 2: Mercado Libre
  const ped2 = db.generateUUID();
  const ped2Code = db.nextCode('PED');
  state.orders[ped2] = {
    id: ped2,
    code: ped2Code,
    business_date: today,
    status: 'OPEN',
    customer_source: 'MERCADO_LIBRE',
    price_list_id: listEcommerceId,
    price_snapshot_at: now,
    recipient_name: 'Comprador ML #9021',
    address: 'Córdoba Capital',
    planning_sort_key: 2,
    created_at: now,
    updated_at: now,
  };
  const oi2_1 = db.generateUUID();
  state.orderItems[oi2_1] = {
    id: oi2_1,
    order_id: ped2,
    product_id: pro1,
    requested_quantity: 6,
    ag_quantity: 6,
    unit_price_ars_snapshot: 8900,
    sort_order: 1,
    created_at: now,
    updated_at: now,
  };

  db.save();
}
