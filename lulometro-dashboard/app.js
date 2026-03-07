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
  const DATA_FETCH_TIMEOUT_MS = 180000;
  const WORD_MIN_LEN = 3;
  const WORDCLOUD_MAX_FUTURE_SKEW_DAYS = 7;
  const EXAMPLE_MANDATES_LIMIT = 3;
  const EXAMPLES_PER_MANDATE = 2;
  const EXAMPLE_SNIPPET_RADIUS = 150;
  const scheduleHelper = window.DashboardUpdateSchedule || null;
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
    updateScheduleNote: document.getElementById('update-schedule-note'),
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
    recordsLoadPromise: null,
    searchRequestId: 0,
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

  function buildSnippetRegex(words) {
    if (!words || !words.length) return null;
    const pattern = words.map((w) => escapeRegExp(w)).join('[^a-z0-9]+');
    return new RegExp(`(^|[^a-z0-9])(${pattern})(?=$|[^a-z0-9])`);
  }

  function extractMandateSortYear(mandate) {
    if (!mandate) return 0;
    const years = (mandate.match(/\d{4}/g) || []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    return years.length ? Math.max(...years) : 0;
  }

  function buildHighlightedSnippet(text, queryWords) {
    const rawText = (text || '').toString();
    if (!rawText.trim()) return null;

    const snippetRegex = buildSnippetRegex(queryWords);
    const folded = foldText(rawText);
    const match = snippetRegex ? snippetRegex.exec(folded) : null;

    if (!match || typeof match.index !== 'number') {
      const fallback = rawText.slice(0, EXAMPLE_SNIPPET_RADIUS + 120).replace(/\s+/g, ' ').trim();
      if (!fallback) return null;
      return `${esc(fallback)}${rawText.length > fallback.length ? '...' : ''}`;
    }

    const termStart = match.index + (match[1] ? match[1].length : 0);
    const termEnd = termStart + (match[2] ? match[2].length : 0);

    let start = Math.max(0, termStart - EXAMPLE_SNIPPET_RADIUS);
    let end = Math.min(rawText.length, termEnd + EXAMPLE_SNIPPET_RADIUS);

    const leftBreak = rawText.lastIndexOf(' ', start);
    if (leftBreak >= 0 && leftBreak > start - 40) start = leftBreak + 1;

    const rightBreak = rawText.indexOf(' ', end);
    if (rightBreak >= 0 && rightBreak < end + 40) end = rightBreak;

    const snippet = rawText.slice(start, end).replace(/\n/g, ' ');
    const relStart = Math.max(0, termStart - start);
    const relEnd = Math.min(snippet.length, termEnd - start);

    const before = esc(snippet.slice(0, relStart).replace(/\s+/g, ' '));
    const hit = esc(snippet.slice(relStart, relEnd).replace(/\s+/g, ' '));
    const after = esc(snippet.slice(relEnd).replace(/\s+/g, ' '));

    const prefix = start > 0 ? '... ' : '';
    const suffix = end < rawText.length ? ' ...' : '';
    return `${prefix}${before}<mark>${hit}</mark>${after}${suffix}`;
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

  function getUtcTodayEpochDay() {
    const now = new Date();
    return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
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

  function clampChartCanvasSize() {
    [els.chartTimeline, els.chartPresidents, els.chartMandates].forEach((canvas) => {
      if (!canvas) return;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.removeAttribute('width');
      canvas.removeAttribute('height');
    });
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

  function setLoadRequiredBanner(visible, titleText, bodyText) {
    if (!els.loadRequiredBanner) return;
    els.loadRequiredBanner.hidden = !visible;
    if (typeof titleText === 'string' && els.loadRequiredTitle) {
      els.loadRequiredTitle.textContent = titleText;
    }
    if (typeof bodyText === 'string' && els.loadRequiredText) {
      els.loadRequiredText.textContent = bodyText;
    }
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
    const resultText = Number.isFinite(resultCount) ? ` | Resultado atual: ${nFmt.format(resultCount)} documentos` : '';
    els.activeFilters.textContent = `Filtros ativos agora -> ${typeText} | ${presText} | ${mandateText} | Termo: ${termText}${resultText}`;
  }

  function parseJsonlTextChunk(buffer, out, flushTail = false) {
    let cursor = 0;
    let linesSeen = 0;

    while (true) {
      const idx = buffer.indexOf('\n', cursor);
      if (idx < 0) break;
      const line = buffer.slice(cursor, idx).trim();
      cursor = idx + 1;
      linesSeen += 1;
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch (err) {
        // Ignore malformed rows.
      }
    }

    if (flushTail) {
      const tail = buffer.slice(cursor).trim();
      if (tail) {
        try {
          out.push(JSON.parse(tail));
          linesSeen += 1;
        } catch (err) {
          // Ignore malformed tail row.
        }
      }
      return { remainder: '', linesSeen };
    }

    return { remainder: buffer.slice(cursor), linesSeen };
  }

  async function fetchJsonlGz(url, onProgress, expectedRecords = 0) {
    const emitProgress = (percent, text) => {
      if (typeof onProgress === 'function') onProgress({ percent, text });
    };

    emitProgress(2, 'Iniciando download da base...');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DATA_FETCH_TIMEOUT_MS);
    const resp = await fetch(url, { cache: 'no-store', signal: controller.signal });
    window.clearTimeout(timeoutId);
    if (!resp.ok) {
      throw new Error(`Falha no fetch de ${url}: ${resp.status}`);
    }

    const out = [];
    const totalBytes = Number(resp.headers.get('content-length') || 0);

    const supportsNativeGzip = typeof DecompressionStream !== 'undefined'
      && resp.body
      && typeof resp.body.pipeThrough === 'function';

    if (supportsNativeGzip) {
      emitProgress(12, totalBytes > 0 ? `Baixando base (${formatBytes(totalBytes)})...` : 'Baixando base...');
      emitProgress(24, 'Descompactando e indexando em streaming...');

      const decompressedStream = resp.body.pipeThrough(new DecompressionStream('gzip'));
      const reader = decompressedStream.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let loopCount = 0;
      let parsedLines = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        textBuffer += decoder.decode(value, { stream: true });
        const parsed = parseJsonlTextChunk(textBuffer, out, false);
        textBuffer = parsed.remainder;
        parsedLines += parsed.linesSeen;
        loopCount += 1;

        if (loopCount % 4 === 0) {
          const ratio = expectedRecords > 0 ? Math.min(1, out.length / expectedRecords) : Math.min(0.98, Math.log10(parsedLines + 10) / 5);
          const pct = 24 + ratio * 74;
          emitProgress(pct, `Indexando documentos: ${nFmt.format(out.length)} itens`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      textBuffer += decoder.decode();
      const parsedTail = parseJsonlTextChunk(textBuffer, out, true);
      parsedLines += parsedTail.linesSeen;

      emitProgress(100, `Base pronta: ${nFmt.format(out.length)} documentos`);
      return out;
    }

    // Fallback para navegadores sem DecompressionStream.
    const hasPako = typeof window !== 'undefined' && window.pako && typeof window.pako.ungzip === 'function';
    if (!hasPako) {
      throw new Error('Seu navegador não suportou descompactação da base. Tente usar Chrome, Edge ou Safari atualizado.');
    }

    emitProgress(18, 'Baixando base...');
    const buf = await resp.arrayBuffer();
    const gzData = new Uint8Array(buf);
    emitProgress(70, `Download concluído (${formatBytes(gzData.byteLength)}).`);
    emitProgress(80, 'Descompactando base...');
    const inflated = window.pako.ungzip(gzData, { to: 'string' });

    parseJsonlTextChunk(inflated, out, true);

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
    if (els.wordcloudPhraseSize) {
      els.wordcloudPhraseSize.disabled = disabled;
    }
    if (els.wordcloudApply) {
      els.wordcloudApply.disabled = disabled;
    }
  }

  function setDeferredSearchState() {
    setLoadProgress(false, 0, '');
    setControlsDisabled(true);
    els.btnSearch.disabled = false;
    els.btnSearch.textContent = '1) Carregar Base Completa';
    setLoadRequiredBanner(
      true,
      'Passo 1 obrigatório: clique em "1) Carregar Base Completa".',
      'Sem esse passo a busca fica desativada para evitar travamento no seu navegador.'
    );
    els.searchHint.textContent = 'Passo obrigatório: clique primeiro em "1) Carregar Base Completa". Depois use os filtros e o termo.';
    els.summaryText.textContent = 'Busca textual ainda indisponível. Clique em "1) Carregar Base Completa" para liberar consultas.';
    els.tableCount.textContent = '0 linhas';
    els.resultsBody.innerHTML = '<tr><td colspan="8">Modo progressivo ativo. Clique em <strong>Carregar base</strong> para iniciar a busca textual completa.</td></tr>';
    if (els.wordcloudContext) {
      els.wordcloudContext.textContent = 'Nuvem de termos será calculada após carregar a base completa.';
    }
    if (els.wordcloudCloud) {
      els.wordcloudCloud.innerHTML = '<span class="hint">Carregue a base para habilitar a nuvem.</span>';
    }
    if (els.wordcloudTableBody) {
      els.wordcloudTableBody.innerHTML = '<tr><td colspan="3">Carregue a base para ver o top 10.</td></tr>';
    }
    if (els.examplesHint) {
      els.examplesHint.textContent = 'Carregue a base e busque um termo para ver exemplos reais dos mandatos disponíveis.';
    }
    if (els.examplesGrid) {
      els.examplesGrid.innerHTML = '';
    }
    if (els.methodologyPresidentBody) {
      els.methodologyPresidentBody.innerHTML = '<tr><td colspan="7">Carregue a base para ver a cobertura por presidente.</td></tr>';
    }
    if (els.methodologyMandateBody) {
      els.methodologyMandateBody.innerHTML = '<tr><td colspan="7">Carregue a base para ver a cobertura por mandato.</td></tr>';
    }
    updateActiveFiltersBanner(getActiveFilters(), '', null);
  }

  function shouldUseLightMode(metadata) {
    const totalRecords = Number(metadata && metadata.total_records) || 0;
    const largeDataset = totalRecords >= LIGHT_MODE_RECORDS_THRESHOLD;

    if (DEVICE_PROFILE.saveData) return true;
    if (largeDataset) return true;
    return DEVICE_PROFILE.smallScreen || DEVICE_PROFILE.lowRam;
  }

  function createCoverageStats() {
    return {
      total: 0,
      filled: 0,
      discurso_total: 0,
      discurso_filled: 0,
      entrevista_total: 0,
      entrevista_filled: 0,
    };
  }

  function updateCoverageStats(stats, recType, hasText) {
    stats.total += 1;
    if (recType === 'entrevista') {
      stats.entrevista_total += 1;
      if (hasText) stats.entrevista_filled += 1;
    } else {
      stats.discurso_total += 1;
      if (hasText) stats.discurso_filled += 1;
    }
    if (hasText) stats.filled += 1;
  }

  function renderCoverageRows(targetBody, rows, emptyText) {
    if (!targetBody) return;
    if (!rows.length) {
      targetBody.innerHTML = `<tr><td colspan="7">${esc(emptyText)}</td></tr>`;
      return;
    }

    targetBody.innerHTML = '';
    for (const row of rows) {
      const coveragePct = row.total ? ((row.filled * 100) / row.total).toFixed(1).replace('.', ',') : '0,0';
      const tr = document.createElement('tr');
      tr.innerHTML = [
        `<td>${esc(row.name)}</td>`,
        `<td>${nFmt.format(row.discurso_total)}</td>`,
        `<td>${nFmt.format(row.entrevista_total)}</td>`,
        `<td>${nFmt.format(row.discurso_filled)}</td>`,
        `<td>${nFmt.format(row.entrevista_filled)}</td>`,
        `<td>${nFmt.format(row.filled)}</td>`,
        `<td>${coveragePct}%</td>`,
      ].join('');
      targetBody.appendChild(tr);
    }
  }

  function updateMethodologyBreakdowns() {
    if (!state.coverage || !state.coverage.totalDocs) {
      renderCoverageRows(
        els.methodologyPresidentBody,
        [],
        'Carregue a base para ver a cobertura por presidente.'
      );
      renderCoverageRows(
        els.methodologyMandateBody,
        [],
        'Carregue a base para ver a cobertura por mandato.'
      );
      return;
    }

    const presRows = [...state.coverage.byPresident.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
    const mandateRows = [...state.coverage.byMandate.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

    renderCoverageRows(
      els.methodologyPresidentBody,
      presRows,
      'Sem dados por presidente.'
    );
    renderCoverageRows(
      els.methodologyMandateBody,
      mandateRows,
      'Sem dados por mandato.'
    );
  }

  function computeCoverage() {
    const byPresident = new Map();
    const byMandate = new Map();
    let totalDocs = 0;
    let totalFilled = 0;
    let latestEpochDay = null;
    let wordcloudAnchorEpochDay = null;
    let futureOutlierDates = 0;
    const maxAcceptedAnchorDay = getUtcTodayEpochDay() + WORDCLOUD_MAX_FUTURE_SKEW_DAYS;

    for (const rec of state.records) {
      totalDocs += 1;
      const hasText = hasExtractedText(rec);
      if (hasText) totalFilled += 1;
      const epochDay = getRecordEpochDay(rec);
      if (epochDay !== null && (latestEpochDay === null || epochDay > latestEpochDay)) {
        latestEpochDay = epochDay;
      }
      if (epochDay !== null) {
        if (epochDay <= maxAcceptedAnchorDay) {
          if (wordcloudAnchorEpochDay === null || epochDay > wordcloudAnchorEpochDay) {
            wordcloudAnchorEpochDay = epochDay;
          }
        } else {
          futureOutlierDates += 1;
        }
      }

      const recType = rec.type === 'entrevista' ? 'entrevista' : 'discurso';
      const president = (rec.president || '').trim() || 'Nao identificado';
      const mandate = (rec.mandate || '').trim() || 'Mandato nao identificado';

      const pStats = byPresident.get(president) || createCoverageStats();
      updateCoverageStats(pStats, recType, hasText);
      byPresident.set(president, pStats);

      const mStats = byMandate.get(mandate) || createCoverageStats();
      updateCoverageStats(mStats, recType, hasText);
      byMandate.set(mandate, mStats);
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
      wordcloudAnchorEpochDay: wordcloudAnchorEpochDay ?? latestEpochDay,
      futureOutlierDates,
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
      updateMethodologyBreakdowns();
      return;
    }

    const totalDocs = state.coverage.totalDocs;
    const totalFilled = state.coverage.totalFilled;
    const pct = totalDocs ? ((totalFilled * 100) / totalDocs).toFixed(2).replace('.', ',') : '0,00';
    const hiddenPresCount = state.coverage.hiddenPresidents.length;
    const hiddenMandateCount = state.coverage.hiddenMandates.length;
    const hiddenPresPreview = state.coverage.hiddenPresidents.slice(0, 6).join('; ');
    const hiddenSuffix = hiddenPresCount > 6 ? '...' : '';
    const futureDatesNote = state.coverage.futureOutlierDates > 0
      ? ` Para a nuvem de termos por período, ${nFmt.format(state.coverage.futureOutlierDates)} documento(s) com data muito à frente foram ignorados para evitar distorção temporal.`
      : '';
    const progressiveStrategy = state.lightMode
      ? ' Para evitar travamentos em bases grandes, o painel abre em modo progressivo e só carrega o texto integral sob demanda.'
      : '';

    els.methodologyNote.textContent = `Cobertura textual atual: ${pct}% (${nFmt.format(totalFilled)} de ${nFmt.format(totalDocs)} documentos). As tabelas abaixo mostram, para cada presidente e cada mandato, quantos discursos e entrevistas existem no acervo bruto e quantos entraram no buscador (texto recuperado). Desafios principais: documentos antigos com estrutura HTML irregular, links /view e anexos (PDF/TXT) indisponíveis ou lentos, além de bloqueios anti-bot intermitentes na Biblioteca da Presidência. Presidentes e mandatos com 0% de texto extraído foram ocultados dos filtros de busca para evitar resultados vazios; eles seguem no acervo bruto. Ocultos hoje: ${nFmt.format(hiddenPresCount)} presidentes e ${nFmt.format(hiddenMandateCount)} mandatos${hiddenPresCount ? ` (ex.: ${hiddenPresPreview}${hiddenSuffix})` : ''}. Em entrevistas, parte das menções pode vir do interlocutor (pergunta), não apenas do presidente.${futureDatesNote}${progressiveStrategy}`;
    updateMethodologyBreakdowns();
  }

  async function ensureRecordsReady() {
    if (state.recordsLoaded) return true;
    if (state.recordsLoadPromise) return state.recordsLoadPromise;

    state.recordsLoadPromise = (async () => {
      els.btnSearch.disabled = true;
      els.btnSearch.textContent = 'Carregando...';
      setLoadRequiredBanner(
        true,
        'Carregando base textual completa...',
        'Aguarde alguns segundos. Quando concluir, a busca será liberada automaticamente.'
      );
      els.searchHint.textContent = 'Carregando base completa de discursos e entrevistas...';
      setLoadProgress(true, 1, 'Preparando carregamento da base...');
      try {
        const records = await fetchJsonlGz('./data/records.jsonl.gz', ({ percent, text }) => {
          setLoadProgress(true, percent, text);
        }, Number(state.metadata && state.metadata.total_records) || 0);
        state.records = records;
        state.recordsLoaded = true;
        state.ready = true;
        computeCoverage();
        updateMethodologyNote();
        populateFilterOptions();
        setControlsDisabled(false);
        els.btnSearch.textContent = 'Buscar';
        setLoadRequiredBanner(false);
        await applySearch();
        await requestWordcloudUpdate(true);
        setLoadProgress(true, 100, 'Carregamento concluído.');
        setTimeout(() => setLoadProgress(false, 0, ''), 700);
        return true;
      } catch (error) {
        els.summaryText.textContent = 'Falha ao carregar a base do Lulometro.';
        els.searchHint.textContent = `Erro ao carregar base: ${error.message}`;
        els.resultsBody.innerHTML = '<tr><td colspan="8">Nao foi possivel carregar os dados completos.</td></tr>';
        els.btnSearch.textContent = '1) Carregar Base Completa';
        setLoadRequiredBanner(
          true,
          'Falha no carregamento da base.',
          'Tente novamente clicando em "1) Carregar Base Completa".'
        );
        setLoadProgress(true, 100, 'Erro no carregamento.');
        setTimeout(() => setLoadProgress(false, 0, ''), 1700);
        return false;
      } finally {
        state.recordsLoadPromise = null;
        els.btnSearch.disabled = false;
      }
    })();

    return state.recordsLoadPromise;
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

  function getWordcloudPhraseSizes(mode) {
    if (mode === '1') return [1];
    if (mode === '2') return [2];
    if (mode === '3') return [3];
    return [2, 3];
  }

  function getWordcloudPhraseModeLabel(mode) {
    if (mode === '1') return 'palavras isoladas';
    if (mode === '2') return 'frases de 2 palavras';
    if (mode === '3') return 'frases de 3 palavras';
    return 'frases de 2 e 3 palavras';
  }

  function countTermUnits(tokens, phraseSizes, byTerm) {
    if (!tokens || !tokens.length) return;

    if (phraseSizes.includes(1)) {
      for (const token of tokens) {
        if (!isRelevantWordToken(token)) continue;
        byTerm.set(token, (byTerm.get(token) || 0) + 1);
      }
    }

    for (const size of phraseSizes) {
      if (size <= 1 || tokens.length < size) continue;
      for (let i = 0; i <= tokens.length - size; i += 1) {
        const chunk = tokens.slice(i, i + size);
        if (chunk.some((tok) => !tok || tok.length < 2 || /^\d+$/.test(tok))) continue;

        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        if (!isRelevantWordToken(first) || !isRelevantWordToken(last)) continue;

        const relevantCount = chunk.reduce((acc, tok) => acc + (isRelevantWordToken(tok) ? 1 : 0), 0);
        if (relevantCount < 2) continue;

        const phrase = chunk.join(' ');
        byTerm.set(phrase, (byTerm.get(phrase) || 0) + 1);
      }
    }
  }

  function getWordcloudParams(filters) {
    const rangeDays = Number(els.wordcloudRange ? els.wordcloudRange.value : 30) || 30;
    const phraseMode = (els.wordcloudPhraseSize && els.wordcloudPhraseSize.value) || '2-3';
    const latestEpochDay = state.coverage ? state.coverage.wordcloudAnchorEpochDay : null;
    const anchorDay = latestEpochDay;
    const cutoffDay = latestEpochDay === null ? null : latestEpochDay - (rangeDays - 1);
    return {
      rangeDays,
      phraseMode,
      filters,
      anchorDay,
      cutoffDay,
    };
  }

  function buildWordcloudCacheKey(params) {
    return [
      `r:${params.rangeDays}`,
      `pm:${params.phraseMode}`,
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
    const selectedMandate = params.filters.mandateFilter === 'todos'
      ? 'todos os mandatos'
      : params.filters.mandateFilter;
    const selectedType = params.filters.typeFilter === 'ambos'
      ? 'discursos + entrevistas'
      : params.filters.typeFilter;
    const modeLabel = getWordcloudPhraseModeLabel(params.phraseMode);
    if (els.wordcloudColLabel) {
      els.wordcloudColLabel.textContent = params.phraseMode === '1' ? 'Palavra' : 'Expressao';
    }

    els.wordcloudContext.textContent = `Janela: ${params.rangeDays} dias | Base analisada: ${nFmt.format(result.docsInWindow)} documentos | Modo: ${modeLabel} | Filtro atual: ${selectedType}; ${selectedPresident}; ${selectedMandate}.`;

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
    const byTerm = new Map();
    let docsInWindow = 0;
    let processed = 0;
    const total = state.records.length || 1;
    const phraseSizes = getWordcloudPhraseSizes(params.phraseMode);

    for (const rec of state.records) {
      if (requestId !== state.wordcloudRequestId) return null;
      processed += 1;
      if (!recordMatchesBaseFilters(rec, params.filters)) continue;
      const day = getRecordEpochDay(rec);
      if (day === null || day < params.cutoffDay || day > params.anchorDay) continue;
      docsInWindow += 1;

      const searchText = normalizeSearchText(rec.text || '');
      if (!searchText) continue;

      const tokens = searchText.split(' ').filter(Boolean);
      countTermUnits(tokens, phraseSizes, byTerm);

      if (processed % 180 === 0) {
        const pct = Math.round((processed / total) * 100);
        if (els.wordcloudContext) {
          els.wordcloudContext.textContent = `Calculando nuvem... ${pct}%`;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const sortedWords = [...byTerm.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    return {
      docsInWindow,
      topCloud: sortedWords.slice(0, 60),
      topTable: sortedWords.slice(0, 10),
    };
  }

  async function requestWordcloudUpdate(force = false) {
    if (!els.wordcloudCloud || !els.wordcloudTableBody || !els.wordcloudContext) return;
    if (!state.coverage || state.coverage.wordcloudAnchorEpochDay === null) {
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

  async function applySearch() {
    if (!state.ready) return;
    const requestId = state.searchRequestId + 1;
    state.searchRequestId = requestId;

    const termRaw = (els.termInput.value || '').trim();
    const query = normalizeQueryTerm(termRaw);
    const filters = getActiveFilters();
    updateActiveFiltersBanner(filters, termRaw, null);
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

    if (hasTerm) {
      els.searchHint.textContent = 'Buscando termo na base textual...';
    }

    for (let idx = 0; idx < state.records.length; idx += 1) {
      if (requestId !== state.searchRequestId) return;
      const rec = state.records[idx];
      if (idx > 0 && idx % 140 === 0) {
        if (hasTerm) {
          const pct = Math.round((idx / Math.max(1, state.records.length)) * 100);
          els.searchHint.textContent = `Buscando termo na base textual... ${pct}%`;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!recordMatchesBaseFilters(rec, filters)) continue;

      let mentions = 0;
      if (hasTerm) {
        const searchText = normalizeSearchText(rec.text || '');
        mentions = countTermMatches(searchText, termRegex);
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

    if (requestId !== state.searchRequestId) return;

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
    renderUsageExamples({ hasTerm, termRaw, query, results });
    updateActiveFiltersBanner(filters, termRaw, results.length);
    requestWordcloudUpdate();

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

  function renderUsageExamples({ hasTerm, termRaw, query, results }) {
    if (!els.examplesGrid || !els.examplesHint) return;
    els.examplesGrid.innerHTML = '';

    if (!hasTerm) {
      els.examplesHint.textContent = 'Digite um termo e clique em Buscar para ver exemplos reais dos mandatos disponíveis.';
      return;
    }

    if (!results.length) {
      els.examplesHint.textContent = `Nenhum trecho encontrado para "${termRaw}" no filtro atual.`;
      return;
    }

    const byMandate = new Map();
    for (const row of results) {
      const mandate = row.rec.mandate || 'Mandato nao identificado';
      if (!byMandate.has(mandate)) {
        byMandate.set(mandate, {
          mandate,
          latestDate: row.rec.date || '',
          rows: [],
        });
      }
      const entry = byMandate.get(mandate);
      if ((row.rec.date || '') > entry.latestDate) {
        entry.latestDate = row.rec.date || '';
      }
      entry.rows.push(row);
    }

    const recentMandates = [...byMandate.values()]
      .sort((a, b) => {
        const byDate = (b.latestDate || '').localeCompare(a.latestDate || '');
        if (byDate !== 0) return byDate;
        const byYear = extractMandateSortYear(b.mandate) - extractMandateSortYear(a.mandate);
        if (byYear !== 0) return byYear;
        return a.mandate.localeCompare(b.mandate, 'pt-BR');
      })
      .slice(0, EXAMPLE_MANDATES_LIMIT);

    if (!recentMandates.length) {
      els.examplesHint.textContent = `Sem exemplos disponíveis para "${termRaw}".`;
      return;
    }

    els.examplesHint.textContent = `Mostrando até ${EXAMPLES_PER_MANDATE} exemplos por mandato entre os ${recentMandates.length} mandatos mais recentes com a busca "${termRaw}".`;

    for (const bucket of recentMandates) {
      const picks = bucket.rows
        .sort((a, b) => (b.rec.date || '').localeCompare(a.rec.date || '') || b.mentions - a.mentions)
        .slice(0, EXAMPLES_PER_MANDATE);

      for (const { rec, mentions } of picks) {
        const snippetHtml = buildHighlightedSnippet(rec.text || '', query.words)
          || 'Trecho não disponível para este documento.';
        const card = document.createElement('article');
        card.className = 'example-card';
        card.innerHTML = `
          <div class="example-kicker">${esc(rec.mandate || 'Mandato nao identificado')}</div>
          <h3 class="example-title">${esc(rec.title || 'Sem titulo')}</h3>
          <p class="example-meta">${esc(rec.president || '--')} | ${esc(rec.type || '--')} | ${esc(formatDateIso(rec.date))} | ${nFmt.format(mentions)} ocorrências</p>
          <p class="example-snippet">${snippetHtml}</p>
          <a class="example-link" href="${esc(rec.url || '#')}" target="_blank" rel="noopener noreferrer">Ver documento original</a>
        `;
        els.examplesGrid.appendChild(card);
      }
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
    clampChartCanvasSize();

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
        animation: false,
        responsiveAnimationDuration: 0,
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
        animation: false,
        responsiveAnimationDuration: 0,
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
        animation: false,
        responsiveAnimationDuration: 0,
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

    window.requestAnimationFrame(() => {
      state.charts.forEach((chart) => chart.resize());
    });
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
        await ensureRecordsReady();
        return;
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
        ensureRecordsReady();
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
        requestWordcloudUpdate(true);
      });
    }
    if (els.wordcloudPhraseSize) {
      els.wordcloudPhraseSize.addEventListener('change', () => {
        if (!state.recordsLoaded) return;
        requestWordcloudUpdate(true);
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

      const updateNotice = scheduleHelper ? scheduleHelper.buildNotice('lulometro', metadata.generated_at) : null;
      els.statusUpdated.textContent = `Atualizado em ${generatedAt}`;
      if (els.updateScheduleNote) {
        els.updateScheduleNote.textContent = updateNotice
          ? updateNotice.text
          : `Ultima atualizacao: ${generatedAt}.`;
      }
      els.statusTotalDocs.textContent = `Documentos: ${nFmt.format(total)}`;
      els.statusSources.textContent = `Fontes: ${sourceCount}`;
      updateMethodologyNote();

      setupEvents();
      updateActiveFiltersBanner(getActiveFilters(), '', null);
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
