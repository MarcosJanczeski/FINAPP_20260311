explique a composição desses lançamentos contábeis. não estou conseguindo identificar as contas debitadas e creditadas no relatório.

Resposta aplicada:
- a dificuldade ocorria porque o relatório mostrava apenas o cabeçalho do lançamento
- as partidas (débito/crédito) já existiam tecnicamente em `LedgerEntry.lines`
- o relatório `/ledger` foi ajustado para exibir, em cada lançamento, as linhas com:
  - conta contábil (`código - nome`)
  - débito
  - crédito
- objetivo: manter legibilidade em celular e transparência técnica da escrituração em partidas dobradas
