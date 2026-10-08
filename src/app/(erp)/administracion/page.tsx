import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';
import {
  getCustomerService,
  getSupplierService,
  getPatrimonyService,
  getSupplierItemRepository,
} from '@/services/composition';
import { AdministracionView } from '@/ui/views/AdministracionView';
import { type AdministracionDashboardDTO } from '@/actions/administracion.dto';
import { Decimal, toNumericString } from '@/domain/decimal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administración • Steffen ERP',
  description: 'Control de ventas, cuentas corrientes, deudas comerciales, cotizaciones y caja.',
};

export default async function AdministracionPage() {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  // 2. Consulta en paralelo a los servicios y repositorios del backend real
  const customerService = getCustomerService();
  const supplierService = getSupplierService();
  const patrimonyService = getPatrimonyService();
  const supplierItemRepo = getSupplierItemRepository();

  const [customerRecords, supplierRecords, financialAccounts, recentMovements, usdRate] =
    await Promise.all([
      customerService.listCustomers(true).catch(() => []),
      supplierService.listSuppliers(true).catch(() => []),
      patrimonyService.listAccounts().catch(() => []),
      patrimonyService.listRecentMovements(10).catch(() => []),
      supplierItemRepo.getCurrentUsdExchangeRate().catch(() => null),
    ]);

  // 3. Cálculos patrimoniales y balances exactos con Decimal
  let totalCustomerReceivable = new Decimal(0);
  for (const c of customerRecords) {
    if (c.balanceArs) {
      totalCustomerReceivable = totalCustomerReceivable.plus(c.balanceArs);
    }
  }

  let totalSupplierPayable = new Decimal(0);
  for (const s of supplierRecords) {
    if (s.balance) {
      totalSupplierPayable = totalSupplierPayable.plus(s.balance);
    }
  }

  // Caja Steffen
  const cajaSteffenAccount = financialAccounts.find(
    (acc) => acc.accountType === 'CASH_STEFFEN' || acc.name.toLowerCase().includes('steffen')
  );
  const cajaSteffenBalance = cajaSteffenAccount ? cajaSteffenAccount.currentBalance : new Decimal(0);

  // Neto = Caja + Deudas Clientes - Deudas Proveedores
  const netoBalance = cajaSteffenBalance
    .plus(totalCustomerReceivable)
    .minus(totalSupplierPayable);

  // 4. Mapeo a DTOs JSON-safe para Client Component
  const dashboardDTO: AdministracionDashboardDTO = {
    currentUsdRate: usdRate ? toNumericString(usdRate) : null,
    cajaSteffenArs: toNumericString(cajaSteffenBalance),
    deudasClientesArs: toNumericString(totalCustomerReceivable),
    deudasProveedoresArs: toNumericString(totalSupplierPayable),
    netoArs: toNumericString(netoBalance),
    customerRows: customerRecords.map((c) => ({
      id: c.id,
      name: c.name,
      balanceArs: toNumericString(c.balanceArs),
      lastPaymentDate: null,
      lastPurchaseDate: null,
    })),
    supplierRows: supplierRecords.map((s) => ({
      id: s.id,
      name: s.name,
      balanceArs: toNumericString(s.balance),
      lastPaymentDate: null,
      lastPurchaseDate: null,
    })),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      code: m.code,
      date: m.createdAt ? m.createdAt.split('T')[0] : '—',
      type: m.movementType,
      description: m.description,
      amountArs: toNumericString(m.amountArs),
      patrimonialVariation: '',
    })),
  };

  return <AdministracionView data={dashboardDTO} />;
}
