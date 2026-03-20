# ARCHITECTURAL_DEBT

## Propósito
Este documento centraliza dívidas arquiteturais do FINAPP para garantir rastreabilidade das decisões de curto prazo adotadas no MVP e orientar correções futuras sem perda de contexto.

## Quando registrar uma dívida
Registrar sempre que uma decisão técnica consciente introduzir risco relevante de médio/longo prazo, especialmente quando afetar:

- integridade contábil
- rastreabilidade
- idempotência
- prevenção de dupla contagem
- consistência entre projeção, competência e caixa

## Dívidas Arquiteturais

### AD-001 — Possível criação de LedgerEntry órfão

**Contexto**  
No fluxo atual de criação de `BusinessTransaction` (Step 4), o sistema:
1. salva o `LedgerEntry` de reconhecimento
2. depois salva a `BusinessTransaction` com o vínculo

Se o segundo passo falhar, pode sobrar um `LedgerEntry` sem vínculo.

**Impacto**
- inconsistência contábil
- perda de rastreabilidade
- risco para projeção e auditoria

**Motivo da decisão**
- ausência de transação/rollback no contrato atual de repositórios (MVP com localStorage)
- priorização de simplicidade e avanço incremental

**Plano de resolução**
- introduzir transação ao migrar para banco (ex.: Supabase)
ou
- implementar estratégia compensatória (rollback ou marcação de estado intermediário)

**Prioridade**  
Alta

**Status**  
Aberto

---

### AD-002 — Status de Commitment persistido vs derivado

**Contexto**  
O status (`confirmed` | `settled`) é armazenado na entidade e também derivado a partir de `ledgerLinks`.

**Impacto**
- risco de drift entre estado persistido e estado real
- possíveis inconsistências silenciosas

**Motivo da decisão**
- otimização de leitura e simplicidade no MVP

**Plano de resolução**
- avaliar persistir apenas estado derivado
ou
- reforçar consistência via regras de domínio mais rígidas

**Prioridade**  
Média

**Status**  
Aberto

---

### AD-003 — Ausência de vínculo explícito de reversão (`reversalOf`)

**Contexto**  
Reversões são representadas apenas por tipo (`settlement_reversal`, etc.), sem referência explícita ao lançamento original.

**Impacto**
- dificuldade de auditoria
- ambiguidade em cenários complexos de reversão
- maior fragilidade na derivação de estado

**Motivo da decisão**
- simplificação do modelo no MVP

**Plano de resolução**
- introduzir campo `reversalOfLedgerEntryId` ou equivalente nos vínculos

**Prioridade**  
Média

**Status**  
Aberto

---

### AD-004 — Uso de ledgerEntryId placeholder (`pending:*`)

**Contexto**  
Durante a criação de commitments, `ledgerLinks` pode conter IDs temporários (`pending:*`) antes da integração completa com `LedgerEntry`.

**Impacto**
- inconsistência temporária de referência
- necessidade de refator futura

**Motivo da decisão**
- desenvolvimento incremental desacoplando domínio e infraestrutura contábil

**Plano de resolução**
- substituir placeholders por IDs reais no step de integração com `LedgerEntry`

**Prioridade**  
Baixa

**Status**  
Aberto
