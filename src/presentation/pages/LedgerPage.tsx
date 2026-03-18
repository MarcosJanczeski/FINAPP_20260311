import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { formatCurrencyFromCents } from '../forms/CurrencyInput';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

const TYPE_OPTIONS: Array<{ value: 'all' | LedgerEntry['referenceType']; label: string }> = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'account_opening', label: 'Abertura' },
  { value: 'account_opening_reversal', label: 'Reversão' },
  { value: 'account_opening_adjustment', label: 'Ajuste' },
];

export function LedgerPage() {
  const { session } = useAuth();
  const container = useAppContainer();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState<'all' | LedgerEntry['referenceType']>('all');
  const [textFilter, setTextFilter] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'date'>('createdAt');

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const setup = await container.useCases.getAccountsSetup.execute(session.userId);
        if (!mounted) {
          return;
        }

        setEntries(setup.ledgerEntries);
        setLedgerAccounts(setup.ledgerAccounts);
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : 'Falha ao carregar lançamentos contábeis.',
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

  const filteredEntries = useMemo(() => {
    const normalized = textFilter.trim().toLowerCase();

    return entries
      .filter((entry) => typeFilter === 'all' || entry.referenceType === typeFilter)
      .filter((entry) => {
        if (!normalized) {
          return true;
        }

        return (
          entry.description.toLowerCase().includes(normalized) ||
          entry.referenceId.toLowerCase().includes(normalized)
        );
      })
      .sort((a, b) => {
        const left = sortBy === 'createdAt' ? a.createdAt : a.date;
        const right = sortBy === 'createdAt' ? b.createdAt : b.date;
        if (left === right) {
          return a.id > b.id ? -1 : 1;
        }
        return left > right ? -1 : 1;
      });
  }, [entries, typeFilter, textFilter, sortBy]);

  const ledgerAccountById = useMemo(() => {
    return new Map(ledgerAccounts.map((account) => [account.id, account]));
  }, [ledgerAccounts]);

  if (isLoading) {
    return <RoutePlaceholder title="Lançamentos Contábeis" description="Carregando dados..." />;
  }

  return (
    <RoutePlaceholder
      title="Lançamentos Contábeis"
      description="Listagem técnica do razão com filtros básicos."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.dashboard}>Voltar para dashboard</Link>
        <Link to={ROUTES.chartOfAccounts}>Ir para plano de contas</Link>
        <Link to={ROUTES.accounts}>Ir para contas</Link>
      </div>

      {error ? <p>{error}</p> : null}

      <section style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', maxWidth: 420 }}>
        <h2>Filtros</h2>

        <label htmlFor="ledger-type-filter">Tipo</label>
        <select
          id="ledger-type-filter"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="ledger-text-filter">Buscar (descrição ou referência)</label>
        <input
          id="ledger-text-filter"
          type="text"
          value={textFilter}
          onChange={(event) => setTextFilter(event.target.value)}
          placeholder="Digite para filtrar"
        />

        <label htmlFor="ledger-sort-filter">Ordenação</label>
        <select
          id="ledger-sort-filter"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
        >
          <option value="createdAt">Registro (mais recente primeiro)</option>
          <option value="date">Data do fato/evento (mais recente primeiro)</option>
        </select>

        <button type="button" onClick={() => setIsAdvancedOpen(true)}>
          Novo lançamento avançado
        </button>
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2>Registros</h2>
        {filteredEntries.length === 0 ? (
          <p>Nenhum lançamento encontrado com os filtros atuais.</p>
        ) : (
          <ul style={{ display: 'grid', gap: '0.75rem', padding: 0, listStyle: 'none' }}>
            {filteredEntries.map((entry) => {
              const totalDebit = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);

              return (
                <li
                  key={entry.id}
                  style={{
                    border: '1px solid #d7d7d7',
                    borderRadius: 8,
                    padding: '0.75rem',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <span style={{ fontWeight: 700 }}>
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span style={{ color: '#555' }}>
                      Registrado em: {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <strong>{entry.description}</strong>
                    <span>
                      {entry.referenceType}
                    </span>
                    <span>Ref: {entry.referenceId}</span>
                    <span>Valor do lançamento: {formatCurrencyFromCents(totalDebit)}</span>
                  </div>

                  <div>
                    <strong>Partidas</strong>
                    <ul style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none' }}>
                      {entry.lines.map((line, index) => {
                        const account = ledgerAccountById.get(line.ledgerAccountId);
                        const accountLabel = account
                          ? `${account.code} - ${account.name}`
                          : line.ledgerAccountId;

                        return (
                          <li
                            key={`${entry.id}-${line.ledgerAccountId}-${index}`}
                            style={{
                              borderTop: '1px solid #ececec',
                              paddingTop: '0.5rem',
                              marginTop: '0.5rem',
                              display: 'grid',
                              gap: '0.25rem',
                            }}
                          >
                            <span>
                              <strong>Conta:</strong> {accountLabel}
                            </span>
                            <span>
                              <strong>Débito:</strong> {formatCurrencyFromCents(line.debitCents)}
                            </span>
                            <span>
                              <strong>Crédito:</strong> {formatCurrencyFromCents(line.creditCents)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdvancedOpen ? (
        <section
          style={{
            marginTop: '1rem',
            border: '1px solid #d7d7d7',
            borderRadius: 8,
            padding: '0.75rem',
            display: 'grid',
            gap: '0.5rem',
            maxWidth: 420,
          }}
        >
          <h2>Novo lançamento avançado</h2>
          <p>Funcionalidade em evolução. O formulário contábil completo será implementado em etapa futura.</p>
          <button type="button" onClick={() => setIsAdvancedOpen(false)}>
            Fechar
          </button>
        </section>
      ) : null}
    </RoutePlaceholder>
  );
}
