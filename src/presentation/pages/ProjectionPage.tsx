import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { formatCurrencyFromCents } from '../forms/CurrencyInput';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

export function ProjectionPage() {
  const { session } = useAuth();
  const container = useAppContainer();
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!session) {
      return;
    }

    const setup = await container.useCases.getAccountsSetup.execute(session.userId);
    await container.useCases.syncPlanningEvents.execute({ controlCenterId: setup.controlCenterId });
    const data = await container.useCases.listPlanningEvents.execute(setup.controlCenterId);
    setEvents(data);
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

      {error ? <p>{error}</p> : null}

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
                {new Date(event.date).toLocaleDateString('pt-BR')} | {event.type} | {event.status}{' '}
                | {event.description} | {formatCurrencyFromCents(event.amountCents)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </RoutePlaceholder>
  );
}
