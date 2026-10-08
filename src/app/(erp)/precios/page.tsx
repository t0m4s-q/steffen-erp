import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import { getPriceListService, getProductService } from '@/services/composition';
import { serializePriceList, type ProductPriceRowDTO } from '@/actions/price-list.dto';
import { PriceListsView } from '@/ui/views/PriceListsView';
import { toNumericString } from '@/domain/decimal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Listas de Precios • Steffen ERP',
  description: 'Gestión de listas de precios de venta (Salón, Público, Ecommerce), aumentos masivos y versionado de precios.',
};

export default async function PreciosPage(props: {
  searchParams?: Promise<{ listId?: string }>;
}) {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const requestedListId = searchParams.listId;

  // 2. Consulta de listas de precios y productos finales en paralelo
  const priceListService = getPriceListService();
  const productService = getProductService();

  const [priceListRecords, productRecords] = await Promise.all([
    priceListService.listPriceLists(true),
    productService.listProducts(true),
  ]);

  // Si no hay listas en absoluto (caso de base vacía), crear fallback visual limpio
  if (priceListRecords.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto py-12 text-center text-gray-500">
        No hay listas de precios configuradas en el sistema.
      </div>
    );
  }

  // Orden canónico: Salón primero, luego Público, luego Ecommerce, luego adicionales
  const sortedLists = [...priceListRecords].sort((a, b) => {
    const roleOrder: Record<string, number> = {
      SALON_DEFAULT: 1,
      PUBLIC_DEFAULT: 2,
      ECOMMERCE_DEFAULT: 3,
    };
    const orderA = a.systemRole ? roleOrder[a.systemRole] || 4 : 5;
    const orderB = b.systemRole ? roleOrder[b.systemRole] || 4 : 5;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  // Determinar lista seleccionada
  let selectedList = sortedLists.find((l) => l.id === requestedListId);
  if (!selectedList) {
    selectedList =
      sortedLists.find((l) => l.systemRole === 'SALON_DEFAULT') ||
      sortedLists[0];
  }

  // 3. Consultar precios vigentes de la lista seleccionada
  const currentPrices = await priceListService.listCurrentPrices(selectedList.id);
  const currentPricesMap = new Map<string, { id: string; priceArs: string; validFrom: string }>();

  for (const cp of currentPrices) {
    currentPricesMap.set(cp.productId, {
      id: cp.id,
      priceArs: toNumericString(cp.priceArs),
      validFrom: cp.validFrom,
    });
  }

  // 4. Mapear filas de productos para la tabla
  const productRows: ProductPriceRowDTO[] = productRecords.map((p) => {
    const priceData = currentPricesMap.get(p.productId);
    return {
      productId: p.productId,
      productCode: p.code,
      productName: p.name,
      presentation: p.presentation,
      productActive: p.active,
      currentPriceArs: priceData ? priceData.priceArs : null,
      currentPriceVersionId: priceData ? priceData.id : null,
      validFrom: priceData ? priceData.validFrom : null,
      hasPrice: Boolean(priceData),
    };
  });

  // Ordenar productos por código ascendente
  productRows.sort((a, b) => a.productCode.localeCompare(b.productCode));

  const serializedLists = sortedLists.map(serializePriceList);

  return (
    <PriceListsView
      priceLists={serializedLists}
      currentListId={selectedList.id}
      products={productRows}
    />
  );
}
