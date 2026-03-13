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

---

## Contabilidade (Ledger)

Estrutura contábil baseada em partidas dobradas.

Regra:

```
Total de débitos = total de créditos
```

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
pessoas (sacados/favorecidos)
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
