import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';

export function PlanningPage() {
  return (
    <RoutePlaceholder
      title="Planejamento"
      description="Placeholder do tour essencial para configuracao de metas e dotacao orcamentaria."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.projection}>Voltar para projecao</Link>
        <Link to={ROUTES.dashboard}>Finalizar tour no dashboard</Link>
      </div>
    </RoutePlaceholder>
  );
}
