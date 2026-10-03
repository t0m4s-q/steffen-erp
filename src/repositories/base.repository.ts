import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import { getServerSupabaseClient } from '@/database/server';

/**
 * Clase base para repositorios de datos que interactúan con Supabase / PostgreSQL.
 * Aísla el acceso a datos para que el dominio no dependa directamente de llamadas SQL o APIs externas.
 */
export abstract class BaseSupabaseRepository {
  protected client: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || getServerSupabaseClient();
  }
}
