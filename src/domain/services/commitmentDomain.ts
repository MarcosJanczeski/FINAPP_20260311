import type { Commitment, CommitmentStatus, CommitmentLedgerLink } from '../entities/Commitment';

export interface CommitmentStatusResolution {
  derivedStatus: CommitmentStatus | 'invalid';
  hasActiveRecognition: boolean;
  hasActiveSettlement: boolean;
  inconsistencies: string[];
}

export interface CommitmentCapabilities {
  canSettle: boolean;
  canReverseSettlement: boolean;
  hasActiveRecognition: boolean;
  hasActiveSettlement: boolean;
  hasExplicitDifference: boolean;
  isOpen: boolean;
  isSettled: boolean;
  inconsistencies: string[];
}

function parseIsoDateOrThrow(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} invalida.`);
  }
  return parsed;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} deve ser inteiro em centavos.`);
  }
}

function countByRelation(
  links: CommitmentLedgerLink[],
  relation: CommitmentLedgerLink['relation'],
): number {
  return links.filter((link) => link.relation === relation).length;
}

export function validateCommitmentIdentity(
  commitment: Pick<Commitment, 'sourceEventKey' | 'counterpartyId'>,
): void {
  if (!commitment.sourceEventKey.trim()) {
    throw new Error('sourceEventKey e obrigatorio para idempotencia.');
  }

  if (!commitment.counterpartyId.trim()) {
    throw new Error('counterpartyId e obrigatorio no commitment.');
  }
}

export function validateCommitmentDates(
  commitment: Pick<Commitment, 'documentDate' | 'dueDate'>,
  now: Date = new Date(),
): void {
  const documentDate = parseIsoDateOrThrow(commitment.documentDate, 'documentDate');
  const dueDate = parseIsoDateOrThrow(commitment.dueDate, 'dueDate');

  if (documentDate.getTime() > now.getTime()) {
    throw new Error('documentDate nao pode estar no futuro.');
  }

  if (dueDate.getTime() < documentDate.getTime()) {
    throw new Error('dueDate nao pode ser anterior a documentDate.');
  }
}

export function validateCommitmentAmounts(
  commitment: Pick<
    Commitment,
    | 'amountCents'
    | 'originalAmountCents'
    | 'settledAmountCents'
    | 'settlementDifferenceCents'
    | 'settlementDifferenceReason'
  >,
): void {
  assertInteger(commitment.amountCents, 'amountCents');
  assertInteger(commitment.originalAmountCents, 'originalAmountCents');

  if (commitment.settledAmountCents !== undefined) {
    assertInteger(commitment.settledAmountCents, 'settledAmountCents');
  }

  if (commitment.settlementDifferenceCents !== undefined) {
    assertInteger(commitment.settlementDifferenceCents, 'settlementDifferenceCents');
  }

  if (
    commitment.settlementDifferenceCents !== undefined &&
    commitment.settledAmountCents === undefined
  ) {
    throw new Error(
      'settlementDifferenceCents exige settledAmountCents para validacao da diferenca.',
    );
  }

  const hasDifference =
    commitment.settledAmountCents !== undefined &&
    commitment.settledAmountCents !== commitment.originalAmountCents;

  if (hasDifference && commitment.settlementDifferenceCents === undefined) {
    throw new Error('settlementDifferenceCents e obrigatorio quando houver diferenca de liquidacao.');
  }

  if (!hasDifference && commitment.settlementDifferenceCents !== undefined) {
    throw new Error('settlementDifferenceCents nao deve existir sem diferenca explicita.');
  }

  if (hasDifference && !commitment.settlementDifferenceReason?.trim()) {
    throw new Error('settlementDifferenceReason e obrigatorio quando houver diferenca de liquidacao.');
  }
}

export function resolveCommitmentStatusFromLedgerLinks(
  commitment: Pick<Commitment, 'ledgerLinks'>,
): CommitmentStatusResolution {
  const recognition = countByRelation(commitment.ledgerLinks, 'recognition');
  const recognitionReversal = countByRelation(commitment.ledgerLinks, 'recognition_reversal');
  const settlement = countByRelation(commitment.ledgerLinks, 'settlement');
  const settlementReversal = countByRelation(commitment.ledgerLinks, 'settlement_reversal');

  const activeRecognition = Math.max(0, recognition - recognitionReversal);
  const activeSettlement = Math.max(0, settlement - settlementReversal);

  const inconsistencies: string[] = [];

  if (recognition === 0) {
    inconsistencies.push('Commitment sem reconhecimento contabil registrado.');
  }
  if (activeRecognition === 0) {
    inconsistencies.push('Commitment aberto sem reconhecimento ativo.');
  }
  if (activeSettlement > 0 && activeRecognition === 0) {
    inconsistencies.push('Liquidacao ativa sem reconhecimento ativo.');
  }
  if (activeSettlement > activeRecognition) {
    inconsistencies.push('Quantidade de liquidacoes ativas excede reconhecimentos ativos.');
  }

  if (activeRecognition === 0) {
    return {
      derivedStatus: 'invalid',
      hasActiveRecognition: false,
      hasActiveSettlement: activeSettlement > 0,
      inconsistencies,
    };
  }

  return {
    derivedStatus: activeSettlement > 0 ? 'settled' : 'confirmed',
    hasActiveRecognition: true,
    hasActiveSettlement: activeSettlement > 0,
    inconsistencies,
  };
}

export function resolveCommitmentCapabilities(
  commitment: Pick<
    Commitment,
    'ledgerLinks' | 'settledAmountCents' | 'originalAmountCents' | 'settlementDifferenceCents'
  >,
): CommitmentCapabilities {
  const status = resolveCommitmentStatusFromLedgerLinks(commitment);
  const hasExplicitDifference =
    commitment.settlementDifferenceCents !== undefined &&
    commitment.settledAmountCents !== undefined &&
    commitment.settledAmountCents !== commitment.originalAmountCents;

  return {
    canSettle: status.derivedStatus === 'confirmed' && status.hasActiveRecognition,
    canReverseSettlement: status.derivedStatus === 'settled' && status.hasActiveSettlement,
    hasActiveRecognition: status.hasActiveRecognition,
    hasActiveSettlement: status.hasActiveSettlement,
    hasExplicitDifference,
    isOpen: status.derivedStatus === 'confirmed',
    isSettled: status.derivedStatus === 'settled',
    inconsistencies: status.inconsistencies,
  };
}
