(() => {
  const DATA_FILE = './data/report_data.json';
  const METADATA_FILE = './data/metadata.json';

  const GEMINI_STORAGE_KEY = 'lai_dashboard_gemini_key';
  const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const GEMINI_CONTINUE_PROMPT = 'Continue exatamente de onde parou, sem repetir o que já respondeu.';

  const nFmt = new Intl.NumberFormat('pt-BR');
  const pFmt = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const updatedLine = document.getElementById('updated-line');
  const yearsPill = document.getElementById('years-pill');
  const partialYearPill = document.getElementById('partial-year-pill');
  const chartPartialNote = document.getElementById('chart-partial-note');
  const yearlyPartialNote = document.getElementById('yearly-partial-note');

  const metricTotalRequests = document.getElementById('metric-total-requests');
  const metricDeniedTotal = document.getElementById('metric-denied-total');
  const metricRestrictedTotal = document.getElementById('metric-restricted-total');
  const metricPersonalTotal = document.getElementById('metric-personal-total');

  const narrativeList = document.getElementById('narrative-list');
  const alertsSummary = document.getElementById('alerts-summary');

  const tableYearly = document.getElementById('table-yearly');
  const tableReasons = document.getElementById('table-reasons');
  const tableOrgTop = document.getElementById('table-org-top');
  const tablePersonalTop = document.getElementById('table-personal-top');

  const orgCards = document.getElementById('org-cards');

  const searchYear = document.getElementById('search-year');
  const searchOrg = document.getElementById('search-org');
  const searchDecisionGroup = document.getElementById('search-decision-group');
  const searchTheme = document.getElementById('search-theme');
  const searchQuery = document.getElementById('search-query');
  const searchBtn = document.getElementById('btn-search-requests');
  const presetRow = document.getElementById('preset-row');
  const searchStatus = document.getElementById('search-status');
  const tableSearchResults = document.getElementById('table-search-results');

  const geminiKeyInput = document.getElementById('gemini-key');
  const aiYearFilter = document.getElementById('ai-year-filter');
  const aiOrgFilter = document.getElementById('ai-org-filter');
  const aiChat = document.getElementById('ai-chat');
  const aiQuestion = document.getElementById('ai-question');
  const aiAskBtn = document.getElementById('btn-ask-ai');
  const aiResetBtn = document.getElementById('btn-ai-reset');
  const aiStatus = document.getElementById('ai-status');
  const methodologyContent = document.getElementById('methodology-content');

  const chartInstances = [];

  let reportData = null;
  let metadata = null;
  let requestSamples = [];
  let lastSearchResults = [];
  let partialYearCtx = null;

  let aiMessages = [];
  let aiHistory = [];
  let aiContextStamp = '';

  function esc(text) {
    return (text || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeForSearch(value) {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatDateTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function formatMonthYear(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Cuiaba',
      month: 'long',
      year: 'numeric',
    });
  }

  function getPartialYearContext(series) {
    if (!series.length) return null;
    const last = series[series.length - 1];
    const year = Number(last.year);
    if (!Number.isFinite(year)) return null;

    const updatedIso = (metadata || {}).updated_at || reportData.generated_at;
    const updatedDate = new Date(updatedIso);
    if (Number.isNaN(updatedDate.getTime())) return null;

    const buildYear = Number(updatedDate.toLocaleDateString('en-CA', {
      timeZone: 'America/Cuiaba',
      year: 'numeric',
    }));
    if (year !== buildYear) return null;

    return {
      year,
      yearLabel: `${year}*`,
      cutoffDateTime: formatDateTime(updatedIso),
      cutoffMonthYear: formatMonthYear(updatedIso),
    };
  }

  function shortOrgName(name) {
    if (!name) return '';
    if (name.length <= 40) return name;
    return `${name.slice(0, 39)}...`;
  }

  function compactText(text, limit = 220) {
    const clean = (text || '').toString().replace(/\s+/g, ' ').trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit - 1).trim()}…`;
  }

  function renderPartialYearHints() {
    if (!partialYearCtx) {
      if (partialYearPill) partialYearPill.hidden = true;
      if (chartPartialNote) chartPartialNote.hidden = true;
      if (yearlyPartialNote) yearlyPartialNote.hidden = true;
      return;
    }

    const note = `* <strong>${partialYearCtx.year}</strong> é um ano parcial (dados acumulados até <strong>${esc(partialYearCtx.cutoffDateTime)}</strong>). Nos gráficos, esse ano aparece com asterisco e marcação mais clara.`;

    if (partialYearPill) {
      partialYearPill.hidden = false;
      partialYearPill.textContent = `${partialYearCtx.year} parcial`;
    }
    if (chartPartialNote) {
      chartPartialNote.hidden = false;
      chartPartialNote.innerHTML = note;
    }
    if (yearlyPartialNote) {
      yearlyPartialNote.hidden = false;
      yearlyPartialNote.innerHTML = note;
    }
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status} ao carregar ${url}: ${body.slice(0, 120)}`);
    }
    return resp.json();
  }

  async function fetchGzipText(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ao carregar ${url}`);
    }
    const gzBuffer = await resp.arrayBuffer();
    if ('DecompressionStream' in window) {
      const stream = new Blob([gzBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).text();
    }
    const pako = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm');
    return pako.ungzip(new Uint8Array(gzBuffer), { to: 'string' });
  }

  function destroyCharts() {
    while (chartInstances.length) {
      const chart = chartInstances.pop();
      chart.destroy();
    }
  }

  function pushChart(chart) {
    chartInstances.push(chart);
  }

  function renderHeaderMeta() {
    const years = (((metadata || {}).years_covered) || ((reportData.source || {}).years_covered) || []);
    const minYear = years.length ? Math.min(...years) : '--';
    const maxYear = years.length ? Math.max(...years) : '--';
    yearsPill.textContent = `anos: ${minYear}-${maxYear}`;
    updatedLine.textContent = `Atualizado em ${formatDateTime((metadata || {}).updated_at || reportData.generated_at)} (America/Cuiaba)`;
    renderPartialYearHints();
  }

  function renderMetrics() {
    const overall = reportData.overall || {};
    metricTotalRequests.textContent = nFmt.format(overall.total_requests || 0);
    metricDeniedTotal.textContent = `${nFmt.format(overall.denied_total || 0)} (${pFmt.format(overall.denied_rate || 0)})`;
    metricRestrictedTotal.textContent = `${nFmt.format(overall.restricted_total || 0)} (${pFmt.format(overall.restricted_rate || 0)})`;
    metricPersonalTotal.textContent = `${nFmt.format(overall.personal_restricted_total || 0)} (${pFmt.format(overall.personal_share_in_restricted || 0)})`;
  }

  function renderAlertsSummary() {
    if (!alertsSummary) return;
    const monitoring = reportData.monitoring || {};
    const baseline = monitoring.baseline_ytd_avg || {};
    const current = monitoring.current_ytd || {};
    const hasComparableBase = Array.isArray(monitoring.comparison_years) && monitoring.comparison_years.length > 0;

    if (!hasComparableBase || !monitoring.latest_month) {
      alertsSummary.innerHTML = `
        <article class="alert-card">
          <h3>Resumo do monitoramento</h3>
          <p>Sem base comparável suficiente para gerar alertas de período no momento.</p>
        </article>
      `;
      return;
    }

    const restrictedDelta = Number(monitoring.restricted_rate_delta_pp || 0);
    const deniedDelta = Number(monitoring.denied_rate_delta_pp || 0);
    const status = monitoring.restricted_rate_status || 'estável';
    const statusLabel = status === 'piorando'
      ? 'Atenção: cenário piorou no acumulado do ano'
      : (status === 'melhorando' ? 'Sinal positivo: cenário melhorou no acumulado' : 'Cenário estável no acumulado');

    const spikes = (monitoring.org_spikes || []).slice(0, 5);
    const spikesHtml = spikes.length
      ? `<ul>${spikes.map((row) => `
          <li><strong>${esc(row.org)}</strong>: teve <strong>${nFmt.format(row.current_denied)}</strong> negativas no mês mais recente. A referência histórica para o mesmo mês é <strong>${nFmt.format(Math.round(row.baseline_denied_avg || 0))}</strong>, então houve alta de <strong>${pFmt.format(row.lift_ratio || 0)}</strong>.</li>
        `).join('')}</ul>`
      : '<p>Nenhum órgão teve aumento fora do padrão histórico no mês mais recente.</p>';

    const themeWorsening = (monitoring.theme_worsening || []).slice(0, 5);
    const themeHtml = themeWorsening.length
      ? `<ul>${themeWorsening.map((row) => `
          <li><strong>${esc(row.theme)}</strong>: a taxa de restrição subiu <strong>${Number(row.delta_pp || 0).toFixed(1)} p.p.</strong> no acumulado do ano, comparando com o mesmo período dos anos anteriores.</li>
        `).join('')}</ul>`
      : '<p>Não apareceu piora relevante por tema no recorte com volume mínimo de pedidos.</p>';

    alertsSummary.innerHTML = `
      <article class="alert-card">
        <h3>${statusLabel}</h3>
        <p>Este diagnóstico compara o ano atual <strong>até ${esc(monitoring.latest_month_label || '--')} de ${esc(String(monitoring.latest_year || '--'))}</strong> com a média do <strong>mesmo período</strong> dos últimos anos. Isso evita comparar ano incompleto com ano fechado.</p>
        <p><strong>Taxa com restrição</strong> (negado + parcial): está em <strong>${pFmt.format(current.restricted_rate || 0)}</strong>. A base comparável é <strong>${pFmt.format(baseline.restricted_rate_avg || 0)}</strong>, diferença de <strong>${restrictedDelta.toFixed(1)} p.p.</strong>.</p>
        <p><strong>Taxa de negativas totais</strong>: está em <strong>${pFmt.format(current.denied_rate || 0)}</strong>. A base comparável é <strong>${pFmt.format(baseline.denied_rate_avg || 0)}</strong>, diferença de <strong>${deniedDelta.toFixed(1)} p.p.</strong>.</p>
      </article>
      <article class="alert-card">
        <h3>Órgãos com spike recente</h3>
        <p>“Spike” significa aumento acima do padrão histórico para o mesmo mês do ano.</p>
        ${spikesHtml}
      </article>
      <article class="alert-card">
        <h3>Áreas que pioraram no ano</h3>
        <p>Aqui entram os temas em que a proporção de pedidos com restrição subiu de forma mais clara.</p>
        ${themeHtml}
      </article>
    `;
  }

  function renderMethodology() {
    if (!methodologyContent) return;
    const m = reportData.methodology || {};
    const source = reportData.source || {};
    const themes = ((((m.theme_classification || {}).themes) || [])).map((item) => ({
      theme: item.theme,
      keywords: (item.keywords || []).slice(0, 8),
    }));
    const files = (m.source_files || []).map((item) => `<code>${esc(item)}</code>`).join(', ');
    const comparisonRule = (((m.monitoring_rules || {}).government_diagnosis) || '').trim();
    const spikeRule = (((m.monitoring_rules || {}).recent_spike) || '').trim();
    const themeRule = (((m.monitoring_rules || {}).theme_worsening) || '').trim();

    methodologyContent.innerHTML = `
      <p><strong>Fonte oficial:</strong> <a href="${esc(source.portal_url || '#')}" target="_blank" rel="noopener noreferrer">Busca LAI (CGU)</a>. Arquivos usados: ${files || '--'}.</p>

      <details class="methodology-details" open>
        <summary>Como os indicadores foram calculados</summary>
        <ul>
          <li><strong>Unidade de análise:</strong> cada pedido individual da base anual.</li>
          <li><strong>Negado total:</strong> decisão canônica igual a “Acesso Negado”.</li>
          <li><strong>Com restrição:</strong> “Acesso Negado” + “Acesso Parcialmente Concedido”.</li>
          <li><strong>Motivo da negativa:</strong> usa <code>EspecificacaoDecisao</code> e, quando vazio, <code>MotivoNegativaAcesso</code>, com padronização textual.</li>
          <li><strong>Informação pessoal:</strong> caso com restrição cujo motivo contém termos de privacidade/LGPD.</li>
          <li><strong>Ano parcial:</strong> no ano corrente, o painel mostra acumulado até a data da atualização.</li>
        </ul>
      </details>

      <details class="methodology-details">
        <summary>O que significa cada tema de pedido</summary>
        <p>O tema vem do texto combinado de <code>AssuntoPedido</code>, <code>ResumoSolicitacao</code> e <code>DetalhamentoSolicitacao</code>, por regras de palavras-chave.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                <th>Palavras-chave usadas na classificação</th>
              </tr>
            </thead>
            <tbody>
              ${themes.map((row) => `
                <tr>
                  <td>${esc(row.theme)}</td>
                  <td>${esc(row.keywords.join(', '))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>

      <details class="methodology-details">
        <summary>Amostragem e links na tabela de pedidos</summary>
        <ul>
          <li><strong>Amostra para busca:</strong> ${(m.sampling_for_search || {}).method ? esc((m.sampling_for_search || {}).method) : '--'}.</li>
          <li><strong>Volume da amostra:</strong> <strong>${nFmt.format(Number((m.sampling_for_search || {}).sample_count || 0))}</strong> pedidos.</li>
          <li><strong>Cobertura completa no top 10+PF:</strong> <strong>${nFmt.format(Number((m.sampling_for_search || {}).top_org_rows_in_search || 0))}</strong> pedidos.</li>
          <li><strong>Link BuscaLAI:</strong> cada pedido da amostra pode trazer URL direta via <code>IdPedido</code>, a partir de <code>PedidosLinkArquivo</code>.</li>
        </ul>
      </details>

      <details class="methodology-details">
        <summary>Regras dos alertas do monitoramento</summary>
        <ul>
          <li><strong>Diagnóstico do período:</strong> ${comparisonRule ? esc(comparisonRule) : '--'}.</li>
          <li><strong>Spike por órgão:</strong> ${spikeRule ? esc(spikeRule) : '--'}.</li>
          <li><strong>Piora por tema:</strong> ${themeRule ? esc(themeRule) : '--'}.</li>
        </ul>
      </details>
    `;
  }

  function renderNarrative() {
    const series = reportData.series || [];
    const topReasons = reportData.top_reasons || [];
    const topOrgs = reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || [];

    if (!series.length) {
      narrativeList.innerHTML = '<li>Sem dados para exibir.</li>';
      return;
    }

    const first = series[0];
    const last = series[series.length - 1];
    const comparableSeries = partialYearCtx
      ? series.filter((row) => Number(row.year) !== Number(partialYearCtx.year))
      : series;
    const peakBase = comparableSeries.length ? comparableSeries : series;

    const peakDenied = [...peakBase].sort((a, b) => b.denied_total - a.denied_total)[0];
    const peakRestricted = [...peakBase].sort((a, b) => b.restricted_rate - a.restricted_rate)[0];
    const mainReason = topReasons[0] || { reason: 'Sem informação', count: 0 };
    const topOrg = topOrgs[0] || { org: 'Sem informação', denied_total: 0 };
    const endLabel = partialYearCtx ? partialYearCtx.yearLabel : String(last.year);
    const peakLabel = partialYearCtx ? 'entre anos completos' : 'na série histórica';

    const bullets = [
      `No período analisado (${first.year} a ${endLabel}), a base registra <strong>${nFmt.format(reportData.overall.total_requests || 0)}</strong> pedidos, dos quais <strong>${nFmt.format(reportData.overall.denied_total || 0)}</strong> foram negados totalmente e <strong>${nFmt.format(reportData.overall.restricted_total || 0)}</strong> tiveram algum tipo de restrição.`,
      `O pico de negativas ${peakLabel} foi em <strong>${peakDenied.year}</strong>, com <strong>${nFmt.format(peakDenied.denied_total)}</strong> casos. A maior taxa de restrição apareceu em <strong>${peakRestricted.year}</strong> (<strong>${pFmt.format(peakRestricted.restricted_rate)}</strong>).`,
      `O motivo mais comum entre as restrições é <strong>${esc(mainReason.reason)}</strong>, com <strong>${nFmt.format(mainReason.count || 0)}</strong> ocorrências na série histórica.`,
      `Entre os órgãos, o que mais concentra negativas no período é <strong>${esc(topOrg.org)}</strong> (<strong>${nFmt.format(topOrg.denied_total || 0)}</strong> negativas).`,
      `No recorte de informação pessoal, há <strong>${nFmt.format(reportData.overall.personal_restricted_total || 0)}</strong> negativas/restrições ligadas a esse tema, o que representa <strong>${pFmt.format(reportData.overall.personal_share_in_restricted || 0)}</strong> das restrições totais.`,
    ];

    if (partialYearCtx) {
      bullets.push(`Atenção: <strong>${partialYearCtx.year}</strong> ainda não terminou (dados acumulados até <strong>${esc(partialYearCtx.cutoffDateTime)}</strong>). Por isso ele aparece como ano parcial e não deve ser comparado como ano fechado.`);
    }

    narrativeList.innerHTML = bullets.map((text) => `<li>${text}</li>`).join('');
  }

  function renderCharts() {
    destroyCharts();

    const series = reportData.series || [];
    const partialYear = partialYearCtx ? Number(partialYearCtx.year) : null;
    const partialIndex = partialYearCtx
      ? series.findIndex((row) => Number(row.year) === partialYear)
      : -1;
    const hasPartial = partialIndex >= 0;
    const years = series.map((row, idx) => (idx === partialIndex ? `${row.year}*` : String(row.year)));
    const palette = ['#2f6f9f', '#3f8f6d', '#8d5f2c', '#7a4f9e', '#b36f18', '#5a7a2d', '#a04747', '#65758f'];

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: { legend: { position: 'bottom' } },
    };

    const splitSeries = (accessor) => ({
      complete: series.map((row, idx) => (idx === partialIndex ? null : accessor(row))),
      partial: hasPartial ? series.map((row, idx) => (idx === partialIndex ? accessor(row) : null)) : [],
    });

    const reqSplit = splitSeries((row) => row.total_requests);
    const deniedSplit = splitSeries((row) => row.denied_total);

    const volumeDatasets = [
      {
        type: 'line',
        label: hasPartial ? 'Pedidos (anos completos)' : 'Pedidos',
        data: reqSplit.complete,
        borderColor: '#2f6f9f',
        backgroundColor: 'rgba(47,111,159,0.15)',
        yAxisID: 'y',
        tension: 0.25,
        pointRadius: 2,
      },
      {
        type: 'bar',
        label: hasPartial ? 'Negados (anos completos)' : 'Negados',
        data: deniedSplit.complete,
        backgroundColor: 'rgba(182,66,66,0.85)',
        borderRadius: 6,
        yAxisID: 'y1',
      },
    ];

    if (hasPartial) {
      volumeDatasets.push(
        {
          type: 'line',
          label: `Pedidos (${partialYearCtx.year} parcial)`,
          data: reqSplit.partial,
          borderColor: '#2f6f9f',
          backgroundColor: 'rgba(47,111,159,0.12)',
          yAxisID: 'y',
          showLine: false,
          pointRadius: 5,
          pointStyle: 'rectRot',
        },
        {
          type: 'bar',
          label: `Negados (${partialYearCtx.year} parcial)`,
          data: deniedSplit.partial,
          backgroundColor: 'rgba(182,66,66,0.35)',
          borderColor: 'rgba(182,66,66,0.9)',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y1',
        },
      );
    }

    pushChart(new Chart(document.getElementById('chart-yearly-volume'), {
      type: 'bar',
      data: {
        labels: years,
        datasets: volumeDatasets,
      },
      options: {
        ...commonOptions,
        scales: {
          y: { position: 'left', beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
          y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { callback: (v) => nFmt.format(v) } },
        },
      },
    }));

    const deniedRateSplit = splitSeries((row) => row.denied_rate * 100);
    const restrictedRateSplit = splitSeries((row) => row.restricted_rate * 100);
    const rateDatasets = [
      {
        label: hasPartial ? 'Taxa de negado (anos completos)' : 'Taxa de negado total',
        data: deniedRateSplit.complete,
        borderColor: '#b64242',
        backgroundColor: 'rgba(182,66,66,0.12)',
        tension: 0.25,
        fill: true,
      },
      {
        label: hasPartial ? 'Taxa com restrição (anos completos)' : 'Taxa com restrição (negado + parcial)',
        data: restrictedRateSplit.complete,
        borderColor: '#3f8f6d',
        backgroundColor: 'rgba(63,143,109,0.12)',
        tension: 0.25,
        fill: true,
      },
    ];
    if (hasPartial) {
      rateDatasets.push(
        {
          label: `Taxa de negado (${partialYearCtx.year} parcial)`,
          data: deniedRateSplit.partial,
          borderColor: '#b64242',
          backgroundColor: 'rgba(182,66,66,0.18)',
          showLine: false,
          pointRadius: 5,
          pointStyle: 'rectRot',
        },
        {
          label: `Taxa com restrição (${partialYearCtx.year} parcial)`,
          data: restrictedRateSplit.partial,
          borderColor: '#3f8f6d',
          backgroundColor: 'rgba(63,143,109,0.2)',
          showLine: false,
          pointRadius: 5,
          pointStyle: 'rectRot',
        },
      );
    }

    pushChart(new Chart(document.getElementById('chart-yearly-rate'), {
      type: 'line',
      data: {
        labels: years,
        datasets: rateDatasets,
      },
      options: {
        ...commonOptions,
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => `${v.toFixed(1)}%` } },
        },
      },
    }));

    const reasonLabels = [];
    const topReasonsRaw = (reportData.top_reasons || []).map((row) => row.reason);
    for (const reason of topReasonsRaw) {
      if (reasonLabels.length >= 6) break;
      if (!reasonLabels.includes(reason)) reasonLabels.push(reason);
    }
    if (!reasonLabels.includes('Dados pessoais')) reasonLabels.push('Dados pessoais');
    if (!reasonLabels.includes('Outros motivos')) reasonLabels.push('Outros motivos');

    const reasonMapByYear = new Map();
    for (const row of (reportData.reason_series || [])) {
      const key = String(row.year);
      if (!reasonMapByYear.has(key)) reasonMapByYear.set(key, {});
      reasonMapByYear.get(key)[row.reason] = row.count;
    }

    const reasonDatasets = reasonLabels.map((reason, idx) => ({
      label: reason,
      data: series.map((row) => {
        const yearMap = reasonMapByYear.get(String(row.year)) || {};
        return yearMap[reason] || 0;
      }),
      backgroundColor: years.map((_, yearIdx) => (
        yearIdx === partialIndex ? `${palette[idx % palette.length]}55` : `${palette[idx % palette.length]}cc`
      )),
      borderColor: years.map((_, yearIdx) => (
        yearIdx === partialIndex ? `${palette[idx % palette.length]}99` : palette[idx % palette.length]
      )),
      borderWidth: 1,
      stack: 'motivos',
    }));

    pushChart(new Chart(document.getElementById('chart-reasons'), {
      type: 'bar',
      data: { labels: years, datasets: reasonDatasets },
      options: {
        ...commonOptions,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
        },
      },
    }));

    const topOrg = reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || [];
    pushChart(new Chart(document.getElementById('chart-org-top'), {
      type: 'bar',
      data: {
        labels: topOrg.map((row) => shortOrgName(row.org)),
        datasets: [
          {
            type: 'bar',
            label: 'Negados (qtde)',
            data: topOrg.map((row) => row.denied_total),
            backgroundColor: 'rgba(47,111,159,0.85)',
            borderRadius: 6,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Taxa de negado',
            data: topOrg.map((row) => row.denied_rate * 100),
            borderColor: '#b64242',
            backgroundColor: 'rgba(182,66,66,0.15)',
            yAxisID: 'y1',
            tension: 0.22,
            pointRadius: 2,
          },
        ],
      },
      options: {
        ...commonOptions,
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => `${v.toFixed(1)}%` },
          },
        },
      },
    }));

    const lowOrg = (reportData.org_lowest_denial_high_volume || []).slice(0, 10);
    pushChart(new Chart(document.getElementById('chart-org-low'), {
      type: 'bar',
      data: {
        labels: lowOrg.map((row) => shortOrgName(row.org)),
        datasets: [
          {
            label: 'Taxa de negado',
            data: lowOrg.map((row) => row.denied_rate * 100),
            backgroundColor: 'rgba(63,143,109,0.88)',
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { callback: (v) => `${v.toFixed(1)}%` } },
        },
      },
    }));

    const personalSeries = (reportData.personal_info || {}).series || [];
    const personalLabels = personalSeries.map((row) => (
      (partialYearCtx && Number(row.year) === partialYear) ? `${row.year}*` : String(row.year)
    ));
    const personalSplit = {
      countComplete: personalSeries.map((row) => (
        (partialYearCtx && Number(row.year) === partialYear) ? null : row.count
      )),
      countPartial: hasPartial ? personalSeries.map((row) => (
        (Number(row.year) === partialYear) ? row.count : null
      )) : [],
      shareComplete: personalSeries.map((row) => (
        (partialYearCtx && Number(row.year) === partialYear) ? null : row.share_in_restricted * 100
      )),
      sharePartial: hasPartial ? personalSeries.map((row) => (
        (Number(row.year) === partialYear) ? row.share_in_restricted * 100 : null
      )) : [],
    };

    const personalDatasets = [
      {
        label: hasPartial
          ? 'Qtde por informação pessoal (anos completos)'
          : 'Qtde de negativas/restrições por informação pessoal',
        data: personalSplit.countComplete,
        borderColor: '#8d5f2c',
        backgroundColor: 'rgba(141,95,44,0.16)',
        yAxisID: 'y',
        tension: 0.22,
        fill: true,
      },
      {
        label: hasPartial
          ? '% pessoal nas restrições (anos completos)'
          : '% pessoal dentro das restrições',
        data: personalSplit.shareComplete,
        borderColor: '#2f6f9f',
        backgroundColor: 'rgba(47,111,159,0.12)',
        yAxisID: 'y1',
        tension: 0.22,
        fill: true,
      },
    ];
    if (hasPartial) {
      personalDatasets.push(
        {
          label: `Qtde (${partialYearCtx.year} parcial)`,
          data: personalSplit.countPartial,
          borderColor: '#8d5f2c',
          backgroundColor: 'rgba(141,95,44,0.25)',
          yAxisID: 'y',
          showLine: false,
          pointRadius: 5,
          pointStyle: 'rectRot',
        },
        {
          label: `% pessoal (${partialYearCtx.year} parcial)`,
          data: personalSplit.sharePartial,
          borderColor: '#2f6f9f',
          backgroundColor: 'rgba(47,111,159,0.25)',
          yAxisID: 'y1',
          showLine: false,
          pointRadius: 5,
          pointStyle: 'rectRot',
        },
      );
    }

    pushChart(new Chart(document.getElementById('chart-personal'), {
      type: 'line',
      data: {
        labels: personalLabels,
        datasets: personalDatasets,
      },
      options: {
        ...commonOptions,
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => `${v.toFixed(1)}%` },
          },
        },
      },
    }));
  }

  function renderTables() {
    tableYearly.innerHTML = (reportData.series || []).map((row) => `
      <tr>
        <td>${(partialYearCtx && Number(row.year) === Number(partialYearCtx.year)) ? `${row.year}*` : row.year}</td>
        <td>${nFmt.format(row.total_requests)}</td>
        <td>${nFmt.format(row.denied_total)}</td>
        <td>${nFmt.format(row.restricted_total)}</td>
        <td>${pFmt.format(row.denied_rate)}</td>
        <td>${pFmt.format(row.restricted_rate)}</td>
        <td>${nFmt.format(row.personal_restricted_total)}</td>
        <td>${pFmt.format(row.personal_share_in_restricted)}</td>
      </tr>
    `).join('');

    const totalRestricted = Number((reportData.overall || {}).restricted_total || 0);
    tableReasons.innerHTML = (reportData.top_reasons || []).slice(0, 15).map((row) => `
      <tr>
        <td>${esc(row.reason)}</td>
        <td>${nFmt.format(row.count || 0)}</td>
        <td>${totalRestricted ? pFmt.format((row.count || 0) / totalRestricted) : '--'}</td>
      </tr>
    `).join('');

    const top = reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || [];
    tableOrgTop.innerHTML = top.map((row) => `
      <tr>
        <td>${esc(row.org)}</td>
        <td>${nFmt.format(row.total_requests)}</td>
        <td>${nFmt.format(row.denied_total)}</td>
        <td>${nFmt.format(row.restricted_total)}</td>
        <td>${pFmt.format(row.denied_rate)}</td>
        <td>${pFmt.format(row.restricted_rate)}</td>
      </tr>
    `).join('');

    tablePersonalTop.innerHTML = (((reportData.personal_info || {}).top_orgs) || []).slice(0, 20).map((row) => `
      <tr>
        <td>${esc(row.org)}</td>
        <td>${nFmt.format(row.personal_restricted_total || 0)}</td>
        <td>${nFmt.format(row.restricted_total || 0)}</td>
        <td>${pFmt.format(row.share_in_org_restricted || 0)}</td>
      </tr>
    `).join('');
  }

  function renderOrgCards() {
    const selected = reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || [];
    const profiles = reportData.org_profiles || {};

    orgCards.innerHTML = selected.map((row) => {
      const profile = profiles[row.org] || { top_themes: [] };
      const topThemes = (profile.top_themes || []).slice(0, 4);

      const personalBox = `
        <div class="personal-box">
          <div class="title">Informação pessoal neste órgão</div>
          <div>Taxa sobre <strong>todos os pedidos</strong>: <strong>${pFmt.format(row.personal_rate_in_total || 0)}</strong></div>
          <div>Taxa sobre <strong>negativas/restrições</strong>: <strong>${pFmt.format(row.personal_rate_in_restricted || 0)}</strong></div>
          <div>Casos identificados: <strong>${nFmt.format(row.personal_restricted_total || 0)}</strong></div>
        </div>
      `;

      const themesHtml = topThemes.length
        ? `<div class="table-wrap"><table><thead><tr><th>Tema detectado no texto</th><th>Pedidos</th><th>Restrição</th><th>Resposta comum</th></tr></thead><tbody>${topThemes.map((item) => {
            const topDecision = (item.top_decisions || [])[0] || { decision: 'Sem padrão claro' };
            return `<tr><td>${esc(item.theme)}</td><td>${nFmt.format(item.total_requests)}</td><td>${pFmt.format(item.restricted_rate || 0)}</td><td>${esc(topDecision.decision || 'Sem padrão claro')}</td></tr>`;
          }).join('')}</tbody></table></div>`
        : '<p class="org-note">Sem temas suficientes para este órgão no recorte atual.</p>';

      const examplesHtml = topThemes.map((item) => {
        const examples = item.examples || [];
        if (!examples.length) return '';
        return `
          <div class="org-note"><strong>${esc(item.theme)}</strong>: ${examples.map((txt) => `“${esc(compactText(txt, 220))}”`).join(' | ')}</div>
        `;
      }).join('');

      return `
        <article class="org-card">
          <div class="org-head">
            <div class="org-name">${esc(row.org)}</div>
            <div class="org-tags">
              <span class="mini-tag">Pedidos: ${nFmt.format(row.total_requests)}</span>
              <span class="mini-tag">Negados: ${nFmt.format(row.denied_total)}</span>
              <span class="mini-tag">Taxa negado: ${pFmt.format(row.denied_rate)}</span>
            </div>
          </div>
          ${personalBox}
          <p class="org-note">Análise de conteúdo: os temas abaixo vêm do texto dos pedidos (resumo + detalhamento), não só do campo de assunto.</p>
          ${themesHtml}
          ${examplesHtml}
        </article>
      `;
    }).join('');
  }

  function renderSearchDecisionOptions() {
    searchDecisionGroup.innerHTML = [
      '<option value="todos">Decisão: todas</option>',
      '<option value="restricao">Decisão: com restrição (negado + parcial)</option>',
      '<option value="concedido">Decisão: acesso concedido</option>',
      '<option value="outros">Decisão: outros resultados</option>',
    ].join('');
  }

  function renderSearchFilters() {
    const years = [...new Set(requestSamples.map((row) => Number(row.year)).filter(Boolean))].sort((a, b) => b - a);
    const orgs = [...new Set(requestSamples.map((row) => row.org).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const themes = (((reportData.search_dashboard || {}).available_themes) || [...new Set(requestSamples.map((row) => row.theme).filter(Boolean))]).slice(0, 30);

    searchYear.innerHTML = `<option value="">Ano: todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join('')}`;
    searchOrg.innerHTML = `<option value="">Órgão: todos</option>${orgs.map((org) => `<option value="${esc(org)}">${esc(shortOrgName(org))}</option>`).join('')}`;
    searchTheme.innerHTML = `<option value="">Tema detectado: todos</option>${themes.map((theme) => `<option value="${esc(theme)}">${esc(theme)}</option>`).join('')}`;

    renderSearchDecisionOptions();

    const presets = (reportData.search_dashboard || {}).presets || [];
    presetRow.innerHTML = `<span class="search-status">Filtros prontos:</span>${presets.map((preset) => (
      `<button class="preset-btn" type="button" data-preset-id="${esc(preset.id)}">${esc(preset.label)}</button>`
    )).join('')}`;

    presetRow.querySelectorAll('[data-preset-id]').forEach((btn) => {
      btn.addEventListener('click', () => applyPreset(btn.getAttribute('data-preset-id')));
    });
  }

  function applyPreset(presetId) {
    const presets = (reportData.search_dashboard || {}).presets || [];
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    const filters = preset.filters || {};
    searchYear.value = filters.year || '';
    searchOrg.value = filters.org || '';
    searchDecisionGroup.value = filters.decision_group || 'todos';
    searchTheme.value = filters.theme || '';
    runRequestSearch();
  }

  function runRequestSearch() {
    const year = searchYear.value;
    const org = searchOrg.value;
    const decisionGroup = searchDecisionGroup.value || 'todos';
    const theme = searchTheme.value;

    const queryRaw = searchQuery.value.trim();
    const queryNorm = normalizeForSearch(queryRaw);
    const queryTokens = queryNorm ? queryNorm.split(' ').filter(Boolean) : [];

    let filtered = requestSamples;

    if (year) {
      filtered = filtered.filter((row) => String(row.year) === String(year));
    }
    if (org) {
      filtered = filtered.filter((row) => row.org === org);
    }
    if (decisionGroup && decisionGroup !== 'todos') {
      filtered = filtered.filter((row) => row.decision_group === decisionGroup);
    }
    if (theme) {
      filtered = filtered.filter((row) => row.theme === theme);
    }
    if (queryTokens.length) {
      filtered = filtered.filter((row) => queryTokens.every((token) => row.search_blob.includes(token)));
    }

    filtered = [...filtered].sort((a, b) => {
      const yearDiff = Number(b.year || 0) - Number(a.year || 0);
      if (yearDiff !== 0) return yearDiff;
      return String(a.org || '').localeCompare(String(b.org || ''), 'pt-BR');
    });

    lastSearchResults = filtered;

    const shown = filtered.slice(0, 220);

    tableSearchResults.innerHTML = shown.length
      ? shown.map((row) => `
        <tr>
          <td>${row.year || '--'}</td>
          <td>${esc(row.org || '--')}</td>
          <td>${esc(row.decision || '--')}</td>
          <td>${esc(row.theme || '--')}</td>
          <td>${esc(row.subject || '--')}</td>
          <td>${row.request_link ? `<a href="${esc(row.request_link)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : '--'}</td>
          <td>${esc(row.text_excerpt || '--')}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="7">Nenhum resultado para esse filtro.</td></tr>';

    const sampleInfo = reportData.search_dashboard || {};
    searchStatus.innerHTML = `Busca em <strong>${nFmt.format(sampleInfo.sample_count || requestSamples.length)}</strong> pedidos da amostra (${esc(sampleInfo.sample_method || 'amostragem')}). Resultado atual: <strong>${nFmt.format(filtered.length)}</strong> registros${filtered.length > shown.length ? ` (mostrando ${nFmt.format(shown.length)}).` : '.'}`;
  }

  function saveGeminiKey() {
    localStorage.setItem(GEMINI_STORAGE_KEY, geminiKeyInput.value.trim());
  }

  function restoreGeminiKey() {
    const saved = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (saved) geminiKeyInput.value = saved;
  }

  function renderInlineMarkdown(raw) {
    let text = esc((raw || '').toString());
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    return text;
  }

  function renderAiMarkdown(text) {
    const blocks = (text || '').toString().split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        const items = lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        const items = lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('');
        return `<ol>${items}</ol>`;
      }
      return `<p>${renderInlineMarkdown(block).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  function renderAiChat() {
    if (!aiMessages.length) {
      aiChat.innerHTML = '<article class="ai-msg"><span class="role">analista ia</span><div class="txt"><p>Pronto. Descreva seu caso e eu te ajudo com leitura da negativa e texto de pedido/recurso.</p></div></article>';
      return;
    }
    aiChat.innerHTML = aiMessages.map((msg) => {
      const roleLabel = msg.role === 'user' ? 'você' : 'analista ia';
      const cssRole = msg.role === 'user' ? 'user' : 'assistant';
      const body = msg.role === 'user'
        ? `<p>${esc(msg.text).replace(/\n/g, '<br>')}</p>`
        : renderAiMarkdown(msg.text);
      return `<article class="ai-msg ${cssRole}"><span class="role">${roleLabel}</span><div class="txt">${body}</div></article>`;
    }).join('');
    aiChat.scrollTop = aiChat.scrollHeight;
  }

  function pushAiMessage(role, text) {
    aiMessages.push({ role, text: (text || '').toString() });
    renderAiChat();
    return aiMessages.length - 1;
  }

  function updateAiMessage(index, text) {
    if (!Number.isInteger(index) || !aiMessages[index]) return;
    aiMessages[index].text = (text || '').toString();
    renderAiChat();
  }

  function resetAiConversation(message) {
    aiHistory = [];
    aiMessages = [];
    if (message) aiMessages.push({ role: 'assistant', text: message });
    aiContextStamp = '';
    renderAiChat();
  }

  function populateAiFilters() {
    const years = (reportData.series || []).map((row) => row.year);
    aiYearFilter.innerHTML = `<option value="">Contexto IA: todos os anos</option>${years.map((year) => `<option value="${year}">Ano ${year}</option>`).join('')}`;

    const orgs = (reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || []).map((row) => row.org);
    aiOrgFilter.innerHTML = `<option value="">Contexto IA: sem foco em órgão</option>${orgs.map((org) => `<option value="${esc(org)}">${esc(shortOrgName(org))}</option>`).join('')}`;
  }

  function computeAiContextStamp() {
    return JSON.stringify({
      aiYear: aiYearFilter.value || '',
      aiOrg: aiOrgFilter.value || '',
      searchYear: searchYear.value || '',
      searchOrg: searchOrg.value || '',
      searchDecision: searchDecisionGroup.value || 'todos',
      searchTheme: searchTheme.value || '',
      searchQuery: normalizeForSearch(searchQuery.value || ''),
      updated: (metadata || {}).updated_at || reportData.generated_at || '',
    });
  }

  function maybeResetAiHistoryOnContextChange() {
    const stamp = computeAiContextStamp();
    if (aiContextStamp && aiContextStamp !== stamp) {
      aiHistory = [];
      pushAiMessage('assistant', 'Contexto atualizado. Vou responder com base no novo recorte.');
    }
    aiContextStamp = stamp;
  }

  function buildAiContextPayload() {
    const aiYear = aiYearFilter.value ? Number(aiYearFilter.value) : null;
    const aiOrg = aiOrgFilter.value || null;

    const focusYear = aiYear
      ? (reportData.series || []).find((row) => Number(row.year) === aiYear) || null
      : null;
    const focusOrg = aiOrg
      ? ((reportData.org_profiles || {})[aiOrg] || null)
      : null;

    return {
      painel: 'LAI Dashboard',
      atualizado_em: (metadata || {}).updated_at || reportData.generated_at || '',
      fonte_dados: (reportData.source || {}).portal_url || '',
      precedentes_url: ((reportData.source || {}).precedentes_url) || '',
      geral: reportData.overall || {},
      foco_ano: focusYear,
      foco_orgao: focusOrg,
      top_motivos: (reportData.top_reasons || []).slice(0, 12),
      top_temas: (reportData.top_themes || []).slice(0, 12),
      top_orgaos: (reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || []).slice(0, 12),
      filtros_busca_atual: {
        year: searchYear.value || '',
        org: searchOrg.value || '',
        decision_group: searchDecisionGroup.value || 'todos',
        theme: searchTheme.value || '',
        query: searchQuery.value.trim() || '',
      },
      resultados_busca_amostra: lastSearchResults.slice(0, 40).map((row) => ({
        year: row.year,
        org: row.org,
        decision: row.decision,
        theme: row.theme,
        subject: row.subject,
        request_link: row.request_link,
        text_excerpt: row.text_excerpt,
      })),
      aviso_amostra: (reportData.search_dashboard || {}).sample_method || '',
    };
  }

  function buildAiSystemPrompt() {
    return [
      'Você é um analista de transparência pública e LAI no Brasil.',
      'Responda sempre em português do Brasil, sem jargão e de forma direta.',
      'Objetivo: ajudar o usuário a entender negativas e montar pedidos/recursos melhores.',
      'Estrutura padrão em 4 blocos curtos: leitura do caso, motivo provável da negativa, argumentos para recurso, exemplo de texto pronto.',
      'Use apenas o contexto JSON fornecido. Não invente números ou fatos.',
      'Quando faltar base, diga: "sem evidência suficiente na base desta página".',
      'Para precedentes, oriente consulta no link oficial de precedentes (CGU/CMRI) enviado no contexto.',
      'Quando for útil, inclua checklist simples: o que pedir, para qual órgão, período temporal e formato de entrega da informação.',
      'Não substitua orientação jurídica formal; mantenha tom informativo e prático.',
    ].join('\n');
  }

  function extractGeminiAnswer(data) {
    return (data.candidates || [])
      .flatMap((candidate) => (((candidate || {}).content || {}).parts || []))
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }

  function extractGeminiFinishReason(data) {
    return ((data.candidates || [])[0] || {}).finishReason || '';
  }

  async function callGemini(apiKey, contents, systemPrompt) {
    const resp = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'text/plain',
        },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || `HTTP ${resp.status}`);
    }
    return data;
  }

  async function askGemini() {
    aiStatus.textContent = '';

    const apiKey = geminiKeyInput.value.trim();
    const question = aiQuestion.value.trim();

    if (!apiKey) {
      pushAiMessage('assistant', 'Cole sua Gemini API key para usar o chat.');
      return;
    }
    if (!question) {
      pushAiMessage('assistant', 'Escreva uma pergunta primeiro.');
      return;
    }

    saveGeminiKey();
    maybeResetAiHistoryOnContextChange();

    aiAskBtn.disabled = true;
    aiQuestion.value = '';

    const cleanQuestion = question.replace(/\s+/g, ' ').trim();
    pushAiMessage('user', cleanQuestion);
    const pendingIndex = pushAiMessage('assistant', 'Analisando seu caso com base no painel...');

    const contextPayload = buildAiContextPayload();
    const systemPrompt = buildAiSystemPrompt();
    const contextText = `CONTEXTO_JSON_DA_PAGINA:\n${JSON.stringify(contextPayload)}`;

    try {
      const conversation = [
        { role: 'user', parts: [{ text: contextText }] },
        ...aiHistory,
        { role: 'user', parts: [{ text: cleanQuestion }] },
      ];

      const chunks = [];
      let finishReason = '';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await callGemini(apiKey, conversation, systemPrompt);
        const piece = extractGeminiAnswer(response);
        finishReason = extractGeminiFinishReason(response);

        if (piece) {
          chunks.push(piece);
          conversation.push({ role: 'model', parts: [{ text: piece }] });
          updateAiMessage(pendingIndex, `${chunks.join('\n\n')}${finishReason === 'MAX_TOKENS' ? '\n\n[continuando...]' : ''}`);
        }

        if (finishReason !== 'MAX_TOKENS') break;
        conversation.push({ role: 'user', parts: [{ text: GEMINI_CONTINUE_PROMPT }] });
      }

      let answer = chunks.join('\n\n').trim();
      if (!answer) answer = 'Sem evidência suficiente na base desta página para responder com segurança.';
      if (finishReason === 'MAX_TOKENS') answer += '\n\n[resposta cortada por limite de tokens]';

      updateAiMessage(pendingIndex, answer);

      aiHistory.push({ role: 'user', parts: [{ text: cleanQuestion }] });
      aiHistory.push({ role: 'model', parts: [{ text: answer }] });
      if (aiHistory.length > 16) aiHistory = aiHistory.slice(-16);
    } catch (error) {
      updateAiMessage(pendingIndex, `Falha ao consultar Gemini: ${error.message}`);
      aiStatus.textContent = `Erro no Gemini: ${error.message}`;
    } finally {
      aiAskBtn.disabled = false;
      aiQuestion.focus();
    }
  }

  async function loadRequestSamples() {
    const samplePath = ((reportData.search_dashboard || {}).sample_file) || './data/request_samples.jsonl.gz';

    try {
      const text = await fetchGzipText(samplePath);
      requestSamples = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .map((row) => ({
          ...row,
          year: Number(row.year || 0),
          search_blob: normalizeForSearch(`${row.org || ''} ${row.subject || ''} ${row.text_excerpt || ''} ${row.theme || ''} ${row.decision || ''} ${row.reason || ''}`),
        }));
    } catch (error) {
      requestSamples = [];
      searchStatus.textContent = `Não foi possível carregar a amostra de pedidos: ${error.message}`;
      searchStatus.classList.add('error');
    }
  }

  function bindEvents() {
    searchBtn.addEventListener('click', runRequestSearch);
    [searchYear, searchOrg, searchDecisionGroup, searchTheme].forEach((el) => {
      el.addEventListener('change', runRequestSearch);
    });
    searchQuery.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runRequestSearch();
      }
    });

    aiAskBtn.addEventListener('click', askGemini);
    aiQuestion.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askGemini();
      }
    });

    aiResetBtn.addEventListener('click', () => {
      resetAiConversation('Nova conversa iniciada. Pode mandar seu caso.');
    });

    [aiYearFilter, aiOrgFilter, searchYear, searchOrg, searchDecisionGroup, searchTheme].forEach((el) => {
      el.addEventListener('change', maybeResetAiHistoryOnContextChange);
    });
    searchQuery.addEventListener('input', maybeResetAiHistoryOnContextChange);
  }

  async function boot() {
    bindEvents();

    try {
      [reportData, metadata] = await Promise.all([
        fetchJson(DATA_FILE),
        fetchJson(METADATA_FILE).catch(() => null),
      ]);
    } catch (error) {
      narrativeList.innerHTML = `<li class="error">Falha ao carregar os dados: ${esc(error.message)}</li>`;
      return;
    }

    partialYearCtx = getPartialYearContext(reportData.series || []);
    renderHeaderMeta();
    renderMetrics();
    renderAlertsSummary();
    renderNarrative();
    renderCharts();
    renderTables();
    renderOrgCards();
    renderMethodology();

    restoreGeminiKey();
    populateAiFilters();
    resetAiConversation('Pronto. Descreva seu caso e eu te ajudo com leitura da negativa e rascunho de pedido/recurso.');

    await loadRequestSamples();
    renderSearchFilters();
    runRequestSearch();
  }

  boot();
})();
