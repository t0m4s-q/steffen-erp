import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getCustomerService } from '@/services/composition';
import { serializeCustomer } from '@/actions/customer.dto';
import { CustomersView } from '@/ui/views/CustomersView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Clientes • Steffen ERP',
  description: 'Gestión y administración comercial de clientes de Steffen Cosmética Capilar.',
};

export default async function ClientesPage() {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  // 2. Consulta a través del composition root y CustomerDomainService
  const customerService = getCustomerService();
  const customerRecords = await customerService.listCustomers(true);

  // 3. Serialización estricta a DTO JSON-safe: Decimal convertido a string exacto, nunca a Number
  const initialCustomers = customerRecords.map(serializeCustomer);

  return <CustomersView initialCustomers={initialCustomers} />;
}
