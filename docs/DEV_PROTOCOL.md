# FINAPP — Development Protocol (Baby Steps System)

## 1. Propósito

Este protocolo define o fluxo oficial de desenvolvimento do FINAPP com uso de IA (ChatGPT + Codex).

Objetivos:

* garantir consistência entre domínio, código e documentação
* evitar regressões financeiras
* preservar invariantes críticas
* permitir evolução incremental segura (baby steps)
* manter rastreabilidade de decisões
* transformar interação com IA em processo controlado

---

## 2. Princípio Central

"Nunca implementar antes de entender completamente o comportamento do domínio."

---

## 3. Princípio Estrutural

O FINAPP segue:

* desenvolvimento iterativo e incremental
* validação contínua
* documentação como fonte de verdade
* domínio como autoridade máxima

---

## 4. Ciclo Oficial de Desenvolvimento

Todo desenvolvimento deve seguir:

1. DIREÇÃO
2. ANÁLISE (Codex)
3. PROPOSTA (Codex)
4. VALIDAÇÃO HUMANA
5. PLANO DE IMPLEMENTAÇÃO
6. IMPLEMENTAÇÃO (baby step)
7. VALIDAÇÃO + TESTES
8. ALINHAMENTO DE DOCUMENTAÇÃO

Proibido pular etapas.

---

## 5. Papéis

### Humano

* define direção
* toma decisões finais
* garante visão de produto

### ChatGPT

* atua como arquiteto
* valida consistência
* detecta conflitos
* estrutura raciocínio

### Codex

* executor disciplinado
* analisa código e docs
* propõe soluções
* implementa com escopo controlado

---

## 6. Etapas do Processo

### 6.1 Direção

Define:

* módulo
* problema
* objetivo
* restrições

---

### 6.2 Análise (obrigatória)

Codex deve:

1. descrever comportamento esperado (docs)
2. comparar com estado atual
3. listar inconsistências
4. apontar riscos

Proibido:

* sugerir código

---

### 6.3 Proposta

Codex deve:

* propor solução mínima (MVP-safe)
* listar impactos
* listar invariantes afetadas
* listar testes necessários
* listar riscos

---

### 6.4 Validação

Humano:

* aprova
* ajusta
* rejeita

Sem aprovação → não implementar

---

### 6.5 Plano de Implementação

Codex deve:

* quebrar em baby steps
* listar arquivos
* definir ordem
* definir testes

---

### 6.6 Implementação

Regras:

* executar apenas 1 baby step
* não expandir escopo
* não refatorar além do necessário
* não alterar UI sem autorização

---

### 6.7 Validação

Perguntas obrigatórias:

* há dupla contagem?
* há quebra de saldo?
* há quebra de idempotência?
* há perda de rastreabilidade?

Se sim → parar

---

### 6.8 Documentação

Sempre atualizar:

* DOMAIN_DECISIONS.md
* PRD
* ARCHITECTURE_MVP

Regra:

"documentação deve refletir o comportamento real do sistema"

---

## 7. Classificação de Steps

### Tipo A — baixo risco

* UI
* refatoração leve

### Tipo B — médio risco

* casos de uso
* sincronização

### Tipo C — alto risco

* commitments
* projection
* credit cards
* ledger

Regras Tipo C:

* análise profunda obrigatória
* testes obrigatórios
* validação rigorosa

---

## 8. Regras de Domínio (imutáveis)

Nunca violar:

* separação competência vs caixa
* projeção não altera histórico
* cartão não afeta caixa na compra
* fatura afeta caixa
* ausência de dupla contagem
* histórico contábil aditivo

---

## 9. Integração com Documentos

Ordem de precedência:

1. ESSENCIAL.md
2. DOMAIN_DECISIONS.md
3. ARCHITECTURE_MVP.md
4. FINAPP_PRD.md

---

## 10. Critério de Conclusão de Step

Um step só é considerado pronto quando:

* comportamento correto
* invariantes preservadas
* testes válidos
* documentação alinhada
* sem efeitos colaterais

---

## 11. Regras de Interação com Codex

Proibido:

* pedir código direto
* pular análise
* aceitar resposta sem validação

Obrigatório:

* prompts estruturados
* validação antes de implementar
* controle de escopo

---

## 12. Princípio de Segurança

"Em dúvida, parar e alinhar antes de implementar"

---

## 13. Gestão de Dívida Técnica

Toda decisão que introduzir risco deve ser registrada em:

`docs/ARCHITECTURAL_DEBT.md`

Critérios:

* risco contábil
* risco de rastreabilidade
* risco de inconsistência
* solução temporária

---

## 14. Resultado Esperado

Este protocolo garante:

* evolução segura
* alta confiabilidade financeira
* baixo retrabalho
* rastreabilidade total
* domínio consistente

---

Após criação:

1. Confirmar criação do arquivo
2. Mostrar diff resumido
3. Sugerir commit:

`docs(dev): add development protocol (baby steps system)`

---

Importante:

Este protocolo passa a ser obrigatório para qualquer interação com Codex no projeto.

Não implementar mais nada além da criação do arquivo.

## 15. Organização de Sessões de Desenvolvimento

Para garantir desempenho, clareza e qualidade de raciocínio, o desenvolvimento do FINAPP deve ser organizado em sessões de chat separadas por contexto.

### 15.1 Princípio

Cada sessão deve ter:

- escopo bem definido
- contexto limitado e relevante
- objetivo claro

Evitar sessões longas e genéricas.

---

### 15.2 Estrutura recomendada de sessões

Organizar por módulos de domínio, por exemplo:

- FINAPP - commitments
- FINAPP - credit-cards
- FINAPP - projection
- FINAPP - planning
- FINAPP - accounts
- FINAPP - counterparties

Cada sessão deve focar apenas no seu módulo.

---

### 15.3 Sessão de governança (central)

Manter uma sessão dedicada para:

- decisões arquiteturais
- alinhamento entre módulos
- revisão de documentos
- definição de protocolo

Exemplo:
- FINAPP - development / architecture

---

### 15.4 Transferência de contexto entre sessões

Como não há memória automática entre chats:

Sempre iniciar nova sessão com:

- contexto do módulo
- decisões já tomadas relevantes
- referência a documentos atualizados

Utilizar prompt estruturado de inicialização.

---

### 15.5 Fonte de verdade

A fonte oficial de contexto não é o chat, mas sim:

- DOMAIN_DECISIONS.md
- PRD
- ARCHITECTURE_MVP
- ESSENCIAL

Chats são apenas ferramentas operacionais.

---

### 15.6 Regra de consistência

Se uma decisão impactar múltiplos módulos:

1. registrar em DOMAIN_DECISIONS.md
2. atualizar documentos
3. só então propagar para outros módulos

---

### 15.7 Benefícios

- melhor performance do modelo
- menor perda de contexto
- respostas mais precisas
- menor risco de inconsistência
- maior controle arquitetural

### 15.8 Template de Inicialização de Sessão

Toda nova sessão de desenvolvimento deve ser iniciada com um prompt estruturado.

Objetivo:
- alinhar contexto rapidamente
- evitar ambiguidades
- reduzir perda de qualidade do modelo
- garantir continuidade do projeto

---

#### Template padrão

Contexto: FINAPP / [nome do módulo]

Objetivo: [objetivo da sessão]

Tipo de resposta: [estratégico | análise | design | implementação]

---

IMPORTANTE:

Esta sessão faz parte do desenvolvimento contínuo do FINAPP.

Siga estritamente:

- docs/ESSENCIAL.md
- docs/DOMAIN_DECISIONS.md
- docs/FINAPP_PRD.md
- docs/ARCHITECTURE_MVP.md
- docs/DEV_PROTOCOL.md

---

Decisões já tomadas (não reavaliar):

- sistema usa regime de competência
- separação entre competência e caixa
- commitment = obrigação/direito em aberto
- eventos:
  - previsto → não reconhecido
  - confirmado → impacta DRE
  - realizado → impacta caixa
- histórico contábil é aditivo (sem sobrescrita)
- projeção não altera histórico

---

Regras da sessão:

- não propor código antes de análise
- não violar invariantes do domínio
- não contradizer documentos oficiais
- manter respostas objetivas e estruturadas

---

Solicitação:

[descrever o que deseja nesta sessão]

---

#### Observações

- Se faltar contexto, perguntar antes de assumir
- Se houver conflito entre documentos, sinalizar
- Se houver risco de regressão, explicitar

---

#### Variações por tipo de sessão

##### Sessão de análise

Adicionar:

Foco:
- comportamento atual vs esperado
- inconsistências
- riscos

---

##### Sessão de design

Adicionar:

Foco:
- solução mínima
- impactos
- cenários de teste

---

##### Sessão de implementação

Adicionar:

Foco:
- executar apenas baby step aprovado
- não expandir escopo
---
