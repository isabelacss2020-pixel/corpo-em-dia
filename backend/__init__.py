"""Corpo em Dia: backend em Python (Flask) com banco de dados SQLite."""
from pathlib import Path

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from . import banco
from .rotas import bp

RAIZ = Path(__file__).resolve().parent.parent


def criar_app(banco_caminho=None, com_exemplo=True):
    """Monta a aplicação: cria o banco (se preciso), registra a API e serve a pasta web/."""
    app = Flask(__name__, static_folder=str(RAIZ / 'web'), static_url_path='')
    app.config['BANCO'] = str(banco_caminho or banco.caminho_padrao())
    app.config['MAX_CONTENT_LENGTH'] = 200_000  # corpo máximo de uma requisição (bytes)

    banco.inicializar(app.config['BANCO'], com_exemplo)
    app.register_blueprint(bp)

    @app.get('/')
    def inicio():
        return app.send_static_file('index.html')

    @app.errorhandler(HTTPException)
    def erro_http(e):
        # Na API, os erros também saem em JSON, no mesmo formato dos erros de validação.
        if request.path.startswith('/api/'):
            return jsonify(erro=e.description), e.code
        return e

    @app.after_request
    def cabecalhos(resp):
        resp.headers['X-Content-Type-Options'] = 'nosniff'
        if request.path.startswith('/api/'):
            resp.headers['Cache-Control'] = 'no-store'
        return resp

    return app
