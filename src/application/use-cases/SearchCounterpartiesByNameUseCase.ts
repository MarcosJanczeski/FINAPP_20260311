import type { Counterparty } from '../../domain/entities/Counterparty';
import type { CounterpartyRepository } from '../../domain/repositories/CounterpartyRepository';
import type { ID } from '../../domain/types/common';

interface SearchCounterpartiesByNameInput {
  controlCenterId: ID;
  query: string;
}

export class SearchCounterpartiesByNameUseCase {
  constructor(private readonly counterpartyRepository: CounterpartyRepository) {}

  async execute(input: SearchCounterpartiesByNameInput): Promise<Counterparty[]> {
    const query = input.query.trim();
    if (!query) {
      return [];
    }

    return this.counterpartyRepository.searchByName(input.controlCenterId, query);
  }
}
