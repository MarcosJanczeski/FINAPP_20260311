import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { ID, ISODateString } from '../../domain/types/common';

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

    const hasSettlement = event.ledgerLinks.some((link) => link.relation === 'settlement');
    if (hasSettlement) {
      throw new Error('Liquidação já registrada para este evento.');
    }

    const recognitionLink = event.ledgerLinks.find((link) => link.relation === 'recognition');
    if (!recognitionLink) {
      throw new Error('Reconhecimento contábil não encontrado para realizar liquidação.');
    }

    const recognitionEntry = await this.ledgerEntryRepository.getById(recognitionLink.ledgerEntryId);
    if (!recognitionEntry || recognitionEntry.controlCenterId !== input.controlCenterId) {
      throw new Error('Lançamento de reconhecimento não encontrado para liquidação.');
    }

    const recognitionAmountCents = recognitionEntry.lines.reduce(
      (sum, line) => sum + line.debitCents,
      0,
    );
    if (input.settlementAmountCents !== recognitionAmountCents) {
      throw new Error(
        'Neste MVP, o valor da liquidação deve ser igual ao valor reconhecido. Diferenças serão tratadas em fluxo futuro de ajuste.',
      );
    }

    const settlementAccount = await this.accountRepository.getById(input.settlementAccountId);
    if (!settlementAccount || settlementAccount.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta de disponibilidade da liquidação não encontrada.');
    }
    if (settlementAccount.status !== 'active') {
      throw new Error('Conta de disponibilidade inativa ou encerrada.');
    }

    const settlementLedgerEntry = await this.buildSettlementEntry({
      event,
      recognitionEntry,
      settlementDate: input.settlementDate,
      settlementAmountCents: input.settlementAmountCents,
      settlementLedgerAccountId: settlementAccount.ledgerAccountId,
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
      plannedSettlementDate: input.settlementDate,
      amountCents: input.settlementAmountCents,
      ledgerLinks: [
        ...event.ledgerLinks,
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
    recognitionEntry: LedgerEntry;
    settlementDate: ISODateString;
    settlementAmountCents: number;
    settlementLedgerAccountId: ID;
    settledByUserId: ID;
    memo?: string;
  }): Promise<LedgerEntry> {
    const recognitionLinesWithAccounts = await Promise.all(
      input.recognitionEntry.lines.map(async (line) => ({
        line,
        account: await this.ledgerAccountRepository.getById(line.ledgerAccountId),
      })),
    );

    const fallbackDebitAccountId = input.recognitionEntry.lines.find(
      (line) => line.debitCents > 0,
    )?.ledgerAccountId;
    const fallbackCreditAccountId = input.recognitionEntry.lines.find(
      (line) => line.creditCents > 0,
    )?.ledgerAccountId;

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

    const lines =
      input.event.direction === 'outflow'
        ? [
            {
              ledgerAccountId: obligationAccountId,
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
              ledgerAccountId: receivableAccountId,
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
}
