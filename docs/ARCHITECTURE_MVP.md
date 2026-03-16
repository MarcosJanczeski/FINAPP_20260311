# FINAPP — Arquitetura do MVP

# Fonte de Verdade e Alinhamento

Este documento deve permanecer alinhado com:

```text
docs/ESSENCIAL.md
```

Regra de precedência:

* em caso de conflito entre arquitetura, PRD e demais artefatos, prevalece `ESSENCIAL.md`
* conflitos devem ser resolvidos por alinhamento de entendimento e atualização dos documentos antes de consolidar implementação

# Regras de Desenvolvimento

As regras permanentes para agentes de IA durante o desenvolvimento estão em:

```text
docs/AI_RULES.md
```

## Objetivo deste documento

Este documento define a arquitetura do MVP do **FINAPP**, garantindo que o código seja organizado de forma que:

* a lógica de negócio permaneça desacoplada da infraestrutura
* a persistência atual em **localStorage** possa ser substituída por **Supabase** com mínimo retrabalho
* a aplicação seja estruturada de forma escalável desde o início
* a base de código seja compatível com evolução para SaaS multi-usuário

Este documento também serve como **guia para agentes de código (Codex)** durante a implementação.

---

# Princípios Arquiteturais

O FINAPP segue os seguintes princípios:

### 1 — Separação de camadas

O sistema deve separar claramente:

```text
Domínio
Aplicação
Infraestrutura
Interface (UI)
```

Cada camada possui responsabilidades específicas.

---

### 2 — Domínio independente

A camada de domínio:

* não depende de framework
* não depende de React
* não depende de Supabase
* não depende de localStorage

Ela contém apenas:

* entidades
* regras de negócio
* cálculos financeiros
* tipos e contratos

---

### 3 — UI não conhece infraestrutura

Componentes da interface **não podem acessar diretamente**:

```text
localStorage
Supabase
fetch
API externa
```

Toda comunicação deve passar por **repositórios e casos de uso**.

---

### 4 — Persistência intercambiável

A persistência deve ser implementada através de **repositórios com contratos bem definidos**.

Hoje:

```text
LocalStorageRepository
```

No futuro:

```text
SupabaseRepository
```

A troca deve exigir alterações **apenas na camada de infraestrutura**.

---

### 5 — Multi-tenant desde o início

O FINAPP é baseado em **centros de controle**.

Todas as entidades financeiras devem possuir:

```text
controlCenterId
```

Isso permite:

* múltiplos centros por usuário
* compartilhamento de centros
* isolamento de dados

---

### 6 — Fluxo guiado como espinha do MVP

A arquitetura deve suportar o fluxo principal nesta ordem:

```text
landing -> signup -> boas-vindas/pessoa -> centro de controle -> contas/importação ->
cartões/importação+conciliação -> recorrências -> projeção -> planejamento
```

Consequência técnica:

* cada etapa deve ser implementável como módulo independente sem acoplamento circular
* transições entre etapas devem depender de casos de uso (e não de acesso direto à infraestrutura)
* redirecionamento pós-auth deve ser orientado por estado de onboarding:
  * signup -> boas-vindas
  * login com onboarding completo (pessoa + centro) -> dashboard
  * login com onboarding incompleto -> boas-vindas

Status atual de desenvolvimento do tour:

* fluxo navegável já disponível entre `contas -> cartões -> recorrências -> projeção -> planejamento`
* rotas atuais de placeholder do tour: `/credit-cards`, `/recurrences`, `/projection`, `/planning`
* placeholders existem para validar sequência e navegação mobile-first, sem regras de negócio finais nesta etapa

---

# Estrutura de Pastas

A aplicação deve seguir a seguinte estrutura.

```text
src/

  domain/
    entities/
    value-objects/
    rules/
    services/
    repositories/
    types/

  application/
    use-cases/
    dto/
    mappers/

  infrastructure/
    storage/
      local-storage/
        driver.ts
        keys.ts
      supabase/
        client.ts

    repositories/
      local-storage/
      supabase/

  presentation/
    pages/
    components/
    hooks/
    view-models/
    forms/

  shared/
    utils/
    constants/
    errors/

  composition/
    container.ts
```

---

# Camadas da Aplicação

## Domínio

Contém as regras centrais do sistema.

Exemplos:

* cálculo de projeção financeira
* cálculo de margem orçamentária
* diagnóstico financeiro
* consolidação de cartão de crédito
* geração de parcelas

O domínio deve conter:

```text
entities
value objects
regras financeiras
interfaces de repositório
```

Exemplo de entidades:

```text
User
Person
ControlCenter
Account
CreditCard
Commitment
RecurringTemplate
PlanningPeriod
Transaction
```

---

## Aplicação

A camada de aplicação contém **casos de uso**.

Ela orquestra o domínio e os repositórios.

Exemplos:

```text
CreateUser
CreateControlCenter
AddAccount
ImportCreditCardBill
RegisterTransaction
CalculateProjection
UpdatePlanning
```

Casos de uso devem depender apenas de:

```text
interfaces de repositório
entidades do domínio
```

---

## Infraestrutura

Implementa detalhes técnicos.

Inclui:

* persistência
* integrações
* adaptadores

Exemplos:

```text
LocalStorageAccountRepository
LocalStorageCommitmentRepository
SupabaseAccountRepository
SupabaseCommitmentRepository
```

A infraestrutura implementa as interfaces definidas no domínio.

---

## Interface (Presentation)

Responsável pela interface do usuário.

Inclui:

```text
pages
componentes
hooks
formularios
view models
```

A UI não pode acessar persistência diretamente.

Ela deve chamar **casos de uso da camada de aplicação**.

No MVP atual, a presentation inclui página dedicada para razão contábil (`/ledger`) com:

* listagem de `LedgerEntry` com visualização das `lines` (partidas) por lançamento
* detalhamento por linha com conta, débito e crédito, priorizando leitura mobile-first
* filtros básicos por tipo e texto
* ação de lançamento avançado preparada como botão/CTA (sem formulário fixo), abrindo painel sob demanda com fechamento pelo usuário nesta etapa

### Padrão de composição para listagens operacionais (mobile-first)

Telas da camada de presentation que combinam listagem de entidades com ações operacionais devem seguir padrão de composição visual reutilizável.

Estrutura padrão:

a. cabeçalho com contexto da tela e CTA primário de criação
b. lista principal em cards
c. cada card deve conter:
   - identificação principal do item
   - metadados essenciais
   - status visual
   - CTAs contextuais do item
   - em cenários com muitas ações, aplicar progressive disclosure: CTAs prioritários visíveis + menu contextual para ações secundárias/destrutivas
d. blocos técnicos ou complementares (ex.: extrato detalhado, lançamentos relacionados, detalhes contábeis) não devem competir visualmente com a listagem principal e devem aparecer em área separada
e. componentes de card e CTA devem ser reutilizáveis entre módulos para manter consistência

Objetivos do padrão:

* reduzir ruído visual
* melhorar escaneabilidade em telas pequenas
* manter previsibilidade entre módulos

---

# Repositórios

Repositórios definem contratos de acesso a dados.

Exemplo:

```ts
export interface ControlCenterRepository {
  listByUser(userId: string): Promise<ControlCenter[]>
  getById(id: string): Promise<ControlCenter | null>
  save(center: ControlCenter): Promise<void>
  delete(id: string): Promise<void>
}
```

Implementações:

```text
LocalStorageControlCenterRepository
SupabaseControlCenterRepository
```

Contratos mínimos para base contábil do MVP:

```text
AccountRepository
LedgerAccountRepository
LedgerEntryRepository
```

---

# Persistência Atual — localStorage

Durante o MVP, os dados serão persistidos em **localStorage**.

Isso permite:

* desenvolvimento rápido
* testes de fluxo
* validação da experiência do usuário

Mas **localStorage não pode ser acessado diretamente pela UI**.

Deve existir um driver centralizado:

```text
infrastructure/storage/local-storage
```

---

# Adapter de Storage

Exemplo de responsabilidades:

```text
serialização JSON
namespaces de chave
versionamento de dados
```

Exemplo de chave:

```text
finapp.users
finapp.controlCenters
finapp.accounts
finapp.cards
finapp.commitments
finapp.recurring
finapp.planning
```

---

# Composition Root

A aplicação deve possuir um ponto central para composição de dependências.

Arquivo sugerido:

```text
src/composition/container.ts
```

Responsabilidades:

* instanciar repositórios
* conectar casos de uso
* fornecer dependências para a UI

Exemplo:

```ts
const repositories = {
  controlCenterRepository: new LocalStorageControlCenterRepository(),
  accountRepository: new LocalStorageAccountRepository()
}
```

Quando migrar para Supabase:

```ts
const repositories = {
  controlCenterRepository: new SupabaseControlCenterRepository(),
  accountRepository: new SupabaseAccountRepository()
}
```

---

# Modelo Multi-Usuário

O FINAPP permite compartilhamento de centros.

Tabela conceitual:

```text
control_center_users
```

Campos:

```text
userId
controlCenterId
role
```

Papéis possíveis:

```text
owner
manager
contributor
viewer
```

---

# Evolução futura — Fluxo Inter-Center

Para lançamentos entre centros (ex.: negócio -> pessoal), a arquitetura deve suportar:

* criação de vínculo de origem/destino (`crossCenterLinkId` ou equivalente)
* entrada pendente no centro de destino com aceite explícito
* possibilidade de ajuste no destino antes da confirmação
* rejeição com retorno de status/motivo para o centro de origem
* ação posterior no origem: ajustar e reenviar ou cancelar
* trilha de auditoria ponta a ponta entre os dois centros

Observação:

* esta capacidade é evolução futura e não bloqueia o escopo estrutural do MVP atual

---

# Regras Financeiras Fundamentais

Estas regras devem ser respeitadas desde o MVP.

### Regras de proteção do domínio financeiro (mandatórias)

* separar rigorosamente `real events` de `planned events`
* projeção deve consumir `PlanningEvent` e nunca reescrever histórico real
* saldo real muda apenas por transação real; projeção não altera saldo contábil/operacional real
* integridade de cartão: compra aumenta obrigação, pagamento de fatura reduz caixa
* trilha de auditoria obrigatória para eventos gerados (`sourceId`/`sourceEventKey`/referências)
* prevenir dupla contagem por desenho (compra x fatura, parcela x compra cheia, recorrência duplicada)
* ajustes financeiros devem ser aditivos (novos registros), sem sobrescrever histórico de ledger
* quando regra financeira estiver ambígua, interromper implementação e alinhar antes de seguir

### Compra no cartão não reduz saldo disponível

O saldo da conta só muda quando ocorre:

```text
pagamento da fatura
pagamento de conta
saída real da conta
```

---

### Compras do cartão impactam

```text
categorias
planejamento
projeção
```

---

### Projeção usa múltiplas fontes

A projeção financeira deve considerar:

```text
saldo atual
contas a pagar
contas a receber
recorrências
parcelas futuras
margem do orçamento
```

Definições obrigatórias:

```text
comprometido = realizado + previsão
previsão = a pagar/receber + recorrência não confirmada
```

Invariante:

```text
a previsão base não inclui a própria margem orçamentária (evita dupla contagem)
```

Separação arquitetural obrigatória:

* `PlanningEvent` para projeção/planejamento (camada operacional de cenário)
* `LedgerEntry` para escrituração oficial (camada contábil)
* `PlanningEvent` nunca substitui `LedgerEntry`; postagem contábil ocorre por transição controlada
* sincronização de `PlanningEvent` deve ser idempotente por `sourceEventKey`
* cada `PlanningEvent` deve suportar múltiplos vínculos contábeis (`ledgerLinks[]`) para reconhecimento, liquidação e estorno

Estados/transições mínimas de `PlanningEvent`:

* fluxo de negócio principal: `previsto -> confirmado -> realizado`
* confirmação deve gerar reconhecimento contábil auditável
* realização deve gerar baixa/liquidação contábil correspondente
* reversão de liquidação deve ocorrer por estorno compensatório e retornar o evento para estado funcional `confirmado`
* cancelamento permitido em `previsto` e `confirmado`
* reversão de confirmação deve ocorrer por estorno/compensação, sem apagar histórico; se houver liquidação ativa, estornar primeiro a liquidação e depois o reconhecimento
* retorno para previsão e cancelamento de ocorrência no período (skip) devem ser tratados como resultados distintos na camada de aplicação
* cancelamento por skip deve afetar apenas a ocorrência do período; não desativa a recorrência base
* desativação de recorrência deve cancelar apenas previsões `active`; itens já confirmados/realizados devem permanecer preservados no fluxo operacional e contábil
* na reversão de confirmação, o estorno deve usar a mesma data contábil (`date`) do lançamento original; `createdAt` registra a data/hora real da execução e `reversalOf` referencia o lançamento original
* deve haver bloqueios explícitos contra dupla reversão ativa do mesmo reconhecimento ou da mesma liquidação
* `posted` pode existir como detalhe técnico interno, sem substituir estados de negócio

Componentes técnicos mínimos (etapa atual):

* `SyncPlanningEventsUseCase` para consolidar eventos automáticos de projeção
* `GetProjectionAvailabilitySummaryUseCase` para consolidar resumo de saldo projetado de disponibilidades
* confirmação de recorrência já gera `LedgerEntry` de reconhecimento com referência auditável
* providers de origem (recorrência/margem) desacoplados via contrato
* provider real de recorrência mensal ativo; provider de margem permanece em `noop` nesta etapa
* neste MVP, na confirmação de recorrência a UI edita apenas `documentDate` e `dueDate`; `plannedSettlementDate` é preenchida automaticamente com `dueDate` e o ajuste manual dessa data ficará para fluxo futuro
* validações mínimas na confirmação: `documentDate` não pode ser futura e `dueDate` não pode ser anterior a `documentDate`
* sincronização deve ser idempotente por `sourceEventKey`, deduplicando chaves repetidas e saneando duplicatas legadas por cancelamento técnico
* `ledgerLinks[]` deve registrar relações semânticas explícitas (`recognition`, `adjustment`, `settlement`, `settlement_reversal`, `recognition_reversal`), mantendo `reversal` apenas para compatibilidade legada
* resolução de vínculo ativo deve ignorar lançamentos já revertidos (`reversalOf`) ao consolidar estado funcional e contábil do evento
* classificação de evento realizado deve considerar liquidação ativa (liquidação sem estorno correspondente), evitando marcar como `realizado` eventos já estornados
* projeção deve refletir estado funcional final consolidado; histórico contábil revertido não deve gerar presença operacional ativa indevida
* listagem padrão da projeção pode ocultar eventos `canceled` para reduzir ruído operacional, mantendo rastreabilidade em persistência
* conversões de data na projeção devem usar formato estável (`YYYY-MM-DD` + horário neutro) para evitar deslocamento de um dia por fuso horário

---

### Gráfico e timeline devem usar a mesma base

O gráfico mensal e a timeline diária devem refletir exatamente os mesmos dados.

Regra adicional para eventos de margem:

* gerar eventos consolidados na sexta-feira e no último dia do mês
* evitar duplicidade quando ambos caírem na mesma data
* calcular com 2 casas decimais e ajustar resíduo no último lançamento do mês
* quando margem <= 0, não gerar evento de margem e emitir sinalização para o planejamento

---

### Conciliação de fatura é obrigatória

Na importação de cartão:

```text
soma dos lançamentos importados = valor total da fatura
```

Essa validação deve existir em caso de uso/regra de domínio, nunca apenas na UI.

---

### Recorrência confirmada muda de natureza

Estados obrigatórios:

```text
recorrência não confirmada = previsão
recorrência confirmada = compromisso
```

A projeção deve considerar ambos, respeitando seu estado.

---

### Abertura de conta deve gerar lançamento contábil

Invariantes:

* `Account` deve possuir vínculo com conta contábil (`ledgerAccountId`)
* saldo inicial não pode existir apenas na camada operacional
* ao criar conta com saldo inicial, gerar `LedgerEntry` de abertura em partidas dobradas
* contrapartida padrão por centro de controle: `PL:SALDOS_INICIAIS`

Regras por natureza:

* ativo: débito na conta vinculada e crédito em `PL:SALDOS_INICIAIS`
* passivo: débito em `PL:SALDOS_INICIAIS` e crédito na conta vinculada

Regra de edição segura:

* campos cadastrais da conta podem ser alterados sem evento contábil
* campos contábeis da conta não podem sobrescrever histórico
* ajuste contábil deve gerar novos `LedgerEntry`:
  * `account_opening_reversal`
  * `account_opening_adjustment`
* ajuste contábil deve ocorrer automaticamente ao salvar novo saldo inicial
* motivo é opcional na UX e deve ser persistido quando informado
* auditoria mínima por lançamento: `referenceId`, `createdByUserId`, `reason`
* exclusão física de conta só pode ocorrer sem `LedgerEntry` vinculado (`referenceId`)
* com lançamento vinculado, o domínio deve bloquear exclusão e orientar ajuste/encerramento
* `Account` deve suportar estado (`active`/`closed`) e data de encerramento (`closedAt`)
* conta encerrada não aceita novos ajustes operacionais
* encerramento não remove histórico operacional/contábil da conta

---

### Plano de contas básico evolutivo

Cada centro de controle deve ter, no mínimo, as raízes:

```text
ATIVO
PASSIVO
PATRIMONIO_LIQUIDO
RECEITAS
DESPESAS
```

Regras:

* raízes são contas de sistema e não editáveis
* subcategorias são editáveis e podem evoluir ao longo do desenvolvimento
* contas técnicas de sistema (ex.: `PL:SALDOS_INICIAIS`) não são editáveis

---

### Cadastro contextual obrigatório

Ao informar dados relacionais (categorias, contas, pessoas), a interface deve permitir:

```text
selecionar
filtrar
adicionar
```

Implementação deve ocorrer por casos de uso e repositórios, sem bypass da camada de aplicação.

Comportamento mínimo do componente de campo relacional:

1. botão para listar valores existentes
2. filtro em tempo de digitação com ocorrências compatíveis
3. botão "+" para abrir fluxo de criação contextual do novo valor

---

### Padrão de campos monetários

Componentes de entrada monetária devem padronizar:

1. alinhamento do valor à direita
2. máscara monetária com entrada contínua sem necessidade de vírgula manual

Esse padrão deve ser centralizado em componente reutilizável de `presentation/forms`.

---

# Seed de Dados

O sistema deve permitir seed local para testes.

Exemplo:

```text
contas
cartões
recorrências
categorias
compromissos
```

Isso facilita testes de:

```text
projeção
planejamento
diagnóstico
```

---

# Migração futura para Supabase

Quando migrar para Supabase:

* substituir implementações de repositório
* manter domínio e aplicação intactos
* manter UI intacta

Infraestrutura nova incluirá:

```text
Supabase Auth
PostgreSQL
Row Level Security
Storage
```

---

# Critérios de Aceite da Arquitetura

A arquitetura será considerada correta quando:

* UI não acessa localStorage
* domínio não depende de framework
* persistência é feita via repositórios
* troca para Supabase exige mudança apenas na infraestrutura
* entidades possuem controlCenterId
* casos de uso orquestram a lógica

---

# Próximos Documentos do Projeto

Após este documento, os próximos artefatos são:

```text
ESSENCIAL.md
FINAPP_PRD.md
FINAPP_DATABASE_SCHEMA.md
FINAPP_FINANCIAL_ENGINE.md
FINAPP_PROJECTION_ENGINE.md
```
