# FINAPP MVP Shell

Casca navegável do MVP do FINAPP com arquitetura em camadas e persistência temporária em `localStorage`.

## Como executar

1. Instale dependências:
```bash
npm install
```
2. Rode em desenvolvimento:
```bash
npm run dev
```
3. Build de produção:
```bash
npm run build
```

## Fluxo implementado

- Landing page
- Criar conta (auth fake/local)
- Boas-vindas
- Cadastro da pessoa
- Centro de controle
- Contas
- Cartões
- Recorrências
- Projeção
- Planejamento
- Hoje

## Arquitetura em camadas

- `src/domain`: entidades, regras e contratos de repositório (sem React/browser/Supabase)
- `src/application`: casos de uso e DTOs
- `src/infrastructure`: `localStorage`, seed local, repositórios concretos e placeholders Supabase
- `src/presentation`: páginas, componentes, hooks de UI
- `src/composition`: composition root com injeção de dependências

## Ponto de troca localStorage -> Supabase

A troca está centralizada em `src/composition/container.ts`:
- Hoje: `createLocalStorageRepositories()`
- Futuro: `createSupabaseRepositories()` implementando os mesmos contratos de `src/domain/repositories`

## Persistência e seed local

- Chave de storage: `finapp:mvp:v1`
- Seed inicial criado automaticamente em `src/infrastructure/seed/seed.ts`
- Usuário demo: `demo@finapp.local` / `123456`

## Regras já respeitadas

- Compra no cartão (`card_purchase`) não reduz caixa no ato
- Caixa é afetado por pagamento de fatura (`invoice_payment`)
- Compras no cartão impactam categorias, planejamento e projeção
- Gráfico e timeline da projeção usam a mesma base (`ProjectionService.calculate`)
- Campos relacionais permitem selecionar, filtrar e adicionar novo (categorias)

## Extensões futuras previstas

- Auth real via Supabase Auth (substituindo `FakeLocalAuthProvider`)
- Importação real de fatura PDF/OFX no módulo de cartões
