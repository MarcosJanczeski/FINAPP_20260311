import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Account } from '../../domain/entities/Account';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { CurrencyInput, formatCurrencyFromCents } from '../forms/CurrencyInput';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';
import type { PlanningEventListItem } from '../../application/use-cases/ListPlanningEventsUseCase';
import {
  formatDatePtBrFromIso,
  inputValueToIsoDateAtNoonUtc,
  isoDateToInputValue,
} from '../../shared/utils/date';

interface ProjectionAvailabilitySummaryView {
  windowStart: string;
  windowEnd: string;
  baseBalanceCents: number;
  projectedInflowsCents: number;
  projectedOutflowsCents: number;
  lowestProjectedBalanceCents: number;
  projectedFinalBalanceCents: number;
  consideredEventsCount: number;
}

export function ProjectionPage() {
  const { session } = useAuth();
  const container = useAppContainer();
  const [events, setEvents] = useState<PlanningEventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [settlementEventId, setSettlementEventId] = useState<string | null>(null);
  const [postponeEventId, setPostponeEventId] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [confirmedAmountCents, setConfirmedAmountCents] = useState(0);
  const [settlementDate, setSettlementDate] = useState('');
  const [settlementAmountCents, setSettlementAmountCents] = useState(0);
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [settlementMemo, setSettlementMemo] = useState('');
  const [postponeSettlementDate, setPostponeSettlementDate] = useState('');
  const [availableSettlementAccounts, setAvailableSettlementAccounts] = useState<Account[]>([]);
  const [availabilitySummary, setAvailabilitySummary] =
    useState<ProjectionAvailabilitySummaryView | null>(null);
  const [filters, setFilters] = useState({
    previsto: true,
    confirmado: true,
    realizado: true,
    cancelado: false,
  });
  const confirmSectionRef = useRef<HTMLElement | null>(null);
  const confirmDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const settlementSectionRef = useRef<HTMLElement | null>(null);
  const settlementAccountSelectRef = useRef<HTMLSelectElement | null>(null);
  const postponeSectionRef = useRef<HTMLElement | null>(null);
  const postponeDateInputRef = useRef<HTMLInputElement | null>(null);
  const todayInputDate = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }, []);

  const refresh = async () => {
    if (!session) {
      return;
    }

    const setup = await container.useCases.getAccountsSetup.execute(session.userId);
    setControlCenterId(setup.controlCenterId);
    setAvailableSettlementAccounts(setup.accounts.filter((account) => account.status === 'active'));
    await container.useCases.syncPlanningEvents.execute({ controlCenterId: setup.controlCenterId });
    const [data, summary] = await Promise.all([
      container.useCases.listPlanningEvents.execute(setup.controlCenterId),
      container.useCases.getProjectionAvailabilitySummary.execute(setup.controlCenterId),
    ]);
    setEvents(data);
    setAvailabilitySummary(summary);
  };

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const getCashFlowDate = (event: PlanningEventListItem): string =>
    event.settlementDate ?? event.plannedSettlementDate;
  const getTemporalLabel = (event: PlanningEventListItem): string =>
    event.operationalState === 'realizado' ? 'Liquidado em' : 'Prev. pagamento';
  const getTemporalDate = (event: PlanningEventListItem): string =>
    event.operationalState === 'realizado'
      ? event.settlementDate ?? event.plannedSettlementDate
      : event.plannedSettlementDate;

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const state = event.operationalState;
      return filters[state as keyof typeof filters];
    }).sort((a, b) => {
      const cashFlowDateA = getCashFlowDate(a);
      const cashFlowDateB = getCashFlowDate(b);
      if (cashFlowDateA === cashFlowDateB) {
        return a.dueDate > b.dueDate ? 1 : -1;
      }
      return cashFlowDateA > cashFlowDateB ? 1 : -1;
    });
  }, [events, filters]);
  const settlementEvent = useMemo(
    () => events.find((event) => event.id === settlementEventId) ?? null,
    [events, settlementEventId],
  );
  const postponeEvent = useMemo(
    () => events.find((event) => event.id === postponeEventId) ?? null,
    [events, postponeEventId],
  );

  function functionalStateLabel(event: PlanningEventListItem): string {
    return event.operationalState;
  }

  const sourceLabel = (event: PlanningEventListItem): string => {
    if (event.sourceType === 'recurrence') {
      return 'recorrência';
    }
    if (event.sourceType === 'budget_margin') {
      return 'planejamento';
    }
    return 'planejamento';
  };

  const stateDisplayLabel = (event: PlanningEventListItem): string => {
    const state = functionalStateLabel(event);
    if (state === 'cancelado') {
      return 'Cancelado neste período';
    }
    return `${state} • ${sourceLabel(event)}`;
  };

  const getVisualTone = (event: PlanningEventListItem): {
    border: string;
    background: string;
    stateColor: string;
    valueWeight: 600 | 700;
    valueColor: string;
  } => {
    const state = functionalStateLabel(event);

    if (state === 'confirmado') {
      return {
        border: '1px solid #dca95a',
        background: '#fff7eb',
        stateColor: '#8b5e1a',
        valueWeight: 700,
        valueColor: '#8b5e1a',
      };
    }

    if (state === 'realizado') {
      return {
        border: '1px solid #b9d9c0',
        background: '#f3fbf5',
        stateColor: '#2f6d3e',
        valueWeight: 600,
        valueColor: '#2f6d3e',
      };
    }

    return {
      border: '1px solid #d7d7d7',
      background: '#ffffff',
      stateColor: '#5f5f5f',
      valueWeight: 600,
      valueColor: '#2b2b2b',
    };
  };

  const getDirectionalValueColor = (event: PlanningEventListItem): string => {
    return event.direction === 'inflow' ? '#1f6f8b' : '#a23b72';
  };

  const formatDirectionalValue = (event: PlanningEventListItem): string => {
    const signal = event.direction === 'inflow' ? '+' : '-';
    return `${signal} ${formatCurrencyFromCents(event.amountCents)}`;
  };

  const canConfirmOccurrence = (event: PlanningEventListItem): boolean =>
    event.sourceType === 'recurrence' && event.operationalState === 'previsto';

  const canSettleOccurrence = (event: PlanningEventListItem): boolean =>
    event.operationalState === 'confirmado';

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    (async () => {
      try {
        await refresh();
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : 'Falha ao carregar eventos de projecao.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    confirmSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    confirmDocumentInputRef.current?.focus();
  }, [selectedEvent]);

  useEffect(() => {
    if (!settlementEvent) {
      return;
    }

    settlementSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    settlementAccountSelectRef.current?.focus();
  }, [settlementEvent]);

  useEffect(() => {
    if (!postponeEvent) {
      return;
    }

    postponeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    postponeDateInputRef.current?.focus();
  }, [postponeEvent]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startConfirm = (event: PlanningEventListItem) => {
    setPostponeEventId(null);
    setSettlementEventId(null);
    setSelectedEventId(event.id);
    setDocumentDate(todayInputDate);
    setDueDate(isoDateToInputValue(event.dueDate));
    setConfirmedAmountCents(event.amountCents);
    setError(null);
    setSuccess(null);
  };

  const cancelConfirm = () => {
    setSelectedEventId(null);
    setDocumentDate('');
    setDueDate('');
    setConfirmedAmountCents(0);
    scrollToTop();
  };

  const startSettlement = (event: PlanningEventListItem) => {
    setPostponeEventId(null);
    setSelectedEventId(null);
    setSettlementEventId(event.id);
    setSettlementDate(todayInputDate);
    setSettlementAmountCents(event.amountCents);
    setSettlementAccountId('');
    setSettlementMemo('');
    setError(null);
    setSuccess(null);
  };

  const cancelSettlement = () => {
    setSettlementEventId(null);
    setSettlementDate('');
    setSettlementAmountCents(0);
    setSettlementAccountId('');
    setSettlementMemo('');
    scrollToTop();
  };

  const startPostponeSettlement = (event: PlanningEventListItem) => {
    setSelectedEventId(null);
    setSettlementEventId(null);
    setPostponeEventId(event.id);
    setPostponeSettlementDate(isoDateToInputValue(event.plannedSettlementDate));
    setError(null);
    setSuccess(null);
  };

  const cancelPostponeSettlement = () => {
    setPostponeEventId(null);
    setPostponeSettlementDate('');
    scrollToTop();
  };

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvent || !controlCenterId || !documentDate || !dueDate || !session) {
      setError('Dados de confirmacao invalidos.');
      return;
    }
    if (documentDate > todayInputDate) {
      setError('Data do fato/documento nao pode estar no futuro.');
      return;
    }
    if (dueDate < documentDate) {
      setError('Data de vencimento nao pode ser anterior a data do fato/documento.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.confirmRecurrencePlanningEvent.execute({
        id: selectedEvent.id,
        controlCenterId,
        confirmedByUserId: session.userId,
        documentDate: inputValueToIsoDateAtNoonUtc(documentDate),
        dueDate: inputValueToIsoDateAtNoonUtc(dueDate),
        plannedSettlementDate: inputValueToIsoDateAtNoonUtc(dueDate),
        confirmedAmountCents,
      });
      await refresh();
      setSuccess('Recorrencia confirmada como compromisso com sucesso.');
      cancelConfirm();
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao confirmar recorrencia.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReverseConfirmation = async (planningEvent: PlanningEventListItem) => {
    if (!controlCenterId || !session) {
      setError('Sessao ou centro de controle nao identificado.');
      return;
    }

    const confirmed = window.confirm(
      `Deseja reverter a confirmacao da recorrencia \"${planningEvent.description}\"?`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.reverseRecurrenceConfirmation.execute({
        id: planningEvent.id,
        controlCenterId,
        reversedByUserId: session.userId,
        targetState: 'forecast',
      });
      await refresh();
      setSuccess('Compromisso revertido para previsao por estorno.');
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Falha ao reverter confirmacao da recorrencia.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReverseSettlement = async (planningEvent: PlanningEventListItem) => {
    if (!controlCenterId || !session) {
      setError('Sessao ou centro de controle nao identificado.');
      return;
    }

    const confirmed = window.confirm(
      `Deseja reverter a liquidacao da recorrencia \"${planningEvent.description}\"?`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.reverseRecurrenceSettlement.execute({
        id: planningEvent.id,
        controlCenterId,
        reversedByUserId: session.userId,
      });
      await refresh();
      setSuccess('Liquidacao estornada com sucesso. O compromisso voltou para confirmado.');
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao reverter liquidacao.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVerification = async (
    planningEvent: PlanningEventListItem,
    nextVerified: boolean,
  ) => {
    if (!controlCenterId || !session) {
      setError('Sessao ou centro de controle nao identificado.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      if (nextVerified) {
        await container.useCases.verifyPlanningEvent.execute({
          id: planningEvent.id,
          controlCenterId,
          verifiedByUserId: session.userId,
        });
      } else {
        await container.useCases.unverifyPlanningEvent.execute({
          id: planningEvent.id,
          controlCenterId,
        });
      }
      await refresh();
      setSuccess(
        nextVerified ? 'Evento marcado como conferido.' : 'Conferência do evento desfeita.',
      );
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Falha ao atualizar conferência do evento.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelOccurrence = async (planningEvent: PlanningEventListItem) => {
    if (!controlCenterId || !session) {
      setError('Sessao ou centro de controle nao identificado.');
      return;
    }

    const confirmed = window.confirm(
      `Deseja cancelar a ocorrencia do periodo para \"${planningEvent.description}\"?`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.cancelRecurrencePlanningEventOccurrence.execute({
        id: planningEvent.id,
        controlCenterId,
        canceledByUserId: session.userId,
      });
      await refresh();
      setSuccess('Ocorrencia cancelada para este periodo com sucesso.');
      setSelectedEventId(null);
      setSettlementEventId(null);
      setPostponeEventId(null);
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao cancelar ocorrencia.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettlement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !session || !settlementEvent) {
      setError('Evento de liquidação inválido.');
      return;
    }
    if (!settlementDate || !settlementAccountId) {
      setError('Informe conta de disponibilidade e data de liquidação.');
      return;
    }
    if (settlementAmountCents <= 0) {
      setError('Valor de liquidação deve ser maior que zero.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.settleRecurrencePlanningEvent.execute({
        id: settlementEvent.id,
        controlCenterId,
        settlementDate: inputValueToIsoDateAtNoonUtc(settlementDate),
        settlementAmountCents,
        settlementAccountId,
        memo: settlementMemo,
        settledByUserId: session.userId,
      });
      await refresh();
      setSuccess('Compromisso liquidado e registrado na contabilidade com sucesso.');
      cancelSettlement();
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao liquidar compromisso.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertCancellation = async (planningEvent: PlanningEventListItem) => {
    if (!controlCenterId || !session) {
      setError('Sessao ou centro de controle nao identificado.');
      return;
    }

    const confirmed = window.confirm(
      `Deseja reverter o cancelamento da ocorrencia \"${planningEvent.description}\"?`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.revertRecurrenceOccurrenceCancellation.execute({
        id: planningEvent.id,
        controlCenterId,
        revertedByUserId: session.userId,
      });
      await refresh();
      setSuccess('Cancelamento revertido. A ocorrencia voltou para previsto.');
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Falha ao reverter cancelamento da ocorrencia.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostponeSettlement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !postponeEvent || !postponeSettlementDate) {
      setError('Dados de adiamento invalidos.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.postponePlanningEventSettlement.execute({
        id: postponeEvent.id,
        controlCenterId,
        plannedSettlementDate: inputValueToIsoDateAtNoonUtc(postponeSettlementDate),
      });
      await refresh();
      setSuccess('Pagamento adiado com sucesso. O compromisso permaneceu confirmado.');
      cancelPostponeSettlement();
      scrollToTop();
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao adiar pagamento.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoutePlaceholder
      title="Projecao"
      description="Base dinamica de eventos para projecao e planejamento (separada do razão oficial)."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.recurrences}>Voltar para recorrencias</Link>
        <Link to={ROUTES.planning}>Proximo: planejamento</Link>
        <button type="button" onClick={() => void refresh()} disabled={isLoading}>
          Atualizar eventos automaticos
        </button>
      </div>

      {success ? <p>{success}</p> : null}
      {error ? <p>{error}</p> : null}

      {availabilitySummary ? (
        <section style={{ marginTop: '1rem' }}>
          <h2>Resumo de saldo projetado de disponibilidades</h2>
          <p>
            Janela: {formatDatePtBrFromIso(availabilitySummary.windowStart)} ate{' '}
            {formatDatePtBrFromIso(availabilitySummary.windowEnd)}
          </p>
          <ul>
            <li>Saldo base atual: {formatCurrencyFromCents(availabilitySummary.baseBalanceCents)}</li>
            <li>
              Entradas projetadas: {formatCurrencyFromCents(availabilitySummary.projectedInflowsCents)}
            </li>
            <li>
              Saidas projetadas: {formatCurrencyFromCents(availabilitySummary.projectedOutflowsCents)}
            </li>
            <li>
              Menor saldo projetado: {formatCurrencyFromCents(availabilitySummary.lowestProjectedBalanceCents)}
            </li>
            <li>
              Saldo projetado final:{' '}
              {formatCurrencyFromCents(availabilitySummary.projectedFinalBalanceCents)}
            </li>
            <li>Eventos considerados: {availabilitySummary.consideredEventsCount}</li>
          </ul>
        </section>
      ) : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Eventos de projecao (PlanningEvent)</h2>
        <details>
          <summary>Filtros</summary>
          <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.4rem' }}>
            <label htmlFor="filter-previsto">
              <input
                id="filter-previsto"
                type="checkbox"
                checked={filters.previsto}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, previsto: event.target.checked }))
                }
              />{' '}
              Previsto
            </label>
            <label htmlFor="filter-confirmado">
              <input
                id="filter-confirmado"
                type="checkbox"
                checked={filters.confirmado}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, confirmado: event.target.checked }))
                }
              />{' '}
              Confirmado
            </label>
            <label htmlFor="filter-realizado">
              <input
                id="filter-realizado"
                type="checkbox"
                checked={filters.realizado}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, realizado: event.target.checked }))
                }
              />{' '}
              Realizado
            </label>
            <label htmlFor="filter-cancelado">
              <input
                id="filter-cancelado"
                type="checkbox"
                checked={filters.cancelado}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, cancelado: event.target.checked }))
                }
              />{' '}
              Cancelado
            </label>
          </div>
        </details>
        {isLoading ? <p>Carregando eventos...</p> : null}
        {!isLoading && visibleEvents.length === 0 ? (
          <p>
            Nenhum evento automatico ainda. Nesta etapa, as fontes de recorrencia e margem estao
            preparadas como stubs para evolucao.
          </p>
        ) : null}

        {visibleEvents.length > 0 ? (
          <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0 }}>
            {visibleEvents.map((event) => {
              const tone = getVisualTone(event);
              return (
                <li
                  key={event.id}
                  style={{
                    border: tone.border,
                    background: tone.background,
                    borderRadius: 8,
                    padding: '0.75rem',
                    display: 'grid',
                    gap: '0.35rem',
                  }}
                >
                  <strong style={{ fontSize: '0.95rem' }}>
                    {getTemporalLabel(event)}: {formatDatePtBrFromIso(getTemporalDate(event))}
                  </strong>
                  <span style={{ textTransform: 'capitalize', color: tone.stateColor, fontWeight: 600 }}>
                    {stateDisplayLabel(event)}
                  </span>
                  <span style={{ color: '#222' }}>{event.description}</span>
                  <span style={{ color: '#555' }}>
                    Vencimento: {formatDatePtBrFromIso(event.dueDate)}
                  </span>
                  <strong
                    style={{
                      fontWeight: tone.valueWeight,
                      color: getDirectionalValueColor(event),
                    }}
                  >
                    {formatDirectionalValue(event)}
                  </strong>

                  {event.isVerifiable ? (
                    <label
                      htmlFor={`projection-verified-${event.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}
                    >
                      <input
                        id={`projection-verified-${event.id}`}
                        type="checkbox"
                        checked={Boolean(event.isVerified)}
                        onChange={(next) =>
                          void handleToggleVerification(event, next.currentTarget.checked)
                        }
                        disabled={isSaving}
                      />
                      Conferido
                    </label>
                  ) : null}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {canConfirmOccurrence(event) ? (
                      <button type="button" onClick={() => startConfirm(event)} disabled={isSaving}>
                        Confirmar recorrencia
                      </button>
                    ) : null}
                    {canSettleOccurrence(event) ? (
                      <button
                        type="button"
                        onClick={() => startSettlement(event)}
                        disabled={isSaving}
                      >
                        {event.direction === 'outflow' ? 'Marcar como pago' : 'Marcar como recebido'}
                      </button>
                    ) : null}
                    {event.canPostponeSettlement ? (
                      <button
                        type="button"
                        onClick={() => startPostponeSettlement(event)}
                        disabled={isSaving}
                      >
                        Adiar pagamento
                      </button>
                    ) : null}
                    {event.canReverseConfirmation ? (
                      <button
                        type="button"
                        onClick={() => void handleReverseConfirmation(event)}
                        disabled={isSaving}
                      >
                        Voltar para previsão
                      </button>
                    ) : null}
                    {event.canReverseSettlement ? (
                      <button
                        type="button"
                        onClick={() => void handleReverseSettlement(event)}
                        disabled={isSaving}
                      >
                        Estornar liquidação
                      </button>
                    ) : null}
                    {event.isCancelable ? (
                      <button
                        type="button"
                        onClick={() => void handleCancelOccurrence(event)}
                        disabled={isSaving}
                      >
                        Cancelar ocorrência
                      </button>
                    ) : null}
                    {event.isCancelReversible ? (
                      <button
                        type="button"
                        onClick={() => void handleRevertCancellation(event)}
                        disabled={isSaving}
                      >
                        Reverter cancelamento
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {selectedEvent ? (
        <section ref={confirmSectionRef} style={{ marginTop: '1rem' }}>
          <h2>Confirmar recorrencia prevista</h2>
          <p>{selectedEvent.description}</p>
          <form onSubmit={handleConfirm} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
            <label htmlFor="confirm-document-date">Data do fato/documento</label>
            <input
              id="confirm-document-date"
              type="date"
              ref={confirmDocumentInputRef}
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
              max={todayInputDate}
              required
            />

            <label htmlFor="confirm-due-date">Data de vencimento</label>
            <input
              id="confirm-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              min={documentDate || undefined}
              required
            />

            <label htmlFor="confirm-amount">Valor confirmado</label>
            <CurrencyInput
              id="confirm-amount"
              valueCents={confirmedAmountCents}
              onChangeCents={setConfirmedAmountCents}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Confirmando...' : 'Confirmar compromisso'}
              </button>
              <button type="button" onClick={cancelConfirm} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {settlementEvent ? (
        <section ref={settlementSectionRef} style={{ marginTop: '1rem' }}>
          <h2>Liquidar compromisso confirmado</h2>
          <p>{settlementEvent.description}</p>
          <form onSubmit={handleSettlement} style={{ display: 'grid', gap: '0.5rem', maxWidth: 420 }}>
            <label htmlFor="settlement-account">Conta de disponibilidade</label>
            <select
              id="settlement-account"
              ref={settlementAccountSelectRef}
              value={settlementAccountId}
              onChange={(event) => setSettlementAccountId(event.target.value)}
              required
            >
              <option value="">Selecione uma conta</option>
              {availableSettlementAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <label htmlFor="settlement-date">Data da liquidacao</label>
            <input
              id="settlement-date"
              type="date"
              value={settlementDate}
              onChange={(event) => setSettlementDate(event.target.value)}
              required
            />

            <label htmlFor="settlement-amount">Valor pago/recebido</label>
            <CurrencyInput
              id="settlement-amount"
              valueCents={settlementAmountCents}
              onChangeCents={setSettlementAmountCents}
            />

            <label htmlFor="settlement-memo">Observacao (opcional)</label>
            <input
              id="settlement-memo"
              type="text"
              value={settlementMemo}
              onChange={(event) => setSettlementMemo(event.target.value)}
              placeholder="Memorando da liquidacao"
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Liquidando...' : 'Confirmar liquidacao'}
              </button>
              <button type="button" onClick={cancelSettlement} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {postponeEvent ? (
        <section ref={postponeSectionRef} style={{ marginTop: '1rem' }}>
          <h2>Adiar pagamento de compromisso confirmado</h2>
          <p>{postponeEvent.description}</p>
          <form
            onSubmit={handlePostponeSettlement}
            style={{ display: 'grid', gap: '0.5rem', maxWidth: 420 }}
          >
            <label htmlFor="postpone-settlement-date">Nova data prevista de liquidação</label>
            <input
              id="postpone-settlement-date"
              type="date"
              ref={postponeDateInputRef}
              value={postponeSettlementDate}
              onChange={(event) => setPostponeSettlementDate(event.target.value)}
              required
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Confirmar adiamento'}
              </button>
              <button type="button" onClick={cancelPostponeSettlement} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </RoutePlaceholder>
  );
}
