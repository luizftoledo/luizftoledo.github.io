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
    tableApoiamentoTop: document.getElementById('table-apoiamento-top'),
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
    activeView: 'snapshot',
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

  function getEstimatedMaxYear(report) {
    const stageValues = (((report.parallel_monitor || {}).execucao_ano_corrente || {}).stage_values) || {};
    const empenhado = toNumber(stageValues.empenhado);
    const aEmpenhar = toNumber(stageValues.a_empenhar);
    if (aEmpenhar > 0) {
      return empenhado + aEmpenhar;
    }
    return null;
  }

  function setActiveView(viewId) {
    const isSnapshot = viewId === 'snapshot';
    state.activeView = isSnapshot ? 'snapshot' : 'docs';

    els.viewSnapshot.hidden = !isSnapshot;
    els.viewDocs.hidden = isSnapshot;
    els.tabViewSnapshot.classList.toggle('active', isSnapshot);
    els.tabViewDocs.classList.toggle('active', !isSnapshot);

    if (state.report) {
      renderHeaderForView(state.report, state.metadata || {});
    }
  }

  function setSnapshotKpis(report) {
    const metrics = report.metrics || {};
    const deltaNet = toNumber(metrics.delta_liquido_desde_snapshot_anterior);
    const deltaPositive = toNumber(metrics.delta_positivo_desde_snapshot_anterior);

    els.kpiLabelNet.textContent = 'Variação líquida no dia';
    els.kpiLabelAuthors.textContent = 'Autores com aumento hoje';
    els.kpiLabelDestinations.textContent = 'Destinos com aumento hoje';

    els.kpiDayMain.textContent = money(deltaPositive);
    els.kpiDayMainNote.textContent = 'Comparação com o snapshot anterior da base Siga Brasil.';

    els.kpiDeltaNet.textContent = money(deltaNet);
    els.kpiDeltaNet.classList.toggle('good', deltaNet >= 0);
    els.kpiDeltaNet.classList.toggle('bad', deltaNet < 0);

    els.kpiAuthorsUp.textContent = nFmt.format(metrics.autores_com_aumento || 0);
    els.kpiDestinationsUp.textContent = nFmt.format(metrics.destinos_com_aumento || 0);

    const totalBase = toNumber(metrics.total_empenhado_atual);
    const totalYear = toNumber(metrics.current_year_total_empenhado || ((report.unico_year_summary || {}).total_empenhado || 0));

    setProgress(
      els.snapshotProgressTotalFill,
      els.snapshotProgressTotalText,
      deltaPositive,
      totalBase,
      { noBaseText: 'Sem total disponível' }
    );

    setProgress(
      els.snapshotProgressYearFill,
      els.snapshotProgressYearText,
      deltaPositive,
      totalYear,
      { noBaseText: 'Sem total anual disponível' }
    );

    if (totalYear > 0) {
      els.snapshotProgressNote.textContent = 'A barra anual mostra quanto o movimento do dia representa dentro do total já empenhado no ano corrente.';
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
    const maxYear = getEstimatedMaxYear(report);

    els.kpiLabelNet.textContent = 'Empenhado no ano (acum.)';
    els.kpiLabelAuthors.textContent = 'Autores com empenho no último dia';
    els.kpiLabelDestinations.textContent = 'Destinos com empenho no último dia';

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
        { noBaseText: 'Sem teto disponível' }
      );
      els.docsProgressNote.textContent = `Teto estimado com base no endpoint de execução do ano: ${money(maxYear)}.`;
    } else {
      els.docKpiMaxYear.textContent = 'não disponível';
      els.docsProgressYearFill.style.width = '0%';
      els.docsProgressYearText.textContent = `Sem teto anual divulgado (já empenhado ${money(committedYear)})`;
      els.docsProgressNote.textContent = 'Esta fonte não trouxe teto anual explícito nesta atualização. Mostramos apenas o acumulado já empenhado.';
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
    const topAuthor = (report.top_authors_today || [])[0];
    const topDestination = (report.top_destinations_today || [])[0];
    const delta = toNumber((report.metrics || {}).delta_positivo_desde_snapshot_anterior);
    const rows = toNumber((report.metrics || {}).total_linhas_csv);
    const baseline = Boolean((report.metrics || {}).baseline_initialized);

    if (baseline) {
      els.spotlight.innerHTML = `Primeira carga do monitor concluída. Este snapshot serve como linha de base para calcular o movimento diário a partir da próxima atualização. Base processada: <strong>${nFmt.format(rows)}</strong> linhas.`;
      return;
    }

    if (!topAuthor || !topDestination) {
      els.spotlight.innerHTML = `Hoje não houve variação positiva identificada. Base processada: <strong>${nFmt.format(rows)}</strong> linhas.`;
      return;
    }

    els.spotlight.innerHTML = `
      No snapshot de <strong>${esc(report.snapshot_date || '--')}</strong>, o monitor identificou
      <strong>${money(delta)}</strong> de aumento positivo em empenhos.
      Quem mais cresceu no dia foi <strong>${esc(topAuthor.author)}</strong>
      (${esc(topAuthor.party || 'sem partido mapeado')}, ${money(topAuthor.delta_empenhado)}),
      e o principal destino foi <strong>${esc(topDestination.destination)}</strong>
      (${money(topDestination.delta_empenhado)}).
    `;
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
        label: '% do teto anual já empenhado',
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
    const labels = chartRows.map((row) => shortLabel(row.author, 24));
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
            maxBarThickness: 24,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            ticks: {
              callback: (value) => `${value.toFixed(1)}%`,
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

  function renderParallelMonitor(report) {
    const parallel = report.parallel_monitor || {};
    const docs = parallel.documents || {};
    const apoiamento = parallel.apoiamento || {};

    const maxDate = docs.date_max || '--';
    const minDate = docs.date_min || '--';
    const rowsValid = toNumber(docs.rows_valid_year);
    const totals = docs.totals || {};
    const maxYear = getEstimatedMaxYear(report);
    const committedYear = toNumber(totals.total_empenhado_year);

    const remaining = (maxYear && maxYear > 0) ? Math.max(maxYear - committedYear, 0) : null;
    els.docSpotlight.innerHTML = `
      Série diária de <strong>${esc(minDate)}</strong> até <strong>${esc(maxDate)}</strong>.
      Registros processados na fonte de documentos: <strong>${nFmt.format(rowsValid)}</strong>.
      ${maxYear && maxYear > 0
        ? `Do teto anual estimado de <strong>${money(maxYear)}</strong>, já foram empenhados <strong>${money(committedYear)}</strong> e faltam <strong>${money(remaining)}</strong>.`
        : 'A fonte desta atualização não trouxe teto anual explícito para calcular quanto falta.'}
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

    if (apoiamento.available) {
      const source = apoiamento.source || {};
      els.apoiamentoNote.innerHTML = `Base de apoiamento disponível para <strong>${apoiamento.year}</strong>. Última atualização da fonte: <strong>${esc(formatHeaderDate(source.last_modified || ''))}</strong>. <a href="${esc(source.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Abrir fonte oficial</a>.`;
      els.apoiamentoExplain.innerHTML = 'Apoiamento mostra quem apoiou emenda de quem. Isso ajuda a entender articulação política entre parlamentares e bancadas, sem duplicar o valor do gasto.';
      renderDocsTable(
        els.tableApoiamentoTop,
        (apoiamento.top_supporters || []).slice(0, 20),
        (row) => `
          <tr>
            <td>${esc(row.supporter)}</td>
            <td>${money(row.empenhado)}</td>
            <td>${money(row.pago)}</td>
            <td>${nFmt.format(row.authors_count || 0)}</td>
          </tr>
        `,
        4
      );
    } else {
      els.apoiamentoNote.textContent = 'Não houve arquivo de apoiamento disponível no momento desta atualização.';
      els.apoiamentoExplain.textContent = 'Sem essa fonte, não é possível mostrar quais parlamentares apoiaram emendas de outros autores nesta rodada.';
      els.tableApoiamentoTop.innerHTML = '<tr><td colspan="4">Sem dados de apoiamento disponíveis.</td></tr>';
    }

    renderDocsDailyChart(docs.daily_series || [], maxYear);
    renderDocsAuthorsDynamic(report);
  }

  function renderSources(report) {
    const source = report.source || {};
    const topAuthor = (report.top_authors_today || [])[0];
    const topDestination = (report.top_destinations_today || [])[0];
    const dayTotal = toNumber((report.metrics || {}).delta_positivo_desde_snapshot_anterior);
    const authorShare = topAuthor ? toNumber(topAuthor.share_in_day) : 0;
    const destinationShare = topDestination ? toNumber(topDestination.share_in_day) : 0;

    const parallel = report.parallel_monitor || {};
    const docsSource = ((parallel.documents || {}).source) || {};
    const apoiamentoSource = ((parallel.apoiamento || {}).source) || {};
    const execucao = parallel.execucao_ano_corrente || {};

    const items = [
      `<li><strong>Siga Brasil (snapshot consolidado):</strong> <a href="${esc(source.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Portal da Transparência - Emendas (UNICO)</a>.</li>`,
      `<li><strong>Portal da Transparência (documentos por dia):</strong> <a href="${esc(docsSource.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Emendas parlamentares por documento</a>.</li>`,
      `<li><strong>Apoiamento de emendas:</strong> <a href="${esc(apoiamentoSource.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Base oficial de apoiamento</a>. Mostra rede de apoio entre autores.</li>`,
      `<li><strong>Execução do ano corrente:</strong> <a href="${esc(execucao.endpoint_url || '#')}" target="_blank" rel="noopener noreferrer">endpoint de execução no Portal da Transparência</a>.</li>`,
      `<li><strong>Regra principal do painel:</strong> “Empenhado no dia” = variação positiva no acumulado entre snapshots consecutivos da mesma fonte.</li>`,
      `<li><strong>Leitura rápida do dia (Siga Brasil):</strong> total positivo de ${money(dayTotal)}.`
      + (topAuthor ? ` Autor líder: ${esc(topAuthor.author)} (${pctFmt.format(authorShare)} do total do dia).` : '')
      + (topDestination ? ` Destino líder: ${esc(topDestination.destination)} (${pctFmt.format(destinationShare)} do total do dia).` : '')
      + '</li>',
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
      els.statusSource.textContent = `Fonte ativa: Siga Brasil (${formatHeaderDate(source.last_modified || metadata.source_last_modified || '')})`;
      els.sourceUpdatedLine.textContent = `Última atualização desta fonte: ${formatHeaderDate(source.last_modified || metadata.source_last_modified || '')}`;
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

    renderPairsTable(report.top_author_destination_today || []);
    renderAuthorsTotalTable(report.top_authors_total || []);
    renderSimpleTable(els.tableDestinationsTotal, report.top_destinations_total || [], 'destination', 'total_empenhado', 2);

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
      'Aumento por destino',
      'rgba(63, 107, 123, 0.72)'
    );

    renderParallelMonitor(report);
    renderSources(report);

    els.tabViewSnapshot.addEventListener('click', () => setActiveView('snapshot'));
    els.tabViewDocs.addEventListener('click', () => setActiveView('docs'));

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

    setActiveView('snapshot');
  }

  boot();
})();
