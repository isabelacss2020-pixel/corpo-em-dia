-- Primeira e última pesagem, mais o total de pesagens registradas.
SELECT 'inicial' AS quando, data, peso_kg, (SELECT COUNT(*) FROM pesagens) AS total
  FROM (SELECT data, peso_kg FROM pesagens ORDER BY data ASC LIMIT 1)
UNION ALL
SELECT 'atual', data, peso_kg, (SELECT COUNT(*) FROM pesagens)
  FROM (SELECT data, peso_kg FROM pesagens ORDER BY data DESC LIMIT 1);
