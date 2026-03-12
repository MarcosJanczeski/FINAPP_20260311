import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';

export function HomePage() {
  return (
    <RoutePlaceholder title="FINAPP" description="Estrutura base do MVP.">
      <nav style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.login}>Login</Link>
        <Link to={ROUTES.signup}>Criar conta</Link>
        <Link to={ROUTES.welcome}>Welcome (protegida)</Link>
        <Link to={ROUTES.dashboard}>Dashboard (protegida)</Link>
      </nav>
    </RoutePlaceholder>
  );
}
