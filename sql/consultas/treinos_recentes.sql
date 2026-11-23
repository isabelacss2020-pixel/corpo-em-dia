-- Treinos mais recentes primeiro.
SELECT id, data, tipo, duracao_min, distancia_km, observacao
  FROM treinos
 ORDER BY data DESC, id DESC
 LIMIT :limite;
