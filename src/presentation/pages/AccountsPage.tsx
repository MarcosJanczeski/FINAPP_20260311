import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AccountNature, AccountType } from '../../domain/entities/Account';
import type { AccountListItemDTO } from '../../application/dto/AccountSetupDTO';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { AccountAvailabilityStatementDTO } from '../../application/use-cases/GetAccountAvailabilityStatementUseCase';
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

type ActiveForm = 'none' | 'create' | 'edit' | 'adjust';

function isAvailabilitySetup(type: AccountType, nature: AccountNature): boolean {
  return nature === 'asset' && (type === 'cash' || type === 'checking' || type === 'digital');
}

export function AccountsPage() {
  const { session } = useAuth();
  const container = useAppContainer();

  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountListItemDTO[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [availabilityStatement, setAvailabilityStatement] =
    useState<AccountAvailabilityStatementDTO | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [activeForm, setActiveForm] = useState<ActiveForm>('none');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [nature, setNature] = useState<AccountNature>('asset');
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('cash');

  const [adjustOpeningBalanceCents, setAdjustOpeningBalanceCents] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const availableLedgerAccounts = useMemo(
    () => ledgerAccounts.filter((account) => account.kind === nature),
    [ledgerAccounts, nature],
  );
  const isAvailabilityCreateFlow = useMemo(() => isAvailabilitySetup(type, nature), [type, nature]);

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

    if (setup.accounts.length === 0) {
      setSelectedAccountId('');
      return;
    }

    const stillExists = setup.accounts.some((account) => account.id === selectedAccountId);
    if (!stillExists) {
      setSelectedAccountId(setup.accounts[0].id);
    }
  };

  const refreshAvailabilityStatement = async () => {
    if (!controlCenterId || !selectedAccountId) {
      setAvailabilityStatement(null);
      return;
    }

    const statement = await container.useCases.getAccountAvailabilityStatement.execute({
      controlCenterId,
      accountId: selectedAccountId,
    });
    setAvailabilityStatement(statement);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    if (!controlCenterId || !selectedAccountId) {
      setAvailabilityStatement(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const statement = await container.useCases.getAccountAvailabilityStatement.execute({
          controlCenterId,
          accountId: selectedAccountId,
        });
        if (mounted) {
          setAvailabilityStatement(statement);
        }
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error ? currentError.message : 'Falha ao carregar extrato da conta.',
          );
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [container, controlCenterId, selectedAccountId]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const focusFormById = (inputId: string, sectionId: string) => {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 120);
  };

  useEffect(() => {
    if (activeForm === 'create') {
      focusFormById('account-name', 'accounts-form-create');
      return;
    }

    if (activeForm === 'edit') {
      focusFormById('edit-name', 'accounts-form-edit');
      return;
    }

    if (activeForm === 'adjust') {
      focusFormById('adjust-opening-balance', 'accounts-form-adjust');
    }
  }, [activeForm]);

  const startCreate = () => {
    clearMessages();
    setName('');
    setType('cash');
    setNature('asset');
    setOpeningBalanceCents(0);
    setActiveForm('create');
  };

  const startEdit = (account: AccountListItemDTO) => {
    clearMessages();
    setSelectedAccountId(account.id);
    setEditName(account.name);
    setEditType(account.type);
    setActiveForm('edit');
  };

  const startAdjust = (account: AccountListItemDTO) => {
    clearMessages();
    if (account.status === 'closed') {
      setError('Conta encerrada nao permite ajuste de saldo inicial.');
      return;
    }
    setSelectedAccountId(account.id);
    setAdjustOpeningBalanceCents(account.openingBalanceCents);
    setAdjustReason('');
    setActiveForm('adjust');
  };

  const closeForm = (scrollOnClose = false) => {
    setActiveForm('none');
    if (scrollOnClose) {
      scrollToTop();
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || !session) {
      setError('Centro de controle ou sessao nao identificado.');
      return;
    }

    clearMessages();
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

      await refreshData();
      await refreshAvailabilityStatement();
      setSuccess('Conta cadastrada com sucesso.');
      closeForm();
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

    clearMessages();
    setIsSaving(true);

    try {
      await container.useCases.updateAccountProfile.execute({
        controlCenterId,
        accountId: selectedAccount.id,
        name: editName,
        type: editType,
      });

      await refreshData();
      await refreshAvailabilityStatement();
      setSuccess('Dados da conta atualizados com sucesso.');
      closeForm();
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

    clearMessages();
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
      await refreshAvailabilityStatement();
      setSuccess('Ajuste contabil registrado com sucesso.');
      closeForm();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao ajustar conta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (account: AccountListItemDTO) => {
    if (!controlCenterId) {
      setError('Centro de controle nao identificado.');
      return;
    }

    const confirmed = window.confirm(`Deseja excluir a conta \"${account.name}\"?`);
    if (!confirmed) {
      return;
    }

    clearMessages();
    setIsSaving(true);

    try {
      await container.useCases.deleteAccount.execute({
        controlCenterId,
        accountId: account.id,
      });

      await refreshData();
      await refreshAvailabilityStatement();

      if (selectedAccountId === account.id) {
        setSelectedAccountId('');
        closeForm();
      }

      setSuccess('Conta excluida com sucesso.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao excluir conta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseAccount = async (account: AccountListItemDTO) => {
    if (!controlCenterId) {
      setError('Centro de controle nao identificado.');
      return;
    }

    if (account.status === 'closed') {
      setError('Conta ja esta encerrada.');
      return;
    }

    const confirmed = window.confirm(`Deseja encerrar a conta \"${account.name}\"?`);
    if (!confirmed) {
      return;
    }

    clearMessages();
    setIsSaving(true);

    try {
      await container.useCases.closeAccount.execute({
        controlCenterId,
        accountId: account.id,
      });

      await refreshData();
      await refreshAvailabilityStatement();

      if (selectedAccountId === account.id && activeForm === 'adjust') {
        closeForm();
      }

      setSuccess('Conta encerrada com sucesso.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao encerrar conta.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <RoutePlaceholder title="Contas" description="Carregando contas..." />;
  }

  return (
    <RoutePlaceholder title="Contas" description="Lista de contas com acoes e formularios sob demanda.">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={startCreate}>
          Nova conta
        </button>
        <Link to={ROUTES.dashboard}>Voltar para dashboard</Link>
        <Link to={ROUTES.ledger}>Ir para lançamentos</Link>
        <Link to={ROUTES.creditCards}>Proximo: cartoes</Link>
      </div>

      {success ? <p>{success}</p> : null}
      {error ? <p>{error}</p> : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Contas cadastradas</h2>
        {accounts.length === 0 ? (
          <p>Nenhuma conta cadastrada.</p>
        ) : (
          <ul>
            {accounts.map((account) => (
              <li key={account.id}>
                <strong>{account.name}</strong> ({account.nature}) -{' '}
                {formatCurrencyFromCents(account.currentBalanceCents)}{' '}
                [{account.status === 'closed' ? 'Encerrada' : 'Ativa'}]{' '}
                {account.closedAt ? `(encerrada em ${new Date(account.closedAt).toLocaleDateString('pt-BR')})` : ''}
                <button type="button" onClick={() => startEdit(account)} style={{ marginLeft: '0.5rem' }}>
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => startAdjust(account)}
                  style={{ marginLeft: '0.5rem' }}
                  disabled={account.status === 'closed'}
                >
                  Ajustar saldo
                </button>
                {account.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => void handleCloseAccount(account)}
                    style={{ marginLeft: '0.5rem' }}
                    disabled={isSaving}
                  >
                    Encerrar conta
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount(account)}
                  style={{ marginLeft: '0.5rem' }}
                  disabled={isSaving}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2>Extrato da conta (consulta)</h2>
        {accounts.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 420 }}>
            <label htmlFor="statement-account-select">Conta para consulta</label>
            <select
              id="statement-account-select"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {!selectedAccount ? <p>Selecione uma conta para consultar o extrato.</p> : null}
        {selectedAccount && !availabilityStatement ? <p>Carregando extrato...</p> : null}
        {availabilityStatement ? (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <p>
              Conta: <strong>{availabilityStatement.account.name}</strong> ({availabilityStatement.account.nature})
            </p>
            <p>Base do saldo acumulado: somente lançamentos do LedgerEntry desta conta contábil vinculada.</p>
            {availabilityStatement.lines.length === 0 ? (
              <p>Nenhum movimento contábil encontrado para esta conta.</p>
            ) : (
              <ul style={{ display: 'grid', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
                {availabilityStatement.lines.map((line) => (
                  <li
                    key={`${line.ledgerEntryId}-${line.date}`}
                    style={{
                      border: '1px solid #d7d7d7',
                      borderRadius: 8,
                      padding: '0.65rem',
                      display: 'grid',
                      gap: '0.2rem',
                    }}
                  >
                    <strong>{new Date(line.date).toLocaleDateString('pt-BR')}</strong>
                    <span>{line.description}</span>
                    <span>
                      Movimento:{' '}
                      {line.movementCents >= 0 ? '+' : '-'} {formatCurrencyFromCents(Math.abs(line.movementCents))}
                    </span>
                    <span>Saldo acumulado: {formatCurrencyFromCents(line.runningBalanceCents)}</span>
                    <span style={{ color: '#555' }}>
                      Ref: {line.referenceType} | {line.referenceId}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {activeForm === 'create' ? (
        <section id="accounts-form-create" style={{ marginTop: '1rem' }}>
          <h2>Nova conta</h2>
          <form onSubmit={handleCreateAccount} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
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
              required={!isAvailabilityCreateFlow}
              disabled={isAvailabilityCreateFlow}
            >
              {isAvailabilityCreateFlow ? (
                <option value="">
                  Conta específica de disponibilidades será criada automaticamente
                </option>
              ) : (
                availableLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))
              )}
            </select>
            {isAvailabilityCreateFlow ? (
              <p style={{ margin: 0 }}>
                Para contas de disponibilidades, o sistema cria e vincula automaticamente uma subconta
                contábil específica.
              </p>
            ) : null}

            <label htmlFor="opening-balance">Saldo inicial</label>
            <CurrencyInput
              id="opening-balance"
              valueCents={openingBalanceCents}
              onChangeCents={setOpeningBalanceCents}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving || (!ledgerAccountId && !isAvailabilityCreateFlow)}>
                {isSaving ? 'Salvando...' : 'Salvar conta'}
              </button>
              <button type="button" onClick={() => closeForm(true)} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeForm === 'edit' && selectedAccount ? (
        <section id="accounts-form-edit" style={{ marginTop: '1rem' }}>
          <h2>Editar conta</h2>
          <p>Conta selecionada: {selectedAccount.name}</p>
          <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}>
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

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving}>
                Salvar alteracoes
              </button>
              <button type="button" onClick={() => closeForm(true)} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeForm === 'adjust' && selectedAccount ? (
        <section id="accounts-form-adjust" style={{ marginTop: '1rem' }}>
          <h2>Ajustar saldo inicial</h2>
          <p>
            Conta selecionada: {selectedAccount.name}. O app registra o ajuste contabil automaticamente
            e preserva historico tecnico.
          </p>
          <form
            onSubmit={handleAdjustAccounting}
            style={{ display: 'grid', gap: '0.5rem', maxWidth: 380 }}
          >
            <label htmlFor="adjust-opening-balance">Novo saldo inicial</label>
            <CurrencyInput
              id="adjust-opening-balance"
              valueCents={adjustOpeningBalanceCents}
              onChangeCents={setAdjustOpeningBalanceCents}
            />

            <label htmlFor="adjust-reason">Motivo (opcional)</label>
            <input
              id="adjust-reason"
              type="text"
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              placeholder="Opcional"
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={isSaving}>
                Salvar ajuste
              </button>
              <button type="button" onClick={() => closeForm(true)} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

    </RoutePlaceholder>
  );
}
