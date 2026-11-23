"""Ponto de entrada. Uso: python app.py  (depois abra http://127.0.0.1:8000)."""
import argparse

from backend import criar_app


def main():
    ap = argparse.ArgumentParser(description='Corpo em Dia: servidor local.')
    ap.add_argument('--host', default='127.0.0.1', help='endereço (padrão: só este computador)')
    ap.add_argument('--porta', type=int, default=8000, help='porta (padrão: 8000)')
    ap.add_argument('--banco', help='arquivo do banco SQLite (padrão: data/corpo_em_dia.db)')
    ap.add_argument('--sem-exemplo', action='store_true', help='cria o banco vazio, sem dados de exemplo')
    args = ap.parse_args()

    app = criar_app(banco_caminho=args.banco, com_exemplo=not args.sem_exemplo)
    app.run(host=args.host, port=args.porta)


if __name__ == '__main__':
    main()
