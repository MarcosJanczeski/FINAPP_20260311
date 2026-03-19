import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Counterparty, CounterpartyType } from '../../domain/entities/Counterparty';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

const COUNTERPARTY_TYPE_OPTIONS: { value: CounterpartyType; label: string }[] = [
  { value: 'person', label: 'Pessoa' },
  { value: 'company', label: 'Empresa' },
  { value: 'bank', label: 'Banco' },
  { value: 'card_issuer', label: 'Emissor de cartao' },
  { value: 'other', label: 'Outro' },
];

function mapCounterpartyTypeLabel(type: CounterpartyType | null): string {
  if (!type) {
    return 'Nao informado';
  }

  return COUNTERPARTY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function mapCounterpartyStatusLabel(status: Counterparty['status']): string {
  if (status === 'archived') {
    return 'Arquivada';
  }
  return 'Ativa';
}

export function CounterpartiesPage() {
  const { session } = useAuth();
  const container = useAppContainer();

  const [controlCenterId, setControlCenterId] = useState<string | null>(null);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [type, setType] = useState<CounterpartyType | ''>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const sortedCounterparties = useMemo(
    () => [...counterparties].sort((a, b) => a.name.localeCompare(b.name)),
    [counterparties],
  );

  const resetForm = () => {
    setName('');
    setDocument('');
    setType('');
    setEmail('');
    setPhone('');
    setNotes('');
  };

  const loadCounterparties = async () => {
    if (!session) {
      return;
    }

    const setup = await container.useCases.getAccountsSetup.execute(session.userId);
    setControlCenterId(setup.controlCenterId);
    const items = await container.useCases.listCounterparties.execute(setup.controlCenterId);
    setCounterparties(items);
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
        const items = await container.useCases.listCounterparties.execute(setup.controlCenterId);
        if (!mounted) {
          return;
        }
        setCounterparties(items);
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : 'Falha ao carregar contraparte.',
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlCenterId || isSaving) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await container.useCases.createCounterparty.execute({
        controlCenterId,
        name,
        document: document || null,
        type: type || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      });
      await loadCounterparties();
      setSuccess('Contrapartida criada com sucesso.');
      setIsCreateOpen(false);
      resetForm();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Nao foi possivel criar a contrapartida.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoutePlaceholder
      title="Counterparties"
      description="Cadastro manual de contrapartes financeiras operacionais."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.dashboard}>Voltar para dashboard</Link>
        <Link to={ROUTES.accounts}>Ir para contas</Link>
      </div>

      <section style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setIsCreateOpen((current) => !current);
          }}
        >
          {isCreateOpen ? 'Cancelar novo cadastro' : 'Adicionar contrapartida'}
        </button>

        {isCreateOpen ? (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.6rem', maxWidth: '420px' }}>
            <label htmlFor="counterparty-name">Nome</label>
            <input
              id="counterparty-name"
              type="text"
              value={name}
              onChange={(inputEvent) => setName(inputEvent.target.value)}
              required
            />

            <label htmlFor="counterparty-document">Documento</label>
            <input
              id="counterparty-document"
              type="text"
              value={document}
              onChange={(inputEvent) => setDocument(inputEvent.target.value)}
            />

            <label htmlFor="counterparty-type">Tipo</label>
            <select
              id="counterparty-type"
              value={type}
              onChange={(inputEvent) => setType(inputEvent.target.value as CounterpartyType | '')}
            >
              <option value="">Nao informado</option>
              {COUNTERPARTY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor="counterparty-email">Email</label>
            <input
              id="counterparty-email"
              type="email"
              value={email}
              onChange={(inputEvent) => setEmail(inputEvent.target.value)}
            />

            <label htmlFor="counterparty-phone">Telefone</label>
            <input
              id="counterparty-phone"
              type="text"
              value={phone}
              onChange={(inputEvent) => setPhone(inputEvent.target.value)}
            />

            <label htmlFor="counterparty-notes">Observacoes</label>
            <textarea
              id="counterparty-notes"
              value={notes}
              onChange={(inputEvent) => setNotes(inputEvent.target.value)}
              rows={3}
            />

            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar contrapartida'}
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
        <h2>Counterparties cadastradas</h2>
        {isLoading ? <p>Carregando...</p> : null}
        {!isLoading && sortedCounterparties.length === 0 ? (
          <p>Nenhuma contrapartida cadastrada ainda.</p>
        ) : null}

        {!isLoading && sortedCounterparties.length > 0 ? (
          <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0, margin: 0 }}>
            {sortedCounterparties.map((counterparty) => (
              <li
                key={counterparty.id}
                style={{
                  border: '1px solid #d7d7d7',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  display: 'grid',
                  gap: '0.35rem',
                }}
              >
                <strong>{counterparty.name}</strong>
                <span>Documento: {counterparty.document ?? 'Nao informado'}</span>
                <span>Tipo: {mapCounterpartyTypeLabel(counterparty.type)}</span>
                <span>Status: {mapCounterpartyStatusLabel(counterparty.status)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </RoutePlaceholder>
  );
}
