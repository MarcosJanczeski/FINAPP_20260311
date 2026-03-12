import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

type PersonTypeOption = 'individual' | 'business';

export function WelcomePage() {
  const navigate = useNavigate();
  const container = useAppContainer();
  const { session, logout } = useAuth();
  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<PersonTypeOption>('individual');
  const [phone, setPhone] = useState('');
  const [controlCenterName, setControlCenterName] = useState('Meu Centro de Controle');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const setup = await container.useCases.getWelcomeSetup.execute(session.userId);

        if (!mounted) {
          return;
        }

        if (setup.person) {
          setName(setup.person.name);
          setPersonType(setup.person.personType);
          setPhone(setup.person.phone ?? '');
        }

        if (setup.controlCenter) {
          setControlCenterName(setup.controlCenter.name);
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

    if (!session) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const person = await container.useCases.completeWelcomeProfile.execute({
        userId: session.userId,
        name,
        personType,
        phone,
      });

      await container.useCases.createOrUpdatePersonalControlCenter.execute({
        userId: session.userId,
        personId: person.id,
        name: controlCenterName,
      });

      navigate(ROUTES.dashboard, { replace: true });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao salvar dados.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <RoutePlaceholder title="Boas-vindas" description="Carregando dados iniciais..." />;
  }

  return (
    <RoutePlaceholder
      title="Boas-vindas"
      description="Complete os dados minimos para iniciar seu centro de controle pessoal."
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 360 }}>
        <section>
          <h2>Dados da pessoa</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label htmlFor="person-name">Nome</label>
            <input
              id="person-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />

            <label htmlFor="person-type">Tipo de pessoa</label>
            <select
              id="person-type"
              value={personType}
              onChange={(event) => setPersonType(event.target.value as PersonTypeOption)}
            >
              <option value="individual">Pessoa Fisica</option>
              <option value="business">Pessoa Juridica</option>
            </select>

            <label htmlFor="person-phone">Telefone (opcional)</label>
            <input
              id="person-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </section>

        <section>
          <h2>Centro de controle pessoal</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label htmlFor="control-center-name">Nome do centro</label>
            <input
              id="control-center-name"
              type="text"
              value={controlCenterName}
              onChange={(event) => setControlCenterName(event.target.value)}
              required
            />
          </div>
        </section>

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </form>

      {error ? <p>{error}</p> : null}

      <button type="button" onClick={() => void logout()} style={{ marginTop: '1rem' }}>
        Sair
      </button>
    </RoutePlaceholder>
  );
}
