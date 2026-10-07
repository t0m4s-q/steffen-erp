import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getMasterItemService, getSupplierService } from '@/services/composition';
import {
  serializeRawMaterial,
  serializeComponent,
  type SupplierOptionDTO,
} from '@/actions/master-item.dto';
import { RawMaterialsView } from '@/ui/views/RawMaterialsView';
import { Decimal } from '@/domain/decimal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock de Insumos • Steffen ERP',
  description: 'Control de inventario de Materias Primas y Componentes, cotizaciones y umbrales mínimos de stock.',
};

export default async function StockPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const defaultTab = searchParams.tab === 'componentes' ? 'COM' : 'MPR';

  // 2. Consulta de materias primas, componentes y proveedores activos en paralelo
  const masterItemService = getMasterItemService();
  const supplierService = getSupplierService();

  const [rawMaterialRecords, componentRecords, supplierRecords] = await Promise.all([
    masterItemService.listMasterItems('MPR', true),
    masterItemService.listMasterItems('COM', true),
    supplierService.listSuppliers(false), // solo proveedores activos
  ]);

  // 3. Ordenamiento normativo por ratio de stock: stock_actual / stock_minimo ASC
  // Resuelto en servidor con aritmética exacta Decimal (sin floating-point de JS)
  const sortedRawMaterials = [...rawMaterialRecords].sort((a, b) => {
    const minA = a.stockMinimum && a.stockMinimum.gt(0) ? a.stockMinimum : new Decimal(1);
    const minB = b.stockMinimum && b.stockMinimum.gt(0) ? b.stockMinimum : new Decimal(1);
    const ratioA = a.balance.dividedBy(minA);
    const ratioB = b.balance.dividedBy(minB);

    if (!ratioA.equals(ratioB)) {
      return ratioA.comparedTo(ratioB);
    }
    return a.code.localeCompare(b.code);
  });

  const sortedComponents = [...componentRecords].sort((a, b) => {
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
  const initialRawMaterials = sortedRawMaterials.map(serializeRawMaterial);
  const initialComponents = sortedComponents.map(serializeComponent);

  const activeSuppliers: SupplierOptionDTO[] = supplierRecords.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    currencyCode: s.currencyCode,
  }));

  return (
    <RawMaterialsView
      initialRawMaterials={initialRawMaterials}
      initialComponents={initialComponents}
      activeSuppliers={activeSuppliers}
      defaultTab={defaultTab}
    />
  );
}
