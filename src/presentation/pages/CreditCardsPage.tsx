import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';

export function CreditCardsPage() {
  return (
    <RoutePlaceholder
      title="Cartoes de Credito"
      description="Placeholder do tour essencial para importacao e conciliacao de fatura."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={ROUTES.accounts}>Voltar para contas</Link>
        <Link to={ROUTES.recurrences}>Proximo: recorrencias</Link>
      </div>
    </RoutePlaceholder>
  );
}
