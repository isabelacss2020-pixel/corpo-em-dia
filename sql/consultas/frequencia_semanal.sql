-- Quantos dias diferentes tiveram treino em cada semana (segunda a domingo).
-- date(x, 'weekday 0', '-6 days') leva qualquer data até a segunda-feira da sua semana.
SELECT date(data, 'weekday 0', '-6 days') AS inicio_semana,
       COUNT(DISTINCT data)               AS dias
  FROM treinos
 GROUP BY inicio_semana
 ORDER BY inicio_semana DESC;
