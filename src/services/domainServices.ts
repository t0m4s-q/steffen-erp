// Domain Services conforming to BUSINESS_RULES.md, DATA_MODEL.md & FLOWS.md

import { db, DatabaseState } from './db';
import {
  UUID,
  CurrencyCode,
  PaymentMode,
  ExpenseType,
  PatrimonialMovementType,
  StockMovementType,
  FactoryMovementType,
} from '../types/domain';

export const IVA_RATE = 0.21;
export const PRODUCT_EXTRA_VARIABLE_PCT = 0.02;

export const domainServices = {
  // Exchange Rate
  getCurrentExchangeRate(): number {
    const state = db.getState();
    const active = Object.values(state.exchangeRates).find((r) => r.is_current && r.currency_code === 'USD');
    return active ? active.rate_to_ars : 1350; // Fallback to 1350 if not loaded
  },

  updateExchangeRate(rateToArs: number, businessDate: string) {
    if (rateToArs <= 0) throw new Error('La cotización debe ser mayor que 0');
    return db.transaction((state) => {
      const now = new Date().toISOString();
      // Deactivate current USD rates
      Object.values(state.exchangeRates).forEach((r) => {
        if (r.currency_code === 'USD' && r.is_current) {
          r.is_current = false;
        }
      });
      const id = db.generateUUID();
      state.exchangeRates[id] = {
        id,
        currency_code: 'USD',
        rate_to_ars: rateToArs,
        effective_at: businessDate || now,
        is_current: true,
        created_at: now,
      };
      return state.exchangeRates[id];
    });
  },

  // Cost Engine conforming to Section 18 of DATA_MODEL.md
  // Costo actual bruto ARS = precio neto proveedor * conversión actual * 1.21
  // Basado en la relación Proveedor <-> Ítem con mayor price_updated_at
  getCurrentStockItemCost(stockItemId: UUID): {
    grossArs: number;
    netSource: number;
    currency: CurrencyCode;
    supplierId?: UUID;
    supplierName?: string;
    priceUpdatedAt?: string;
  } {
    const state = db.getState();
    const relations = Object.values(state.supplierItems).filter(
      (si) => si.stock_item_id === stockItemId && si.active
    );

    if (relations.length === 0) {
      return { grossArs: 0, netSource: 0, currency: 'ARS' };
    }

    // Sort by price_updated_at DESC
    relations.sort((a, b) => new Date(b.price_updated_at).getTime() - new Date(a.price_updated_at).getTime());
    const latest = relations[0];
    const supplier = state.suppliers[latest.supplier_id];
    const currency = supplier ? supplier.currency_code : 'ARS';
    const fxRate = currency === 'USD' ? this.getCurrentExchangeRate() : 1.0;
    const netArs = latest.quoted_unit_price_net * fxRate;
    const grossArs = netArs * (1 + IVA_RATE);

    return {
      grossArs,
      netSource: latest.quoted_unit_price_net,
      currency,
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      priceUpdatedAt: latest.price_updated_at,
    };
  },

  getCurrentFormulaCost(baseProductId: UUID): {
    totalKg: number;
    totalCostArs: number;
    costPerKgArs: number;
    items: Array<{
      rawMaterialId: UUID;
      rawMaterialName: string;
      rawMaterialCode: string;
      quantityKg: number;
      unitCostGrossArs: number;
      lineCostArs: number;
    }>;
  } {
    const state = db.getState();
    const currentVersion = Object.values(state.formulaVersions).find(
      (fv) => fv.base_product_id === baseProductId && fv.is_current
    );

    if (!currentVersion) {
      return { totalKg: 0, totalCostArs: 0, costPerKgArs: 0, items: [] };
    }

    const versionItems = Object.values(state.formulaVersionItems).filter(
      (fvi) => fvi.formula_version_id === currentVersion.id
    );

    let totalKg = 0;
    let totalCostArs = 0;

    const items = versionItems.map((vi) => {
      const stockItem = state.stockItems[vi.raw_material_id];
      const costInfo = this.getCurrentStockItemCost(vi.raw_material_id);
      const lineCostArs = vi.quantity_kg * costInfo.grossArs;
      totalKg += vi.quantity_kg;
      totalCostArs += lineCostArs;

      return {
        rawMaterialId: vi.raw_material_id,
        rawMaterialName: stockItem?.name || 'Materia Prima',
        rawMaterialCode: stockItem?.code || '',
        quantityKg: vi.quantity_kg,
        unitCostGrossArs: costInfo.grossArs,
        lineCostArs,
      };
    });

    const costPerKgArs = totalKg > 0 ? totalCostArs / totalKg : 0;
    return { totalKg, totalCostArs, costPerKgArs, items };
  },

  getCurrentProductCost(productId: UUID): {
    baseCostArs: number;
    componentsCostArs: number;
    subtotalArs: number;
    extraVariableArs: number;
    totalCostArs: number;
    componentsDetail: Array<{
      componentId: UUID;
      componentName: string;
      componentCode: string;
      quantity: number;
      unitCostGrossArs: number;
      totalCostArs: number;
    }>;
  } {
    const state = db.getState();
    const product = state.products[productId];
    if (!product) {
      return { baseCostArs: 0, componentsCostArs: 0, subtotalArs: 0, extraVariableArs: 0, totalCostArs: 0, componentsDetail: [] };
    }

    const formula = this.getCurrentFormulaCost(product.base_product_id);
    const baseCostArs = product.weight_kg * formula.costPerKgArs;

    const comps = state.productComponents.filter((pc) => pc.product_id === productId);
    let componentsCostArs = 0;

    const componentsDetail = comps.map((c) => {
      const stockItem = state.stockItems[c.component_id];
      const costInfo = this.getCurrentStockItemCost(c.component_id);
      const lineTotal = c.quantity_per_unit * costInfo.grossArs;
      componentsCostArs += lineTotal;

      return {
        componentId: c.component_id,
        componentName: stockItem?.name || 'Componente',
        componentCode: stockItem?.code || '',
        quantity: c.quantity_per_unit,
        unitCostGrossArs: costInfo.grossArs,
        totalCostArs: lineTotal,
      };
    });

    const subtotalArs = baseCostArs + componentsCostArs;
    const extraVariableArs = subtotalArs * PRODUCT_EXTRA_VARIABLE_PCT; // 2%
    const totalCostArs = subtotalArs * (1 + PRODUCT_EXTRA_VARIABLE_PCT);

    return {
      baseCostArs,
      componentsCostArs,
      subtotalArs,
      extraVariableArs,
      totalCostArs,
      componentsDetail,
    };
  },

  // Price at Snapshot
  getPriceAtSnapshot(productId: UUID, priceListId: UUID, snapshotAt: string): number {
    const state = db.getState();
    const targetTime = new Date(snapshotAt).getTime();
    const versions = Object.values(state.productPriceVersions).filter(
      (pv) => pv.product_id === productId && pv.price_list_id === priceListId
    );

    // Find version valid at snapshotAt
    const valid = versions.find((v) => {
      const fromTime = new Date(v.valid_from).getTime();
      const toTime = v.valid_to ? new Date(v.valid_to).getTime() : Infinity;
      return targetTime >= fromTime && targetTime <= toTime;
    });

    if (valid) return valid.price_ars;
    // Fallback to latest
    if (versions.length > 0) {
      versions.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());
      return versions[0].price_ars;
    }
    return 0;
  },

  // Stock operations
  getStockBalance(stockItemId: UUID): number {
    const state = db.getState();
    return state.stockBalances[stockItemId]?.quantity || 0;
  },

  applyStockMovement(
    state: DatabaseState,
    operationId: UUID,
    stockItemId: UUID,
    movementType: StockMovementType,
    quantityDelta: number,
    description: string
  ) {
    const code = db.nextCode('MST');
    const now = new Date().toISOString();
    const movId = db.generateUUID();

    state.stockMovements[movId] = {
      id: movId,
      code,
      operation_id: operationId,
      stock_item_id: stockItemId,
      movement_type: movementType,
      quantity_delta: quantityDelta,
      description,
      created_at: now,
    };

    let bal = state.stockBalances[stockItemId];
    if (!bal) {
      bal = { stock_item_id: stockItemId, quantity: 0, updated_at: now };
      state.stockBalances[stockItemId] = bal;
    }
    bal.quantity += quantityDelta;
    bal.updated_at = now;
  },

  // Patrimonial movements
  postPatrimonialMovement(
    state: DatabaseState,
    operationId: UUID,
    movementType: PatrimonialMovementType,
    description: string,
    amountArs: number,
    entries: Array<{ accountId: UUID; deltaArs: number }>
  ) {
    const code = db.nextCode('MOV');
    const now = new Date().toISOString();
    const movId = db.generateUUID();

    state.patrimonialMovements[movId] = {
      id: movId,
      code,
      operation_id: operationId,
      movement_type: movementType,
      description,
      amount_ars: amountArs,
      created_at: now,
    };

    for (const e of entries) {
      const entryId = db.generateUUID();
      state.financialEntries[entryId] = {
        id: entryId,
        patrimonial_movement_id: movId,
        financial_account_id: e.accountId,
        delta_ars: e.deltaArs,
        created_at: now,
      };

      const account = state.financialAccounts[e.accountId];
      if (account) {
        account.current_balance += e.deltaArs;
        account.updated_at = now;
      }
    }
  },

  // Manufacturing: GRAxxxx
  manufactureBulkLot(params: {
    baseProductId: UUID;
    kgFabricated: number;
    businessDate: string;
    observations?: string;
  }) {
    const { baseProductId, kgFabricated, businessDate, observations } = params;

    if (kgFabricated <= 0) {
      throw new Error('La cantidad de kg fabricados debe ser mayor que 0');
    }

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const baseProduct = state.baseProducts[baseProductId];
      if (!baseProduct || !baseProduct.active) {
        throw new Error('El Producto Base no existe o está inactivo');
      }

      const currentFormula = Object.values(state.formulaVersions).find(
        (fv) => fv.base_product_id === baseProductId && fv.is_current
      );
      if (!currentFormula) {
        throw new Error('El Producto Base no tiene fórmula vigente');
      }

      const formulaItems = Object.values(state.formulaVersionItems).filter(
        (fvi) => fvi.formula_version_id === currentFormula.id
      );
      if (formulaItems.length === 0) {
        throw new Error('La fórmula no tiene materias primas');
      }

      const totalFormulaKg = formulaItems.reduce((acc, it) => acc + it.quantity_kg, 0);
      if (totalFormulaKg <= 0) {
        throw new Error('El peso total de la fórmula debe ser mayor que 0');
      }

      // Check stock sufficiency for all MPR
      const requiredMPRs: Array<{
        rawMaterialId: UUID;
        stockItemName: string;
        neededKg: number;
        availableKg: number;
        costInfo: ReturnType<typeof domainServices.getCurrentStockItemCost>;
      }> = [];

      for (const item of formulaItems) {
        const stockItem = state.stockItems[item.raw_material_id];
        if (!stockItem || !stockItem.active) {
          throw new Error(`La materia prima ${stockItem?.name || item.raw_material_id} está inactiva`);
        }
        const neededKg = (item.quantity_kg * kgFabricated) / totalFormulaKg;
        const availableKg = state.stockBalances[item.raw_material_id]?.quantity || 0;

        if (availableKg < neededKg) {
          throw new Error(
            `Stock insuficiente de ${stockItem.name}. Requerido: ${neededKg.toFixed(3)} kg, disponible: ${availableKg.toFixed(3)} kg`
          );
        }

        const costInfo = this.getCurrentStockItemCost(item.raw_material_id);
        requiredMPRs.push({
          rawMaterialId: item.raw_material_id,
          stockItemName: stockItem.name,
          neededKg,
          availableKg,
          costInfo,
        });
      }

      // Create operation
      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'BULK_PRODUCTION',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      // Calculate snapshot costs
      let totalCostArs = 0;
      const lotId = db.generateUUID();
      const graCode = db.nextCode('GRA');

      for (const mpr of requiredMPRs) {
        const lineCostArs = mpr.neededKg * mpr.costInfo.grossArs;
        totalCostArs += lineCostArs;

        const snapId = db.generateUUID();
        state.bulkLotMaterialSnapshots[snapId] = {
          id: snapId,
          bulk_lot_id: lotId,
          raw_material_id: mpr.rawMaterialId,
          quantity_kg: mpr.neededKg,
          source_supplier_id: mpr.costInfo.supplierId,
          source_currency: mpr.costInfo.currency,
          source_unit_price_net: mpr.costInfo.netSource,
          vat_rate_pct: IVA_RATE * 100,
          unit_cost_gross_ars_snapshot: mpr.costInfo.grossArs,
          total_cost_ars_snapshot: lineCostArs,
        };

        // Deduct MPR stock
        this.applyStockMovement(
          state,
          operationId,
          mpr.rawMaterialId,
          'FABRICACIÓN',
          -mpr.neededKg,
          `Consumo para ${graCode} (${baseProduct.name})`
        );
      }

      const costPerKgSnapshot = totalCostArs / kgFabricated;

      // Create bulk_lot
      state.bulkLots[lotId] = {
        id: lotId,
        code: graCode,
        operation_id: operationId,
        base_product_id: baseProductId,
        formula_version_id: currentFormula.id,
        kg_fabricated: kgFabricated,
        kg_available: kgFabricated,
        status: 'OPEN',
        observations,
        total_cost_snapshot_ars: totalCostArs,
        cost_per_kg_snapshot_ars: costPerKgSnapshot,
        created_at: now,
      };

      // Factory movement MFA
      const mfaCode = db.nextCode('MFA');
      const mfaId = db.generateUUID();
      state.factoryMovements[mfaId] = {
        id: mfaId,
        code: mfaCode,
        operation_id: operationId,
        movement_type: 'FABRICACIÓN',
        base_product_id: baseProductId,
        bulk_lot_id: lotId,
        quantity_kg: kgFabricated,
        description: `Fabricación de ${kgFabricated.toFixed(3)} kg de ${baseProduct.name} en lote ${graCode}`,
        created_at: now,
      };

      return state.bulkLots[lotId];
    });
  },

  // Packaging: ENVxxxx
  packageProduct(params: {
    bulkLotId: UUID;
    productId: UUID;
    unitsPackaged: number;
    isLastOfLot: boolean;
    businessDate: string;
    observations?: string;
  }) {
    const { bulkLotId, productId, unitsPackaged, isLastOfLot, businessDate, observations } = params;

    if (unitsPackaged <= 0 || !Number.isInteger(unitsPackaged)) {
      throw new Error('Las unidades a envasar deben ser un entero positivo');
    }

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const lot = state.bulkLots[bulkLotId];
      if (!lot || lot.status !== 'OPEN') {
        throw new Error('El lote de granel no existe o ya está cerrado');
      }

      const product = state.products[productId];
      const stockItemPro = state.stockItems[productId];
      if (!product || !stockItemPro || !stockItemPro.active) {
        throw new Error('El producto final no existe o está inactivo');
      }

      if (product.base_product_id !== lot.base_product_id) {
        throw new Error('El producto final no corresponde al Producto Base del lote seleccionado');
      }

      const kgConsumed = unitsPackaged * product.weight_kg;
      const kgAvailableBefore = lot.kg_available;

      if (!isLastOfLot && kgConsumed > kgAvailableBefore) {
        throw new Error(
          `Granel insuficiente. Requerido: ${kgConsumed.toFixed(3)} kg, disponible: ${kgAvailableBefore.toFixed(3)} kg`
        );
      }

      // Check Component stocks
      const comps = state.productComponents.filter((pc) => pc.product_id === productId);
      const componentsToDeduct: Array<{
        componentId: UUID;
        componentName: string;
        neededUnits: number;
        availableUnits: number;
        costInfo: ReturnType<typeof domainServices.getCurrentStockItemCost>;
      }> = [];

      for (const comp of comps) {
        const compStockItem = state.stockItems[comp.component_id];
        if (!compStockItem || !compStockItem.active) {
          throw new Error(`El componente ${compStockItem?.name || comp.component_id} está inactivo`);
        }
        const neededUnits = unitsPackaged * comp.quantity_per_unit;
        const availableUnits = state.stockBalances[comp.component_id]?.quantity || 0;

        if (availableUnits < neededUnits) {
          throw new Error(
            `Stock insuficiente de ${compStockItem.name}. Requerido: ${neededUnits} unidades, disponible: ${availableUnits} unidades`
          );
        }

        const costInfo = this.getCurrentStockItemCost(comp.component_id);
        componentsToDeduct.push({
          componentId: comp.component_id,
          componentName: compStockItem.name,
          neededUnits,
          availableUnits,
          costInfo,
        });
      }

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'PACKAGING',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const envCode = db.nextCode('ENV');
      const envId = db.generateUUID();

      // Snapshot component costs
      let componentsTotalCostArs = 0;
      for (const comp of componentsToDeduct) {
        const lineTotal = comp.neededUnits * comp.costInfo.grossArs;
        componentsTotalCostArs += lineTotal;

        const snapId = db.generateUUID();
        state.packagingComponentSnapshots[snapId] = {
          id: snapId,
          packaging_operation_id: envId,
          component_id: comp.componentId,
          quantity_per_unit: comp.neededUnits / unitsPackaged,
          quantity_total: comp.neededUnits,
          unit_cost_gross_ars_snapshot: comp.costInfo.grossArs,
          total_cost_ars_snapshot: lineTotal,
        };

        // Deduct component stock
        this.applyStockMovement(
          state,
          operationId,
          comp.componentId,
          'ENVASADO',
          -comp.neededUnits,
          `Envasado ${envCode} (${unitsPackaged} un de ${stockItemPro.name})`
        );
      }

      // Bulk base cost
      const baseCostArs = kgConsumed * lot.cost_per_kg_snapshot_ars;
      const subtotalArs = baseCostArs + componentsTotalCostArs;
      const totalCostSnapshotArs = subtotalArs * (1 + PRODUCT_EXTRA_VARIABLE_PCT);
      const unitCostSnapshotArs = totalCostSnapshotArs / unitsPackaged;

      // Variance calculation if last of lot
      let varianceType: 'NONE' | 'MERMA' | 'SOBRANTE' = 'NONE';
      let varianceKg = 0;

      if (isLastOfLot) {
        const remainingTheoretical = kgAvailableBefore - kgConsumed;
        if (remainingTheoretical > 0.0001) {
          varianceType = 'MERMA';
          varianceKg = remainingTheoretical;
        } else if (remainingTheoretical < -0.0001) {
          varianceType = 'SOBRANTE';
          varianceKg = Math.abs(remainingTheoretical);
        }
        lot.kg_available = 0;
        lot.status = 'CLOSED';
        lot.closed_at = now;
      } else {
        lot.kg_available -= kgConsumed;
      }

      state.packagingOperations[envId] = {
        id: envId,
        code: envCode,
        operation_id: operationId,
        bulk_lot_id: bulkLotId,
        product_id: productId,
        units_packaged: unitsPackaged,
        kg_available_before: kgAvailableBefore,
        kg_consumed: kgConsumed,
        is_last_of_lot: isLastOfLot,
        variance_type: varianceType,
        variance_kg: varianceKg,
        base_cost_per_kg_snapshot_ars: lot.cost_per_kg_snapshot_ars,
        unit_cost_snapshot_ars: unitCostSnapshotArs,
        total_cost_snapshot_ars: totalCostSnapshotArs,
        observations,
        created_at: now,
      };

      // Increase PRO stock
      this.applyStockMovement(
        state,
        operationId,
        productId,
        'ENVASADO',
        unitsPackaged,
        `Ingreso por envasado ${envCode} desde lote ${lot.code}`
      );

      // Factory movements
      const mfaCode1 = db.nextCode('MFA');
      const mfaId1 = db.generateUUID();
      state.factoryMovements[mfaId1] = {
        id: mfaId1,
        code: mfaCode1,
        operation_id: operationId,
        movement_type: 'ENVASADO',
        base_product_id: lot.base_product_id,
        bulk_lot_id: bulkLotId,
        quantity_kg: kgConsumed,
        description: `Consumo de ${kgConsumed.toFixed(3)} kg de granel para ${unitsPackaged} unidades de ${stockItemPro.name} (${envCode})`,
        created_at: now,
      };

      if (varianceType !== 'NONE') {
        const mfaCode2 = db.nextCode('MFA');
        const mfaId2 = db.generateUUID();
        state.factoryMovements[mfaId2] = {
          id: mfaId2,
          code: mfaCode2,
          operation_id: operationId,
          movement_type: varianceType,
          base_product_id: lot.base_product_id,
          bulk_lot_id: bulkLotId,
          quantity_kg: varianceKg,
          description: `Cierre de lote ${lot.code} con ${varianceType} de ${varianceKg.toFixed(3)} kg`,
          created_at: now,
        };
      }

      return state.packagingOperations[envId];
    });
  },

  // Purchase: CMPxxxx
  registerPurchase(params: {
    supplierId: UUID;
    paymentMode: PaymentMode;
    businessDate: string;
    exchangeRateUsed?: number;
    items: Array<{
      stockItemId: UUID;
      quantity: number;
      unitPriceNetSource: number;
    }>;
    observations?: string;
  }) {
    const { supplierId, paymentMode, businessDate, items, observations } = params;

    if (items.length === 0) {
      throw new Error('La compra debe contener al menos un ítem');
    }

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const supplier = state.suppliers[supplierId];
      if (!supplier || !supplier.active) {
        throw new Error('El proveedor no existe o está inactivo');
      }

      const currency = supplier.currency_code;
      let effectiveFx = 1.0;
      if (currency === 'USD') {
        effectiveFx = params.exchangeRateUsed || this.getCurrentExchangeRate();
      }

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'PURCHASE',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const cmpCode = db.nextCode('CMP');
      const purchaseId = db.generateUUID();

      let totalNetSource = 0;
      let totalGrossArs = 0;

      items.forEach((item, index) => {
        const stockItem = state.stockItems[item.stockItemId];
        if (!stockItem || !stockItem.active) {
          throw new Error(`El ítem ${stockItem?.name || item.stockItemId} no existe o está inactivo`);
        }

        if (item.quantity <= 0) {
          throw new Error(`La cantidad de ${stockItem.name} debe ser mayor que 0`);
        }
        if (stockItem.unit_type === 'UNIT' && !Number.isInteger(item.quantity)) {
          throw new Error(`La cantidad de ${stockItem.name} debe ser entera`);
        }
        if (item.unitPriceNetSource <= 0) {
          throw new Error(`El precio de ${stockItem.name} debe ser mayor que 0`);
        }

        const lineNetSource = item.quantity * item.unitPriceNetSource;
        const unitGrossArs = item.unitPriceNetSource * effectiveFx * (1 + IVA_RATE);
        const lineGrossArs = item.quantity * unitGrossArs;

        totalNetSource += lineNetSource;
        totalGrossArs += lineGrossArs;

        const itemId = db.generateUUID();
        state.purchaseItems[itemId] = {
          id: itemId,
          purchase_id: purchaseId,
          stock_item_id: item.stockItemId,
          quantity: item.quantity,
          unit_price_net_source: item.unitPriceNetSource,
          vat_rate_pct: IVA_RATE * 100,
          unit_price_gross_ars_snapshot: unitGrossArs,
          line_total_gross_ars: lineGrossArs,
          sort_order: index + 1,
        };

        // Increase stock
        this.applyStockMovement(
          state,
          operationId,
          item.stockItemId,
          'COMPRA',
          item.quantity,
          `Compra ${cmpCode} a ${supplier.name}`
        );

        // Associate or update supplier_items
        let rel = Object.values(state.supplierItems).find(
          (si) => si.supplier_id === supplierId && si.stock_item_id === item.stockItemId
        );
        if (!rel) {
          const relId = db.generateUUID();
          rel = {
            id: relId,
            supplier_id: supplierId,
            stock_item_id: item.stockItemId,
            quoted_unit_price_net: item.unitPriceNetSource,
            price_updated_at: now,
            active: true,
            created_at: now,
            updated_at: now,
          };
          state.supplierItems[relId] = rel;
        } else {
          rel.quoted_unit_price_net = item.unitPriceNetSource;
          rel.price_updated_at = now;
          rel.updated_at = now;
        }
      });

      state.purchases[purchaseId] = {
        id: purchaseId,
        code: cmpCode,
        operation_id: operationId,
        supplier_id: supplierId,
        payment_mode: paymentMode,
        currency_code_snapshot: currency,
        exchange_rate_used: currency === 'USD' ? effectiveFx : undefined,
        total_net_source_currency: totalNetSource,
        total_gross_ars: totalGrossArs,
        observations,
        created_at: now,
        updated_at: now,
      };

      // Patrimonial effects
      if (paymentMode === 'PAID') {
        const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');
        if (cashSteffen) {
          this.postPatrimonialMovement(
            state,
            operationId,
            'COMPRA',
            `Compra ${cmpCode} a ${supplier.name} (Pagada)`,
            totalGrossArs,
            [{ accountId: cashSteffen.id, deltaArs: -totalGrossArs }]
          );
        }
      } else {
        // DEBT
        const supplierAcc = Object.values(state.financialAccounts).find(
          (a) => a.account_type === 'SUPPLIER_PAYABLE' && a.supplier_id === supplierId
        );
        if (supplierAcc) {
          this.postPatrimonialMovement(
            state,
            operationId,
            'COMPRA',
            `Compra ${cmpCode} a ${supplier.name} (A deuda)`,
            totalGrossArs,
            [{ accountId: supplierAcc.id, deltaArs: totalGrossArs }]
          );
        }
      }

      return state.purchases[purchaseId];
    });
  },

  // Confirm RTO: RTOxxxx
  confirmRto(params: {
    orderId: UUID;
    agQuantities: Record<UUID, number>; // orderItemId -> ag
    businessDate: string;
  }) {
    const { orderId, agQuantities, businessDate } = params;

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const order = state.orders[orderId];
      if (!order || order.status !== 'OPEN') {
        throw new Error('El pedido no existe o ya no está abierto');
      }

      // Check if there is an existing RTM pending in the system
      const pendingRtm = Object.values(state.remittances).find((r) => r.status === 'RTM_PENDING');
      if (pendingRtm) {
        throw new Error(
          `Existe un remito pendiente de completar RTM (${pendingRtm.code}). Debe completarlo antes de confirmar un nuevo RTO.`
        );
      }

      const orderItems = Object.values(state.orderItems).filter((oi) => oi.order_id === orderId);
      if (orderItems.length === 0) {
        throw new Error('El pedido no tiene productos');
      }

      let hasPositiveAg = false;
      let realSubtotal = 0;
      let totalWeightKg = 0;

      // Validate AG quantities and stock
      for (const item of orderItems) {
        const ag = agQuantities[item.id] !== undefined ? agQuantities[item.id] : item.requested_quantity;
        if (ag < 0 || !Number.isInteger(ag)) {
          throw new Error('Las cantidades AG deben ser enteros mayores o iguales a 0');
        }
        if (ag > 0) hasPositiveAg = true;

        const product = state.products[item.product_id];
        const stockItem = state.stockItems[item.product_id];
        const availableStock = state.stockBalances[item.product_id]?.quantity || 0;

        if (ag > availableStock) {
          throw new Error(
            `Stock insuficiente para ${stockItem?.name}. Solicitado AG: ${ag}, disponible en stock: ${availableStock}`
          );
        }

        realSubtotal += ag * item.unit_price_ars_snapshot;
        if (product) {
          totalWeightKg += ag * product.weight_kg;
        }
      }

      if (!hasPositiveAg) {
        throw new Error('Debe existir al menos un producto con cantidad AG mayor que 0');
      }

      // Calculate discounts
      const discountSteps = Object.values(state.orderDiscountSteps)
        .filter((ds) => ds.order_id === orderId)
        .sort((a, b) => a.position - b.position);

      let runningAmount = realSubtotal;
      const remittanceDiscounts: Array<{ position: number; percent: number; amountArs: number }> = [];

      for (const step of discountSteps) {
        const discountVal = runningAmount * (step.percent / 100);
        runningAmount -= discountVal;
        remittanceDiscounts.push({
          position: step.position,
          percent: step.percent,
          amountArs: discountVal,
        });
      }

      const totalOrderArs = runningAmount;

      // Prior balance
      let priorBalance = 0;
      let customerAccount: any = null;

      if (order.customer_source === 'REGISTERED_CUSTOMER' && order.customer_id) {
        customerAccount = Object.values(state.financialAccounts).find(
          (a) => a.account_type === 'CUSTOMER_RECEIVABLE' && a.customer_id === order.customer_id
        );
        priorBalance = customerAccount?.current_balance || 0;
      }

      const totalToCollectArs = totalOrderArs + priorBalance;

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'SALE_RTO',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const rtoCode = db.nextCode('RTO');
      const rtoId = db.generateUUID();

      // Create remittance items and deduct PRO stock
      for (const item of orderItems) {
        const ag = agQuantities[item.id] !== undefined ? agQuantities[item.id] : item.requested_quantity;
        if (ag <= 0) continue; // Only sent items

        const product = state.products[item.product_id];
        const stockItem = state.stockItems[item.product_id];
        const lineTotal = ag * item.unit_price_ars_snapshot;

        const remItemId = db.generateUUID();
        state.remittanceItems[remItemId] = {
          id: remItemId,
          remittance_id: rtoId,
          product_id: item.product_id,
          product_code_snapshot: stockItem?.code || '',
          product_name_snapshot: stockItem?.name || '',
          presentation_snapshot: product?.presentation || '',
          weight_kg_snapshot: product?.weight_kg || 0,
          quantity_sent: ag,
          unit_price_ars_snapshot: item.unit_price_ars_snapshot,
          line_total_ars: lineTotal,
        };

        // Deduct stock PRO
        this.applyStockMovement(
          state,
          operationId,
          item.product_id,
          'VENTA',
          -ag,
          `Venta en Remito ${rtoCode} (${order.code})`
        );
      }

      // Remittance discounts
      for (const rd of remittanceDiscounts) {
        const rdsId = db.generateUUID();
        state.remittanceDiscountSteps[rdsId] = {
          id: rdsId,
          remittance_id: rtoId,
          position: rd.position,
          percent: rd.percent,
          amount_ars_snapshot: rd.amountArs,
        };
      }

      const customer = order.customer_id ? state.customers[order.customer_id] : null;

      state.remittances[rtoId] = {
        id: rtoId,
        code: rtoCode,
        operation_id: operationId,
        order_id: orderId,
        status: 'RTM_PENDING',
        customer_source: order.customer_source,
        customer_id: order.customer_id,
        recipient_name_snapshot: customer ? customer.name : order.recipient_name,
        address_snapshot: customer ? customer.address : order.address,
        locality_snapshot: customer ? customer.locality : order.locality,
        province_snapshot: customer ? customer.province : order.province,
        phone_snapshot: customer ? customer.phone : order.phone,
        transport_name_snapshot: customer ? customer.transport_name : order.transport_name,
        transport_address_snapshot: customer ? customer.transport_address : order.transport_address,
        package_count_snapshot: order.package_count,
        weight_kg_snapshot: totalWeightKg,
        subtotal_ars: realSubtotal,
        total_order_ars: totalOrderArs,
        prior_balance_snapshot_ars: priorBalance,
        total_to_collect_ars: totalToCollectArs,
        created_at: now,
      };

      // Mark order as converted
      order.status = 'CONVERTED';
      order.converted_rto_id = rtoId;
      order.updated_at = now;

      // Financial accounts movement
      if (order.customer_source === 'REGISTERED_CUSTOMER' && customerAccount) {
        this.postPatrimonialMovement(
          state,
          operationId,
          'VENTA',
          `Venta Remito ${rtoCode} a ${customer?.name}`,
          totalOrderArs,
          [{ accountId: customerAccount.id, deltaArs: totalOrderArs }]
        );
      } else if (order.customer_source === 'MERCADO_LIBRE') {
        const cashML = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_MERCADO_LIBRE');
        if (cashML) {
          this.postPatrimonialMovement(
            state,
            operationId,
            'VENTA',
            `Venta Remito ${rtoCode} Mercado Libre`,
            totalOrderArs,
            [{ accountId: cashML.id, deltaArs: totalOrderArs }]
          );
        }
      } else if (order.customer_source === 'CONSUMER_FINAL') {
        const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');
        if (cashSteffen) {
          this.postPatrimonialMovement(
            state,
            operationId,
            'VENTA',
            `Venta Remito ${rtoCode} Consumidor Final`,
            totalOrderArs,
            [{ accountId: cashSteffen.id, deltaArs: totalOrderArs }]
          );
        }
      }

      return state.remittances[rtoId];
    });
  },

  // Complete RTM: RTMxxxx
  completeRtm(params: {
    remittanceId: UUID;
    transportCostArs: number;
    businessDate: string;
  }) {
    const { remittanceId, transportCostArs, businessDate } = params;

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const remittance = state.remittances[remittanceId];
      if (!remittance || remittance.status !== 'RTM_PENDING') {
        throw new Error('El remito no existe o no tiene RTM pendiente');
      }

      const remItems = Object.values(state.remittanceItems).filter((ri) => ri.remittance_id === remittanceId);
      let productsCostTotalArs = 0;

      const rtmCode = db.nextCode('RTM');
      const rtmId = db.generateUUID();

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'SALE_RTM',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      // Snapshot current theoretical costs of PRO
      for (const item of remItems) {
        const costInfo = this.getCurrentProductCost(item.product_id);
        const lineCostTotal = item.quantity_sent * costInfo.totalCostArs;
        productsCostTotalArs += lineCostTotal;

        const rtmItemId = db.generateUUID();
        state.marginRemittanceItems[rtmItemId] = {
          id: rtmItemId,
          margin_remittance_id: rtmId,
          product_id: item.product_id,
          quantity_sent: item.quantity_sent,
          unit_cost_theoretical_snapshot_ars: costInfo.totalCostArs,
          total_cost_snapshot_ars: lineCostTotal,
        };
      }

      const transport = Math.max(0, transportCostArs || 0);
      const gainArs = remittance.total_order_ars - productsCostTotalArs - transport;

      state.marginRemittances[rtmId] = {
        id: rtmId,
        code: rtmCode,
        operation_id: operationId,
        remittance_id: remittanceId,
        products_cost_total_ars: productsCostTotalArs,
        transport_cost_ars: transport,
        gain_ars: gainArs,
        created_at: now,
      };

      // If transport > 0, decrease Cash Steffen
      if (transport > 0) {
        const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');
        if (cashSteffen) {
          this.postPatrimonialMovement(
            state,
            operationId,
            'TRANSPORTE',
            `Transporte de Remito ${remittance.code} (${rtmCode})`,
            transport,
            [{ accountId: cashSteffen.id, deltaArs: -transport }]
          );
        }
      }

      // Mark remittance as COMPLETED
      remittance.status = 'COMPLETED';

      return state.marginRemittances[rtmId];
    });
  },

  // Planning Matrix Algorithm (Simulation only, does not alter real stock or persist reservations)
  calculateOrderPlanning(): {
    products: Array<{
      productId: UUID;
      productName: string;
      productCode: string;
      totalRequested: number;
      currentStock: number;
      coverageFromStock: number;
      pendingAfterStock: number;
      coveredFromBulk: number;
      finalShortage: number;
      ordersCoverage: Record<UUID, { requested: number; covered: number; hasShortage: boolean }>;
    }>;
    openOrders: Array<{
      orderId: UUID;
      code: string;
      customerName: string;
      planningSortKey: number;
    }>;
  } {
    const state = db.getState();
    const openOrders = Object.values(state.orders)
      .filter((o) => o.status === 'OPEN')
      .sort((a, b) => a.planning_sort_key - b.planning_sort_key);

    if (openOrders.length === 0) {
      return { products: [], openOrders: [] };
    }

    // Identify PROs present in at least one open order
    const openOrderIds = new Set(openOrders.map((o) => o.id));
    const itemsInOpenOrders = Object.values(state.orderItems).filter((oi) => openOrderIds.has(oi.order_id));
    const proIdsPresent = Array.from(new Set(itemsInOpenOrders.map((oi) => oi.product_id)));

    // Sort PROs according to planningProductPriorities
    const prioritiesMap: Record<UUID, number> = {};
    Object.values(state.planningProductPriorities).forEach((p) => {
      prioritiesMap[p.product_id] = p.sort_key;
    });

    proIdsPresent.sort((a, b) => {
      const pa = prioritiesMap[a] !== undefined ? prioritiesMap[a] : 999999;
      const pb = prioritiesMap[b] !== undefined ? prioritiesMap[b] : 999999;
      return pa - pb;
    });

    // Virtual resource tracker
    const virtualProStock: Record<UUID, number> = {};
    proIdsPresent.forEach((pid) => {
      virtualProStock[pid] = state.stockBalances[pid]?.quantity || 0;
    });

    // Virtual bulk by base_product_id: sum of OPEN bulk lots kg_available
    const virtualBulkByPba: Record<UUID, number> = {};
    Object.values(state.bulkLots).forEach((lot) => {
      if (lot.status === 'OPEN' && lot.kg_available > 0) {
        virtualBulkByPba[lot.base_product_id] = (virtualBulkByPba[lot.base_product_id] || 0) + lot.kg_available;
      }
    });

    // Virtual components stock
    const virtualComStock: Record<UUID, number> = {};
    Object.values(state.stockItems).forEach((it) => {
      if (it.item_type === 'COM') {
        virtualComStock[it.id] = state.stockBalances[it.id]?.quantity || 0;
      }
    });

    const productsResult: Array<{
      productId: UUID;
      productName: string;
      productCode: string;
      totalRequested: number;
      currentStock: number;
      coverageFromStock: number;
      pendingAfterStock: number;
      coveredFromBulk: number;
      finalShortage: number;
      ordersCoverage: Record<UUID, { requested: number; covered: number; hasShortage: boolean }>;
    }> = [];

    // Process row by row (top to bottom)
    for (const proId of proIdsPresent) {
      const pro = state.products[proId];
      const stockItem = state.stockItems[proId];
      const weight = pro ? pro.weight_kg : 1;
      const pbaId = pro ? pro.base_product_id : '';
      const comps = state.productComponents.filter((pc) => pc.product_id === proId);

      // Collect requested amounts per order
      const ordersCoverage: Record<UUID, { requested: number; covered: number; hasShortage: boolean }> = {};
      let totalRequested = 0;

      openOrders.forEach((o) => {
        const item = itemsInOpenOrders.find((oi) => oi.order_id === o.id && oi.product_id === proId);
        const req = item ? item.requested_quantity : 0;
        totalRequested += req;
        ordersCoverage[o.id] = { requested: req, covered: 0, hasShortage: false };
      });

      const initialProStock = state.stockBalances[proId]?.quantity || 0;
      let remainingVirtualPro = virtualProStock[proId] || 0;

      // 1. Cover from existing PRO stock (from left to right in order columns)
      let coverageFromStock = 0;
      openOrders.forEach((o) => {
        const req = ordersCoverage[o.id].requested;
        if (req > 0 && remainingVirtualPro > 0) {
          const canCover = Math.min(req, remainingVirtualPro);
          ordersCoverage[o.id].covered += canCover;
          remainingVirtualPro -= canCover;
          coverageFromStock += canCover;
        }
      });
      virtualProStock[proId] = remainingVirtualPro;

      const pendingAfterStock = Math.max(0, totalRequested - coverageFromStock);

      // 2. Cover via virtual packaging from available Bulk and Components
      let coveredFromBulk = 0;
      if (pendingAfterStock > 0 && pbaId) {
        const availBulkKg = virtualBulkByPba[pbaId] || 0;
        const maxUnitsFromBulk = weight > 0 ? Math.floor(availBulkKg / weight) : 0;

        let maxUnitsFromComps = Infinity;
        comps.forEach((c) => {
          const availComp = virtualComStock[c.component_id] || 0;
          const maxForComp = Math.floor(availComp / c.quantity_per_unit);
          if (maxForComp < maxUnitsFromComps) {
            maxUnitsFromComps = maxForComp;
          }
        });
        if (comps.length === 0) maxUnitsFromComps = maxUnitsFromBulk;

        const maxPackagingPossible = Math.min(maxUnitsFromBulk, maxUnitsFromComps);
        const unitsToCover = Math.min(pendingAfterStock, maxPackagingPossible);

        if (unitsToCover > 0) {
          coveredFromBulk = unitsToCover;
          // Deduct from virtual bulk
          virtualBulkByPba[pbaId] -= unitsToCover * weight;
          // Deduct from virtual components
          comps.forEach((c) => {
            virtualComStock[c.component_id] -= unitsToCover * c.quantity_per_unit;
          });

          // Allocate to orders (from left to right)
          let remainingVirtualPack = unitsToCover;
          openOrders.forEach((o) => {
            const needed = ordersCoverage[o.id].requested - ordersCoverage[o.id].covered;
            if (needed > 0 && remainingVirtualPack > 0) {
              const packAllocated = Math.min(needed, remainingVirtualPack);
              ordersCoverage[o.id].covered += packAllocated;
              remainingVirtualPack -= packAllocated;
            }
          });
        }
      }

      // Check shortage flag per order cell
      openOrders.forEach((o) => {
        const cell = ordersCoverage[o.id];
        if (cell.requested > 0 && cell.covered < cell.requested) {
          cell.hasShortage = true;
        }
      });

      const finalShortage = Math.max(0, totalRequested - (coverageFromStock + coveredFromBulk));

      productsResult.push({
        productId: proId,
        productName: stockItem?.name || 'Producto',
        productCode: stockItem?.code || '',
        totalRequested,
        currentStock: initialProStock,
        coverageFromStock,
        pendingAfterStock,
        coveredFromBulk,
        finalShortage,
        ordersCoverage,
      });
    }

    const openOrdersFormatted = openOrders.map((o) => {
      let custName = o.recipient_name || 'Sin nombre';
      if (o.customer_source === 'REGISTERED_CUSTOMER' && o.customer_id) {
        custName = state.customers[o.customer_id]?.name || custName;
      } else if (o.customer_source === 'MERCADO_LIBRE') {
        custName = 'Mercado Libre';
      } else if (o.customer_source === 'CONSUMER_FINAL') {
        custName = o.recipient_name ? `CF - ${o.recipient_name}` : 'Consumidor Final';
      }

      return {
        orderId: o.id,
        code: o.code,
        customerName: custName,
        planningSortKey: o.planning_sort_key,
      };
    });

    return {
      products: productsResult,
      openOrders: openOrdersFormatted,
    };
  },

  // Mercado Libre Settlement
  marketplaceSettlement(params: {
    grossAmountArs: number;
    netAmountArs: number;
    businessDate: string;
  }) {
    const { grossAmountArs, netAmountArs, businessDate } = params;

    if (grossAmountArs <= 0) throw new Error('El importe bruto debe ser mayor que 0');
    if (netAmountArs < 0 || netAmountArs > grossAmountArs) {
      throw new Error('El importe neto debe ser mayor o igual a 0 y menor o igual al bruto');
    }

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const cashML = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_MERCADO_LIBRE');
      const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');

      if (!cashML || !cashSteffen) {
        throw new Error('Cuentas de Caja no encontradas');
      }

      if (grossAmountArs > cashML.current_balance) {
        throw new Error(
          `El importe bruto (${grossAmountArs.toLocaleString('es-AR')}) no puede superar el saldo en Caja Mercado Libre (${cashML.current_balance.toLocaleString('es-AR')})`
        );
      }

      const commissionArs = grossAmountArs - netAmountArs;

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'MARKETPLACE_SETTLEMENT',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const setId = db.generateUUID();
      state.marketplaceSettlements[setId] = {
        id: setId,
        operation_id: operationId,
        gross_amount_ars: grossAmountArs,
        net_amount_ars: netAmountArs,
        commission_amount_ars: commissionArs,
        created_at: now,
      };

      // MOV Transferencia neta
      this.postPatrimonialMovement(
        state,
        operationId,
        'TRANSFERENCIA_MERCADO_LIBRE',
        `Liquidación Mercado Libre (Ingreso Neto)`,
        netAmountArs,
        [
          { accountId: cashML.id, deltaArs: -netAmountArs },
          { accountId: cashSteffen.id, deltaArs: netAmountArs },
        ]
      );

      // MOV Gasto Comisión
      if (commissionArs > 0) {
        const opExpId = db.generateUUID();
        state.operatingExpenses[opExpId] = {
          id: opExpId,
          operation_id: operationId,
          expense_type: 'COMISIÓN',
          description: 'Comisión retención Mercado Libre',
          amount_ars: commissionArs,
          source_account_id: cashML.id,
          created_at: now,
        };

        this.postPatrimonialMovement(
          state,
          operationId,
          'GASTO_OPERATIVO',
          `Comisión por liquidación Mercado Libre`,
          commissionArs,
          [{ accountId: cashML.id, deltaArs: -commissionArs }]
        );
      }

      return state.marketplaceSettlements[setId];
    });
  },

  // Payment: Customer or Supplier
  registerPayment(params: {
    paymentType: 'CUSTOMER' | 'SUPPLIER';
    entityId: UUID;
    amountArs: number;
    businessDate: string;
  }) {
    const { paymentType, entityId, amountArs, businessDate } = params;

    if (amountArs <= 0) throw new Error('El importe debe ser mayor que 0');

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');
      if (!cashSteffen) throw new Error('Caja Steffen no encontrada');

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: paymentType === 'CUSTOMER' ? 'CUSTOMER_PAYMENT' : 'SUPPLIER_PAYMENT',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const paymentId = db.generateUUID();

      if (paymentType === 'CUSTOMER') {
        const customer = state.customers[entityId];
        const account = Object.values(state.financialAccounts).find(
          (a) => a.account_type === 'CUSTOMER_RECEIVABLE' && a.customer_id === entityId
        );
        if (!account) throw new Error('Cuenta del cliente no encontrada');

        state.payments[paymentId] = {
          id: paymentId,
          operation_id: operationId,
          payment_type: 'CUSTOMER',
          customer_id: entityId,
          amount_ars: amountArs,
          created_at: now,
          updated_at: now,
        };

        this.postPatrimonialMovement(
          state,
          operationId,
          'PAGO_CLIENTE',
          `Pago de cliente ${customer?.name || entityId}`,
          amountArs,
          [
            { accountId: account.id, deltaArs: -amountArs },
            { accountId: cashSteffen.id, deltaArs: amountArs },
          ]
        );
      } else {
        const supplier = state.suppliers[entityId];
        const account = Object.values(state.financialAccounts).find(
          (a) => a.account_type === 'SUPPLIER_PAYABLE' && a.supplier_id === entityId
        );
        if (!account) throw new Error('Cuenta del proveedor no encontrada');

        state.payments[paymentId] = {
          id: paymentId,
          operation_id: operationId,
          payment_type: 'SUPPLIER',
          supplier_id: entityId,
          amount_ars: amountArs,
          created_at: now,
          updated_at: now,
        };

        this.postPatrimonialMovement(
          state,
          operationId,
          'PAGO_PROVEEDOR',
          `Pago a proveedor ${supplier?.name || entityId}`,
          amountArs,
          [
            { accountId: account.id, deltaArs: -amountArs },
            { accountId: cashSteffen.id, deltaArs: -amountArs },
          ]
        );
      }

      return state.payments[paymentId];
    });
  },

  // Operating expense
  registerOperatingExpense(params: {
    expenseType: ExpenseType;
    description?: string;
    amountArs: number;
    businessDate: string;
  }) {
    const { expenseType, description, amountArs, businessDate } = params;
    if (amountArs <= 0) throw new Error('El importe debe ser mayor que 0');
    if (expenseType === 'OTRO' && !description?.trim()) {
      throw new Error('La descripción es obligatoria para tipo OTRO');
    }

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');
      if (!cashSteffen) throw new Error('Caja Steffen no encontrada');

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'OPERATING_EXPENSE',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const expId = db.generateUUID();
      state.operatingExpenses[expId] = {
        id: expId,
        operation_id: operationId,
        expense_type: expenseType,
        description,
        amount_ars: amountArs,
        source_account_id: cashSteffen.id,
        created_at: now,
      };

      this.postPatrimonialMovement(
        state,
        operationId,
        'GASTO_OPERATIVO',
        `Gasto operativo ${expenseType}${description ? ': ' + description : ''}`,
        amountArs,
        [{ accountId: cashSteffen.id, deltaArs: -amountArs }]
      );

      return state.operatingExpenses[expId];
    });
  },

  // Withdrawal
  registerWithdrawal(params: {
    description: string;
    amountArs: number;
    businessDate: string;
  }) {
    const { description, amountArs, businessDate } = params;
    if (amountArs <= 0) throw new Error('El importe debe ser mayor que 0');
    if (!description?.trim()) throw new Error('La descripción es obligatoria');

    return db.transaction((state) => {
      const now = new Date().toISOString();
      const cashSteffen = Object.values(state.financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN');
      if (!cashSteffen) throw new Error('Caja Steffen no encontrada');

      const operationId = db.generateUUID();
      state.businessOperations[operationId] = {
        id: operationId,
        operation_type: 'WITHDRAWAL',
        business_date: businessDate || now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };

      const wId = db.generateUUID();
      state.withdrawals[wId] = {
        id: wId,
        operation_id: operationId,
        description,
        amount_ars: amountArs,
        created_at: now,
      };

      this.postPatrimonialMovement(
        state,
        operationId,
        'RETIRO',
        `Retiro de caja: ${description}`,
        amountArs,
        [{ accountId: cashSteffen.id, deltaArs: -amountArs }]
      );

      return state.withdrawals[wId];
    });
  },

  // Exactly four cards of Reports according to Section 36 of BUSINESS_RULES.md & Section 60 of DATA_MODEL.md
  getReportsData(): {
    salesCurrentMonth: number;
    billedCurrentMonthArs: number;
    gainCurrentMonthArs: number;
    openOrdersCount: number;
  } {
    const state = db.getState();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    // RTO completed in current month based on business_operations.business_date
    const completedRtos = Object.values(state.remittances).filter((r) => {
      if (r.status !== 'COMPLETED') return false;
      const op = state.businessOperations[r.operation_id];
      const d = op ? new Date(op.business_date) : new Date(r.created_at);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });

    const salesCurrentMonth = completedRtos.length;
    const billedCurrentMonthArs = completedRtos.reduce((acc, r) => acc + r.total_order_ars, 0);

    // Sum of RTM gains associated with those RTOs
    const rtoIds = new Set(completedRtos.map((r) => r.id));
    const rtms = Object.values(state.marginRemittances).filter((m) => rtoIds.has(m.remittance_id));
    const gainCurrentMonthArs = rtms.reduce((acc, m) => acc + m.gain_ars, 0);

    // Total open orders (no month filter)
    const openOrdersCount = Object.values(state.orders).filter((o) => o.status === 'OPEN').length;

    return {
      salesCurrentMonth,
      billedCurrentMonthArs,
      gainCurrentMonthArs,
      openOrdersCount,
    };
  },
};
