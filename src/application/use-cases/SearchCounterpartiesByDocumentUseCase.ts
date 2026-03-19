import type { Counterparty } from '../../domain/entities/Counterparty';
import type { CounterpartyRepository } from '../../domain/repositories/CounterpartyRepository';
import type { ID } from '../../domain/types/common';
import { normalizeDocument } from '../../shared/utils/normalizeDocument';

interface SearchCounterpartiesByDocumentInput {
  controlCenterId: ID;
  document: string;
}

export class SearchCounterpartiesByDocumentUseCase {
  constructor(private readonly counterpartyRepository: CounterpartyRepository) {}

  async execute(input: SearchCounterpartiesByDocumentInput): Promise<Counterparty[]> {
    const normalized = normalizeDocument(input.document);
    if (!normalized) {
      return [];
    }

    return this.counterpartyRepository.findByNormalizedDocument(input.controlCenterId, normalized);
  }
}
