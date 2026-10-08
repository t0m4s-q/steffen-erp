import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getFormulaService, getMasterItemService } from '@/services/composition';
import {
  serializeBaseProduct,
  type ActiveRawMaterialDTO,
  type BaseProductDTO,
} from '@/actions/formula.dto';
import { toNumericString } from '@/domain/decimal';
import { FormulasView } from '@/ui/views/FormulasView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Fórmulas y Productos Base (PBA) • Steffen ERP',
  description: 'Gestión de formulaciones químicas, versiones históricas y costos teóricos por kg.',
};

export default async function FormulasPage(props: {
  searchParams?: Promise<{ action?: string }>;
}) {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const defaultAction = searchParams.action;

  // 2. Consulta en paralelo de PBAs con fórmula vigente y MPRs activas
  const formulaService = getFormulaService();
  const masterItemService = getMasterItemService();

  const [baseProductRecords, rawMaterialRecords] = await Promise.all([
    formulaService.listBaseProducts(true),
    masterItemService.listMasterItems('MPR', false), // solo materias primas activas
  ]);

  // 3. Serialización estricta a DTOs JSON-safe (sin instancias Decimal hacia Client Components)
  const initialBaseProducts: BaseProductDTO[] = baseProductRecords.map((bp) =>
    serializeBaseProduct(bp)
  );

  const activeRawMaterials: ActiveRawMaterialDTO[] = rawMaterialRecords.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    currentTheoreticalCostGrossArs: m.currentTheoreticalCostGrossArs
      ? toNumericString(m.currentTheoreticalCostGrossArs)
      : null,
    supplierCode: m.referenceSupplierCode || null,
    supplierName: m.referenceSupplierName || null,
  }));

  return (
    <FormulasView
      initialBaseProducts={initialBaseProducts}
      activeRawMaterials={activeRawMaterials}
      defaultAction={defaultAction}
    />
  );
}
