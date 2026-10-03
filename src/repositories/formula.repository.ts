import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';

export interface FormulaVersionItemRecord {
  id: string;
  rawMaterialId: string;
  rawMaterialCode: string;
  rawMaterialName: string;
  quantityKg: Decimal;
  sortOrder: number;
}

export interface FormulaVersionFullRecord {
  id: string;
  baseProductId: string;
  versionNumber: number;
  businessDate: string;
  observations: string | null;
  isCurrent: boolean;
  createdAt: string;
  items: FormulaVersionItemRecord[];
}

export interface BaseProductRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentFormulaRecord {
  formulaVersionId: string;
  baseProductId: string;
  versionNumber: number;
  items: Array<{
    id: string;
    rawMaterialId: string;
    quantityKg: Decimal;
    sortOrder: number;
  }>;
}

export interface IFormulaRepository {
  getCurrentFormulaWithItems(baseProductId: string): Promise<CurrentFormulaRecord | null>;
  createBaseProductWithFormula(
    code: string,
    name: string,
    items: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>,
    observations?: string | null,
    createdDate?: string
  ): Promise<{ baseProduct: BaseProductRecord; formulaVersion: FormulaVersionFullRecord }>;
  createNewFormulaVersion(
    baseProductId: string,
    items: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>,
    observations?: string | null,
    businessDate?: string
  ): Promise<FormulaVersionFullRecord>;
  getBaseProductById(id: string): Promise<BaseProductRecord | null>;
  listBaseProducts(includeInactive?: boolean): Promise<BaseProductRecord[]>;
  getAllVersionsForBaseProduct(baseProductId: string): Promise<FormulaVersionFullRecord[]>;
  setBaseProductActive(id: string, active: boolean): Promise<BaseProductRecord>;
}

export class FormulaRepository extends BaseSupabaseRepository implements IFormulaRepository {
  async getCurrentFormulaWithItems(baseProductId: string): Promise<CurrentFormulaRecord | null> {
    const { data: versionData, error: vErr } = await this.client
      .from('formula_versions')
      .select('id, base_product_id, version_number')
      .eq('base_product_id', baseProductId)
      .eq('is_current', true)
      .limit(1);

    if (vErr) {
      throw new DomainError(`Error obteniendo fórmula vigente para PBA ${baseProductId}: ${vErr.message}`);
    }

    if (!versionData || versionData.length === 0) {
      return null;
    }

    const version = versionData[0] as unknown as { id: string; base_product_id: string; version_number: number };

    const { data: itemsData, error: iErr } = await this.client
      .from('formula_version_items')
      .select('id, raw_material_id, quantity_kg, sort_order')
      .eq('formula_version_id', version.id)
      .order('sort_order', { ascending: true });

    if (iErr) {
      throw new DomainError(`Error obteniendo items de fórmula ${version.id}: ${iErr.message}`);
    }

    const rawItems = (itemsData || []) as unknown as Array<{
      id: string;
      raw_material_id: string;
      quantity_kg: string | number;
      sort_order: number;
    }>;

    return {
      formulaVersionId: version.id,
      baseProductId: version.base_product_id,
      versionNumber: version.version_number,
      items: rawItems.map((r) => ({
        id: r.id,
        rawMaterialId: r.raw_material_id,
        quantityKg: new Decimal(r.quantity_kg),
        sortOrder: r.sort_order,
      })),
    };
  }

  async createBaseProductWithFormula(
    code: string,
    name: string,
    items: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>,
    observations?: string | null,
    createdDate?: string
  ): Promise<{ baseProduct: BaseProductRecord; formulaVersion: FormulaVersionFullRecord }> {
    const today = createdDate || new Date().toISOString().split('T')[0];

    // 1. Crear base_products
    const { data: bpData, error: bpErr } = await this.client
      .from('base_products')
      .insert({
        code,
        name,
        created_date: today,
        active: true,
      })
      .select('*')
      .single();

    if (bpErr || !bpData) {
      throw new DomainError(`Error creando Producto Base: ${bpErr?.message || 'Sin datos devueltos'}`);
    }

    const baseProductId = bpData.id;

    // 2. Crear formula_versions v1
    const { data: vData, error: vErr } = await this.client
      .from('formula_versions')
      .insert({
        base_product_id: baseProductId,
        version_number: 1,
        is_current: true,
        observations: observations || null,
        business_date: today,
      })
      .select('*')
      .single();

    if (vErr || !vData) {
      throw new DomainError(`Error creando versión 1 de fórmula: ${vErr?.message || 'Sin datos devueltos'}`);
    }

    const versionId = vData.id;

    // 3. Crear formula_version_items
    const itemsPayload = items.map((item, index) => ({
      formula_version_id: versionId,
      raw_material_id: item.rawMaterialId,
      quantity_kg: Number(toNumericString(item.quantityKg)),
      sort_order: item.sortOrder ?? index + 1,
    }));

    const { error: itemsErr } = await this.client
      .from('formula_version_items')
      .insert(itemsPayload);

    if (itemsErr) {
      throw new DomainError(`Error creando items de fórmula: ${itemsErr.message}`);
    }

    const fullVersion = await this.getFormulaVersionWithItems(versionId);

    return {
      baseProduct: {
        id: bpData.id,
        code: bpData.code,
        name: bpData.name,
        active: bpData.active,
        createdDate: bpData.created_date,
        createdAt: bpData.created_at,
        updatedAt: bpData.updated_at,
      },
      formulaVersion: fullVersion!,
    };
  }

  async createNewFormulaVersion(
    baseProductId: string,
    items: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>,
    observations?: string | null,
    businessDate?: string
  ): Promise<FormulaVersionFullRecord> {
    const today = businessDate || new Date().toISOString().split('T')[0];

    // Obtener versión vigente actual
    const current = await this.getCurrentFormulaWithItems(baseProductId);
    const nextVersionNumber = current ? current.versionNumber + 1 : 1;

    // Desactivar versión vigente anterior
    if (current) {
      await this.client
        .from('formula_versions')
        .update({ is_current: false })
        .eq('id', current.formulaVersionId);
    }

    // Insertar nueva versión vigente
    const { data: newVData, error: newVErr } = await this.client
      .from('formula_versions')
      .insert({
        base_product_id: baseProductId,
        version_number: nextVersionNumber,
        is_current: true,
        observations: observations || null,
        business_date: today,
      })
      .select('*')
      .single();

    if (newVErr || !newVData) {
      throw new DomainError(`Error creando nueva versión de fórmula: ${newVErr?.message || 'Sin datos'}`);
    }

    const newVersionId = newVData.id;

    // Insertar items de la nueva versión
    const itemsPayload = items.map((item, index) => ({
      formula_version_id: newVersionId,
      raw_material_id: item.rawMaterialId,
      quantity_kg: Number(toNumericString(item.quantityKg)),
      sort_order: item.sortOrder ?? index + 1,
    }));

    const { error: itemsErr } = await this.client
      .from('formula_version_items')
      .insert(itemsPayload);

    if (itemsErr) {
      throw new DomainError(`Error insertando items en versión ${nextVersionNumber}: ${itemsErr.message}`);
    }

    const fullVersion = await this.getFormulaVersionWithItems(newVersionId);
    return fullVersion!;
  }

  async getFormulaVersionWithItems(versionId: string): Promise<FormulaVersionFullRecord | null> {
    const { data: vData, error: vErr } = await this.client
      .from('formula_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (vErr || !vData) return null;

    const { data: itemsData, error: iErr } = await this.client
      .from('formula_version_items')
      .select(`
        id,
        formula_version_id,
        raw_material_id,
        quantity_kg,
        sort_order,
        stock_items:raw_material_id (
          code,
          name
        )
      `)
      .eq('formula_version_id', versionId)
      .order('sort_order', { ascending: true });

    if (iErr) {
      throw new DomainError(`Error obteniendo items de versión ${versionId}: ${iErr.message}`);
    }

    const items: FormulaVersionItemRecord[] = (itemsData || []).map((row: any) => ({
      id: row.id,
      rawMaterialId: row.raw_material_id,
      rawMaterialCode: row.stock_items?.code || '',
      rawMaterialName: row.stock_items?.name || '',
      quantityKg: new Decimal(row.quantity_kg),
      sortOrder: row.sort_order,
    }));

    return {
      id: vData.id,
      baseProductId: vData.base_product_id,
      versionNumber: vData.version_number,
      businessDate: vData.business_date,
      observations: vData.observations,
      isCurrent: vData.is_current,
      createdAt: vData.created_at,
      items,
    };
  }

  async getBaseProductById(id: string): Promise<BaseProductRecord | null> {
    const { data, error } = await this.client
      .from('base_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      active: data.active,
      createdDate: data.created_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listBaseProducts(includeInactive = true): Promise<BaseProductRecord[]> {
    let query = this.client.from('base_products').select('*').order('code', { ascending: true });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new DomainError(`Error listando Productos Base: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      active: row.active,
      createdDate: row.created_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getAllVersionsForBaseProduct(baseProductId: string): Promise<FormulaVersionFullRecord[]> {
    const { data: vList, error: vErr } = await this.client
      .from('formula_versions')
      .select('id')
      .eq('base_product_id', baseProductId)
      .order('version_number', { ascending: false });

    if (vErr) {
      throw new DomainError(`Error listando versiones de PBA ${baseProductId}: ${vErr.message}`);
    }

    const versions: FormulaVersionFullRecord[] = [];
    for (const v of vList || []) {
      const full = await this.getFormulaVersionWithItems(v.id);
      if (full) versions.push(full);
    }

    return versions;
  }

  async setBaseProductActive(id: string, active: boolean): Promise<BaseProductRecord> {
    const { data, error } = await this.client
      .from('base_products')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new DomainError(`Error actualizando estado de PBA ${id}: ${error?.message || 'No encontrado'}`);
    }

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      active: data.active,
      createdDate: data.created_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
