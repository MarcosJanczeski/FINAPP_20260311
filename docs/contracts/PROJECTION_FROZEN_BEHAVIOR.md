# PROJECTION_FROZEN_BEHAVIOR

## Objetivo
Congelar o comportamento atualmente esperado do modulo `projection` no MVP, protegendo invariantes financeiras e reduzindo regressoes enquanto `commitments` e `credit-cards` evoluem.

## Fontes de verdade
- `docs/ESSENCIAL.md`
- `docs/FINAPP_PRD.md`
- `docs/ARCHITECTURE_MVP.md`
- `src/application/use-cases/__tests__/ProjectionReliabilityContract.spec.ts`

## Escopo coberto
- resumo de disponibilidades
- timeline de projecao
- ordenacao temporal
- reversoes encadeadas
- ausencia de dupla contagem
- idempotencia de sincronizacao

## Fora de escopo
- modelagem final de `credit-cards`
- duplicacao semantica com `sourceEventKey` diferentes
- evolucao futura da margem alem do comportamento atual

## Invariantes congeladas
1. Projecao usa `PlanningEvent` e nao reescreve historico real.
2. Saldo real so muda com transacao real.
3. `cashFlowDate = settlementDate ?? plannedSettlementDate`.
4. Ordenacao, agregacoes, menor saldo e saldo final usam `cashFlowDate`.
5. Compra no cartao nao reduz caixa; pagamento da fatura reduz caixa.
6. Projecao deve evitar dupla contagem.
7. Reversoes sao aditivas e auditaveis.
8. Sync e idempotente por `sourceEventKey`.
9. Grafico e timeline usam a mesma base.
10. Estado funcional consolidado ignora vinculos ja revertidos.

## Cenarios protegidos pela suite atual
- `recognition -> settlement -> settlement_reversal`
- `recognition -> recognition_reversal`
- `recognition -> settlement -> recognition_reversal`
- `reversal -> sync -> sync`
- compensacao acidental com saldo final aparentemente correto
- sensibilidade temporal do menor saldo

## Risco estrutural conhecido
- duplicacao semantica da mesma obrigacao economica com `sourceEventKey` diferentes

## Regra para mudancas futuras
Qualquer alteracao em `commitments`, `credit-cards`, recorrencias ou sync que afete estas invariantes exige atualizacao deste contrato e da suite de confiabilidade antes da consolidacao.

## Referência de execução
- Rodar: npx vitest run src/application/use-cases/__tests__/ProjectionReliabilityContract.spec.ts