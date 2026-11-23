"""Testes do backend. Executar na raiz do projeto:  python -m unittest discover -s tests -v"""
import sqlite3
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend import banco, criar_app  # noqa: E402
from backend import metricas  # noqa: E402
from backend.validacao import ErroValidacao, validar_perfil, validar_peso, validar_treino  # noqa: E402


def dia(dias_atras=0):
    return (date.today() - timedelta(days=dias_atras)).isoformat()


class BaseApi(unittest.TestCase):
    """Cada teste usa um banco novo e vazio, em pasta temporária."""

    def setUp(self):
        self.pasta = tempfile.TemporaryDirectory()
        self.caminho = str(Path(self.pasta.name) / 'teste.db')
        self.app = criar_app(self.caminho, com_exemplo=False)
        self.c = self.app.test_client()

    def tearDown(self):
        self.pasta.cleanup()

    def estado(self):
        return self.c.get(f'/api/estado?hoje={dia()}').get_json()

    def treino(self, **extra):
        corpo = {'data': dia(), 'tipo': 'corrida', 'duracao': 30}
        corpo.update(extra)
        return self.c.post('/api/treinos', json=corpo)


class TestBanco(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(':memory:')
        self.conn.row_factory = sqlite3.Row
        self.conn.execute('PRAGMA foreign_keys = ON')
        self.conn.executescript(banco.sql('schema'))

    def tearDown(self):
        self.conn.close()

    def test_schema_pode_rodar_duas_vezes(self):
        self.conn.executescript(banco.sql('schema'))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM tipos_atividade').fetchone()[0], 7)
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM perfil').fetchone()[0], 1)

    def test_tipo_inexistente_e_recusado(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("INSERT INTO treinos (data, tipo, duracao_min) VALUES ('2026-01-01', 'xadrez', 30)")

    def test_uma_pesagem_por_dia(self):
        self.conn.execute("INSERT INTO pesagens (data, peso_kg) VALUES ('2026-01-01', 70)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("INSERT INTO pesagens (data, peso_kg) VALUES ('2026-01-01', 71)")

    def test_apagar_treino_apaga_exercicios(self):
        self.conn.execute("INSERT INTO treinos (id, data, tipo, duracao_min) VALUES (1, '2026-01-01', 'casa', 30)")
        self.conn.execute("INSERT INTO exercicios (treino_id, nome) VALUES (1, 'Prancha')")
        self.conn.execute('DELETE FROM treinos WHERE id = 1')
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM exercicios').fetchone()[0], 0)

    def test_exemplo_carrega_dados_coerentes(self):
        self.conn.executescript(banco.sql('exemplo'))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM pesagens').fetchone()[0], 10)
        self.assertGreater(self.conn.execute('SELECT COUNT(*) FROM treinos').fetchone()[0], 10)
        tipos = {l[0] for l in self.conn.execute('SELECT DISTINCT tipo FROM treinos')}
        self.assertTrue({'academia', 'casa', 'caminhada', 'corrida', 'danca'} <= tipos)
        self.assertGreater(self.conn.execute('SELECT COUNT(*) FROM exercicios').fetchone()[0], 0)
        ultima = self.conn.execute('SELECT data FROM pesagens ORDER BY data DESC LIMIT 1').fetchone()[0]
        self.assertEqual(ultima, date.today().isoformat())


class TestValidacao(unittest.TestCase):
    def test_treino_valido(self):
        t = validar_treino({'data': dia(), 'tipo': 'luta', 'duracao': '45'})
        self.assertEqual((t['tipo'], t['duracao'], t['distancia']), ('luta', 45, None))

    def test_treino_recusa_dados_ruins(self):
        ruins = [
            {'data': dia(), 'tipo': 'xadrez', 'duracao': 30},
            {'data': dia(), 'tipo': 'casa', 'duracao': 0},
            {'data': dia(), 'tipo': 'casa', 'duracao': 'abc'},
            {'data': dia(), 'tipo': 'casa', 'duracao': float('nan')},
            {'data': dia(-5), 'tipo': 'casa', 'duracao': 30},      # futuro
            {'data': '2026-13-45', 'tipo': 'casa', 'duracao': 30},
            {'data': dia(), 'tipo': 'casa', 'duracao': True},
            {'data': dia(), 'tipo': 'casa', 'duracao': 30, 'obs': 'x' * 141},
            {'data': dia(), 'tipo': 'corrida', 'duracao': 30, 'distanciaKm': 500},
            'texto solto',
        ]
        for dados in ruins:
            with self.subTest(dados=dados), self.assertRaises(ErroValidacao):
                validar_treino(dados)

    def test_virgula_decimal_e_exercicio_sem_nome(self):
        t = validar_treino({'data': dia(), 'tipo': 'academia', 'duracao': 40, 'distanciaKm': None,
                            'exercicios': [{'nome': ' Supino ', 'series': 3, 'reps': 10, 'carga': '32,5'},
                                           {'nome': '   '}]})
        self.assertEqual(len(t['exercicios']), 1)
        self.assertEqual(t['exercicios'][0]['nome'], 'Supino')
        self.assertEqual(t['exercicios'][0]['carga'], 32.5)

    def test_peso(self):
        self.assertEqual(validar_peso({'data': dia(), 'kg': '75,26'})['kg'], 75.3)
        for kg in (10, 500, '', None, 'x'):
            with self.subTest(kg=kg), self.assertRaises(ErroValidacao):
                validar_peso({'data': dia(), 'kg': kg})

    def test_perfil_ignora_campos_desconhecidos(self):
        d = validar_perfil({'nome': 'Ana', 'metaSemanal': 4, 'is_admin': True, 'idade': ''})
        self.assertEqual(d, {'nome': 'Ana', 'meta_semanal': 4, 'idade': None})


class TestMetricas(unittest.TestCase):
    def test_inicio_semana_e_segunda(self):
        for d in range(7):
            self.assertEqual(metricas.inicio_semana(date(2026, 11, 16) + timedelta(days=d)), date(2026, 11, 16))

    def test_faixas_imc(self):
        casos = {17: 'abaixo do peso', 18.5: 'peso adequado', 24.9: 'peso adequado',
                 25: 'sobrepeso', 29.9: 'sobrepeso', 30: 'obesidade'}
        for imc, faixa in casos.items():
            self.assertEqual(metricas.faixa_imc(imc), faixa, imc)


class TestApi(BaseApi):
    def test_banco_novo_vem_vazio_e_sem_exemplo(self):
        e = self.estado()
        self.assertFalse(e['demo'])
        self.assertEqual((e['treinos'], e['pesos']), ([], []))
        self.assertIsNone(e['resumo']['peso'])
        self.assertEqual(e['resumo']['mes']['treinos'], 0)
        self.assertEqual(len(e['resumo']['calendario']), 35)

    def test_banco_com_exemplo(self):
        pasta = tempfile.TemporaryDirectory()
        c = criar_app(str(Path(pasta.name) / 'x.db'), com_exemplo=True).test_client()
        e = c.get(f'/api/estado?hoje={dia()}').get_json()
        self.assertTrue(e['demo'])
        self.assertEqual(len(e['pesos']), 10)
        self.assertEqual(e['resumo']['peso']['nPesagens'], 10)
        self.assertLess(e['resumo']['peso']['total'], 0)
        pasta.cleanup()

    def test_criar_treino_com_exercicios_e_apagar(self):
        r = self.treino(tipo='academia', exercicios=[{'nome': 'Agachamento', 'series': 3, 'reps': 12, 'carga': 40}])
        self.assertEqual(r.status_code, 201)
        e = self.estado()
        self.assertEqual(e['treinos'][0]['exercicios'][0]['nome'], 'Agachamento')
        self.assertEqual(e['resumo']['diasNaSemana'], 1)
        self.assertEqual(self.c.delete(f"/api/treinos/{r.get_json()['id']}").status_code, 204)
        self.assertEqual(self.estado()['treinos'], [])
        self.assertEqual(self.c.delete('/api/treinos/999').status_code, 404)

    def test_treino_invalido_nao_grava_nada(self):
        r = self.treino(tipo='academia', exercicios=[{'nome': 'Ok', 'series': 3}, {'nome': 'Ruim', 'series': 999}])
        self.assertEqual(r.status_code, 400)
        self.assertIn('erro', r.get_json())
        self.assertEqual(self.estado()['treinos'], [])

    def test_json_malformado_vira_erro_400(self):
        r = self.c.post('/api/treinos', data='{nao é json', content_type='application/json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.c.get('/api/nao-existe').status_code, 404)

    def test_peso_um_por_dia_e_evolucao(self):
        for kg, d in ((80, 70), (79, 35), (78, 0)):
            self.assertEqual(self.c.put('/api/pesos', json={'data': dia(d), 'kg': kg}).status_code, 200)
        self.c.put('/api/pesos', json={'data': dia(0), 'kg': 77.5})  # mesmo dia: atualiza
        e = self.estado()
        self.assertEqual(len(e['pesos']), 3)
        p = e['resumo']['peso']
        self.assertEqual((p['inicial']['kg'], p['atual']['kg'], p['total']), (80, 77.5, -2.5))
        self.assertEqual(p['variacao30'], -1.5)  # referência: pesagem de 35 dias atrás (79)
        self.assertEqual(e['pesos'][0]['variacao'], -1.5)  # mais nova primeiro, comparada à anterior
        self.assertIsNone(e['pesos'][-1]['variacao'])

    def test_meta_e_imc(self):
        self.c.put('/api/perfil', json={'altura': 170, 'metaPeso': 70})
        self.c.put('/api/pesos', json={'data': dia(30), 'kg': 80})
        self.c.put('/api/pesos', json={'data': dia(0), 'kg': 75})
        p = self.estado()['resumo']['peso']
        self.assertEqual(p['imc'], 26.0)
        self.assertEqual(p['imcFaixa'], 'sobrepeso')
        self.assertEqual(p['meta']['falta'], 5)
        self.assertEqual(p['meta']['progresso'], 0.5)
        self.assertFalse(p['meta']['atingida'])
        self.c.put('/api/pesos', json={'data': dia(0), 'kg': 69})
        self.assertTrue(self.estado()['resumo']['peso']['meta']['atingida'])

    def test_meta_para_ganhar_peso(self):
        self.c.put('/api/perfil', json={'metaPeso': 55})
        self.c.put('/api/pesos', json={'data': dia(40), 'kg': 50})
        self.c.put('/api/pesos', json={'data': dia(0), 'kg': 52})
        meta = self.estado()['resumo']['peso']['meta']
        self.assertEqual((meta['falta'], meta['progresso']), (3, 0.4))

    def test_sequencia_de_semanas_na_meta(self):
        self.c.put('/api/perfil', json={'metaSemanal': 2})
        inicio = date.today() - timedelta(days=date.today().weekday())
        # as 3 semanas anteriores cumprem a meta (2 dias cada); a semana atual não treinou
        for semana in (1, 2, 3):
            for extra in (0, 2):
                self.treino(data=(inicio - timedelta(days=7 * semana) + timedelta(days=extra)).isoformat())
        self.assertEqual(self.estado()['resumo']['sequenciaSemanas'], 3)
        # uma semana sem treino quebra a sequência: só a semana 1 (a mais recente) conta
        self.c.post('/api/limpar')
        self.c.put('/api/perfil', json={'metaSemanal': 2})
        for semana in (1, 3):
            for extra in (0, 2):
                self.treino(data=(inicio - timedelta(days=7 * semana) + timedelta(days=extra)).isoformat())
        self.assertEqual(self.estado()['resumo']['sequenciaSemanas'], 1)

    def test_totais_do_mes(self):
        hoje = date.today()
        self.treino(data=hoje.isoformat(), duracao=30, tipo='caminhada', distanciaKm=2.5)
        self.treino(data=hoje.isoformat(), duracao=20, tipo='corrida', distanciaKm=1.5)
        self.assertEqual(self.estado()['resumo']['mes'], {'treinos': 2, 'minutos': 50, 'km': 4.0})

    def test_perfil_salva_e_limpa_campo(self):
        self.c.put('/api/perfil', json={'nome': 'Maria', 'idade': 70, 'letraGrande': True})
        e = self.estado()
        self.assertEqual((e['perfil']['nome'], e['perfil']['idade'], e['letraGrande']), ('Maria', 70, True))
        self.c.put('/api/perfil', json={'idade': ''})
        self.assertEqual(self.estado()['perfil']['idade'], '')
        self.assertEqual(self.c.put('/api/perfil', json={'altura': 50}).status_code, 400)

    def test_limpar_apaga_tudo(self):
        self.treino()
        self.c.put('/api/pesos', json={'data': dia(), 'kg': 70})
        self.c.put('/api/perfil', json={'nome': 'Ana'})
        self.c.post('/api/limpar')
        e = self.estado()
        self.assertEqual((e['treinos'], e['pesos'], e['perfil']['nome']), ([], [], ''))

    def test_injecao_de_sql_nao_funciona(self):
        r = self.treino(obs="'); DROP TABLE treinos; --")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.estado()['treinos'][0]['obs'], "'); DROP TABLE treinos; --")

    def test_front_end_e_servido(self):
        with self.c.get('/') as r:
            self.assertEqual(r.status_code, 200)
            self.assertIn('Corpo em Dia', r.get_data(as_text=True))
        with self.c.get('/js/app.js') as r:
            self.assertEqual(r.status_code, 200)


if __name__ == '__main__':
    unittest.main()
