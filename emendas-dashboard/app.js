(function () {
  const nFmt = new Intl.NumberFormat('pt-BR');
  const moneyFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
  const pctFmt = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  });

  const els = {
    statusUpdate: document.getElementById('status-update'),
    statusSnapshot: document.getElementById('status-snapshot'),
    statusSource: document.getElementById('status-source'),
    sourceUpdatedLine: document.getElementById('source-updated-line'),
    compareAlert: document.getElementById('compare-alert'),
    compareAlertText: document.getElementById('compare-alert-text'),
    compareAlertAction: document.getElementById('compare-alert-action'),

    tabViewSnapshot: document.getElementById('tab-view-snapshot'),
    tabViewDocs: document.getElementById('tab-view-docs'),
    viewSnapshot: document.getElementById('view-snapshot'),
    viewDocs: document.getElementById('view-docs'),

    kpiDayMain: document.getElementById('kpi-day-main'),
    kpiDayMainNote: document.getElementById('kpi-day-main-note'),
    kpiDeltaNet: document.getElementById('kpi-delta-net'),
    kpiAuthorsUp: document.getElementById('kpi-authors-up'),
    kpiDestinationsUp: document.getElementById('kpi-destinations-up'),
    kpiLabelNet: document.getElementById('label-kpi-net'),
    kpiLabelAuthors: document.getElementById('label-kpi-authors'),
    kpiLabelDestinations: document.getElementById('label-kpi-destinations'),
    spotlight: document.getElementById('spotlight'),

    snapshotProgressTotalText: document.getElementById('snapshot-progress-total-text'),
    snapshotProgressTotalFill: document.getElementById('snapshot-progress-total-fill'),
    snapshotProgressYearText: document.getElementById('snapshot-progress-year-text'),
    snapshotProgressYearFill: document.getElementById('snapshot-progress-year-fill'),
    snapshotProgressNote: document.getElementById('snapshot-progress-note'),

    docKpiMaxYear: document.getElementById('doc-kpi-max-year'),
    docKpiCommittedSoFar: document.getElementById('doc-kpi-committed-so-far'),
    docKpiCommittedLastDay: document.getElementById('doc-kpi-committed-last-day'),
    docKpiPaidYear: document.getElementById('doc-kpi-paid-year'),
    docsProgressYearText: document.getElementById('docs-progress-year-text'),
    docsProgressYearFill: document.getElementById('docs-progress-year-fill'),
    docsProgressDayText: document.getElementById('docs-progress-day-text'),
    docsProgressDayFill: document.getElementById('docs-progress-day-fill'),
    docsProgressNote: document.getElementById('docs-progress-note'),
    docSpotlight: document.getElementById('doc-spotlight'),

    tablePairs: document.getElementById('table-pairs'),
    tableAuthorsTotal: document.getElementById('table-authors-total'),
    tableDestinationsTotal: document.getElementById('table-destinations-total'),

    docsModeDay: document.getElementById('docs-mode-day'),
    docsModeYear: document.getElementById('docs-mode-year'),
    docsModeNote: document.getElementById('docs-mode-note'),
    tableDocsAuthorsDynamic: document.getElementById('table-docs-authors-dynamic'),
    tableDocsDestDay: document.getElementById('table-docs-dest-day'),
    tableClassicAccumulated: document.getElementById('table-classic-accumulated'),
    tableClassicWeek: document.getElementById('table-classic-week'),
    tableClassicDay: document.getElementById('table-classic-day'),
    tableApoiamentoTop: document.getElementById('table-apoiamento-top'),
    tableApoiamentoAuthors: document.getElementById('table-apoiamento-authors'),
    tableApoiamentoGroups: document.getElementById('table-apoiamento-groups'),
    apoiamentoNote: document.getElementById('apoiamento-note'),
    apoiamentoExplain: document.getElementById('apoiamento-explain'),

    sourcesList: document.getElementById('sources-list'),

    chartHistory: document.getElementById('chart-history'),
    chartAuthors: document.getElementById('chart-authors'),
    chartDestinations: document.getElementById('chart-destinations'),
    chartDocsDaily: document.getElementById('chart-docs-daily'),
    chartDocsAuthorsShare: document.getElementById('chart-docs-authors-share'),
  };

  const state = {
    report: null,
    metadata: null,
    activeView: 'docs',
    docsMode: 'year',
  };

  const chartInstances = [];
  let docsAuthorsChart = null;

  function esc(value) {
    return (value || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function helpIcon(text) {
    const safe = esc(text).replace(/\s+/g, ' ').trim();
    return `<span class="help-tip" tabindex="0" data-tip="${safe}" aria-label="${safe}">?</span>`;
  }

  function formatIsoDateTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function formatHeaderDate(rawDate) {
    if (!rawDate) return '--';
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return rawDate;
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function formatDatePt(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  }

  function parseLooseDate(rawDate) {
    const raw = (rawDate || '').toString().trim();
    if (!raw) return null;

    const mBr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
    if (mBr) {
      const dd = String(mBr[1]).padStart(2, '0');
      const mm = String(mBr[2]).padStart(2, '0');
      const yyyy = mBr[3];
      const hh = String(mBr[4] || '0').padStart(2, '0');
      const mi = String(mBr[5] || '0').padStart(2, '0');
      const ss = String(mBr[6] || '0').padStart(2, '0');
      const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
      if (!Number.isNaN(d.getTime())) return d;
    }

    const mIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mIso) {
      const d = new Date(`${mIso[1]}-${mIso[2]}-${mIso[3]}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }

    const fallback = new Date(raw);
    if (!Number.isNaN(fallback.getTime())) return fallback;
    return null;
  }

  function getIsoWeekLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '--';
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-S${String(weekNo).padStart(2, '0')}`;
  }

  function money(value) {
    return moneyFmt.format(Number(value || 0));
  }

  function toNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  }

  function shortLabel(text, limit = 32) {
    const raw = (text || '').toString();
    if (raw.length <= limit) return raw;
    return `${raw.slice(0, limit - 1).trim()}…`;
  }

  function classifyGroup(partyRaw) {
    const party = (partyRaw || '').toString().trim();
    if (!party) return 'Não identificado';
    const normalized = party.toLowerCase();
    if (normalized === 'bancada') return 'Bancada';
    if (normalized === 'comissao') return 'Comissão';
    if (normalized === 'relatoria') return 'Relatoria';
    if (normalized.includes('nao identificado')) return 'Não identificado';
    return `Partido (${party})`;
  }

  function destroyCharts() {
    while (chartInstances.length) {
      const chart = chartInstances.pop();
      chart.destroy();
    }
    if (docsAuthorsChart) {
      docsAuthorsChart.destroy();
      docsAuthorsChart = null;
    }
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${url}`);
    }
    return resp.json();
  }

  function setProgress(fillEl, textEl, numerator, denominator, options = {}) {
    if (!fillEl || !textEl) return;
    const num = toNumber(numerator);
    const den = toNumber(denominator);

    if (den <= 0) {
      fillEl.style.width = '0%';
      textEl.textContent = options.noBaseText || 'Sem base comparável';
      return;
    }

    const ratio = num / den;
    const width = Math.max(0, Math.min(100, ratio * 100));
    fillEl.style.width = `${width}%`;

    if (options.percentOnly) {
      textEl.textContent = pctFmt.format(ratio);
      return;
    }

    textEl.textContent = `${money(num)} / ${money(den)} (${pctFmt.format(ratio)})`;
  }

  function getMaxYearInfo(report) {
    const parallel = report.parallel_monitor || {};
    const siop = parallel.siop_snapshot || {};
    const siopTotals = siop.totals || {};
    const dotacaoAtual = toNumber(siopTotals.dotacao_atual_emenda);
    if (dotacaoAtual > 0) {
      const baseDate = (siop.base_siafi_date || '').trim();
      return {
        value: dotacaoAtual,
        sourceLabel: baseDate
          ? `Dotação Atual da base SIOP (SIAFI em ${baseDate})`
          : 'Dotação Atual da base SIOP',
      };
    }

    const stageValues = (parallel.execucao_ano_corrente || {}).stage_values || {};
    const empenhado = toNumber(stageValues.empenhado);
    const aEmpenhar = toNumber(stageValues.a_empenhar);
    if (aEmpenhar > 0) {
      return {
        value: empenhado + aEmpenhar,
        sourceLabel: 'estimativa do endpoint de execução no Portal da Transparência',
      };
    }

    return { value: 0, sourceLabel: '' };
  }

  function setActiveView(viewId) {
    const isSnapshot = viewId === 'snapshot';
    state.activeView = isSnapshot ? 'snapshot' : 'docs';

    els.viewSnapshot.hidden = !isSnapshot;
    els.viewDocs.hidden = isSnapshot;
    els.tabViewSnapshot.classList.toggle('active', isSnapshot);
    els.tabViewDocs.classList.toggle('active', !isSnapshot);
    const targetHash = isSnapshot ? '#snapshot' : '#docs';
    if (window.location.hash !== targetHash) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${targetHash}`);
    }

    if (state.report) {
      renderHeaderForView(state.report, state.metadata || {});
    }
  }

  function getInitialView() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash.includes('docs') || hash.includes('portal')) return 'docs';
    if (hash.includes('snapshot') || hash.includes('siga')) return 'snapshot';

    const viewParam = new URLSearchParams(window.location.search).get('view');
    if ((viewParam || '').toLowerCase() === 'docs') return 'docs';
    if ((viewParam || '').toLowerCase() === 'snapshot') return 'snapshot';

    return 'docs';
  }

  function setSnapshotKpis(report) {
    const metrics = report.metrics || {};
    const deltaNet = toNumber(metrics.delta_liquido_desde_snapshot_anterior);
    const deltaPositive = toNumber(metrics.delta_positivo_desde_snapshot_anterior);

    els.kpiLabelNet.innerHTML = `Variação líquida no dia ${helpIcon('Soma das altas e quedas do dia. Se o valor estiver negativo, houve mais queda que alta no conjunto.')}`;
    els.kpiLabelAuthors.innerHTML = `Autores com aumento hoje ${helpIcon('Quantidade de autores que tiveram aumento de empenho no dia comparado ao snapshot anterior.')}`;
    els.kpiLabelDestinations.innerHTML = `Localidades com aumento hoje ${helpIcon('Localidade de aplicação é para onde o recurso foi direcionado: município, estado, órgão ou projeto.')}`;

    els.kpiDayMain.textContent = money(deltaPositive);
    els.kpiDayMainNote.textContent = 'Comparação com o snapshot anterior da base Siga Brasil.';

    els.kpiDeltaNet.textContent = money(deltaNet);
    els.kpiDeltaNet.classList.toggle('good', deltaNet >= 0);
    els.kpiDeltaNet.classList.toggle('bad', deltaNet < 0);

    els.kpiAuthorsUp.textContent = nFmt.format(metrics.autores_com_aumento || 0);
    els.kpiDestinationsUp.textContent = nFmt.format(metrics.destinos_com_aumento || 0);

    const totalYear = toNumber(metrics.current_year_total_empenhado || ((report.unico_year_summary || {}).total_empenhado || 0));
    const maxYearInfo = getMaxYearInfo(report);
    const maxYear = toNumber(maxYearInfo.value);

    setProgress(
      els.snapshotProgressTotalFill,
      els.snapshotProgressTotalText,
      totalYear,
      maxYear,
      { noBaseText: 'Sem valor autorizado anual disponível' }
    );

    setProgress(
      els.snapshotProgressYearFill,
      els.snapshotProgressYearText,
      deltaPositive,
      totalYear,
      { noBaseText: 'Sem acumulado anual disponível' }
    );

    if (maxYear > 0) {
      els.snapshotProgressNote.textContent = `No ano corrente, já foram empenhados ${money(totalYear)} de ${money(maxYear)} autorizados no recorte parlamentar (RP 6/7/8). A segunda barra mostra o peso do dia dentro desse acumulado anual.`;
    } else if (totalYear > 0) {
      els.snapshotProgressNote.textContent = 'A primeira barra depende do valor autorizado anual do SIOP. Como ele não veio nesta atualização, mostramos apenas a relação do dia com o acumulado do ano.';
    } else {
      els.snapshotProgressNote.textContent = 'Sem total anual consistente nesta atualização para comparar o movimento diário.';
    }
  }

  function setDocsKpis(report) {
    const docs = (((report.parallel_monitor || {}).documents) || {});
    const totals = docs.totals || {};

    const committedYear = toNumber(totals.total_empenhado_year);
    const committedLastDay = toNumber(totals.total_empenhado_last_day);
    const paidYear = toNumber(totals.total_pago_year);
    const maxYearInfo = getMaxYearInfo(report);
    const maxYear = toNumber(maxYearInfo.value);

    els.kpiLabelNet.innerHTML = `Empenhado no ano (acum.) ${helpIcon('Valor total já empenhado no ano na fonte por documento.')}`;
    els.kpiLabelAuthors.innerHTML = `Autores com empenho no último dia ${helpIcon('Quantidade de autores que apareceram com empenho no último dia disponível nessa fonte.')}`;
    els.kpiLabelDestinations.innerHTML = `Localidades com empenho no último dia ${helpIcon('Localidades de aplicação que receberam empenho no último dia disponível.')}`;

    els.kpiDayMain.textContent = money(committedLastDay);
    els.kpiDayMainNote.textContent = `Fonte Portal da Transparência por documento. Último dia com dados: ${docs.date_max || '--'}.`;

    els.kpiDeltaNet.textContent = money(committedYear);
    els.kpiDeltaNet.classList.add('good');
    els.kpiDeltaNet.classList.remove('bad');

    els.kpiAuthorsUp.textContent = nFmt.format((docs.top_authors_last_day || []).length);
    els.kpiDestinationsUp.textContent = nFmt.format((docs.top_destinations_last_day || []).length);

    els.docKpiCommittedSoFar.textContent = money(committedYear);
    els.docKpiCommittedLastDay.textContent = money(committedLastDay);
    els.docKpiPaidYear.textContent = money(paidYear);

    if (maxYear && maxYear > 0) {
      els.docKpiMaxYear.textContent = money(maxYear);
      setProgress(
        els.docsProgressYearFill,
        els.docsProgressYearText,
        committedYear,
        maxYear,
        { noBaseText: 'Sem valor autorizado disponível' }
      );
      const sourceLabel = maxYearInfo.sourceLabel || 'fonte não identificada';
      els.docsProgressNote.textContent = `Valor autorizado anual considerado: ${money(maxYear)} (${sourceLabel}).`;
    } else {
      els.docKpiMaxYear.textContent = 'não disponível';
      els.docsProgressYearFill.style.width = '0%';
      els.docsProgressYearText.textContent = `Sem valor autorizado anual divulgado (já empenhado ${money(committedYear)})`;
      els.docsProgressNote.textContent = 'Esta fonte não trouxe valor autorizado anual explícito nesta atualização. Mostramos apenas o acumulado já empenhado.';
    }

    setProgress(
      els.docsProgressDayFill,
      els.docsProgressDayText,
      committedLastDay,
      committedYear,
      { noBaseText: 'Sem acumulado anual disponível' }
    );
  }

  function setSpotlight(report) {
    const docs = (((report.parallel_monitor || {}).documents) || {});
    const totals = docs.totals || {};
    const topAuthor = ((docs.top_authors_year || [])[0]) || null;
    const topDestination = ((docs.top_destinations_last_day || [])[0]) || null;
    const committedYear = toNumber(totals.total_empenhado_year);
    const lastDay = toNumber(totals.total_empenhado_last_day);
    const dateMax = docs.date_max || '--';

    if (!committedYear && !lastDay) {
      els.spotlight.innerHTML = 'A base principal ainda não trouxe totais consolidados para esta atualização.';
      return;
    }

    els.spotlight.innerHTML =
      `Na base principal do Portal da Transparência (documentos), até <strong>${esc(dateMax)}</strong> ` +
      `foram empenhados <strong>${money(committedYear)}</strong> no ano, com ` +
      `<strong>${money(lastDay)}</strong> no último dia disponível.` +
      (topAuthor
        ? ` Maior autor no ano: <strong>${esc(topAuthor.author)}</strong> (${money(topAuthor.empenhado)}).`
        : '') +
      (topDestination
        ? ` Maior destino no último dia: <strong>${esc(topDestination.destination)}</strong> (${money(topDestination.empenhado)}).`
        : '');
  }

  function renderComparisonAlert(report, metadata) {
    if (!els.compareAlert || !els.compareAlertText || !els.compareAlertAction) return;

    const parallel = report.parallel_monitor || {};
    const docs = parallel.documents || {};
    const docsTotals = docs.totals || {};
    const docsCommitted = toNumber(docsTotals.total_empenhado_year);
    const docsDate = parseLooseDate(docs.date_max || ((docs.source || {}).last_modified || metadata.documents_last_modified || ''));

    const siop = parallel.siop_snapshot || {};
    const siopTotals = siop.totals || {};
    const siopCommitted = toNumber(siopTotals.empenhado);
    const siopDateRaw = siop.last_update || siop.base_siafi_date || metadata.siop_base_siafi_date || '';
    const siopDate = parseLooseDate(siopDateRaw);

    const maxBase = Math.max(docsCommitted, siopCommitted, 0);
    const diffRatio = maxBase > 0 ? Math.abs(docsCommitted - siopCommitted) / maxBase : 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const daysAhead = (docsDate && siopDate) ? Math.floor((siopDate.getTime() - docsDate.getTime()) / dayMs) : 0;
    const siopNewer = daysAhead >= 1;
    const largeDifference = diffRatio >= 0.2;

    if (!siop.available || (!siopNewer && !largeDifference)) {
      els.compareAlert.hidden = true;
      return;
    }

    const chunks = ['Painel principal: Portal da Transparência (documentos).'];
    if (largeDifference) {
      chunks.push(
        `No ano, Portal mostra ${money(docsCommitted)} e SIOP mostra ${money(siopCommitted)} ` +
        `(diferença de ${pctFmt.format(diffRatio)}).`
      );
    }
    if (siopNewer) {
      chunks.push(
        `SIOP está mais atualizado no recorte de data: ${esc(siopDateRaw || '--')} ` +
        `vs último dia do Portal em ${esc(docs.date_max || '--')}.`
      );
    }
    chunks.push('Se precisar conferir, abra o comparativo SIOP.');

    els.compareAlertText.innerHTML = chunks.join(' ');
    els.compareAlert.hidden = false;
  }

  function renderPairsTable(rows) {
    if (!rows.length) {
      els.tablePairs.innerHTML = '<tr><td colspan="5">Sem variação positiva no dia.</td></tr>';
      return;
    }
    els.tablePairs.innerHTML = rows.slice(0, 40).map((row) => `
      <tr>
        <td>${esc(row.author)}</td>
        <td>${esc(row.party || 'Nao identificado')}</td>
        <td>${esc(row.destination)}</td>
        <td>${money(row.delta_empenhado)}</td>
        <td>${money(row.current_empenhado)}</td>
      </tr>
    `).join('');
  }

  function renderAuthorsTotalTable(rows) {
    if (!rows.length) {
      els.tableAuthorsTotal.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
      return;
    }
    els.tableAuthorsTotal.innerHTML = rows.slice(0, 20).map((row) => `
      <tr>
        <td>${esc(row.author)}</td>
        <td>${esc(row.party || 'Nao identificado')}</td>
        <td>${money(row.total_empenhado)}</td>
      </tr>
    `).join('');
  }

  function renderSimpleTable(target, rows, nameKey, valueKey, emptyColspan = 2) {
    if (!rows.length) {
      target.innerHTML = `<tr><td colspan="${emptyColspan}">Sem dados.</td></tr>`;
      return;
    }
    target.innerHTML = rows.slice(0, 20).map((row) => `
      <tr>
        <td>${esc(row[nameKey])}</td>
        <td>${money(row[valueKey])}</td>
      </tr>
    `).join('');
  }

  function renderHistoryChart(dailyHistory) {
    const labels = dailyHistory.map((row) => row.date || '--');
    const positive = dailyHistory.map((row) => toNumber(row.delta_positivo));
    const net = dailyHistory.map((row) => toNumber(row.delta_liquido));

    const chart = new Chart(els.chartHistory, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Empenhado no dia (positivo)',
            data: positive,
            borderColor: '#c1733f',
            backgroundColor: 'rgba(193, 115, 63, 0.20)',
            borderWidth: 2,
            tension: 0.22,
            pointRadius: 2,
            fill: true,
          },
          {
            label: 'Variação líquida',
            data: net,
            borderColor: '#3f6b7b',
            borderWidth: 1.8,
            tension: 0.2,
            pointRadius: 1.8,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
          },
        },
        plugins: {
          legend: {
            labels: { boxWidth: 14, boxHeight: 8 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
    chartInstances.push(chart);
  }

  function renderBarChart(canvas, rows, labelKey, valueKey, title, color) {
    const sliced = rows.slice(0, 10);
    const labels = sliced.map((row) => shortLabel(row[labelKey] || '--', 26));
    const values = sliced.map((row) => toNumber(row[valueKey]));
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
            backgroundColor: color,
            borderRadius: 6,
            maxBarThickness: 26,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => money(ctx.parsed.x),
            },
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
          },
        },
      },
    });
    chartInstances.push(chart);
  }

  function renderDocsDailyChart(dailySeries, maxYear) {
    const labels = dailySeries.map((row) => row.date || '--');
    const empenhadoDia = dailySeries.map((row) => toNumber(row.empenhado));
    const acumuladoAno = dailySeries.map((row) => toNumber(row.acumulado_empenhado));
    const percentual = (maxYear && maxYear > 0)
      ? acumuladoAno.map((value) => (value / maxYear) * 100)
      : [];

    const datasets = [
      {
        type: 'bar',
        label: 'Empenhado no dia',
        data: empenhadoDia,
        yAxisID: 'y',
        borderColor: '#c1733f',
        backgroundColor: 'rgba(193, 115, 63, 0.45)',
        borderRadius: 4,
        maxBarThickness: 16,
      },
      {
        type: 'line',
        label: 'Acumulado empenhado no ano',
        data: acumuladoAno,
        yAxisID: 'y1',
        borderColor: '#3f6b7b',
        backgroundColor: 'rgba(63, 107, 123, 0.15)',
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 1.5,
        fill: false,
      },
    ];

    if (percentual.length) {
      datasets.push({
        type: 'line',
        label: '% do valor autorizado anual já empenhado',
        data: percentual,
        yAxisID: 'y2',
        borderColor: '#2f7d59',
        borderWidth: 1.8,
        tension: 0.2,
        pointRadius: 1.2,
        fill: false,
      });
    }

    const chart = new Chart(els.chartDocsDaily, {
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            position: 'left',
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
            grid: { drawOnChartArea: true },
          },
          y1: {
            position: 'right',
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
            grid: { drawOnChartArea: false },
          },
          y2: {
            position: 'right',
            display: percentual.length > 0,
            ticks: {
              callback: (value) => `${value.toFixed(1)}%`,
            },
            grid: { drawOnChartArea: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'y2') {
                  return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`;
                }
                return `${ctx.dataset.label}: ${money(ctx.parsed.y)}`;
              },
            },
          },
        },
      },
    });

    chartInstances.push(chart);
  }

  function renderDocsTable(target, rows, rowBuilder, emptyColspan) {
    if (!rows.length) {
      target.innerHTML = `<tr><td colspan="${emptyColspan}">Sem dados.</td></tr>`;
      return;
    }
    target.innerHTML = rows.map(rowBuilder).join('');
  }

  function renderDocsAuthorsDynamic(report) {
    const docs = (((report.parallel_monitor || {}).documents) || {});
    const totals = docs.totals || {};

    const isYear = state.docsMode === 'year';
    const rows = isYear
      ? (docs.top_authors_year || [])
      : (docs.top_authors_last_day || []);

    const totalBase = isYear
      ? toNumber(totals.total_empenhado_year)
      : toNumber(totals.total_empenhado_last_day);

    const enriched = rows.map((row) => {
      const empenhado = toNumber(row.empenhado);
      return {
        ...row,
        empenhado,
        share: totalBase > 0 ? empenhado / totalBase : 0,
        groupLabel: classifyGroup(row.party || ''),
      };
    });

    renderDocsTable(
      els.tableDocsAuthorsDynamic,
      enriched.slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.author)}</td>
          <td>${esc(row.groupLabel)}</td>
          <td>${money(row.empenhado)}</td>
          <td>${pctFmt.format(row.share)}</td>
        </tr>
      `,
      4
    );

    if (docsAuthorsChart) {
      docsAuthorsChart.destroy();
      docsAuthorsChart = null;
    }

    const chartRows = enriched.slice(0, 10);
    const labels = chartRows.map((row) => shortLabel(row.author, 30));
    const shares = chartRows.map((row) => row.share * 100);
    const amounts = chartRows.map((row) => row.empenhado);

    docsAuthorsChart = new Chart(els.chartDocsAuthorsShare, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '% do total do recorte',
            data: shares,
            backgroundColor: 'rgba(63, 107, 123, 0.68)',
            borderRadius: 6,
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `${Number(value).toFixed(1)}%`,
            },
          },
          y: {
            ticks: {
              autoSkip: false,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x.toFixed(1)}% (${money(amounts[ctx.dataIndex] || 0)})`,
            },
          },
        },
      },
    });

    if (isYear) {
      els.docsModeNote.textContent = 'Modo no ano: ranking pelo acumulado empenhado no ano na base por documentos.';
    } else {
      els.docsModeNote.textContent = `Modo no dia: ranking do último dia disponível (${docs.date_max || '--'}).`;
    }
  }

  function renderClassicTables(docs, maxYear) {
    const series = (docs.daily_series || [])
      .slice()
      .filter((row) => row && row.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    if (!series.length) {
      els.tableClassicAccumulated.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
      els.tableClassicWeek.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
      els.tableClassicDay.innerHTML = '<tr><td colspan="2">Sem dados.</td></tr>';
      return;
    }

    const latestRows = series.slice(-8).reverse();
    els.tableClassicAccumulated.innerHTML = latestRows.map((row) => {
      const accum = toNumber(row.acumulado_empenhado);
      const pct = maxYear > 0 ? pctFmt.format(accum / maxYear) : '--';
      return `
        <tr>
          <td>${esc(formatDatePt(row.date))}</td>
          <td>${money(accum)}</td>
          <td>${pct}</td>
        </tr>
      `;
    }).join('');

    const dayRows = series
      .slice()
      .reverse()
      .filter((row) => toNumber(row.empenhado) > 0)
      .slice(0, 8);
    const dayRowsFinal = dayRows.length ? dayRows : latestRows;
    els.tableClassicDay.innerHTML = dayRowsFinal.map((row) => `
      <tr>
        <td>${esc(formatDatePt(row.date))}</td>
        <td>${money(row.empenhado)}</td>
      </tr>
    `).join('');

    const weekMap = new Map();
    for (const row of series) {
      const week = getIsoWeekLabel(row.date);
      if (!weekMap.has(week)) {
        weekMap.set(week, {
          week,
          weekly: 0,
          accum: 0,
          dateRef: row.date,
        });
      }
      const item = weekMap.get(week);
      item.weekly += toNumber(row.empenhado);
      if ((row.date || '') >= (item.dateRef || '')) {
        item.dateRef = row.date;
        item.accum = toNumber(row.acumulado_empenhado);
      }
    }

    const weekRows = Array.from(weekMap.values()).slice(-8).reverse();
    els.tableClassicWeek.innerHTML = weekRows.map((row) => `
      <tr>
        <td>${esc(row.week)}</td>
        <td>${money(row.accum)}</td>
        <td>${money(row.weekly)}</td>
      </tr>
    `).join('');
  }

  function renderApoiamentoDetails(apoiamento) {
    if (!apoiamento.available) {
      els.apoiamentoNote.textContent = 'Não houve arquivo de apoiamento disponível no momento desta atualização.';
      els.apoiamentoExplain.textContent = 'Sem essa fonte, não é possível mostrar quais parlamentares apoiaram emendas de outros autores nesta rodada.';
      els.tableApoiamentoTop.innerHTML = '<tr><td colspan="6">Sem dados de apoiamento disponíveis.</td></tr>';
      els.tableApoiamentoAuthors.innerHTML = '<tr><td colspan="2">Sem dados de apoiamento disponíveis.</td></tr>';
      els.tableApoiamentoGroups.innerHTML = '<tr><td colspan="2">Sem dados de apoiamento disponíveis.</td></tr>';
      return;
    }

    const source = apoiamento.source || {};
    const totals = apoiamento.totals || {};
    const totalEmpenhado = toNumber(totals.total_empenhado);
    const totalPago = toNumber(totals.total_pago);
    const top1Share = toNumber(totals.top1_share);
    const top5Share = toNumber(totals.top5_share);

    els.apoiamentoNote.innerHTML = `Base de apoiamento disponível para <strong>${apoiamento.year}</strong>. Última atualização da fonte: <strong>${esc(formatHeaderDate(source.last_modified || ''))}</strong>. <a href="${esc(source.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Abrir fonte oficial</a>.`;
    els.apoiamentoExplain.innerHTML = `
      Valor empenhado com apoiamento: <strong>${money(totalEmpenhado)}</strong> (pago: <strong>${money(totalPago)}</strong>).
      Concentração: o maior apoiador responde por <strong>${pctFmt.format(top1Share)}</strong> e os 5 maiores respondem por <strong>${pctFmt.format(top5Share)}</strong>.
      <br>Leitura prática: apoiamento indica quem assinou apoio para emenda de outro autor; não é novo gasto separado, é rede política de apoio.
    `;

    renderDocsTable(
      els.tableApoiamentoTop,
      (apoiamento.top_supporters || []).slice(0, 20),
      (row) => {
        const topAuthors = (row.top_supported_authors || [])
          .slice(0, 3)
          .map((item) => `${esc(item.author)} (${money(item.empenhado)})`)
          .join('<br>');
        return `
          <tr>
            <td>${esc(row.supporter)}</td>
            <td>${esc(row.group || '--')}</td>
            <td>${money(row.empenhado)}</td>
            <td>${pctFmt.format(toNumber(row.share_empenhado))}</td>
            <td>${nFmt.format(row.authors_count || 0)}</td>
            <td>${topAuthors || '--'}</td>
          </tr>
        `;
      },
      6
    );

    renderDocsTable(
      els.tableApoiamentoAuthors,
      (apoiamento.top_supported_authors || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.author)}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      2
    );

    renderDocsTable(
      els.tableApoiamentoGroups,
      (apoiamento.top_supporter_groups || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.group)}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      2
    );
  }

  function renderParallelMonitor(report) {
    const parallel = report.parallel_monitor || {};
    const docs = parallel.documents || {};
    const apoiamento = parallel.apoiamento || {};

    const maxDate = docs.date_max || '--';
    const minDate = docs.date_min || '--';
    const rowsValid = toNumber(docs.rows_valid_year);
    const totals = docs.totals || {};
    const maxYearInfo = getMaxYearInfo(report);
    const maxYear = toNumber(maxYearInfo.value);
    const committedYear = toNumber(totals.total_empenhado_year);

    const remaining = (maxYear && maxYear > 0) ? Math.max(maxYear - committedYear, 0) : null;
    els.docSpotlight.innerHTML = `
      Série diária de <strong>${esc(minDate)}</strong> até <strong>${esc(maxDate)}</strong>.
      Registros processados na fonte de documentos: <strong>${nFmt.format(rowsValid)}</strong>.
      ${maxYear && maxYear > 0
        ? `Do valor autorizado anual de <strong>${money(maxYear)}</strong>, já foram empenhados <strong>${money(committedYear)}</strong> e faltam <strong>${money(remaining)}</strong>.`
        : 'A fonte desta atualização não trouxe valor autorizado anual explícito para calcular quanto falta.'}
    `;

    renderDocsTable(
      els.tableDocsDestDay,
      (docs.top_destinations_last_day || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.destination)}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      2
    );
    renderApoiamentoDetails(apoiamento);
    renderClassicTables(docs, maxYear);

    renderDocsDailyChart(docs.daily_series || [], maxYear);
    renderDocsAuthorsDynamic(report);
  }

  function renderSiopDetails(report) {
    const siop = ((report.parallel_monitor || {}).siop_details) || {};
    if (!siop.available) {
      const errorMsg = (siop.error || '').trim();
      els.siopDetailNote.textContent = errorMsg
        ? `Não foi possível carregar o detalhamento direto do SIOP nesta atualização (${errorMsg}).`
        : 'Não foi possível carregar o detalhamento direto do SIOP nesta atualização.';
      els.tableSiopAuthors.innerHTML = '<tr><td colspan="3">Sem dados disponíveis.</td></tr>';
      els.tableSiopParties.innerHTML = '<tr><td colspan="2">Sem dados disponíveis.</td></tr>';
      els.tableSiopOrgaos.innerHTML = '<tr><td colspan="2">Sem dados disponíveis.</td></tr>';
      return;
    }

    const baseDate = siop.base_siafi_date || '--';
    const lastUpdate = siop.last_update || '--';
    const rowsCount = toNumber(siop.rows_count);
    const uniqueNros = toNumber(siop.unique_nro_emendas);
    const steps = toNumber(siop.sweep_steps);
    els.siopDetailNote.innerHTML =
      `Extração direta do SIOP concluída com <strong>${nFmt.format(rowsCount)}</strong> linhas` +
      ` (<strong>${nFmt.format(uniqueNros)}</strong> emendas únicas), base SIAFI em <strong>${esc(baseDate)}</strong>` +
      `${lastUpdate !== '--' ? ` e atualização do painel em <strong>${esc(lastUpdate)}</strong>` : ''}. ` +
      `Varredura vertical em <strong>${nFmt.format(steps)}</strong> passos.`;

    renderDocsTable(
      els.tableSiopAuthors,
      (siop.top_authors || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.author || '--')}</td>
          <td>${esc(classifyGroup(row.party || ''))}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      3
    );

    renderDocsTable(
      els.tableSiopParties,
      (siop.top_parties || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(classifyGroup(row.party || ''))}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      2
    );

    renderDocsTable(
      els.tableSiopOrgaos,
      (siop.top_orgaos || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.orgao || '--')}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      2
    );
  }

  function renderSources(report) {
    const source = report.source || {};
    const topAuthor = (report.top_authors_today || [])[0];
    const topDestination = (report.top_destinations_today || [])[0];
    const dayTotal = toNumber((report.metrics || {}).delta_positivo_desde_snapshot_anterior);
    const authorShare = topAuthor ? toNumber(topAuthor.share_in_day) : 0;
    const destinationShare = topDestination ? toNumber(topDestination.share_in_day) : 0;

    const parallel = report.parallel_monitor || {};
    const siopSnapshot = parallel.siop_snapshot || {};
    const siopDetails = parallel.siop_details || {};
    const docsSource = ((parallel.documents || {}).source) || {};
    const apoiamentoSource = ((parallel.apoiamento || {}).source) || {};
    const execucao = parallel.execucao_ano_corrente || {};

    const items = [
      `<li><strong>Base principal (acumulado):</strong> <a href="${esc(source.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Portal da Transparência - Emendas (UNICO)</a>.</li>`,
      `<li><strong>Referência de valor autorizado anual (RP 6/7/8 no ano corrente):</strong> <a href="${esc(siopSnapshot.source_url || '#')}" target="_blank" rel="noopener noreferrer">painel SIOP</a>${siopSnapshot.base_siafi_date ? ` (base SIAFI em ${esc(siopSnapshot.base_siafi_date)})` : ''}.</li>`,
      `<li><strong>Portal da Transparência (documentos por dia):</strong> <a href="${esc(docsSource.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Emendas parlamentares por documento</a>.</li>`,
      `<li><strong>Apoiamento de emendas:</strong> <a href="${esc(apoiamentoSource.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Base oficial de apoiamento</a>. Mostra rede de apoio entre autores.</li>`,
      `<li><strong>Execução do ano corrente:</strong> <a href="${esc(execucao.endpoint_url || '#')}" target="_blank" rel="noopener noreferrer">endpoint de execução no Portal da Transparência</a>.</li>`,
      `<li><strong>Regra principal do painel:</strong> “Empenhado no dia” = variação positiva no acumulado entre snapshots consecutivos da mesma fonte.</li>`,
      `<li><strong>Leitura rápida do dia (Siga Brasil):</strong> total positivo de ${money(dayTotal)}.`
      + (topAuthor ? ` Autor líder: ${esc(topAuthor.author)} (${pctFmt.format(authorShare)} do total do dia).` : '')
      + (topDestination ? ` Localidade líder: ${esc(topDestination.destination)} (${pctFmt.format(destinationShare)} do total do dia).` : '')
      + '</li>',
      `<li><strong>Comparativo SIOP:</strong> ${siopDetails.available ? `${nFmt.format(toNumber(siopDetails.unique_nro_emendas))} emendas únicas no recorte atual.` : 'indisponível nesta atualização.'} Abra a aba de comparação quando precisar desse detalhe.</li>`,
    ];

    els.sourcesList.innerHTML = items.join('');
  }

  function setStatus(report, metadata) {
    els.statusUpdate.textContent = `Atualizado: ${formatIsoDateTime(report.generated_at || metadata.updated_at || '')}`;
    els.statusSnapshot.textContent = `Snapshot: ${report.snapshot_date || metadata.snapshot_date || '--'}`;
  }

  function renderHeaderForView(report, metadata) {
    if (state.activeView === 'snapshot') {
      setSnapshotKpis(report);
      const source = report.source || {};
      const siop = (((report.parallel_monitor || {}).siop_snapshot) || {});
      const siopDate = siop.last_update || siop.base_siafi_date || '';
      els.statusSource.textContent = `Fonte ativa: Comparativo SIOP + Siga Brasil (${formatHeaderDate(source.last_modified || metadata.source_last_modified || '')})`;
      els.sourceUpdatedLine.textContent = `Última atualização desta fonte: UNICO em ${formatHeaderDate(source.last_modified || metadata.source_last_modified || '')}${siopDate ? `; SIOP/SIAFI em ${esc(siopDate)}` : ''}.`;
    } else {
      setDocsKpis(report);
      const docsSource = (((report.parallel_monitor || {}).documents || {}).source) || {};
      const apoiamentoSource = (((report.parallel_monitor || {}).apoiamento || {}).source) || {};
      els.statusSource.textContent = `Fonte ativa: Portal da Transparência (${formatHeaderDate(docsSource.last_modified || metadata.documents_last_modified || '')})`;
      els.sourceUpdatedLine.textContent = `Última atualização desta fonte: documentos em ${formatHeaderDate(docsSource.last_modified || metadata.documents_last_modified || '')}; apoiamento em ${formatHeaderDate(apoiamentoSource.last_modified || metadata.apoiamento_last_modified || '')}.`;
    }
  }

  async function boot() {
    destroyCharts();

    let report = null;
    let metadata = null;
    try {
      [report, metadata] = await Promise.all([
        fetchJson('./data/report_data.json'),
        fetchJson('./data/metadata.json').catch(() => ({})),
      ]);
    } catch (error) {
      els.spotlight.textContent = `Falha ao carregar dados: ${error.message}`;
      return;
    }

    state.report = report;
    state.metadata = metadata || {};

    setStatus(report, state.metadata);
    setSpotlight(report);
    renderComparisonAlert(report, state.metadata);

    renderPairsTable(report.top_author_destination_today || []);
    const topAuthorsYear = report.top_authors_year || report.top_authors_total || [];
    const topDestinationsYear = report.top_destinations_year || report.top_destinations_total || [];
    renderAuthorsTotalTable(topAuthorsYear);
    renderSimpleTable(els.tableDestinationsTotal, topDestinationsYear, 'destination', 'total_empenhado', 2);

    renderHistoryChart(report.daily_history || []);
    renderBarChart(
      els.chartAuthors,
      report.top_authors_today || [],
      'author',
      'delta_empenhado',
      'Aumento por autor',
      'rgba(193, 115, 63, 0.72)'
    );
    renderBarChart(
      els.chartDestinations,
      report.top_destinations_today || [],
      'destination',
      'delta_empenhado',
      'Aumento por localidade de aplicação',
      'rgba(63, 107, 123, 0.72)'
    );

    renderParallelMonitor(report);
    renderSources(report);

    els.tabViewSnapshot.addEventListener('click', () => setActiveView('snapshot'));
    els.tabViewDocs.addEventListener('click', () => setActiveView('docs'));
    if (els.compareAlertAction) {
      els.compareAlertAction.addEventListener('click', () => setActiveView('snapshot'));
    }

    if (els.docsModeDay) {
      els.docsModeDay.addEventListener('click', () => {
        state.docsMode = 'day';
        els.docsModeDay.classList.add('active');
        els.docsModeYear.classList.remove('active');
        if (state.report) renderDocsAuthorsDynamic(state.report);
      });
    }

    if (els.docsModeYear) {
      els.docsModeYear.addEventListener('click', () => {
        state.docsMode = 'year';
        els.docsModeYear.classList.add('active');
        els.docsModeDay.classList.remove('active');
        if (state.report) renderDocsAuthorsDynamic(state.report);
      });
    }

    setActiveView(getInitialView());
  }

  boot();
})();
