# FINAPP — Arquitetura do MVP

# Fonte de Verdade e Alinhamento

Este documento deve permanecer alinhado com:

```text
docs/ESSENCIAL.md
```

Regra de precedência:

* em caso de conflito entre arquitetura, PRD e demais artefatos, prevalece `ESSENCIAL.md`
* conflitos devem ser resolvidos por alinhamento de entendimento e atualização dos documentos antes de consolidar implementação

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
