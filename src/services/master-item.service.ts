import { MasterItemRepository, MasterItemRecord, UpdateMasterItemInput } from '@/repositories/master-item.repository';
import { SupplierRepository } from '@/repositories/supplier.repository';
import { SupplierItemRepository, ISupplierItemRepository } from '@/repositories/supplier-item.repository';
import { CodeSequenceService } from './code-sequence.service';
import { StockDomainService } from './stock.service';
import { CostEngineService } from './cost-engine.service';
import { DomainError } from '@/domain/errors';
import { Decimal, toNumericString } from '@/domain/decimal';

export interface CreateRawMaterialDto {
  name: string;
  stockMinimum: Decimal | number | string;
  initialSupplierId: string;
  initialQuotedPriceNet: Decimal | number | string;
  initialStock?: Decimal | number | string;
  inci?: string | null;
  createdDate?: string;
}

export interface CreateComponentDto {
  name: string;
  stockMinimum: number | string;
  initialSupplierId: string;
  initialQuotedPriceNet: Decimal | number | string;
  initialStock?: number | string;
  createdDate?: string;
}

export interface MasterItemWithCostAndBalance extends MasterItemRecord {
  balance: Decimal;
  currentTheoreticalCostGrossArs: Decimal | null;
  referenceSupplierName: string | null;
  referencePriceNet: Decimal | null;
  referenceCurrency: 'ARS' | 'USD' | null;
}

export class MasterItemDomainService {
  constructor(
    private readonly masterItemRepo: MasterItemRepository,
    private readonly supplierRepo: SupplierRepository,
    private readonly codeSequenceService?: CodeSequenceService,
    private readonly stockDomainService: StockDomainService = new StockDomainService(),
    private readonly costEngineService: CostEngineService = new CostEngineService(),
    private readonly supplierItemRepo: ISupplierItemRepository = new SupplierItemRepository()
  ) {}

  async createRawMaterial(dto: CreateRawMaterialDto): Promise<MasterItemRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new DomainError('El nombre de la Materia Prima es obligatorio.');
    }

    const minStock = new Decimal(dto.stockMinimum);
    if (minStock.lessThanOrEqualTo(0)) {
      throw new DomainError('El stock mínimo de la Materia Prima debe ser estrictamente mayor a 0 kg.');
    }

    // Validar precisión máxima de 3 decimales para KG
    this.validateKgPrecision(minStock, 'stock mínimo');

    if (dto.initialStock !== undefined && dto.initialStock !== null) {
      const initStock = new Decimal(dto.initialStock);
      if (initStock.lessThan(0)) {
        throw new DomainError('El stock inicial no puede ser negativo.');
      }
      if (initStock.greaterThan(0)) {
        this.validateKgPrecision(initStock, 'stock inicial');
      }
    }

    // Validar proveedor inicial
    const supplier = await this.supplierRepo.findById(dto.initialSupplierId);
    if (!supplier) {
      throw new DomainError(`Proveedor inicial ${dto.initialSupplierId} no encontrado.`);
    }
    if (!supplier.active) {
      throw new DomainError(`El proveedor ${supplier.name} se encuentra inactivo y no puede ser asignado.`);
    }

    const initialPrice = new Decimal(dto.initialQuotedPriceNet);
    if (initialPrice.lessThanOrEqualTo(0)) {
      throw new DomainError('El precio cotizado inicial debe ser mayor a cero.');
    }

    return this.masterItemRepo.createAtomic({
      itemType: 'MPR',
      name: dto.name.trim(),
      stockMinimum: minStock,
      initialSupplierId: dto.initialSupplierId,
      initialQuotedPriceNet: initialPrice,
      initialStock: dto.initialStock,
      inci: dto.inci ? dto.inci.trim() : null,
      createdDate: dto.createdDate,
    });
  }

  async createComponent(dto: CreateComponentDto): Promise<MasterItemRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new DomainError('El nombre del Componente es obligatorio.');
    }

    const minStock = new Decimal(dto.stockMinimum);
    if (minStock.lessThanOrEqualTo(0) || !minStock.isInteger()) {
      throw new DomainError('El stock mínimo de un Componente debe ser un número entero mayor a 0 unidades.');
    }

    if (dto.initialStock !== undefined && dto.initialStock !== null) {
      const initStock = new Decimal(dto.initialStock);
      if (initStock.lessThan(0)) {
        throw new DomainError('El stock inicial no puede ser negativo.');
      }
      if (initStock.greaterThan(0) && !initStock.isInteger()) {
        throw new DomainError('El stock inicial de un Componente debe ser un número entero de unidades.');
      }
    }

    // Validar proveedor inicial
    const supplier = await this.supplierRepo.findById(dto.initialSupplierId);
    if (!supplier) {
      throw new DomainError(`Proveedor inicial ${dto.initialSupplierId} no encontrado.`);
    }
    if (!supplier.active) {
      throw new DomainError(`El proveedor ${supplier.name} se encuentra inactivo y no puede ser asignado.`);
    }

    const initialPrice = new Decimal(dto.initialQuotedPriceNet);
    if (initialPrice.lessThanOrEqualTo(0)) {
      throw new DomainError('El precio cotizado inicial debe ser mayor a cero.');
    }

    return this.masterItemRepo.createAtomic({
      itemType: 'COM',
      name: dto.name.trim(),
      stockMinimum: minStock,
      initialSupplierId: dto.initialSupplierId,
      initialQuotedPriceNet: initialPrice,
      initialStock: dto.initialStock,
      createdDate: dto.createdDate,
    });
  }

  async updateMasterItem(id: string, dto: UpdateMasterItemInput): Promise<MasterItemRecord> {
    const existing = await this.masterItemRepo.findById(id);
    if (!existing) {
      throw new DomainError(`Ítem con ID ${id} no encontrado.`);
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new DomainError('El nombre no puede estar vacío.');
    }

    if (dto.stockMinimum !== undefined) {
      const minStock = new Decimal(dto.stockMinimum);
      if (minStock.lessThanOrEqualTo(0)) {
        throw new DomainError('El stock mínimo debe ser estrictamente mayor a 0.');
      }
      if (existing.unitType === 'UNIT' && !minStock.isInteger()) {
        throw new DomainError('El stock mínimo de un ítem en unidades debe ser un número entero.');
      }
      if (existing.unitType === 'KG') {
        this.validateKgPrecision(minStock, 'stock mínimo');
      }
    }

    return this.masterItemRepo.update(id, dto);
  }

  async setMasterItemActiveStatus(id: string, active: boolean): Promise<MasterItemRecord> {
    const existing = await this.masterItemRepo.findById(id);
    if (!existing) {
      throw new DomainError(`Ítem con ID ${id} no encontrado.`);
    }

    return this.masterItemRepo.update(id, { active });
  }

  async getMasterItemById(id: string): Promise<MasterItemRecord | null> {
    return this.masterItemRepo.findById(id);
  }

  async listMasterItems(
    itemType?: 'MPR' | 'COM' | 'PRO',
    includeInactive = true
  ): Promise<MasterItemWithCostAndBalance[]> {
    const items = await this.masterItemRepo.listAll(itemType, includeInactive);

    const result: MasterItemWithCostAndBalance[] = [];
    for (const item of items) {
      let balance = new Decimal(0);
      try {
        balance = await this.stockDomainService.getStockBalance(item.id);
      } catch {
        // mantener 0 si no hay balance
      }

      let cost: Decimal | null = null;
      let refSupplierName: string | null = null;
      let refPriceNet: Decimal | null = null;
      let refCurrency: 'ARS' | 'USD' | null = null;

      try {
        cost = await this.costEngineService.getCurrentStockItemCost(item.id);
      } catch {
        // sin costo definido aún
      }

      try {
        const latestSupplierItem = await this.supplierItemRepo.getLatestSupplierItem(item.id);
        if (latestSupplierItem) {
          refSupplierName = latestSupplierItem.supplierName;
          refPriceNet = latestSupplierItem.quotedUnitPriceNet;
          refCurrency = latestSupplierItem.supplierCurrency as 'ARS' | 'USD';
        }
      } catch {
        // sin proveedor asociado aún
      }

      result.push({
        ...item,
        balance,
        currentTheoreticalCostGrossArs: cost,
        referenceSupplierName: refSupplierName,
        referencePriceNet: refPriceNet,
        referenceCurrency: refCurrency,
      });
    }

    return result;
  }

  private validateKgPrecision(val: Decimal, fieldName: string): void {
    const str = toNumericString(val);
    const parts = str.split('.');
    if (parts.length > 1 && parts[1].length > 3) {
      throw new DomainError(`El valor de ${fieldName} en kg no puede tener más de 3 decimales.`);
    }
  }
}
