"""Rotas da API (JSON). O front-end conversa só com estas rotas."""
from datetime import date

from flask import Blueprint, current_app, g, jsonify, request

from . import metricas
from .banco import conectar, sql
from .validacao import (COLUNAS_PERFIL, ErroValidacao, parse_data,
                        validar_perfil, validar_peso, validar_treino)

bp = Blueprint('api', __name__, url_prefix='/api')

LIMITE_LISTAS = 200


def db():
    """Uma conexão por requisição, fechada no fim."""
    if 'db' not in g:
        g.db = conectar(current_app.config['BANCO'])
    return g.db


@bp.teardown_app_request
def fechar_conexao(_erro):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


@bp.errorhandler(ErroValidacao)
def erro_de_validacao(e):
    return jsonify(erro=str(e)), 400


def _corpo():
    corpo = request.get_json(silent=True)
    if not isinstance(corpo, dict):
        raise ErroValidacao('Dados inválidos.')
    return corpo


def _vazio_se_nulo(valor):
    return '' if valor is None else valor


def _perfil(p):
    return {
        'nome': p['nome'],
        'idade': _vazio_se_nulo(p['idade']),
        'altura': _vazio_se_nulo(p['altura_cm']),
        'metaPeso': _vazio_se_nulo(p['meta_peso_kg']),
        'metaSemanal': p['meta_semanal'],
    }


def _treinos(conn):
    exercicios = {}
    for e in conn.execute(sql('consultas/exercicios_recentes'), {'limite': LIMITE_LISTAS}):
        exercicios.setdefault(e['treino_id'], []).append(
            {'nome': e['nome'], 'series': e['series'], 'reps': e['repeticoes'], 'carga': e['carga_kg']})
    lista = []
    for t in conn.execute(sql('consultas/treinos_recentes'), {'limite': LIMITE_LISTAS}):
        item = {'id': t['id'], 'data': t['data'], 'tipo': t['tipo'], 'duracao': t['duracao_min'], 'obs': t['observacao']}
        if t['distancia_km'] is not None:
            item['distanciaKm'] = t['distancia_km']
        if t['id'] in exercicios:
            item['exercicios'] = exercicios[t['id']]
        lista.append(item)
    return lista


def _pesos(conn):
    return [{'id': p['id'], 'data': p['data'], 'kg': p['peso_kg'], 'variacao': p['variacao']}
            for p in conn.execute(sql('consultas/evolucao_peso'), {'limite': LIMITE_LISTAS})]


@bp.get('/saude')
def saude():
    return jsonify(ok=True)


@bp.get('/estado')
def estado():
    """Tudo o que o front-end precisa para desenhar as telas. `?hoje=AAAA-MM-DD` é o dia do aparelho."""
    texto = request.args.get('hoje')
    hoje = parse_data(texto) if texto else date.today()
    conn = db()
    perfil = conn.execute('SELECT * FROM perfil WHERE id = 1').fetchone()
    return jsonify(
        perfil=_perfil(perfil),
        demo=bool(perfil['modo_exemplo']),
        letraGrande=bool(perfil['letra_grande']),
        treinos=_treinos(conn),
        pesos=_pesos(conn),
        resumo=metricas.resumo(conn, perfil, hoje),
    )


@bp.post('/treinos')
def criar_treino():
    treino = validar_treino(_corpo())
    conn = db()
    with conn:  # transação: ou grava o treino e os exercícios, ou nada
        cur = conn.execute(sql('comandos/inserir_treino'), treino)
        for e in treino['exercicios']:
            conn.execute(sql('comandos/inserir_exercicio'), {**e, 'treino_id': cur.lastrowid})
    return jsonify(id=cur.lastrowid), 201


@bp.delete('/treinos/<int:treino_id>')
def apagar_treino(treino_id):
    conn = db()
    with conn:
        apagados = conn.execute('DELETE FROM treinos WHERE id = ?', (treino_id,)).rowcount
    if not apagados:
        return jsonify(erro='Treino não encontrado.'), 404
    return '', 204


@bp.put('/pesos')
def salvar_peso():
    peso = validar_peso(_corpo())
    conn = db()
    with conn:
        conn.execute(sql('comandos/salvar_peso'), peso)
    return jsonify(ok=True)


@bp.delete('/pesos/<int:peso_id>')
def apagar_peso(peso_id):
    conn = db()
    with conn:
        apagados = conn.execute('DELETE FROM pesagens WHERE id = ?', (peso_id,)).rowcount
    if not apagados:
        return jsonify(erro='Pesagem não encontrada.'), 404
    return '', 204


@bp.put('/perfil')
def salvar_perfil():
    dados = validar_perfil(_corpo())
    if dados:
        # Os nomes das colunas vêm da lista fixa COLUNAS_PERFIL; os valores vão como parâmetros.
        colunas = ', '.join(f'{c} = :{c}' for c in dados if c in COLUNAS_PERFIL.values())
        conn = db()
        with conn:
            conn.execute(f'UPDATE perfil SET {colunas} WHERE id = 1', dados)
    return jsonify(ok=True)


@bp.post('/limpar')
def limpar():
    conn = db()
    with conn:
        for comando in sql('comandos/limpar').split(';'):
            if comando.strip():
                conn.execute(comando)
    return jsonify(ok=True)
