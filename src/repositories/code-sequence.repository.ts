import { BaseSupabaseRepository } from './base.repository';
import { InvalidCodePrefixError, DomainError } from '@/domain/errors';

export interface ICodeSequenceRepository {
  getNextCode(prefix: string): Promise<string>;
}

export class CodeSequenceRepository extends BaseSupabaseRepository implements ICodeSequenceRepository {
  async getNextCode(prefix: string): Promise<string> {
    const cleanPrefix = prefix?.trim().toUpperCase();
    if (!cleanPrefix || cleanPrefix.length !== 3) {
      throw new InvalidCodePrefixError(prefix);
    }

    const { data, error } = await (this.client.rpc as any)('get_next_code_sequence', {
      p_prefix: cleanPrefix,
    });

    if (error) {
      throw new DomainError(`Error generando secuencia para prefijo ${cleanPrefix}: ${error.message}`);
    }

    if (!data) {
      throw new DomainError(`No se recibió código generado para prefijo ${cleanPrefix}`);
    }

    return data;
  }
}
