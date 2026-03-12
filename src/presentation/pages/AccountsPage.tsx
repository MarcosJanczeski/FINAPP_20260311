import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Account, AccountNature, AccountType } from '../../domain/entities/Account';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';
import { CurrencyInput, formatCurrencyFromCents } from '../forms/CurrencyInput';

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Caixa' },
  { value: 'checking', label: 'Conta corrente' },
  { value: 'digital', label: 'Conta digital' },
  { value: 'investment', label: 'Investimento' },
  { value: 'other', label: 'Outra' },
];

export function AccountsPage() {
  const { session } = useAuth();
  const container = useAppContainer();
  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [openingEntries, setOpeningEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [nature, setNature] = useState<AccountNature>('asset');
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);

  const availableLedgerAccounts = useMemo(
    () => ledgerAccounts.filter((account) => account.kind === nature),
    [ledgerAccounts, nature],
  );

  useEffect(() => {
    if (!availableLedgerAccounts.length) {
      setLedgerAccountId('');
      return;
    }

    const stillValid = availableLedgerAccounts.some((account) => account.id === ledgerAccountId);
    if (!stillValid) {
      setLedgerAccountId(availableLedgerAccounts[0].id);
    }
  }, [availableLedgerAccounts, ledgerAccountId]);

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

        setControlCenterId(setup.controlCenterId);
        setAccounts(setup.accounts);
        setLedgerAccounts(setup.ledgerAccounts);
        setOpeningEntries(setup.openingEntries);
      } catch (currentError) {
        if (mounted) {
          setError(currentError instanceof Error ? currentError.message : 'Falha ao carregar contas.');
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

  const refreshData = async () => {
    if (!session) {
      return;
    }

    const setup = await container.useCases.getAccountsSetup.execute(session.userId);
    setControlCenterId(setup.controlCenterId);
    setAccounts(setup.accounts);
    setLedgerAccounts(setup.ledgerAccounts);
    setOpeningEntries(setup.openingEntries);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId) {
      setError('Centro de controle nao identificado.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await container.useCases.createAccountWithOpeningBalance.execute({
        controlCenterId,
        name,
        type,
        nature,
        ledgerAccountId,
        openingBalanceCents,
      });

      setName('');
      setType('cash');
      setNature('asset');
      setOpeningBalanceCents(0);
      await refreshData();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao criar conta.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <RoutePlaceholder title="Contas" description="Carregando contas..." />;
  }

  return (
    <RoutePlaceholder title="Contas" description="Cadastro minimo de disponibilidades com abertura contabil.">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
        <label htmlFor="account-name">Nome da conta</label>
        <input
          id="account-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="account-type">Tipo</label>
        <select
          id="account-type"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
        >
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="account-nature">Natureza</label>
        <select
          id="account-nature"
          value={nature}
          onChange={(event) => setNature(event.target.value as AccountNature)}
        >
          <option value="asset">Ativo</option>
          <option value="liability">Passivo</option>
        </select>

        <label htmlFor="ledger-account">Conta contabil</label>
        <select
          id="ledger-account"
          value={ledgerAccountId}
          onChange={(event) => setLedgerAccountId(event.target.value)}
          required
        >
          {availableLedgerAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} - {account.name}
            </option>
          ))}
        </select>

        <label htmlFor="opening-balance">Saldo inicial</label>
        <CurrencyInput
          id="opening-balance"
          valueCents={openingBalanceCents}
          onChangeCents={setOpeningBalanceCents}
        />

        <button type="submit" disabled={isSaving || !ledgerAccountId}>
          {isSaving ? 'Salvando...' : 'Cadastrar conta'}
        </button>
      </form>

      {error ? <p>{error}</p> : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Contas cadastradas</h2>
        {accounts.length === 0 ? (
          <p>Nenhuma conta cadastrada.</p>
        ) : (
          <ul>
            {accounts.map((account) => (
              <li key={account.id}>
                {account.name} ({account.nature}) - {formatCurrencyFromCents(account.openingBalanceCents)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2>Lancamentos de abertura</h2>
        {openingEntries.length === 0 ? (
          <p>Nenhum lancamento de abertura.</p>
        ) : (
          <ul>
            {openingEntries.map((entry) => {
              const amount = entry.lines.reduce((max, line) => Math.max(max, line.debitCents, line.creditCents), 0);
              return (
                <li key={entry.id}>
                  {entry.description} - {formatCurrencyFromCents(amount)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p>
        <Link to={ROUTES.dashboard}>Voltar para dashboard</Link>
      </p>
    </RoutePlaceholder>
  );
}
