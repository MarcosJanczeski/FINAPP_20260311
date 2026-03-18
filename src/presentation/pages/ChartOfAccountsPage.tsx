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

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            marginTop: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {roots.map((rootNode) => {
            const rootCode = rootNode.code as ChartOfAccountsRootCode;
            const isExpanded = expandedNodeIds[rootNode.id] ?? true;
            return (
              <li key={rootNode.id} style={{ borderBottom: '1px solid #eceff2' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'start',
                    gap: '0.5rem',
                    padding: '0.65rem 0.7rem',
                    background: '#f8fafc',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleNode(rootNode.id)}
                    style={{ minWidth: 28, height: 28 }}
                    aria-label={isExpanded ? 'Recolher raiz' : 'Expandir raiz'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>

                  <div style={{ display: 'grid', gap: '0.2rem' }}>
                    <strong style={{ lineHeight: 1.2 }}>{ROOT_LABELS[rootCode] ?? rootNode.name}</strong>
                    <span style={{ color: '#4f4f4f', fontSize: '0.88rem' }}>{rootNode.code}</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <Badge label="Agrupadora" />
                      <Badge label="Sistema" />
                    </div>
                  </div>
                  <div style={{ width: 28, height: 28 }} aria-hidden="true" />
                </div>

                {isExpanded ? (
                  rootNode.children.length === 0 ? (
                    <p style={{ color: '#666', margin: 0, padding: '0.5rem 0.85rem 0.8rem' }}>
                      Nenhuma subconta cadastrada nesta raiz.
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        border: '1px solid #d7dce3',
        borderRadius: 999,
        padding: '0.08rem 0.42rem',
        fontSize: '0.75rem',
        color: '#4b5563',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
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
        borderTop: '1px solid #eff2f5',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: '0.5rem',
          alignItems: 'start',
          padding: '0.52rem 0.7rem',
          paddingLeft: `${0.7 + Math.min(depth, 6) * 0.72}rem`,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            style={{ minWidth: 26, height: 26 }}
            aria-label={isExpanded ? `Recolher ${node.code}` : `Expandir ${node.code}`}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 26, height: 26, display: 'inline-block' }} aria-hidden="true" />
        )}

        <div style={{ display: 'grid', gap: '0.18rem' }}>
          <span style={{ color: '#374151', fontSize: '0.86rem' }}>{node.code}</span>
          <strong style={{ fontSize: '0.93rem', lineHeight: 1.2 }}>{node.name}</strong>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {node.nodeType === 'grouping' ? <Badge label="Agrupadora" /> : null}
            {node.isTechnical ? <Badge label="Sistema" /> : null}
            {node.hasLedgerEntries ? <Badge label="Em uso" /> : null}
            {node.hasCodeConflict ? <Badge label="Duplicado" /> : null}
          </div>
        </div>

        <div style={{ width: 26, height: 26 }} aria-hidden="true" />
      </div>

      {hasChildren && isExpanded ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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
