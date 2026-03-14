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
  const [confirmedDate, setConfirmedDate] = useState('');
  const [confirmedAmountCents, setConfirmedAmountCents] = useState(0);
  const [availabilitySummary, setAvailabilitySummary] =
    useState<ProjectionAvailabilitySummaryView | null>(null);

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
    setConfirmedDate(isoDateToInputValue(event.date));
    setConfirmedAmountCents(event.amountCents);
    setError(null);
    setSuccess(null);
  };

  const cancelConfirm = () => {
    setSelectedEventId(null);
    setConfirmedDate('');
    setConfirmedAmountCents(0);
  };

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvent || !controlCenterId || !confirmedDate || !session) {
      setError('Dados de confirmacao invalidos.');
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
        confirmedDate: inputValueToIsoDateAtNoonUtc(confirmedDate),
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
        {!isLoading && events.length === 0 ? (
          <p>
            Nenhum evento automatico ainda. Nesta etapa, as fontes de recorrencia e margem estao
            preparadas como stubs para evolucao.
          </p>
        ) : null}

        {events.length > 0 ? (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                {formatDatePtBrFromIso(event.date)} | {event.type} | {event.status}{' '}
                | {event.description} | {formatCurrencyFromCents(event.amountCents)}{' '}
                {event.type === 'previsto_recorrencia' && event.status === 'active' ? (
                  <button type="button" onClick={() => startConfirm(event)} style={{ marginLeft: '0.5rem' }}>
                    Confirmar recorrencia
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
            <label htmlFor="confirm-date">Data confirmada</label>
            <input
              id="confirm-date"
              type="date"
              value={confirmedDate}
              onChange={(event) => setConfirmedDate(event.target.value)}
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
