"""Validação dos dados que chegam pela API.

O banco também tem regras (CHECK), mas aqui as mensagens são escritas para a pessoa
que usa o app. Qualquer problema levanta ErroValidacao, que a API devolve como erro 400.
"""
import math
from datetime import date, timedelta

TIPOS = ('academia', 'casa', 'caminhada', 'corrida', 'luta', 'danca', 'outros')

# nome usado pelo front-end -> coluna da tabela perfil (lista fixa: nunca vem do usuário)
COLUNAS_PERFIL = {
    'nome': 'nome',
    'idade': 'idade',
    'altura': 'altura_cm',
    'metaPeso': 'meta_peso_kg',
    'metaSemanal': 'meta_semanal',
    'letraGrande': 'letra_grande',
}


class ErroValidacao(ValueError):
    """Dado inválido enviado pelo usuário."""


def _numero(valor, rotulo, minimo, maximo, inteiro=False):
    if valor is None or isinstance(valor, bool) or str(valor).strip() == '':
        raise ErroValidacao(f'Informe {rotulo}.')
    try:
        n = float(str(valor).replace(',', '.'))
    except ValueError:
        raise ErroValidacao(f'Valor inválido em {rotulo}.')
    if not math.isfinite(n) or not minimo <= n <= maximo:
        raise ErroValidacao(f'Confira {rotulo}: use um valor entre {minimo:g} e {maximo:g}.')
    return int(round(n)) if inteiro else round(n, 2)


def _numero_opcional(valor, rotulo, minimo, maximo, inteiro=False):
    if valor is None or str(valor).strip() == '':
        return None
    return _numero(valor, rotulo, minimo, maximo, inteiro)


def parse_data(valor):
    """Converte 'AAAA-MM-DD' em date. Aceita só esse formato."""
    texto = str(valor)
    if len(texto) != 10:
        raise ErroValidacao('Data inválida.')
    try:
        return date.fromisoformat(texto)
    except ValueError:
        raise ErroValidacao('Data inválida.')


def data_registro(valor):
    """Data de um treino ou pesagem: precisa existir e não pode estar no futuro."""
    d = parse_data(valor)
    if d.year < 2000:
        raise ErroValidacao('Data inválida.')
    if d > date.today() + timedelta(days=1):  # 1 dia de folga por causa do fuso horário
        raise ErroValidacao('Escolha um dia que já passou.')
    return d.isoformat()


def _texto(valor, rotulo, maximo):
    texto = '' if valor is None else str(valor).strip()
    if len(texto) > maximo:
        raise ErroValidacao(f'{rotulo.capitalize()} muito longo (máximo {maximo} letras).')
    return texto


def _dicionario(dados):
    if not isinstance(dados, dict):
        raise ErroValidacao('Dados inválidos.')
    return dados


def validar_treino(dados):
    dados = _dicionario(dados)
    tipo = dados.get('tipo')
    if tipo not in TIPOS:
        raise ErroValidacao('Escolha o que você fez.')

    exercicios = []
    lista = dados.get('exercicios') or []
    if not isinstance(lista, list) or len(lista) > 30:
        raise ErroValidacao('Lista de exercícios inválida.')
    for e in lista:
        e = _dicionario(e)
        nome = _texto(e.get('nome'), 'o nome do exercício', 60)
        if not nome:
            continue
        exercicios.append({
            'nome': nome,
            'series': _numero(e.get('series', 1), 'as séries', 1, 20, inteiro=True),
            'reps': _numero(e.get('reps', 1), 'as repetições', 1, 200, inteiro=True),
            'carga': _numero(e.get('carga', 0), 'a carga', 0, 500),
        })

    return {
        'data': data_registro(dados.get('data')),
        'tipo': tipo,
        'duracao': _numero(dados.get('duracao'), 'o tempo em minutos', 1, 600, inteiro=True),
        'distancia': _numero_opcional(dados.get('distanciaKm'), 'a distância', 0.1, 100),
        'obs': _texto(dados.get('obs'), 'a anotação', 140),
        'exercicios': exercicios,
    }


def validar_peso(dados):
    dados = _dicionario(dados)
    return {
        'data': data_registro(dados.get('data')),
        'kg': round(_numero(dados.get('kg'), 'o peso', 20, 400), 1),
    }


def validar_perfil(dados):
    """Aceita só os campos enviados e devolve {coluna: valor} pronto para o UPDATE."""
    dados = _dicionario(dados)
    regras = {
        'nome': lambda v: _texto(v, 'o nome', 40),
        'idade': lambda v: _numero_opcional(v, 'a idade', 10, 120, inteiro=True),
        'altura': lambda v: _numero_opcional(v, 'a altura', 100, 250, inteiro=True),
        'metaPeso': lambda v: _numero_opcional(v, 'o peso que você quer', 20, 400),
        'metaSemanal': lambda v: _numero(v, 'os dias por semana', 1, 7, inteiro=True),
        'letraGrande': lambda v: 1 if v in (True, 1, '1', 'true') else 0,
    }
    return {COLUNAS_PERFIL[campo]: regra(dados[campo]) for campo, regra in regras.items() if campo in dados}
