import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAuth } from '../hooks/useAuth';

export function WelcomePage() {
  const { session, logout } = useAuth();

  return (
    <RoutePlaceholder title="Boas-vindas" description="Area protegida para usuario autenticado.">
      <p>Usuario autenticado: {session?.userId}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.dashboard}>Ir para dashboard</Link>
        <button type="button" onClick={() => void logout()}>
          Sair
        </button>
      </div>
    </RoutePlaceholder>
  );
}
