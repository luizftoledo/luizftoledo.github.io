(function () {
  const nFmt = new Intl.NumberFormat('pt-BR');
  const DEVICE_PROFILE = (() => {
    const smallScreen = window.matchMedia ? window.matchMedia('(max-width: 820px)').matches : false;
    const deviceMemory = Number(navigator.deviceMemory);
    const lowRam = Number.isFinite(deviceMemory) && deviceMemory <= 4;
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    return { smallScreen, lowRam, saveData, deviceMemory };
  })();
  const LIGHT_MODE_RECORDS_THRESHOLD = 5000;
  const WORD_MIN_LEN = 3;
  const PT_STOPWORDS = new Set([
    'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'ate', 'com', 'como',
    'contra', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois', 'do', 'dos', 'e', 'ela',
    'elas', 'ele', 'eles', 'em', 'entre', 'era', 'eram', 'essa', 'essas', 'esse', 'esses', 'esta',
    'estao', 'estar', 'estas', 'estava', 'estavam', 'este', 'estes', 'eu', 'foi', 'foram', 'ha', 'isso',
    'isto', 'ja', 'la', 'lhe', 'lhes', 'mais', 'mas', 'me', 'mesmo', 'mesmos', 'meu', 'meus', 'minha',
    'minhas', 'muito', 'na', 'nao', 'nas', 'nem', 'no', 'nos', 'nossa', 'nossas', 'nosso', 'nossos',
    'num', 'numa', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'porque', 'quando',
    'que', 'quem', 'se', 'sem', 'sera', 'serao', 'seu', 'seus', 'sim', 'sob', 'sobre', 'sua', 'suas',
    'tambem', 'te', 'tem', 'tendo', 'tenho', 'ter', 'teve', 'ti', 'tu', 'tua', 'tuas', 'um', 'uma',
    'umas', 'uns', 'vos', 'voces', 'ainda', 'cada', 'durante', 'entao', 'essa', 'esse', 'fazer', 'fez',
    'for', 'fora', 'foram', 'fosse', 'fui', 'havia', 'isso', 'nesse', 'nessa', 'neste', 'nesta', 'nosso',
    'nunca', 'onde', 'outra', 'outro', 'outros', 'outras', 'pode', 'podem', 'pois', 'qual', 'quais',
    'qualquer', 'quase', 'seja', 'sejam', 'sendo', 'ser', 'seria', 'seriam', 'sido', 'sobre', 'somente',
    'tanto', 'toda', 'todas', 'todo', 'todos', 'trata', 'vamos', 'vai', 'vem', 'vindo'
  ]);

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

    metricMentions: document.getElementById('metric-mentions'),
    metricDocs: document.getElementById('metric-docs'),
    metricPresidents: document.getElementById('metric-presidents'),
    metricWindow: document.getElementById('metric-window'),

    summaryText: document.getElementById('summary-text'),
    tableCount: document.getElementById('table-count'),
    resultsBody: document.getElementById('results-body'),

    chartTimeline: document.getElementById('chart-timeline'),
    chartPresidents: document.getElementById('chart-presidents'),
    chartMandates: document.getElementById('chart-mandates'),
    methodologyNote: document.getElementById('methodology-note'),
    wordcloudRange: document.getElementById('wordcloud-range'),
    wordcloudApply: document.getElementById('wordcloud-apply'),
    wordcloudContext: document.getElementById('wordcloud-context'),
    wordcloudCloud: document.getElementById('wordcloud-cloud'),
    wordcloudTableBody: document.getElementById('wordcloud-table-body'),
    loadProgressWrap: document.getElementById('load-progress-wrap'),
    loadProgressText: document.getElementById('load-progress-text'),
    loadProgressPct: document.getElementById('load-progress-pct'),
    loadProgressFill: document.getElementById('load-progress-fill'),
    loadProgressBar: document.querySelector('.load-progress-bar'),
  };

  const state = {
    records: [],
    metadata: null,
    charts: [],
    ready: false,
    recordsLoaded: false,
    coverage: null,
    lightMode: false,
    wordcloudCache: new Map(),
    wordcloudRequestId: 0,
    wordcloudCurrentKey: '',
    wordcloudLastParams: null,
  };

  function foldText(value) {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function hasExtractedText(rec) {
    if (typeof rec._hasText === 'boolean') return rec._hasText;
    rec._hasText = Boolean((rec.text || '').trim());
    return rec._hasText;
  }

  function normalizeSearchText(value) {
    return foldText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeQueryTerm(raw) {
    const normalized = normalizeSearchText(raw || '');
    const words = normalized ? normalized.split(' ').filter(Boolean) : [];
    return {
      normalized,
      words,
      wordsCount: words.length,
      isPhrase: words.length > 1,
    };
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildTermRegex(words) {
    if (!words || !words.length) return null;
    const pattern = words.map((w) => escapeRegExp(w)).join('\\s+');
    return new RegExp(`(?:^|\\s)(${pattern})(?=\\s|$)`, 'g');
  }

  function countTermMatches(searchText, regex) {
    if (!regex || !searchText) return 0;
    regex.lastIndex = 0;
    let count = 0;
    while (regex.exec(searchText)) {
      count += 1;
    }
    return count;
  }

  function getRecordEpochDay(rec) {
    if (typeof rec._epochDay === 'number' || rec._epochDay === null) return rec._epochDay;
    const dateIso = (rec.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      rec._epochDay = null;
      return rec._epochDay;
    }
    const [y, m, d] = dateIso.split('-').map((x) => Number(x));
    if (!y || !m || !d) {
      rec._epochDay = null;
      return rec._epochDay;
    }
    rec._epochDay = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    return rec._epochDay;
  }

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

  function formatDateTimeIso(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function formatBytes(numBytes) {
    const bytes = Number(numBytes);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / (1024 ** idx);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
  }

  function monthKey(dateIso) {
    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return '';
    return dateIso.slice(0, 7);
  }

  function formatMonthKey(key) {
    if (!/^\d{4}-\d{2}$/.test(key)) return key;
    const d = new Date(`${key}-01T00:00:00`);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }

  function destroyCharts() {
    while (state.charts.length) {
      const chart = state.charts.pop();
      chart.destroy();
    }
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Falha no fetch de ${url}: ${resp.status}`);
    }
    return resp.json();
  }

  function setLoadProgress(visible, percent = 0, text = '') {
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

  async function fetchJsonlGz(url, onProgress) {
    const emitProgress = (percent, text) => {
      if (typeof onProgress === 'function') onProgress({ percent, text });
    };

    emitProgress(2, 'Iniciando download da base...');
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Falha no fetch de ${url}: ${resp.status}`);
    }

    const totalBytes = Number(resp.headers.get('content-length') || 0);
    let gzData;

    if (resp.body && typeof resp.body.getReader === 'function') {
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        received += value.byteLength;

        let pctDownload;
        if (totalBytes > 0) {
          pctDownload = Math.min(72, (received / totalBytes) * 72);
          emitProgress(pctDownload, `Baixando base: ${formatBytes(received)} de ${formatBytes(totalBytes)}`);
        } else {
          pctDownload = Math.min(72, 8 + Math.log10(received + 10) * 14);
          emitProgress(pctDownload, `Baixando base: ${formatBytes(received)}`);
        }
      }

      const merged = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      gzData = merged;
    } else {
      emitProgress(45, 'Baixando base...');
      const buf = await resp.arrayBuffer();
      gzData = new Uint8Array(buf);
      emitProgress(72, `Download concluído (${formatBytes(gzData.byteLength)}).`);
    }

    emitProgress(78, 'Descompactando base...');
    const inflated = pako.ungzip(gzData, { to: 'string' });
    const lines = inflated.split('\n');
    const out = [];
    const totalLines = lines.length || 1;

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed));
      } catch (err) {
        // Ignore malformed rows.
      }

      if (idx > 0 && idx % 2500 === 0) {
        const pct = 78 + (idx / totalLines) * 21;
        emitProgress(pct, `Indexando documentos: ${nFmt.format(out.length)} itens`);
      }
    }

    emitProgress(100, `Base pronta: ${nFmt.format(out.length)} documentos`);
    return out;
  }

  function setControlsDisabled(disabled) {
    [els.termInput, els.typeSelect, els.presidentSelect, els.mandateSelect, els.btnClear].forEach((el) => {
      if (!el) return;
      el.disabled = disabled;
    });
    if (els.wordcloudRange) {
      els.wordcloudRange.disabled = disabled;
    }
    if (els.wordcloudApply) {
      els.wordcloudApply.disabled = disabled;
    }
  }

  function setDeferredSearchState() {
    setLoadProgress(false, 0, '');
    setControlsDisabled(true);
    els.btnSearch.disabled = false;
    els.btnSearch.textContent = 'Carregar base';
    els.searchHint.textContent = 'Modo leve ativado: a base completa será carregada apenas sob demanda.';
    els.summaryText.textContent = 'Modo leve ativo para evitar travamentos neste dispositivo. Toque em "Carregar base" para ativar a busca completa.';
    els.tableCount.textContent = '0 linhas';
    els.resultsBody.innerHTML = '<tr><td colspan="8">Modo leve ativo. Toque em <strong>Carregar base</strong> para carregar os documentos completos.</td></tr>';
    if (els.wordcloudContext) {
      els.wordcloudContext.textContent = 'Nuvem de palavras será calculada após carregar a base completa.';
    }
    if (els.wordcloudCloud) {
      els.wordcloudCloud.innerHTML = '<span class="hint">Modo leve ativo.</span>';
    }
    if (els.wordcloudTableBody) {
      els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Carregue a base para ver o top 10.</td></tr>';
    }
  }

  function shouldUseLightMode(metadata) {
    const totalRecords = Number(metadata && metadata.total_records) || 0;
    const largeDataset = totalRecords >= LIGHT_MODE_RECORDS_THRESHOLD;

    if (DEVICE_PROFILE.saveData) return true;
    if (!largeDataset) return false;
    if (DEVICE_PROFILE.smallScreen) return true;
    if (DEVICE_PROFILE.lowRam) return true;
    return false;
  }

  function computeCoverage() {
    const byPresident = new Map();
    const byMandate = new Map();
    let totalDocs = 0;
    let totalFilled = 0;
    let latestEpochDay = null;

    for (const rec of state.records) {
      totalDocs += 1;
      const hasText = hasExtractedText(rec);
      if (hasText) totalFilled += 1;
      const epochDay = getRecordEpochDay(rec);
      if (epochDay !== null && (latestEpochDay === null || epochDay > latestEpochDay)) {
        latestEpochDay = epochDay;
      }

      const president = (rec.president || '').trim();
      if (president) {
        const stats = byPresident.get(president) || { total: 0, filled: 0 };
        stats.total += 1;
        if (hasText) stats.filled += 1;
        byPresident.set(president, stats);
      }

      const mandate = (rec.mandate || '').trim();
      if (mandate) {
        const stats = byMandate.get(mandate) || { total: 0, filled: 0 };
        stats.total += 1;
        if (hasText) stats.filled += 1;
        byMandate.set(mandate, stats);
      }
    }

    const hiddenPresidents = [...byPresident.entries()]
      .filter(([, stats]) => stats.filled === 0)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const hiddenMandates = [...byMandate.entries()]
      .filter(([, stats]) => stats.filled === 0)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    state.coverage = {
      totalDocs,
      totalFilled,
      latestEpochDay,
      byPresident,
      byMandate,
      hiddenPresidents,
      hiddenMandates,
    };
  }

  function updateMethodologyNote() {
    if (!els.methodologyNote) return;
    if (!state.coverage || !state.coverage.totalDocs) {
      els.methodologyNote.textContent = 'A busca usa extração textual automatizada (HTML e anexos PDF/TXT). Parte do acervo histórico da Biblioteca da Presidência é mais difícil de raspar por páginas antigas, links /view, anexos fora do ar e limitações anti-bot.';
      return;
    }

    const totalDocs = state.coverage.totalDocs;
    const totalFilled = state.coverage.totalFilled;
    const pct = totalDocs ? ((totalFilled * 100) / totalDocs).toFixed(2).replace('.', ',') : '0,00';
    const hiddenPresCount = state.coverage.hiddenPresidents.length;
    const hiddenMandateCount = state.coverage.hiddenMandates.length;
    const hiddenPresPreview = state.coverage.hiddenPresidents.slice(0, 6).join('; ');
    const hiddenSuffix = hiddenPresCount > 6 ? '...' : '';
    const mobileStrategy = state.lightMode
      ? ' Em dispositivos móveis ou conexão restrita, quando a base está grande, o painel abre em modo leve e só carrega o texto integral sob demanda.'
      : '';

    els.methodologyNote.textContent = `Cobertura textual atual: ${pct}% (${nFmt.format(totalFilled)} de ${nFmt.format(totalDocs)} documentos). Desafios principais: documentos antigos com estrutura HTML irregular, links /view e anexos (PDF/TXT) indisponíveis ou lentos, além de bloqueios anti-bot intermitentes na Biblioteca da Presidência. Presidentes e mandatos com 0% de texto extraído foram ocultados dos filtros de busca para evitar resultados vazios; eles seguem no acervo bruto. Ocultos hoje: ${nFmt.format(hiddenPresCount)} presidentes e ${nFmt.format(hiddenMandateCount)} mandatos${hiddenPresCount ? ` (ex.: ${hiddenPresPreview}${hiddenSuffix})` : ''}. Em entrevistas, parte das menções pode vir do interlocutor (pergunta), não apenas do presidente.${mobileStrategy}`;
  }

  async function ensureRecordsReady() {
    if (state.recordsLoaded) return true;
    els.btnSearch.disabled = true;
    els.btnSearch.textContent = 'Carregando...';
    els.searchHint.textContent = 'Carregando base completa de discursos e entrevistas...';
    setLoadProgress(true, 1, 'Preparando carregamento da base...');
    try {
      const records = await fetchJsonlGz('./data/records.jsonl.gz', ({ percent, text }) => {
        setLoadProgress(true, percent, text);
      });
      state.records = records;
      state.recordsLoaded = true;
      state.ready = true;
      computeCoverage();
      updateMethodologyNote();
      populateFilterOptions();
      setControlsDisabled(false);
      els.btnSearch.textContent = 'Buscar';
      applySearch();
      await requestWordcloudUpdate(true);
      setLoadProgress(true, 100, 'Carregamento concluído.');
      setTimeout(() => setLoadProgress(false, 0, ''), 700);
      return true;
    } catch (error) {
      els.summaryText.textContent = 'Falha ao carregar a base do Lulometro.';
      els.searchHint.textContent = `Erro ao carregar base: ${error.message}`;
      els.resultsBody.innerHTML = '<tr><td colspan="8">Nao foi possivel carregar os dados completos.</td></tr>';
      els.btnSearch.textContent = 'Carregar base';
      setLoadProgress(true, 100, 'Erro no carregamento.');
      setTimeout(() => setLoadProgress(false, 0, ''), 1700);
      return false;
    } finally {
      els.btnSearch.disabled = false;
    }
  }

  function populateFilterOptions() {
    if (!state.coverage) return;
    els.presidentSelect.innerHTML = '<option value="todos">Presidente: todos</option>';
    els.mandateSelect.innerHTML = '<option value="todos">Mandato: todos</option>';

    const presidentOptions = [...state.coverage.byPresident.entries()]
      .filter(([, stats]) => stats.filled > 0)
      .sort((a, b) => b[1].filled - a[1].filled || a[0].localeCompare(b[0], 'pt-BR'));

    const mandateOptions = [...state.coverage.byMandate.entries()]
      .filter(([, stats]) => stats.filled > 0)
      .sort((a, b) => {
        const ya = Number((a[0].match(/(\d{4})/) || [0, 0])[1]);
        const yb = Number((b[0].match(/(\d{4})/) || [0, 0])[1]);
        return yb - ya || a[0].localeCompare(b[0], 'pt-BR');
      });

    for (const [name, stats] of presidentOptions) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${name} (${nFmt.format(stats.filled)} com texto)`;
      els.presidentSelect.appendChild(opt);
    }

    for (const [name, stats] of mandateOptions) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${name} (${nFmt.format(stats.filled)} com texto)`;
      els.mandateSelect.appendChild(opt);
    }
  }

  function getActiveFilters() {
    return {
      typeFilter: els.typeSelect.value,
      presidentFilter: els.presidentSelect.value,
      mandateFilter: els.mandateSelect.value,
    };
  }

  function recordMatchesBaseFilters(rec, filters) {
    if (!hasExtractedText(rec)) return false;
    if (filters.typeFilter !== 'ambos' && rec.type !== filters.typeFilter) return false;
    if (filters.presidentFilter !== 'todos' && rec.president !== filters.presidentFilter) return false;
    if (filters.mandateFilter !== 'todos' && rec.mandate !== filters.mandateFilter) return false;
    return true;
  }

  function isRelevantWordToken(token) {
    if (!token || token.length < WORD_MIN_LEN) return false;
    if (/^\d+$/.test(token)) return false;
    if (PT_STOPWORDS.has(token)) return false;
    return true;
  }

  function getWordcloudParams(filters) {
    const rangeDays = Number(els.wordcloudRange ? els.wordcloudRange.value : 30) || 30;
    const latestEpochDay = state.coverage ? state.coverage.latestEpochDay : null;
    const anchorDay = latestEpochDay;
    const cutoffDay = latestEpochDay === null ? null : latestEpochDay - (rangeDays - 1);
    return {
      rangeDays,
      filters,
      anchorDay,
      cutoffDay,
    };
  }

  function buildWordcloudCacheKey(params) {
    return [
      `r:${params.rangeDays}`,
      `a:${params.anchorDay ?? 'na'}`,
      `t:${params.filters.typeFilter}`,
      `p:${params.filters.presidentFilter}`,
      `m:${params.filters.mandateFilter}`,
    ].join('|');
  }

  function renderWordInsightsPlaceholder(message) {
    if (els.wordcloudContext) els.wordcloudContext.textContent = message;
    if (els.wordcloudCloud) els.wordcloudCloud.innerHTML = '<span class="hint">Aguardando atualização...</span>';
    if (els.wordcloudTableBody) els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  }

  function renderWordInsightsResult(params, result) {
    if (!els.wordcloudCloud || !els.wordcloudTableBody || !els.wordcloudContext) return;
    const selectedPresident = params.filters.presidentFilter === 'todos'
      ? 'todos os presidentes'
      : params.filters.presidentFilter;
    const selectedType = params.filters.typeFilter === 'ambos'
      ? 'discursos + entrevistas'
      : params.filters.typeFilter;

    els.wordcloudContext.textContent = `Janela: ${params.rangeDays} dias | Base analisada: ${nFmt.format(result.docsInWindow)} documentos | Filtro atual: ${selectedType}; ${selectedPresident}.`;

    els.wordcloudCloud.innerHTML = '';
    if (!result.topCloud.length) {
      els.wordcloudCloud.innerHTML = '<span class="hint">Sem termos suficientes no período selecionado.</span>';
    } else {
      const counts = result.topCloud.map(([, count]) => count);
      const min = Math.min(...counts);
      const max = Math.max(...counts);
      const spread = Math.max(1, max - min);

      for (const [word, count] of result.topCloud) {
        const ratio = (count - min) / spread;
        const size = 0.86 + ratio * 1.9;
        const span = document.createElement('span');
        span.className = 'word-chip';
        span.textContent = word;
        span.style.fontSize = `${size.toFixed(2)}rem`;
        span.style.fontWeight = `${540 + Math.round(ratio * 240)}`;
        span.style.opacity = `${0.68 + ratio * 0.32}`;
        span.title = `${word}: ${nFmt.format(count)} ocorrências`;
        els.wordcloudCloud.appendChild(span);
      }
    }

    els.wordcloudTableBody.innerHTML = '';
    if (!result.topTable.length) {
      els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Sem dados no período.</td></tr>';
      return;
    }

    result.topTable.forEach(([word, count], idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx + 1}</td><td>${esc(word)}</td><td>${nFmt.format(count)}</td>`;
      els.wordcloudTableBody.appendChild(tr);
    });
  }

  async function computeWordInsights(params, requestId) {
    const byWord = new Map();
    let docsInWindow = 0;
    let processed = 0;
    const total = state.records.length || 1;

    for (const rec of state.records) {
      if (requestId !== state.wordcloudRequestId) return null;
      processed += 1;
      if (!recordMatchesBaseFilters(rec, params.filters)) continue;
      const day = getRecordEpochDay(rec);
      if (day === null || day < params.cutoffDay || day > params.anchorDay) continue;
      docsInWindow += 1;

      if (!rec._searchText) {
        rec._searchText = normalizeSearchText(rec.text || '');
      }
      if (!rec._searchText) continue;

      const tokens = rec._searchText.split(' ');
      for (const token of tokens) {
        if (!isRelevantWordToken(token)) continue;
        byWord.set(token, (byWord.get(token) || 0) + 1);
      }

      if (processed % 180 === 0) {
        const pct = Math.round((processed / total) * 100);
        if (els.wordcloudContext) {
          els.wordcloudContext.textContent = `Calculando nuvem... ${pct}%`;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const sortedWords = [...byWord.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    return {
      docsInWindow,
      topCloud: sortedWords.slice(0, 60),
      topTable: sortedWords.slice(0, 10),
    };
  }

  function markWordcloudDirty(params, reasonText) {
    const key = buildWordcloudCacheKey(params);
    if (key === state.wordcloudCurrentKey) return;
    const msg = reasonText || 'Filtros alterados. Clique em "Atualizar Nuvem" para recalcular os termos.';
    if (els.wordcloudContext) els.wordcloudContext.textContent = msg;
    if (els.wordcloudApply) els.wordcloudApply.disabled = false;
  }

  async function requestWordcloudUpdate(force = false) {
    if (!els.wordcloudCloud || !els.wordcloudTableBody || !els.wordcloudContext) return;
    if (!state.coverage || state.coverage.latestEpochDay === null) {
      renderWordInsightsPlaceholder('Sem datas válidas para calcular termos recentes.');
      return;
    }

    const params = getWordcloudParams(getActiveFilters());
    state.wordcloudLastParams = params;
    const key = buildWordcloudCacheKey(params);

    if (!force && state.wordcloudCache.has(key)) {
      const cached = state.wordcloudCache.get(key);
      state.wordcloudCurrentKey = key;
      renderWordInsightsResult(params, cached);
      return;
    }

    state.wordcloudRequestId += 1;
    const requestId = state.wordcloudRequestId;
    if (els.wordcloudApply) {
      els.wordcloudApply.disabled = true;
      els.wordcloudApply.textContent = 'Atualizando...';
    }
    if (els.wordcloudContext) {
      els.wordcloudContext.textContent = 'Calculando nuvem...';
    }

    try {
      const result = await computeWordInsights(params, requestId);
      if (!result || requestId !== state.wordcloudRequestId) return;

      state.wordcloudCache.set(key, result);
      state.wordcloudCurrentKey = key;
      renderWordInsightsResult(params, result);
    } finally {
      if (els.wordcloudApply) {
        els.wordcloudApply.disabled = false;
        els.wordcloudApply.textContent = 'Atualizar Nuvem';
      }
    }
  }

  function applySearch() {
    if (!state.ready) return;

    const termRaw = (els.termInput.value || '').trim();
    const query = normalizeQueryTerm(termRaw);
    const filters = getActiveFilters();
    const hasTerm = query.wordsCount > 0;
    const termRegex = hasTerm ? buildTermRegex(query.words) : null;
    const results = [];

    const timeline = new Map();
    const byPresident = new Map();
    const byMandate = new Map();

    let totalMentions = 0;
    let earliestDate = '';
    let latestDate = '';
    const docsByType = { entrevista: 0, discurso: 0 };
    const mentionsByType = { entrevista: 0, discurso: 0 };

    for (const rec of state.records) {
      if (!recordMatchesBaseFilters(rec, filters)) continue;

      let mentions = 0;
      if (hasTerm) {
        if (!rec._searchText) {
          rec._searchText = normalizeSearchText(rec.text || '');
        }
        mentions = countTermMatches(rec._searchText, termRegex);
        if (mentions <= 0) continue;
      }

      results.push({ rec, mentions });
      if (rec.type === 'entrevista') docsByType.entrevista += 1;
      else docsByType.discurso += 1;
      if (hasTerm) {
        if (rec.type === 'entrevista') mentionsByType.entrevista += mentions;
        else mentionsByType.discurso += mentions;
      }

      const value = hasTerm ? mentions : 1;
      totalMentions += value;

      const key = monthKey(rec.date);
      if (key) {
        timeline.set(key, (timeline.get(key) || 0) + value);
      }

      const pKey = rec.president || 'Nao identificado';
      byPresident.set(pKey, (byPresident.get(pKey) || 0) + value);

      const mKey = rec.mandate || 'Mandato nao identificado';
      byMandate.set(mKey, (byMandate.get(mKey) || 0) + value);

      if (rec.date) {
        if (!earliestDate || rec.date < earliestDate) earliestDate = rec.date;
        if (!latestDate || rec.date > latestDate) latestDate = rec.date;
      }
    }

    if (hasTerm) {
      results.sort((a, b) => b.mentions - a.mentions || (b.rec.date || '').localeCompare(a.rec.date || ''));
    } else {
      results.sort((a, b) => (b.rec.date || '').localeCompare(a.rec.date || ''));
    }

    renderMetrics({
      hasTerm,
      termRaw,
      totalMentions,
      results,
      earliestDate,
      latestDate,
      presidentsCount: byPresident.size,
    });

    renderCharts({ hasTerm, timeline, byPresident, byMandate, termRaw });
    renderTable(results, hasTerm);
    markWordcloudDirty(getWordcloudParams(filters));

    const sampleDocs = nFmt.format(results.length);
    const totalDocs = nFmt.format(state.coverage ? state.coverage.totalFilled : state.records.length);
    if (hasTerm) {
      const mentionsFmt = nFmt.format(totalMentions);
      const docsEntFmt = nFmt.format(docsByType.entrevista);
      const docsDisFmt = nFmt.format(docsByType.discurso);
      const mentEntFmt = nFmt.format(mentionsByType.entrevista);
      const mentDisFmt = nFmt.format(mentionsByType.discurso);
      els.summaryText.textContent = `Busca por "${termRaw}" em ${sampleDocs} documentos (${docsEntFmt} entrevistas; ${docsDisFmt} discursos), com ${mentionsFmt} ocorrências no total (${mentEntFmt} em entrevistas; ${mentDisFmt} em discursos), dentro de ${totalDocs} documentos com texto.`;
      if (query.isPhrase) {
        els.searchHint.textContent = `Expressão atual: "${termRaw}" (${query.wordsCount} palavras). Busca sem distinção de maiúsculas/minúsculas e sem sensibilidade a acentos.`;
      } else {
        els.searchHint.textContent = `Termo atual: "${termRaw}". Busca sem distinção de maiúsculas/minúsculas e sem sensibilidade a acentos.`;
      }
    } else {
      els.summaryText.textContent = `Sem termo aplicado. Mostrando ${sampleDocs} documentos filtrados de ${totalDocs} no total.`;
      els.searchHint.textContent = 'A busca ignora maiúsculas/minúsculas e acentos automaticamente. Você pode buscar palavra única ou expressão curta (2-3 palavras).';
    }
  }

  function renderMetrics({ hasTerm, totalMentions, results, earliestDate, latestDate, presidentsCount }) {
    els.metricMentions.textContent = nFmt.format(totalMentions);
    els.metricDocs.textContent = nFmt.format(results.length);
    els.metricPresidents.textContent = nFmt.format(presidentsCount);

    if (earliestDate && latestDate) {
      els.metricWindow.textContent = `${formatDateIso(earliestDate)} -> ${formatDateIso(latestDate)}`;
    } else {
      els.metricWindow.textContent = '--';
    }

    if (!hasTerm) {
      els.metricMentions.textContent = `${nFmt.format(totalMentions)} docs`;
    }
  }

  function renderCharts({ hasTerm, timeline, byPresident, byMandate, termRaw }) {
    destroyCharts();

    const timelineEntries = [...timeline.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const timelineLabels = timelineEntries.map(([k]) => formatMonthKey(k));
    const timelineValues = timelineEntries.map(([, v]) => v);
    const timelineHasSeries = timelineValues.length > 1;

    const titleSuffix = hasTerm ? ` (termo: ${termRaw})` : ' (contagem de documentos)';

    const timelineChart = new Chart(els.chartTimeline, {
      type: 'line',
      data: {
        labels: timelineLabels,
        datasets: [{
          label: hasTerm ? 'Citações por mês' : 'Documentos por mês',
          data: timelineValues,
          borderColor: '#b8612d',
          backgroundColor: 'rgba(184,97,45,0.18)',
          tension: 0.2,
          fill: false,
          pointRadius: timelineHasSeries ? 2 : 4,
          pointHoverRadius: timelineHasSeries ? 4 : 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Linha do tempo${titleSuffix}` },
        },
        scales: {
          y: { beginAtZero: true },
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

    const presEntries = [...byPresident.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    const presidentChart = new Chart(els.chartPresidents, {
      type: 'bar',
      data: {
        labels: presEntries.map(([name]) => name),
        datasets: [{
          label: hasTerm ? 'Total de citações' : 'Total de documentos',
          data: presEntries.map(([, v]) => v),
          backgroundColor: '#2b6f62',
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 34,
          minBarLength: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top presidentes' },
        },
        scales: { x: { beginAtZero: true, grace: '8%' } },
      },
    });
    state.charts.push(presidentChart);

    const mandateEntries = [...byMandate.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    const mandateChart = new Chart(els.chartMandates, {
      type: 'bar',
      data: {
        labels: mandateEntries.map(([name]) => name),
        datasets: [{
          label: hasTerm ? 'Total de citações' : 'Total de documentos',
          data: mandateEntries.map(([, v]) => v),
          backgroundColor: '#274c7f',
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 34,
          minBarLength: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top mandatos' },
        },
        scales: { x: { beginAtZero: true, grace: '8%' } },
      },
    });
    state.charts.push(mandateChart);
  }

  function renderTable(results, hasTerm) {
    const maxRows = 600;
    const rows = results.slice(0, maxRows);
    els.resultsBody.innerHTML = '';

    if (!rows.length) {
      els.resultsBody.innerHTML = '<tr><td colspan="8">Nenhum resultado encontrado para o filtro atual.</td></tr>';
      els.tableCount.textContent = '0 linhas';
      return;
    }

    for (const { rec, mentions } of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(formatDateIso(rec.date))}</td>
        <td>${esc(rec.president || '--')}</td>
        <td>${esc(rec.mandate || '--')}</td>
        <td>${esc(rec.type || '--')}</td>
        <td>${hasTerm ? nFmt.format(mentions) : '--'}</td>
        <td>${esc(rec.title || '--')}</td>
        <td>${esc(rec.location || '--')}</td>
        <td><a class="doc-link" href="${esc(rec.url || '#')}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
      `;
      els.resultsBody.appendChild(tr);
    }

    if (results.length > maxRows) {
      els.tableCount.textContent = `${nFmt.format(maxRows)} de ${nFmt.format(results.length)} linhas (limite de exibição)`;
    } else {
      els.tableCount.textContent = `${nFmt.format(results.length)} linhas`;
    }
  }

  function setupEvents() {
    els.btnSearch.addEventListener('click', async () => {
      if (!state.recordsLoaded) {
        const ready = await ensureRecordsReady();
        if (!ready) return;
      }
      applySearch();
    });
    els.btnClear.addEventListener('click', () => {
      if (!state.recordsLoaded) return;
      els.termInput.value = '';
      els.typeSelect.value = 'ambos';
      els.presidentSelect.value = 'todos';
      els.mandateSelect.value = 'todos';
      applySearch();
    });

    els.termInput.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      if (!state.recordsLoaded) {
        ensureRecordsReady().then((ready) => {
          if (ready) applySearch();
        });
        return;
      }
      applySearch();
    });

    els.typeSelect.addEventListener('change', () => {
      if (!state.recordsLoaded) return;
      applySearch();
    });
    els.presidentSelect.addEventListener('change', () => {
      if (!state.recordsLoaded) return;
      applySearch();
    });
    els.mandateSelect.addEventListener('change', () => {
      if (!state.recordsLoaded) return;
      applySearch();
    });
    if (els.wordcloudRange) {
      els.wordcloudRange.addEventListener('change', () => {
        if (!state.recordsLoaded) return;
        markWordcloudDirty(
          getWordcloudParams(getActiveFilters()),
          'Período alterado. Clique em "Atualizar Nuvem" para aplicar.'
        );
      });
    }
    if (els.wordcloudApply) {
      els.wordcloudApply.addEventListener('click', () => {
        if (!state.recordsLoaded) return;
        requestWordcloudUpdate();
      });
    }
  }

  async function init() {
    try {
      const metadata = await fetchJson('./data/metadata.json').catch(() => ({}));
      state.metadata = metadata;
      state.lightMode = shouldUseLightMode(metadata);

      const generatedAt = metadata.generated_at ? formatDateTimeIso(metadata.generated_at) : '--';
      const total = metadata.total_records || state.records.length;
      const sourceCount = metadata.sources
        ? Object.entries(metadata.sources).map(([k, v]) => `${k}: ${nFmt.format(v)}`).join(' | ')
        : '--';

      els.statusUpdated.textContent = `Atualizado em ${generatedAt}`;
      els.statusTotalDocs.textContent = `Documentos: ${nFmt.format(total)}`;
      els.statusSources.textContent = `Fontes: ${sourceCount}`;
      updateMethodologyNote();

      setupEvents();
      if (state.lightMode) {
        setDeferredSearchState();
        return;
      }

      const ready = await ensureRecordsReady();
      if (!ready) return;
    } catch (err) {
      console.error(err);
      els.summaryText.textContent = 'Falha ao carregar a base do Lulometro.';
      els.statusUpdated.textContent = 'Erro no carregamento';
      els.resultsBody.innerHTML = '<tr><td colspan="8">Nao foi possivel carregar os dados.</td></tr>';
    }
  }

  init();
})();
