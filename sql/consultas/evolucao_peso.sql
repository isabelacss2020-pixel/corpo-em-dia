-- Pesagens da mais nova para a mais antiga, com a diferença para a pesagem anterior.
-- LAG() é uma função de janela: olha a linha anterior na ordem de datas.
SELECT id,
       data,
       peso_kg,
       ROUND(peso_kg - LAG(peso_kg) OVER (ORDER BY data), 1) AS variacao
  FROM pesagens
 ORDER BY data DESC
 LIMIT :limite;
