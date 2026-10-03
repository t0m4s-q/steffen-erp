import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import { UnauthorizedError, ForbiddenError } from './errors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface GuardOptions {
  expectedUserId?: string;
}

/**
 * Obtiene el cliente Supabase de servidor asociado a la sesión del usuario.
 * Utiliza cookies() de Next.js (App Router).
 */
export async function getUserServerSupabaseClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Si es invocado desde un Server Component puro, setAll puede ignorarse;
          // la actualización de cookies la maneja el Middleware.
        }
      },
    },
  });
}

/**
 * Verifica un token JWT de autenticación de Supabase (útil para API routes con Bearer token o tests).
 */
export async function verifyTokenAndGetUser(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch {
    return null;
  }
}

/**
 * Obtiene el usuario autenticado actual a partir de cookies o token explícito.
 * Retorna null si no hay sesión válida (sin arrojar excepción).
 */
export async function getAuthenticatedUser(explicitToken?: string): Promise<AuthenticatedUser | null> {
  // 1. Si se provee un token explícito (ej: Bearer token o test)
  if (explicitToken) {
    return verifyTokenAndGetUser(explicitToken);
  }

  // 2. Si se ejecuta dentro del ciclo de request de Next.js (Server Action / Server Component)
  try {
    const client = await getUserServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch {
    return null;
  }
}

/**
 * Verifica si el usuario coincide con la allowlist de usuario único configurada en el servidor.
 */
export function isUserAuthorized(user: AuthenticatedUser, expectedUserId?: string): boolean {
  const authorizedId = expectedUserId || process.env.STEFFEN_AUTHORIZED_USER_ID;
  if (!authorizedId) {
    // Si no está configurada la variable en el entorno, por seguridad se deniega el acceso
    return false;
  }
  return user.id === authorizedId;
}

/**
 * Guard central obligatorio para cualquier operación server-side que acceda a:
 * - service_role;
 * - RPC privilegiados;
 * - repositories;
 * - domain services.
 *
 * Valida:
 * 1. Que exista una sesión válida (arroja UnauthorizedError 401 si no).
 * 2. Que el user.id coincida con STEFFEN_AUTHORIZED_USER_ID (arroja ForbiddenError 403 si pertenece a otro usuario).
 */
export async function requireAuthenticatedUser(
  explicitToken?: string,
  options?: GuardOptions
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(explicitToken);

  if (!user) {
    throw new UnauthorizedError('Acceso denegado: se requiere una sesión autenticada activa.');
  }

  const authorized = isUserAuthorized(user, options?.expectedUserId);
  if (!authorized) {
    throw new ForbiddenError('Acceso prohibido.');
  }

  return user;
}
