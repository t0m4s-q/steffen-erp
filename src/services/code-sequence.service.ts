import { ICodeSequenceRepository, CodeSequenceRepository } from '@/repositories/code-sequence.repository';
import { InvalidCodePrefixError } from '@/domain/errors';

export interface ICodeSequenceService {
  generateVisibleCode(prefix: string): Promise<string>;
}

export class CodeSequenceService implements ICodeSequenceService {
  constructor(private readonly codeSequenceRepo: ICodeSequenceRepository = new CodeSequenceRepository()) {}

  /**
   * Genera el siguiente código visible para el prefijo indicado de manera atómica y segura ante concurrencia.
   * Utiliza la función PostgreSQL get_next_code_sequence con bloqueo de fila.
   * Garantiza:
   * - Prefijo + mínimo 4 dígitos rellenados con ceros a la izquierda (LPAD).
   * - Permite crecer más allá de 9999 (ej. PRO10000).
   * - Nunca reutiliza códigos ni utiliza MAX + 1.
   */
  async generateVisibleCode(prefix: string): Promise<string> {
    if (!prefix || typeof prefix !== 'string') {
      throw new InvalidCodePrefixError(String(prefix));
    }

    const cleanPrefix = prefix.trim().toUpperCase();
    if (cleanPrefix.length !== 3) {
      throw new InvalidCodePrefixError(cleanPrefix);
    }

    return await this.codeSequenceRepo.getNextCode(cleanPrefix);
  }
}
