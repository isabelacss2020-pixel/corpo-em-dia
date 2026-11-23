/* ==========================================================
   Corpo em Dia — funções de data (formato AAAA-MM-DD, horário do aparelho)
   Só formatação e navegação no calendário. Os cálculos ficam no backend (Python/SQL).
   ========================================================== */

const Datas = {
  iso(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },
  parse(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  hoje() {
    return Datas.iso(new Date());
  },
  somar(s, dias) {
    const d = Datas.parse(s);
    d.setDate(d.getDate() + dias);
    return Datas.iso(d);
  },
  br(s) {
    const [y, m, d] = s.split('-');
    return d + '/' + m + '/' + y;
  },
  brCurta(s) {
    const [, m, d] = s.split('-');
    return d + '/' + m;
  },
};
