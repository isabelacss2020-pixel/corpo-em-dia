"""Regras de negócio: frequência de treinos e evolução do peso.

Os números vêm de consultas SQL (pasta sql/consultas). Aqui ficam as regras que ficam
mais claras em Python, como a sequência de semanas na meta e o cálculo do IMC.
"""
from datetime import timedelta

from .banco import sql

# (limite superior, nome da faixa) do IMC, conforme a classificação geral da OMS
FAIXAS_IMC = ((18.5, 'abaixo do peso'), (25, 'peso adequado'), (30, 'sobrepeso'))


def inicio_semana(dia):
    """Segunda-feira da semana de `dia`."""
    return dia - timedelta(days=dia.weekday())


def _celulas(conn, inicio, quantidade, hoje):
    """`quantidade` dias seguidos a partir de `inicio`, marcando os que tiveram treino."""
    fim = inicio + timedelta(days=quantidade - 1)
    linhas = conn.execute(sql('consultas/dias_com_treino'), {'inicio': inicio.isoformat(), 'fim': fim.isoformat()})
    treinou = {linha['data'] for linha in linhas}
    celulas = []
    for i in range(quantidade):
        dia = inicio + timedelta(days=i)
        celulas.append({
            'data': dia.isoformat(),
            'treinou': dia.isoformat() in treinou,
            'futuro': dia > hoje,
            'hoje': dia == hoje,
        })
    return celulas


def sequencia_semanas(conn, meta, hoje):
    """Semanas seguidas em que a meta semanal foi cumprida.

    A semana atual conta se já cumpriu a meta; se ainda não cumpriu, a contagem
    começa na semana passada (a pessoa ainda tem tempo de cumprir).
    """
    if not meta:
        return 0
    dias_por_semana = {l['inicio_semana']: l['dias'] for l in conn.execute(sql('consultas/frequencia_semanal'))}
    semana = inicio_semana(hoje)
    total = 1 if dias_por_semana.get(semana.isoformat(), 0) >= meta else 0
    semana -= timedelta(days=7)
    while dias_por_semana.get(semana.isoformat(), 0) >= meta:
        total += 1
        semana -= timedelta(days=7)
    return total


def faixa_imc(imc):
    for limite, nome in FAIXAS_IMC:
        if imc < limite:
            return nome
    return 'obesidade'


def resumo_peso(conn, perfil):
    """Evolução do peso. Devolve None se ainda não há pesagens."""
    extremos = {l['quando']: l for l in conn.execute(sql('consultas/peso_extremos'))}
    if not extremos:
        return None
    inicial, atual = extremos['inicial'], extremos['atual']
    kg_inicial, kg_atual = inicial['peso_kg'], atual['peso_kg']

    ref = conn.execute(sql('consultas/peso_referencia_30_dias'), {'atual': atual['data']}).fetchone()

    imc = faixa = None
    altura = perfil['altura_cm']
    if altura and altura >= 100:
        imc = kg_atual / (altura / 100) ** 2
        faixa = faixa_imc(imc)

    meta = None
    alvo = perfil['meta_peso_kg']
    if alvo:
        sobe = alvo > kg_inicial
        atingida = kg_atual >= alvo if sobe else kg_atual <= alvo
        distancia = alvo - kg_inicial
        progresso = 1 if distancia == 0 else max(0, min(1, (kg_atual - kg_inicial) / distancia))
        meta = {
            'valor': alvo,
            'atingida': atingida,
            'progresso': 1 if atingida else round(progresso, 3),
            'falta': round(abs(kg_atual - alvo), 2),
        }

    return {
        'inicial': {'data': inicial['data'], 'kg': kg_inicial},
        'atual': {'data': atual['data'], 'kg': kg_atual},
        'total': round(kg_atual - kg_inicial, 2),
        'variacao30': round(kg_atual - ref['peso_kg'], 2) if ref else None,
        'imc': round(imc, 1) if imc is not None else None,
        'imcFaixa': faixa,
        'meta': meta,
        'nPesagens': atual['total'],
    }


def resumo(conn, perfil, hoje):
    """Tudo o que a tela inicial e a tela de peso precisam, calculado de uma vez."""
    inicio = inicio_semana(hoje)
    semana = _celulas(conn, inicio, 7, hoje)
    calendario = _celulas(conn, inicio - timedelta(days=28), 35, hoje)  # 5 semanas
    mes = conn.execute(sql('consultas/totais_mes'), {'hoje': hoje.isoformat()}).fetchone()
    return {
        'semana': semana,
        'diasNaSemana': sum(1 for c in semana if c['treinou']),
        'sequenciaSemanas': sequencia_semanas(conn, perfil['meta_semanal'], hoje),
        'mes': {'treinos': mes['treinos'], 'minutos': mes['minutos'], 'km': round(mes['km'], 1)},
        'calendario': calendario,
        'peso': resumo_peso(conn, perfil),
    }
