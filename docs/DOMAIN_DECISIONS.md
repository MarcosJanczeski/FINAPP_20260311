# FINAPP — Domain Decisions

Este documento consolida decisões estruturais do domínio financeiro do FINAPP.

Seu objetivo é:

* garantir consistência entre módulos
* evitar retrabalho e divergência entre sessões de desenvolvimento
* servir como fonte de verdade para ChatGPT, Codex e evolução do sistema

---

# Fonte de Verdade e Precedência

Referências obrigatórias:

* `docs/ESSENCIAL.md` (precedência máxima)
* `docs/FINAPP_PRD.md`
* `docs/ARCHITECTURE_MVP.md`
* `docs/AI_RULES.md`

Regra:

* em caso de conflito, prevalece `ESSENCIAL.md`; divergências devem ser alinhadas e documentadas antes de consolidar implementação

---

# 1. Princípio Central

O FINAPP opera com o princípio:

"competência por baixo, simplicidade por cima"

* O sistema é contábil-consistente (regime de competência)
* A interface do usuário é orientada a fluxo de caixa e simplicidade

---

# 2. Modelo de Realidade Financeira

O sistema separa três camadas:

## 2.1 Econômico (competência)

* reconhecimento de receitas e despesas
* formação de ativos e passivos
* base da DRE e parte do balanço

## 2.2 Financeiro (caixa)

* entradas e saídas de dinheiro
* saldo de contas
* extrato

## 2.3 Planejamento (projeção)

* `PlanningEvent` é entidade operacional de projeção/planejamento
* pode operar em `previsto`, `confirmado`, `realizado` e `cancelado` (skip por período)

---

# 3. Estados dos Eventos

Todo evento financeiro segue:

Fluxo principal:

previsto → confirmado → realizado

Fluxos adicionais:

* estorno de liquidação: realizado → confirmado
* reversão de confirmação: confirmado → previsto
* cancelamento de ocorrência (skip por período): previsto/confirmado/realizado → cancelado

## 3.1 previsto

* não reconhecido economicamente
* não impacta DRE nem balanço
* usado para planejamento

Exemplos:

* recorrência não confirmada
* orçamento
* metas

---

## 3.2 confirmado

* reconhecido economicamente
* impacta DRE
* pode gerar ativo ou passivo

Exemplos:

* conta a pagar criada
* conta a receber criada
* compra no cartão
* recorrência confirmada

---

## 3.3 realizado

* liquidado financeiramente
* impacta caixa

Exemplos:

* pagamento
* recebimento
* transferência

---

# 4. Definição de Commitment

## 4.1 Conceito

Commitment representa:

obrigações e direitos em aberto (contas a pagar/receber)

## 4.2 Regras

* coincide com contas do balanço:

  * contas a pagar
  * contas a receber
* todo commitment deve possuir `counterpartyId` obrigatório (contrapartida associada)
* nasce sempre como confirmado
* impacta DRE no momento da criação
* deixa de existir como aberto após liquidação

## 4.3 Interpretação

commitment = evento confirmado não realizado

---

# 5. Portas de Entrada do Sistema

O sistema possui 4 entradas canônicas:

## 5.1 À vista

* gera evento confirmado + realizado simultaneamente

## 5.2 A prazo

* gera commitment (confirmado)
* liquidação ocorre depois

## 5.3 Cartão de crédito

* gera obrigação (confirmado)
* não afeta caixa no ato
* liquidação ocorre no pagamento da fatura

## 5.4 Transferência

* não é receita nem despesa
* apenas movimentação entre contas

---

# 6. Regras de Liquidação

## 6.1 Princípios

* o histórico contábil é aditivo
* nunca apagar/sobrescrever lançamentos anteriores
* rastreabilidade operacional e contábil via `ledgerLinks[]`
* o `PlanningEvent` pode evoluir de estado no fluxo operacional, preservando histórico

## 6.2 Regras

* usa data real (settlementDate)
* pode usar conta diferente da prevista
* pode ter valor diferente (com ajuste explícito)
* não permite baixa parcial no MVP
* histórico é sempre preservado

---

# 7. Modelo de Datas

Todo commitment possui:

## 7.1 competencyDate

* conceito de data de competência/reconhecimento
* no modelo atual, o campo canônico no domínio é `documentDate`
* impacta DRE
* não pode ser futura para eventos confirmados

## 7.2 dueDate

* vencimento contratual
* deve ser >= competencyDate

## 7.3 plannedSettlementDate

* previsão de liquidação
* pode divergir do vencimento
* usada na projeção

## 7.4 settlementDate

* data real de liquidação
* impacta caixa

---

# 8. Regras de Datas

competencyDate (conceito) = documentDate (campo canônico atual)

competencyDate ≤ dueDate
plannedSettlementDate ≠ obrigatoriamente dueDate
settlementDate = data real

Na projeção:

cashFlowDate = settlementDate ?? plannedSettlementDate

---

# 9. Regime Contábil

## 9.1 Regra principal

* eventos confirmados impactam DRE
* eventos realizados impactam caixa

## 9.2 Exemplos

Despesa à vista:

* reconhece e liquida no mesmo momento

Despesa a prazo:

* reconhece no commitment
* liquida depois

Cartão:

* reconhece na compra
* liquida no pagamento da fatura

---

# 10. Princípios Contábeis do Sistema

* consistência em partidas dobradas
* histórico imutável (apenas reversões)
* rastreabilidade completa
* ausência de dupla contagem
* separação entre econômico e financeiro

---

# 11. UX vs Domínio

## Fluxo principal de uso

* orientado a ação e simplicidade (pagar, receber, cartão, previsão)
* linguagem operacional como padrão

## Superfície técnica no MVP

* existe para auditoria e consistência do domínio
* inclui razão (`/ledger`) e plano de contas
* não substitui o fluxo operacional simplificado; complementa-o quando necessário

---

# 12. Diretrizes Arquiteturais

* domínio não depende de UI
* domínio não depende de APIs externas
* persistence é abstraída
* regras financeiras são centralizadas no domínio

---

# 13. Observações Importantes

* Commitment não é opcional para eventos a prazo
* Nem todo evento passa por commitment (ex: à vista)
* PlanningEvent e Commitment devem convergir conceitualmente
* LedgerEntry é a fonte oficial para relatórios contábeis

---

# 14. Status

Este documento é a base para:

* módulo commitments
* integração com projection
* evolução do ledger
* consistência do sistema como um todo
