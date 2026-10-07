import { BaseSupabaseRepository } from './base.repository';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/database/types';

function parseJsonObject(json: Json | undefined): Record<string, Json | undefined> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new DomainError('Respuesta inesperada de la base de datos');
  }
  return json;
}

function parseJsonArray(json: Json | undefined): Json[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json;
}

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
    name: string,
    items: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>,
    observations?: string | null,
    createdDate?: string
  ): Promise<{ baseProduct: BaseProductRecord; formulaVersion: FormulaVersionFullRecord }> {
    const itemsPayload = items.map((item, index) => ({
      raw_material_id: item.rawMaterialId,
      quantity_kg: Number(toNumericString(item.quantityKg)),
      sort_order: item.sortOrder ?? index + 1,
    }));

    const { data, error } = await this.client.rpc('create_base_product_with_formula', {
      p_name: name,
      p_items: itemsPayload,
      p_observations: observations || undefined,
      p_business_date: createdDate || undefined,
    });

    if (error || !data) {
      throw new DomainError(`Error creando Producto Base con fórmula: ${error?.message || 'Sin datos devueltos'}`);
    }

    const resObj = parseJsonObject(data);
    const rawBp = parseJsonObject(resObj.base_product);
    const rawVersion = parseJsonObject(resObj.formula_version);
    const rawItems = parseJsonArray(rawVersion.items);

    return {
      baseProduct: {
        id: String(rawBp.id),
        code: String(rawBp.code),
        name: String(rawBp.name),
        active: Boolean(rawBp.active),
        createdDate: String(rawBp.created_date),
        createdAt: String(rawBp.created_at),
        updatedAt: String(rawBp.updated_at),
      },
      formulaVersion: {
        id: String(rawVersion.id),
        baseProductId: String(rawVersion.base_product_id),
        versionNumber: Number(rawVersion.version_number),
        businessDate: String(rawVersion.business_date),
        observations: rawVersion.observations ? String(rawVersion.observations) : null,
        isCurrent: Boolean(rawVersion.is_current),
        createdAt: String(rawVersion.created_at),
        items: rawItems.map((itemJson) => {
          const r = parseJsonObject(itemJson);
          return {
            id: String(r.id),
            rawMaterialId: String(r.raw_material_id),
            rawMaterialCode: String(r.raw_material_code),
            rawMaterialName: String(r.raw_material_name),
            quantityKg: new Decimal(String(r.quantity_kg)),
            sortOrder: Number(r.sort_order),
          };
        }),
      },
    };
  }

  async createNewFormulaVersion(
    baseProductId: string,
    items: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>,
    observations?: string | null,
    businessDate?: string
  ): Promise<FormulaVersionFullRecord> {
    const itemsPayload = items.map((item, index) => ({
      raw_material_id: item.rawMaterialId,
      quantity_kg: Number(toNumericString(item.quantityKg)),
      sort_order: item.sortOrder ?? index + 1,
    }));

    const { data, error } = await this.client.rpc('create_new_formula_version', {
      p_base_product_id: baseProductId,
      p_items: itemsPayload,
      p_observations: observations || undefined,
      p_business_date: businessDate || undefined,
    });

    if (error || !data) {
      throw new DomainError(`Error creando nueva versión de fórmula: ${error?.message || 'Sin datos devueltos'}`);
    }

    const resObj = parseJsonObject(data);
    const rawItems = parseJsonArray(resObj.items);

    return {
      id: String(resObj.id),
      baseProductId: String(resObj.base_product_id),
      versionNumber: Number(resObj.version_number),
      businessDate: String(resObj.business_date),
      observations: resObj.observations ? String(resObj.observations) : null,
      isCurrent: Boolean(resObj.is_current),
      createdAt: String(resObj.created_at),
      items: rawItems.map((itemJson) => {
        const r = parseJsonObject(itemJson);
        return {
          id: String(r.id),
          rawMaterialId: String(r.raw_material_id),
          rawMaterialCode: String(r.raw_material_code),
          rawMaterialName: String(r.raw_material_name),
          quantityKg: new Decimal(String(r.quantity_kg)),
          sortOrder: Number(r.sort_order),
        };
      }),
    };
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
        raw_materials:raw_material_id (
          stock_item_id,
          stock_items (
            code,
            name
          )
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
      rawMaterialCode: row.raw_materials?.stock_items?.code || '',
      rawMaterialName: row.raw_materials?.stock_items?.name || '',
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
