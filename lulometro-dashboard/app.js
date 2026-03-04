(function () {
  const nFmt = new Intl.NumberFormat('pt-BR');
  const API_TIMEOUT_MS = 180000;
  const MAX_TABLE_ROWS = 600;
  const WORDCLOUD_DEFAULT_RANGE = 30;

  const els = {
    statusUpdated: document.getElementById('status-updated'),
    statusTotalDocs: document.getElementById('status-total-docs'),
    statusSources: document.getElementById('status-sources'),

    termInput: document.getElementById('term-input'),
    typeSelect: document.getElementById('type-select'),
    presidentSelect: document.getElementById('president-select'),
    mandateSelect: document.getElementById('mandate-select'),
    btnSearch: document.getElementById('btn-search'),
    btnClear: document.getElementById('btn-clear'),
    searchHint: document.getElementById('search-hint'),
    activeFilters: document.getElementById('active-filters'),
    loadRequiredBanner: document.getElementById('load-required-banner'),
    loadRequiredTitle: document.getElementById('load-required-title'),
    loadRequiredText: document.getElementById('load-required-text'),

    metricMentions: document.getElementById('metric-mentions'),
    metricDocs: document.getElementById('metric-docs'),
    metricPresidents: document.getElementById('metric-presidents'),
    metricWindow: document.getElementById('metric-window'),

    summaryText: document.getElementById('summary-text'),
    tableCount: document.getElementById('table-count'),
    resultsBody: document.getElementById('results-body'),
    examplesGrid: document.getElementById('examples-grid'),
    examplesHint: document.getElementById('examples-hint'),

    chartTimeline: document.getElementById('chart-timeline'),
    chartPresidents: document.getElementById('chart-presidents'),
    chartMandates: document.getElementById('chart-mandates'),
    methodologyNote: document.getElementById('methodology-note'),
    methodologyPresidentBody: document.getElementById('methodology-president-body'),
    methodologyMandateBody: document.getElementById('methodology-mandate-body'),

    wordcloudRange: document.getElementById('wordcloud-range'),
    wordcloudPhraseSize: document.getElementById('wordcloud-phrase-size'),
    wordcloudApply: document.getElementById('wordcloud-apply'),
    wordcloudContext: document.getElementById('wordcloud-context'),
    wordcloudCloud: document.getElementById('wordcloud-cloud'),
    wordcloudTableBody: document.getElementById('wordcloud-table-body'),
    wordcloudColLabel: document.getElementById('wordcloud-col-label'),

    loadProgressWrap: document.getElementById('load-progress-wrap'),
    loadProgressText: document.getElementById('load-progress-text'),
    loadProgressPct: document.getElementById('load-progress-pct'),
    loadProgressFill: document.getElementById('load-progress-fill'),
    loadProgressBar: document.querySelector('.load-progress-bar'),
  };

  const state = {
    apiBase: '',
    ready: false,
    bootstrap: null,
    bootstrapPromise: null,
    charts: [],
    searchRequestId: 0,
    wordcloudRequestId: 0,
    wordcloudCache: new Map(),
    searchResult: null,
  };

  function esc(value) {
    return (value || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateIso(dateIso) {
    if (!dateIso) return '--';
    const d = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateIso;
    return d.toLocaleDateString('pt-BR');
  }

  function formatDateTimeIso(value) {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function monthLabel(key) {
    if (!/^\d{4}-\d{2}$/.test(key || '')) return key || '--';
    const d = new Date(`${key}-01T00:00:00`);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }

  function setLoadProgress(visible, percent, text) {
    if (!els.loadProgressWrap || !els.loadProgressFill || !els.loadProgressPct || !els.loadProgressText) return;
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    els.loadProgressWrap.hidden = !visible;
    els.loadProgressFill.style.width = `${pct}%`;
    els.loadProgressPct.textContent = `${Math.round(pct)}%`;
    if (text) els.loadProgressText.textContent = text;
    if (els.loadProgressBar) {
      els.loadProgressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }

  function setLoadRequiredBanner(visible, titleText, bodyText) {
    if (!els.loadRequiredBanner) return;
    els.loadRequiredBanner.hidden = !visible;
    if (typeof titleText === 'string' && els.loadRequiredTitle) els.loadRequiredTitle.textContent = titleText;
    if (typeof bodyText === 'string' && els.loadRequiredText) els.loadRequiredText.textContent = bodyText;
  }

  function setControlsDisabled(disabled) {
    [els.termInput, els.typeSelect, els.presidentSelect, els.mandateSelect, els.btnClear].forEach((el) => {
      if (!el) return;
      el.disabled = disabled;
    });
    if (els.wordcloudRange) els.wordcloudRange.disabled = disabled;
    if (els.wordcloudPhraseSize) els.wordcloudPhraseSize.disabled = disabled;
    if (els.wordcloudApply) els.wordcloudApply.disabled = disabled;
  }

  function setDeferredSearchState() {
    setControlsDisabled(true);
    if (els.btnSearch) {
      els.btnSearch.disabled = false;
      els.btnSearch.textContent = '1) Carregar Dados';
    }
    setLoadRequiredBanner(
      true,
      'Passo 1 obrigatorio: clique em "1) Carregar Dados".',
      'A dashboard conecta no BigQuery via API e libera a busca completa sem baixar o corpus inteiro no seu navegador.'
    );
    if (els.searchHint) {
      els.searchHint.textContent = 'Clique em "1) Carregar Dados" para habilitar busca, graficos e nuvem de termos.';
    }
    if (els.summaryText) {
      els.summaryText.textContent = 'Busca textual indisponivel ate carregar os dados da API.';
    }
    if (els.tableCount) els.tableCount.textContent = '0 linhas';
    if (els.resultsBody) {
      els.resultsBody.innerHTML = '<tr><td colspan="8">Clique em <strong>Carregar Dados</strong> para iniciar.</td></tr>';
    }
    if (els.wordcloudContext) {
      els.wordcloudContext.textContent = 'Carregue os dados para habilitar a nuvem de termos.';
    }
    if (els.wordcloudCloud) {
      els.wordcloudCloud.innerHTML = '<span class="hint">Aguardando carregamento da API.</span>';
    }
    if (els.wordcloudTableBody) {
      els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    }
    if (els.examplesHint) {
      els.examplesHint.textContent = 'Busque um termo para ver exemplos reais dos 3 ultimos mandatos.';
    }
    if (els.examplesGrid) {
      els.examplesGrid.innerHTML = '';
    }
    if (els.methodologyPresidentBody) {
      els.methodologyPresidentBody.innerHTML = '<tr><td colspan="7">Carregue os dados para ver a cobertura por presidente.</td></tr>';
    }
    if (els.methodologyMandateBody) {
      els.methodologyMandateBody.innerHTML = '<tr><td colspan="7">Carregue os dados para ver a cobertura por mandato.</td></tr>';
    }
    if (els.metricMentions) els.metricMentions.textContent = '--';
    if (els.metricDocs) els.metricDocs.textContent = '--';
    if (els.metricPresidents) els.metricPresidents.textContent = '--';
    if (els.metricWindow) els.metricWindow.textContent = '--';
    destroyCharts();
  }

  function setReadyState() {
    state.ready = true;
    setControlsDisabled(false);
    if (els.btnSearch) {
      els.btnSearch.disabled = false;
      els.btnSearch.textContent = 'Buscar';
    }
    setLoadRequiredBanner(false);
  }

  function selectedText(selectEl, fallback) {
    if (!selectEl || !selectEl.options || typeof selectEl.selectedIndex !== 'number') return fallback;
    const opt = selectEl.options[selectEl.selectedIndex];
    return (opt && opt.textContent ? opt.textContent.trim() : '') || fallback;
  }

  function updateActiveFiltersBanner(filters, termRaw, resultCount) {
    if (!els.activeFilters) return;
    const typeText = selectedText(els.typeSelect, 'Entrevista + Discurso');
    const presText = selectedText(els.presidentSelect, 'Presidente: todos');
    const mandateText = selectedText(els.mandateSelect, 'Mandato: todos');
    const termText = termRaw ? `"${termRaw}"` : 'sem termo';
    const resultText = Number.isFinite(resultCount)
      ? ` | Resultado atual: ${nFmt.format(resultCount)} documentos`
      : '';
    els.activeFilters.textContent = `Filtros ativos agora -> ${typeText} | ${presText} | ${mandateText} | Termo: ${termText}${resultText}`;
  }

  function getActiveFilters() {
    return {
      typeFilter: (els.typeSelect && els.typeSelect.value) || 'ambos',
      presidentFilter: (els.presidentSelect && els.presidentSelect.value) || 'todos',
      mandateFilter: (els.mandateSelect && els.mandateSelect.value) || 'todos',
    };
  }

  async function fetchJson(url, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ao acessar API. ${text ? text.slice(0, 180) : ''}`.trim());
      }
      return await resp.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function normalizeApiBase(url) {
    if (!url || typeof url !== 'string') return '';
    return url.trim().replace(/\/+$/, '');
  }

  async function resolveApiBase() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = normalizeApiBase(params.get('api_base') || '');
    if (fromParam) return fromParam;

    const fromWindow = normalizeApiBase(window.LULOMETRO_API_BASE || '');
    if (fromWindow) return fromWindow;

    try {
      const cfg = await fetchJson(`./api-config.json?t=${Date.now()}`, 15000);
      const fromCfg = normalizeApiBase(cfg && cfg.api_base_url);
      if (fromCfg) return fromCfg;
    } catch (err) {
      // Optional config file.
    }

    return '';
  }

  function buildApiUrl(path, paramsObj) {
    if (!state.apiBase) throw new Error('API base URL nao configurada.');
    const url = new URL(`${state.apiBase}${path}`);
    const params = new URLSearchParams();
    Object.entries(paramsObj || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.set(key, String(value));
    });
    const queryStr = params.toString();
    return queryStr ? `${url.toString()}?${queryStr}` : url.toString();
  }

  function destroyCharts() {
    while (state.charts.length) {
      const chart = state.charts.pop();
      chart.destroy();
    }
  }

  function clampChartCanvasSize() {
    [els.chartTimeline, els.chartPresidents, els.chartMandates].forEach((canvas) => {
      if (!canvas) return;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.removeAttribute('width');
      canvas.removeAttribute('height');
    });
  }

  function renderCoverageRows(targetBody, rows, emptyText) {
    if (!targetBody) return;
    if (!rows.length) {
      targetBody.innerHTML = `<tr><td colspan="7">${esc(emptyText)}</td></tr>`;
      return;
    }

    targetBody.innerHTML = '';
    rows.forEach((row) => {
      const total = Number(row.total) || 0;
      const filled = Number(row.filled) || 0;
      const coveragePct = total ? ((filled * 100) / total).toFixed(1).replace('.', ',') : '0,0';
      const tr = document.createElement('tr');
      tr.innerHTML = [
        `<td>${esc(row.name || '--')}</td>`,
        `<td>${nFmt.format(Number(row.discurso_total) || 0)}</td>`,
        `<td>${nFmt.format(Number(row.entrevista_total) || 0)}</td>`,
        `<td>${nFmt.format(Number(row.discurso_filled) || 0)}</td>`,
        `<td>${nFmt.format(Number(row.entrevista_filled) || 0)}</td>`,
        `<td>${nFmt.format(filled)}</td>`,
        `<td>${coveragePct}%</td>`,
      ].join('');
      targetBody.appendChild(tr);
    });
  }

  function updateMethodologyBreakdowns() {
    if (!state.bootstrap) {
      renderCoverageRows(els.methodologyPresidentBody, [], 'Carregue os dados para ver a cobertura por presidente.');
      renderCoverageRows(els.methodologyMandateBody, [], 'Carregue os dados para ver a cobertura por mandato.');
      return;
    }

    const presRows = (state.bootstrap.presidents || []).slice()
      .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0)
        || (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    const mandateRows = (state.bootstrap.mandates || []).slice()
      .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0)
        || (a.name || '').localeCompare(b.name || '', 'pt-BR'));

    renderCoverageRows(els.methodologyPresidentBody, presRows, 'Sem dados por presidente.');
    renderCoverageRows(els.methodologyMandateBody, mandateRows, 'Sem dados por mandato.');
  }

  function updateMethodologyNote() {
    if (!els.methodologyNote) return;
    if (!state.bootstrap) {
      els.methodologyNote.textContent = 'A busca usa extracao textual automatizada (HTML e anexos PDF/TXT). Parte do acervo historico da Biblioteca da Presidencia e mais dificil de raspar por paginas antigas, links /view, anexos fora do ar e limitacoes anti-bot.';
      updateMethodologyBreakdowns();
      return;
    }

    const totalDocs = Number(state.bootstrap.total_docs) || 0;
    const totalFilled = Number(state.bootstrap.total_filled) || 0;
    const pct = totalDocs ? ((totalFilled * 100) / totalDocs).toFixed(2).replace('.', ',') : '0,00';
    const hiddenPresidents = (state.bootstrap.hidden_presidents || []).filter(Boolean);
    const hiddenMandates = (state.bootstrap.hidden_mandates || []).filter(Boolean);
    const hiddenPresPreview = hiddenPresidents.slice(0, 6).join('; ');
    const hiddenSuffix = hiddenPresidents.length > 6 ? '...' : '';
    const futureOutliers = Number(state.bootstrap.future_outlier_dates) || 0;
    const futureDatesNote = futureOutliers > 0
      ? ` Para a nuvem de termos por periodo, ${nFmt.format(futureOutliers)} documento(s) com data muito a frente foram ignorados para evitar distorcao temporal.`
      : '';

    els.methodologyNote.textContent = `Cobertura textual atual: ${pct}% (${nFmt.format(totalFilled)} de ${nFmt.format(totalDocs)} documentos). As tabelas abaixo mostram, para cada presidente e cada mandato, quantos discursos e entrevistas existem no acervo bruto e quantos entraram no buscador (texto recuperado). Desafios principais: documentos antigos com estrutura HTML irregular, links /view e anexos (PDF/TXT) indisponiveis ou lentos, alem de bloqueios anti-bot intermitentes na Biblioteca da Presidencia. Presidentes e mandatos com 0% de texto extraido foram ocultados dos filtros de busca para evitar resultados vazios; eles seguem no acervo bruto. Ocultos hoje: ${nFmt.format(hiddenPresidents.length)} presidentes e ${nFmt.format(hiddenMandates.length)} mandatos${hiddenPresidents.length ? ` (ex.: ${hiddenPresPreview}${hiddenSuffix})` : ''}. Em entrevistas, parte das mencoes pode vir do interlocutor (pergunta), nao apenas do presidente.${futureDatesNote}`;

    updateMethodologyBreakdowns();
  }

  function populateFilterOptions() {
    if (!state.bootstrap) return;

    if (els.presidentSelect) {
      els.presidentSelect.innerHTML = '<option value="todos">Presidente: todos</option>';
      (state.bootstrap.presidents || [])
        .filter((row) => (Number(row.filled) || 0) > 0)
        .sort((a, b) => (Number(b.filled) || 0) - (Number(a.filled) || 0)
          || (a.name || '').localeCompare(b.name || '', 'pt-BR'))
        .forEach((row) => {
          const opt = document.createElement('option');
          opt.value = row.name || '';
          opt.textContent = `${row.name} (${nFmt.format(Number(row.filled) || 0)} com texto)`;
          els.presidentSelect.appendChild(opt);
        });
    }

    if (els.mandateSelect) {
      els.mandateSelect.innerHTML = '<option value="todos">Mandato: todos</option>';
      (state.bootstrap.mandates || [])
        .filter((row) => (Number(row.filled) || 0) > 0)
        .sort((a, b) => {
          const ya = Number(((a.name || '').match(/(\d{4})/) || [0, 0])[1]);
          const yb = Number(((b.name || '').match(/(\d{4})/) || [0, 0])[1]);
          return yb - ya || (a.name || '').localeCompare(b.name || '', 'pt-BR');
        })
        .forEach((row) => {
          const opt = document.createElement('option');
          opt.value = row.name || '';
          opt.textContent = `${row.name} (${nFmt.format(Number(row.filled) || 0)} com texto)`;
          els.mandateSelect.appendChild(opt);
        });
    }
  }

  function getWordcloudPhraseModeLabel(mode) {
    if (mode === '1') return 'palavras isoladas';
    if (mode === '2') return 'frases de 2 palavras';
    if (mode === '3') return 'frases de 3 palavras';
    return 'frases de 2 e 3 palavras';
  }

  function getWordcloudParams() {
    const filters = getActiveFilters();
    const rangeDays = Number((els.wordcloudRange && els.wordcloudRange.value) || WORDCLOUD_DEFAULT_RANGE) || WORDCLOUD_DEFAULT_RANGE;
    const phraseMode = ((els.wordcloudPhraseSize && els.wordcloudPhraseSize.value) || '2-3').trim();
    return { filters, rangeDays, phraseMode };
  }

  function buildWordcloudCacheKey(params) {
    return [
      `r:${params.rangeDays}`,
      `pm:${params.phraseMode}`,
      `t:${params.filters.typeFilter}`,
      `p:${params.filters.presidentFilter}`,
      `m:${params.filters.mandateFilter}`,
    ].join('|');
  }

  function renderWordInsightsPlaceholder(message) {
    if (els.wordcloudContext) els.wordcloudContext.textContent = message;
    if (els.wordcloudCloud) els.wordcloudCloud.innerHTML = '<span class="hint">Aguardando atualizacao...</span>';
    if (els.wordcloudTableBody) els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  }

  function renderWordInsightsResult(params, payload) {
    if (!els.wordcloudCloud || !els.wordcloudTableBody || !els.wordcloudContext) return;

    if (els.wordcloudColLabel) {
      els.wordcloudColLabel.textContent = params.phraseMode === '1' ? 'Palavra' : 'Expressao';
    }

    const selectedPresident = params.filters.presidentFilter === 'todos' ? 'todos os presidentes' : params.filters.presidentFilter;
    const selectedMandate = params.filters.mandateFilter === 'todos' ? 'todos os mandatos' : params.filters.mandateFilter;
    const selectedType = params.filters.typeFilter === 'ambos' ? 'discursos + entrevistas' : params.filters.typeFilter;
    const modeLabel = getWordcloudPhraseModeLabel(params.phraseMode);
    const docsInWindow = Number(payload.docs_in_window) || 0;
    const docsScanned = Number(payload.docs_scanned) || 0;
    const truncatedNote = payload.docs_truncated
      ? ` Janela muito grande: analise limitada a ${nFmt.format(docsScanned)} docs para manter performance.`
      : '';

    els.wordcloudContext.textContent = `Janela: ${nFmt.format(params.rangeDays)} dias | Base analisada: ${nFmt.format(docsInWindow)} documentos | Modo: ${modeLabel} | Filtro atual: ${selectedType}; ${selectedPresident}; ${selectedMandate}.${truncatedNote}`;

    const topCloud = Array.isArray(payload.top_cloud) ? payload.top_cloud : [];
    const topTable = Array.isArray(payload.top_table) ? payload.top_table : [];

    els.wordcloudCloud.innerHTML = '';
    if (!topCloud.length) {
      els.wordcloudCloud.innerHTML = '<span class="hint">Sem termos suficientes no periodo selecionado.</span>';
    } else {
      const counts = topCloud.map((item) => Number(item.count) || 0);
      const min = Math.min(...counts);
      const max = Math.max(...counts);
      const spread = Math.max(1, max - min);
      topCloud.forEach((item) => {
        const word = item.word || '';
        const count = Number(item.count) || 0;
        const ratio = (count - min) / spread;
        const size = 0.86 + ratio * 1.9;
        const span = document.createElement('span');
        span.className = 'word-chip';
        span.textContent = word;
        span.style.fontSize = `${size.toFixed(2)}rem`;
        span.style.fontWeight = `${540 + Math.round(ratio * 240)}`;
        span.style.opacity = `${0.68 + ratio * 0.32}`;
        span.title = `${word}: ${nFmt.format(count)} ocorrencias`;
        els.wordcloudCloud.appendChild(span);
      });
    }

    els.wordcloudTableBody.innerHTML = '';
    if (!topTable.length) {
      els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Sem dados no periodo.</td></tr>';
      return;
    }

    topTable.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx + 1}</td><td>${esc(item.word || '--')}</td><td>${nFmt.format(Number(item.count) || 0)}</td>`;
      els.wordcloudTableBody.appendChild(tr);
    });
  }

  async function requestWordcloudUpdate(force) {
    if (!state.ready) return;
    const params = getWordcloudParams();
    const cacheKey = buildWordcloudCacheKey(params);

    if (!force && state.wordcloudCache.has(cacheKey)) {
      renderWordInsightsResult(params, state.wordcloudCache.get(cacheKey));
      return;
    }

    state.wordcloudRequestId += 1;
    const requestId = state.wordcloudRequestId;
    if (els.wordcloudApply) {
      els.wordcloudApply.disabled = true;
      els.wordcloudApply.textContent = 'Atualizando...';
    }
    if (els.wordcloudContext) {
      els.wordcloudContext.textContent = 'Consultando BigQuery para nuvem de termos...';
    }

    try {
      const url = buildApiUrl('/v1/wordcloud', {
        range_days: params.rangeDays,
        phrase_mode: params.phraseMode,
        type: params.filters.typeFilter,
        president: params.filters.presidentFilter,
        mandate: params.filters.mandateFilter,
      });
      const payload = await fetchJson(url);
      if (requestId !== state.wordcloudRequestId) return;
      state.wordcloudCache.set(cacheKey, payload);
      renderWordInsightsResult(params, payload);
    } catch (err) {
      if (requestId !== state.wordcloudRequestId) return;
      renderWordInsightsPlaceholder(`Falha ao atualizar nuvem: ${err.message}`);
    } finally {
      if (els.wordcloudApply) {
        els.wordcloudApply.disabled = false;
        els.wordcloudApply.textContent = 'Atualizar Nuvem';
      }
    }
  }

  function renderMetrics(searchData) {
    if (!searchData) return;
    const hasTerm = !!searchData.has_term;
    const totalMentions = Number(searchData.total_mentions) || 0;
    const resultCount = Number(searchData.results_count) || 0;
    const presidentsCount = (searchData.by_president || []).length;

    if (els.metricMentions) {
      els.metricMentions.textContent = hasTerm ? nFmt.format(totalMentions) : `${nFmt.format(totalMentions)} docs`;
    }
    if (els.metricDocs) {
      els.metricDocs.textContent = nFmt.format(resultCount);
    }
    if (els.metricPresidents) {
      els.metricPresidents.textContent = nFmt.format(presidentsCount);
    }
    if (els.metricWindow) {
      if (searchData.earliest_date && searchData.latest_date) {
        els.metricWindow.textContent = `${formatDateIso(searchData.earliest_date)} -> ${formatDateIso(searchData.latest_date)}`;
      } else {
        els.metricWindow.textContent = '--';
      }
    }
  }

  function renderCharts(searchData) {
    destroyCharts();
    clampChartCanvasSize();

    const hasTerm = !!searchData.has_term;
    const termRaw = (searchData.term_raw || '').trim();

    const timelineEntries = (searchData.timeline || [])
      .map((row) => [row.key || '', Number(row.value) || 0])
      .filter(([key]) => /^\d{4}-\d{2}$/.test(key))
      .sort((a, b) => a[0].localeCompare(b[0]));

    const timelineLabels = timelineEntries.map(([key]) => monthLabel(key));
    const timelineValues = timelineEntries.map(([, value]) => value);

    if (!timelineLabels.length) {
      timelineLabels.push('Sem dados');
      timelineValues.push(0);
    }

    const presEntries = (searchData.by_president || [])
      .map((row) => [row.name || 'Nao identificado', Number(row.value) || 0])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    if (!presEntries.length) presEntries.push(['Sem dados', 0]);

    const mandateEntries = (searchData.by_mandate || [])
      .map((row) => [row.name || 'Mandato nao identificado', Number(row.value) || 0])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    if (!mandateEntries.length) mandateEntries.push(['Sem dados', 0]);

    const titleSuffix = hasTerm ? ` (termo: ${termRaw})` : ' (contagem de documentos)';

    const timelineChart = new Chart(els.chartTimeline, {
      type: 'line',
      data: {
        labels: timelineLabels,
        datasets: [{
          label: hasTerm ? 'Citacoes por mes' : 'Documentos por mes',
          data: timelineValues,
          borderColor: '#b8612d',
          backgroundColor: 'rgba(184,97,45,0.18)',
          tension: 0.2,
          fill: false,
          pointRadius: timelineValues.length > 1 ? 2 : 4,
          pointHoverRadius: timelineValues.length > 1 ? 4 : 6,
        }],
      },
      options: {
        animation: false,
        responsiveAnimationDuration: 0,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Linha do tempo${titleSuffix}` },
        },
        layout: {
          padding: { left: 8, right: 8, top: 4, bottom: 0 },
        },
        scales: {
          y: { beginAtZero: true, grace: '6%' },
          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: 14,
              maxRotation: 60,
              minRotation: 0,
            },
          },
        },
      },
    });
    state.charts.push(timelineChart);

    const presidentChart = new Chart(els.chartPresidents, {
      type: 'bar',
      data: {
        labels: presEntries.map(([name]) => name),
        datasets: [{
          label: hasTerm ? 'Total de citacoes' : 'Total de documentos',
          data: presEntries.map(([, value]) => value),
          backgroundColor: '#2b6f62',
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 34,
          minBarLength: 2,
        }],
      },
      options: {
        animation: false,
        responsiveAnimationDuration: 0,
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top presidentes' },
        },
        layout: {
          padding: { left: 8, right: 8, top: 4, bottom: 0 },
        },
        scales: { x: { beginAtZero: true, grace: '8%' } },
      },
    });
    state.charts.push(presidentChart);

    const mandateChart = new Chart(els.chartMandates, {
      type: 'bar',
      data: {
        labels: mandateEntries.map(([name]) => name),
        datasets: [{
          label: hasTerm ? 'Total de citacoes' : 'Total de documentos',
          data: mandateEntries.map(([, value]) => value),
          backgroundColor: '#274c7f',
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 34,
          minBarLength: 2,
        }],
      },
      options: {
        animation: false,
        responsiveAnimationDuration: 0,
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top mandatos' },
        },
        layout: {
          padding: { left: 8, right: 8, top: 4, bottom: 0 },
        },
        scales: { x: { beginAtZero: true, grace: '8%' } },
      },
    });
    state.charts.push(mandateChart);

    window.requestAnimationFrame(() => {
      state.charts.forEach((chart) => chart.resize());
    });
  }

  function renderTable(searchData) {
    if (!els.resultsBody || !els.tableCount) return;

    const rowsRaw = Array.isArray(searchData.rows) ? searchData.rows : [];
    const rows = rowsRaw.slice(0, MAX_TABLE_ROWS);
    const hasTerm = !!searchData.has_term;

    els.resultsBody.innerHTML = '';
    if (!rows.length) {
      els.resultsBody.innerHTML = '<tr><td colspan="8">Nenhum resultado encontrado para o filtro atual.</td></tr>';
      els.tableCount.textContent = '0 linhas';
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(formatDateIso(row.date))}</td>
        <td>${esc(row.president || '--')}</td>
        <td>${esc(row.mandate || '--')}</td>
        <td>${esc(row.type || '--')}</td>
        <td>${hasTerm ? nFmt.format(Number(row.mentions) || 0) : '--'}</td>
        <td>${esc(row.title || '--')}</td>
        <td>${esc(row.location || '--')}</td>
        <td><a class="doc-link" href="${esc(row.url || '#')}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
      `;
      els.resultsBody.appendChild(tr);
    });

    if (rowsRaw.length > MAX_TABLE_ROWS) {
      els.tableCount.textContent = `${nFmt.format(MAX_TABLE_ROWS)} de ${nFmt.format(rowsRaw.length)} linhas (limite de exibicao)`;
    } else {
      els.tableCount.textContent = `${nFmt.format(rowsRaw.length)} linhas`;
    }
  }

  function renderUsageExamples(searchData) {
    if (!els.examplesGrid || !els.examplesHint) return;
    els.examplesGrid.innerHTML = '';

    const hasTerm = !!searchData.has_term;
    const termRaw = (searchData.term_raw || '').trim();
    const examples = Array.isArray(searchData.examples) ? searchData.examples : [];

    if (!hasTerm) {
      els.examplesHint.textContent = 'Digite um termo e clique em Buscar para ver exemplos reais dos 3 ultimos mandatos.';
      return;
    }

    if (!examples.length) {
      els.examplesHint.textContent = `Nenhum trecho encontrado para "${termRaw}" no filtro atual.`;
      return;
    }

    const mandates = [...new Set(examples.map((row) => row.mandate).filter(Boolean))];
    els.examplesHint.textContent = `Mostrando exemplos reais dos ${Math.min(3, mandates.length)} mandatos mais recentes com a busca "${termRaw}".`;

    examples.forEach((row) => {
      const card = document.createElement('article');
      card.className = 'example-card';
      card.innerHTML = `
        <div class="example-kicker">${esc(row.mandate || 'Mandato nao identificado')}</div>
        <h3 class="example-title">${esc(row.title || 'Sem titulo')}</h3>
        <p class="example-meta">${esc(row.president || '--')} | ${esc(row.type || '--')} | ${esc(formatDateIso(row.date))} | ${nFmt.format(Number(row.mentions) || 0)} ocorrencias</p>
        <p class="example-snippet">${row.snippet_html || 'Trecho nao disponivel para este documento.'}</p>
        <a class="example-link" href="${esc(row.url || '#')}" target="_blank" rel="noopener noreferrer">Ver documento original</a>
      `;
      els.examplesGrid.appendChild(card);
    });
  }

  function updateSummaryAndHint(searchData) {
    const termRaw = (searchData.term_raw || '').trim();
    const hasTerm = !!searchData.has_term;
    const resultCount = Number(searchData.results_count) || 0;
    const totalDocsWithText = Number(searchData.total_docs_with_text) || 0;
    const totalMentions = Number(searchData.total_mentions) || 0;

    if (!els.summaryText || !els.searchHint) return;

    if (hasTerm) {
      const docsByType = searchData.docs_by_type || {};
      const mentionsByType = searchData.mentions_by_type || {};

      els.summaryText.textContent = `Busca por "${termRaw}" em ${nFmt.format(resultCount)} documentos (${nFmt.format(Number(docsByType.entrevista) || 0)} entrevistas; ${nFmt.format(Number(docsByType.discurso) || 0)} discursos), com ${nFmt.format(totalMentions)} ocorrencias no total (${nFmt.format(Number(mentionsByType.entrevista) || 0)} em entrevistas; ${nFmt.format(Number(mentionsByType.discurso) || 0)} em discursos), dentro de ${nFmt.format(totalDocsWithText)} documentos com texto.`;

      if (searchData.is_phrase) {
        els.searchHint.textContent = `Expressao atual: "${termRaw}" (${nFmt.format(Number(searchData.query_words_count) || 0)} palavras). Busca sem distincao de maiusculas/minusculas e sem sensibilidade a acentos.`;
      } else {
        els.searchHint.textContent = `Termo atual: "${termRaw}". Busca sem distincao de maiusculas/minusculas e sem sensibilidade a acentos.`;
      }
      return;
    }

    els.summaryText.textContent = `Sem termo aplicado. Mostrando ${nFmt.format(resultCount)} documentos filtrados de ${nFmt.format(totalDocsWithText)} no total.`;
    els.searchHint.textContent = 'A busca ignora maiusculas/minusculas e acentos automaticamente. Voce pode buscar palavra unica ou expressao curta (2-3 palavras).';
  }

  async function applySearch() {
    if (!state.ready) return;

    state.searchRequestId += 1;
    const requestId = state.searchRequestId;
    const termRaw = (els.termInput && els.termInput.value ? els.termInput.value : '').trim();
    const filters = getActiveFilters();

    if (els.btnSearch) {
      els.btnSearch.disabled = true;
      els.btnSearch.textContent = 'Buscando...';
    }
    setLoadProgress(true, 12, 'Consultando API...');
    updateActiveFiltersBanner(filters, termRaw, null);

    try {
      const url = buildApiUrl('/v1/search', {
        term: termRaw,
        type: filters.typeFilter,
        president: filters.presidentFilter,
        mandate: filters.mandateFilter,
        limit: MAX_TABLE_ROWS,
      });
      setLoadProgress(true, 54, 'Executando busca textual no BigQuery...');
      const searchData = await fetchJson(url);
      if (requestId !== state.searchRequestId) return;

      state.searchResult = searchData;
      renderMetrics(searchData);
      renderCharts(searchData);
      renderTable(searchData);
      renderUsageExamples(searchData);
      updateSummaryAndHint(searchData);
      updateActiveFiltersBanner(filters, termRaw, Number(searchData.results_count) || 0);

      setLoadProgress(true, 100, `Busca concluida: ${nFmt.format(Number(searchData.results_count) || 0)} documentos.`);
      window.setTimeout(() => setLoadProgress(false, 0, ''), 600);

      requestWordcloudUpdate(false);
    } catch (err) {
      if (requestId !== state.searchRequestId) return;
      if (els.summaryText) els.summaryText.textContent = 'Falha ao consultar a API do Lulometro.';
      if (els.searchHint) els.searchHint.textContent = `Erro de busca: ${err.message}`;
      if (els.resultsBody) {
        els.resultsBody.innerHTML = '<tr><td colspan="8">Nao foi possivel consultar os dados no momento.</td></tr>';
      }
      if (els.tableCount) els.tableCount.textContent = '0 linhas';
      setLoadProgress(true, 100, 'Erro ao consultar a API.');
      window.setTimeout(() => setLoadProgress(false, 0, ''), 1600);
    } finally {
      if (els.btnSearch) {
        els.btnSearch.disabled = false;
        els.btnSearch.textContent = state.ready ? 'Buscar' : '1) Carregar Dados';
      }
    }
  }

  async function ensureBootstrapReady() {
    if (state.ready) return true;
    if (state.bootstrapPromise) return state.bootstrapPromise;

    state.bootstrapPromise = (async () => {
      if (els.btnSearch) {
        els.btnSearch.disabled = true;
        els.btnSearch.textContent = 'Carregando...';
      }
      setLoadProgress(true, 8, 'Conectando API...');
      setLoadRequiredBanner(
        true,
        'Conectando ao BigQuery via API...',
        'Aguarde alguns segundos. Busca e graficos serao liberados automaticamente.'
      );
      if (els.searchHint) {
        els.searchHint.textContent = 'Conectando dados em tempo real no BigQuery...';
      }

      try {
        const bootstrapUrl = buildApiUrl('/v1/bootstrap', {});
        setLoadProgress(true, 26, 'Carregando cobertura da base...');
        const bootstrapData = await fetchJson(bootstrapUrl);
        state.bootstrap = bootstrapData;

        const generatedAt = bootstrapData.generated_at || bootstrapData.synced_at;
        const sourceCount = (bootstrapData.sources || [])
          .map((row) => `${row.source}: ${nFmt.format(Number(row.total) || 0)}`)
          .join(' | ') || '--';

        if (els.statusUpdated) {
          els.statusUpdated.textContent = `Atualizado em ${formatDateTimeIso(generatedAt)}`;
        }
        if (els.statusTotalDocs) {
          els.statusTotalDocs.textContent = `Documentos: ${nFmt.format(Number(bootstrapData.total_docs) || 0)} | Com texto: ${nFmt.format(Number(bootstrapData.total_filled) || 0)}`;
        }
        if (els.statusSources) {
          els.statusSources.textContent = `Fontes: ${sourceCount}`;
        }

        setLoadProgress(true, 64, 'Montando filtros e metadados...');
        populateFilterOptions();
        updateMethodologyNote();
        state.wordcloudCache.clear();

        setReadyState();
        updateActiveFiltersBanner(getActiveFilters(), '', null);

        setLoadProgress(true, 84, 'Carregando busca inicial...');
        await applySearch();
        setLoadProgress(true, 92, 'Carregando nuvem inicial...');
        await requestWordcloudUpdate(true);

        setLoadProgress(true, 100, 'Dados carregados com sucesso.');
        window.setTimeout(() => setLoadProgress(false, 0, ''), 700);
        return true;
      } catch (err) {
        if (els.summaryText) {
          els.summaryText.textContent = 'Falha ao conectar API/BigQuery do Lulometro.';
        }
        if (els.searchHint) {
          els.searchHint.textContent = `Erro de conexao: ${err.message}`;
        }
        if (els.resultsBody) {
          els.resultsBody.innerHTML = '<tr><td colspan="8">Nao foi possivel carregar os dados da API.</td></tr>';
        }
        if (els.btnSearch) {
          els.btnSearch.disabled = false;
          els.btnSearch.textContent = '1) Carregar Dados';
        }
        setLoadRequiredBanner(
          true,
          'Falha na conexao com a API do Lulometro.',
          'Confira se a API esta publicada e se o arquivo api-config.json tem a URL correta.'
        );
        setLoadProgress(true, 100, 'Erro de conexao.');
        window.setTimeout(() => setLoadProgress(false, 0, ''), 1800);
        return false;
      } finally {
        state.bootstrapPromise = null;
      }
    })();

    return state.bootstrapPromise;
  }

  function setupEvents() {
    if (els.btnSearch) {
      els.btnSearch.addEventListener('click', async () => {
        if (!state.ready) {
          await ensureBootstrapReady();
          return;
        }
        applySearch();
      });
    }

    if (els.btnClear) {
      els.btnClear.addEventListener('click', () => {
        if (!state.ready) return;
        if (els.termInput) els.termInput.value = '';
        if (els.typeSelect) els.typeSelect.value = 'ambos';
        if (els.presidentSelect) els.presidentSelect.value = 'todos';
        if (els.mandateSelect) els.mandateSelect.value = 'todos';
        state.wordcloudCache.clear();
        applySearch();
      });
    }

    if (els.termInput) {
      els.termInput.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter') return;
        if (!state.ready) {
          ensureBootstrapReady();
          return;
        }
        applySearch();
      });
    }

    if (els.typeSelect) {
      els.typeSelect.addEventListener('change', () => {
        if (!state.ready) return;
        state.wordcloudCache.clear();
        applySearch();
      });
    }
    if (els.presidentSelect) {
      els.presidentSelect.addEventListener('change', () => {
        if (!state.ready) return;
        state.wordcloudCache.clear();
        applySearch();
      });
    }
    if (els.mandateSelect) {
      els.mandateSelect.addEventListener('change', () => {
        if (!state.ready) return;
        state.wordcloudCache.clear();
        applySearch();
      });
    }

    if (els.wordcloudRange) {
      els.wordcloudRange.addEventListener('change', () => {
        if (!state.ready) return;
        if (els.wordcloudContext) {
          els.wordcloudContext.textContent = 'Periodo alterado. Clique em "Atualizar Nuvem" para aplicar.';
        }
      });
    }
    if (els.wordcloudPhraseSize) {
      els.wordcloudPhraseSize.addEventListener('change', () => {
        if (!state.ready) return;
        if (els.wordcloudContext) {
          els.wordcloudContext.textContent = 'Modo de termo alterado. Clique em "Atualizar Nuvem" para aplicar.';
        }
      });
    }
    if (els.wordcloudApply) {
      els.wordcloudApply.addEventListener('click', () => {
        if (!state.ready) return;
        requestWordcloudUpdate(true);
      });
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        clampChartCanvasSize();
        state.charts.forEach((chart) => chart.resize());
      }, 120);
    });
  }

  async function init() {
    setDeferredSearchState();
    updateMethodologyNote();
    setupEvents();
    updateActiveFiltersBanner(getActiveFilters(), '', null);

    if (els.statusUpdated) {
      els.statusUpdated.textContent = 'API: inicializando...';
    }

    state.apiBase = await resolveApiBase();
    if (!state.apiBase) {
      if (els.statusUpdated) {
        els.statusUpdated.textContent = 'API nao configurada';
      }
      if (els.statusSources) {
        els.statusSources.textContent = 'Configure lulometro-dashboard/api-config.json com api_base_url.';
      }
      if (els.searchHint) {
        els.searchHint.textContent = 'API nao configurada. Defina api-config.json ou use ?api_base=https://...';
      }
      return;
    }

    try {
      const healthUrl = buildApiUrl('/v1/health', {});
      const health = await fetchJson(healthUrl, 15000);
      if (els.statusUpdated) {
        els.statusUpdated.textContent = `API online (${health.project_id}.${health.dataset_id})`;
      }
      if (els.searchHint) {
        els.searchHint.textContent = 'API conectada. Clique em "1) Carregar Dados" para liberar a dashboard.';
      }
    } catch (err) {
      if (els.statusUpdated) {
        els.statusUpdated.textContent = 'API indisponivel';
      }
      if (els.searchHint) {
        els.searchHint.textContent = `API configurada mas indisponivel no momento: ${err.message}`;
      }
    }
  }

  init();
})();
