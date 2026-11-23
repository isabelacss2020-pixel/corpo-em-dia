-- Totais do mês da data informada (:hoje).
SELECT COUNT(*)                         AS treinos,
       COALESCE(SUM(duracao_min), 0)    AS minutos,
       COALESCE(SUM(distancia_km), 0.0) AS km
  FROM treinos
 WHERE substr(data, 1, 7) = substr(:hoje, 1, 7);
