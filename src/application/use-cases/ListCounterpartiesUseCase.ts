import type { Counterparty } from '../../domain/entities/Counterparty';
import type { CounterpartyRepository } from '../../domain/repositories/CounterpartyRepository';
import type { ID } from '../../domain/types/common';

export class ListCounterpartiesUseCase {
  constructor(private readonly counterpartyRepository: CounterpartyRepository) {}

  async execute(controlCenterId: ID): Promise<Counterparty[]> {
    return this.counterpartyRepository.listByControlCenter(controlCenterId);
  }
}
