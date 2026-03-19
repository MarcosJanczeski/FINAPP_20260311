import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CurrencyInput, formatCurrencyFromCents } from '../forms/CurrencyInput';
import type { Commitment, CommitmentType } from '../../domain/entities/Commitment';
import type { Counterparty } from '../../domain/entities/Counterparty';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

const COMMITMENT_TYPE_OPTIONS: { value: CommitmentType; label: string }[] = [
  { value: 'payable', label: 'A pagar' },
  { value: 'receivable', label: 'A receber' },
];

function formatIsoDate(value: string | undefined): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('pt-BR');
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapStatusLabel(status: Commitment['status']): string {
  return status === 'settled' ? 'Liquidado' : 'Confirmado';
}

function mapTypeLabel(type: CommitmentType): string {
  return type === 'payable' ? 'A pagar' : 'A receber';
}

export function CommitmentsPage() {
  const { session } = useAuth();
  const container = useAppContainer();

  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [counterpartyOptions, setCounterpartyOptions] = useState<Counterparty[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCounterpartyCreating, setIsCounterpartyCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [type, setType] = useState<CommitmentType>('payable');
  const [documentDate, setDocumentDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [plannedSettlementDate, setPlannedSettlementDate] = useState(todayIsoDate());
  const [counterpartyQuery, setCounterpartyQuery] = useState('');
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string>('');

  const counterpartiesById = useMemo(() => {
    const map = new Map<string, Counterparty>();
    for (const counterparty of counterparties) {
      map.set(counterparty.id, counterparty);
    }
    return map;
  }, [counterparties]);

  const selectedCounterparty = selectedCounterpartyId
    ? counterpartiesById.get(selectedCounterpartyId) ?? null
    : null;

  const sortedCommitments = useMemo(
    () =>
      [...commitments].sort((a, b) => {
        if (a.dueDate === b.dueDate) {
          return a.createdAt > b.createdAt ? -1 : 1;
        }
        return a.dueDate > b.dueDate ? 1 : -1;
      }),
    [commitments],
  );

  const resetCreateForm = () => {
    setDescription('');
    setAmountCents(0);
    setType('payable');
    setDocumentDate(todayIsoDate());
    setDueDate(todayIsoDate());
    setPlannedSettlementDate(todayIsoDate());
    setCounterpartyQuery('');
    setSelectedCounterpartyId('');
    setCounterpartyOptions([]);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const refreshData = async (currentControlCenterId: string) => {
    const [listedCommitments, listedCounterparties] = await Promise.all([
      container.useCases.listCommitments.execute(currentControlCenterId),
      container.useCases.listCounterparties.execute(currentControlCenterId),
    ]);

    setCommitments(listedCommitments);
    setCounterparties(listedCounterparties);
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;
    setIsLoading(true);

    (async () => {
      try {
        const setup = await container.useCases.getAccountsSetup.execute(session.userId);
        if (!mounted) {
          return;
        }

        setControlCenterId(setup.controlCenterId);
        await refreshData(setup.controlCenterId);
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : 'Falha ao carregar compromissos.',
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
  }, [container, session]);

  useEffect(() => {
    if (!controlCenterId) {
      return;
    }

    const query = counterpartyQuery.trim();
    if (!query || selectedCounterpartyId) {
      setCounterpartyOptions([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const matches = await container.useCases.searchCounterpartiesByName.execute({
          controlCenterId,
          query,
        });
        if (!cancelled) {
          setCounterpartyOptions(matches.slice(0, 8));
        }
      } catch {
        if (!cancelled) {
          setCounterpartyOptions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [container, controlCenterId, counterpartyQuery, selectedCounterpartyId]);

  const handleCreateCounterpartyInline = async () => {
    if (!controlCenterId) {
      return;
    }

    const name = counterpartyQuery.trim();
    if (!name) {
      return;
    }

    setIsCounterpartyCreating(true);
    clearMessages();

    try {
      const created = await container.useCases.createCounterparty.execute({
        controlCenterId,
        name,
      });
      setCounterparties((current) => [...current, created]);
      setSelectedCounterpartyId(created.id);
      setCounterpartyQuery(created.name);
      setCounterpartyOptions([]);
      setSuccess('Contrapartida criada e selecionada.');
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Nao foi possivel criar a contrapartida.',
      );
    } finally {
      setIsCounterpartyCreating(false);
    }
  };

  const handleCreateCommitment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !session || isSubmitting) {
      return;
    }

    clearMessages();

    if (!selectedCounterpartyId.trim()) {
      setError('Selecione uma contrapartida para criar o compromisso.');
      return;
    }

    setIsSubmitting(true);
    try {
      await container.useCases.createCommitment.execute({
        controlCenterId,
        type,
        description,
        amountCents,
        counterpartyId: selectedCounterpartyId,
        documentDate,
        dueDate,
        plannedSettlementDate,
        sourceType: 'manual',
        sourceEventKey: `manual:commitment:${crypto.randomUUID()}`,
        createdByUserId: session.userId,
      });
      await refreshData(controlCenterId);
      setSuccess('Compromisso criado com sucesso.');
      setIsCreateOpen(false);
      resetCreateForm();
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao criar compromisso.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettle = async (commitment: Commitment) => {
    clearMessages();
    try {
      await container.useCases.settleCommitment.execute({
        commitmentId: commitment.id,
        settlementDate: todayIsoDate(),
        settledAmountCents: commitment.originalAmountCents,
      });

      if (controlCenterId) {
        await refreshData(controlCenterId);
      }
      setSuccess('Compromisso liquidado com sucesso.');
    } catch (currentError) {
      setError(
        currentError instanceof Error ? currentError.message : 'Falha ao liquidar compromisso.',
      );
    }
  };

  const handleReverseSettlement = async (commitment: Commitment) => {
    clearMessages();
    try {
      await container.useCases.reverseCommitmentSettlement.execute({
        commitmentId: commitment.id,
        reversalDate: todayIsoDate(),
        reason: 'Estorno operacional via tela de commitments',
      });

      if (controlCenterId) {
        await refreshData(controlCenterId);
      }
      setSuccess('Liquidacao estornada com sucesso.');
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Falha ao estornar liquidacao do compromisso.',
      );
    }
  };

  return (
    <RoutePlaceholder title="Commitments" description="Compromissos a pagar e a receber.">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.dashboard}>Voltar para dashboard</Link>
        <Link to={ROUTES.counterparties}>Ir para counterparties</Link>
      </div>

      <section style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => {
            clearMessages();
            setIsCreateOpen((current) => !current);
          }}
        >
          {isCreateOpen ? 'Cancelar novo compromisso' : 'Novo compromisso'}
        </button>

        {isCreateOpen ? (
          <form onSubmit={handleCreateCommitment} style={{ display: 'grid', gap: '0.6rem', maxWidth: '480px' }}>
            <label htmlFor="commitment-description">Descricao</label>
            <input
              id="commitment-description"
              type="text"
              value={description}
              onChange={(inputEvent) => setDescription(inputEvent.target.value)}
              required
            />

            <label htmlFor="commitment-amount">Valor</label>
            <CurrencyInput
              id="commitment-amount"
              valueCents={amountCents}
              onChangeCents={setAmountCents}
            />

            <label htmlFor="commitment-type">Tipo</label>
            <select
              id="commitment-type"
              value={type}
              onChange={(inputEvent) => setType(inputEvent.target.value as CommitmentType)}
            >
              {COMMITMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor="commitment-counterparty">Counterparty (obrigatorio)</label>
            <input
              id="commitment-counterparty"
              type="text"
              value={counterpartyQuery}
              onChange={(inputEvent) => {
                setCounterpartyQuery(inputEvent.target.value);
                setSelectedCounterpartyId('');
              }}
              placeholder="Digite para buscar ou criar"
              required
            />

            {selectedCounterparty ? (
              <div style={{ fontSize: '0.9rem', color: '#2f6d3e' }}>
                Selecionada: <strong>{selectedCounterparty.name}</strong>
              </div>
            ) : null}

            {!selectedCounterparty && counterpartyQuery.trim() ? (
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {counterpartyOptions.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.3rem' }}>
                    {counterpartyOptions.map((counterparty) => (
                      <li key={counterparty.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCounterpartyId(counterparty.id);
                            setCounterpartyQuery(counterparty.name);
                            setCounterpartyOptions([]);
                          }}
                          style={{ width: '100%', textAlign: 'left' }}
                        >
                          {counterparty.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  disabled={isCounterpartyCreating}
                  onClick={() => void handleCreateCounterpartyInline()}
                >
                  {isCounterpartyCreating
                    ? 'Criando contrapartida...'
                    : `Criar "${counterpartyQuery.trim()}"`}
                </button>
              </div>
            ) : null}

            <label htmlFor="commitment-document-date">Data de competencia (documentDate)</label>
            <input
              id="commitment-document-date"
              type="date"
              value={documentDate}
              onChange={(inputEvent) => setDocumentDate(inputEvent.target.value)}
              required
            />

            <label htmlFor="commitment-due-date">Vencimento</label>
            <input
              id="commitment-due-date"
              type="date"
              value={dueDate}
              onChange={(inputEvent) => setDueDate(inputEvent.target.value)}
              required
            />

            <label htmlFor="commitment-planned-settlement-date">Previsao de liquidacao</label>
            <input
              id="commitment-planned-settlement-date"
              type="date"
              value={plannedSettlementDate}
              onChange={(inputEvent) => setPlannedSettlementDate(inputEvent.target.value)}
              required
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar compromisso'}
            </button>
          </form>
        ) : null}
      </section>

      {error ? (
        <p role="alert" style={{ color: '#a32525', marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" style={{ color: '#2f6d3e', marginTop: '0.75rem' }}>
          {success}
        </p>
      ) : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Compromissos</h2>
        {isLoading ? <p>Carregando...</p> : null}
        {!isLoading && sortedCommitments.length === 0 ? (
          <p>Nenhum compromisso cadastrado ainda.</p>
        ) : null}

        {!isLoading && sortedCommitments.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
            {sortedCommitments.map((commitment) => {
              const counterparty = counterpartiesById.get(commitment.counterpartyId);

              return (
                <li
                  key={commitment.id}
                  style={{
                    border: '1px solid #d7d7d7',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    display: 'grid',
                    gap: '0.35rem',
                  }}
                >
                  <strong>{commitment.description}</strong>
                  <span>Counterparty: {counterparty?.name ?? commitment.counterpartyId}</span>
                  <span>Tipo: {mapTypeLabel(commitment.type)}</span>
                  <span>Valor: {formatCurrencyFromCents(commitment.amountCents)}</span>
                  <span>Vencimento: {formatIsoDate(commitment.dueDate)}</span>
                  <span>Status: {mapStatusLabel(commitment.status)}</span>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {commitment.status === 'confirmed' ? (
                      <button type="button" onClick={() => void handleSettle(commitment)}>
                        Liquidar
                      </button>
                    ) : null}
                    {commitment.status === 'settled' ? (
                      <button type="button" onClick={() => void handleReverseSettlement(commitment)}>
                        Estornar
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </RoutePlaceholder>
  );
}
