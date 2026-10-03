'use server';

import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, getUserServerSupabaseClient } from '@/auth/guard';
import { StockDomainService } from '@/services/stock.service';
import { StockRepository } from '@/repositories/stock.repository';
import { serverSupabase } from '@/database/server';

/**
 * Server Action para cerrar sesión.
 * Invalida la sesión actual en Supabase Auth y redirige a /login.
 */
export async function logoutAction() {
  try {
    const supabase = await getUserServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Continuar con la redirección incluso si la llamada remota falla
  }

  redirect('/login');
}

/**
 * Server Action protegida de ejemplo que demuestra el guard central:
 * Toda operación server-side privilegiada exige requireAuthenticatedUser()
 * ANTES de invocar repositorios o domain services con service_role.
 */
export async function executeProtectedStockQuery(stockItemId: string, explicitToken?: string) {
  // 1. Guard server-side obligatorio: verifica sesión del usuario
  const user = await requireAuthenticatedUser(explicitToken);

  // 2. Solo después de la verificación se autoriza el uso de servicios de dominio con service_role
  const repo = new StockRepository(serverSupabase);
  const service = new StockDomainService(repo);
  const balance = await service.getStockBalance(stockItemId);

  return {
    authorizedByUserId: user.id,
    stockItemId,
    balance: balance.toString(),
  };
}
