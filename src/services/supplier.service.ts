import { SupplierRepository, SupplierRecord, SupplierItemRecord } from '@/repositories/supplier.repository';
import { CodeSequenceService } from './code-sequence.service';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export interface CreateSupplierDto {
  name: string;
  salesperson?: string | null;
  phone?: string | null;
  currencyCode: 'ARS' | 'USD';
  createdDate?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  salesperson?: string | null;
  phone?: string | null;
  active?: boolean;
}

export class SupplierDomainService {
  constructor(
    private readonly supplierRepo: SupplierRepository,
    private readonly codeSequenceService: CodeSequenceService
  ) {}

  async createSupplier(dto: CreateSupplierDto): Promise<SupplierRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new DomainError('El nombre del proveedor es obligatorio.');
    }

    if (!dto.currencyCode || !['ARS', 'USD'].includes(dto.currencyCode)) {
      throw new DomainError('La moneda del proveedor es obligatoria y debe ser ARS o USD.');
    }

    // Generar código automático PRVxxxx
    const code = await this.codeSequenceService.generateVisibleCode('PRV');

    return this.supplierRepo.create({
      code,
      name: dto.name.trim(),
      salesperson: dto.salesperson ? dto.salesperson.trim() : null,
      phone: dto.phone ? dto.phone.trim() : null,
      currencyCode: dto.currencyCode,
      createdDate: dto.createdDate,
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<SupplierRecord> {
    const existing = await this.supplierRepo.findById(id);
    if (!existing) {
      throw new DomainError(`Proveedor con ID ${id} no encontrado.`);
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new DomainError('El nombre del proveedor no puede estar vacío.');
    }

    return this.supplierRepo.update(id, {
      name: dto.name ? dto.name.trim() : undefined,
      salesperson: dto.salesperson !== undefined ? dto.salesperson?.trim() || null : undefined,
      phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
      active: dto.active,
    });
  }

  async setSupplierActiveStatus(id: string, active: boolean): Promise<SupplierRecord> {
    const existing = await this.supplierRepo.findById(id);
    if (!existing) {
      throw new DomainError(`Proveedor con ID ${id} no encontrado.`);
    }

    return this.supplierRepo.update(id, { active });
  }

  async getSupplierById(id: string): Promise<{ supplier: SupplierRecord; items: SupplierItemRecord[] } | null> {
    const supplier = await this.supplierRepo.findById(id);
    if (!supplier) return null;

    const items = await this.supplierRepo.getSupplierItems(id);
    return { supplier, items };
  }

  async listSuppliers(includeInactive = true): Promise<SupplierRecord[]> {
    return this.supplierRepo.listAll(includeInactive);
  }

  async setSupplierItemPrice(
    supplierId: string,
    stockItemId: string,
    quotedUnitPriceNet: Decimal | number | string
  ): Promise<SupplierItemRecord> {
    const supplier = await this.supplierRepo.findById(supplierId);
    if (!supplier) {
      throw new DomainError(`Proveedor ${supplierId} no encontrado.`);
    }

    const price = new Decimal(quotedUnitPriceNet);
    if (price.lessThanOrEqualTo(0)) {
      throw new DomainError('El precio cotizado del insumo debe ser mayor a cero.');
    }

    return this.supplierRepo.upsertSupplierItem(supplierId, stockItemId, price);
  }
}
