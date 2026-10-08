import 'server-only';
import { serverSupabase } from '@/database/server';
import { CustomerRepository } from '@/repositories/customer.repository';
import { CustomerDomainService } from '@/services/customer.service';
import { SupplierRepository } from '@/repositories/supplier.repository';
import { SupplierDomainService } from '@/services/supplier.service';
import { MasterItemRepository } from '@/repositories/master-item.repository';
import { MasterItemDomainService } from '@/services/master-item.service';
import { StockRepository } from '@/repositories/stock.repository';
import { StockDomainService } from '@/services/stock.service';
import { SupplierItemRepository } from '@/repositories/supplier-item.repository';
import { CostEngineService } from '@/services/cost-engine.service';

import { FormulaRepository } from '@/repositories/formula.repository';
import { FormulaDomainService } from '@/services/formula.service';
import { ProductRepository } from '@/repositories/product.repository';
import { ProductDomainService } from '@/services/product.service';

/**
 * Composition Root para instanciación controlada y unificada de servicios
 * del lado servidor. Aísla service_role de Client Components y previene
 * instanciaciones ad-hoc repetitivas en cada Server Action.
 */
let customerServiceInstance: CustomerDomainService | null = null;
let supplierServiceInstance: SupplierDomainService | null = null;
let masterItemServiceInstance: MasterItemDomainService | null = null;
let formulaServiceInstance: FormulaDomainService | null = null;
let costEngineServiceInstance: CostEngineService | null = null;
let productServiceInstance: ProductDomainService | null = null;

export function getCustomerService(): CustomerDomainService {
  if (!customerServiceInstance) {
    const customerRepo = new CustomerRepository(serverSupabase);
    customerServiceInstance = new CustomerDomainService(customerRepo);
  }
  return customerServiceInstance;
}

export function getSupplierService(): SupplierDomainService {
  if (!supplierServiceInstance) {
    const supplierRepo = new SupplierRepository(serverSupabase);
    supplierServiceInstance = new SupplierDomainService(supplierRepo);
  }
  return supplierServiceInstance;
}

export function getCostEngineService(): CostEngineService {
  if (!costEngineServiceInstance) {
    const supplierItemRepo = new SupplierItemRepository(serverSupabase);
    const formulaRepo = new FormulaRepository(serverSupabase);
    const productRepo = new ProductRepository(serverSupabase);
    costEngineServiceInstance = new CostEngineService(supplierItemRepo, formulaRepo, productRepo);
  }
  return costEngineServiceInstance;
}

export function getMasterItemService(): MasterItemDomainService {
  if (!masterItemServiceInstance) {
    const masterItemRepo = new MasterItemRepository(serverSupabase);
    const supplierRepo = new SupplierRepository(serverSupabase);
    const stockRepo = new StockRepository(serverSupabase);
    const stockDomainService = new StockDomainService(stockRepo);
    const supplierItemRepo = new SupplierItemRepository(serverSupabase);
    const costEngineService = getCostEngineService();
    masterItemServiceInstance = new MasterItemDomainService(
      masterItemRepo,
      supplierRepo,
      undefined,
      stockDomainService,
      costEngineService,
      supplierItemRepo
    );
  }
  return masterItemServiceInstance;
}

export function getFormulaService(): FormulaDomainService {
  if (!formulaServiceInstance) {
    const formulaRepo = new FormulaRepository(serverSupabase);
    const masterItemRepo = new MasterItemRepository(serverSupabase);
    const costEngineService = getCostEngineService();
    formulaServiceInstance = new FormulaDomainService(
      formulaRepo,
      masterItemRepo,
      costEngineService
    );
  }
  return formulaServiceInstance;
}

export function getProductService(): ProductDomainService {
  if (!productServiceInstance) {
    const productRepo = new ProductRepository(serverSupabase);
    const formulaRepo = new FormulaRepository(serverSupabase);
    const costEngineService = getCostEngineService();
    const stockRepo = new StockRepository(serverSupabase);
    const stockDomainService = new StockDomainService(stockRepo);
    productServiceInstance = new ProductDomainService(
      productRepo,
      formulaRepo,
      costEngineService,
      stockDomainService
    );
  }
  return productServiceInstance;
}

