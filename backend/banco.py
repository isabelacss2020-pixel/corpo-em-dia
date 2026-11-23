"""Acesso ao banco SQLite: conexão, criação das tabelas e leitura dos arquivos .sql."""
import os
import sqlite3
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PASTA_SQL = RAIZ / 'sql'


def caminho_padrao():
    """Arquivo do banco. Pode ser trocado pela variável de ambiente CORPO_DB."""
    return os.environ.get('CORPO_DB', str(RAIZ / 'data' / 'corpo_em_dia.db'))


def conectar(caminho):
    conn = sqlite3.connect(caminho)
    conn.row_factory = sqlite3.Row          # permite ler colunas pelo nome
    conn.execute('PRAGMA foreign_keys = ON')  # o SQLite só respeita chaves estrangeiras se pedirmos
    return conn


def sql(nome):
    """Lê um arquivo da pasta sql/, por exemplo sql('schema') ou sql('consultas/evolucao_peso')."""
    return (PASTA_SQL / f'{nome}.sql').read_text(encoding='utf-8')


def inicializar(caminho, com_exemplo=True):
    """Cria as tabelas. Se o banco é novo, carrega também os dados de exemplo."""
    arquivo = Path(caminho)
    novo = not arquivo.exists()
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    conn = conectar(caminho)
    try:
        conn.executescript(sql('schema'))
        if novo and com_exemplo:
            conn.executescript(sql('exemplo'))
        conn.commit()
    finally:
        conn.close()
