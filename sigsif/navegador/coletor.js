// Coletor da rastreabilidade Friboi
// ---------------------------------------------------------------------------
// Cole isto no console do navegador (F12) na página
//   https://www.friboi.com.br/qualidade/rastreabilidade/
// Ele NÃO consulta nada sozinho e NÃO toca no reCAPTCHA: você faz a consulta
// normalmente, e ele guarda a tabela que apareceu na tela. Consulte quantos
// SIFs/datas quiser; ao final, baixe tudo num CSV.
//
//   friboiColetor.ver()      quantas linhas já guardou
//   friboiColetor.baixar()   baixa o CSV (pronto para cruza_fazendas.py)
//   friboiColetor.limpar()   zera a coleta
// ---------------------------------------------------------------------------
(() => {
  const CHAVE = 'friboi_coleta_v1';
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; }
                      catch (e) { return []; } };
  const gravar = (v) => localStorage.setItem(CHAVE, JSON.stringify(v));

  // SIF e data vêm dos próprios campos do formulário — a tabela não os repete.
  const contexto = () => {
    const sif = document.querySelector('#input-Número-SIF')?.value || '';
    const dt = document.querySelector('#input-Data-de-produção')?.value || '';
    return { sif, data_producao: dt };
  };

  const captura = () => {
    const tabela = [...document.querySelectorAll('table')]
      .find(t => /Data do abate/i.test(t.tHead?.innerText || ''));
    if (!tabela) return 0;
    const { sif, data_producao } = contexto();
    const atual = ler();
    // chave de deduplicação: mesma consulta + mesma linha
    const vistos = new Set(atual.map(r =>
      [r.sif, r.data_producao, r.date, r.plot, r.ranch, r.city].join('|')));
    let novas = 0;
    for (const tr of tabela.tBodies[0]?.rows || []) {
      const c = [...tr.cells].map(td => td.innerText.trim());
      if (c.length < 4) continue;
      const linha = { sif, data_producao, date: c[0], plot: c[1], ranch: c[2], city: c[3] };
      const k = [sif, data_producao, c[0], c[1], c[2], c[3]].join('|');
      if (!vistos.has(k)) { vistos.add(k); atual.push(linha); novas++; }
    }
    if (novas) { gravar(atual); console.log(`[coletor] +${novas} linha(s) — total ${atual.length}`); }
    return novas;
  };

  // A tabela é renderizada pelo React depois da resposta; observar o DOM
  // evita ter que apertar nada a cada consulta.
  new MutationObserver(() => captura())
    .observe(document.body, { childList: true, subtree: true });
  captura();

  window.friboiColetor = {
    ver: () => { const v = ler(); console.table(v.slice(-10));
                 console.log(`total: ${v.length} linha(s)`); return v.length; },
    limpar: () => { localStorage.removeItem(CHAVE); console.log('[coletor] zerado'); },
    baixar: () => {
      const v = ler();
      if (!v.length) return console.warn('[coletor] nada coletado ainda');
      const cols = ['sif', 'data_producao', 'date', 'plot', 'ranch', 'city'];
      const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(';'), ...v.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `friboi_fazendas_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      console.log(`[coletor] baixado: ${v.length} linha(s)`);
    },
  };
  console.log('[coletor] ativo. Faça as consultas; depois friboiColetor.baixar()');
})();
