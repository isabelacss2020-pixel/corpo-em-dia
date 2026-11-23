"""Entrada para servidores de produção (gunicorn, Render etc.).

Uso:  gunicorn wsgi:app
Para rodar no seu computador, continue usando:  python app.py
"""
from backend import criar_app

app = criar_app()
