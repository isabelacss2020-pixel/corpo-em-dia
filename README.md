# Corpo em Dia

Aplicativo web simples para controle pessoal de **treinos e atividades físicas** e acompanhamento da **frequência** e da **evolução do peso** ao longo do tempo.

Projeto comunitário, gratuito e sem fins lucrativos. Desenvolvido como trabalho da faculdade de Gestão de TI.

## Tecnologias

| Camada | Tecnologia | Papel |
| --- | --- | --- |
| Banco de dados | **SQLite + SQL** | tabelas, regras de integridade e consultas de frequência e peso |
| Backend | **Python 3 + Flask** | API em JSON, validação dos dados e regras de negócio |
| Front-end | HTML, CSS e JavaScript puros | telas simples para pessoas idosas e de pouca leitura |

O JavaScript só desenha as telas. Validação, regras e cálculos ficam no Python e no SQL.

## Funcionalidades

- **Tipos de atividade**: academia, em casa, caminhada, corrida, luta, dança e outros.
- **Registro rápido**: tipo, tempo e dia. Exercícios (séries, vezes e carga), distância e anotação são opcionais.
- **Frequência**: dias treinados na semana, meta semanal, semanas seguidas na meta, totais do mês e calendário das últimas 5 semanas.
- **Evolução do peso**: gráfico, variação desde a primeira pesagem e nos últimos 30 dias, progresso até a meta e IMC (como referência).
- **Acessibilidade**: ícones junto das palavras, frases curtas, botões grandes, botões − e +, botão "A+" de letra grande, confirmação antes de apagar, tema claro e escuro.

## Como executar

Requisitos: Python 3.9 ou mais novo.

```bash
python -m venv .venv
source .venv/bin/activate        # no Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Abra **http://127.0.0.1:8000** no navegador.

Na primeira execução o banco é criado em `data/corpo_em_dia.db` com **dados de exemplo**. O botão "Começar do zero" no app apaga os exemplos. Opções úteis:

```bash
python app.py --sem-exemplo        # banco novo, vazio
python app.py --banco meu.db       # usa outro arquivo de banco
python app.py --porta 9000
```

### Testes

```bash
python -m unittest discover -s tests -v
```

Os testes cobrem o esquema SQL (restrições e exemplo), a validação, as regras de negócio e todas as rotas da API.

## Modelo de dados

```
perfil (1 linha)        tipos_atividade
                              ▲
                              │ tipo
pesagens             treinos ──┴── exercicios
(data única)         (data, tipo,   (treino_id, nome, séries,
                      duração, km)   repetições, carga)
```

Arquivo completo em [`sql/schema.sql`](sql/schema.sql). Pontos de SQL usados:

- `CHECK` para limites de idade, peso, duração e formato de data.
- `FOREIGN KEY` para o tipo de atividade, e `ON DELETE CASCADE` para apagar os exercícios junto com o treino.
- `UNIQUE` na data da pesagem, com **UPSERT** (`ON CONFLICT DO UPDATE`) para atualizar o peso do mesmo dia.
- Função de janela `LAG()` para a diferença entre pesagens ([`evolucao_peso.sql`](sql/consultas/evolucao_peso.sql)).
- `GROUP BY` por semana ([`frequencia_semanal.sql`](sql/consultas/frequencia_semanal.sql)).
- CTE recursiva para gerar os dias de exemplo ([`exemplo.sql`](sql/exemplo.sql)).
- Consultas sempre com **parâmetros** (`:nome`), nunca com texto montado à mão.

Para explorar o banco pelo terminal:

```bash
sqlite3 data/corpo_em_dia.db
sqlite> .read sql/consultas/frequencia_semanal.sql
```

## API

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/estado?hoje=AAAA-MM-DD` | tudo para desenhar as telas: perfil, treinos, pesos e resumo calculado |
| POST | `/api/treinos` | cria um treino (com exercícios) |
| DELETE | `/api/treinos/<id>` | apaga um treino |
| PUT | `/api/pesos` | salva o peso de um dia |
| DELETE | `/api/pesos/<id>` | apaga uma pesagem |
| PUT | `/api/perfil` | atualiza só os campos enviados |
| POST | `/api/limpar` | apaga todos os dados |
| GET | `/api/saude` | verificação simples de que o servidor está no ar |

Erros de validação voltam com status 400 e `{"erro": "mensagem em português"}`.

## Estrutura do projeto

```
corpo-em-dia/
├── app.py                 # inicia o servidor no seu computador
├── wsgi.py                # entrada para servidores de produção (gunicorn)
├── render.yaml            # configuração de publicação no Render
├── requirements.txt
├── LICENSE
├── backend/
│   ├── __init__.py        # cria a aplicação Flask
│   ├── banco.py           # conexão SQLite e leitura dos arquivos .sql
│   ├── validacao.py       # regras dos dados recebidos
│   ├── metricas.py        # frequência, sequência de semanas, peso e IMC
│   └── rotas.py           # rotas da API
├── sql/
│   ├── schema.sql         # tabelas e restrições
│   ├── exemplo.sql        # dados de exemplo
│   ├── consultas/         # SELECTs (leitura)
│   └── comandos/          # INSERT, UPSERT e DELETE (escrita)
├── tests/
│   └── test_backend.py
└── web/                   # front-end servido pelo Flask
    ├── index.html
    ├── css/style.css
    └── js/ (api.js, datas.js, graficos.js, app.js)
```

## Decisões de projeto

- **SQL em arquivos `.sql`** separados do Python: quem conhece SQL lê e altera as consultas sem mexer no código.
- **Validação em duas camadas**: o Python devolve mensagens claras para a pessoa, e o banco (`CHECK`) garante que dado inválido nunca seja gravado.
- **Escritas em transação**: um treino e seus exercícios são gravados juntos ou não são gravados.
- **Sem etapa de build** no front-end, para facilitar a manutenção por voluntários.
- Textos digitados pelo usuário são escapados antes de ir para a tela.

## Publicar na internet (demonstração)

O projeto já vem pronto para o [Render](https://render.com), que tem plano gratuito para Python.

1. Crie uma conta no Render e conecte a sua conta do GitHub.
2. No painel, clique em **New +** e depois em **Blueprint**. Escolha este repositório. O Render lê o arquivo `render.yaml` e configura tudo.
3. Aguarde o serviço ficar **Live** e copie o endereço (algo como `https://corpo-em-dia-xxxx.onrender.com`).

Se preferir configurar à mão, em **New + → Web Service** use: *Build Command* `pip install -r requirements.txt gunicorn`, *Start Command* `gunicorn wsgi:app --workers 1 --threads 4 --bind 0.0.0.0:$PORT` e plano **Free**.

Como o plano gratuito funciona (segundo a [documentação do Render](https://render.com/docs/free)):

- Depois de **15 minutos sem acessos** o serviço "dorme". O primeiro acesso seguinte demora **cerca de 1 minuto** para acordar.
- O arquivo do banco SQLite **é apagado** a cada reinício. Na versão publicada, os dados voltam aos de exemplo depois que o serviço dorme.
- Todas as pessoas que abrem o endereço veem e alteram **o mesmo banco**.

Por isso a versão publicada serve para **demonstração**. Para guardar dados de verdade, o próximo passo seria usar um banco que não seja apagado (por exemplo, PostgreSQL) e contas de usuário.

## Limitações

- Cada instalação guarda **um único perfil**. Para uso comunitário, cada pessoa roda a sua cópia, ou o projeto evolui para ter contas de usuário.
- O servidor do Flask (`python app.py`) serve para uso local. Na internet, o app usa o `gunicorn`, e o acesso ainda deveria ser protegido por login.
- O **GitHub Pages não executa Python**: no GitHub ficam o código e a documentação.

## Próximos passos possíveis

- Contas de usuário e login.
- Banco de dados permanente na versão publicada.
- Exportar e importar os dados (backup).
- Lembretes para treinar e pesar.

## Aviso

O app é apenas um diário de acompanhamento. O IMC e as demais informações são referências gerais e não substituem a avaliação de profissionais de educação física ou de saúde.

## Licença

Distribuído sob a licença MIT. Veja o arquivo [`LICENSE`](LICENSE).

Autora: Isabela de Carvalho Sá Santana.
