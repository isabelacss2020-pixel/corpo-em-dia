/* ==========================================================
   Corpo em Dia — interface (telas, formulários e eventos)
   Pensado para pessoas idosas e de pouca leitura: ícones, botões grandes,
   poucas palavras e poucos passos.

   Esta camada só desenha as telas e envia o que a pessoa digitou. Validação,
   regras e cálculos acontecem no backend (Python) e no banco (SQL).
   ========================================================== */
(function () {
  'use strict';

  const tela = document.getElementById('tela');
  const statusEl = document.getElementById('status');
  const btnLetra = document.getElementById('btn-letra');
  const raiz = document.documentElement;

  const TIPOS = {
    academia: { nome: 'Academia', icone: 'i-academia' },
    casa: { nome: 'Em casa', icone: 'i-casa' },
    caminhada: { nome: 'Caminhada', icone: 'i-caminhada' },
    corrida: { nome: 'Corrida', icone: 'i-corrida' },
    luta: { nome: 'Luta', icone: 'i-luta' },
    danca: { nome: 'Dança', icone: 'i-danca' },
    outros: { nome: 'Outros', icone: 'i-outros' },
  };
  const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const ABAS = ['inicio', 'treinos', 'peso', 'perfil'];

  let dados = null; // último estado recebido do servidor
  let falhaConexao = false;
  let tipoForm = null; // tipo escolhido no formulário de treino
  let confirmando = null; // "treino:ID", "peso:ID" ou "tudo"

  /* ---------- utilidades ---------- */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt0 = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const fmt1 = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ic = (id, cls) => `<svg class="ic ${cls || ''}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
  const porId = (id) => document.getElementById(id);
  const campoNum = (v) => {
    const t = String(v == null ? '' : v).trim().replace(',', '.');
    const n = Number(t);
    return t === '' || isNaN(n) ? null : n;
  };

  function avisar(msg, ruim) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('ruim', !!ruim);
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => (statusEl.textContent = ''), 6000);
    window.scrollTo(0, 0);
  }

  function rotuloData(s) {
    const hoje = Datas.hoje();
    if (s === hoje) return 'Hoje';
    if (s === Datas.somar(hoje, -1)) return 'Ontem';
    const dow = (Datas.parse(s).getDay() + 6) % 7;
    return DIAS[dow] + ', ' + Datas.brCurta(s);
  }

  function aplicarLetra() {
    const grande = !!(dados && dados.letraGrande);
    raiz.classList.toggle('grande', grande);
    btnLetra.setAttribute('aria-pressed', String(grande));
  }

  function bannerDemo() {
    if (!dados.demo) return '';
    return `<div class="aviso-demo">
      <p>Dados de exemplo</p>
      <button type="button" class="btn btn-sec" data-acao="limpar-exemplo">Começar do zero</button>
    </div>`;
  }

  /* ---------- peças reutilizáveis ---------- */
  /** Campo numérico grande com botões − e +. */
  function passo(o) {
    return `<div class="passo">
      <button type="button" class="pbtn" data-acao="passo" data-alvo="${o.id}" data-delta="${-o.delta}" aria-label="Menos">${ic('i-menos')}</button>
      <div class="valor">
        <input id="${o.id}" name="${o.name}" type="number" inputmode="decimal" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.valor}" placeholder="${o.placeholder || ''}" aria-label="${o.rotulo}"${o.primeiro ? ` data-primeiro="${o.primeiro}"` : ''}${o.zeroVazio ? ' data-zero-vazio="1"' : ''}>
        <span class="un">${o.unidade}</span>
      </div>
      <button type="button" class="pbtn" data-acao="passo" data-alvo="${o.id}" data-delta="${o.delta}" aria-label="Mais">${ic('i-mais')}</button>
    </div>`;
  }

  /** Escolha do dia: Hoje, Ontem ou Outro dia. */
  function seletorQuando() {
    const hoje = Datas.hoje();
    const op = (v, t, marcado) => `<label class="chip"><input type="radio" name="quando" value="${v}" ${marcado ? 'checked' : ''}><span>${t}</span></label>`;
    return `<div class="bloco" role="group" aria-label="Quando?">
      <h3 class="pergunta">Quando?</h3>
      <div class="chips">${op('hoje', 'Hoje', true)}${op('ontem', 'Ontem')}${op('outro', 'Outro dia')}</div>
      <input type="date" name="data-outro" class="data-outro" max="${hoje}" value="${hoje}" aria-label="Escolha o dia" hidden>
    </div>`;
  }

  function lerQuando(form) {
    const q = form.elements.quando.value;
    const hoje = Datas.hoje();
    if (q === 'ontem') return Datas.somar(hoje, -1);
    if (q === 'outro') return form.elements['data-outro'].value;
    return hoje;
  }

  function botaoApagar(tipo, id) {
    const chave = tipo + ':' + id;
    if (confirmando === chave) {
      return `<div class="confirma"><strong>Apagar?</strong>
        <button type="button" class="btn btn-perigo" data-acao="apagar-sim" data-tipo="${tipo}" data-id="${esc(id)}">Sim</button>
        <button type="button" class="btn btn-sec" data-acao="apagar-nao">Não</button></div>`;
    }
    return `<button type="button" class="btn-apagar" data-acao="apagar-pedir" data-tipo="${tipo}" data-id="${esc(id)}">${ic('i-lixo')} Apagar</button>`;
  }

  function tendencia(pr) {
    if (pr.nPesagens < 2) return '<p class="tendencia">Pese-se de novo para ver a evolução.</p>';
    const desde = Datas.brCurta(pr.inicial.data);
    if (Math.abs(pr.total) < 0.05) return `<p class="tendencia">${ic('i-igual')} <span>Igual <small>desde ${desde}</small></span></p>`;
    const desceu = pr.total < 0;
    return `<p class="tendencia">${ic(desceu ? 'i-baixo' : 'i-cima')} <span>${desceu ? 'Desceu' : 'Subiu'} ${fmt1(Math.abs(pr.total))} kg <small>desde ${desde}</small></span></p>`;
  }

  /* ---------- tela: início ---------- */
  function telaInicio() {
    const r = dados.resumo;
    const meta = Number(dados.perfil.metaSemanal) || 0;
    const feitos = r.diasNaSemana;
    const pct = meta ? Math.min(100, Math.round((feitos / meta) * 100)) : 0;
    const seq = r.sequenciaSemanas;
    const pr = r.peso;
    const nome = dados.perfil.nome;

    const diasHtml = r.semana
      .map((d, i) => {
        const txt = d.treinou ? 'treinou' : d.futuro ? 'ainda não chegou' : 'sem treino';
        return `<li class="dia ${d.hoje ? 'hoje' : ''} ${d.futuro ? 'futuro' : ''}" aria-label="${DIAS[i]}: ${txt}">
          <span class="dia-nome">${DIAS[i]}</span>
          <span class="dia-bola ${d.treinou ? 'feito' : ''}">${d.treinou ? ic('i-check') : ''}</span>
        </li>`;
      })
      .join('');

    const pesoHtml = pr
      ? `<p class="grande"><span class="num">${fmt1(pr.atual.kg)}</span> kg</p>${tendencia(pr)}`
      : '<p class="vazio">Sem peso registrado.</p>';

    return `${bannerDemo()}
      ${nome ? `<h2 class="ola">Olá, ${esc(nome)}</h2>` : ''}
      <a class="btn btn-grande cheio" href="#treinos">${ic('i-mais')} Registrar treino</a>

      <section class="cartao destaque" aria-labelledby="h-semana">
        <h2 id="h-semana">Esta semana</h2>
        <p class="grande"><span class="num">${feitos}</span> ${meta ? 'de ' + meta + ' dias' : 'dias'}</p>
        ${meta ? `<div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Meta da semana"><span style="width:${pct}%"></span></div>` : ''}
        <ol class="dias">${diasHtml}</ol>
        ${meta && feitos >= meta ? `<p class="parabens">${ic('i-check')} Meta cumprida!</p>` : ''}
      </section>

      <section class="metricas" aria-label="Resumo">
        <div class="metrica">${ic('i-calendario', 'ic-g')}<strong>${r.mes.treinos}</strong><span>treinos neste mês</span></div>
        <div class="metrica">${ic('i-chama', 'ic-g')}<strong>${seq}</strong><span>${seq === 1 ? 'semana seguida' : 'semanas seguidas'}</span></div>
      </section>

      <section class="cartao" aria-labelledby="h-peso">
        <h2 id="h-peso">Seu peso</h2>
        ${pesoHtml}
        <a class="btn btn-sec btn-grande cheio" href="#peso">${ic('i-peso')} Registrar peso</a>
      </section>

      <section class="cartao" aria-labelledby="h-freq">
        <h2 id="h-freq">Últimas 5 semanas</h2>
        <div class="calendario" role="img" aria-label="${r.calendario.filter((c) => c.treinou).length} dias com treino nas últimas 5 semanas">
          ${DIAS.map((d) => `<span class="cab">${d}</span>`).join('')}
          ${r.calendario.map((c) => `<span class="cel ${c.treinou ? 'feito' : ''} ${c.futuro ? 'futuro' : ''} ${c.hoje ? 'hoje' : ''}">${Number(c.data.slice(8))}</span>`).join('')}
        </div>
        <p class="legenda"><span class="amostra"></span> Dia com treino</p>
      </section>`;
  }

  /* ---------- tela: treinos ---------- */
  function linhaExercicio() {
    return `<div class="ex-linha">
      <label class="campo ex-nome"><span>Exercício</span><input type="text" name="ex-nome" list="lista-ex" maxlength="60"></label>
      <label class="campo"><span>Séries</span><input type="number" name="ex-series" min="1" max="20" inputmode="numeric"></label>
      <label class="campo"><span>Vezes</span><input type="number" name="ex-reps" min="1" max="200" inputmode="numeric"></label>
      <label class="campo"><span>Kg</span><input type="number" name="ex-carga" min="0" max="500" step="0.5" inputmode="decimal"></label>
      <button type="button" class="btn-icone" data-acao="remover-linha" aria-label="Tirar exercício">${ic('i-lixo')}</button>
    </div>`;
  }

  function formTreino() {
    const tiles = Object.keys(TIPOS)
      .map(
        (k) => `<label class="tile t-${k}"><input type="radio" name="tipo" value="${k}" ${k === tipoForm ? 'checked' : ''}>
          <span class="tile-corpo">${ic(TIPOS[k].icone, 'ic-g')}<span>${TIPOS[k].nome}</span></span></label>`
      )
      .join('');

    return `<form id="form-treino" class="cartao" novalidate>
      <h2 class="pergunta">O que você fez?</h2>
      <div class="tipos">${tiles}</div>

      <div id="passos" class="passos" hidden>
        <div class="bloco">
          <h3 class="pergunta">Quanto tempo?</h3>
          ${passo({ id: 'in-dur', name: 'duracao', valor: 30, min: 5, max: 600, step: 5, delta: 5, unidade: 'min', rotulo: 'Minutos' })}
          <div class="chips">${[15, 30, 45, 60].map((v) => `<button type="button" class="chip-btn" data-acao="dur" data-v="${v}" aria-pressed="false">${v} min</button>`).join('')}</div>
        </div>

        <div class="bloco" data-tipos="caminhada corrida" hidden>
          <h3 class="pergunta">Quantos km? <small>Se souber</small></h3>
          ${passo({ id: 'in-km', name: 'distancia', valor: '', min: 0, max: 100, step: 0.5, delta: 0.5, unidade: 'km', rotulo: 'Quilômetros', zeroVazio: true, placeholder: '—' })}
        </div>

        ${seletorQuando()}

        <details class="mais">
          <summary>Mais detalhes</summary>
          <div data-tipos="academia casa" hidden>
            <div id="linhas-ex">${linhaExercicio()}</div>
            <button type="button" class="btn btn-sec" data-acao="add-linha">${ic('i-mais')} Exercício</button>
            <datalist id="lista-ex">
              ${['Agachamento', 'Supino reto', 'Remada baixa', 'Leg press', 'Puxada frontal', 'Flexão de braço', 'Abdominal', 'Prancha', 'Afundo', 'Polichinelo'].map((n) => `<option value="${n}">`).join('')}
            </datalist>
          </div>
          <label class="campo"><span>Anotação</span><input type="text" name="obs" maxlength="140"></label>
        </details>

        <p class="erro" id="erro-treino" role="alert"></p>
        <button type="submit" class="btn btn-grande cheio">${ic('i-check')} Salvar</button>
      </div>
    </form>`;
  }

  function htmlHistorico() {
    const lista = dados.treinos;
    if (!lista.length) return '<p class="vazio">Nenhum treino ainda.</p>';
    return (
      '<ul class="lista">' +
      lista
        .slice(0, 20)
        .map((t) => {
          const tipo = TIPOS[t.tipo] || TIPOS.outros;
          const info = (t.duracao ? t.duracao + ' min' : '') + (t.distanciaKm ? ' · ' + fmt1(t.distanciaKm) + ' km' : '');
          const exs = t.exercicios && t.exercicios.length
            ? `<details class="mais"><summary>Ver exercícios</summary><ul class="exs">${t.exercicios.map((e) => `<li>${esc(e.nome)} <span>${e.series}×${e.reps}${e.carga ? ' · ' + fmt0(e.carga) + ' kg' : ''}</span></li>`).join('')}</ul></details>`
            : '';
          return `<li class="item t-${esc(t.tipo)}">
            <div class="item-linha">
              <span class="item-icone">${ic(tipo.icone, 'ic-m')}</span>
              <div class="item-texto"><strong>${tipo.nome}</strong><span>${rotuloData(t.data)}</span></div>
              <span class="item-valor">${info}</span>
            </div>
            ${t.obs ? `<p class="obs">${esc(t.obs)}</p>` : ''}
            ${exs}
            ${botaoApagar('treino', t.id)}
          </li>`;
        })
        .join('') +
      '</ul>'
    );
  }

  function telaTreinos() {
    return `${bannerDemo()}
      ${formTreino()}
      <section aria-labelledby="h-hist">
        <h2 id="h-hist" class="titulo-lista">Seus treinos</h2>
        <div id="historico">${htmlHistorico()}</div>
      </section>`;
  }

  /* ---------- tela: peso ---------- */
  function htmlListaPesos() {
    if (!dados.pesos.length) return '';
    const itens = dados.pesos.slice(0, 30).map((p) => {
      const dif = p.variacao;
      const seta = dif === null ? '' : Math.abs(dif) < 0.05 ? `${ic('i-igual', 'ic-p')} igual` : `${ic(dif < 0 ? 'i-baixo' : 'i-cima', 'ic-p')} ${fmt1(Math.abs(dif))}`;
      return `<li class="item">
        <div class="item-linha">
          <div class="item-texto"><strong class="kg">${fmt1(p.kg)} kg</strong><span>${rotuloData(p.data)}</span></div>
          <span class="item-valor">${seta}</span>
        </div>
        ${botaoApagar('peso', p.id)}
      </li>`;
    });
    return `<ul class="lista">${itens.join('')}</ul>`;
  }

  function telaPeso() {
    const pr = dados.resumo.peso;
    const metaNum = Number(dados.perfil.metaPeso) || null;
    const ultimo = pr ? pr.atual.kg : '';

    let evolucao = '';
    if (pr) {
      const metaHtml = pr.meta
        ? pr.meta.atingida
          ? `<p class="parabens">${ic('i-check')} Meta alcançada!</p>`
          : `<p>Faltam <strong>${fmt1(pr.meta.falta)} kg</strong> para a meta</p>
             <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pr.meta.progresso * 100)}" aria-label="Caminho até a meta"><span style="width:${Math.round(pr.meta.progresso * 100)}%"></span></div>`
        : '';
      const imc = pr.imc !== null
        ? `<details class="mais"><summary>Ver IMC</summary><p>IMC <strong>${fmt1(pr.imc)}</strong> · ${esc(pr.imcFaixa)}</p><p class="legenda">Valor de referência. Converse com um profissional de saúde.</p></details>`
        : '';
      const crescente = [...dados.pesos].reverse(); // o servidor manda do mais novo para o mais antigo
      evolucao = `<section class="cartao" aria-labelledby="h-evo">
        <h2 id="h-evo">Sua evolução</h2>
        <p class="grande"><span class="num">${fmt1(pr.atual.kg)}</span> kg</p>
        ${tendencia(pr)}
        ${metaHtml}
        ${crescente.length >= 2 ? Graficos.linhaPeso(crescente, metaNum) : ''}
        ${imc}
      </section>`;
    }

    return `${bannerDemo()}
      <form id="form-peso" class="cartao" novalidate>
        <h2 class="pergunta">Quanto você pesa?</h2>
        ${passo({ id: 'in-kg', name: 'kg', valor: ultimo, min: 20, max: 400, step: 0.1, delta: 0.1, unidade: 'kg', rotulo: 'Peso em quilos', primeiro: 70, placeholder: '0,0' })}
        <div class="chips">
          <button type="button" class="chip-btn" data-acao="passo" data-alvo="in-kg" data-delta="-1">${ic('i-menos', 'ic-p')} 1 kg</button>
          <button type="button" class="chip-btn" data-acao="passo" data-alvo="in-kg" data-delta="1">${ic('i-mais', 'ic-p')} 1 kg</button>
        </div>
        ${seletorQuando()}
        <p class="erro" id="erro-peso" role="alert"></p>
        <button type="submit" class="btn btn-grande cheio">${ic('i-check')} Salvar</button>
      </form>
      ${evolucao}
      <section aria-labelledby="h-pesagens">
        ${dados.pesos.length ? '<h2 id="h-pesagens" class="titulo-lista">Seus pesos</h2>' : ''}
        <div id="lista-pesos">${htmlListaPesos()}</div>
      </section>`;
  }

  /* ---------- tela: perfil ---------- */
  function htmlApagar() {
    if (confirmando === 'tudo') {
      return `<div class="confirma"><strong>Apagar tudo?</strong>
        <button type="button" class="btn btn-perigo" data-acao="apagar-sim" data-tipo="tudo" data-id="tudo">Sim</button>
        <button type="button" class="btn btn-sec" data-acao="apagar-nao">Não</button></div>`;
    }
    return `<button type="button" class="btn btn-perigo" data-acao="apagar-pedir" data-tipo="tudo" data-id="tudo">${ic('i-lixo')} Apagar meus dados</button>`;
  }

  function telaPerfil() {
    const p = dados.perfil;
    return `${bannerDemo()}
      <form id="form-perfil" class="cartao" novalidate>
        <h2 class="pergunta">Meus dados</h2>
        <label class="campo"><span>Nome</span><input type="text" name="nome" maxlength="40" value="${esc(p.nome)}" autocomplete="given-name"></label>
        <div class="grade-campos">
          <label class="campo"><span>Idade</span><input type="number" name="idade" min="10" max="120" inputmode="numeric" value="${esc(p.idade)}"></label>
          <label class="campo"><span>Altura (cm)</span><input type="number" name="altura" min="100" max="250" inputmode="numeric" value="${esc(p.altura)}"></label>
          <label class="campo"><span>Peso que quero (kg)</span><input type="number" name="metaPeso" min="20" max="400" step="0.1" inputmode="decimal" value="${esc(p.metaPeso)}"></label>
        </div>
        <div class="bloco">
          <h3 class="pergunta">Treinar por semana</h3>
          ${passo({ id: 'in-meta', name: 'metaSemanal', valor: Number(p.metaSemanal) || 3, min: 1, max: 7, step: 1, delta: 1, unidade: 'dias', rotulo: 'Dias por semana' })}
        </div>
        <p class="erro" id="erro-perfil" role="alert"></p>
        <button type="submit" class="btn btn-grande cheio">${ic('i-check')} Salvar</button>
      </form>
      <section class="cartao" id="zona-apagar">${htmlApagar()}</section>
      <p class="legenda">Seus dados ficam guardados no banco de dados deste computador. Este app não substitui orientação de profissionais de saúde.</p>`;
  }

  /* ---------- telas de espera e de falha ---------- */
  function telaCarregando() {
    return '<p class="vazio" role="status">Carregando…</p>';
  }

  function telaFalha() {
    return `<section class="cartao">
      <h2 class="pergunta">Sem conexão</h2>
      <p>O app não encontrou o servidor. Abra o terminal na pasta do projeto e rode:</p>
      <p><code>python app.py</code></p>
      <button type="button" class="btn btn-grande cheio" data-acao="tentar-de-novo">Tentar de novo</button>
    </section>`;
  }

  /* ---------- navegação e desenho ---------- */
  function abaAtual() {
    const h = location.hash.replace('#', '');
    return ABAS.includes(h) ? h : 'inicio';
  }

  function ajustarForm() {
    const f = porId('form-treino');
    if (!f) return;
    porId('passos').hidden = !tipoForm;
    f.querySelectorAll('[data-tipos]').forEach((el) => {
      el.hidden = !(tipoForm && el.dataset.tipos.split(' ').includes(tipoForm));
    });
  }

  function marcarDur() {
    const inp = porId('in-dur');
    if (!inp) return;
    const v = campoNum(inp.value);
    document.querySelectorAll('[data-acao=dur]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === v)));
  }

  function render() {
    const aba = abaAtual();
    const telas = { inicio: telaInicio, treinos: telaTreinos, peso: telaPeso, perfil: telaPerfil };
    if (falhaConexao) tela.innerHTML = telaFalha();
    else if (!dados) tela.innerHTML = telaCarregando();
    else tela.innerHTML = telas[aba]();
    document.querySelectorAll('#abas a').forEach((a) => {
      if (a.getAttribute('href') === '#' + aba) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    aplicarLetra();
    ajustarForm();
    marcarDur();
  }

  /** Redesenha só a parte que mudou (para não perder o que a pessoa já preencheu). */
  function parcial() {
    const alvos = { treinos: ['historico', htmlHistorico], peso: ['lista-pesos', htmlListaPesos], perfil: ['zona-apagar', htmlApagar] };
    const a = alvos[abaAtual()];
    if (a && porId(a[0])) porId(a[0]).innerHTML = a[1]();
  }

  /* ---------- conversa com o servidor ---------- */
  async function carregar() {
    try {
      dados = await Api.estado();
      falhaConexao = false;
    } catch (e) {
      falhaConexao = !dados;
      if (dados) avisar(e.message, true);
    }
    render();
  }

  /** Executa uma ação no servidor e atualiza as telas. Devolve true se deu certo. */
  async function executar(acao, mensagemOk, idErro) {
    try {
      await acao();
    } catch (e) {
      if (idErro && porId(idErro)) porId(idErro).textContent = e.message;
      else avisar(e.message, true);
      return false;
    }
    confirmando = null;
    try {
      dados = await Api.estado();
    } catch (e) {
      avisar(e.message, true);
      return true;
    }
    render();
    if (mensagemOk) avisar(mensagemOk);
    return true;
  }

  window.addEventListener('hashchange', () => {
    confirmando = null;
    render();
    window.scrollTo(0, 0);
  });

  btnLetra.addEventListener('click', async () => {
    if (!dados) return;
    const novo = !dados.letraGrande;
    dados.letraGrande = novo; // muda na hora; se o servidor falhar, volta
    aplicarLetra();
    try {
      await Api.salvarPerfil({ letraGrande: novo });
    } catch (e) {
      dados.letraGrande = !novo;
      aplicarLetra();
      avisar(e.message, true);
    }
  });

  /* ---------- eventos ---------- */
  tela.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;

    if (acao === 'passo') {
      const inp = porId(b.dataset.alvo);
      const delta = Number(b.dataset.delta);
      let v = campoNum(inp.value);
      if (v === null) v = inp.dataset.primeiro ? Number(inp.dataset.primeiro) : Math.max(0, delta);
      else v += delta;
      if (inp.dataset.zeroVazio && v <= 0) inp.value = '';
      else inp.value = String(Math.round(Math.min(Number(inp.max), Math.max(Number(inp.min), v)) * 10) / 10);
      marcarDur();
    } else if (acao === 'dur') {
      porId('in-dur').value = b.dataset.v;
      marcarDur();
    } else if (acao === 'add-linha') {
      porId('linhas-ex').insertAdjacentHTML('beforeend', linhaExercicio());
    } else if (acao === 'remover-linha') {
      const linhas = document.querySelectorAll('.ex-linha');
      if (linhas.length > 1) b.closest('.ex-linha').remove();
      else b.closest('.ex-linha').querySelectorAll('input').forEach((i) => (i.value = ''));
    } else if (acao === 'apagar-pedir') {
      confirmando = b.dataset.tipo === 'tudo' ? 'tudo' : b.dataset.tipo + ':' + b.dataset.id;
      parcial();
    } else if (acao === 'apagar-nao') {
      confirmando = null;
      parcial();
    } else if (acao === 'apagar-sim') {
      const { tipo, id } = b.dataset;
      b.disabled = true;
      const chamada = tipo === 'treino' ? () => Api.apagarTreino(id) : tipo === 'peso' ? () => Api.apagarPeso(id) : () => Api.limpar();
      const ok = await executar(chamada, tipo === 'tudo' ? 'Tudo apagado.' : 'Apagado.');
      if (!ok) b.disabled = false;
    } else if (acao === 'limpar-exemplo') {
      b.disabled = true;
      const ok = await executar(() => Api.limpar(), 'Pronto! Comece com seus dados.');
      if (!ok) b.disabled = false;
    } else if (acao === 'tentar-de-novo') {
      await carregar();
    }
  });

  tela.addEventListener('change', (e) => {
    const alvo = e.target;
    if (alvo.name === 'tipo') {
      tipoForm = alvo.value;
      ajustarForm();
      const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      porId('passos').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
    } else if (alvo.name === 'quando') {
      alvo.closest('form').querySelector('.data-outro').hidden = alvo.value !== 'outro';
    }
  });

  tela.addEventListener('input', (e) => {
    if (e.target.id === 'in-dur') marcarDur();
  });

  tela.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const botao = f.querySelector('[type=submit]');
    botao.disabled = true;
    let ok = false;
    if (f.id === 'form-treino') ok = await salvarTreino(f);
    else if (f.id === 'form-peso') ok = await salvarPeso(f);
    else if (f.id === 'form-perfil') ok = await salvarPerfil(f);
    if (!ok) botao.disabled = false; // se deu certo, a tela é redesenhada
  });

  function erro(id, msg) {
    porId(id).textContent = msg;
    return false;
  }

  function salvarTreino(f) {
    if (!tipoForm) return Promise.resolve(erro('erro-treino', 'Escolha o que você fez.'));
    const treino = {
      data: lerQuando(f),
      tipo: tipoForm,
      duracao: campoNum(f.elements.duracao.value),
      obs: f.elements.obs.value,
    };
    if (tipoForm === 'caminhada' || tipoForm === 'corrida') treino.distanciaKm = campoNum(f.elements.distancia.value);
    if (tipoForm === 'academia' || tipoForm === 'casa') {
      treino.exercicios = [...f.querySelectorAll('.ex-linha')]
        .map((l) => ({
          nome: l.querySelector('[name=ex-nome]').value,
          series: campoNum(l.querySelector('[name=ex-series]').value) || 1,
          reps: campoNum(l.querySelector('[name=ex-reps]').value) || 1,
          carga: campoNum(l.querySelector('[name=ex-carga]').value) || 0,
        }))
        .filter((x) => x.nome.trim());
    }
    return executar(async () => {
      await Api.criarTreino(treino);
      tipoForm = null;
    }, 'Treino salvo!', 'erro-treino');
  }

  function salvarPeso(f) {
    return executar(() => Api.salvarPeso(lerQuando(f), campoNum(f.elements.kg.value)), 'Peso salvo!', 'erro-peso');
  }

  function salvarPerfil(f) {
    const el = f.elements;
    return executar(
      () => Api.salvarPerfil({
        nome: el.nome.value,
        idade: el.idade.value,
        altura: el.altura.value,
        metaPeso: el.metaPeso.value,
        metaSemanal: el.metaSemanal.value,
      }),
      'Dados salvos!',
      'erro-perfil'
    );
  }

  render();
  carregar();
})();
