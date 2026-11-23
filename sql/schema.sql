-- ==========================================================
-- Corpo em Dia — modelo de dados (SQLite)
-- Pode ser executado várias vezes: tudo usa IF NOT EXISTS.
-- ==========================================================
PRAGMA foreign_keys = ON;

-- Perfil da pessoa que usa esta instalação (sempre uma única linha, id = 1).
CREATE TABLE IF NOT EXISTS perfil (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    nome          TEXT    NOT NULL DEFAULT '',
    idade         INTEGER CHECK (idade IS NULL OR idade BETWEEN 10 AND 120),
    altura_cm     INTEGER CHECK (altura_cm IS NULL OR altura_cm BETWEEN 100 AND 250),
    meta_peso_kg  REAL    CHECK (meta_peso_kg IS NULL OR meta_peso_kg BETWEEN 20 AND 400),
    meta_semanal  INTEGER NOT NULL DEFAULT 3 CHECK (meta_semanal BETWEEN 1 AND 7),
    letra_grande  INTEGER NOT NULL DEFAULT 0 CHECK (letra_grande IN (0, 1)),
    modo_exemplo  INTEGER NOT NULL DEFAULT 0 CHECK (modo_exemplo IN (0, 1))
);
INSERT OR IGNORE INTO perfil (id) VALUES (1);

-- Tipos de atividade (tabela de apoio; a chave estrangeira impede tipos inventados).
CREATE TABLE IF NOT EXISTS tipos_atividade (
    codigo TEXT PRIMARY KEY,
    nome   TEXT NOT NULL
);
INSERT OR IGNORE INTO tipos_atividade (codigo, nome) VALUES
    ('academia',  'Academia'),
    ('casa',      'Em casa'),
    ('caminhada', 'Caminhada'),
    ('corrida',   'Corrida'),
    ('luta',      'Luta'),
    ('danca',     'Dança'),
    ('outros',    'Outros');

-- Cada treino registrado. Datas no formato AAAA-MM-DD.
CREATE TABLE IF NOT EXISTS treinos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    data         TEXT    NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    tipo         TEXT    NOT NULL REFERENCES tipos_atividade (codigo),
    duracao_min  INTEGER NOT NULL CHECK (duracao_min BETWEEN 1 AND 600),
    distancia_km REAL    CHECK (distancia_km IS NULL OR distancia_km > 0),
    observacao   TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_treinos_data ON treinos (data);

-- Exercícios de um treino (opcional, usado em academia e em casa).
CREATE TABLE IF NOT EXISTS exercicios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    treino_id   INTEGER NOT NULL REFERENCES treinos (id) ON DELETE CASCADE,
    nome        TEXT    NOT NULL,
    series      INTEGER NOT NULL DEFAULT 1 CHECK (series BETWEEN 1 AND 20),
    repeticoes  INTEGER NOT NULL DEFAULT 1 CHECK (repeticoes BETWEEN 1 AND 200),
    carga_kg    REAL    NOT NULL DEFAULT 0 CHECK (carga_kg BETWEEN 0 AND 500)
);
CREATE INDEX IF NOT EXISTS idx_exercicios_treino ON exercicios (treino_id);

-- Pesagens: no máximo uma por dia (UNIQUE), pesar de novo no mesmo dia atualiza o valor.
CREATE TABLE IF NOT EXISTS pesagens (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    data     TEXT NOT NULL UNIQUE CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    peso_kg  REAL NOT NULL CHECK (peso_kg BETWEEN 20 AND 400)
);
