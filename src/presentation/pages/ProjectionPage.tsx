import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
  const [documentDate, setDocumentDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [confirmedAmountCents, setConfirmedAmountCents] = useState(0);
  const [availabilitySummary, setAvailabilitySummary] =
    useState<ProjectionAvailabilitySummaryView | null>(null);
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

  const startConfirm = (event: PlanningEvent) => {
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
          <ul>
            {visibleEvents.map((event) => (
              <li key={event.id}>
                {formatDatePtBrFromIso(event.dueDate)} | {event.type} | {event.status}{' '}
                | {event.description} | {formatCurrencyFromCents(event.amountCents)}{' '}
                {event.type === 'previsto_recorrencia' && event.status === 'active' ? (
                  <button type="button" onClick={() => startConfirm(event)} style={{ marginLeft: '0.5rem' }}>
                    Confirmar recorrencia
                  </button>
                ) : null}
                {event.type === 'confirmado_agendado' && event.status === 'confirmed' ? (
                  <button
                    type="button"
                    onClick={() => void handleReverseConfirmation(event)}
                    style={{ marginLeft: '0.5rem' }}
                    disabled={isSaving}
                  >
                    Reverter confirmacao
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selectedEvent ? (
        <section style={{ marginTop: '1rem' }}>
          <h2>Confirmar recorrencia prevista</h2>
          <p>{selectedEvent.description}</p>
          <form onSubmit={handleConfirm} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
            <label htmlFor="confirm-document-date">Data do fato/documento</label>
            <input
              id="confirm-document-date"
              type="date"
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
    </RoutePlaceholder>
  );
}
