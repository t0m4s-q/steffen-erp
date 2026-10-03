import {
  FormulaRepository,
  BaseProductRecord,
  FormulaVersionFullRecord,
} from '@/repositories/formula.repository';
import { MasterItemRepository } from '@/repositories/master-item.repository';
import { CodeSequenceService } from './code-sequence.service';
import { CostEngineService } from './cost-engine.service';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface FormulaItemInput {
  rawMaterialId: string;
  quantityKg: Decimal | number | string;
  sortOrder?: number;
}

export interface CreateFormulaDto {
  name: string;
  items: FormulaItemInput[];
  observations?: string | null;
  createdDate?: string;
}

export interface NewFormulaVersionDto {
  baseProductId: string;
  items: FormulaItemInput[];
  observations?: string | null;
  businessDate?: string;
}

export interface FormulaCostLine {
  rawMaterialId: string;
  rawMaterialCode: string;
  rawMaterialName: string;
  quantityKg: Decimal;
  unitCostGrossArs: Decimal;
  lineCostArs: Decimal;
  sortOrder: number;
}

export interface FormulaCostBreakdown {
  lines: FormulaCostLine[];
  totalKgBulk: Decimal;
  totalCostBulkArs: Decimal;
  costPerKgPbaArs: Decimal;
}

export interface BaseProductWithCurrentCost extends BaseProductRecord {
  currentVersionNumber: number | null;
  currentFormulaBreakdown: FormulaCostBreakdown | null;
}

export class FormulaDomainService {
  constructor(
    private readonly formulaRepo: FormulaRepository,
    private readonly masterItemRepo: MasterItemRepository,
    private readonly codeSequenceService: CodeSequenceService,
    private readonly costEngineService: CostEngineService
  ) {}

  async createFormulaAndBaseProduct(dto: CreateFormulaDto): Promise<{
    baseProduct: BaseProductRecord;
    formulaVersion: FormulaVersionFullRecord;
    costBreakdown: FormulaCostBreakdown;
  }> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new DomainError('El nombre del Producto Base es obligatorio.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new DomainError('Una fórmula debe contener al menos una Materia Prima.');
    }

    // Validar anti-duplicados y consistencia de MPR
    const sanitizedItems = await this.validateAndSanitizeItems(dto.items);

    // 1. Generar código automático PBAxxxx
    const code = await this.codeSequenceService.generateVisibleCode('PBA');

    // 2. Crear base_products + formula_versions v1
    const { baseProduct, formulaVersion } = await this.formulaRepo.createBaseProductWithFormula(
      code,
      dto.name.trim(),
      sanitizedItems,
      dto.observations,
      dto.createdDate
    );

    // 3. Calcular desglose de costos
    const costBreakdown = await this.calculateFormulaCostBreakdown(formulaVersion.items);

    return {
      baseProduct,
      formulaVersion,
      costBreakdown,
    };
  }

  async createNewFormulaVersion(dto: NewFormulaVersionDto): Promise<{
    formulaVersion: FormulaVersionFullRecord;
    costBreakdown: FormulaCostBreakdown;
  }> {
    const baseProduct = await this.formulaRepo.getBaseProductById(dto.baseProductId);
    if (!baseProduct) {
      throw new DomainError(`Producto Base con ID ${dto.baseProductId} no encontrado.`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new DomainError('Una versión de fórmula debe contener al menos una Materia Prima.');
    }

    // Validar anti-duplicados y consistencia de MPR
    const sanitizedItems = await this.validateAndSanitizeItems(dto.items);

    // Crear nueva versión incrementando version_number
    const formulaVersion = await this.formulaRepo.createNewFormulaVersion(
      dto.baseProductId,
      sanitizedItems,
      dto.observations,
      dto.businessDate
    );

    // Calcular desglose de costos
    const costBreakdown = await this.calculateFormulaCostBreakdown(formulaVersion.items);

    return {
      formulaVersion,
      costBreakdown,
    };
  }

  async listBaseProducts(includeInactive = true): Promise<BaseProductWithCurrentCost[]> {
    const baseProducts = await this.formulaRepo.listBaseProducts(includeInactive);

    const result: BaseProductWithCurrentCost[] = [];
    for (const bp of baseProducts) {
      const currentFormula = await this.formulaRepo.getCurrentFormulaWithItems(bp.id);
      let breakdown: FormulaCostBreakdown | null = null;
      let versionNum: number | null = null;

      if (currentFormula) {
        versionNum = currentFormula.versionNumber;
        try {
          const fullVersion = await this.formulaRepo.getFormulaVersionWithItems(currentFormula.formulaVersionId);
          if (fullVersion) {
            breakdown = await this.calculateFormulaCostBreakdown(fullVersion.items);
          }
        } catch {
          // Si no puede calcularse costo temporalmente
        }
      }

      result.push({
        ...bp,
        currentVersionNumber: versionNum,
        currentFormulaBreakdown: breakdown,
      });
    }

    return result;
  }

  async getBaseProductDetails(id: string): Promise<{
    baseProduct: BaseProductRecord;
    versions: Array<{
      version: FormulaVersionFullRecord;
      costBreakdown: FormulaCostBreakdown;
    }>;
  } | null> {
    const baseProduct = await this.formulaRepo.getBaseProductById(id);
    if (!baseProduct) return null;

    const allVersions = await this.formulaRepo.getAllVersionsForBaseProduct(id);
    const versionsWithCosts = [];

    for (const v of allVersions) {
      const costBreakdown = await this.calculateFormulaCostBreakdown(v.items);
      versionsWithCosts.push({
        version: v,
        costBreakdown,
      });
    }

    return {
      baseProduct,
      versions: versionsWithCosts,
    };
  }

  async setBaseProductActiveStatus(id: string, active: boolean): Promise<BaseProductRecord> {
    const existing = await this.formulaRepo.getBaseProductById(id);
    if (!existing) {
      throw new DomainError(`Producto Base con ID ${id} no encontrado.`);
    }

    return this.formulaRepo.setBaseProductActive(id, active);
  }

  async calculateFormulaCostBreakdown(
    items: Array<{
      rawMaterialId: string;
      rawMaterialCode: string;
      rawMaterialName: string;
      quantityKg: Decimal;
      sortOrder: number;
    }>
  ): Promise<FormulaCostBreakdown> {
    let totalKg = new Decimal(0);
    let totalCost = new Decimal(0);
    const lines: FormulaCostLine[] = [];

    for (const item of items) {
      let unitCost = new Decimal(0);
      try {
        const costData = await this.costEngineService.getCurrentStockItemCost(item.rawMaterialId);
        unitCost = costData.unitCostGrossArs;
      } catch {
        unitCost = new Decimal(0);
      }

      const lineCost = item.quantityKg.times(unitCost);
      totalKg = totalKg.plus(item.quantityKg);
      totalCost = totalCost.plus(lineCost);

      lines.push({
        rawMaterialId: item.rawMaterialId,
        rawMaterialCode: item.rawMaterialCode,
        rawMaterialName: item.rawMaterialName,
        quantityKg: item.quantityKg,
        unitCostGrossArs: unitCost,
        lineCostArs: lineCost,
        sortOrder: item.sortOrder,
      });
    }

    const costPerKg = totalKg.greaterThan(0) ? totalCost.dividedBy(totalKg) : new Decimal(0);

    return {
      lines,
      totalKgBulk: totalKg,
      totalCostBulkArs: totalCost,
      costPerKgPbaArs: costPerKg,
    };
  }

  private async validateAndSanitizeItems(
    items: FormulaItemInput[]
  ): Promise<Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }>> {
    const seenMprIds = new Set<string>();
    const sanitized: Array<{ rawMaterialId: string; quantityKg: Decimal; sortOrder?: number }> = [];

    for (const it of items) {
      if (!it.rawMaterialId) {
        throw new DomainError('Se debe especificar la Materia Prima para cada fila de la fórmula.');
      }

      // Regla de Negocio: una misma MPR no puede repetirse en una versión
      if (seenMprIds.has(it.rawMaterialId)) {
        throw new DomainError(
          `La Materia Prima con ID ${it.rawMaterialId} está duplicada en la fórmula. Cada MPR solo puede aparecer una vez por versión.`
        );
      }
      seenMprIds.add(it.rawMaterialId);

      // Validar que la MPR exista y esté activa
      const mpr = await this.masterItemRepo.findById(it.rawMaterialId);
      if (!mpr) {
        throw new DomainError(`Materia Prima ${it.rawMaterialId} no existe.`);
      }
      if (!mpr.active) {
        throw new DomainError(`La Materia Prima ${mpr.code} (${mpr.name}) está inactiva y no puede utilizarse en una nueva fórmula.`);
      }

      const qty = new Decimal(it.quantityKg);
      if (qty.lessThanOrEqualTo(0)) {
        throw new DomainError(`La cantidad de ${mpr.name} debe ser mayor a 0 kg.`);
      }

      // Máximo 3 decimales para kg
      const str = qty.toNumericString();
      const parts = str.split('.');
      if (parts.length > 1 && parts[1].length > 3) {
        throw new DomainError(`La cantidad en kg para ${mpr.name} no puede exceder 3 decimales.`);
      }

      sanitized.push({
        rawMaterialId: it.rawMaterialId,
        quantityKg: qty,
        sortOrder: it.sortOrder,
      });
    }

    return sanitized;
  }
}
