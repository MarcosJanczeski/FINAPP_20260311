# FINAPP — Product Requirements Document (PRD)

# Fonte de Verdade e Governança

Documento norte:

```text
docs/ESSENCIAL.md
```

Diretriz de alinhamento:

* em caso de conflito entre este PRD e outros documentos, prevalece `ESSENCIAL.md`
* ao identificar conflito, primeiro alinhar entendimento e depois atualizar documentação e implementação

# 1. Visão Geral do Produto

FINAPP é uma plataforma online de gestão financeira voltada para:

* indivíduos
* famílias
* pequenos negócios
* consultores financeiros

O sistema permite:

* organizar receitas e despesas
* acompanhar compromissos financeiros
* controlar cartões de crédito
* planejar orçamentos
* visualizar projeções de caixa
* diagnosticar a saúde financeira

O FINAPP foi projetado para funcionar como um **SaaS multi-usuário baseado em centros de controle financeiros**.

Cada centro de controle representa uma entidade financeira independente e pode ser compartilhado com outros usuários.

---

# 2. Princípios do Sistema

O FINAPP segue os seguintes princípios de design.

### 1 Simplicidade de uso

Registro financeiro rápido e intuitivo.

### 2 Separação clara entre intenção e realidade

O sistema distingue claramente:

```
planejamento
compromissos
transações realizadas
projeções
```

### 3 Diagnóstico financeiro automático

O sistema interpreta os dados financeiros e fornece diagnóstico da situação do usuário.

### 4 Projeção de caixa

O usuário pode visualizar como seu saldo evoluirá ao longo do tempo.

### 5 Arquitetura escalável

Preparado para múltiplos usuários e monetização futura.

---

# 3. Modelo de Acesso

O FINAPP é um sistema **multi-tenant baseado em centros de controle**.

---

# Usuário

Representa a conta de acesso.

Campos principais:

```
email
senha
```

---

# Pessoa

Representa a entidade associada ao usuário.

Pode ser:

```
Pessoa Física
Pessoa Jurídica
```

---

# Counterparty

Representa a entidade financeira operacional externa ao centro de controle, usada como sacado/favorecido nos fluxos financeiros.

Separação obrigatória:

```text
User = conta de acesso
Person = identidade do usuário / onboarding
Counterparty = entidade financeira operacional
```

Diretriz de uso no MVP:

* `Counterparty` é entidade transversal para evoluções de `commitments`, recorrências, `credit-cards` e referências operacionais no razão
* integração por API externa (ex.: enriquecimento cadastral) fica como evolução futura opcional
* todo `Commitment` deve possuir `counterpartyId` obrigatório no momento da criação

Diretriz de entrada operacional (módulo compromissos):

* a entrada primária do usuário deve representar a transação comercial/financeira de origem (`BusinessTransaction`)
* ao confirmar a transação: reconhecer contabilmente e gerar `Commitment(s)` derivados quando houver obrigação/direito em aberto
* operação à vista pode gerar zero commitments
* parcelamento gera múltiplos commitments irmãos vinculados ao mesmo fato gerador
* recorrência permanece fluxo distinto
* rastreabilidade mínima obrigatória: vínculo explícito entre `BusinessTransaction`, `LedgerEntry` de reconhecimento e `Commitment(s)` gerados
* em cartão de crédito, compra individual gera reconhecimento e compõe fatura futura; o commitment aberto relevante para caixa deve ficar no nível da fatura, não da compra individual
* fatura inicialmente calculada é previsão operacional; após conferência/importação, a fatura conciliada passa a representar a realidade financeira final

---

# Centro de Controle

É a unidade financeira do sistema.

Exemplos:

```
Finanças pessoais
Família Silva
Empresa XPTO
Projeto Reforma
```

Cada centro possui seus próprios:

```
contas
cartões
compromissos
recorrências
planejamento
projeção
resultados
metas
```

---

# Compartilhamento de Centros

Um centro de controle pode ter vários usuários.

Papéis disponíveis:

```
owner
manager
contributor
viewer
```

### owner

* controla tudo
* pode convidar usuários
* pode excluir centro

### manager

* pode gerenciar dados financeiros
* pode editar planejamento

### contributor

* pode registrar receitas e despesas

### viewer

* apenas visualização

---

# Evolução futura — Lançamentos Inter-Center

Para cenários como "centro do negócio paga pessoa do centro pessoal":

* o centro de origem cria lançamento com vínculo inter-center
* o centro de destino recebe pendência para aceite
* o destino pode ajustar classificação/detalhes permitidos antes do aceite
* em rejeição, o centro de origem deve ser sinalizado com status e motivo
* o centro de origem pode ajustar e reenviar ou cancelar
* origem e destino permanecem ligados por identificador único para auditoria

---

# Convite de Usuários

Fluxo:

```
Owner adiciona usuário
↓
define papel
↓
envia convite por email
```

Se o usuário ainda não existir:

```
convite fica pendente
```

---

# 4. Onboarding do Usuário

O onboarding foi projetado para gerar **diagnóstico financeiro rápido**.

Fluxo:

```
Landing Page
↓
Criar conta
↓
Cadastro da pessoa
↓
Criação do centro de controle
↓
Cadastro de contas
↓
Importação de extratos
↓
Cadastro de cartões
↓
Importação de fatura
↓
Revisão de compras
↓
Cadastro de recorrências
↓
Visualização da projeção
↓
Configuração do planejamento
```

Regras operacionais do onboarding:

* cadastro inicial com fricção mínima
* após autenticação, completar dados de pessoa (PF/PJ)
* centro de controle pessoal vinculado à pessoa no cadastro
* formulário inicial do centro de controle deve permitir alterar nome
* após signup, direcionar para boas-vindas para completar cadastro inicial
* após login recorrente:
  * se pessoa + centro de controle estiverem completos, direcionar para dashboard
  * se estiver incompleto, direcionar para boas-vindas

Status atual de implementação (MVP em desenvolvimento):

* sequência do tour já navegável com placeholders mínimos em:
  * `contas -> cartões -> recorrências -> projeção -> planejamento`
* rotas de placeholder atuais:
  * `/credit-cards`
  * `/recurrences`
  * `/projection`
  * `/planning`
* objetivo atual: validar jornada e transições antes da implementação funcional completa de cada módulo

### Padrão de Telas Operacionais (mobile-first)

Telas operacionais com listagem de itens e ações contextuais devem seguir padrão visual e funcional consistente, com prioridade para uso em telas pequenas.
Este padrão é consolidado pelo conceito de **Operational Card**.

Estrutura obrigatória:

1. bloco superior com contexto da tela e CTA primário de criação/adicionar item
2. listagem principal em cards
3. cada card deve exibir somente informações essenciais para decisão rápida
4. ações do item devem aparecer como CTAs contextuais no próprio card
5. evitar poluição visual com excesso de botões e blocos técnicos misturados à listagem principal
6. informações técnicas ou secundárias devem ficar em área separada, expansível ou em tela/bloco próprio
7. todo Operational Card deve permitir compreender rapidamente:
   - o que é
   - quanto vale (quando aplicável)
   - quando acontece
   - em que estado está
   - qual a próxima ação natural
8. anatomia conceitual do Operational Card:
   - identificação principal do item
   - valor ou indicador principal, quando aplicável
   - metadados essenciais
   - estado
   - ações principais
   - área secundária/expansível para detalhes operacionais
9. regra de densidade de ações:
   - até 2 CTAs visíveis quando isso melhorar ação rápida sem poluição visual
   - ações secundárias/destrutivas devem ir para menu contextual `⋮`
   - quando houver alta densidade de ações, uso do menu contextual é obrigatório
10. menu contextual por item deve seguir comportamento padrão:
   - abrir por clique no controle de ações
   - fechar ao clicar fora
   - fechar com `Esc`
   - ao abrir outro menu, o anterior deve fechar
   - clicar em ação fecha o menu
11. regra de expansão:
   - cards iniciam colapsados por padrão
   - expansão é opcional
   - expansão deve trazer apenas detalhes secundários operacionais
   - detalhes técnicos/contábeis extensos devem ficar em bloco ou tela própria
12. consistência transversal obrigatória:
   - o padrão de Operational Card deve ser aplicado em:
     - contas
     - cartões
     - recorrências
     - compromissos
     - projeção

Diretriz de referência:

* a tela de projeção serve como referência inicial de clareza visual, sem impedir evolução posterior do padrão

Aplicação inicial no MVP:

* contas
* recorrências
* cartões
* compromissos

---

# 5. Criação de Conta

Campos obrigatórios:

```
email
senha
confirmar senha
```

Após cadastro:

```
usuário autenticado
```

---

# 6. Cadastro da Pessoa

Campos mínimos:

```
nome
tipo de pessoa
telefone (opcional)
```

Após salvar:

```
criação automática de um centro de controle
```

---

# 7. Configuração do Centro de Controle

Campos:

```
nome
moeda
```

Configurações futuras possíveis:

```
número de meses da projeção
saldo mínimo
preferências
```

---

# 8. Cadastro de Contas

Usuário registra onde possui dinheiro.

Campos:

```
nome da conta
tipo
natureza (ativo/passivo)
conta contábil vinculada
saldo inicial
status (active/closed)
closedAt
```

Tipos:

```
caixa
conta corrente
conta digital
investimento
```

Regra de integração contábil:

* cada conta operacional deve referenciar uma conta do plano contábil
* ao criar conta com saldo inicial, gerar lançamento de abertura em partidas dobradas
* contrapartida padrão: `PL:SALDOS_INICIAIS`
* ativo: débito na conta vinculada e crédito em `PL:SALDOS_INICIAIS`
* passivo: débito em `PL:SALDOS_INICIAIS` e crédito na conta vinculada

Regra de edição:

* edição cadastral (`nome`, `tipo`) não gera lançamento contábil
* para ajuste de saldo inicial, a UI deve permitir entrada direta do novo valor
* ajuste contábil preserva histórico: gera lançamento de reversão e novo lançamento de ajuste
* ajuste contábil é automático na gravação; motivo é opcional e recomendável
* lançamentos devem manter rastreio pela referência da conta editada
* exclusão física só é permitida quando a conta não possui lançamentos contábeis vinculados
* conta com lançamentos vinculados deve seguir fluxo de ajuste ou encerramento
* conta encerrada não permite novos ajustes operacionais de saldo inicial
* conta encerrada permanece visível para histórico

---

# Importação de Extrato

Formatos suportados:

```
PDF
CSV
OFX
```

Os lançamentos importados são registrados inicialmente em uma conta transitória:

```
Reclassificar — dados importados
```

Isso permite classificação posterior.

---

# 9. Cadastro de Cartões de Crédito

Campos:

```
nome do cartão
limite
dia de fechamento
dia de vencimento
```

---

# Importação de Fatura

O sistema extrai:

```
data da compra
descrição
valor
```

Os lançamentos são apresentados para revisão.

Semântica operacional:

* a fatura inicial exibida pelo sistema pode ser uma previsão baseada nas compras registradas
* importação/conferência permite validar e ajustar itens e valores
* a fatura conciliada representa o valor final operacional para liquidação

Critério obrigatório de conciliação:

```text
total dos lançamentos deve ser igual ao valor total da fatura
```

---

# Revisão das Compras

Cada compra pode ser marcada como:

```
compra única
parcelada
recorrente
```

---

# Parcelamentos

Quando parcelada:

```
usuário informa número de parcelas
```

O sistema gera automaticamente:

```
parcelas futuras
```

---

# Recorrências

Quando marcada como recorrente:

```
cria modelo de recorrência
```

Regra de estado:

```text
recorrência não confirmada = previsão
recorrência confirmada = compromisso
```

---

# 10. Cadastro de Recorrências

Eventos financeiros recorrentes.

Exemplos:

```
salário
aluguel
internet
assinaturas
```

Campos:

```
descrição
valor estimado
categoria
frequência
data inicial
```

Status de implementação (MVP atual):

* periodicidade inicial suportada: `monthly`
* ao salvar/editar recorrência mensal ativa, a projeção gera eventos para mês atual + 3 meses
* na projeção, `previsto_recorrencia` pode ser confirmado com ajuste de data/valor e passa para `confirmado_agendado` (`confirmed`) com reconhecimento contábil auditável
* a projeção já exibe resumo de saldo de disponibilidades: saldo base atual, entradas projetadas, saídas projetadas e saldo projetado final (janela mês atual + 3 meses)

---

# 11. Tela de Projeção

Primeira entrega de valor do sistema.

Mostra a evolução do saldo financeiro.

---

# Gráfico superior

Exibe:

```
mês atual
+2 ou +3 meses futuros
```

Cada mês apresenta:

```
saldo inicial
menor saldo
saldo final
```

---

# Cálculo da Projeção

Considera:

```
saldo atual
contas a pagar
contas a receber
recorrências
parcelas futuras
orçamento disponível
```

Definições para cálculo:

```text
comprometido = realizado + previsão
previsão = a pagar/receber + recorrência não confirmada
```

Regra:

```text
previsão não inclui a própria margem orçamentária
```

---

# Timeline Financeira

Lista cronológica de eventos.

Estrutura:

```
Data
Eventos
Saldo do dia
```

Divisão:

```
eventos realizados (D-7)
eventos projetados
```

Detalhes obrigatórios da timeline:

* incluir rateio semanal da dotação orçamentária
* listar na sexta-feira e no último dia do mês
* não duplicar evento quando sexta-feira coincidir com o último dia do mês
* valores com 2 casas decimais e ajuste residual no último lançamento do mês

---

# 12. Planejamento Financeiro

Após o primeiro acesso, o usuário é convidado a configurar o planejamento.

---

# Configurações

Campos principais:

```
saldo mínimo de alerta
meta de superávit
```

---

# Orçamento por Categoria

Tabela:

```
Categoria
Orçamento
Realizado + Comprometido
Margem
```

Visualização inicial do comprometido:

```text
Realizado + Compromissos + Previsões
```

Comportamento:

* exibir inicialmente agrupado como "comprometido"
* permitir expansão para detalhamento

---

# Cálculo da Margem

```
Margem = Orçamento − Comprometido
```

Comportamento de projeção da margem:

* rateio diário pelos dias restantes do mês, incluindo hoje
* consolidação dos valores na timeline por semana (sexta-feira) e no fechamento do mês
* se a margem for negativa, considerar margem igual a zero para rateio
* margem negativa deve gerar alerta para usuários com acesso ao planejamento

---

# Diagnóstico do Planejamento

Classificações possíveis:

```
Planejamento equilibrado
Planejamento apertado
Planejamento inviável
```

O sistema pode sugerir ajustes.

---

# 13. Registro Rápido

Eventos financeiros podem ser registrados rapidamente.

Tipos:

```
Entrou dinheiro
Saiu dinheiro
Transferência
Compra no cartão
Pagar conta
Receber valor
```

---

# 14. Compromissos

Controle de:

```
contas a pagar
contas a receber
```

Filtros:

```
todos
abertos
vencidos
liquidados
```

---

# 15. Controle de Cartão

Permite acompanhar:

```
limite
limite disponível
valor da fatura
data de vencimento
```

Compras exibem:

```
valor
estabelecimento
parcela
```

---

# Regra Fundamental do Cartão

Compras individuais impactam:

```
categorias
planejamento
projeção
```

Mas o fluxo de caixa considera apenas:

```
pagamento da fatura
```

Regra complementar:

* fatura calculada por fechamento/vencimento não é verdade definitiva por si só
* a verdade final para liquidação de caixa é a fatura conciliada

---

# 16. Resultados Financeiros

Usuário pode analisar resultados por período.

Campos:

```
mês inicial
mês final
```

Resultado calculado como:

```
Resultado = Receitas − Despesas
```

---

# 17. Arquitetura Financeira

O sistema possui três camadas.

Regras mandatórias de proteção financeira (transversais ao produto):

* separar eventos reais de eventos planejados; planejamento/projeção não altera histórico real
* projeção não pode alterar saldo real de disponibilidades
* compras no cartão geram obrigação futura e não reduzem caixa no ato da compra
* pagamento de fatura deve ser o evento que impacta caixa/banco
* totais de fatura devem ser iguais à soma dos itens importados/classificados
* compras/parcela de cartão são itens de composição da fatura e não compromissos de caixa isolados
* eventos gerados (parcelas, recorrências, previsões) devem manter rastreabilidade de origem
* evitar dupla contagem em todos os fluxos financeiros
* ajustes devem criar novos registros; não reescrever histórico contábil silenciosamente
* inconsistências financeiras devem bloquear avanço até esclarecimento explícito da regra

---

## Planejamento

Intenção financeira do usuário.

Inclui:

```
orçamento
metas
reserva mínima
superávit
```

---

## Operação Financeira

Representa a realidade.

Inclui:

```
compromissos
recorrências
transações
```

Modelo de separação obrigatório para evolução:

* `PlanningEvent` (camada de projeção/planejamento): eventos candidatos a lançamento e eventos de apoio ao cenário
* `LedgerEntry` (camada contábil oficial): apenas lançamentos confirmados/postados em partidas dobradas

Regra de ouro:

* balanço, DRE e relatórios contábeis oficiais usam somente `LedgerEntry`
* projeção e planejamento usam `PlanningEvent` + fatos realizados

Estados e tipos mínimos em `PlanningEvent`:

* tipos: `realizado`, `confirmado_agendado`, `previsto_recorrencia`, `previsto_margem`
* estado de negócio principal: `previsto`, `confirmado`, `realizado`
* status técnico atual suportado: `active`, `confirmed`, `canceled`, `posted` (quando existir, não deve ser tratado como etapa funcional principal do fluxo de recorrência)
* campos mínimos de origem: `sourceType`, `sourceId`, `sourceEventKey`
* `sourceEventKey` deve garantir idempotência de sincronização (reprocessar sem duplicar evento)
* vínculo de auditoria com contabilidade: `ledgerLinks[]` para suportar múltiplos lançamentos relacionados (`recognition`, `settlement`, `settlement_reversal`, `recognition_reversal`; `reversal` permanece apenas para compatibilidade legada)

Transições mínimas:

* `previsto` -> `confirmado_agendado` (reconhecimento contábil)
* `confirmado_agendado` -> `realizado` (liquidação contábil em etapa posterior)
* `realizado` -> `confirmado_agendado` por estorno de liquidação (`settlement_reversal`), quando o compromisso permanece existente
* `previsto` -> `cancelado`
* `confirmado_agendado` -> `previsto` por estorno de reconhecimento; se houver liquidação ativa, estornar primeiro a liquidação e depois o reconhecimento
* `confirmado_agendado`/`realizado` -> `cancelado` (skip do período) por estorno/compensação, sem apagar histórico
* o skip (`cancelado`) afeta somente a ocorrência do período corrente; a recorrência base permanece ativa para períodos futuros
* ao desativar uma recorrência, somente previsões `active` vinculadas podem ser canceladas; eventos já confirmados/realizados permanecem como compromisso/histórico e não devem ser reabertos automaticamente
* na reversão de confirmação, o estorno deve usar a mesma data contábil (`date`) do lançamento original; `createdAt` registra a data/hora real da execução e `reversalOf` referencia o lançamento original
* toda reversão deve ser aditiva e auditável: nenhum `LedgerEntry` anterior pode ser apagado ou sobrescrito
* deve haver bloqueio de dupla reversão ativa para o mesmo reconhecimento ou para a mesma liquidação

Status técnico atual da projeção (MVP):

* `/projection` já lê `PlanningEvent` e permite disparar sincronização manual
* geração automática real por recorrência mensal já está ativa
* geração por margem orçamentária permanece em stub (provider `noop`) nesta etapa
* semântica temporal operacional em `PlanningEvent`:
  * `dueDate`: vencimento contratual
  * `plannedSettlementDate`: previsão operacional de pagamento/liquidação
  * `settlementDate`: data real da liquidação
* ao liquidar, `plannedSettlementDate` deve ser preservada e `settlementDate` deve registrar a data real
* projeção de disponibilidades deve usar data de fluxo de caixa:
  * `cashFlowDate = settlementDate ?? plannedSettlementDate`
* ordenação da timeline, agregações (entradas/saídas), saldo diário, menor saldo e saldo final projetado devem seguir `cashFlowDate`
* comunicação temporal no card da projeção deve distinguir claramente:
  * eventos `realizado`: data real de liquidação
  * eventos `previsto`/`confirmado`: data prevista de pagamento/liquidação
* cálculo de resumo de disponibilidades é executado na camada de aplicação e não altera saldo real persistido
* neste MVP, na confirmação de recorrência a UI edita apenas `documentDate` e `dueDate`; `plannedSettlementDate` é preenchida automaticamente com `dueDate` e o ajuste manual dessa data ficará para fluxo futuro
* validações mínimas na confirmação: `documentDate` não pode ser futura e `dueDate` não pode ser anterior a `documentDate`
* a listagem padrão da projeção exibe eventos operacionais não cancelados, preservando `canceled` fora da lista principal por padrão
* a projeção deve oferecer visualização secundária de cancelados (ex.: filtro de estado), com rotulagem explícita de cancelamento no período
* quando elegível, a projeção deve permitir `Reverter cancelamento`, retornando a ocorrência cancelada para estado operacional `previsto`
* `Reverter cancelamento` restaura apenas o estado operacional para `previsto`; não reativa automaticamente `confirmado`/`realizado` e não apaga/sobrescreve histórico contábil
* a projeção operacional deve ignorar vínculos contábeis já revertidos e considerar apenas estado funcional consolidado do evento
* a resolução de estado funcional/capacidades operacionais deve ser canônica na camada de aplicação, evitando deduções paralelas na UI por `type/status` técnico
* para eventos `confirmado`, a projeção deve permitir ação operacional de `Adiar pagamento`, atualizando apenas `plannedSettlementDate` (sem novo `LedgerEntry`)
* conferência operacional para eventos `realizado`:
  * campos: `isVerified`, `verifiedAt`, `verifiedByUserId`
  * `Conferido` é marcador operacional (não cria lançamento contábil)
  * evento conferido deve bloquear, no fluxo operacional padrão, o estorno de liquidação
  * evento conferido deve bloquear, no fluxo operacional padrão, o cancelamento operacional da ocorrência
  * conferência pode ser desfeita operacionalmente (`isVerified = false`) quando necessário
* padrão visual operacional atualmente adotado na `/projection`:
  * múltiplas ações do card agrupadas em menu contextual sobreposto (`⋮`)
  * o menu é controle do card (não conteúdo que altera altura da listagem)
  * o estado de conferência deve possuir indicador visual claro e de leitura rápida no card

---

## Contabilidade (Ledger)

Estrutura contábil baseada em partidas dobradas.

Regra:

```
Total de débitos = total de créditos
```

Tela de lançamentos contábeis:

* rota dedicada para consulta técnica do razão
* cabeçalho mínimo por lançamento: data, descrição, tipo, referência e valor do lançamento
* detalhamento obrigatório das partidas: conta contábil (`código - nome`), débito e crédito em cada linha do lançamento
* filtros mínimos: tipo de lançamento e texto (descrição/referência)
* ordenação padrão do razão: ordem de registro do lançamento (`createdAt`, mais recente primeiro), com opção de ordenação por data do fato/evento (`date`)
* ação de "novo lançamento avançado" por botão na tela (não formulário fixo), abrindo painel sob demanda com fechamento pelo usuário nesta etapa

Plano de contas básico por centro de controle:

```text
ATIVO
PASSIVO
PATRIMONIO_LIQUIDO
RECEITAS
DESPESAS
```

Regras:

* contas raiz são de sistema e não editáveis
* subcategorias podem ser criadas e editadas conforme evolução
* conta técnica `PL:SALDOS_INICIAIS` é de sistema e não editável

---

# 18. Entidades Principais

```
users
people

control_centers
control_center_users

accounts
credit_cards

categories
counterparties

imports
import_rows

commitments
recurring_templates

transactions
entries

planning_periods
planning_items
```

---

# 19. Fluxo Principal de Uso

Uso cotidiano do sistema:

```
Registrar eventos financeiros
↓
Gerenciar compromissos
↓
Acompanhar projeção
↓
Ajustar planejamento
↓
Analisar resultados
```

---

# Cadastro Contextual

Em qualquer ponto do fluxo que exigir dados relacionais, a UI deve oferecer:

```text
selecionar
filtrar
adicionar
```

Comportamento esperado do campo relacional:

1. botão para listar valores já cadastrados
2. ao digitar, exibir ocorrências compatíveis imediatamente
3. botão "+" para abrir formulário de cadastro do novo valor no contexto do próprio campo

Escopo mínimo:

```text
categorias
contas
counterparties (sacados/favorecidos)
```

---

# Padrão de Campos Monetários

Campos monetários devem seguir padrão único na interface:

1. alinhamento do conteúdo à direita
2. máscara monetária com digitação contínua, sem exigir vírgula manual

---

# 20. Monetização futura

O modelo multi-usuário permite criação de planos.

Exemplos:

### Plano gratuito

```
1 centro de controle
1 usuário
```

### Plano família

```
3 centros
até 5 usuários
```

### Plano profissional

```
centros ilimitados
usuários ilimitados
```

---

# 21. Próximos Documentos do Projeto

Após este PRD, os documentos recomendados são:

```
modelo de dados do sistema
arquitetura do backend
arquitetura do frontend
regras de projeção financeira
motor de diagnóstico financeiro
```

---
