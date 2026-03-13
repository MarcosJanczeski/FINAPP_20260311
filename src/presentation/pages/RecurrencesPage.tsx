import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';

export function RecurrencesPage() {
  return (
    <RoutePlaceholder
      title="Recorrencias"
      description="Placeholder do tour essencial para cadastro e acompanhamento de recorrencias."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.creditCards}>Voltar para cartoes</Link>
        <Link to={ROUTES.projection}>Proximo: projecao</Link>
      </div>
    </RoutePlaceholder>
  );
}
