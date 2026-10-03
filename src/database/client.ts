import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Cliente Supabase para el navegador / cliente React.
 * Gestiona la autenticación y la sesión del usuario en cookies seguras.
 * No tiene permisos directos sobre tablas de negocio ni RPCs privilegiados (bloqueados en DB).
 */
export function getBrowserSupabaseClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = getBrowserSupabaseClient();
