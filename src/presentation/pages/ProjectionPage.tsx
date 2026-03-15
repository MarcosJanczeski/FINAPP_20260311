import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Account } from '../../domain/entities/Account';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { CurrencyInput, formatCurrencyFromCents } from '../forms/CurrencyInput';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';
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
  projectedFinalBalanceCents: number;
  consideredEventsCount: number;
}

export function ProjectionPage() {
  const { session } = useAuth();
  const container = useAppContainer();
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [settlementEventId, setSettlementEventId] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [confirmedAmountCents, setConfirmedAmountCents] = useState(0);
  const [settlementDate, setSettlementDate] = useState('');
  const [settlementAmountCents, setSettlementAmountCents] = useState(0);
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [settlementMemo, setSettlementMemo] = useState('');
  const [availableSettlementAccounts, setAvailableSettlementAccounts] = useState<Account[]>([]);
  const [availabilitySummary, setAvailabilitySummary] =
    useState<ProjectionAvailabilitySummaryView | null>(null);
  const confirmSectionRef = useRef<HTMLElement | null>(null);
  const confirmDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const settlementSectionRef = useRef<HTMLElement | null>(null);
  const settlementAccountSelectRef = useRef<HTMLSelectElement | null>(null);
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
  const visibleEvents = useMemo(
    () => events.filter((event) => event.status !== 'canceled'),
    [events],
  );
  const settlementEvent = useMemo(
    () => events.find((event) => event.id === settlementEventId) ?? null,
    [events, settlementEventId],
  );

  const functionalStateLabel = (event: PlanningEvent): string => {
    if (event.status === 'canceled') {
      return 'cancelado';
    }
    if (event.type === 'realizado') {
      return 'realizado';
    }
    if (event.type === 'confirmado_agendado') {
      return 'confirmado';
    }
    return 'previsto';
  };

  const sourceLabel = (event: PlanningEvent): string => {
    if (event.sourceType === 'recurrence') {
      return 'recorrência';
    }
    if (event.sourceType === 'budget_margin') {
      return 'planejamento';
    }
    return 'planejamento';
  };

  const getVisualTone = (event: PlanningEvent): {
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startConfirm = (event: PlanningEvent) => {
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

  const startSettlement = (event: PlanningEvent) => {
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

  const handleReverseConfirmation = async (planningEvent: PlanningEvent) => {
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
      });
      await refresh();
      setSuccess('Confirmacao revertida por estorno com sucesso.');
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
              Saldo projetado final:{' '}
              {formatCurrencyFromCents(availabilitySummary.projectedFinalBalanceCents)}
            </li>
            <li>Eventos considerados: {availabilitySummary.consideredEventsCount}</li>
          </ul>
        </section>
      ) : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Eventos de projecao (PlanningEvent)</h2>
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
                  <strong style={{ fontSize: '0.95rem' }}>{formatDatePtBrFromIso(event.dueDate)}</strong>
                  <span style={{ textTransform: 'capitalize', color: tone.stateColor, fontWeight: 600 }}>
                    {functionalStateLabel(event)} • {sourceLabel(event)}
                  </span>
                  <span style={{ color: '#222' }}>{event.description}</span>
                  <strong style={{ fontWeight: tone.valueWeight, color: tone.valueColor }}>
                    {formatCurrencyFromCents(event.amountCents)}
                  </strong>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {event.type === 'previsto_recorrencia' && event.status === 'active' ? (
                      <button type="button" onClick={() => startConfirm(event)}>
                        Confirmar recorrencia
                      </button>
                    ) : null}
                    {event.type === 'confirmado_agendado' && event.status === 'confirmed' ? (
                      <button
                        type="button"
                        onClick={() => startSettlement(event)}
                        disabled={isSaving}
                      >
                        {event.direction === 'outflow' ? 'Marcar como pago' : 'Marcar como recebido'}
                      </button>
                    ) : null}
                    {event.type === 'confirmado_agendado' && event.status === 'confirmed' ? (
                      <button
                        type="button"
                        onClick={() => void handleReverseConfirmation(event)}
                        disabled={isSaving}
                      >
                        Reverter confirmacao
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
    </RoutePlaceholder>
  );
}
