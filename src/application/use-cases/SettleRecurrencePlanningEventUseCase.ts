import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { ID, ISODateString } from '../../domain/types/common';
import {
  resolveActiveLedgerLink,
  sumLedgerEntryAmountByDebit,
} from '../services/recurrenceLedgerLifecycle';

interface SettleRecurrencePlanningEventInput {
  id: ID;
  controlCenterId: ID;
  settlementDate: ISODateString;
  settlementAmountCents: number;
  settlementAccountId: ID;
  memo?: string;
  settledByUserId: ID;
}

export class SettleRecurrencePlanningEventUseCase {
  constructor(
    private readonly planningEventRepository: PlanningEventRepository,
    private readonly accountRepository: AccountRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: SettleRecurrencePlanningEventInput): Promise<PlanningEvent> {
    if (input.settlementAmountCents <= 0) {
      throw new Error('Valor de liquidação deve ser maior que zero.');
    }

    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de recorrência não encontrado.');
    }

    if (event.status !== 'confirmed') {
      throw new Error('Apenas eventos confirmados podem ser realizados.');
    }

    if (event.type === 'realizado') {
      throw new Error('Evento já está realizado.');
    }

    const activeSettlement = await resolveActiveLedgerLink(this.ledgerEntryRepository, {
      event,
      baseRelation: 'settlement',
      reversalRelations: ['settlement_reversal'],
    });
    if (activeSettlement.link) {
      throw new Error('Liquidação já registrada para este evento.');
    }

    const activeRecognition = await resolveActiveLedgerLink(this.ledgerEntryRepository, {
      event,
      baseRelation: 'recognition',
      reversalRelations: ['recognition_reversal'],
      legacyReversalRelation: 'reversal',
    });
    if (!activeRecognition.link || !activeRecognition.entry) {
      throw new Error('Reconhecimento contábil não encontrado para realizar liquidação.');
    }

    const recognitionEntry = activeRecognition.entry;
    if (recognitionEntry.controlCenterId !== input.controlCenterId) {
      throw new Error('Lançamento de reconhecimento não encontrado para liquidação.');
    }

    const recognitionAmountCents = sumLedgerEntryAmountByDebit(recognitionEntry);

    const settlementAccount = await this.accountRepository.getById(input.settlementAccountId);
    if (!settlementAccount || settlementAccount.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta de disponibilidade da liquidação não encontrada.');
    }
    if (settlementAccount.status !== 'active') {
      throw new Error('Conta de disponibilidade inativa ou encerrada.');
    }

    const accountingTargets = await this.resolveRecognitionAccounts(recognitionEntry);
    const deltaCents = input.settlementAmountCents - recognitionAmountCents;
    const adjustmentLedgerEntry =
      deltaCents !== 0
        ? await this.buildSettlementAdjustmentEntry({
            event,
            deltaCents,
            settlementDate: input.settlementDate,
            recognitionEntry,
            obligationAccountId: accountingTargets.obligationAccountId,
            receivableAccountId: accountingTargets.receivableAccountId,
            settledByUserId: input.settledByUserId,
            memo: input.memo,
          })
        : null;

    if (adjustmentLedgerEntry) {
      await this.ledgerEntryRepository.save(adjustmentLedgerEntry);
    }

    const settlementLedgerEntry = await this.buildSettlementEntry({
      event,
      settlementDate: input.settlementDate,
      settlementAmountCents: input.settlementAmountCents,
      settlementLedgerAccountId: settlementAccount.ledgerAccountId,
      obligationAccountId: accountingTargets.obligationAccountId,
      receivableAccountId: accountingTargets.receivableAccountId,
      settledByUserId: input.settledByUserId,
      memo: input.memo,
    });

    await this.ledgerEntryRepository.save(settlementLedgerEntry);

    const now = new Date().toISOString();
    const updated: PlanningEvent = {
      ...event,
      type: 'realizado',
      status: 'posted',
      date: input.settlementDate,
      settlementDate: input.settlementDate,
      isVerified: false,
      verifiedAt: null,
      verifiedByUserId: null,
      amountCents: input.settlementAmountCents,
      ledgerLinks: [
        ...event.ledgerLinks,
        ...(adjustmentLedgerEntry
          ? [
              {
                ledgerEntryId: adjustmentLedgerEntry.id,
                relation: 'adjustment' as const,
                createdAt: now,
              },
            ]
          : []),
        {
          ledgerEntryId: settlementLedgerEntry.id,
          relation: 'settlement',
          createdAt: now,
        },
      ],
      postedLedgerEntryId: settlementLedgerEntry.id,
      updatedAt: now,
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }

  private async buildSettlementEntry(input: {
    event: PlanningEvent;
    settlementDate: ISODateString;
    settlementAmountCents: number;
    settlementLedgerAccountId: ID;
    obligationAccountId: ID;
    receivableAccountId: ID;
    settledByUserId: ID;
    memo?: string;
  }): Promise<LedgerEntry> {
    const lines =
      input.event.direction === 'outflow'
        ? [
            {
              ledgerAccountId: input.obligationAccountId,
              debitCents: input.settlementAmountCents,
              creditCents: 0,
            },
            {
              ledgerAccountId: input.settlementLedgerAccountId,
              debitCents: 0,
              creditCents: input.settlementAmountCents,
            },
          ]
        : [
            {
              ledgerAccountId: input.settlementLedgerAccountId,
              debitCents: input.settlementAmountCents,
              creditCents: 0,
            },
            {
              ledgerAccountId: input.receivableAccountId,
              debitCents: 0,
              creditCents: input.settlementAmountCents,
            },
          ];

    return {
      id: crypto.randomUUID(),
      controlCenterId: input.event.controlCenterId,
      date: input.settlementDate,
      description: `Liquidação recorrência - ${input.event.description}`,
      referenceType: 'recurrence_settlement',
      referenceId: input.event.id,
      lines,
      createdByUserId: input.settledByUserId,
      reason: input.memo?.trim() || 'Liquidação de recorrência confirmada',
      createdAt: new Date().toISOString(),
    };
  }

  private async resolveRecognitionAccounts(recognitionEntry: LedgerEntry): Promise<{
    obligationAccountId: ID;
    receivableAccountId: ID;
  }> {
    const recognitionLinesWithAccounts = await Promise.all(
      recognitionEntry.lines.map(async (line) => ({
        line,
        account: await this.ledgerAccountRepository.getById(line.ledgerAccountId),
      })),
    );

    const fallbackDebitAccountId = recognitionEntry.lines.find((line) => line.debitCents > 0)
      ?.ledgerAccountId;
    const fallbackCreditAccountId = recognitionEntry.lines.find((line) => line.creditCents > 0)
      ?.ledgerAccountId;

    if (!fallbackDebitAccountId || !fallbackCreditAccountId) {
      throw new Error('Lançamento de reconhecimento inválido para liquidação.');
    }

    const receivableAccountId =
      recognitionLinesWithAccounts.find(
        (item) => item.line.debitCents > 0 && item.account?.kind === 'asset',
      )?.line.ledgerAccountId ?? fallbackDebitAccountId;
    const obligationAccountId =
      recognitionLinesWithAccounts.find(
        (item) => item.line.creditCents > 0 && item.account?.kind === 'liability',
      )?.line.ledgerAccountId ?? fallbackCreditAccountId;

    return {
      obligationAccountId,
      receivableAccountId,
    };
  }

  private async buildSettlementAdjustmentEntry(input: {
    event: PlanningEvent;
    deltaCents: number;
    settlementDate: ISODateString;
    recognitionEntry: LedgerEntry;
    obligationAccountId: ID;
    receivableAccountId: ID;
    settledByUserId: ID;
    memo?: string;
  }): Promise<LedgerEntry> {
    const adjustmentRevenueAccount = await this.ensureSystemLedgerAccount(
      input.event.controlCenterId,
      'RECEITAS:AJUSTE_LIQUIDACAO',
      'Receitas - Ajuste Liquidação',
      'revenue',
    );
    const adjustmentExpenseAccount = await this.ensureSystemLedgerAccount(
      input.event.controlCenterId,
      'DESPESAS:AJUSTE_LIQUIDACAO',
      'Despesas - Ajuste Liquidação',
      'expense',
    );
    const absoluteDelta = Math.abs(input.deltaCents);

    const lines =
      input.event.direction === 'outflow'
        ? input.deltaCents < 0
          ? [
              {
                ledgerAccountId: input.obligationAccountId,
                debitCents: absoluteDelta,
                creditCents: 0,
              },
              {
                ledgerAccountId: adjustmentRevenueAccount.id,
                debitCents: 0,
                creditCents: absoluteDelta,
              },
            ]
          : [
              {
                ledgerAccountId: adjustmentExpenseAccount.id,
                debitCents: absoluteDelta,
                creditCents: 0,
              },
              {
                ledgerAccountId: input.obligationAccountId,
                debitCents: 0,
                creditCents: absoluteDelta,
              },
            ]
        : input.deltaCents < 0
          ? [
              {
                ledgerAccountId: adjustmentExpenseAccount.id,
                debitCents: absoluteDelta,
                creditCents: 0,
              },
              {
                ledgerAccountId: input.receivableAccountId,
                debitCents: 0,
                creditCents: absoluteDelta,
              },
            ]
          : [
              {
                ledgerAccountId: input.receivableAccountId,
                debitCents: absoluteDelta,
                creditCents: 0,
              },
              {
                ledgerAccountId: adjustmentRevenueAccount.id,
                debitCents: 0,
                creditCents: absoluteDelta,
              },
            ];

    return {
      id: crypto.randomUUID(),
      controlCenterId: input.event.controlCenterId,
      date: input.settlementDate,
      description: `Ajuste liquidação recorrência - ${input.event.description}`,
      referenceType: 'recurrence_settlement_adjustment',
      referenceId: input.event.id,
      lines,
      createdByUserId: input.settledByUserId,
      reason:
        input.memo?.trim() ||
        `Ajuste por diferença entre reconhecimento e liquidação (${input.recognitionEntry.id})`,
      createdAt: new Date().toISOString(),
    };
  }

  private async ensureSystemLedgerAccount(
    controlCenterId: ID,
    code: string,
    name: string,
    kind: LedgerAccount['kind'],
  ): Promise<LedgerAccount> {
    const existing = await this.ledgerAccountRepository.getByCode(controlCenterId, code);
    if (existing) {
      return existing;
    }

    const created: LedgerAccount = {
      id: crypto.randomUUID(),
      controlCenterId,
      code,
      name,
      kind,
      isSystem: true,
      createdAt: new Date().toISOString(),
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }
}
