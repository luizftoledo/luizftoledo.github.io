(() => {
  const SOURCES_INDEX_FILE = './data/report_sources.json';
  const FALLBACK_SOURCES = {
    ampla: {
      id: 'ampla',
      label: 'Base ampla CGU (todos os pedidos e recursos)',
      report_file: './data/report_data.json',
      metadata_file: './data/metadata.json',
      samples_file: './data/request_samples.jsonl.gz',
    },
    publica: {
      id: 'publica',
      label: 'Base pública BuscaLAI (pedidos marcados como públicos)',
      report_file: './data/report_data_publica.json',
      metadata_file: './data/metadata_publica.json',
      samples_file: './data/request_samples_publica.jsonl.gz',
    },
  };

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
  const sourceSelect = document.getElementById('source-select');
  const sourceNote = document.getElementById('source-note');

  const metricTotalRequests = document.getElementById('metric-total-requests');
  const metricDeniedTotal = document.getElementById('metric-denied-total');
  const metricRestrictedTotal = document.getElementById('metric-restricted-total');
  const metricPersonalTotal = document.getElementById('metric-personal-total');

  const narrativeList = document.getElementById('narrative-list');
  const alertsSummary = document.getElementById('alerts-summary');

  const tableYearly = document.getElementById('table-yearly');
  const tableReasonsHead = document.getElementById('table-reasons-head');
  const tableReasons = document.getElementById('table-reasons');
  const tableReasonsNote = document.getElementById('table-reasons-note');
  const reasonModeGlobal = document.getElementById('reason-mode-global');
  const reasonModeYearly = document.getElementById('reason-mode-yearly');
  const reasonYearFilter = document.getElementById('reason-year-filter');
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
  const sourcesList = document.getElementById('sources-list');

  const chartInstances = [];
  const MOBILE_SAMPLE_LIMIT = 25000;
  const MOBILE_LIGHT_MODE = (() => {
    const smallScreen = window.matchMedia ? window.matchMedia('(max-width: 820px)').matches : false;
    const lowRam = Number.isFinite(Number(navigator.deviceMemory)) && Number(navigator.deviceMemory) <= 4;
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    return smallScreen || lowRam || saveData;
  })();

  let reportData = null;
  let metadata = null;
  let requestSamples = [];
  let sourceCatalog = {};
  let sourceDataMap = {};
  let samplesBySource = {};
  let samplesLoadedBySource = {};
  let activeSourceId = '';
  let reasonTableMode = 'global';
  let reasonSelectedYear = '';
  let lastSearchResults = [];
  let partialYearCtx = null;

  let aiMessages = [];
  let aiHistory = [];
  let aiContextStamp = '';
  let sampleLoadNotice = '';

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

  function isPlaceholderText(value) {
    const normalized = normalizeForSearch(value);
    return !normalized
      || normalized === '--'
      || normalized === 'assunto nao informado'
      || normalized === 'motivo nao informado'
      || normalized === 'sem decisao registrada'
      || normalized === 'sem motivo registrado'
      || normalized === 'outros temas';
  }

  function isSearchRowUseful(row) {
    if (!row) return false;
    const text = (row.text_excerpt || '').toString().trim();
    const hasText = text.length >= 16 && !isPlaceholderText(text);
    const hasSubject = !isPlaceholderText(row.subject || '');
    const hasDecision = !isPlaceholderText(row.decision || '');
    const hasReason = !isPlaceholderText(row.reason || '');
    const hasTheme = !isPlaceholderText(row.theme || '');
    return hasText || hasSubject || hasDecision || hasReason || hasTheme;
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

  function setSearchControlsDisabled(disabled) {
    [searchYear, searchOrg, searchDecisionGroup, searchTheme, searchQuery].forEach((el) => {
      if (!el) return;
      el.disabled = disabled;
    });
  }

  function setSearchDeferredState() {
    requestSamples = [];
    lastSearchResults = [];
    searchYear.innerHTML = '<option value="">Ano: todos</option>';
    searchOrg.innerHTML = '<option value="">Órgão: todos</option>';
    searchTheme.innerHTML = '<option value="">Tema detectado: todos</option>';
    renderSearchDecisionOptions();
    presetRow.innerHTML = '<span class="search-status">Filtros prontos ficam ativos depois de carregar a base textual.</span>';
    tableSearchResults.innerHTML = '<tr><td colspan="7">Modo leve no mobile: toque em <strong>Carregar pedidos</strong> para abrir a busca detalhada.</td></tr>';
    searchStatus.textContent = 'Modo leve no mobile ativo. A tabela de pedidos será carregada sob demanda para evitar travamentos.';
    searchStatus.classList.remove('error');
    setSearchControlsDisabled(true);
    searchBtn.disabled = false;
    searchBtn.textContent = 'Carregar pedidos';
  }

  async function ensureRequestSamplesReady(sourceId) {
    if (samplesLoadedBySource[sourceId]) {
      requestSamples = samplesBySource[sourceId] || [];
      return true;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = 'Carregando...';
    searchStatus.classList.remove('error');
    searchStatus.textContent = 'Carregando amostra textual de pedidos...';
    try {
      await loadRequestSamples(sourceId);
      if (!samplesLoadedBySource[sourceId]) return false;
      renderSearchFilters();
      setSearchControlsDisabled(false);
      searchBtn.textContent = 'Buscar';
      return true;
    } finally {
      searchBtn.disabled = false;
      if (!samplesLoadedBySource[sourceId]) {
        searchBtn.textContent = 'Carregar pedidos';
      }
    }
  }

  function compactText(text, limit = 220) {
    const clean = (text || '').toString().replace(/\s+/g, ' ').trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit - 1).trim()}…`;
  }

  function getLoadedSourceIds() {
    return Object.keys(sourceDataMap).filter((id) => sourceDataMap[id] && sourceDataMap[id].report);
  }

  function describeSource(sourceId, sourceLabel) {
    if (sourceId === 'ampla') {
      return `${sourceLabel || 'Base ampla'}: inclui todos os pedidos e recursos do Fala.BR (escopo mais completo), porém sem detalhamento textual completo do pedido em todos os casos.`;
    }
    if (sourceId === 'publica') {
      return `${sourceLabel || 'Base pública'}: inclui os pedidos marcados como públicos no BuscaLAI; é menor, mas permite leitura mais rica do conteúdo do pedido e dos anexos.`;
    }
    return sourceLabel || 'Fonte de dados da análise.';
  }

  function renderSourceSelector() {
    if (!sourceSelect) return;
    const ids = getLoadedSourceIds();
    sourceSelect.innerHTML = ids.map((id) => {
      const label = ((sourceDataMap[id] || {}).cfg || {}).label || id;
      return `<option value="${esc(id)}">${esc(label)}</option>`;
    }).join('');
    if (ids.includes(activeSourceId)) sourceSelect.value = activeSourceId;
  }

  function renderSourceNote() {
    if (!sourceNote || !reportData) return;
    const source = reportData.source || {};
    const ids = getLoadedSourceIds();
    const sourceLabel = source.source_label || (((sourceDataMap[activeSourceId] || {}).cfg || {}).label || '');
    const note = describeSource(source.source_id || activeSourceId, sourceLabel);
    const extra = ids.length >= 2
      ? ' Você pode trocar a fonte no seletor acima.'
      : '';
    sourceNote.textContent = `${note}${extra}`;
  }

  function buildBuscaRequestLink(idPedido) {
    const id = (idPedido || '').toString().trim();
    if (!/^\d+$/.test(id)) return '';
    if (!id) return '';
    return `https://buscalai.cgu.gov.br/busca/${encodeURIComponent(id)}`;
  }

  function buildApiRequestLink(idPedido) {
    const id = (idPedido || '').toString().trim();
    if (!/^\d+$/.test(id)) return '';
    if (!id) return '';
    return `https://api-laibr.cgu.gov.br/buscar-pedidos/${encodeURIComponent(id)}`;
  }

  function isBuscaRequestLink(url) {
    const raw = (url || '').toString().trim();
    const match = raw.match(/buscalai\.cgu\.gov\.br\/busca\/([^/?#]+)/i);
    if (!match) return false;
    try {
      return /^\d+$/.test(decodeURIComponent(match[1] || '').trim());
    } catch (error) {
      return false;
    }
  }

  function isApiRequestLink(url) {
    const raw = (url || '').toString().trim();
    const match = raw.match(/api-laibr\.cgu\.gov\.br\/buscar-pedidos\/([^/?#]+)/i);
    if (!match) return false;
    try {
      return /^\d+$/.test(decodeURIComponent(match[1] || '').trim());
    } catch (error) {
      return false;
    }
  }

  function isHttpUrl(url) {
    const raw = (url || '').toString().trim();
    if (!raw) return false;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  function resolveRequestLinks(idPedido, requestPublicLink, requestAttachmentLink, requestFallbackLink) {
    const id = (idPedido || '').toString().trim();
    const publicRaw = (requestPublicLink || '').toString().trim();
    const attachmentRaw = (requestAttachmentLink || '').toString().trim();
    const fallbackRaw = (requestFallbackLink || '').toString().trim();

    let apiLink = buildApiRequestLink(id);
    let buscaLink = '';
    let externalPublicLink = '';
    const acceptAttachmentLink = (url) => {
      if (!isHttpUrl(url)) return '';
      if (/buscalai\.cgu\.gov\.br\/busca\//i.test(url)) {
        return isBuscaRequestLink(url) ? url : '';
      }
      if (/api-laibr\.cgu\.gov\.br\/buscar-pedidos\//i.test(url)) {
        return isApiRequestLink(url) ? url : '';
      }
      return url;
    };
    let attachmentLink = acceptAttachmentLink(attachmentRaw);

    if (publicRaw) {
      if (isApiRequestLink(publicRaw)) {
        apiLink = publicRaw;
      } else if (isBuscaRequestLink(publicRaw)) {
        buscaLink = publicRaw;
      } else if (!externalPublicLink && isHttpUrl(publicRaw) && !/buscalai\.cgu\.gov\.br|api-laibr\.cgu\.gov\.br/i.test(publicRaw)) {
        externalPublicLink = publicRaw;
      }
    }

    if (fallbackRaw) {
      if (!apiLink && isApiRequestLink(fallbackRaw)) {
        apiLink = fallbackRaw;
      } else if (!buscaLink && isBuscaRequestLink(fallbackRaw)) {
        buscaLink = fallbackRaw;
      } else if (!externalPublicLink && isHttpUrl(fallbackRaw) && !/buscalai\.cgu\.gov\.br|api-laibr\.cgu\.gov\.br/i.test(fallbackRaw)) {
        externalPublicLink = fallbackRaw;
      }
    }

    const publicLink = apiLink || buscaLink || externalPublicLink;
    if (!attachmentLink) {
      attachmentLink = acceptAttachmentLink(fallbackRaw);
    }
    return {
      request_public_link: publicLink,
      request_api_link: apiLink,
      request_buscalai_link: buscaLink,
      request_attachment_link: attachmentLink,
      request_link: publicLink || attachmentLink,
    };
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
    if (window.pako && typeof window.pako.ungzip === 'function') {
      return window.pako.ungzip(new Uint8Array(gzBuffer), { to: 'string' });
    }
    throw new Error('Navegador sem suporte local para descompactar gzip (pako/DecompressionStream).');
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
    renderSourceNote();
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
    const topRateRows = (monitoring.top_denial_rate_current_year || []).slice(0, 5);
    const minRequestsTopRate = Number(monitoring.top_denial_rate_min_requests || 0);
    const topRateHtml = topRateRows.length
      ? `<ol>${topRateRows.map((row) => `
          <li><strong>${esc(row.org)}</strong>: <strong>${pFmt.format(row.denied_rate || 0)}</strong> de negativas no ano vigente, com <strong>${nFmt.format(row.denied_total || 0)}</strong> negados em <strong>${nFmt.format(row.total_requests || 0)}</strong> pedidos.</li>
        `).join('')}</ol>`
      : '<p>Sem dados suficientes para montar o ranking proporcional neste momento.</p>';

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
        <h3>Top 5 taxas de negativa no ano vigente</h3>
        <p>Ranking proporcional: mostra quem mais nega em relação ao próprio volume de pedidos no ano atual (até ${esc(monitoring.latest_month_label || '--')}), com mínimo de ${nFmt.format(minRequestsTopRate)} pedidos no período.</p>
        ${topRateHtml}
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
    const sourceScope = (m.data_scope || source.source_label || '').trim();
    const themes = ((((m.theme_classification || {}).themes) || [])).map((item) => ({
      theme: item.theme,
      keywords: (item.keywords || []).slice(0, 8),
    }));
    const files = (m.source_files || []).map((item) => `<code>${esc(item)}</code>`).join(', ');
    const comparisonRule = (((m.monitoring_rules || {}).government_diagnosis) || '').trim();
    const topRateRule = (((m.monitoring_rules || {}).top_denial_rate_current_year) || '').trim();
    const themeRule = (((m.monitoring_rules || {}).theme_worsening) || '').trim();
    const samplingMethodRaw = (((m.sampling_for_search || {}).method) || '').toString();
    const samplingMethod = samplingMethodRaw.replace(/top\s*10\+pf/gi, 'top 10');

    methodologyContent.innerHTML = `
      ${sourceScope ? `<p><strong>Escopo desta fonte:</strong> ${esc(sourceScope)}.</p>` : ''}
      <p><strong>Comparação entre fontes:</strong> a base ampla (Fala.BR) traz o universo total de pedidos e recursos e tende a ter números maiores. A base pública (BuscaLAI) é um subconjunto com pedidos marcados como públicos e costuma ter menos registros, mas maior detalhamento textual para análise qualitativa.</p>
      <p><strong>Fonte oficial:</strong> <a href="${esc(source.portal_url || '#')}" target="_blank" rel="noopener noreferrer">Portal de dados da CGU</a>. Arquivos usados: ${files || '--'}.</p>

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
          <li><strong>Amostra para busca:</strong> ${samplingMethod ? esc(samplingMethod) : '--'}.</li>
          <li><strong>Volume da amostra:</strong> <strong>${nFmt.format(Number((m.sampling_for_search || {}).sample_count || 0))}</strong> pedidos.</li>
          <li><strong>Cobertura completa no top 10:</strong> <strong>${nFmt.format(Number((m.sampling_for_search || {}).top_org_rows_in_search || 0))}</strong> pedidos.</li>
          <li><strong>Links de pedido:</strong> o botão <code>Pedido</code> abre o detalhe via API pública da CGU (<code>/buscar-pedidos/{id}</code>); quando existir, também aparece link de <code>Anexo</code>. Em parte dos pedidos antigos, a página pública pode não estar mais disponível.</li>
        </ul>
      </details>

      <details class="methodology-details">
        <summary>Regras dos alertas do monitoramento</summary>
        <ul>
          <li><strong>Diagnóstico do período:</strong> ${comparisonRule ? esc(comparisonRule) : '--'}.</li>
          <li><strong>Top 5 proporcional por negativa:</strong> ${topRateRule ? esc(topRateRule) : '--'}.</li>
          <li><strong>Piora por tema:</strong> ${themeRule ? esc(themeRule) : '--'}.</li>
        </ul>
      </details>
    `;
  }

  function renderSourcesFooter() {
    if (!sourcesList) return;

    const source = reportData.source || {};
    const years = source.years_covered || [];
    const template = source.download_url_template || '';
    const links = [];
    const seen = new Set();

    const addLink = (label, url) => {
      const clean = (url || '').toString().trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      links.push({ label, url: clean });
    };

    addLink('Portal oficial de download (Busca LAI / CGU)', source.portal_url);
    years.forEach((year) => {
      if (!template.includes('{year}')) return;
      addLink(`Arquivo anual ${year} (ZIP com CSV)`, template.replace('{year}', String(year)));
    });
    addLink('Busca de precedentes recursais (CGU/CMRI)', source.precedentes_url);
    addLink('Painel oficial LAI (Central de Painéis CGU)', 'https://centralpaineis.cgu.gov.br/visualizar/lai');
    addLink('API pública do painel LAI (Central de Painéis CGU)', 'https://centralpaineis.cgu.gov.br/api/publico/visualizar/lai');
    addLink('API pública de detalhe do pedido', 'https://api-laibr.cgu.gov.br/buscar-pedidos/{id_pedido}');
    addLink('Busca direta por pedido no BuscaLAI', 'https://buscalai.cgu.gov.br/busca/{id_pedido}');

    sourcesList.innerHTML = links.length
      ? links.map((item) => (
        `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)}</a></li>`
      )).join('')
      : '<li>Sem links disponíveis no momento.</li>';
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
    if (typeof window.Chart !== 'function') {
      narrativeList.innerHTML = '<li class="error">Falha ao renderizar gráficos: biblioteca Chart indisponível.</li>';
      return;
    }

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

  function getReasonYears() {
    return [...new Set((reportData.reason_series || []).map((row) => Number(row.year || 0)).filter(Number.isFinite))]
      .sort((a, b) => b - a);
  }

  function renderReasonYearOptions() {
    if (!reasonYearFilter) return;
    const years = getReasonYears();
    if (!years.length) {
      reasonYearFilter.innerHTML = '';
      reasonYearFilter.hidden = true;
      reasonSelectedYear = '';
      return;
    }

    const selectedNum = Number(reasonSelectedYear);
    if (!Number.isFinite(selectedNum) || !years.includes(selectedNum)) {
      reasonSelectedYear = String(years[0]);
    }

    reasonYearFilter.innerHTML = years.map((year) => {
      const label = (partialYearCtx && Number(partialYearCtx.year) === year) ? `${year}*` : String(year);
      return `<option value="${year}">${label}</option>`;
    }).join('');
    reasonYearFilter.value = reasonSelectedYear;
  }

  function updateReasonModeButtons() {
    if (!reasonModeGlobal || !reasonModeYearly) return;
    const globalActive = reasonTableMode === 'global';
    reasonModeGlobal.classList.toggle('active', globalActive);
    reasonModeGlobal.setAttribute('aria-selected', globalActive ? 'true' : 'false');
    reasonModeYearly.classList.toggle('active', !globalActive);
    reasonModeYearly.setAttribute('aria-selected', globalActive ? 'false' : 'true');
    if (reasonYearFilter) {
      renderReasonYearOptions();
      reasonYearFilter.hidden = globalActive;
      reasonYearFilter.disabled = globalActive;
    }
  }

  function renderReasonsTable() {
    if (!tableReasons || !tableReasonsHead || !tableReasonsNote) return;

    if (reasonTableMode === 'year') {
      const selectedYear = Number(reasonSelectedYear || 0);
      const yearRows = (reportData.reason_series || [])
        .filter((row) => Number(row.year || 0) === selectedYear)
        .map((row) => ({
          reason: row.reason || 'Motivo não informado',
          count: Number(row.count || 0),
        }))
        .sort((a, b) => b.count - a.count);

      tableReasonsHead.innerHTML = `
        <th>Posição</th>
        <th>Motivo</th>
        <th>Quantidade</th>
        <th>% das restrições do ano</th>
      `;

      const yearSeries = (reportData.series || []).find((row) => Number(row.year || 0) === selectedYear);
      const restrictedTotal = Number((yearSeries || {}).restricted_total || 0);
      const yearLabel = (partialYearCtx && Number(partialYearCtx.year) === selectedYear) ? `${selectedYear}*` : String(selectedYear);

      if (!yearRows.length) {
        tableReasons.innerHTML = '<tr><td colspan="4">Sem dados de motivos para o ano selecionado.</td></tr>';
        tableReasonsNote.textContent = `Sem dados de motivo para ${yearLabel}.`;
        return;
      }

      tableReasons.innerHTML = yearRows.slice(0, 20).map((row, index) => `
        <tr class="${index === 0 ? 'reason-top-row' : ''}">
          <td>${index + 1}</td>
          <td>${esc(row.reason)}</td>
          <td>${nFmt.format(row.count || 0)}</td>
          <td>${restrictedTotal ? pFmt.format((row.count || 0) / restrictedTotal) : '--'}</td>
        </tr>
      `).join('');
      tableReasonsNote.innerHTML = `Ano selecionado: <strong>${esc(yearLabel)}</strong>. A linha destacada mostra o motivo nº 1 do ano.`;
      return;
    }

    tableReasonsHead.innerHTML = `
      <th>Posição</th>
      <th>Motivo</th>
      <th>Quantidade</th>
      <th>% do total com restrição</th>
    `;
    const totalRestricted = Number((reportData.overall || {}).restricted_total || 0);
    tableReasons.innerHTML = (reportData.top_reasons || []).slice(0, 15).map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(row.reason)}</td>
        <td>${nFmt.format(row.count || 0)}</td>
        <td>${totalRestricted ? pFmt.format((row.count || 0) / totalRestricted) : '--'}</td>
      </tr>
    `).join('');
    tableReasonsNote.innerHTML = 'Ranking geral da série histórica completa.';
  }

  function renderTables() {
    if (tableYearly) {
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
    }

    renderReasonsTable();

    const top = reportData.org_top10_plus_pf || reportData.org_top5_plus_pf || [];
    if (tableOrgTop) {
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
    }

    if (tablePersonalTop) {
      tablePersonalTop.innerHTML = (((reportData.personal_info || {}).top_orgs) || []).slice(0, 20).map((row) => `
      <tr>
        <td>${esc(row.org)}</td>
        <td>${nFmt.format(row.personal_restricted_total || 0)}</td>
        <td>${nFmt.format(row.restricted_total || 0)}</td>
        <td>${pFmt.format(row.share_in_org_restricted || 0)}</td>
      </tr>
    `).join('');
    }
  }

  function renderOrgCards() {
    if (!orgCards) return;
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
        const blocks = examples.map((example, idx) => {
          const text = typeof example === 'string'
            ? example
            : (example.text_excerpt || '');
          const linkPack = typeof example === 'string'
            ? resolveRequestLinks('', '', '', '')
            : resolveRequestLinks(
              example.id_pedido || '',
              example.request_public_link || '',
              example.request_attachment_link || '',
              example.request_link || '',
            );
          const requestPublicLink = linkPack.request_public_link || '';
          const requestAttachmentLink = linkPack.request_attachment_link || '';

          const links = [
            requestPublicLink ? `<a href="${esc(requestPublicLink)}" target="_blank" rel="noopener noreferrer">Abrir pedido completo</a>` : '',
            (requestAttachmentLink && requestAttachmentLink !== requestPublicLink)
              ? `<a href="${esc(requestAttachmentLink)}" target="_blank" rel="noopener noreferrer">Abrir anexo</a>`
              : '',
          ].filter(Boolean).join(' · ');

          return `
            <details class="org-example"${idx === 0 ? ' open' : ''}>
              <summary><span class="key-pill">${esc(item.theme)}</span> Exemplo ${idx + 1}</summary>
              <p class="org-note">${esc(text || '--')}</p>
              ${links ? `<p class="org-example-links">${links}</p>` : ''}
            </details>
          `;
        }).join('');
        return `
          ${blocks}
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
    setSearchControlsDisabled(false);
    searchBtn.textContent = 'Buscar';
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
    if (!samplesLoadedBySource[activeSourceId]) {
      tableSearchResults.innerHTML = '<tr><td colspan="7">A busca detalhada ainda não foi carregada neste aparelho. Toque em <strong>Carregar pedidos</strong>.</td></tr>';
      searchStatus.textContent = 'Modo leve no mobile: a base textual dos pedidos é carregada sob demanda.';
      searchStatus.classList.remove('error');
      return;
    }

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
          <td>${[
            row.request_public_link ? `<a href="${esc(row.request_public_link)}" target="_blank" rel="noopener noreferrer">Pedido</a>` : '',
            (row.request_attachment_link && row.request_attachment_link !== row.request_public_link)
              ? `<a href="${esc(row.request_attachment_link)}" target="_blank" rel="noopener noreferrer">Anexo</a>`
              : '',
          ].filter(Boolean).join(' · ') || '--'}</td>
          <td>${esc(row.text_excerpt || '--')}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="7">Nenhum resultado para esse filtro.</td></tr>';

    const notice = sampleLoadNotice ? ` ${esc(sampleLoadNotice)}` : '';
    searchStatus.innerHTML = `Busca em <strong>${nFmt.format(requestSamples.length)}</strong> pedidos carregados desta fonte. Resultado atual: <strong>${nFmt.format(filtered.length)}</strong> registros${filtered.length > shown.length ? ` (mostrando ${nFmt.format(shown.length)}).` : '.'}${notice}`;
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

  async function loadRequestSamples(sourceId) {
    if (samplesLoadedBySource[sourceId]) {
      requestSamples = samplesBySource[sourceId];
      return;
    }

    const sourceCfg = ((sourceDataMap[sourceId] || {}).cfg) || {};
    const samplePath = sourceCfg.samples_file || ((reportData.search_dashboard || {}).sample_file) || './data/request_samples.jsonl.gz';

    try {
      const text = await fetchGzipText(samplePath);
      const isMobileMode = window.matchMedia('(max-width: 680px)').matches || (Number(navigator.deviceMemory || 0) > 0 && Number(navigator.deviceMemory || 0) <= 4);
      const maxRows = isMobileMode ? MOBILE_SAMPLE_LIMIT : Number.POSITIVE_INFINITY;
      const parsed = [];
      let parsedCount = 0;

      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (!line) continue;
        let row = null;
        try {
          row = JSON.parse(line);
        } catch {
          row = null;
        }
        if (!row) continue;
        const normalizedRow = (() => {
          const idPedido = (row.id_pedido || '').toString().trim();
          const linkPack = resolveRequestLinks(
            idPedido,
            row.request_public_link || '',
            row.request_attachment_link || row.request_link || '',
            row.request_link || '',
          );
          return {
            ...row,
            ...linkPack,
            id_pedido: idPedido,
            year: Number(row.year || 0),
            search_blob: normalizeForSearch(`${row.org || ''} ${row.subject || ''} ${row.text_excerpt || ''} ${row.theme || ''} ${row.decision || ''} ${row.reason || ''}`),
          };
        })();
        if (!isSearchRowUseful(normalizedRow)) continue;
        parsed.push(normalizedRow);
        parsedCount += 1;
        if (parsedCount >= maxRows) break;
      }

      samplesBySource[sourceId] = parsed;
      samplesLoadedBySource[sourceId] = true;
      requestSamples = parsed;
      sampleLoadNotice = (isMobileMode && Number.isFinite(maxRows) && parsedCount >= maxRows)
        ? `Modo leve no mobile: primeiros ${nFmt.format(maxRows)} pedidos para estabilidade.`
        : '';
    } catch (error) {
      requestSamples = [];
      samplesLoadedBySource[sourceId] = false;
      sampleLoadNotice = '';
      searchStatus.textContent = `Não foi possível carregar a amostra de pedidos desta fonte: ${error.message}`;
      searchStatus.classList.add('error');
    }
  }

  async function loadSourceCatalogAndData() {
    let indexPayload = null;
    try {
      indexPayload = await fetchJson(SOURCES_INDEX_FILE);
    } catch {
      indexPayload = null;
    }

    const catalog = (indexPayload && indexPayload.sources) ? indexPayload.sources : FALLBACK_SOURCES;
    sourceCatalog = catalog;
    sourceDataMap = {};
    samplesBySource = {};
    samplesLoadedBySource = {};

    const entries = Object.entries(catalog);
    for (const [id, rawCfg] of entries) {
      const cfg = { id, ...rawCfg };
      const reportPath = cfg.report_file || (id === 'publica' ? FALLBACK_SOURCES.publica.report_file : FALLBACK_SOURCES.ampla.report_file);
      const metadataPath = cfg.metadata_file || (id === 'publica' ? FALLBACK_SOURCES.publica.metadata_file : FALLBACK_SOURCES.ampla.metadata_file);

      try {
        const [report, meta] = await Promise.all([
          fetchJson(reportPath),
          fetchJson(metadataPath).catch(() => null),
        ]);
        sourceDataMap[id] = { cfg, report, metadata: meta };
      } catch {
        // Ignora fontes indisponíveis para não quebrar o painel.
      }
    }

    const loaded = getLoadedSourceIds();
    if (!loaded.length) {
      throw new Error('Nenhuma fonte de dados da dashboard pôde ser carregada.');
    }

    const preferred = (indexPayload && indexPayload.default_source) || 'ampla';
    activeSourceId = loaded.includes(preferred) ? preferred : loaded[0];
  }

  async function applySource(sourceId) {
    const bundle = sourceDataMap[sourceId];
    if (!bundle) return;

    activeSourceId = sourceId;
    reportData = bundle.report;
    metadata = bundle.metadata;
    partialYearCtx = getPartialYearContext(reportData.series || []);

    renderSourceSelector();
    renderHeaderMeta();
    renderMetrics();
    renderAlertsSummary();
    renderNarrative();
    renderCharts();
    updateReasonModeButtons();
    renderTables();
    renderMethodology();
    renderSourcesFooter();

    restoreGeminiKey();
    populateAiFilters();
    resetAiConversation('Pronto. Descreva seu caso e eu te ajudo com leitura da negativa e rascunho de pedido/recurso.');
    if (MOBILE_LIGHT_MODE && !samplesLoadedBySource[sourceId]) {
      setSearchDeferredState();
      return;
    }

    await loadRequestSamples(sourceId);
    renderSearchFilters();
    setSearchControlsDisabled(false);
    searchBtn.textContent = 'Buscar';
    runRequestSearch();
  }

  function bindEvents() {
    if (reasonModeGlobal) {
      reasonModeGlobal.addEventListener('click', () => {
        reasonTableMode = 'global';
        updateReasonModeButtons();
        renderReasonsTable();
      });
    }
    if (reasonModeYearly) {
      reasonModeYearly.addEventListener('click', () => {
        reasonTableMode = 'year';
        updateReasonModeButtons();
        renderReasonsTable();
      });
    }
    if (reasonYearFilter) {
      reasonYearFilter.addEventListener('change', () => {
        reasonSelectedYear = reasonYearFilter.value || '';
        updateReasonModeButtons();
        renderReasonsTable();
      });
    }

    if (sourceSelect) {
      sourceSelect.addEventListener('change', async () => {
        await applySource(sourceSelect.value);
      });
    }

    searchBtn.addEventListener('click', async () => {
      if (!samplesLoadedBySource[activeSourceId]) {
        const ready = await ensureRequestSamplesReady(activeSourceId);
        if (!ready) return;
      }
      runRequestSearch();
    });
    [searchYear, searchOrg, searchDecisionGroup, searchTheme].forEach((el) => {
      el.addEventListener('change', () => {
        if (!samplesLoadedBySource[activeSourceId]) return;
        runRequestSearch();
      });
    });
    searchQuery.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!samplesLoadedBySource[activeSourceId]) {
          ensureRequestSamplesReady(activeSourceId).then((ready) => {
            if (ready) runRequestSearch();
          });
          return;
        }
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
      await loadSourceCatalogAndData();
      await applySource(activeSourceId);
    } catch (error) {
      narrativeList.innerHTML = `<li class="error">Falha ao carregar os dados: ${esc(error.message)}</li>`;
      return;
    }
  }

  boot();
})();
