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
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [nature, setNature] = useState<AccountNature>('asset');
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('cash');

  const [adjustOpeningBalanceCents, setAdjustOpeningBalanceCents] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const availableLedgerAccounts = useMemo(
    () => ledgerAccounts.filter((account) => account.kind === nature),
    [ledgerAccounts, nature],
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
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
    if (!selectedAccount) {
      return;
    }

    setEditName(selectedAccount.name);
    setEditType(selectedAccount.type);

    setAdjustOpeningBalanceCents(selectedAccount.openingBalanceCents);
    setAdjustReason('');
  }, [selectedAccount]);

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
        setLedgerEntries(setup.ledgerEntries);

        if (!selectedAccountId && setup.accounts.length > 0) {
          setSelectedAccountId(setup.accounts[0].id);
        }
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
  }, [container, session, selectedAccountId]);

  const refreshData = async () => {
    if (!session) {
      return;
    }

    const setup = await container.useCases.getAccountsSetup.execute(session.userId);
    setControlCenterId(setup.controlCenterId);
    setAccounts(setup.accounts);
    setLedgerAccounts(setup.ledgerAccounts);
    setLedgerEntries(setup.ledgerEntries);

    if (setup.accounts.length === 0) {
      setSelectedAccountId('');
      return;
    }

    const stillExists = setup.accounts.some((account) => account.id === selectedAccountId);
    if (!stillExists) {
      setSelectedAccountId(setup.accounts[0].id);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !session) {
      setError('Centro de controle ou sessao nao identificado.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await container.useCases.createAccountWithOpeningBalance.execute({
        controlCenterId,
        createdByUserId: session.userId,
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

  const handleUpdateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !selectedAccount) {
      setError('Selecione uma conta para editar.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await container.useCases.updateAccountProfile.execute({
        controlCenterId,
        accountId: selectedAccount.id,
        name: editName,
        type: editType,
      });

      await refreshData();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao atualizar conta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustAccounting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !selectedAccount || !session) {
      setError('Selecione uma conta valida para ajustar.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await container.useCases.adjustAccountOpening.execute({
        controlCenterId,
        accountId: selectedAccount.id,
        updatedByUserId: session.userId,
        nature: selectedAccount.nature,
        ledgerAccountId: selectedAccount.ledgerAccountId,
        openingBalanceCents: adjustOpeningBalanceCents,
        reason: adjustReason.trim() || 'Ajuste manual de saldo inicial',
      });

      await refreshData();
      setAdjustReason('');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao ajustar conta.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <RoutePlaceholder title="Contas" description="Carregando contas..." />;
  }

  return (
    <RoutePlaceholder title="Contas" description="Cadastro e edicao com seguranca contabil.">
      <form onSubmit={handleCreateAccount} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
        <h2>Nova conta</h2>

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
                <button type="button" onClick={() => setSelectedAccountId(account.id)}>
                  Editar
                </button>{' '}
                {account.name} ({account.nature}) - {formatCurrencyFromCents(account.openingBalanceCents)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedAccount ? (
        <section style={{ marginTop: '1rem' }}>
          <h2>Editar conta selecionada</h2>
          <p>Conta atual: {selectedAccount.name}</p>

          <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
            <h3>Dados cadastrais</h3>
            <label htmlFor="edit-name">Nome</label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              required
            />

            <label htmlFor="edit-type">Tipo</label>
            <select
              id="edit-type"
              value={editType}
              onChange={(event) => setEditType(event.target.value as AccountType)}
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button type="submit" disabled={isSaving}>
              Salvar dados cadastrais
            </button>
          </form>

          <form
            onSubmit={handleAdjustAccounting}
            style={{ display: 'grid', gap: '0.5rem', maxWidth: 380, marginTop: '1rem' }}
          >
            <h3>Ajuste de saldo inicial</h3>
            <p>
              Informe apenas o novo saldo inicial. O sistema registra automaticamente o ajuste
              contabil e preserva todo o historico.
            </p>

            <label htmlFor="adjust-opening-balance">Saldo inicial</label>
            <CurrencyInput
              id="adjust-opening-balance"
              valueCents={adjustOpeningBalanceCents}
              onChangeCents={setAdjustOpeningBalanceCents}
            />

            <label htmlFor="adjust-reason">Motivo do ajuste</label>
            <input
              id="adjust-reason"
              type="text"
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              placeholder="Opcional"
            />

            <button type="submit" disabled={isSaving}>
              Salvar ajuste contabil automatico
            </button>
          </form>
        </section>
      ) : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Lancamentos contabeis de abertura/ajuste</h2>
        {ledgerEntries.length === 0 ? (
          <p>Nenhum lancamento contabil.</p>
        ) : (
          <ul>
            {ledgerEntries
              .filter((entry) => entry.referenceType.startsWith('account_opening'))
              .map((entry) => {
                const amount = entry.lines.reduce(
                  (max, line) => Math.max(max, line.debitCents, line.creditCents),
                  0,
                );
                return (
                  <li key={entry.id}>
                    {entry.referenceType} - {entry.description} - {formatCurrencyFromCents(amount)}
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
