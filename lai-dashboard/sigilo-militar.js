(() => {
  const METRICS_DATA_FILE = './data/report_data.json';
  const METRICS_METADATA_FILE = './data/metadata.json';
  const SOURCE_INDEX_FILE = './data/report_sources.json';
  const TEXT_SAMPLE_FILE_PRIMARY = './data/request_samples_publica.jsonl.gz';
  const TEXT_SAMPLE_FILE_FALLBACK = './data/request_samples.jsonl.gz';

  const TARGET_ORGS = [
    { code: 'CEX', org: 'CEX – Comando do Exército' },
    { code: 'MD', org: 'MD – Ministério da Defesa' },
    { code: 'CMAR', org: 'CMAR – Comando da Marinha' },
    { code: 'COMAER', org: 'COMAER – Comando da Aeronáutica' },
  ];
  const TARGET_ORG_SET = new Set(TARGET_ORGS.map((row) => row.org));
  const RESTRICTED_DECISIONS = new Set(['Acesso Negado', 'Acesso Parcialmente Concedido']);

  const nFmt = new Intl.NumberFormat('pt-BR');
  const pFmt = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const scheduleHelper = window.DashboardUpdateSchedule || null;

  const updatedLine = document.getElementById('updated-line');
  const scraperHealthBtn = document.getElementById('scraper-health-btn');
  const updateScheduleNote = document.getElementById('update-schedule-note');
  const metricTotal = document.getElementById('metric-total');
  const metricDenied = document.getElementById('metric-denied');
  const metricRestricted = document.getElementById('metric-restricted');
  const metricPersonal = document.getElementById('metric-personal');
  const alertList = document.getElementById('alert-list');
  const orgCards = document.getElementById('org-cards');

  const searchOrg = document.getElementById('search-org');
  const searchYear = document.getElementById('search-year');
  const searchDecision = document.getElementById('search-decision');
  const searchTheme = document.getElementById('search-theme');
  const searchQuery = document.getElementById('search-query');
  const searchBtn = document.getElementById('btn-search');
  const searchStatus = document.getElementById('search-status');
  const searchPagination = document.getElementById('search-pagination');
  const searchPageInfo = document.getElementById('search-page-info');
  const searchPagePrev = document.getElementById('btn-page-prev');
  const searchPageNext = document.getElementById('btn-page-next');
  const tableSearchResults = document.getElementById('table-search-results');

  const methodList = document.getElementById('method-list');
  const sourcesList = document.getElementById('sources-list');

  const chartInstances = [];
  let reportData = null;
  let metadata = null;
  let militaryRows = [];
  let orgStats = [];
  let orgAnalysis = {};
  let textSamplePathUsed = '';
  let searchCurrentPage = 1;
  const SEARCH_PAGE_SIZE = 25;
  const MOBILE_LIGHT_MODE = (() => {
    const smallScreen = window.matchMedia ? window.matchMedia('(max-width: 820px)').matches : false;
    const lowRam = Number.isFinite(Number(navigator.deviceMemory)) && Number(navigator.deviceMemory) <= 4;
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    return smallScreen || lowRam || saveData;
  })();
  let militaryRowsLoaded = false;

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

  function truncateText(text, limit = 200) {
    const clean = (text || '').toString().replace(/\s+/g, ' ').trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit - 1).trim()}…`;
  }

  function setSearchControlsDisabled(disabled) {
    [searchOrg, searchYear, searchDecision, searchTheme, searchQuery].forEach((el) => {
      if (!el) return;
      el.disabled = disabled;
    });
  }

  function setDeferredSearchState() {
    setSearchControlsDisabled(true);
    searchBtn.disabled = false;
    searchBtn.textContent = 'Carregar pedidos';
    searchStatus.textContent = 'Modo leve no mobile: a base textual é carregada só quando você tocar em "Carregar pedidos".';
    searchStatus.classList.remove('error');
    tableSearchResults.innerHTML = '<tr><td colspan="8">Modo leve ativo. Toque em <strong>Carregar pedidos</strong> para liberar busca e filtros detalhados.</td></tr>';
    renderPagination(0, 0);
  }

  async function ensureMilitaryRowsReady() {
    if (militaryRowsLoaded) return true;
    searchBtn.disabled = true;
    searchBtn.textContent = 'Carregando...';
    searchStatus.classList.remove('error');
    searchStatus.textContent = 'Carregando base textual dos pedidos...';
    try {
      await loadMilitaryRows();
      buildOrgAnalysisFromSample();
      renderMetricsAndAlerts();
      renderOrgCards();
      renderSearchFilters();
      setSearchControlsDisabled(false);
      searchBtn.textContent = 'Buscar';
      renderMethodology();
      runSearch({ resetPage: true });
      return true;
    } catch (error) {
      searchStatus.textContent = `Falha ao carregar base textual: ${error.message}`;
      searchStatus.classList.add('error');
      searchBtn.textContent = 'Carregar pedidos';
      return false;
    } finally {
      searchBtn.disabled = false;
    }
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

  function isPublicTextSamplePath(path) {
    const clean = (path || '').toString().toLowerCase();
    return clean.includes('publica') || clean.includes('filtrado');
  }

  function formatDateTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
    return resp.json();
  }

  async function fetchGzipText(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);

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

  function buildOrgStats() {
    const ranking = reportData.org_ranking || [];
    const map = new Map(ranking.map((row) => [row.org, row]));

    orgStats = TARGET_ORGS.map((target) => {
      const row = map.get(target.org) || {
        org: target.org,
        total_requests: 0,
        denied_total: 0,
        restricted_total: 0,
        personal_restricted_total: 0,
        denied_rate: 0,
        restricted_rate: 0,
      };

      return {
        code: target.code,
        org: target.org,
        total_requests: Number(row.total_requests || 0),
        denied_total: Number(row.denied_total || 0),
        restricted_total: Number(row.restricted_total || 0),
        personal_restricted_total: Number(row.personal_restricted_total || 0),
        denied_rate: Number(row.denied_rate || 0),
        restricted_rate: Number(row.restricted_rate || 0),
      };
    });
  }

  function buildOrgAnalysisFromSample() {
    const byOrg = {};
    TARGET_ORGS.forEach((target) => {
      byOrg[target.org] = {
        sample_count: 0,
        reasons: [],
        themes: [],
      };
    });

    TARGET_ORGS.forEach((target) => {
      const rows = militaryRows.filter((row) => row.org === target.org);
      const reasonCounter = new Map();
      const themeMap = new Map();

      rows.forEach((row) => {
        if (row.restricted && row.reason) {
          reasonCounter.set(row.reason, (reasonCounter.get(row.reason) || 0) + 1);
        }

        const theme = row.theme || 'Outros temas';
        if (!themeMap.has(theme)) {
          themeMap.set(theme, {
            theme,
            total: 0,
            restricted: 0,
            decisions: new Map(),
            examples: [],
          });
        }
        const current = themeMap.get(theme);
        current.total += 1;
        if (row.restricted) current.restricted += 1;
        current.decisions.set(row.decision, (current.decisions.get(row.decision) || 0) + 1);
        if (row.text_excerpt && current.examples.length < 2 && !current.examples.includes(row.text_excerpt)) {
          current.examples.push(row.text_excerpt);
        }
      });

      const reasons = [...reasonCounter.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      const themes = [...themeMap.values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map((item) => {
          const topDecision = [...item.decisions.entries()].sort((a, b) => b[1] - a[1])[0];
          return {
            theme: item.theme,
            total: item.total,
            restricted: item.restricted,
            restricted_rate: item.total ? (item.restricted / item.total) : 0,
            top_decision: topDecision ? topDecision[0] : 'Sem padrão claro',
            examples: item.examples,
          };
        });

      byOrg[target.org] = {
        sample_count: rows.length,
        reasons,
        themes,
      };
    });

    orgAnalysis = byOrg;
  }

  function renderHeader() {
    const updatedAtRaw = (metadata || {}).updated_at || reportData.generated_at;
    const updateNotice = scheduleHelper ? scheduleHelper.buildNotice('sigilo', updatedAtRaw) : null;
    const updatedLabel = formatDateTime(updatedAtRaw);
    updatedLine.textContent = `Atualizado em ${updatedLabel} (America/Cuiaba)`;
    if (updateScheduleNote) {
      updateScheduleNote.textContent = updateNotice
        ? updateNotice.text
        : `Ultima atualizacao: ${updatedLabel}.`;
    }
    if (scheduleHelper && scraperHealthBtn) {
      scheduleHelper.applyHealthState('sigilo', updatedAtRaw, scraperHealthBtn);
    }
  }

  function renderMetricsAndAlerts() {
    const total = orgStats.reduce((acc, row) => acc + row.total_requests, 0);
    const denied = orgStats.reduce((acc, row) => acc + row.denied_total, 0);
    const restricted = orgStats.reduce((acc, row) => acc + row.restricted_total, 0);
    const personal = orgStats.reduce((acc, row) => acc + row.personal_restricted_total, 0);

    metricTotal.textContent = nFmt.format(total);
    metricDenied.textContent = `${nFmt.format(denied)} (${pFmt.format(total ? denied / total : 0)})`;
    metricRestricted.textContent = `${nFmt.format(restricted)} (${pFmt.format(total ? restricted / total : 0)})`;
    metricPersonal.textContent = `${nFmt.format(personal)} (${pFmt.format(restricted ? personal / restricted : 0)})`;

    const maxDeniedRate = [...orgStats].sort((a, b) => b.denied_rate - a.denied_rate)[0];
    const maxRestrictedRate = [...orgStats].sort((a, b) => b.restricted_rate - a.restricted_rate)[0];
    const maxDeniedTotal = [...orgStats].sort((a, b) => b.denied_total - a.denied_total)[0];

    const restrictedRows = militaryRows.filter((row) => row.restricted);
    const reasonCounter = new Map();
    restrictedRows.forEach((row) => {
      if (!row.reason) return;
      reasonCounter.set(row.reason, (reasonCounter.get(row.reason) || 0) + 1);
    });
    const topReason = [...reasonCounter.entries()].sort((a, b) => b[1] - a[1])[0];
    const textBaseLabel = militaryRowsLoaded
      ? (isPublicTextSamplePath(textSamplePathUsed) ? 'base pública textual (BuscaLAI)' : 'base textual carregada')
      : 'base textual ainda não carregada (modo leve)';

    alertList.innerHTML = [
      `<li><strong>Maior taxa de negativa:</strong> ${esc(maxDeniedRate.org)} (${pFmt.format(maxDeniedRate.denied_rate)}).</li>`,
      `<li><strong>Maior taxa de restrição:</strong> ${esc(maxRestrictedRate.org)} (${pFmt.format(maxRestrictedRate.restricted_rate)}).</li>`,
      `<li><strong>Maior volume absoluto de negativas:</strong> ${esc(maxDeniedTotal.org)} (${nFmt.format(maxDeniedTotal.denied_total)} negativas).</li>`,
      `<li><strong>Motivo mais frequente no recorte textual:</strong> ${esc(militaryRowsLoaded ? (topReason ? topReason[0] : 'Sem dado suficiente') : 'carregue a base textual para ver este item')}.</li>`,
      `<li><strong>Base pesquisável deste monitor:</strong> ${nFmt.format(militaryRows.length)} pedidos com texto (${textBaseLabel}), filtrados para os 4 órgãos.</li>`,
    ].join('');
  }

  function renderCharts() {
    destroyCharts();

    const labels = orgStats.map((row) => row.code);

    pushChart(new Chart(document.getElementById('chart-org-volume'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Negados',
            data: orgStats.map((row) => row.denied_total),
            backgroundColor: 'rgba(182,66,66,0.86)',
            borderRadius: 7,
          },
          {
            label: 'Com restrição',
            data: orgStats.map((row) => row.restricted_total),
            backgroundColor: 'rgba(47,111,159,0.84)',
            borderRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
        },
      },
    }));

    pushChart(new Chart(document.getElementById('chart-org-rate'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Taxa de negativa',
            data: orgStats.map((row) => row.denied_rate * 100),
            backgroundColor: 'rgba(182,66,66,0.86)',
            borderRadius: 7,
          },
          {
            label: 'Taxa com restrição',
            data: orgStats.map((row) => row.restricted_rate * 100),
            backgroundColor: 'rgba(63,143,109,0.86)',
            borderRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => `${Number(v).toFixed(1)}%` } },
        },
      },
    }));
  }

  function renderOrgCards() {
    orgCards.innerHTML = TARGET_ORGS.map((target) => {
      const stat = orgStats.find((row) => row.org === target.org) || {};
      const analysis = orgAnalysis[target.org] || { sample_count: 0, reasons: [], themes: [] };

      const reasons = analysis.reasons.length
        ? `<ol class="kv">${analysis.reasons.map((item) => `<li>${esc(item.reason)} (${nFmt.format(item.count)})</li>`).join('')}</ol>`
        : '<p class="quote">Sem volume suficiente para listar motivos neste recorte.</p>';

      const themes = analysis.themes.length
        ? `<ol class="kv">${analysis.themes.map((item) => `<li><strong>${esc(item.theme)}</strong>: ${nFmt.format(item.total)} pedidos, ${pFmt.format(item.restricted_rate)} com restrição. Resposta mais comum: ${esc(item.top_decision)}.</li>`).join('')}</ol>`
        : '<p class="quote">Sem volume suficiente para listar temas neste recorte.</p>';

      const firstExample = (analysis.themes[0] && analysis.themes[0].examples[0]) || '';
      const totalRequests = Number(stat.total_requests || 0);
      const sampleShare = totalRequests ? (analysis.sample_count / totalRequests) : 0;

      return `
        <article class="org-card">
          <div class="org-title">${esc(target.org)}</div>
          <div class="chips">
            <span class="chip">Pedidos: ${nFmt.format(totalRequests)}</span>
            <span class="chip">Negados: ${nFmt.format(stat.denied_total || 0)} (${pFmt.format(stat.denied_rate || 0)})</span>
            <span class="chip">Restrição: ${nFmt.format(stat.restricted_total || 0)} (${pFmt.format(stat.restricted_rate || 0)})</span>
            <span class="chip">Info pessoal: ${nFmt.format(stat.personal_restricted_total || 0)}</span>
          </div>
          <div class="subhead">Temas mais recorrentes no texto dos pedidos</div>
          ${themes}
          <div class="subhead">Motivos mais frequentes de restrição/negação</div>
          ${reasons}
          <div class="subhead">Exemplo de pedido (texto original resumido)</div>
          <p class="quote">${firstExample ? `“${esc(truncateText(firstExample, 280))}”` : 'Sem exemplo disponível para este órgão.'}</p>
          <p style="font-size:0.78rem;">Cobertura da busca textual: ${nFmt.format(analysis.sample_count)} pedidos (${pFmt.format(sampleShare)} do total do órgão).</p>
        </article>
      `;
    }).join('');
  }

  function renderSearchFilters() {
    const years = [...new Set(militaryRows.map((row) => row.year).filter(Boolean))].sort((a, b) => b - a);
    const themes = [...new Set(militaryRows.map((row) => row.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    searchOrg.innerHTML = `<option value="">Órgão: todos os 4</option>${TARGET_ORGS.map((target) => `<option value="${esc(target.org)}">${esc(target.code)} - ${esc(target.org)}</option>`).join('')}`;
    searchYear.innerHTML = `<option value="">Ano: todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join('')}`;
    searchDecision.innerHTML = [
      '<option value="">Decisão: todas</option>',
      '<option value="restricao">Com restrição (negado + parcial)</option>',
      '<option value="Acesso Negado">Acesso Negado</option>',
      '<option value="Acesso Parcialmente Concedido">Acesso Parcialmente Concedido</option>',
      '<option value="Acesso Concedido">Acesso Concedido</option>',
      '<option value="outros">Outros</option>',
    ].join('');
    searchTheme.innerHTML = `<option value="">Tema: todos</option>${themes.map((theme) => `<option value="${esc(theme)}">${esc(theme)}</option>`).join('')}`;
    if (militaryRowsLoaded) {
      searchBtn.textContent = 'Buscar';
    }
  }

  function renderPagination(totalRows, shownRows) {
    if (!searchPagination || !searchPageInfo || !searchPagePrev || !searchPageNext) return;
    const totalPages = Math.max(1, Math.ceil(totalRows / SEARCH_PAGE_SIZE));
    searchPagination.hidden = totalRows <= SEARCH_PAGE_SIZE;
    searchPageInfo.textContent = `Página ${nFmt.format(searchCurrentPage)} de ${nFmt.format(totalPages)} · ${nFmt.format(shownRows)} itens nesta página`;
    searchPagePrev.disabled = searchCurrentPage <= 1;
    searchPageNext.disabled = searchCurrentPage >= totalPages;
  }

  function runSearch({ resetPage = true } = {}) {
    if (!militaryRowsLoaded) {
      tableSearchResults.innerHTML = '<tr><td colspan="8">A base textual ainda não foi carregada neste aparelho. Toque em <strong>Carregar pedidos</strong>.</td></tr>';
      searchStatus.textContent = 'Modo leve no mobile: carregue a base textual quando quiser usar filtros detalhados.';
      searchStatus.classList.remove('error');
      renderPagination(0, 0);
      return;
    }

    const org = searchOrg.value;
    const year = searchYear.value;
    const decision = searchDecision.value;
    const theme = searchTheme.value;
    const queryTokens = normalizeForSearch(searchQuery.value || '').split(' ').filter(Boolean);

    let rows = militaryRows;

    if (org) rows = rows.filter((row) => row.org === org);
    if (year) rows = rows.filter((row) => String(row.year) === String(year));
    if (theme) rows = rows.filter((row) => row.theme === theme);
    if (decision === 'restricao') rows = rows.filter((row) => row.restricted);
    else if (decision === 'outros') rows = rows.filter((row) => !['Acesso Negado', 'Acesso Parcialmente Concedido', 'Acesso Concedido'].includes(row.decision));
    else if (decision) rows = rows.filter((row) => row.decision === decision);
    if (queryTokens.length) {
      rows = rows.filter((row) => queryTokens.every((token) => row.search_blob.includes(token)));
    }

    rows = [...rows].sort((a, b) => {
      const yearDiff = Number(b.year || 0) - Number(a.year || 0);
      if (yearDiff !== 0) return yearDiff;
      return String(a.org || '').localeCompare(String(b.org || ''), 'pt-BR');
    });

    if (resetPage) searchCurrentPage = 1;
    const totalPages = Math.max(1, Math.ceil(rows.length / SEARCH_PAGE_SIZE));
    if (searchCurrentPage > totalPages) searchCurrentPage = totalPages;
    const start = (searchCurrentPage - 1) * SEARCH_PAGE_SIZE;
    const end = start + SEARCH_PAGE_SIZE;
    const shown = rows.slice(start, end);

    tableSearchResults.innerHTML = shown.length
      ? shown.map((row) => `
        <tr>
          <td>${row.year || '--'}</td>
          <td>${esc(row.org || '--')}</td>
          <td>${esc(row.decision || '--')}</td>
          <td>${esc(row.reason || '--')}</td>
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
      : '<tr><td colspan="8">Nenhum resultado com esse filtro.</td></tr>';

    const textBaseLabel = isPublicTextSamplePath(textSamplePathUsed)
      ? 'base pública textual (BuscaLAI)'
      : 'base textual carregada';
    const shownStart = rows.length ? start + 1 : 0;
    const shownEnd = start + shown.length;
    searchStatus.innerHTML = `Base textual deste monitor: <strong>${nFmt.format(militaryRows.length)}</strong> pedidos (${textBaseLabel}) filtrados para CEX, MD, CMAR e COMAER. Resultado atual: <strong>${nFmt.format(rows.length)}</strong>${rows.length ? ` (mostrando ${nFmt.format(shownStart)}-${nFmt.format(shownEnd)}).` : '.'}`;
    renderPagination(rows.length, shown.length);
  }

  function renderMethodology() {
    const source = reportData.source || {};
    const years = source.years_covered || [];
    const start = years.length ? Math.min(...years) : '--';
    const end = years.length ? Math.max(...years) : '--';
    const textSourceLabel = militaryRowsLoaded
      ? (isPublicTextSamplePath(textSamplePathUsed)
        ? 'base pública do BuscaLAI (pedidos com texto)'
        : 'base textual disponível no build atual')
      : 'base textual sob demanda no modo leve mobile';

    methodList.innerHTML = [
      `<li>Recorte institucional fixo: <strong>CEX</strong>, <strong>MD</strong>, <strong>CMAR</strong> e <strong>COMAER</strong>.</li>`,
      `<li>Período coberto: <strong>${start}-${end}</strong>, com dados oficiais da CGU.</li>`,
      '<li>Indicadores de pedidos, negativas e restrições usam a base ampla da CGU (todos os pedidos e recursos do Fala.BR).</li>',
      `<li>A análise textual (“temas”, “motivos” e busca) usa a ${textSourceLabel}, com <strong>${nFmt.format(militaryRows.length)}</strong> pedidos desses 4 órgãos${militaryRowsLoaded ? '' : ' (carregue a base para ativar essa parte no mobile)'}. Esse total é menor porque depende apenas do que está público com texto navegável.</li>`,
      '<li>Link de cada linha: o botão <code>Pedido</code> abre o detalhe via API pública da CGU (<code>/buscar-pedidos/{id}</code>); o botão <code>Anexo</code> aparece quando disponível. Em parte dos pedidos antigos, o conteúdo público pode não estar mais acessível.</li>',
      '<li>Definições: “com restrição” = <code>Acesso Negado</code> + <code>Acesso Parcialmente Concedido</code>.</li>',
    ].join('');
  }

  function renderSourcesFooter() {
    const source = reportData.source || {};
    const years = source.years_covered || [];
    const template = source.download_url_template || '';
    const links = [];
    const seen = new Set();
    const add = (label, url) => {
      const clean = (url || '').toString().trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      links.push({ label, url: clean });
    };

    add('Base ampla (todos os pedidos e recursos) - Fala.BR/CGU', 'https://falabr.cgu.gov.br/web/dadosabertoslai');
    years.forEach((year) => {
      add(
        `Arquivo anual ${year} da base ampla (Pedidos_csv)`,
        `https://dadosabertos-download.cgu.gov.br/FalaBR/Arquivos_FalaBR/Pedidos_csv_${year}.zip`
      );
    });
    add('Base pública com texto dos pedidos - BuscaLAI/CGU', 'https://buscalai.cgu.gov.br/DownloadDados/DownloadDados');
    years.forEach((year) => {
      add(
        `Arquivo anual ${year} da base pública (Arquivos_csv)`,
        `https://dadosabertos-download.cgu.gov.br/FalaBR/Arquivos_FalaBR_Filtrado/Arquivos_csv_${year}.zip`
      );
    });
    if (source.portal_url) {
      add('Portal oficial da fonte principal usada nos indicadores', source.portal_url);
    }
    if (template.includes('{year}')) {
      years.forEach((year) => {
        add(`Arquivo anual ${year} da fonte principal`, template.replace('{year}', String(year)));
      });
    }
    add('Painel oficial LAI (Central de Painéis CGU)', 'https://centralpaineis.cgu.gov.br/visualizar/lai');
    add('API pública do painel LAI (Central de Painéis CGU)', 'https://centralpaineis.cgu.gov.br/api/publico/visualizar/lai');
    add('Busca pública direta por pedido', 'https://buscalai.cgu.gov.br/busca/{id_pedido}');
    add('API pública de detalhe do pedido', 'https://api-laibr.cgu.gov.br/buscar-pedidos/{id_pedido}');
    add('Precedentes recursais (CGU/CMRI)', source.precedentes_url);

    sourcesList.innerHTML = links.map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)}</a></li>`).join('');
  }

  function bindEvents() {
    searchBtn.addEventListener('click', async () => {
      if (!militaryRowsLoaded) {
        const ready = await ensureMilitaryRowsReady();
        if (!ready) return;
      }
      runSearch({ resetPage: true });
    });
    [searchOrg, searchYear, searchDecision, searchTheme].forEach((el) => {
      el.addEventListener('change', () => {
        if (!militaryRowsLoaded) return;
        runSearch({ resetPage: true });
      });
    });
    searchQuery.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!militaryRowsLoaded) {
          ensureMilitaryRowsReady().then((ready) => {
            if (ready) runSearch({ resetPage: true });
          });
          return;
        }
        runSearch({ resetPage: true });
      }
    });
    if (searchPagePrev) {
      searchPagePrev.addEventListener('click', () => {
        searchCurrentPage = Math.max(1, searchCurrentPage - 1);
        runSearch({ resetPage: false });
      });
    }
    if (searchPageNext) {
      searchPageNext.addEventListener('click', () => {
        searchCurrentPage += 1;
        runSearch({ resetPage: false });
      });
    }
  }

  async function loadMilitaryRows() {
    militaryRowsLoaded = false;
    let sourceIndex = null;
    try {
      sourceIndex = await fetchJson(SOURCE_INDEX_FILE);
    } catch {
      sourceIndex = null;
    }

    const candidates = [
      (((sourceIndex || {}).sources || {}).publica || {}).samples_file || '',
      TEXT_SAMPLE_FILE_PRIMARY,
      ((reportData.search_dashboard || {}).sample_file) || '',
      TEXT_SAMPLE_FILE_FALLBACK,
    ]
      .map((value) => (value || '').toString().trim())
      .filter(Boolean);

    const dedupCandidates = [...new Set(candidates)];

    let text = '';
    let loaded = false;
    let lastError = null;
    for (const candidatePath of dedupCandidates) {
      try {
        text = await fetchGzipText(candidatePath);
        textSamplePathUsed = candidatePath;
        loaded = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!loaded) {
      throw new Error(lastError ? lastError.message : 'falha ao carregar base textual');
    }

    militaryRows = text
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
      .map((row) => {
        const idPedido = (row.id_pedido || '').toString().trim();
        const linkPack = resolveRequestLinks(
          idPedido,
          row.request_public_link || '',
          row.request_attachment_link || row.request_link || '',
          row.request_link || '',
        );
        const restricted = Boolean(row.restricted) || RESTRICTED_DECISIONS.has(row.decision);
        const normalized = {
          id_pedido: idPedido,
          year: Number(row.year || 0),
          org: row.org || '',
          decision: row.decision || '',
          restricted,
          reason: row.reason || 'Motivo não informado',
          subject: row.subject || 'Assunto não informado',
          theme: row.theme || 'Outros temas',
          text_excerpt: row.text_excerpt || '',
          ...linkPack,
        };

        normalized.search_blob = normalizeForSearch(
          `${normalized.org} ${normalized.decision} ${normalized.reason} ${normalized.subject} ${normalized.theme} ${normalized.text_excerpt}`
        );
        return normalized;
      })
      .filter((row) => TARGET_ORG_SET.has(row.org));
    militaryRowsLoaded = true;
  }

  async function boot() {
    bindEvents();

    try {
      [reportData, metadata] = await Promise.all([
        fetchJson(METRICS_DATA_FILE),
        fetchJson(METRICS_METADATA_FILE).catch(() => null),
      ]);
    } catch (error) {
      alertList.innerHTML = `<li>Falha ao carregar dados: ${esc(error.message)}</li>`;
      return;
    }

    buildOrgStats();
    renderHeader();
    renderCharts();
    renderSearchFilters();
    renderSourcesFooter();

    if (MOBILE_LIGHT_MODE) {
      militaryRows = [];
      militaryRowsLoaded = false;
      buildOrgAnalysisFromSample();
      renderMetricsAndAlerts();
      renderOrgCards();
      setDeferredSearchState();
      renderMethodology();
      return;
    }

    try {
      await loadMilitaryRows();
    } catch (error) {
      searchStatus.textContent = `Falha ao carregar base textual: ${error.message}`;
      searchStatus.classList.add('error');
    }
    buildOrgAnalysisFromSample();
    renderSearchFilters();
    renderMetricsAndAlerts();
    renderOrgCards();
    setSearchControlsDisabled(false);
    searchBtn.textContent = 'Buscar';
    runSearch();
    renderMethodology();
  }

  boot();
})();
