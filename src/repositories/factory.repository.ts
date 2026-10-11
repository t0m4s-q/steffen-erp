import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';
import type { Database } from '@/database/types';

export interface BulkLotRecord {
  id: string;
  code: string;
  operationId: string;
  baseProductId: string;
  baseProductName: string;
  baseProductCode: string;
  formulaVersionId: string;
  formulaVersionNumber?: number;
  kgFabricated: Decimal;
  kgAvailable: Decimal;
  status: 'OPEN' | 'CLOSED';
  observations: string | null;
  totalCostSnapshotArs: Decimal;
  costPerKgSnapshotArs: Decimal;
  closedAt: string | null;
  createdAt: string;
  businessDate: string;
}

export interface FactoryMovementRecord {
  id: string;
  code: string;
  operationId: string;
  movementType: string;
  baseProductId: string | null;
  baseProductName: string | null;
  bulkLotId: string | null;
  bulkLotCode: string | null;
  quantityKg: Decimal | null;
  description: string;
  createdAt: string;
  businessDate: string;
}

export interface MaterialCostSnapshotInput {
  rawMaterialId: string;
  sourceSupplierId?: string | null;
  sourceCurrency: string;
  sourceUnitPriceNet: Decimal;
  fxRateSnapshot?: Decimal | null;
  vatRatePct: Decimal;
  unitCostGrossArsSnapshot: Decimal;
}

export interface ManufactureBulkLotInput {
  baseProductId: string;
  formulaVersionId: string;
  kgFabricated: Decimal;
  businessDate?: string;
  observations?: string;
  costSnapshots: MaterialCostSnapshotInput[];
}

export interface ManufactureBulkLotResult {
  operationId: string;
  bulkLotId: string;
  graCode: string;
  mfaCode: string;
  baseProductId: string;
  formulaVersionId: string;
  kgFabricated: Decimal;
  kgAvailable: Decimal;
  totalCostSnapshotArs: Decimal;
  costPerKgSnapshotArs: Decimal;
}

export interface ComponentCostSnapshotInput {
  componentId: string;
  unitCostGrossArsSnapshot: Decimal;
}

export interface PackageProductInput {
  bulkLotId: string;
  productId: string;
  unitsPackaged: number;
  isLastOfLot?: boolean;
  businessDate?: string;
  observations?: string;
  componentCosts: ComponentCostSnapshotInput[];
}

export interface PackageProductResult {
  operationId: string;
  packagingOperationId: string;
  envCode: string;
  mfaCode: string;
  mfaVarianceCode?: string | null;
  bulkLotId: string;
  productId: string;
  unitsPackaged: number;
  kgConsumed: Decimal;
  isLastOfLot: boolean;
  varianceType: 'NONE' | 'MERMA' | 'SOBRANTE';
  varianceKg: Decimal;
  bulkLotStatus: 'OPEN' | 'CLOSED';
  bulkLotKgAvailable: Decimal;
  unitCostSnapshotArs: Decimal;
  totalCostSnapshotArs: Decimal;
}

export interface PackagingOperationRecord {
  id: string;
  code: string;
  operationId: string;
  bulkLotId: string;
  productId: string;
  unitsPackaged: number;
  kgAvailableBefore: Decimal;
  kgConsumed: Decimal;
  isLastOfLot: boolean;
  varianceType: string;
  varianceKg: Decimal;
  baseCostPerKgSnapshotArs: Decimal;
  unitCostSnapshotArs: Decimal;
  totalCostSnapshotArs: Decimal;
  observations: string | null;
  createdAt: string;
}

export interface IFactoryRepository {
  listOpenBulkLots(): Promise<BulkLotRecord[]>;
  listRecentFactoryMovements(limit?: number): Promise<FactoryMovementRecord[]>;
  manufactureBulkLotAtomic(input: ManufactureBulkLotInput): Promise<ManufactureBulkLotResult>;
  getBulkLotById(id: string): Promise<BulkLotRecord | null>;
  packageProductAtomic(input: PackageProductInput): Promise<PackageProductResult>;
  getPackagingOperationById(id: string): Promise<PackagingOperationRecord | null>;
}

function parseJsonObject(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    return JSON.parse(data) as Record<string, unknown>;
  }
  if (typeof data === 'object' && data !== null) {
    return data as Record<string, unknown>;
  }
  throw new DomainError('Respuesta inesperada de RPC: no es un objeto JSON válido');
}

type GenericRpcInvoker = (
  fn: string,
  args?: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export class FactoryRepository extends BaseSupabaseRepository implements IFactoryRepository {
  private callRpc(fn: string, args: Record<string, unknown>) {
    const invoker = this.client.rpc.bind(this.client) as GenericRpcInvoker;
    return invoker(fn, args);
  }

  async listOpenBulkLots(): Promise<BulkLotRecord[]> {
    const { data, error } = await this.client
      .from('bulk_lots')
      .select(`
        id,
        code,
        operation_id,
        base_product_id,
        formula_version_id,
        kg_fabricated,
        kg_available,
        status,
        observations,
        total_cost_snapshot_ars,
        cost_per_kg_snapshot_ars,
        closed_at,
        created_at,
        base_products (
          name,
          code
        ),
        formula_versions (
          version_number
        ),
        business_operations (
          business_date
        )
      `)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });

    if (error) {
      throw new DomainError(`Error consultando lotes a granel disponibles: ${error.message}`);
    }

    return (data || []).map((row: any) => {
      const bp = Array.isArray(row.base_products) ? row.base_products[0] : row.base_products;
      const fv = Array.isArray(row.formula_versions) ? row.formula_versions[0] : row.formula_versions;
      const bo = Array.isArray(row.business_operations) ? row.business_operations[0] : row.business_operations;

      return {
        id: row.id,
        code: row.code,
        operationId: row.operation_id,
        baseProductId: row.base_product_id,
        baseProductName: bp?.name || 'Producto Base Desconocido',
        baseProductCode: bp?.code || '',
        formulaVersionId: row.formula_version_id,
        formulaVersionNumber: fv?.version_number,
        kgFabricated: new Decimal(row.kg_fabricated),
        kgAvailable: new Decimal(row.kg_available),
        status: row.status as 'OPEN' | 'CLOSED',
        observations: row.observations,
        totalCostSnapshotArs: new Decimal(row.total_cost_snapshot_ars),
        costPerKgSnapshotArs: new Decimal(row.cost_per_kg_snapshot_ars),
        closedAt: row.closed_at,
        createdAt: row.created_at,
        businessDate: bo?.business_date || row.created_at.split('T')[0],
      };
    });
  }

  async listRecentFactoryMovements(limit: number = 50): Promise<FactoryMovementRecord[]> {
    const { data, error } = await this.client
      .from('factory_movements')
      .select(`
        id,
        code,
        operation_id,
        movement_type,
        base_product_id,
        bulk_lot_id,
        quantity_kg,
        description,
        created_at,
        base_products (
          name,
          code
        ),
        bulk_lots (
          code
        ),
        business_operations (
          business_date
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DomainError(`Error consultando movimientos de fábrica: ${error.message}`);
    }

    return (data || []).map((row: any) => {
      const bp = Array.isArray(row.base_products) ? row.base_products[0] : row.base_products;
      const bl = Array.isArray(row.bulk_lots) ? row.bulk_lots[0] : row.bulk_lots;
      const bo = Array.isArray(row.business_operations) ? row.business_operations[0] : row.business_operations;

      return {
        id: row.id,
        code: row.code,
        operationId: row.operation_id,
        movementType: row.movement_type,
        baseProductId: row.base_product_id,
        baseProductName: bp?.name || null,
        bulkLotId: row.bulk_lot_id,
        bulkLotCode: bl?.code || null,
        quantityKg: row.quantity_kg !== null && row.quantity_kg !== undefined ? new Decimal(row.quantity_kg) : null,
        description: row.description,
        createdAt: row.created_at,
        businessDate: bo?.business_date || row.created_at.split('T')[0],
      };
    });
  }

  async getBulkLotById(id: string): Promise<BulkLotRecord | null> {
    const { data, error } = await this.client
      .from('bulk_lots')
      .select(`
        id,
        code,
        operation_id,
        base_product_id,
        formula_version_id,
        kg_fabricated,
        kg_available,
        status,
        observations,
        total_cost_snapshot_ars,
        cost_per_kg_snapshot_ars,
        closed_at,
        created_at,
        base_products (
          name,
          code
        ),
        formula_versions (
          version_number
        ),
        business_operations (
          business_date
        )
      `)
      .eq('id', id)
      .limit(1);

    if (error) {
      throw new DomainError(`Error consultando lote a granel ${id}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0] as any;
    const bp = Array.isArray(row.base_products) ? row.base_products[0] : row.base_products;
    const fv = Array.isArray(row.formula_versions) ? row.formula_versions[0] : row.formula_versions;
    const bo = Array.isArray(row.business_operations) ? row.business_operations[0] : row.business_operations;

    return {
      id: row.id,
      code: row.code,
      operationId: row.operation_id,
      baseProductId: row.base_product_id,
      baseProductName: bp?.name || 'Producto Base Desconocido',
      baseProductCode: bp?.code || '',
      formulaVersionId: row.formula_version_id,
      formulaVersionNumber: fv?.version_number,
      kgFabricated: new Decimal(row.kg_fabricated),
      kgAvailable: new Decimal(row.kg_available),
      status: row.status as 'OPEN' | 'CLOSED',
      observations: row.observations,
      totalCostSnapshotArs: new Decimal(row.total_cost_snapshot_ars),
      costPerKgSnapshotArs: new Decimal(row.cost_per_kg_snapshot_ars),
      closedAt: row.closed_at,
      createdAt: row.created_at,
      businessDate: bo?.business_date || row.created_at.split('T')[0],
    };
  }

  async manufactureBulkLotAtomic(input: ManufactureBulkLotInput): Promise<ManufactureBulkLotResult> {
    const costSnapshotsPayload = input.costSnapshots.map((snap) => ({
      raw_material_id: snap.rawMaterialId,
      source_supplier_id: snap.sourceSupplierId || null,
      source_currency: snap.sourceCurrency,
      source_unit_price_net: toNumericString(snap.sourceUnitPriceNet),
      fx_rate_snapshot: snap.fxRateSnapshot ? toNumericString(snap.fxRateSnapshot) : null,
      vat_rate_pct: toNumericString(snap.vatRatePct),
      unit_cost_gross_ars_snapshot: toNumericString(snap.unitCostGrossArsSnapshot),
    }));

    const args = {
      p_base_product_id: input.baseProductId,
      p_formula_version_id: input.formulaVersionId,
      p_kg_fabricated: toNumericString(input.kgFabricated),
      p_business_date: input.businessDate || undefined,
      p_observations: input.observations ? input.observations.trim() : undefined,
      p_cost_snapshots: costSnapshotsPayload,
    };

    const { data, error } = await this.callRpc('manufacture_bulk_lot_atomic', args);

    if (error || !data) {
      throw new DomainError(`Error registrando fabricación atómica: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    return {
      operationId: String(res.operation_id),
      bulkLotId: String(res.bulk_lot_id),
      graCode: String(res.gra_code),
      mfaCode: String(res.mfa_code),
      baseProductId: String(res.base_product_id),
      formulaVersionId: String(res.formula_version_id),
      kgFabricated: new Decimal(String(res.kg_fabricated)),
      kgAvailable: new Decimal(String(res.kg_available)),
      totalCostSnapshotArs: new Decimal(String(res.total_cost_snapshot_ars)),
      costPerKgSnapshotArs: new Decimal(String(res.cost_per_kg_snapshot_ars)),
    };
  }

  async packageProductAtomic(input: PackageProductInput): Promise<PackageProductResult> {
    const componentCostsPayload = input.componentCosts.map((snap) => ({
      component_id: snap.componentId,
      unit_cost_gross_ars_snapshot: toNumericString(snap.unitCostGrossArsSnapshot),
    }));

    const args = {
      p_bulk_lot_id: input.bulkLotId,
      p_product_id: input.productId,
      p_units_packaged: input.unitsPackaged,
      p_is_last_of_lot: Boolean(input.isLastOfLot),
      p_business_date: input.businessDate || undefined,
      p_observations: input.observations ? input.observations.trim() : undefined,
      p_component_costs: componentCostsPayload,
    };

    const { data, error } = await this.callRpc('package_product_atomic', args);

    if (error || !data) {
      throw new DomainError(`Error registrando envasado atómico: ${error?.message || 'Sin datos devueltos'}`);
    }

    const res = parseJsonObject(data);
    return {
      operationId: String(res.operation_id),
      packagingOperationId: String(res.packaging_operation_id),
      envCode: String(res.env_code),
      mfaCode: String(res.mfa_code),
      mfaVarianceCode: res.mfa_variance_code ? String(res.mfa_variance_code) : null,
      bulkLotId: String(res.bulk_lot_id),
      productId: String(res.product_id),
      unitsPackaged: Number(res.units_packaged),
      kgConsumed: new Decimal(String(res.kg_consumed)),
      isLastOfLot: Boolean(res.is_last_of_lot),
      varianceType: String(res.variance_type) as 'NONE' | 'MERMA' | 'SOBRANTE',
      varianceKg: new Decimal(String(res.variance_kg)),
      bulkLotStatus: String(res.bulk_lot_status) as 'OPEN' | 'CLOSED',
      bulkLotKgAvailable: new Decimal(String(res.bulk_lot_kg_available)),
      unitCostSnapshotArs: new Decimal(String(res.unit_cost_snapshot_ars)),
      totalCostSnapshotArs: new Decimal(String(res.total_cost_snapshot_ars)),
    };
  }

  async getPackagingOperationById(id: string): Promise<PackagingOperationRecord | null> {
    const { data, error } = await this.client
      .from('packaging_operations')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (error) {
      throw new DomainError(`Error consultando operación de envasado ${id}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.id,
      code: row.code,
      operationId: row.operation_id,
      bulkLotId: row.bulk_lot_id,
      productId: row.product_id,
      unitsPackaged: row.units_packaged,
      kgAvailableBefore: new Decimal(row.kg_available_before),
      kgConsumed: new Decimal(row.kg_consumed),
      isLastOfLot: row.is_last_of_lot,
      varianceType: row.variance_type,
      varianceKg: new Decimal(row.variance_kg),
      baseCostPerKgSnapshotArs: new Decimal(row.base_cost_per_kg_snapshot_ars),
      unitCostSnapshotArs: new Decimal(row.unit_cost_snapshot_ars),
      totalCostSnapshotArs: new Decimal(row.total_cost_snapshot_ars),
      observations: row.observations,
      createdAt: row.created_at,
    };
  }
}
