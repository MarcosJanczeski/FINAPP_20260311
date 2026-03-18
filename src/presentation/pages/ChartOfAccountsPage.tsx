import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChartOfAccountsNodeDTO, ChartOfAccountsRootCode } from '../../application/dto/ChartOfAccountsDTO';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAppContainer } from '../hooks/useAppContainer';
import { useAuth } from '../hooks/useAuth';

const ROOT_LABELS: Record<ChartOfAccountsRootCode, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PATRIMONIO_LIQUIDO: 'Patrimônio Líquido',
  RECEITAS: 'Receitas',
  DESPESAS: 'Despesas',
};

function usageLabel(usageCount: number): string {
  return usageCount === 1 ? '1 lançamento' : `${usageCount} lançamentos`;
}

export function ChartOfAccountsPage() {
  const { session } = useAuth();
  const container = useAppContainer();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roots, setRoots] = useState<ChartOfAccountsNodeDTO[]>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const setup = await container.useCases.getChartOfAccountsSetup.execute(session.userId);
        if (!mounted) {
          return;
        }

        setRoots(setup.roots);
        setExpandedNodeIds(
          setup.roots.reduce<Record<string, boolean>>((acc, root) => {
            acc[root.id] = true;
            return acc;
          }, {}),
        );
      } catch (currentError) {
        if (mounted) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : 'Falha ao carregar plano de contas.',
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

  const totalAccounts = useMemo(
    () => roots.reduce((sum, root) => sum + countNodes(root), 0),
    [roots],
  );

  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds((current) => ({
      ...current,
      [nodeId]: !current[nodeId],
    }));
  };

  if (isLoading) {
    return <RoutePlaceholder title="Plano de Contas" description="Carregando estrutura contábil..." />;
  }

  return (
    <RoutePlaceholder
      title="Plano de Contas"
      description="Visão estrutural do plano contábil por raízes e subcontas (mobile-first)."
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" disabled aria-disabled="true">
          Adicionar conta contábil
        </button>
        <Link to={ROUTES.dashboard}>Voltar para dashboard</Link>
        <Link to={ROUTES.ledger}>Ir para lançamentos</Link>
      </div>
      <p style={{ marginTop: '0.5rem', color: '#666' }}>
        Cadastro/edição de contas contábeis será habilitado no próximo step.
      </p>

      {error ? <p>{error}</p> : null}

      <section style={{ marginTop: '1rem' }}>
        <h2>Estrutura por raízes obrigatórias</h2>
        <p style={{ marginTop: '0.25rem' }}>
          Total de contas carregadas: <strong>{totalAccounts}</strong>
        </p>

        <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0, marginTop: '0.75rem' }}>
          {roots.map((rootNode) => {
            const rootCode = rootNode.code as ChartOfAccountsRootCode;
            const isExpanded = expandedNodeIds[rootNode.id] ?? true;
            return (
              <li
                key={rootNode.id}
                style={{
                  border: '1px solid #d7d7d7',
                  borderRadius: 10,
                  padding: '0.75rem',
                  display: 'grid',
                  gap: '0.6rem',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <strong>{ROOT_LABELS[rootCode] ?? rootNode.name}</strong>
                    <span style={{ color: '#4f4f4f' }}>{rootNode.code}</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ border: '1px solid #d7d7d7', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem' }}>
                        Raiz obrigatória
                      </span>
                      <span style={{ border: '1px solid #d7d7d7', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem' }}>
                        Sistema
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={() => toggleNode(rootNode.id)}>
                    {isExpanded ? 'Recolher' : 'Expandir'}
                  </button>
                </div>

                {isExpanded ? (
                  rootNode.children.length === 0 ? (
                    <p style={{ color: '#666' }}>Nenhuma subconta cadastrada nesta raiz.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                      {rootNode.children.map((node) => (
                        <ChartNodeRow
                          key={node.id}
                          node={node}
                          depth={1}
                          expandedNodeIds={expandedNodeIds}
                          onToggle={toggleNode}
                        />
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </RoutePlaceholder>
  );
}

function countNodes(node: ChartOfAccountsNodeDTO): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function ChartNodeRow({
  node,
  depth,
  expandedNodeIds,
  onToggle,
}: {
  node: ChartOfAccountsNodeDTO;
  depth: number;
  expandedNodeIds: Record<string, boolean>;
  onToggle: (nodeId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodeIds[node.id] ?? false;

  return (
    <li
      style={{
        border: '1px solid #ececec',
        borderRadius: 8,
        padding: '0.65rem',
        display: 'grid',
        gap: '0.3rem',
        background: '#fcfcfc',
        marginLeft: `${Math.min(depth, 4) * 0.55}rem`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>{node.name}</strong>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(node.id)}>
            {isExpanded ? 'Recolher' : 'Expandir'}
          </button>
        ) : null}
      </div>

      <span style={{ color: '#4f4f4f' }}>{node.code}</span>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ border: '1px solid #d7d7d7', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem' }}>
          {node.nodeType === 'grouping' ? 'Agrupadora' : 'Final lançável'}
        </span>
        {node.isTechnical ? (
          <span style={{ border: '1px solid #d7d7d7', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem' }}>
            Sistema
          </span>
        ) : null}
        {node.hasLedgerEntries ? (
          <span style={{ border: '1px solid #d7d7d7', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem' }}>
            Em uso ({usageLabel(node.usageCount)})
          </span>
        ) : (
          <span style={{ border: '1px solid #d7d7d7', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem' }}>
            Sem uso
          </span>
        )}
        {node.hasCodeConflict ? (
          <span style={{ border: '1px solid #f2b8b8', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.78rem', color: '#8a2a2a' }}>
            Código duplicado ({node.codeConflictCount})
          </span>
        ) : null}
      </div>

      <span style={{ color: '#666', fontSize: '0.85rem' }}>
        Capacidades: editar {node.capabilities.canEdit ? 'sim' : 'não'} • criar subconta{' '}
        {node.capabilities.canCreateChild ? 'sim' : 'não'} • excluir{' '}
        {node.capabilities.canDelete ? 'sim' : 'não'}
      </span>

      {hasChildren && isExpanded ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.2rem 0 0', display: 'grid', gap: '0.5rem' }}>
          {node.children.map((child) => (
            <ChartNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodeIds={expandedNodeIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
