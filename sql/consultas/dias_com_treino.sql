-- Dias que tiveram pelo menos um treino dentro de um intervalo de datas.
SELECT DISTINCT data
  FROM treinos
 WHERE data BETWEEN :inicio AND :fim;
