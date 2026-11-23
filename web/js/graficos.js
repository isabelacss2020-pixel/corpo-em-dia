/* ==========================================================
   Corpo em Dia — gráfico de evolução do peso (SVG feito à mão)
   As cores vêm de classes CSS, então funcionam no tema claro e escuro.
   O desenho tem proporção de celular para que os números fiquem legíveis.
   ========================================================== */

const Graficos = {
  linhaPeso(pesos, meta) {
    if (pesos.length < 2) return '';
    const L = 360, A = 240;
    const m = { t: 24, r: 16, b: 34, l: 46 };

    const tempos = pesos.map((p) => Datas.parse(p.data).getTime());
    const valores = pesos.map((p) => p.kg);
    const todos = meta ? valores.concat(meta) : valores;
    let min = Math.min(...todos);
    let max = Math.max(...todos);
    const folga = Math.max((max - min) * 0.15, 0.5);
    min = Math.floor(min - folga);
    max = Math.ceil(max + folga);

    const t0 = tempos[0];
    const t1 = tempos[tempos.length - 1];
    const X = (t) => m.l + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * (L - m.l - m.r));
    const Y = (v) => m.t + (1 - (v - min) / (max - min)) * (A - m.t - m.b);
    const f1 = (n) => n.toFixed(1);
    const br = (n) => n.toFixed(1).replace('.', ',');

    // três linhas de grade (mínimo, meio e máximo) e seus números
    let grade = '';
    for (let i = 0; i <= 2; i++) {
      const v = min + ((max - min) * i) / 2;
      const y = Y(v);
      grade += `<line class="grade" x1="${m.l}" x2="${L - m.r}" y1="${f1(y)}" y2="${f1(y)}"/>`;
      grade += `<text class="rotulo" x="${m.l - 8}" y="${f1(y + 4)}" text-anchor="end">${br(v)}</text>`;
    }

    // datas: primeira, do meio e última pesagem
    const meio = pesos[Math.floor((pesos.length - 1) / 2)];
    const eixoX =
      `<text class="rotulo" x="${m.l}" y="${A - 10}" text-anchor="start">${Datas.brCurta(pesos[0].data)}</text>` +
      `<text class="rotulo" x="${f1(X(Datas.parse(meio.data).getTime()))}" y="${A - 10}" text-anchor="middle">${Datas.brCurta(meio.data)}</text>` +
      `<text class="rotulo" x="${L - m.r}" y="${A - 10}" text-anchor="end">${Datas.brCurta(pesos[pesos.length - 1].data)}</text>`;

    const pts = pesos.map((p, i) => [X(tempos[i]), Y(p.kg)]);
    const linha = pts.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join(' ');
    const base = f1(A - m.b);
    const area = `M${f1(pts[0][0])} ${base} ` + pts.map((p) => 'L' + f1(p[0]) + ' ' + f1(p[1])).join(' ') + ` L${f1(pts[pts.length - 1][0])} ${base} Z`;

    const bolinhas = pts
      .map((p, i) => {
        const ultimo = i === pts.length - 1;
        const titulo = `${Datas.br(pesos[i].data)}: ${br(pesos[i].kg)} kg`;
        return `<circle class="${ultimo ? 'ponto-fim' : 'ponto'}" cx="${f1(p[0])}" cy="${f1(p[1])}" r="${ultimo ? 6 : 4}"><title>${titulo}</title></circle>`;
      })
      .join('');

    // valor da última pesagem acima do ponto (ou abaixo, se faltar espaço)
    const u = pts[pts.length - 1];
    const yTexto = u[1] - 14 < m.t ? u[1] + 24 : u[1] - 14;
    const valorFinal = `<text class="valor-fim" x="${f1(u[0])}" y="${f1(yTexto)}" text-anchor="end">${br(valores[valores.length - 1])} kg</text>`;

    let linhaMeta = '';
    if (meta) {
      const y = Y(meta);
      linhaMeta =
        `<line class="meta" x1="${m.l}" x2="${L - m.r}" y1="${f1(y)}" y2="${f1(y)}"/>` +
        `<text class="rotulo" x="${m.l + 6}" y="${f1(y - 6)}" text-anchor="start">meta ${br(meta)}</text>`;
    }

    return (
      `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="Gráfico de linha com o peso ao longo do tempo">` +
      grade + linhaMeta + `<path class="area" d="${area}"/>` + `<path class="linha" d="${linha}"/>` +
      bolinhas + valorFinal + eixoX + `</svg>`
    );
  },
};
