import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import {
  getCostGainService,
  getFormulaService,
  getProductService,
} from '@/services/composition';
import { serializeCostGainAnalysis } from '@/actions/cost-gain.dto';
import {
  FabricaView,
  type FabricaFormulaOptionDTO,
  type FabricaLowStockProductDTO,
} from '@/ui/views/FabricaView';
import { toNumericString } from '@/domain/decimal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mi Fábrica • Steffen ERP',
  description: 'Gestión de lotes a granel, envasado, formulaciones y análisis de costo-ganancia.',
};

export default async function FabricaPage(props: {
  searchParams?: Promise<{ profileId?: string }>;
}) {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const requestedProfileId = searchParams.profileId;

  // 2. Ejecutar consultas del dominio en paralelo
  const costGainService = getCostGainService();
  const formulaService = getFormulaService();
  const productService = getProductService();

  const [analysisResult, baseProductRecords, productRecords] = await Promise.all([
    costGainService.listProductAnalysis(requestedProfileId, true).catch(async () => {
      if (requestedProfileId) {
        return costGainService.listProductAnalysis(undefined, true);
      }
      throw new Error('Error al inicializar la vista de Mi Fábrica.');
    }),
    formulaService.listBaseProducts(true),
    productService.listProducts(false),
  ]);

  const analysisDTO = serializeCostGainAnalysis(analysisResult);

  // 3. Opciones de fórmulas reales cargadas en el sistema
  const formulaOptions: FabricaFormulaOptionDTO[] = baseProductRecords
    .filter((bp) => bp.active && bp.currentFormulaBreakdown)
    .map((bp) => ({
      id: bp.id,
      name: bp.name,
      code: bp.code,
      items: (bp.currentFormulaBreakdown?.lines || []).map((line) => ({
        rawMaterialName: line.rawMaterialName,
        quantityKg: toNumericString(line.quantityKg),
      })),
    }));

  // 4. Alertas reales de producción bajo stock
  const lowStockProducts: FabricaLowStockProductDTO[] = productRecords
    .filter((p) => p.active && p.stockMinimum && p.balance.lte(p.stockMinimum))
    .map((p) => ({
      id: p.productId,
      name: p.name,
      stockMinimum: p.stockMinimum ? toNumericString(p.stockMinimum) : '0',
      stockActual: toNumericString(p.balance),
      isCritical: p.balance.lte(0),
    }));

  return (
    <FabricaView
      costGainAnalysis={analysisDTO}
      formulaOptions={formulaOptions}
      lowStockProducts={lowStockProducts}
    />
  );
}
