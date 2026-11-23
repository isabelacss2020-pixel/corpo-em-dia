/* ==========================================================
   Corpo em Dia — conversa com o backend (Python/Flask)
   Todas as chamadas usam endereços relativos ("api/..."), então funcionam
   em qualquer porta ou pasta onde o servidor estiver.
   ========================================================== */

const Api = {
  /** Faz a chamada e devolve o JSON. Em caso de erro, lança Error com mensagem pronta para a pessoa. */
  async chamar(metodo, caminho, corpo) {
    const opcoes = { method: metodo };
    if (corpo !== undefined) {
      opcoes.headers = { 'Content-Type': 'application/json' };
      opcoes.body = JSON.stringify(corpo);
    }

    let resposta;
    try {
      resposta = await fetch(caminho, opcoes);
    } catch (e) {
      const erro = new Error('Sem conexão com o servidor.');
      erro.semServidor = true;
      throw erro;
    }

    if (resposta.status === 204) return null;
    let dados = null;
    try {
      dados = await resposta.json();
    } catch (e) {
      /* resposta sem JSON: cai na mensagem padrão abaixo */
    }
    if (!resposta.ok) {
      throw new Error((dados && dados.erro) || 'Algo deu errado. Tente de novo.');
    }
    return dados;
  },

  estado: () => Api.chamar('GET', 'api/estado?hoje=' + Datas.hoje()),
  criarTreino: (treino) => Api.chamar('POST', 'api/treinos', treino),
  apagarTreino: (id) => Api.chamar('DELETE', 'api/treinos/' + encodeURIComponent(id)),
  salvarPeso: (data, kg) => Api.chamar('PUT', 'api/pesos', { data, kg }),
  apagarPeso: (id) => Api.chamar('DELETE', 'api/pesos/' + encodeURIComponent(id)),
  salvarPerfil: (campos) => Api.chamar('PUT', 'api/perfil', campos),
  limpar: () => Api.chamar('POST', 'api/limpar'),
};
