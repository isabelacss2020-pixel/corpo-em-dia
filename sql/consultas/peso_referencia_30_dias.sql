-- Última pesagem feita até 30 dias antes da pesagem atual (:atual), usada para a variação do mês.
SELECT data, peso_kg
  FROM pesagens
 WHERE data <= date(:atual, '-30 days')
 ORDER BY data DESC
 LIMIT 1;
