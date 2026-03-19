import type { Commitment } from '../../../domain/entities/Commitment';
import type {
  CommitmentListFilters,
  CommitmentRepository,
} from '../../../domain/repositories/CommitmentRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageCommitmentRepository implements CommitmentRepository {
  constructor(private readonly storage: StorageDriver) {}

  async save(commitment: Commitment): Promise<void> {
    const commitments = this.readAll();
    const index = commitments.findIndex((current) => current.id === commitment.id);

    const duplicateLogical = commitments.find(
      (current) =>
        current.controlCenterId === commitment.controlCenterId &&
        current.sourceEventKey === commitment.sourceEventKey &&
        current.id !== commitment.id,
    );
    if (duplicateLogical) {
      throw new Error(
        'Ja existe commitment para este sourceEventKey no centro de controle.',
      );
    }

    if (index >= 0) {
      commitments[index] = commitment;
    } else {
      commitments.push(commitment);
    }

    this.storage.setItem<Commitment[]>(STORAGE_KEYS.commitments, commitments);
  }

  async getById(id: ID): Promise<Commitment | null> {
    return this.readAll().find((commitment) => commitment.id === id) ?? null;
  }

  async listByControlCenter(
    controlCenterId: ID,
    filters?: CommitmentListFilters,
  ): Promise<Commitment[]> {
    return this.readAll()
      .filter((commitment) => commitment.controlCenterId === controlCenterId)
      .filter((commitment) => (filters?.status ? commitment.status === filters.status : true))
      .filter((commitment) => (filters?.type ? commitment.type === filters.type : true))
      .filter((commitment) =>
        filters?.counterpartyId ? commitment.counterpartyId === filters.counterpartyId : true,
      )
      .filter((commitment) =>
        filters?.categoryId ? commitment.categoryId === filters.categoryId : true,
      )
      .sort((a, b) => {
        if (a.documentDate === b.documentDate) {
          return a.createdAt > b.createdAt ? 1 : -1;
        }
        return a.documentDate > b.documentDate ? 1 : -1;
      });
  }

  async findBySourceEventKey(
    controlCenterId: ID,
    sourceEventKey: string,
  ): Promise<Commitment | null> {
    return (
      this.readAll().find(
        (commitment) =>
          commitment.controlCenterId === controlCenterId &&
          commitment.sourceEventKey === sourceEventKey,
      ) ?? null
    );
  }

  private readAll(): Commitment[] {
    const commitments = this.storage.getItem<Commitment[]>(STORAGE_KEYS.commitments) ?? [];

    return commitments.map((commitment) => ({
      ...commitment,
      amountCents: commitment.amountCents,
      originalAmountCents: commitment.originalAmountCents ?? commitment.amountCents,
      sourceEventKey: commitment.sourceEventKey ?? '',
      ledgerLinks: commitment.ledgerLinks ?? [],
      status: commitment.status ?? 'confirmed',
      createdAt: commitment.createdAt,
      updatedAt: commitment.updatedAt ?? commitment.createdAt,
      settlementDate: commitment.settlementDate ?? undefined,
      settledAccountId: commitment.settledAccountId ?? undefined,
      settledAmountCents: commitment.settledAmountCents ?? undefined,
      settlementDifferenceCents: commitment.settlementDifferenceCents ?? undefined,
      settlementDifferenceReason: commitment.settlementDifferenceReason ?? undefined,
      categoryId: commitment.categoryId ?? undefined,
      counterpartyId: commitment.counterpartyId ?? undefined,
      expectedAccountId: commitment.expectedAccountId ?? undefined,
      sourceId: commitment.sourceId ?? undefined,
      notes: commitment.notes ?? undefined,
    }));
  }
}
