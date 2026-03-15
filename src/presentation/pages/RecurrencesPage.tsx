import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Recurrence } from '../../domain/entities/Recurrence';
import type { PlanningEventDirection } from '../../domain/entities/PlanningEvent';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { CurrencyInput, formatCurrencyFromCents } from '../forms/CurrencyInput';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

export function RecurrencesPage() {
  const { session } = useAuth();
  const container = useAppContainer();
  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [direction, setDirection] = useState<PlanningEventDirection>('outflow');
  const [amountCents, setAmountCents] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [showActive, setShowActive] = useState(true);
  const [showInactive, setShowInactive] = useState(true);
  const [showInflows, setShowInflows] = useState(true);
  const [showOutflows, setShowOutflows] = useState(true);

  const selected = useMemo(
    () => recurrences.find((recurrence) => recurrence.id === editingId) ?? null,
    [recurrences, editingId],
  );
  const filteredRecurrences = useMemo(() => {
    const statusAllows = (status: Recurrence['status']) => {
      const noneSelected = !showActive && !showInactive;
      const allSelected = showActive && showInactive;
      if (noneSelected || allSelected) {
        return true;
      }
      return status === 'active' ? showActive : showInactive;
    };

    const directionAllows = (directionValue: PlanningEventDirection) => {
      const noneSelected = !showInflows && !showOutflows;
      const allSelected = showInflows && showOutflows;
      if (noneSelected || allSelected) {
        return true;
      }
      return directionValue === 'inflow' ? showInflows : showOutflows;
    };

    return recurrences.filter((recurrence) => {
      const statusMatches = statusAllows(recurrence.status);
      const directionMatches = directionAllows(recurrence.direction);
      return statusMatches && directionMatches;
    });
  }, [recurrences, showActive, showInactive, showInflows, showOutflows]);

  const inflowRecurrences = useMemo(
    () => filteredRecurrences.filter((recurrence) => recurrence.direction === 'inflow'),
    [filteredRecurrences],
  );
  const outflowRecurrences = useMemo(
    () => filteredRecurrences.filter((recurrence) => recurrence.direction === 'outflow'),
    [filteredRecurrences],
  );

  const getDirectionalValueColor = (recurrence: Recurrence): string => {
    if (recurrence.direction === 'inflow') {
      return recurrence.status === 'active' ? '#1f6f8b' : '#6f9fb2';
    }
    return recurrence.status === 'active' ? '#a23b72' : '#c692b0';
  };

  const formatDirectionalValue = (recurrence: Recurrence): string => {
    const signal = recurrence.direction === 'inflow' ? '+' : '-';
    return `${signal} ${formatCurrencyFromCents(recurrence.amountCents)}`;
  };

  const getCardTone = (recurrence: Recurrence): {
    border: string;
    background: string;
    stateColor: string;
  } => {
    if (recurrence.status === 'active') {
      return {
        border: '1px solid #d7d7d7',
        background: '#ffffff',
        stateColor: '#5f5f5f',
      };
    }

    return {
      border: '1px solid #e4e4e4',
      background: '#f7f7f7',
      stateColor: '#8a8a8a',
    };
  };

  const loadData = async () => {
    if (!session) {
      return;
    }

    const setup = await container.useCases.getAccountsSetup.execute(session.userId);
    setControlCenterId(setup.controlCenterId);
    const items = await container.useCases.listRecurrences.execute(setup.controlCenterId);
    setRecurrences(items);
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    (async () => {
      try {
        await loadData();
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error ? currentError.message : 'Falha ao carregar recorrencias.',
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const focusRecurrenceForm = () => {
    const section = document.getElementById('recurrence-form-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const input = document.getElementById('recurrence-description') as HTMLInputElement | null;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 120);
  };

  useEffect(() => {
    if (!isFormVisible) {
      return;
    }
    focusRecurrenceForm();
  }, [editingId, isFormVisible]);

  const resetForm = (scrollOnReset = false) => {
    setEditingId(null);
    setDescription('');
    setDirection('outflow');
    setAmountCents(0);
    setDayOfMonth(1);
    setIsActive(true);
    if (scrollOnReset) {
      scrollToTop();
    }
  };

  const openCreateForm = () => {
    setError(null);
    setSuccess(null);
    resetForm(false);
    setIsFormVisible(true);
  };

  const closeForm = () => {
    setIsFormVisible(false);
    resetForm(true);
  };

  const startEdit = (recurrence: Recurrence) => {
    setEditingId(recurrence.id);
    setDescription(recurrence.description);
    setDirection(recurrence.direction);
    setAmountCents(recurrence.amountCents);
    setDayOfMonth(recurrence.dayOfMonth);
    setIsActive(recurrence.status === 'active');
    setError(null);
    setSuccess(null);
    setIsFormVisible(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId) {
      setError('Centro de controle nao identificado.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.upsertRecurrence.execute({
        id: editingId ?? undefined,
        controlCenterId,
        description,
        dayOfMonth,
        direction,
        amountCents,
        status: isActive ? 'active' : 'inactive',
      });

      await container.useCases.syncPlanningEvents.execute({ controlCenterId });
      await loadData();
      setIsFormVisible(false);
      resetForm(true);
      setSuccess('Recorrencia salva com sucesso.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao salvar recorrencia.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoutePlaceholder
      title="Recorrencias"
      description="Cadastro mensal inicial de recorrencias para alimentar a projecao automaticamente."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.creditCards}>Voltar para cartoes</Link>
        <Link to={ROUTES.projection}>Proximo: projecao</Link>
        <button type="button" onClick={openCreateForm}>
          Nova recorrencia
        </button>
      </div>

      {success ? <p>{success}</p> : null}
      {error ? <p>{error}</p> : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Recorrencias cadastradas</h2>
        {isLoading ? <p>Carregando...</p> : null}
        {!isLoading && recurrences.length === 0 ? <p>Nenhuma recorrencia cadastrada.</p> : null}
        {recurrences.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem', maxWidth: 420 }}>
            <h3>Filtros</h3>
            <p style={{ margin: 0, fontWeight: 600 }}>Status</p>
            <label htmlFor="filter-active" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="filter-active"
                type="checkbox"
                checked={showActive}
                onChange={(event) => setShowActive(event.target.checked)}
              />
              Ativas
            </label>
            <label htmlFor="filter-inactive" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="filter-inactive"
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Inativas
            </label>

            <p style={{ margin: 0, fontWeight: 600 }}>Direcao</p>
            <label htmlFor="filter-inflow" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="filter-inflow"
                type="checkbox"
                checked={showInflows}
                onChange={(event) => setShowInflows(event.target.checked)}
              />
              Entradas
            </label>
            <label htmlFor="filter-outflow" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="filter-outflow"
                type="checkbox"
                checked={showOutflows}
                onChange={(event) => setShowOutflows(event.target.checked)}
              />
              Saidas
            </label>
          </div>
        ) : null}
        {recurrences.length > 0 ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section>
              <h3>Entradas</h3>
              {inflowRecurrences.length === 0 ? (
                <p>Nenhuma recorrencia de entrada.</p>
              ) : (
                <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0 }}>
                  {inflowRecurrences.map((recurrence) => (
                    <li
                      key={recurrence.id}
                      style={{
                        ...getCardTone(recurrence),
                        borderRadius: 8,
                        padding: '0.75rem',
                        display: 'grid',
                        gap: '0.35rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.95rem' }}>{recurrence.description}</strong>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          color: getCardTone(recurrence).stateColor,
                          fontWeight: 600,
                        }}
                      >
                        {recurrence.status === 'active' ? 'ativa' : 'inativa'} • recorrência mensal •
                        entrada
                      </span>
                      <span style={{ color: '#222' }}>Dia {recurrence.dayOfMonth}</span>
                      <strong style={{ color: getDirectionalValueColor(recurrence) }}>
                        {formatDirectionalValue(recurrence)}
                      </strong>
                      <button
                        type="button"
                        style={{ width: 'fit-content' }}
                        onClick={() => startEdit(recurrence)}
                      >
                        Editar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3>Saidas</h3>
              {outflowRecurrences.length === 0 ? (
                <p>Nenhuma recorrencia de saida.</p>
              ) : (
                <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0 }}>
                  {outflowRecurrences.map((recurrence) => (
                    <li
                      key={recurrence.id}
                      style={{
                        ...getCardTone(recurrence),
                        borderRadius: 8,
                        padding: '0.75rem',
                        display: 'grid',
                        gap: '0.35rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.95rem' }}>{recurrence.description}</strong>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          color: getCardTone(recurrence).stateColor,
                          fontWeight: 600,
                        }}
                      >
                        {recurrence.status === 'active' ? 'ativa' : 'inativa'} • recorrência mensal •
                        saída
                      </span>
                      <span style={{ color: '#222' }}>Dia {recurrence.dayOfMonth}</span>
                      <strong style={{ color: getDirectionalValueColor(recurrence) }}>
                        {formatDirectionalValue(recurrence)}
                      </strong>
                      <button
                        type="button"
                        style={{ width: 'fit-content' }}
                        onClick={() => startEdit(recurrence)}
                      >
                        Editar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
        {recurrences.length > 0 && filteredRecurrences.length === 0 ? (
          <p>Nenhuma recorrencia encontrada para os filtros selecionados.</p>
        ) : null}
      </section>

      {isFormVisible ? (
        <section id="recurrence-form-section" style={{ marginTop: '1rem' }}>
          <h2>{selected ? 'Editar recorrencia' : 'Nova recorrencia'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
            <label htmlFor="recurrence-description">Descricao</label>
            <input
              id="recurrence-description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />

            <label htmlFor="recurrence-frequency">Periodicidade</label>
            <input id="recurrence-frequency" type="text" value="Mensal" disabled />

            <label htmlFor="recurrence-day">Dia do mes (1-31)</label>
            <input
              id="recurrence-day"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(Number.parseInt(event.target.value, 10) || 1)}
              required
            />

            <label htmlFor="recurrence-direction">Direcao</label>
            <select
              id="recurrence-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as PlanningEventDirection)}
            >
              <option value="outflow">Saida</option>
              <option value="inflow">Entrada</option>
            </select>

            <label htmlFor="recurrence-amount">Valor</label>
            <CurrencyInput
              id="recurrence-amount"
              valueCents={amountCents}
              onChangeCents={setAmountCents}
            />

            <label
              htmlFor="recurrence-active"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <input
                id="recurrence-active"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Ativa
            </label>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : selected ? 'Salvar edicao' : 'Salvar recorrencia'}
              </button>
              <button type="button" onClick={closeForm} disabled={isSaving}>
                {selected ? 'Cancelar edicao' : 'Cancelar'}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </RoutePlaceholder>
  );
}
