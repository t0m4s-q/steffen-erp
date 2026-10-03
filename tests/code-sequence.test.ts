import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { CodeSequenceService } from '../src/services/code-sequence.service';
import { CodeSequenceRepository } from '../src/repositories/code-sequence.repository';
import { InvalidCodePrefixError } from '../src/domain/errors';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('Secuencias de códigos — Consecutivas y formato seguro', async (t) => {
  const repo = new CodeSequenceRepository(supabase);
  const service = new CodeSequenceService(repo);
  const testPrefix = 'TQC'; // Test Sequence Prefix

  // Limpiar cualquier residuo previo de prueba
  await supabase.from('code_sequences').delete().eq('prefix', testPrefix);

  t.after(async () => {
    // Limpieza posterior
    await supabase.from('code_sequences').delete().eq('prefix', testPrefix);
  });

  await t.test('genera códigos consecutivos respetando prefijo y 4 dígitos mínimo', async () => {
    const code1 = await service.generateVisibleCode(testPrefix);
    const code2 = await service.generateVisibleCode(testPrefix);
    const code3 = await service.generateVisibleCode(testPrefix);

    assert.strictEqual(code1, `${testPrefix}0001`);
    assert.strictEqual(code2, `${testPrefix}0002`);
    assert.strictEqual(code3, `${testPrefix}0003`);
  });

  await t.test('rechaza prefijos inválidos con error de dominio explícito', async () => {
    await assert.rejects(
      async () => await service.generateVisibleCode(''),
      (err) => err instanceof InvalidCodePrefixError
    );
    await assert.rejects(
      async () => await service.generateVisibleCode('TOOLONG'),
      (err) => err instanceof InvalidCodePrefixError
    );
    await assert.rejects(
      async () => await service.generateVisibleCode('AB'),
      (err) => err instanceof InvalidCodePrefixError
    );
  });
});

test('Secuencias de códigos — Concurrencia de secuencias atómicas', async (t) => {
  const repo = new CodeSequenceRepository(supabase);
  const service = new CodeSequenceService(repo);
  const testPrefix = 'TQN';

  await supabase.from('code_sequences').delete().eq('prefix', testPrefix);

  t.after(async () => {
    await supabase.from('code_sequences').delete().eq('prefix', testPrefix);
  });

  await t.test('10 llamadas concurrentes generan exactamente 10 códigos únicos consecutivos', async () => {
    const promises = Array.from({ length: 10 }, () => service.generateVisibleCode(testPrefix));
    const results = await Promise.all(promises);

    assert.strictEqual(results.length, 10);
    const uniqueCodes = new Set(results);
    assert.strictEqual(uniqueCodes.size, 10, 'No debe haber códigos duplicados ante concurrencia');

    // Comprobar que los números van de 1 a 10
    const numbers = results
      .map((code) => parseInt(code.replace(testPrefix, ''), 10))
      .sort((a, b) => a - b);

    assert.deepStrictEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
