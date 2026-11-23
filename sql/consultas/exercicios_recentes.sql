-- Exercícios dos treinos retornados por treinos_recentes.sql (mesmo :limite).
SELECT e.treino_id, e.nome, e.series, e.repeticoes, e.carga_kg
  FROM exercicios e
  JOIN (SELECT id FROM treinos ORDER BY data DESC, id DESC LIMIT :limite) t
    ON t.id = e.treino_id
 ORDER BY e.id;
