import { CustomerRepository, CustomerRecord, CreateCustomerInput, UpdateCustomerInput } from '@/repositories/customer.repository';
import { CodeSequenceService } from './code-sequence.service';
import { DomainError } from '@/domain/errors';
import { Decimal } from '@/domain/decimal';

export class CustomerDomainService {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly codeSequenceService?: CodeSequenceService
  ) {}

  async createCustomer(dto: Omit<CreateCustomerInput, 'code'>): Promise<CustomerRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new DomainError('El nombre del cliente es obligatorio.');
    }

    this.validateDiscounts(dto.discount1Pct, dto.discount2Pct, dto.discount3Pct);

    return this.customerRepo.create({
      ...dto,
      name: dto.name.trim(),
    });
  }

  async updateCustomer(id: string, dto: UpdateCustomerInput): Promise<CustomerRecord> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new DomainError(`Cliente con ID ${id} no encontrado.`);
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new DomainError('El nombre del cliente no puede estar vacío.');
    }

    this.validateDiscounts(dto.discount1Pct, dto.discount2Pct, dto.discount3Pct);

    return this.customerRepo.update(id, dto);
  }

  async setCustomerActiveStatus(id: string, active: boolean): Promise<CustomerRecord> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new DomainError(`Cliente con ID ${id} no encontrado.`);
    }

    return this.customerRepo.update(id, { active });
  }

  async getCustomerById(id: string): Promise<CustomerRecord | null> {
    return this.customerRepo.findById(id);
  }

  async listCustomers(includeInactive = true): Promise<CustomerRecord[]> {
    return this.customerRepo.listAll(includeInactive);
  }

  /**
   * Aplica descuentos sucesivos según la regla de negocio oficial de Steffen:
   * Precio = Subtotal × (1 - d1) × (1 - d2) × (1 - d3)
   * Los porcentajes NO se suman directamente.
   */
  calculateSuccessiveDiscounts(
    baseAmount: Decimal | number | string,
    discounts: Array<Decimal | number | string>
  ): {
    finalAmount: Decimal;
    totalDiscountAmount: Decimal;
    stepAmounts: Decimal[];
  } {
    let current = new Decimal(baseAmount);
    const stepAmounts: Decimal[] = [];

    for (const d of discounts) {
      const pct = new Decimal(d);
      if (pct.greaterThan(0)) {
        const factor = new Decimal(1).minus(pct.dividedBy(100));
        current = current.times(factor);
        stepAmounts.push(current);
      }
    }

    const initial = new Decimal(baseAmount);
    const totalDiscountAmount = initial.minus(current);

    return {
      finalAmount: current,
      totalDiscountAmount,
      stepAmounts,
    };
  }

  private validateDiscounts(
    d1?: Decimal | number,
    d2?: Decimal | number,
    d3?: Decimal | number
  ): void {
    const discounts = [d1, d2, d3];
    for (let i = 0; i < discounts.length; i++) {
      const val = discounts[i];
      if (val !== undefined && val !== null) {
        const dec = new Decimal(val);
        if (dec.lessThan(0) || dec.greaterThan(100)) {
          throw new DomainError(`El descuento ${i + 1} debe estar entre 0% y 100%.`);
        }
      }
    }
  }
}
