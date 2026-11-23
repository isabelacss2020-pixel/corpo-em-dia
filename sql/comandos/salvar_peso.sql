-- Uma pesagem por dia: se a data já existe, só atualiza o peso (UPSERT).
INSERT INTO pesagens (data, peso_kg)
VALUES (:data, :kg)
ON CONFLICT (data) DO UPDATE SET peso_kg = excluded.peso_kg;
