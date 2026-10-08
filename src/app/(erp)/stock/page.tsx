import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import {
  getMasterItemService,
  getSupplierService,
  getProductService,
  getFormulaService,
} from '@/services/composition';
import {
  serializeRawMaterial,
  serializeComponent,
  type SupplierOptionDTO,
} from '@/actions/master-item.dto';
import {
  serializeFinalProduct,
  type BaseProductOptionDTO,
  type ComponentOptionDTO,
} from '@/actions/product.dto';
import { RawMaterialsView } from '@/ui/views/RawMaterialsView';
import { Decimal, toNumericString } from '@/domain/decimal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock de Productos e Insumos • Steffen ERP',
  description: 'Control de inventario de Productos Finales, Materias Primas y Componentes, cotizaciones y costos teóricos.',
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
  let defaultTab: 'PRO' | 'MPR' | 'COM' = 'PRO';
  if (searchParams.tab === 'componentes') {
    defaultTab = 'COM';
  } else if (searchParams.tab === 'materia-prima') {
    defaultTab = 'MPR';
  } else if (searchParams.tab === 'productos') {
    defaultTab = 'PRO';
  }

  // 2. Consulta de productos, materias primas, componentes, proveedores y productos base en paralelo
  const masterItemService = getMasterItemService();
  const supplierService = getSupplierService();
  const productService = getProductService();
  const formulaService = getFormulaService();

  const [rawMaterialRecords, componentRecords, supplierRecords, productRecords, baseProductRecords] =
    await Promise.all([
      masterItemService.listMasterItems('MPR', true),
      masterItemService.listMasterItems('COM', true),
      supplierService.listSuppliers(false), // solo proveedores activos
      productService.listProducts(true),
      formulaService.listBaseProducts(true),
    ]);

  // 3. Ordenamiento normativo por ratio de stock: stock_actual / stock_minimo ASC
  // Resuelto en servidor con aritmética exacta Decimal (sin floating-point de JS)
  const sortedProducts = [...productRecords].sort((a, b) => {
    const minA = a.stockMinimum && a.stockMinimum.gt(0) ? a.stockMinimum : new Decimal(1);
    const minB = b.stockMinimum && b.stockMinimum.gt(0) ? b.stockMinimum : new Decimal(1);
    const ratioA = a.balance.dividedBy(minA);
    const ratioB = b.balance.dividedBy(minB);

    if (!ratioA.equals(ratioB)) {
      return ratioA.comparedTo(ratioB);
    }
    return a.code.localeCompare(b.code);
  });

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
  const initialProducts = sortedProducts.map(serializeFinalProduct);
  const initialRawMaterials = sortedRawMaterials.map(serializeRawMaterial);
  const initialComponents = sortedComponents.map(serializeComponent);

  const activeSuppliers: SupplierOptionDTO[] = supplierRecords.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    currencyCode: s.currencyCode,
  }));

  const activeBaseProducts: BaseProductOptionDTO[] = baseProductRecords
    .filter((bp) => bp.active && bp.currentVersionNumber !== null)
    .map((bp) => ({
      id: bp.id,
      code: bp.code,
      name: bp.name,
      currentVersion: bp.currentVersionNumber,
      currentCostPerKg: bp.currentFormulaBreakdown
        ? toNumericString(bp.currentFormulaBreakdown.costPerKgPbaArs)
        : null,
    }));

  const activeComponents: ComponentOptionDTO[] = componentRecords
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      currentTheoreticalCostGrossArs: c.currentTheoreticalCostGrossArs
        ? toNumericString(c.currentTheoreticalCostGrossArs)
        : null,
    }));

  return (
    <RawMaterialsView
      initialRawMaterials={initialRawMaterials}
      initialComponents={initialComponents}
      initialProducts={initialProducts}
      activeSuppliers={activeSuppliers}
      activeBaseProducts={activeBaseProducts}
      activeComponents={activeComponents}
      defaultTab={defaultTab}
    />
  );
}
