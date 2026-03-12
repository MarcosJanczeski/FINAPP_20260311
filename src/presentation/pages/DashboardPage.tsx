import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { session, logout } = useAuth();

  return (
    <RoutePlaceholder title="Dashboard" description="Placeholder da area autenticada.">
      <p>Sessao ativa para: {session?.userId}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.welcome}>Voltar para welcome</Link>
        <Link to={ROUTES.accounts}>Ir para contas</Link>
        <button type="button" onClick={() => void logout()}>
          Sair
        </button>
      </div>
    </RoutePlaceholder>
  );
}
