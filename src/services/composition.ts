import 'server-only';
import { serverSupabase } from '@/database/server';
import { CustomerRepository } from '@/repositories/customer.repository';
import { CustomerDomainService } from '@/services/customer.service';

/**
 * Composition Root para instanciación controlada y unificada de servicios
 * del lado servidor. Aísla service_role de Client Components y previene
 * instanciaciones ad-hoc repetitivas en cada Server Action.
 */
let customerServiceInstance: CustomerDomainService | null = null;

export function getCustomerService(): CustomerDomainService {
  if (!customerServiceInstance) {
    const customerRepo = new CustomerRepository(serverSupabase);
    customerServiceInstance = new CustomerDomainService(customerRepo);
  }
  return customerServiceInstance;
}
