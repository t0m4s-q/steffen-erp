import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getMasterItemService, getSupplierService } from '@/services/composition';
import { serializeRawMaterial, type SupplierOptionDTO } from '@/actions/master-item.dto';
import { RawMaterialsView } from '@/ui/views/RawMaterialsView';
import { Decimal } from '@/domain/decimal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock de Materias Primas • Steffen ERP',
  description: 'Control de inventario, materias primas a granel, cotizaciones y umbrales mínimos de stock.',
};

export default async function StockPage() {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  // 2. Consulta de materias primas y proveedores activos
  const masterItemService = getMasterItemService();
  const supplierService = getSupplierService();

  const [rawMaterialRecords, supplierRecords] = await Promise.all([
    masterItemService.listMasterItems('MPR', true),
    supplierService.listSuppliers(false), // solo proveedores activos
  ]);

  // 3. Ordenamiento normativo por ratio de stock: stock_actual / stock_minimo ASC
  // Resuelto en servidor con aritmética exacta Decimal (sin floating-point de JS)
  const sortedRecords = [...rawMaterialRecords].sort((a, b) => {
    const minA = a.stockMinimum && a.stockMinimum.gt(0) ? a.stockMinimum : new Decimal(1);
    const minB = b.stockMinimum && b.stockMinimum.gt(0) ? b.stockMinimum : new Decimal(1);
    const ratioA = a.balance.dividedBy(minA);
    const ratioB = b.balance.dividedBy(minB);

    if (!ratioA.equals(ratioB)) {
      return ratioA.comparedTo(ratioB);
    }
    return a.code.localeCompare(b.code);
  });

  // 4. Serialización estricta a DTOs JSON-safe
  const initialRawMaterials = sortedRecords.map(serializeRawMaterial);

  const activeSuppliers: SupplierOptionDTO[] = supplierRecords.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    currencyCode: s.currencyCode,
  }));

  return (
    <RawMaterialsView
      initialRawMaterials={initialRawMaterials}
      activeSuppliers={activeSuppliers}
    />
  );
}
