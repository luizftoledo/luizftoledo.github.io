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
  };

  const state = {
    records: [],
    metadata: null,
    charts: [],
    ready: false,
    recordsLoaded: false,
    coverage: null,
    lightMode: false,
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

  function esc(value) {
    return (value || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let count = 0;
    let pos = 0;
    while (true) {
      const found = haystack.indexOf(needle, pos);
      if (found === -1) break;
      count += 1;
      pos = found + Math.max(1, needle.length);
    }
    return count;
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

  async function fetchJsonlGz(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Falha no fetch de ${url}: ${resp.status}`);
    }
    const buf = await resp.arrayBuffer();
    const inflated = pako.ungzip(new Uint8Array(buf), { to: 'string' });
    const lines = inflated.split('\n');
    const out = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed));
      } catch (err) {
        // Ignore malformed rows.
      }
    }
    return out;
  }

  function setControlsDisabled(disabled) {
    [els.termInput, els.typeSelect, els.presidentSelect, els.mandateSelect, els.btnClear].forEach((el) => {
      if (!el) return;
      el.disabled = disabled;
    });
  }

  function setDeferredSearchState() {
    setControlsDisabled(true);
    els.btnSearch.disabled = false;
    els.btnSearch.textContent = 'Carregar base';
    els.searchHint.textContent = 'Modo leve ativado: a base completa será carregada apenas sob demanda.';
    els.summaryText.textContent = 'Modo leve ativo para evitar travamentos neste dispositivo. Toque em "Carregar base" para ativar a busca completa.';
    els.tableCount.textContent = '0 linhas';
    els.resultsBody.innerHTML = '<tr><td colspan="8">Modo leve ativo. Toque em <strong>Carregar base</strong> para carregar os documentos completos.</td></tr>';
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

    for (const rec of state.records) {
      totalDocs += 1;
      const hasText = hasExtractedText(rec);
      if (hasText) totalFilled += 1;

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

    els.methodologyNote.textContent = `Cobertura textual atual: ${pct}% (${nFmt.format(totalFilled)} de ${nFmt.format(totalDocs)} documentos). Desafios principais: documentos antigos com estrutura HTML irregular, links /view e anexos (PDF/TXT) indisponíveis ou lentos, além de bloqueios anti-bot intermitentes na Biblioteca da Presidência. Presidentes e mandatos com 0% de texto extraído foram ocultados dos filtros de busca para evitar resultados vazios; eles seguem no acervo bruto. Ocultos hoje: ${nFmt.format(hiddenPresCount)} presidentes e ${nFmt.format(hiddenMandateCount)} mandatos${hiddenPresCount ? ` (ex.: ${hiddenPresPreview}${hiddenSuffix})` : ''}.${mobileStrategy}`;
  }

  async function ensureRecordsReady() {
    if (state.recordsLoaded) return true;
    els.btnSearch.disabled = true;
    els.btnSearch.textContent = 'Carregando...';
    els.searchHint.textContent = 'Carregando base completa de discursos e entrevistas...';
    try {
      const records = await fetchJsonlGz('./data/records.jsonl.gz');
      state.records = records;
      state.recordsLoaded = true;
      state.ready = true;
      computeCoverage();
      updateMethodologyNote();
      populateFilterOptions();
      setControlsDisabled(false);
      els.btnSearch.textContent = 'Buscar';
      applySearch();
      return true;
    } catch (error) {
      els.summaryText.textContent = 'Falha ao carregar a base do Lulometro.';
      els.searchHint.textContent = `Erro ao carregar base: ${error.message}`;
      els.resultsBody.innerHTML = '<tr><td colspan="8">Nao foi possivel carregar os dados completos.</td></tr>';
      els.btnSearch.textContent = 'Carregar base';
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

  function applySearch() {
    if (!state.ready) return;

    const termRaw = (els.termInput.value || '').trim();
    const term = foldText(termRaw);
    const typeFilter = els.typeSelect.value;
    const presidentFilter = els.presidentSelect.value;
    const mandateFilter = els.mandateSelect.value;

    const hasTerm = term.length > 0;
    const results = [];

    const timeline = new Map();
    const byPresident = new Map();
    const byMandate = new Map();

    let totalMentions = 0;
    let earliestDate = '';
    let latestDate = '';

    for (const rec of state.records) {
      if (!hasExtractedText(rec)) continue;
      if (typeFilter !== 'ambos' && rec.type !== typeFilter) continue;
      if (presidentFilter !== 'todos' && rec.president !== presidentFilter) continue;
      if (mandateFilter !== 'todos' && rec.mandate !== mandateFilter) continue;

      let mentions = 0;
      if (hasTerm) {
        if (!rec._foldedText) {
          rec._foldedText = foldText(rec.text || '');
        }
        mentions = countOccurrences(rec._foldedText, term);
        if (mentions <= 0) continue;
      }

      results.push({ rec, mentions });

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

    const sampleDocs = nFmt.format(results.length);
    const totalDocs = nFmt.format(state.coverage ? state.coverage.totalFilled : state.records.length);
    if (hasTerm) {
      els.summaryText.textContent = `Busca por "${termRaw}" em ${sampleDocs} documentos, dentro de um universo de ${totalDocs}.`; 
      els.searchHint.textContent = `Termo atual: "${termRaw}". Busca sem distinção de maiúsculas/minúsculas e sem sensibilidade a acentos.`;
    } else {
      els.summaryText.textContent = `Sem termo aplicado. Mostrando ${sampleDocs} documentos filtrados de ${totalDocs} no total.`;
      els.searchHint.textContent = 'A busca ignora maiusculas/minusculas e acentos automaticamente.';
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
