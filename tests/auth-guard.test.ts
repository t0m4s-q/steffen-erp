import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { requireAuthenticatedUser, getAuthenticatedUser, isUserAuthorized } from '../src/auth/guard';
import { UnauthorizedError, ForbiddenError } from '../src/auth/errors';
import { executeProtectedStockQuery } from '../src/actions/auth.actions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const configuredAuthorizedUserId = process.env.STEFFEN_AUTHORIZED_USER_ID || 'ae38f71f-86e0-4ec7-ae75-3b020d864abd';

test('Autenticación y Autorización — Capa mínima del MVP y guards de servidor', async (t) => {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  let authorizedUserId: string = configuredAuthorizedUserId;
  let authorizedUserToken: string;
  let unauthorizedUserId: string;
  let unauthorizedUserToken: string;
  let testStockItemId: string;

  const unauthEmail = `unauthorized_user_${Date.now()}@gmail.com`;
  const testPassword = 'Password_ERP_2026!';

  t.before(async () => {
    // 1. Obtener o generar sesión para el operador autorizado (steffencosmetica@gmail.com)
    const listRes = await adminClient.auth.admin.listUsers();
    const existingOp = listRes.data.users.find(u => u.id === configuredAuthorizedUserId || u.email === 'steffencosmetica@gmail.com');

    if (existingOp) {
      authorizedUserId = existingOp.id;
      // Generar link/token de sesión para el operador
      const linkRes = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: existingOp.email!,
      });
      const tokenHash = linkRes.data?.properties?.hashed_token;
      const otpRes = await anonClient.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      authorizedUserToken = otpRes.data.session!.access_token;
    } else {
      // Si no existiera, crear temporalmente
      const { data: uData1 } = await adminClient.auth.admin.createUser({
        email: `steffen_authorized_${Date.now()}@steffen.com`,
        password: testPassword,
        email_confirm: true,
      });
      authorizedUserId = uData1.user.id;
      const { data: sData1 } = await anonClient.auth.signInWithPassword({
        email: uData1.user.email!,
        password: testPassword,
      });
      authorizedUserToken = sData1.session!.access_token;
    }

    // 2. Crear un segundo usuario autenticado (pero no autorizado en STEFFEN_AUTHORIZED_USER_ID)
    const { data: uData2, error: uErr2 } = await adminClient.auth.admin.createUser({
      email: unauthEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (uErr2) throw uErr2;
    unauthorizedUserId = uData2.user.id;

    // Login del segundo usuario para obtener access_token de intruso autenticado
    const { data: sData2, error: sErr2 } = await anonClient.auth.signInWithPassword({
      email: unauthEmail,
      password: testPassword,
    });
    if (sErr2) throw sErr2;
    unauthorizedUserToken = sData2.session.access_token;

    // 3. Crear ítem de stock para probar consulta protegida
    const { data: item, error: iErr } = await adminClient
      .from('stock_items')
      .insert({
        code: `TST_AUTH_${Date.now()}`,
        item_type: 'COM',
        name: 'Item Prueba Auth',
        unit_type: 'UNIT',
        stock_minimum: 10,
      })
      .select('id')
      .single();
    if (iErr) throw iErr;
    testStockItemId = item!.id;
    await adminClient.from('components').insert({ stock_item_id: testStockItemId });
  });

  t.after(async () => {
    // Limpieza
    if (testStockItemId) {
      await adminClient.from('components').delete().eq('stock_item_id', testStockItemId);
      await adminClient.from('stock_balances').delete().eq('stock_item_id', testStockItemId);
      await adminClient.from('stock_items').delete().eq('id', testStockItemId);
    }
    if (unauthorizedUserId) {
      await adminClient.auth.admin.deleteUser(unauthorizedUserId);
    }
  });

  await t.test('1. anonClient.auth.signUp() con email de prueba es rechazado y no crea usuario', async () => {
    const intruderEmail = `intruder_signup_${Date.now()}@gmail.com`;
    const beforeList = await adminClient.auth.admin.listUsers();
    const beforeCount = beforeList.data.users.length;

    const res = await anonClient.auth.signUp({
      email: intruderEmail,
      password: 'SomePassword123!',
    });

    // Debe ser rechazado o no retornar sesión/usuario nuevo persistido
    const afterList = await adminClient.auth.admin.listUsers();
    const afterCount = afterList.data.users.length;

    assert.strictEqual(
      afterCount,
      beforeCount,
      'No debe crearse ningún nuevo usuario en la base de datos tras el intento de signUp público'
    );
    assert.ok(
      res.error !== null || !res.data.user,
      'El intento de signUp con la clave anónima debe fallar o no generar usuario confirmado'
    );
  });

  await t.test('2. Usuario cuyo UUID coincide con STEFFEN_AUTHORIZED_USER_ID puede acceder al ERP', async () => {
    const user = await requireAuthenticatedUser(authorizedUserToken, {
      expectedUserId: authorizedUserId,
    });
    assert.strictEqual(user.id, authorizedUserId);
    assert.strictEqual(isUserAuthorized(user, authorizedUserId), true);

    // Puede ejecutar Server Actions protegidas con service_role
    const result = await executeProtectedStockQuery(testStockItemId, authorizedUserToken);
    assert.strictEqual(result.authorizedByUserId, authorizedUserId);
    assert.strictEqual(result.stockItemId, testStockItemId);
    assert.strictEqual(typeof result.balance, 'string');
  });

  await t.test('3. Usuario autenticado pero con UUID distinto es rechazado con 403 (ForbiddenError)', async () => {
    await assert.rejects(
      async () => {
        await requireAuthenticatedUser(unauthorizedUserToken, {
          expectedUserId: authorizedUserId,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError || err.name === 'ForbiddenError');
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.message, 'Acceso prohibido.');
        return true;
      },
      'Un usuario autenticado cuyo UUID no coincide con el operador debe ser rechazado con HTTP 403'
    );
  });

  await t.test('4. Un usuario no autorizado no alcanza ninguna operación con service_role', async () => {
    const previousEnv = process.env.STEFFEN_AUTHORIZED_USER_ID;
    process.env.STEFFEN_AUTHORIZED_USER_ID = authorizedUserId;

    try {
      await assert.rejects(
        async () => {
          await executeProtectedStockQuery(testStockItemId, unauthorizedUserToken);
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenError || err.name === 'ForbiddenError');
          assert.strictEqual(err.statusCode, 403);
          return true;
        },
        'La Server Action protegida frena en el guard antes de tocar el dominio o service_role'
      );
    } finally {
      process.env.STEFFEN_AUTHORIZED_USER_ID = previousEnv;
    }
  });

  await t.test('5. Visitante sin sesión es rechazado (401) y redirigido a /login', async () => {
    await assert.rejects(
      async () => {
        await requireAuthenticatedUser();
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedError || err.name === 'UnauthorizedError');
        assert.strictEqual(err.statusCode, 401);
        return true;
      },
      'Debe rechazar con UnauthorizedError cuando no hay sesión'
    );

    const user = await getAuthenticatedUser();
    assert.strictEqual(user, null, 'getAuthenticatedUser debe retornar null sin sesión');
  });

  await t.test('6. Ninguna credencial server-side ni STEFFEN_AUTHORIZED_USER_ID aparece en el bundle cliente', async () => {
    // 1. Ninguna variable de entorno pública (NEXT_PUBLIC_*) expone claves secretas ni el UUID del operador
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        const val = process.env[key] || '';
        assert.ok(
          !val.includes('service_role') && val !== serviceRoleKey,
          `La variable pública ${key} expone la clave service_role`
        );
        assert.ok(
          !key.includes('AUTHORIZED_USER_ID') && !val.includes(authorizedUserId),
          `La variable pública ${key} expone el UUID del operador autorizado`
        );
      }
    }

    // 2. src/database/client.ts no contiene referencias a secretos ni al UUID del operador
    const clientCode = fs.readFileSync(path.join(process.cwd(), 'src/database/client.ts'), 'utf-8');
    assert.ok(!clientCode.includes('SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(!clientCode.includes('STEFFEN_AUTHORIZED_USER_ID'));

    // 3. src/app/login/page.tsx no contiene referencias a secretos ni al UUID del operador
    const loginCode = fs.readFileSync(path.join(process.cwd(), 'src/app/login/page.tsx'), 'utf-8');
    assert.ok(!loginCode.includes('SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(!loginCode.includes('STEFFEN_AUTHORIZED_USER_ID'));
  });

  await t.test('7. Logout invalida la sesión y rechaza el acceso posterior', async () => {
    const sessionClient = createClient(supabaseUrl, anonKey);
    const { data: sData } = await sessionClient.auth.signInWithPassword({
      email: unauthEmail,
      password: testPassword,
    });
    assert.ok(sData.session?.access_token);

    // Logout
    const { error: outErr } = await sessionClient.auth.signOut();
    assert.ifError(outErr);

    // Tras logout, la sesión en el cliente queda nula
    const { data: sessionAfter } = await sessionClient.auth.getSession();
    assert.strictEqual(sessionAfter.session, null);

    const { data: userAfter, error: userErr } = await sessionClient.auth.getUser();
    assert.ok(userErr || !userAfter?.user);
  });
});
