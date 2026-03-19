import type {
  Counterparty,
  CounterpartyStatus,
  CounterpartyType,
} from '../../domain/entities/Counterparty';
import type { CounterpartyRepository } from '../../domain/repositories/CounterpartyRepository';
import type { ID } from '../../domain/types/common';
import { normalizeDocument } from '../../shared/utils/normalizeDocument';

interface CreateCounterpartyInput {
  controlCenterId: ID;
  name: string;
  document?: string | null;
  type?: CounterpartyType | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  status?: CounterpartyStatus;
}

export class CreateCounterpartyUseCase {
  constructor(private readonly counterpartyRepository: CounterpartyRepository) {}

  async execute(input: CreateCounterpartyInput): Promise<Counterparty> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Nome da contrapartida e obrigatorio.');
    }

    const now = new Date().toISOString();
    const counterparty: Counterparty = {
      id: crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      name,
      document: normalizeDocument(input.document) || null,
      type: input.type ?? null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.counterpartyRepository.save(counterparty);
    return counterparty;
  }
}
