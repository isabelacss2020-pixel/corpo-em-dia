-- ==========================================================
-- Dados de exemplo para o primeiro acesso.
-- As datas são calculadas a partir de hoje, então o exemplo nunca fica "velho".
-- ==========================================================
UPDATE perfil
   SET nome = 'Exemplo', idade = 34, altura_cm = 165, meta_peso_kg = 72,
       meta_semanal = 3, modo_exemplo = 1
 WHERE id = 1;

-- Dez pesagens semanais (n = quantas semanas atrás).
INSERT INTO pesagens (data, peso_kg)
SELECT date('now', 'localtime', (-7 * n) || ' days'), kg
  FROM (SELECT 9 AS n, 78.4 AS kg UNION ALL SELECT 8, 78.0 UNION ALL SELECT 7, 77.6
        UNION ALL SELECT 6, 77.7 UNION ALL SELECT 5, 76.9 UNION ALL SELECT 4, 76.5
        UNION ALL SELECT 3, 76.2 UNION ALL SELECT 2, 76.3 UNION ALL SELECT 1, 75.6
        UNION ALL SELECT 0, 75.3);

-- Treinos dos últimos 35 dias. A consulta recursiva gera um dia por linha (n = dias atrás)
-- e cada dia da semana recebe uma atividade (dow: 0 = domingo ... 6 = sábado).
WITH RECURSIVE dias (n) AS (
    SELECT 0
    UNION ALL
    SELECT n + 1 FROM dias WHERE n < 34
),
plano AS (
    SELECT n,
           date('now', 'localtime', '-' || n || ' days')                                   AS data,
           CAST(strftime('%w', date('now', 'localtime', '-' || n || ' days')) AS INTEGER) AS dow
      FROM dias
)
INSERT INTO treinos (data, tipo, duracao_min, distancia_km)
SELECT data,
       CASE dow WHEN 1 THEN 'academia' WHEN 2 THEN 'danca' WHEN 3 THEN 'casa'
                WHEN 5 THEN 'academia' WHEN 6 THEN 'caminhada' ELSE 'corrida' END,
       CASE dow WHEN 1 THEN 55 WHEN 2 THEN 45 WHEN 3 THEN 30
                WHEN 5 THEN 60 WHEN 6 THEN 40 ELSE 25 END,
       CASE dow WHEN 6 THEN 3.5 WHEN 0 THEN 3.0 END
  FROM plano
 WHERE n % 11 <> 3                      -- alguns dias sem treino, para parecer real
   AND (dow IN (1, 3, 5)
        OR (dow = 2 AND n % 3 = 0)
        OR (dow = 6 AND n % 2 = 0)
        OR (dow = 0 AND n % 2 = 1));

-- Exercícios: segunda (ficha A), sexta (ficha B) e quarta (em casa).
INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga_kg)
SELECT t.id, f.nome, f.series, f.repeticoes, f.carga_kg
  FROM treinos t
 CROSS JOIN (SELECT 'Agachamento' AS nome, 3 AS series, 12 AS repeticoes, 40.0 AS carga_kg
             UNION ALL SELECT 'Supino reto', 3, 10, 30.0
             UNION ALL SELECT 'Remada baixa', 3, 12, 35.0) f
 WHERE t.tipo = 'academia' AND strftime('%w', t.data) = '1';

INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga_kg)
SELECT t.id, f.nome, f.series, f.repeticoes, f.carga_kg
  FROM treinos t
 CROSS JOIN (SELECT 'Leg press' AS nome, 3 AS series, 12 AS repeticoes, 80.0 AS carga_kg
             UNION ALL SELECT 'Desenvolvimento', 3, 10, 20.0
             UNION ALL SELECT 'Puxada frontal', 3, 12, 40.0) f
 WHERE t.tipo = 'academia' AND strftime('%w', t.data) = '5';

INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga_kg)
SELECT t.id, f.nome, f.series, f.repeticoes, f.carga_kg
  FROM treinos t
 CROSS JOIN (SELECT 'Polichinelo' AS nome, 3 AS series, 30 AS repeticoes, 0.0 AS carga_kg
             UNION ALL SELECT 'Agachamento livre', 3, 15, 0.0
             UNION ALL SELECT 'Abdominal', 3, 20, 0.0) f
 WHERE t.tipo = 'casa';
