import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';

export function ProjectionPage() {
  return (
    <RoutePlaceholder
      title="Projecao"
      description="Placeholder do tour essencial para visao de saldos e eventos projetados."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.recurrences}>Voltar para recorrencias</Link>
        <Link to={ROUTES.planning}>Proximo: planejamento</Link>
      </div>
    </RoutePlaceholder>
  );
}
