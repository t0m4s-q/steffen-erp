import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getSupplierService } from '@/services/composition';
import { serializeSupplier } from '@/actions/supplier.dto';
import { SuppliersView } from '@/ui/views/SuppliersView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Proveedores • Steffen ERP',
  description: 'Gestión y administración de proveedores de insumos de Steffen Cosmética Capilar.',
};

export default async function ProveedoresPage() {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  // 2. Consulta a través del composition root y SupplierDomainService
  const supplierService = getSupplierService();
  const supplierRecords = await supplierService.listSuppliers(true);

  // 3. Serialización estricta a DTO JSON-safe: Decimal convertido a string exacto, nunca a Number
  const initialSuppliers = supplierRecords.map(serializeSupplier);

  return <SuppliersView initialSuppliers={initialSuppliers} />;
}
